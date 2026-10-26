import { Injectable, Logger } from '@nestjs/common';
import { ActivityTypes, ConversationReference, TeamsActivityHandler, TurnContext } from 'botbuilder';
import { AgentService } from '../agent/agent.service';
import { ConversationSenderService } from './conversation-sender.service';
import { TeamsInstallationService } from './teams-installation.service';
import { EventLogService } from '../common/services/event-log.service';

/**
 * Nhận activity từ Bot Framework (đã được CloudAdapter xác thực JWT và parse ở controller).
 * Chỉ lo việc ROUTING: ghi nhớ conversation, lọc @mention, chạy agent nền, trả lời đúng thread.
 * Logic gửi tin / lưu trữ nằm ở ConversationSenderService & TeamsInstallationService để dùng
 * lại được cho API /api/notify — handler này không có logic nghiệp vụ nào khác.
 */
@Injectable()
export class BotActivityHandler extends TeamsActivityHandler {
  private readonly logger = new Logger(BotActivityHandler.name);

  constructor(
    private readonly agent: AgentService,
    private readonly sender: ConversationSenderService,
    private readonly installation: TeamsInstallationService,
    private readonly events: EventLogService,
  ) {
    super();

    // Bot được add vào team / có người join -> ghi nhớ conversation, và nếu là team thì
    // lấy luôn danh sách mọi channel để API /api/notify gửi được vào bất kỳ channel nào
    this.onConversationUpdate(async (ctx, next) => {
      await this.installation.remember(ctx);
      await this.installation.rememberTeamChannels(ctx);
      await next();
    });

    // Trong channel: chỉ nhận khi bị @mention. Trong chat 1-1: nhận mọi tin.
    this.onMessage(async (ctx, next) => {
      await this.installation.remember(ctx);
      await this.handleMessage(ctx);
      await next();
    });
  }

  private async handleMessage(ctx: TurnContext): Promise<void> {
    const text = (TurnContext.removeRecipientMention(ctx.activity) ?? ctx.activity.text ?? '').trim();
    const ref = TurnContext.getConversationReference(ctx.activity);
    const user = ctx.activity.from?.name ?? 'User';
    const where = this.installation.describe(ref.conversation?.id ?? '');

    this.logger.log(`[${ref.conversation?.conversationType ?? 'personal'}] ${user}: ${text}`);
    this.events.add({ kind: 'mention', who: user, where, text: text || '(trống)' });

    if (!text) {
      await ctx.sendActivity('Bạn cần mình giúp gì?');
      return;
    }

    // Hiện "đang gõ..." rồi trả HTTP 200 ngay; agent chạy nền
    await ctx.sendActivity({ type: ActivityTypes.Typing });
    void this.runAgent(ref, text, user, where);
  }

  private async runAgent(ref: Partial<ConversationReference>, text: string, user: string, where: string): Promise<void> {
    const conversationKey = ref.conversation?.id ?? 'unknown';
    let replied = false;

    try {
      await this.agent.run({
        conversationKey,
        input: text,
        user,
        // Tool trả lời bị "khoá" vào đúng conversation/thread này
        replyToChannel: async (markdown: string) => {
          replied = true;
          await this.sender.sendToReference(ref, markdown);
          this.events.add({ kind: 'reply', where, text: markdown });
        },
        sendTyping: () => this.sender.sendTyping(ref),
      });
      if (!replied) await this.sender.sendToReference(ref, '_(Agent không đưa ra câu trả lời nào.)_');
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(e);
      this.events.add({ kind: 'error', where, text: `Agent lỗi: ${message}` });
      await this.sender.sendToReference(ref, `⚠️ Agent lỗi: ${message}`).catch(() => undefined);
    }
  }
}

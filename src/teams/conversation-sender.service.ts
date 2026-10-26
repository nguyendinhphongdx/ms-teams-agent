import { Inject, Injectable, Logger } from '@nestjs/common';
import { ActivityTypes, CloudAdapter, ConversationReference, MessageFactory, TurnContext } from 'botbuilder';
import { BOT_ADAPTER } from './bot-framework.provider';
import { config } from '../config/config';
import { ConversationStoreService, StoredConversation } from './conversation-store.service';

export interface SendResult {
  conversationId: string;
  threadId?: string;
  messageId?: string;
}

/**
 * Gửi tin chủ động vào Teams, ngoài luồng request/response của một @mention đang xử lý.
 * Dùng chung cho 2 trường hợp:
 *  - BotActivityHandler trả lời vào đúng thread vừa @mention
 *  - NotifyController (API /api/notify) gửi vào một conversation đã biết từ trước
 * Tách riêng để NotifyController không phải phụ thuộc vào activity handler chỉ để gửi tin.
 */
@Injectable()
export class ConversationSenderService {
  private readonly logger = new Logger(ConversationSenderService.name);

  constructor(
    @Inject(BOT_ADAPTER) private readonly adapter: CloudAdapter,
    private readonly store: ConversationStoreService,
  ) {}

  /** Gửi vào conversation theo ConversationReference đã có sẵn (vd thread vừa @mention) */
  async sendToReference(ref: Partial<ConversationReference>, markdown: string): Promise<void> {
    await this.adapter.continueConversationAsync(config.bot.appId, ref, async (ctx) => {
      await ctx.sendActivity(MessageFactory.text(markdown));
    });
  }

  async sendTyping(ref: Partial<ConversationReference>): Promise<void> {
    await this.adapter
      .continueConversationAsync(config.bot.appId, ref, async (ctx) => {
        await ctx.sendActivity({ type: ActivityTypes.Typing });
      })
      .catch(() => undefined);
  }

  /**
   * Gửi vào một conversation đã biết theo id/tên (dùng cho API /api/notify).
   * - Không có threadId: tạo post MỚI trong channel (hoặc tin mới trong chat)
   * - Có threadId: reply vào thread đó
   * Trả về messageId để lần sau reply tiếp vào đúng thread vừa tạo.
   */
  async sendToKnownConversation(conversationId: string, markdown: string, threadId?: string): Promise<SendResult> {
    const target = this.store.get(conversationId);
    if (!target) throw new Error(`Bot chưa biết conversation ${conversationId}`);

    const isNewChannelPost = target.type === 'channel' && !threadId;
    const id = threadId && target.type === 'channel' ? `${target.conversationId};messageid=${threadId}` : target.conversationId;
    // Bỏ activityId cũ trong reference đã lưu, tránh bị hiểu là reply vào tin nhắn cũ
    const ref = { ...target.reference, activityId: undefined, conversation: { ...target.reference.conversation!, id } };

    let messageId: string | undefined;
    let newThreadId: string | undefined;

    await this.adapter.continueConversationAsync(config.bot.appId, ref, async (ctx) => {
      if (isNewChannelPost) {
        const opened = await this.openNewChannelThread(ctx, target, markdown).catch((e: Error) => {
          this.logger.warn(`Không mở được thread mới (${e.message}), gửi trực tiếp vào channel`);
          return null;
        });
        if (opened) {
          messageId = opened.messageId;
          newThreadId = opened.threadId;
          return;
        }
      }
      const res = await ctx.sendActivity(MessageFactory.text(markdown));
      messageId = res?.id;
    });

    return { conversationId: target.conversationId, threadId: threadId ?? newThreadId ?? messageId, messageId };
  }

  /**
   * Mở thread mới trong channel = tạo conversation mới gắn với channel đó.
   * Tương đương TeamsInfo.sendMessageToTeamsChannel, nhưng hàm đó không chạy được với CloudAdapter
   * (`createConnectorClient is not a function`) nên lấy thẳng connector client từ turnState.
   */
  private async openNewChannelThread(
    ctx: TurnContext,
    target: StoredConversation,
    markdown: string,
  ): Promise<{ messageId?: string; threadId?: string }> {
    const client: any = ctx.turnState.get(this.adapter.ConnectorClientKey);
    const res = await client.conversations.createConversation({
      isGroup: true,
      bot: { id: config.bot.appId, name: '' },
      channelData: { channel: { id: target.conversationId } },
      activity: MessageFactory.text(markdown),
      members: [],
    });
    return { messageId: res.activityId, threadId: res.id?.split(';messageid=')[1] ?? res.activityId };
  }
}

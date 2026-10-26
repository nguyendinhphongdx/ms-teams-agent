import { Injectable, Logger } from '@nestjs/common';
import { TeamsChannelData, TeamsInfo, TurnContext } from 'botbuilder';
import { ConversationStoreService } from './conversation-store.service';
import { EventLogService } from '../common/services/event-log.service';

/**
 * Theo dõi bot được cài vào đâu: lưu "địa chỉ" (ConversationReference) của mỗi conversation
 * bot nhận được tin, và khi bot được add vào một team thì lấy luôn danh sách mọi channel của
 * team đó — để API /api/notify gửi được vào bất kỳ channel nào mà không cần ai @mention trước.
 */
@Injectable()
export class TeamsInstallationService {
  private readonly logger = new Logger(TeamsInstallationService.name);

  constructor(
    private readonly store: ConversationStoreService,
    private readonly events: EventLogService,
  ) {}

  /** Lưu "địa chỉ" của conversation hiện tại — gọi ở mọi activity bot nhận được */
  async remember(ctx: TurnContext): Promise<void> {
    const activity = ctx.activity;
    const conv = activity.conversation;
    if (!conv?.id) return;

    const channelData: TeamsChannelData = activity.channelData ?? {};
    const type = this.resolveType(conv.conversationType);

    await this.store
      .upsert({
        conversationId: conv.id,
        type,
        name: this.resolveName(channelData, conv.name, type),
        teamId: channelData.team?.id,
        teamName: channelData.team?.name,
        reference: TurnContext.getConversationReference(activity),
      })
      .catch((e) => this.logger.warn(`Không lưu được conversation: ${e.message}`));
  }

  /** Khi ở trong team: lấy danh sách mọi channel và lưu địa chỉ từng channel */
  async rememberTeamChannels(ctx: TurnContext): Promise<void> {
    const team = ctx.activity.channelData?.team;
    if (!team?.id) return;

    try {
      const channels = await TeamsInfo.getTeamChannels(ctx, team.id);
      const base = TurnContext.getConversationReference(ctx.activity);

      for (const channel of channels) {
        if (!channel.id) continue;
        await this.store.upsert({
          conversationId: channel.id,
          type: 'channel',
          name: channel.name ?? (channel.id === team.id ? 'General' : undefined),
          teamId: team.id,
          teamName: team.name,
          reference: {
            ...base,
            conversation: { ...base.conversation!, id: channel.id, conversationType: 'channel', isGroup: true },
          },
        });
      }

      this.logger.log(`Đã lưu ${channels.length} channel của team ${team.name ?? team.id}`);
      this.events.add({ kind: 'install', where: team.name ?? team.id, text: `Bot đã biết ${channels.length} channel trong team` });
    } catch (e) {
      this.logger.warn(`Không lấy được danh sách channel: ${(e as Error).message}`);
    }
  }

  /** Tên dễ đọc của một conversation đã biết, để hiện trong nhật ký hoạt động */
  describe(conversationId: string): string {
    const c = this.store.get(conversationId);
    if (c?.name) return c.name;
    if (c?.type === 'personal') return 'Chat 1-1';
    if (c?.type === 'groupChat') return 'Group chat';
    return ConversationStoreService.baseId(conversationId);
  }

  private resolveType(conversationType?: string): 'channel' | 'groupChat' | 'personal' {
    if (conversationType === 'channel') return 'channel';
    if (conversationType === 'groupChat') return 'groupChat';
    return 'personal';
  }

  /** channel General có id = team id; activity message thường không kèm tên channel */
  private resolveName(channelData: TeamsChannelData, conversationName: string | undefined, type: string): string | undefined {
    if (channelData.channel?.name) return channelData.channel.name;
    if (channelData.team && channelData.channel?.id === channelData.team.id) return 'General';
    return type !== 'channel' ? conversationName : undefined;
  }
}

import { BadRequestException, Body, Controller, Get, Logger, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { EventLogService } from '../common/services/event-log.service';
import { ConversationSenderService } from '../teams/conversation-sender.service';
import { ConversationStoreService } from '../teams/conversation-store.service';

interface NotifyBody {
  /** id conversation (vd "19:xxx@thread.tacv2") HOẶC tên channel (vd "ai-bot") */
  channel?: string;
  text?: string;
  /** messageId của post gốc -> reply vào thread đó thay vì tạo post mới */
  threadId?: string;
}

/**
 * API cho hệ thống khác (GitLab CI, cron, service nội bộ...) gửi tin vào Teams.
 * Bảo vệ bằng header `x-api-key` = NOTIFY_API_KEY.
 */
@Controller('api/notify')
@UseGuards(ApiKeyGuard)
export class NotifyController {
  private readonly logger = new Logger(NotifyController.name);

  constructor(
    private readonly sender: ConversationSenderService,
    private readonly store: ConversationStoreService,
    private readonly events: EventLogService,
  ) {}

  /** Liệt kê các nơi bot có thể gửi tin (channel đã cài bot, chat đã nhắn với bot) */
  @Get('channels')
  channels() {
    return this.store.list().map(({ conversationId, type, name, teamName, updatedAt }) => ({
      conversationId,
      type,
      name,
      teamName,
      updatedAt,
    }));
  }

  @Post()
  async notify(@Body() body: NotifyBody) {
    if (!body?.channel || !body?.text?.trim()) throw new BadRequestException('Cần "channel" và "text"');

    const target = this.store.find(body.channel);
    if (!target) {
      throw new NotFoundException(
        `Không tìm thấy "${body.channel}". Bot phải được cài vào team đó trước; xem GET /api/notify/channels`,
      );
    }

    const where = target.name ?? target.conversationId;
    try {
      const result = await this.sender.sendToKnownConversation(target.conversationId, body.text, body.threadId);
      this.logger.log(`notify → ${where}${body.threadId ? ` (thread ${body.threadId})` : ''}`);
      this.events.add({ kind: 'notify', where, text: body.threadId ? `↳ ${body.text}` : body.text });
      return { ok: true, channel: target.name, ...result };
    } catch (e) {
      this.events.add({ kind: 'error', where, text: `Gửi thất bại: ${(e as Error).message}` });
      throw e;
    }
  }
}

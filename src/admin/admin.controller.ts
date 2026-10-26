import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { EventLogService } from '../common/services/event-log.service';
import { ConversationStoreService } from '../teams/conversation-store.service';
import { config, isAiEnabled, isBotAuthEnabled } from '../config/config';

const startedAt = Date.now();

@Controller()
export class AdminController {
  constructor(
    private readonly events: EventLogService,
    private readonly store: ConversationStoreService,
  ) {}

  /** Trang quản trị. Trang tĩnh, không chứa dữ liệu; mọi dữ liệu lấy qua API có x-api-key */
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async ui() {
    return fs.readFile(path.resolve('public/index.html'), 'utf8');
  }

  /** Cho trang biết có cần nhập API key không (không lộ thông tin gì khác) */
  @Get('api/admin/auth')
  auth() {
    return { apiKeyRequired: ApiKeyGuard.required() };
  }

  @Get('api/admin/status')
  @UseGuards(ApiKeyGuard)
  status() {
    return {
      botName: config.bot.displayName,
      authMode: isBotAuthEnabled() ? 'teams' : 'playground',
      ai: isAiEnabled() ? { mode: 'gemini', model: config.gemini.model } : { mode: 'echo' },
      conversations: this.store.list().length,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    };
  }

  @Get('api/admin/events')
  @UseGuards(ApiKeyGuard)
  list(@Query('after') after?: string) {
    return this.events.since(Number(after) || 0);
  }
}

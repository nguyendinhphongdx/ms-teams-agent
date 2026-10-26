import { Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CloudAdapter } from 'botbuilder';
import { BOT_ADAPTER } from './bot-framework.provider';
import { BotActivityHandler } from './bot-activity.handler';

@Controller()
export class TeamsBotController {
  constructor(
    @Inject(BOT_ADAPTER) private readonly adapter: CloudAdapter,
    private readonly handler: BotActivityHandler,
  ) {}

  /** Endpoint Teams / Agents Playground gọi vào */
  @Post('api/messages')
  async messages(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.adapter.process(req, res, (ctx) => this.handler.run(ctx));
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}

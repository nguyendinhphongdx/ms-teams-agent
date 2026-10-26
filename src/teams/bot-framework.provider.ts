import { Logger } from '@nestjs/common';
import { CloudAdapter, ConfigurationBotFrameworkAuthentication } from 'botbuilder';
import { config, isBotAuthEnabled } from '../config/config';

/** DI token cho CloudAdapter (tạo bằng factory provider dưới đây) */
export const BOT_ADAPTER = Symbol('BOT_ADAPTER');

/**
 * Dựng CloudAdapter của Bot Framework.
 * - Không có MicrosoftAppId -> chế độ anonymous, dùng cho Agents Playground (bỏ qua verify JWT).
 * - Có MicrosoftAppId -> bắt buộc JWT hợp lệ, dùng khi chạy với Teams thật.
 */
export function createBotAdapter(): CloudAdapter {
  const logger = new Logger('BotFrameworkAdapter');
  const auth = new ConfigurationBotFrameworkAuthentication(
    isBotAuthEnabled()
      ? {
          MicrosoftAppId: config.bot.appId,
          MicrosoftAppPassword: config.bot.appPassword,
          MicrosoftAppTenantId: config.bot.tenantId,
          MicrosoftAppType: 'SingleTenant',
        }
      : {},
  );

  const adapter = new CloudAdapter(auth);
  adapter.onTurnError = async (ctx, err) => {
    logger.error(err);
    await ctx.sendActivity('⚠️ Bot gặp lỗi, thử lại sau.');
  };
  return adapter;
}

/** Factory provider (NestJS custom provider) — đăng ký trong TeamsModule */
export const botAdapterProvider = {
  provide: BOT_ADAPTER,
  useFactory: createBotAdapter,
};

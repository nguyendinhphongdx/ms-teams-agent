import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { config, isAiEnabled, isBotAuthEnabled } from './config/config';

async function bootstrap() {
  // Chặn deploy production mà quên credentials -> endpoint sẽ không có xác thực
  if (config.isProduction && !isBotAuthEnabled()) {
    throw new Error('MicrosoftAppId bắt buộc khi NODE_ENV=production');
  }

  const app = await NestFactory.create(AppModule);
  await app.listen(config.port);

  const mode = isBotAuthEnabled() ? 'AUTH (Teams thật)' : 'ANONYMOUS (Agents Playground)';
  const ai = isAiEnabled() ? config.gemini.model : 'ECHO (chưa có GEMINI_API_KEY)';
  Logger.log(`Bot listening on http://localhost:${config.port}/api/messages`, 'Bootstrap');
  Logger.log(`Auth mode: ${mode} | AI: ${ai}`, 'Bootstrap');
}
bootstrap();

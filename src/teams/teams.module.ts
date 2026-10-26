import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { TeamsBotController } from './teams-bot.controller';
import { BotActivityHandler } from './bot-activity.handler';
import { botAdapterProvider } from './bot-framework.provider';
import { ConversationStoreService } from './conversation-store.service';
import { ConversationSenderService } from './conversation-sender.service';
import { TeamsInstallationService } from './teams-installation.service';

@Module({
  imports: [AgentModule],
  controllers: [TeamsBotController],
  providers: [botAdapterProvider, BotActivityHandler, ConversationStoreService, ConversationSenderService, TeamsInstallationService],
  // Export để NotifyModule/AdminModule đọc địa chỉ conversation và gửi tin mà không cần biết gì
  // về activity handler hay adapter.
  exports: [ConversationStoreService, ConversationSenderService],
})
export class TeamsModule {}

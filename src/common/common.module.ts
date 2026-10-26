import { Global, Module } from '@nestjs/common';
import { EventLogService } from './services/event-log.service';
import { ApiKeyGuard } from './guards/api-key.guard';

/**
 * Provider dùng chung giữa nhiều feature module (nhật ký hoạt động, guard xác thực API nội bộ).
 * @Global() để TeamsModule/AgentModule/NotifyModule/AdminModule không phải import lại.
 */
@Global()
@Module({
  providers: [EventLogService, ApiKeyGuard],
  exports: [EventLogService, ApiKeyGuard],
})
export class CommonModule {}

import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { AgentModule } from './agent/agent.module';
import { TeamsModule } from './teams/teams.module';
import { NotifyModule } from './notify/notify.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [CommonModule, AgentModule, TeamsModule, NotifyModule, AdminModule],
})
export class AppModule {}

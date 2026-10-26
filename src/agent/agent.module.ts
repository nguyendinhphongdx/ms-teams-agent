import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ToolRegistryService } from './tool-registry.service';

@Module({
  providers: [AgentService, ToolRegistryService],
  exports: [AgentService],
})
export class AgentModule {}

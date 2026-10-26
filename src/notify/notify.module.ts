import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { NotifyController } from './notify.controller';

@Module({
  imports: [TeamsModule],
  controllers: [NotifyController],
})
export class NotifyModule {}

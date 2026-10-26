import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [TeamsModule],
  controllers: [AdminController],
})
export class AdminModule {}

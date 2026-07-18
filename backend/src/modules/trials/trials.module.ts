import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { TrialsController } from './trials.controller';
import { TrialsService } from './trials.service';
import { TrialsProcessor } from './trials.processor';
import { TrialsSchedulerService } from './trials.scheduler';
import { TrialRequest } from './entities/trial-request.entity';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrialRequest]),
    BullModule.registerQueue({ name: 'trials' }),
    UsersModule,
    SubscriptionsModule,
    NotificationsModule,
  ],
  controllers: [TrialsController],
  providers: [TrialsService, TrialsProcessor, TrialsSchedulerService],
  exports: [TrialsService, TrialsSchedulerService],
})
export class TrialsModule {}

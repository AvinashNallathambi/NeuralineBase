import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionSeedService } from './subscription-seed.service';
import { SubscriptionNotificationService } from './subscription-notification.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { SubscriptionProcessor } from './subscription.processor';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { SubscriptionInvoice } from './entities/subscription-invoice.entity';
import { MockSubscriptionProvider } from './providers/mock-subscription.provider';
import { StripeSubscriptionProvider } from './providers/stripe-subscription.provider';
import { SUBSCRIPTION_PROVIDER } from './providers/subscription-provider.interface';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, SubscriptionPlan, SubscriptionInvoice]),
    BullModule.registerQueue({ name: 'subscriptions' }),
    ConfigModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionSeedService,
    SubscriptionNotificationService,
    SubscriptionSchedulerService,
    SubscriptionProcessor,
    {
      provide: SUBSCRIPTION_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const stripeKey = configService.get<string>('STRIPE_API_KEY');
        if (stripeKey) {
          return new StripeSubscriptionProvider(configService);
        }
        return new MockSubscriptionProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [SubscriptionsService, SubscriptionNotificationService],
})
export class SubscriptionsModule {}

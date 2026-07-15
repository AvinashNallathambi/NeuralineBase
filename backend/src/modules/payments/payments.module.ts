import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { MockPaymentsProvider } from './providers/mock-payments.provider';
import { StripePaymentsProvider } from './providers/stripe-payments.provider';
import { PAYMENTS_PROVIDER } from './providers/payments-provider.interface';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    ConfigModule,
    BillingModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENTS_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const stripeKey = configService.get<string>('STRIPE_API_KEY');
        if (stripeKey) {
          return new StripePaymentsProvider(configService);
        }
        return new MockPaymentsProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MockEmailProvider } from './providers/mock-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { EMAIL_PROVIDER } from './providers/email-provider.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    ConfigModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const resendKey = configService.get<string>('RESEND_API_KEY');
        if (resendKey) {
          return new ResendEmailProvider(configService);
        }
        return new MockEmailProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

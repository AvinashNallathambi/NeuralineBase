import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { Integration } from './entities/integration.entity';
import { IntegrationAuditLog } from './entities/integration-audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, IntegrationAuditLog]),
    ConfigModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}

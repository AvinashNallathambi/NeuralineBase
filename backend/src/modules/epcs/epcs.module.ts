import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpcsController } from './epcs.controller';
import { EpcsService } from './epcs.service';
import { EpcsAiService } from './epcs-ai.service';
import { ControlledSubstanceRulesEngine } from './controlled-substance-rules.engine';
import { ProviderEpcsEnrollment } from './entities/provider-epcs-enrollment.entity';
import { EpcsAuditLog } from './entities/epcs-audit-log.entity';
import { EpcsTransmissionLog } from './entities/epcs-transmission-log.entity';
import { PdmpQuery } from './entities/pdmp-query.entity';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProviderEpcsEnrollment,
      EpcsAuditLog,
      EpcsTransmissionLog,
      PdmpQuery,
      Prescription,
    ]),
    AiModule,
  ],
  controllers: [EpcsController],
  providers: [EpcsService, EpcsAiService, ControlledSubstanceRulesEngine],
  exports: [EpcsService, EpcsAiService, ControlledSubstanceRulesEngine],
})
export class EpcsModule {}

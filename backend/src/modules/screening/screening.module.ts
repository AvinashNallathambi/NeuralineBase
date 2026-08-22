import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScreeningController } from './screening.controller';
import { ScreeningService } from './screening.service';
import { ScreeningAiService } from './screening-ai.service';
import { ScreeningInstrument } from './entities/screening-instrument.entity';
import { ScreeningResult } from './entities/screening-result.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([ScreeningInstrument, ScreeningResult]), AiModule],
  controllers: [ScreeningController],
  providers: [ScreeningService, ScreeningAiService],
  exports: [ScreeningService, ScreeningAiService],
})
export class ScreeningModule {}

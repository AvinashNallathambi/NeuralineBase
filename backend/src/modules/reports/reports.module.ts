import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportAiService } from './report-ai.service';
import { ReportExportService } from './report-export.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportAiService, ReportExportService],
  exports: [ReportsService, ReportAiService, ReportExportService],
})
export class ReportsModule {}

import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AssemblyAiTranscriptionService } from './assemblyai-transcription.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  controllers: [AiController],
  providers: [AiService, AssemblyAiTranscriptionService],
  exports: [AiService, AssemblyAiTranscriptionService],
})
export class AiModule {}

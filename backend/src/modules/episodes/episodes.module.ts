import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { EpisodeAiService } from './episode-ai.service';
import { Episode } from './entities/episode.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Episode]), AiModule],
  controllers: [EpisodesController],
  providers: [EpisodesService, EpisodeAiService],
  exports: [EpisodesService, EpisodeAiService],
})
export class EpisodesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriorAuthController } from './prior-auth.controller';
import { PriorAuthService } from './prior-auth.service';
import { PriorAuthAiService } from './prior-auth-ai.service';
import { PriorAuthRequest } from './entities/prior-auth-request.entity';
import { PriorAuthRequirement } from './entities/prior-auth-requirement.entity';
import { PriorAuthAttachment } from './entities/prior-auth-attachment.entity';
import { AiModule } from '../ai/ai.module';
import { SuperbillsModule } from '../superbills/superbills.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PriorAuthRequest,
      PriorAuthRequirement,
      PriorAuthAttachment,
    ]),
    AiModule,
    SuperbillsModule,
  ],
  controllers: [PriorAuthController],
  providers: [PriorAuthService, PriorAuthAiService],
  exports: [PriorAuthService, PriorAuthAiService],
})
export class PriorAuthModule {}

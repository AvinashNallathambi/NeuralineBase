import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CptCode } from './entities/cpt-code.entity';
import { CptCodeController } from './cpt-code.controller';
import { CptCodeService } from './cpt-code.service';
import { CptSeedService } from './cpt-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([CptCode])],
  controllers: [CptCodeController],
  providers: [CptCodeService, CptSeedService],
  exports: [CptCodeService],
})
export class CptModule {}

import { Module } from '@nestjs/common';
import { PharmaciesController } from './pharmacies.controller';
import { PharmaciesService } from './pharmacies.service';
import { NPPESPharmacyService } from './nppes-pharmacy.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  controllers: [PharmaciesController],
  providers: [PharmaciesService, NPPESPharmacyService],
  exports: [PharmaciesService, NPPESPharmacyService],
})
export class PharmaciesModule {}

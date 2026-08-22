import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarePlansController } from './care-plans.controller';
import { CarePlansService } from './care-plans.service';
import { CarePlan } from './entities/care-plan.entity';
import { CarePlanGoal } from './entities/care-plan-goal.entity';
import { CarePlanTask } from './entities/care-plan-task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CarePlan, CarePlanGoal, CarePlanTask])],
  controllers: [CarePlansController],
  providers: [CarePlansService],
  exports: [CarePlansService],
})
export class CarePlansModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowInstancesController } from './workflow-instances.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowSeedService } from './workflow-seed';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowTemplate, WorkflowInstance])],
  controllers: [WorkflowTemplatesController, WorkflowInstancesController],
  providers: [WorkflowService, WorkflowSeedService],
  exports: [WorkflowService],
})
export class WorkflowModule {}

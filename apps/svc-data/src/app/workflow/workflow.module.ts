import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Approval } from '@hubblewave/instance-db';
import { WorkflowApprovalsController } from './workflow-approvals.controller';
import { WorkflowApprovalsService } from './workflow-approvals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Approval])],
  controllers: [WorkflowApprovalsController],
  providers: [WorkflowApprovalsService],
  exports: [WorkflowApprovalsService],
})
export class WorkflowModule {}

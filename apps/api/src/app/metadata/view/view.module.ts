import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, ViewDefinition, ViewDefinitionRevision, ViewVariant } from '@hubblewave/instance-db';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';

@Module({
  imports: [TypeOrmModule.forFeature([ViewDefinition, ViewDefinitionRevision, ViewVariant, AuditLog])],
  controllers: [ViewController],
  providers: [ViewService],
  exports: [ViewService],
})
export class ViewModule {}

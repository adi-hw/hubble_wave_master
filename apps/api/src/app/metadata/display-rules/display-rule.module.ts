import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CollectionDefinition,
  DisplayRule,
  DisplayRuleRevision,
} from '@hubblewave/instance-db';
import { DisplayRuleController } from './display-rule.controller';
import { DisplayRuleService } from './display-rule.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollectionDefinition, DisplayRule, DisplayRuleRevision]),
  ],
  controllers: [DisplayRuleController],
  providers: [DisplayRuleService],
  exports: [DisplayRuleService],
})
export class DisplayRuleModule {}

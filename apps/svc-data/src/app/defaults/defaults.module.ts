import { Module } from '@nestjs/common';
import { DefaultValueService } from './default-value.service';
import { SequenceGeneratorService } from './sequence-generator.service';

@Module({
  providers: [DefaultValueService, SequenceGeneratorService],
  exports: [DefaultValueService, SequenceGeneratorService],
})
export class DefaultsModule {}

import { Module } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { ValidatorRegistry } from './validator.registry';

@Module({
  providers: [ValidatorRegistry, ValidationService],
  exports: [ValidatorRegistry, ValidationService],
})
export class ValidationModule {}

import { Module } from '@nestjs/common';
import { AvaModule } from '../../../api/src/app/ava/ava.module';

@Module({
  imports: [AvaModule],
})
export class AppModule {}

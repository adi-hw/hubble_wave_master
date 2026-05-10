import { Module } from '@nestjs/common';
import { UiController } from './ui.controller';
import { UiService } from './ui.service';
import { InstanceDbModule } from '@hubblewave/instance-db';

@Module({
  imports: [
    InstanceDbModule,
  ],
  controllers: [UiController],
  providers: [UiService],
})
export class UiModule {}


import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientScript } from '@hubblewave/instance-db';
import { ScriptController } from './script.controller';
import { ScriptService } from './script.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientScript])],
  controllers: [ScriptController],
  providers: [ScriptService],
  exports: [ScriptService],
})
export class ScriptModule {}

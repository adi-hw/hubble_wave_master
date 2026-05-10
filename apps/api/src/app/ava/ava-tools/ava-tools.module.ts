import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AVATool } from '@hubblewave/instance-db';
import { AvaToolsController } from './ava-tools.controller';
import { AvaToolsService } from './ava-tools.service';

@Module({
  imports: [TypeOrmModule.forFeature([AVATool])],
  controllers: [AvaToolsController],
  providers: [AvaToolsService],
})
export class AvaToolsModule {}

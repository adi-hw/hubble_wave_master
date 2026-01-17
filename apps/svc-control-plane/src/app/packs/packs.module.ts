import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { PackRegistry, PackRelease, Instance } from '@hubblewave/control-plane-db';
import { StorageModule } from '@hubblewave/storage';
import { PacksController } from './packs.controller';
import { PacksCatalogController } from './packs.catalog.controller';
import { PacksService } from './packs.service';
import { InstanceTokenGuard } from '../auth/instance-token.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([PackRegistry, PackRelease, Instance]),
    HttpModule,
    StorageModule.forRoot(),
  ],
  controllers: [PacksController, PacksCatalogController],
  providers: [PacksService, InstanceTokenGuard],
  exports: [PacksService],
})
export class PacksModule {}

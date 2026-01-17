import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '@hubblewave/storage';
import { AuditLog, DatasetSnapshot, ModelArtifact } from '@hubblewave/instance-db';
import { ModelRegistryController } from './model-registry.controller';
import { ModelRegistryService } from './model-registry.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModelArtifact, DatasetSnapshot, AuditLog]),
    StorageModule,
  ],
  controllers: [ModelRegistryController],
  providers: [ModelRegistryService],
})
export class ModelRegistryModule {}

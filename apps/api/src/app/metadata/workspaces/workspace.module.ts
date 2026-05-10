import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CollectionDefinition,
  WorkspaceDefinition,
  WorkspacePage,
  WorkspaceVariant,
} from '@hubblewave/instance-db';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceDefinition,
      WorkspacePage,
      WorkspaceVariant,
      CollectionDefinition,
    ]),
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}

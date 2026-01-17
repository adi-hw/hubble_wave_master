/**
 * Import/Export Controller
 * HubbleWave Platform - Phase 5
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { ImportExportService } from './import-export.service';
import { ImportExportStatus, ExportFormat, PropertyMappingEntry } from '@hubblewave/instance-db';

interface UploadedFileType {
  originalname: string;
  size: number;
  mimetype: string;
  buffer: Buffer;
}

interface CreateImportJobDto {
  name: string;
  type: string;
  sourceType: 'file' | 'api' | 'connector';
  sourceConfig?: Record<string, unknown>;
  targetCollectionId: string;
  propertyMapping: PropertyMappingEntry[];
  options?: Record<string, unknown>;
}

interface CreateExportJobDto {
  name: string;
  sourceCollectionId: string;
  query?: Record<string, unknown>;
  format: ExportFormat;
  options?: Record<string, unknown>;
  includeProperties?: string[];
  excludeProperties?: string[];
}

@ApiTags('Import/Export')
@ApiBearerAuth()
@Controller('data')
@UseGuards(JwtAuthGuard)
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  // Import Operations

  @Post('imports')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Create and start an import job' })
  @ApiResponse({ status: 201, description: 'Import job created' })
  @ApiConsumes('multipart/form-data')
  async createImport(
    @Body() dto: CreateImportJobDto,
    @UploadedFile() file: UploadedFileType,
    @CurrentUser() user: RequestUser,
  ) {
    const job = await this.importExportService.createImportJob({
      ...dto,
      fileName: file?.originalname,
      fileSize: file?.size,
      fileType: file?.mimetype,
      createdBy: user.id,
    });

    if (dto.sourceType === 'file' && file) {
      return this.importExportService.startImport(job.id, file.buffer);
    }

    return job;
  }

  @Post('imports/:id/start')
  async startImport(@Param('id') id: string) {
    return this.importExportService.startImport(id);
  }

  @Get('imports')
  async findAllImports(
    @Query('status') status?: ImportExportStatus,
    @Query('collectionId') collectionId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.importExportService.findAllImportJobs({
      status,
      collectionId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('imports/:id')
  async findImport(@Param('id') id: string) {
    return this.importExportService.findImportJob(id);
  }

  @Post('imports/:id/cancel')
  async cancelImport(@Param('id') id: string) {
    return this.importExportService.cancelImportJob(id);
  }

  // Export Operations

  @Post('exports')
  @ApiOperation({ summary: 'Create and start an export job' })
  @ApiResponse({ status: 201, description: 'Export job created' })
  async createExport(@Body() dto: CreateExportJobDto, @CurrentUser() user: RequestUser) {
    const job = await this.importExportService.createExportJob({
      ...dto,
      createdBy: user.id,
    });

    return this.importExportService.startExport(job.id);
  }

  @Get('exports')
  async findAllExports(
    @Query('status') status?: ImportExportStatus,
    @Query('collectionId') collectionId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.importExportService.findAllExportJobs({
      status,
      collectionId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('exports/:id')
  async findExport(@Param('id') id: string) {
    return this.importExportService.findExportJob(id);
  }

  @Post('exports/:id/cancel')
  async cancelExport(@Param('id') id: string) {
    return this.importExportService.cancelExportJob(id);
  }

  // Cleanup

  @Post('exports/cleanup')
  async cleanupExpired() {
    const count = await this.importExportService.cleanupExpiredExports();
    return { deleted: count };
  }
}

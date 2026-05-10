/**
 * Transform Controller
 * HubbleWave Platform - Phase 2
 *
 * REST API endpoints for data transformation.
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { TransformService, TransformConfig, TransformResult } from './transform.service';

interface TransformRequestDto {
  records: Record<string, unknown>[];
  config: TransformConfig;
}

@Controller('transform')
@UseGuards(JwtAuthGuard)
export class TransformController {
  constructor(private readonly transformService: TransformService) {}

  /**
   * Transform records for a specific view type
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async transform(@Body() dto: TransformRequestDto): Promise<TransformResult> {
    return this.transformService.transform(dto.records, dto.config);
  }

  /**
   * Transform records for kanban view
   */
  @Post('kanban')
  @HttpCode(HttpStatus.OK)
  async transformKanban(@Body() dto: TransformRequestDto): Promise<TransformResult> {
    return this.transformService.transform(dto.records, {
      ...dto.config,
      viewType: 'kanban',
    });
  }

  /**
   * Transform records for calendar view
   */
  @Post('calendar')
  @HttpCode(HttpStatus.OK)
  async transformCalendar(@Body() dto: TransformRequestDto): Promise<TransformResult> {
    return this.transformService.transform(dto.records, {
      ...dto.config,
      viewType: 'calendar',
    });
  }

  /**
   * Transform records for pivot view
   */
  @Post('pivot')
  @HttpCode(HttpStatus.OK)
  async transformPivot(@Body() dto: TransformRequestDto): Promise<TransformResult> {
    return this.transformService.transform(dto.records, {
      ...dto.config,
      viewType: 'pivot',
    });
  }

  /**
   * Transform records for timeline view
   */
  @Post('timeline')
  @HttpCode(HttpStatus.OK)
  async transformTimeline(@Body() dto: TransformRequestDto): Promise<TransformResult> {
    return this.transformService.transform(dto.records, {
      ...dto.config,
      viewType: 'timeline',
    });
  }

  /**
   * Transform records for gantt view
   */
  @Post('gantt')
  @HttpCode(HttpStatus.OK)
  async transformGantt(@Body() dto: TransformRequestDto): Promise<TransformResult> {
    return this.transformService.transform(dto.records, {
      ...dto.config,
      viewType: 'gantt',
    });
  }

  /**
   * Transform records for map view
   */
  @Post('map')
  @HttpCode(HttpStatus.OK)
  async transformMap(@Body() dto: TransformRequestDto): Promise<TransformResult> {
    return this.transformService.transform(dto.records, {
      ...dto.config,
      viewType: 'map',
    });
  }
}

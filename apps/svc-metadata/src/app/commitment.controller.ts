import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantDbService } from '@eam-platform/tenant-db';
import { CommitmentService } from './commitment.service';

@ApiTags('Commitments')
@Controller('commitments')
export class CommitmentController {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly commitmentService: CommitmentService
  ) {}

  // ============ Business Schedules ============

  @Get('schedules')
  @ApiOperation({ summary: 'Get all business schedules' })
  async getSchedules(@Query('tenantId') tenantId: string) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getSchedules(dataSource);
  }

  @Get('schedules/:id')
  @ApiOperation({ summary: 'Get business schedule by ID' })
  async getSchedule(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getSchedule(dataSource, id);
  }

  // ============ Holiday Calendars ============

  @Get('calendars')
  @ApiOperation({ summary: 'Get all holiday calendars' })
  async getHolidayCalendars(@Query('tenantId') tenantId: string) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getHolidayCalendars(dataSource);
  }

  @Get('calendars/:id/holidays')
  @ApiOperation({ summary: 'Get holidays for a calendar' })
  async getHolidays(
    @Query('tenantId') tenantId: string,
    @Param('id') calendarId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getHolidays(
      dataSource,
      calendarId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  // ============ Commitment Definitions ============

  @Get('definitions')
  @ApiOperation({ summary: 'Get commitment definitions' })
  async getDefinitions(
    @Query('tenantId') tenantId: string,
    @Query('collectionCode') collectionCode?: string
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getDefinitions(dataSource, collectionCode);
  }

  @Get('definitions/:id')
  @ApiOperation({ summary: 'Get commitment definition by ID' })
  async getDefinition(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getDefinition(dataSource, id);
  }

  @Post('definitions')
  @ApiOperation({ summary: 'Create commitment definition' })
  @ApiResponse({ status: 201, description: 'Definition created' })
  async createDefinition(
    @Query('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.createDefinition(dataSource, body);
  }

  @Patch('definitions/:id')
  @ApiOperation({ summary: 'Update commitment definition' })
  async updateDefinition(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.updateDefinition(dataSource, id, body);
  }

  // ============ Commitment Tracking ============

  @Post('trackers')
  @ApiOperation({ summary: 'Start commitment tracking' })
  @ApiResponse({ status: 201, description: 'Tracking started' })
  async startTracking(
    @Query('tenantId') tenantId: string,
    @Body() body: {
      commitmentDefinitionId: string;
      collectionCode: string;
      recordId: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.startTracking(dataSource, body);
  }

  @Get('trackers')
  @ApiOperation({ summary: 'Get active trackers' })
  async getActiveTrackers(
    @Query('tenantId') tenantId: string,
    @Query('collectionCode') collectionCode?: string,
    @Query('recordId') recordId?: string
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getActiveTrackers(
      dataSource,
      collectionCode,
      recordId
    );
  }

  @Get('trackers/record/:collectionCode/:recordId')
  @ApiOperation({ summary: 'Get commitments for a specific record' })
  async getRecordCommitments(
    @Query('tenantId') tenantId: string,
    @Param('collectionCode') collectionCode: string,
    @Param('recordId') recordId: string
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getRecordCommitments(
      dataSource,
      collectionCode,
      recordId
    );
  }

  @Get('trackers/approaching')
  @ApiOperation({ summary: 'Get trackers approaching breach' })
  async getApproachingBreaches(
    @Query('tenantId') tenantId: string,
    @Query('withinMinutes') withinMinutes?: string
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getApproachingBreaches(
      dataSource,
      withinMinutes ? parseInt(withinMinutes) : undefined
    );
  }

  @Post('trackers/:id/pause')
  @ApiOperation({ summary: 'Pause commitment tracking' })
  @HttpCode(HttpStatus.OK)
  async pauseTracking(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string }
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.pauseTracking(dataSource, id, body.reason);
  }

  @Post('trackers/:id/resume')
  @ApiOperation({ summary: 'Resume commitment tracking' })
  @HttpCode(HttpStatus.OK)
  async resumeTracking(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.resumeTracking(dataSource, id);
  }

  @Post('trackers/:id/complete')
  @ApiOperation({ summary: 'Complete commitment tracking' })
  @HttpCode(HttpStatus.OK)
  async completeTracking(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: { met: boolean }
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.completeTracking(dataSource, id, body.met);
  }

  @Post('trackers/:id/cancel')
  @ApiOperation({ summary: 'Cancel commitment tracking' })
  @HttpCode(HttpStatus.OK)
  async cancelTracking(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string }
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.cancelTracking(dataSource, id, body.reason);
  }

  // ============ Scheduled Tasks ============

  @Post('process/warnings')
  @ApiOperation({ summary: 'Process commitment warnings' })
  @HttpCode(HttpStatus.OK)
  async processWarnings(@Query('tenantId') tenantId: string) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    const count = await this.commitmentService.processWarnings(dataSource);
    return { processed: count };
  }

  @Post('process/breaches')
  @ApiOperation({ summary: 'Process commitment breaches' })
  @HttpCode(HttpStatus.OK)
  async processBreaches(@Query('tenantId') tenantId: string) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    const count = await this.commitmentService.processBreaches(dataSource);
    return { processed: count };
  }

  // ============ Metrics ============

  @Get('metrics/:definitionId')
  @ApiOperation({ summary: 'Get commitment metrics' })
  async getMetrics(
    @Query('tenantId') tenantId: string,
    @Param('definitionId') definitionId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('periodType') periodType: string = 'daily'
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.getMetrics(
      dataSource,
      definitionId,
      new Date(startDate),
      new Date(endDate),
      periodType
    );
  }

  @Post('metrics/:definitionId/update')
  @ApiOperation({ summary: 'Update commitment metrics' })
  @HttpCode(HttpStatus.OK)
  async updateMetrics(
    @Query('tenantId') tenantId: string,
    @Param('definitionId') definitionId: string,
    @Body() body: { periodDate: string; periodType?: string }
  ) {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    return this.commitmentService.updateMetrics(
      dataSource,
      definitionId,
      new Date(body.periodDate),
      body.periodType
    );
  }
}

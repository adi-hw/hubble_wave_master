import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SelfHealingService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { RecoveryActionType, EventType } from '@hubblewave/instance-db';

interface RegisterServiceDto {
  serviceName: string;
  cpuUsage?: number;
  memoryUsage?: number;
  errorRate?: number;
  responseTimeMs?: number;
  replicaCount?: number;
}

interface UpdateHealthDto {
  cpuUsage?: number;
  memoryUsage?: number;
  errorRate?: number;
  responseTimeMs?: number;
  replicaCount?: number;
}

interface RecoveryActionDto {
  name: string;
  actionType: RecoveryActionType;
  targetService?: string;
  triggerConditions: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
  };
  actionConfig: Record<string, unknown>;
}

@ApiTags('Phase 7 - Self-Healing Infrastructure')
@ApiBearerAuth()
@Controller('api/phase7/self-healing')
@UseGuards(JwtAuthGuard)
export class SelfHealingController {
  constructor(
    private readonly selfHealingService: SelfHealingService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get self-healing dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getDashboard() {
    const dashboard = await this.selfHealingService.getDashboard();
    return dashboard;
  }

  @Get('services')
  @ApiOperation({ summary: 'List registered services' })
  @ApiResponse({ status: 200, description: 'List of services' })
  async listServices() {
    const services = await this.selfHealingService.getAllServicesHealth();
    return { services };
  }

  @Post('services')
  @ApiOperation({ summary: 'Register a service for monitoring' })
  @ApiResponse({ status: 201, description: 'Service registered' })
  async registerService(
    @CurrentUser() _user: RequestUser,
    @Body() dto: RegisterServiceDto,
  ) {
    const { serviceName, ...metrics } = dto;
    const service = await this.selfHealingService.registerService(serviceName, metrics);
    return { service };
  }

  @Get('services/:serviceName')
  @ApiOperation({ summary: 'Get service details' })
  @ApiResponse({ status: 200, description: 'Service details' })
  async getService(
    @Param('serviceName') serviceName: string,
  ) {
    const service = await this.selfHealingService.getServiceHealth(serviceName);
    return { service };
  }

  @Get('services/:serviceName/health')
  @ApiOperation({ summary: 'Get service health status' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async getServiceHealth(
    @Param('serviceName') serviceName: string,
  ) {
    const health = await this.selfHealingService.getServiceHealth(serviceName);
    return { health };
  }

  @Post('services/:serviceName/health-check')
  @ApiOperation({ summary: 'Trigger manual health check' })
  @ApiResponse({ status: 200, description: 'Health check result' })
  async triggerHealthCheck(
    @Param('serviceName') serviceName: string,
  ) {
    const result = await this.selfHealingService.checkServiceHealth(serviceName);
    return { result };
  }

  @Put('services/:serviceName/status')
  @ApiOperation({ summary: 'Update service health status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateServiceStatus(
    @Param('serviceName') serviceName: string,
    @Body() dto: UpdateHealthDto,
  ) {
    const service = await this.selfHealingService.updateServiceHealth(serviceName, dto);
    return { service };
  }

  @Get('events')
  @ApiOperation({ summary: 'Get self-healing events' })
  @ApiResponse({ status: 200, description: 'List of events' })
  async getEvents(
    @Query('serviceName') serviceName?: string,
    @Query('eventType') eventType?: EventType,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.selfHealingService.getEvents({
      serviceName,
      eventType,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return result;
  }

  @Post('recovery')
  @ApiOperation({ summary: 'Create recovery action' })
  @ApiResponse({ status: 201, description: 'Recovery action created' })
  async createRecoveryAction(
    @CurrentUser() _user: RequestUser,
    @Body() dto: RecoveryActionDto,
  ) {
    const action = await this.selfHealingService.createRecoveryAction(dto);
    return { action };
  }

  @Put('recovery/:id')
  @ApiOperation({ summary: 'Update recovery action' })
  @ApiResponse({ status: 200, description: 'Recovery action updated' })
  async updateRecoveryAction(
    @Param('id') id: string,
    @Body() dto: Partial<RecoveryActionDto>,
  ) {
    const action = await this.selfHealingService.updateRecoveryAction(id, dto);
    return { action };
  }

  @Delete('recovery/:id')
  @ApiOperation({ summary: 'Delete recovery action' })
  @ApiResponse({ status: 200, description: 'Recovery action deleted' })
  async deleteRecoveryAction(
    @Param('id') id: string,
  ) {
    await this.selfHealingService.deleteRecoveryAction(id);
    return { success: true };
  }

  @Get('recovery')
  @ApiOperation({ summary: 'Get recovery actions' })
  @ApiResponse({ status: 200, description: 'List of recovery actions' })
  async getRecoveryActions(
    @Query('serviceName') serviceName?: string,
  ) {
    const actions = await this.selfHealingService.getRecoveryActions(serviceName);
    return { actions };
  }

  @Post('run-checks')
  @ApiOperation({ summary: 'Run all health checks' })
  @ApiResponse({ status: 200, description: 'Health checks triggered' })
  async runAllHealthChecks() {
    await this.selfHealingService.runHealthChecks();
    return { success: true, message: 'Health checks triggered for all services' };
  }
}

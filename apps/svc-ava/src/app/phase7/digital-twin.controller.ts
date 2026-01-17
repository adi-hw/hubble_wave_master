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
import { DigitalTwinService } from '@hubblewave/ai';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { SensorMapping, TwinStatus } from '@hubblewave/instance-db';

interface CreateTwinDto {
  name: string;
  description?: string;
  assetId: string;
  assetType: string;
  status?: TwinStatus;
  modelUrl?: string;
  modelVersion?: string;
  syncInterval?: number;
  sensorMappings?: SensorMapping[];
}

interface UpdateTwinDto {
  name?: string;
  description?: string;
  assetType?: string;
  status?: TwinStatus;
  modelUrl?: string;
  modelVersion?: string;
  syncInterval?: number;
  sensorMappings?: SensorMapping[];
  isActive?: boolean;
}

interface SensorReadingDto {
  assetId: string;
  sensorId: string;
  value: number;
  dataType?: string;
  unit?: string;
  quality?: 'good' | 'uncertain' | 'bad';
  timestamp?: Date;
}

@ApiTags('Phase 7 - Digital Twins & IoT Integration')
@ApiBearerAuth()
@Controller('api/phase7/digital-twins')
@UseGuards(JwtAuthGuard)
export class DigitalTwinController {
  constructor(
    private readonly twinService: DigitalTwinService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a digital twin' })
  @ApiResponse({ status: 201, description: 'Digital twin created' })
  async createTwin(
    @CurrentUser() _user: RequestUser,
    @Body() dto: CreateTwinDto,
  ) {
    const twin = await this.twinService.createTwin(dto);
    return { twin };
  }

  @Get()
  @ApiOperation({ summary: 'List digital twins' })
  @ApiResponse({ status: 200, description: 'List of twins' })
  async listTwins(
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.twinService.listTwins({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    // Transform to match frontend expectations
    return {
      twins: result.data,
      total: result.total,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get digital twin details' })
  @ApiResponse({ status: 200, description: 'Twin details' })
  async getTwin(
    @Param('id') twinId: string,
  ) {
    const twin = await this.twinService.getTwinById(twinId);
    return { twin };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update digital twin' })
  @ApiResponse({ status: 200, description: 'Twin updated' })
  async updateTwin(
    @Param('id') twinId: string,
    @Body() dto: UpdateTwinDto,
  ) {
    const twin = await this.twinService.updateTwin(twinId, dto);
    return { twin };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete digital twin' })
  @ApiResponse({ status: 200, description: 'Twin deleted' })
  async deleteTwin(
    @Param('id') twinId: string,
  ) {
    await this.twinService.deleteTwin(twinId);
    return { success: true };
  }

  @Get(':assetId/state')
  @ApiOperation({ summary: 'Get current twin state by asset ID' })
  @ApiResponse({ status: 200, description: 'Current state' })
  async getCurrentState(
    @Param('assetId') assetId: string,
  ) {
    const state = await this.twinService.getCurrentState(assetId);
    return { state };
  }

  @Post(':id/sensors')
  @ApiOperation({ summary: 'Add sensor mapping to twin' })
  @ApiResponse({ status: 201, description: 'Sensor mapping added' })
  async addSensorMapping(
    @Param('id') twinId: string,
    @Body() mapping: SensorMapping,
  ) {
    const twin = await this.twinService.addSensorMapping(twinId, mapping);
    return { twin };
  }

  @Get(':id/sensors')
  @ApiOperation({ summary: 'Get sensor mappings' })
  @ApiResponse({ status: 200, description: 'List of sensor mappings' })
  async getSensorMappings(
    @Param('id') twinId: string,
  ) {
    const twin = await this.twinService.getTwinById(twinId);
    return { mappings: twin.sensorMappings };
  }

  @Delete(':id/sensors/:sensorId')
  @ApiOperation({ summary: 'Remove sensor mapping' })
  @ApiResponse({ status: 200, description: 'Sensor mapping removed' })
  async removeSensorMapping(
    @Param('id') twinId: string,
    @Param('sensorId') sensorId: string,
  ) {
    const twin = await this.twinService.removeSensorMapping(twinId, sensorId);
    return { twin };
  }

  @Post('readings')
  @ApiOperation({ summary: 'Ingest sensor reading' })
  @ApiResponse({ status: 201, description: 'Reading ingested' })
  async ingestReading(
    @Body() dto: SensorReadingDto,
  ) {
    const reading = await this.twinService.ingestSensorReading(dto);
    return { reading };
  }

  @Post('readings/batch')
  @ApiOperation({ summary: 'Ingest batch sensor readings' })
  @ApiResponse({ status: 201, description: 'Readings ingested' })
  async ingestBatchReadings(
    @Body() dto: { readings: SensorReadingDto[] },
  ) {
    const readings = await this.twinService.ingestBatchReadings(dto.readings);
    return { readings };
  }

  @Get(':assetId/readings/:sensorId')
  @ApiOperation({ summary: 'Get historical sensor readings' })
  @ApiResponse({ status: 200, description: 'Sensor readings' })
  async getHistoricalData(
    @Param('assetId') assetId: string,
    @Param('sensorId') sensorId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const startTime = from ? new Date(from) : new Date(Date.now() - 24 * 3600000);
    const endTime = to ? new Date(to) : new Date();
    const limitNum = limit ? parseInt(limit, 10) : 1000;

    const readings = await this.twinService.getHistoricalData(
      assetId,
      sensorId,
      startTime,
      endTime,
      limitNum,
    );

    return { readings };
  }

  @Get(':assetId/readings')
  @ApiOperation({ summary: 'Get latest sensor readings for asset' })
  @ApiResponse({ status: 200, description: 'Latest sensor readings' })
  async getLatestReadings(
    @Param('assetId') assetId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const readings = await this.twinService.getLatestReadings(assetId, limitNum);
    return { readings };
  }

  @Get(':assetId/readings/:sensorId/aggregated')
  @ApiOperation({ summary: 'Get aggregated sensor data' })
  @ApiResponse({ status: 200, description: 'Aggregated data' })
  async getAggregatedData(
    @Param('assetId') assetId: string,
    @Param('sensorId') sensorId: string,
    @Query('intervalMinutes') intervalMinutes?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const startTime = from ? new Date(from) : new Date(Date.now() - 24 * 3600000);
    const endTime = to ? new Date(to) : new Date();
    const interval = intervalMinutes ? parseInt(intervalMinutes, 10) : 60;

    const data = await this.twinService.getAggregatedData(
      assetId,
      sensorId,
      startTime,
      endTime,
      interval,
    );

    return { data };
  }

  @Post(':assetId/cleanup')
  @ApiOperation({ summary: 'Cleanup old sensor readings' })
  @ApiResponse({ status: 200, description: 'Number of readings deleted' })
  async cleanupOldReadings(
    @Param('assetId') assetId: string,
    @Body() dto: { retentionDays: number },
  ) {
    const deletedCount = await this.twinService.cleanupOldReadings(
      assetId,
      dto.retentionDays,
    );
    return { deletedCount };
  }
}

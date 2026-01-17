import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  DigitalTwin,
  SensorReading,
  SensorMapping,
  TwinStatus,
} from '@hubblewave/instance-db';

interface TwinState {
  timestamp: Date;
  sensors: Record<string, {
    value: number | null;
    unit: string | null;
    quality: string;
    lastUpdated: Date;
  }>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DigitalTwinService {
  constructor(
    @InjectRepository(DigitalTwin)
    private readonly twinRepo: Repository<DigitalTwin>,
    @InjectRepository(SensorReading)
    private readonly readingRepo: Repository<SensorReading>,
  ) {}

  async createTwin(data: {
    name: string;
    description?: string;
    assetId: string;
    assetType: string;
    status?: TwinStatus;
    modelUrl?: string;
    modelVersion?: string;
    syncInterval?: number;
    sensorMappings?: SensorMapping[];
  }): Promise<DigitalTwin> {
    const twin = this.twinRepo.create({
      name: data.name,
      description: data.description,
      assetId: data.assetId,
      assetType: data.assetType,
      status: data.status || 'active',
      modelUrl: data.modelUrl,
      modelVersion: data.modelVersion,
      syncInterval: data.syncInterval || 1000,
      sensorMappings: data.sensorMappings || [],
      state: {},
      isActive: true,
    });
    return this.twinRepo.save(twin);
  }

  async getTwin(assetId: string): Promise<DigitalTwin | null> {
    return this.twinRepo.findOne({ where: { assetId } });
  }

  async getTwinById(id: string): Promise<DigitalTwin> {
    return this.twinRepo.findOneOrFail({ where: { id } });
  }

  async updateTwin(id: string, data: Partial<{
    name: string;
    description: string;
    assetType: string;
    status: TwinStatus;
    modelUrl: string;
    modelVersion: string;
    syncInterval: number;
    sensorMappings: SensorMapping[];
    isActive: boolean;
  }>): Promise<DigitalTwin> {
    const twin = await this.twinRepo.findOneOrFail({ where: { id } });
    Object.assign(twin, data);
    return this.twinRepo.save(twin);
  }

  async deleteTwin(id: string): Promise<void> {
    await this.twinRepo.delete(id);
  }

  async listTwins(options: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: DigitalTwin[]; total: number }> {
    const query = this.twinRepo.createQueryBuilder('twin');

    if (options.isActive !== undefined) {
      query.andWhere('twin.isActive = :isActive', { isActive: options.isActive });
    }

    const [data, total] = await query
      .orderBy('twin.createdAt', 'DESC')
      .take(options.limit || 50)
      .skip(options.offset || 0)
      .getManyAndCount();

    return { data, total };
  }

  async addSensorMapping(twinId: string, mapping: SensorMapping): Promise<DigitalTwin> {
    const twin = await this.twinRepo.findOneOrFail({ where: { id: twinId } });
    twin.sensorMappings = [...twin.sensorMappings, mapping];
    return this.twinRepo.save(twin);
  }

  async removeSensorMapping(twinId: string, sensorId: string): Promise<DigitalTwin> {
    const twin = await this.twinRepo.findOneOrFail({ where: { id: twinId } });
    twin.sensorMappings = twin.sensorMappings.filter(m => m.sensorId !== sensorId);
    return this.twinRepo.save(twin);
  }

  async ingestSensorReading(data: {
    assetId: string;
    sensorId: string;
    value: number;
    dataType?: string;
    unit?: string;
    quality?: 'good' | 'uncertain' | 'bad';
    timestamp?: Date;
  }): Promise<SensorReading> {
    const reading = this.readingRepo.create({
      assetId: data.assetId,
      sensorId: data.sensorId,
      value: data.value,
      dataType: data.dataType,
      unit: data.unit,
      quality: data.quality || 'good',
      timestamp: data.timestamp || new Date(),
    });

    const saved = await this.readingRepo.save(reading);

    await this.updateTwinState(data.assetId, data.sensorId, data.value, data.unit ?? null, data.quality || 'good');

    return saved;
  }

  async ingestBatchReadings(readings: Array<{
    assetId: string;
    sensorId: string;
    value: number;
    dataType?: string;
    unit?: string;
    quality?: 'good' | 'uncertain' | 'bad';
    timestamp?: Date;
  }>): Promise<SensorReading[]> {
    const entities = readings.map(data =>
      this.readingRepo.create({
        assetId: data.assetId,
        sensorId: data.sensorId,
        value: data.value,
        dataType: data.dataType,
        unit: data.unit,
        quality: data.quality || 'good',
        timestamp: data.timestamp || new Date(),
      })
    );

    const saved = await this.readingRepo.save(entities);

    const assetUpdates = new Map<string, Map<string, { value: number; unit: string | null; quality: string }>>();
    for (const reading of readings) {
      if (!assetUpdates.has(reading.assetId)) {
        assetUpdates.set(reading.assetId, new Map());
      }
      assetUpdates.get(reading.assetId)!.set(reading.sensorId, {
        value: reading.value,
        unit: reading.unit ?? null,
        quality: reading.quality || 'good',
      });
    }

    for (const [assetId, sensors] of assetUpdates) {
      await this.updateTwinStateMultiple(assetId, sensors);
    }

    return saved;
  }

  private async updateTwinState(
    assetId: string,
    sensorId: string,
    value: number,
    unit: string | null,
    quality: string,
  ): Promise<void> {
    const twin = await this.twinRepo.findOne({ where: { assetId } });
    if (!twin) return;

    const state = (twin.state as unknown as TwinState) || { timestamp: new Date(), sensors: {} };
    state.sensors[sensorId] = {
      value,
      unit,
      quality,
      lastUpdated: new Date(),
    };
    state.timestamp = new Date();

    twin.state = state as unknown as Record<string, unknown>;
    twin.lastSyncAt = new Date();
    await this.twinRepo.save(twin);
  }

  private async updateTwinStateMultiple(
    assetId: string,
    sensors: Map<string, { value: number; unit: string | null; quality: string }>,
  ): Promise<void> {
    const twin = await this.twinRepo.findOne({ where: { assetId } });
    if (!twin) return;

    const state = (twin.state as unknown as TwinState) || { timestamp: new Date(), sensors: {} };

    for (const [sensorId, data] of sensors) {
      state.sensors[sensorId] = {
        value: data.value,
        unit: data.unit,
        quality: data.quality,
        lastUpdated: new Date(),
      };
    }
    state.timestamp = new Date();

    twin.state = state as unknown as Record<string, unknown>;
    twin.lastSyncAt = new Date();
    await this.twinRepo.save(twin);
  }

  async getCurrentState(assetId: string): Promise<TwinState | null> {
    const twin = await this.twinRepo.findOne({ where: { assetId } });
    if (!twin) return null;
    return twin.state as unknown as TwinState;
  }

  async getHistoricalData(
    assetId: string,
    sensorId: string,
    startTime: Date,
    endTime: Date,
    limit = 1000,
  ): Promise<SensorReading[]> {
    return this.readingRepo.find({
      where: {
        assetId,
        sensorId,
        timestamp: Between(startTime, endTime),
      },
      order: { timestamp: 'ASC' },
      take: limit,
    });
  }

  async getLatestReadings(assetId: string, limit = 100): Promise<SensorReading[]> {
    return this.readingRepo.find({
      where: { assetId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getAggregatedData(
    assetId: string,
    sensorId: string,
    startTime: Date,
    endTime: Date,
    intervalMinutes: number,
  ): Promise<Array<{
    bucket: Date;
    avg: number;
    min: number;
    max: number;
    count: number;
  }>> {
    const result = await this.readingRepo
      .createQueryBuilder('reading')
      .select([
        `date_trunc('minute', reading.timestamp) - (EXTRACT(MINUTE FROM reading.timestamp)::int % ${intervalMinutes}) * interval '1 minute' as bucket`,
        'AVG(reading.value) as avg',
        'MIN(reading.value) as min',
        'MAX(reading.value) as max',
        'COUNT(*) as count',
      ])
      .where('reading.assetId = :assetId', { assetId })
      .andWhere('reading.sensorId = :sensorId', { sensorId })
      .andWhere('reading.timestamp BETWEEN :startTime AND :endTime', { startTime, endTime })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    return result.map(row => ({
      bucket: new Date(row.bucket),
      avg: parseFloat(row.avg),
      min: parseFloat(row.min),
      max: parseFloat(row.max),
      count: parseInt(row.count, 10),
    }));
  }

  async cleanupOldReadings(assetId: string, retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.readingRepo.delete({
      assetId,
      timestamp: Between(new Date(0), cutoffDate),
    });
    return result.affected || 0;
  }
}

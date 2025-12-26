import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { InstanceHealth } from '@hubblewave/control-plane-db';

const INSTANCE_HEALTH = ['healthy', 'degraded', 'unhealthy', 'unknown'] as const;

export class IngestMetricsDto {
  @IsOptional()
  @IsIn(INSTANCE_HEALTH as unknown as string[])
  health?: InstanceHealth;

  @IsOptional()
  @IsObject()
  resourceMetrics?: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    network_io?: number;
  };

  @IsOptional()
  @IsString()
  details?: string;
}

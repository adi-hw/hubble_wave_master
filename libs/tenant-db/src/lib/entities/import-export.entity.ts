import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// ============ Import Definition ============

export type ImportFormat = 'csv' | 'xlsx' | 'json' | 'xml';
export type ImportStatus = 'draft' | 'validating' | 'ready' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ImportAction = 'insert' | 'update' | 'upsert';

@Entity('import_definition')
export class ImportDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 100 })
  @Index()
  collectionCode!: string;

  @Column({ type: 'varchar', length: 20 })
  format!: ImportFormat;

  @Column({ type: 'varchar', length: 20, default: 'upsert' })
  action!: ImportAction;

  @Column({ type: 'jsonb', default: '[]' })
  columnMappings!: Array<{
    sourceColumn: string;
    targetProperty: string;
    transform?: string;
    defaultValue?: unknown;
    required?: boolean;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  keyFields?: string[];

  @Column({ type: 'jsonb', nullable: true })
  options?: {
    skipFirstRow?: boolean;
    dateFormat?: string;
    delimiter?: string;
    encoding?: string;
    sheetName?: string;
    batchSize?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  validationRules?: Array<{
    field: string;
    rule: string;
    params?: unknown;
    errorMessage?: string;
  }>;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// ============ Import Job ============

@Entity('import_job')
export class ImportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  importDefinitionId?: string;

  @Column({ length: 100, nullable: true })
  @Index()
  collectionCode?: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  @Index()
  status!: ImportStatus;

  @Column({ length: 500, nullable: true })
  fileName?: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize?: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  format?: ImportFormat;

  @Column({ type: 'jsonb', nullable: true })
  columnMappings?: ImportDefinition['columnMappings'];

  @Column({ type: 'jsonb', nullable: true })
  previewData?: Array<Record<string, unknown>>;

  @Column({ type: 'int', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', default: 0 })
  processedRows!: number;

  @Column({ type: 'int', default: 0 })
  successCount!: number;

  @Column({ type: 'int', default: 0 })
  errorCount!: number;

  @Column({ type: 'int', default: 0 })
  skipCount!: number;

  @Column({ type: 'jsonb', default: '[]' })
  errors!: Array<{
    row: number;
    field?: string;
    value?: unknown;
    error: string;
  }>;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// ============ Export Definition ============

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'pdf';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ExportSchedule = 'once' | 'daily' | 'weekly' | 'monthly';

@Entity('export_definition')
export class ExportDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 100 })
  @Index()
  collectionCode!: string;

  @Column({ type: 'varchar', length: 20 })
  format!: ExportFormat;

  @Column({ type: 'jsonb', default: '[]' })
  columns!: Array<{
    propertyCode: string;
    label?: string;
    format?: string;
    width?: number;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  filters?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  sortBy?: Array<{
    field: string;
    direction: 'ASC' | 'DESC';
  }>;

  @Column({ type: 'int', nullable: true })
  maxRows?: number;

  @Column({ type: 'jsonb', nullable: true })
  options?: {
    includeHeaders?: boolean;
    dateFormat?: string;
    delimiter?: string;
    encoding?: string;
    sheetName?: string;
    pageSize?: string;
    orientation?: 'portrait' | 'landscape';
  };

  @Column({ type: 'varchar', length: 20, default: 'once' })
  schedule!: ExportSchedule;

  @Column({ type: 'jsonb', nullable: true })
  scheduleConfig?: {
    time?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    recipients?: string[];
  };

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// ============ Export Job ============

@Entity('export_job')
export class ExportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  exportDefinitionId?: string;

  @Column({ length: 100, nullable: true })
  @Index()
  collectionCode?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  @Index()
  status!: ExportStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  format?: ExportFormat;

  @Column({ type: 'jsonb', nullable: true })
  columns?: ExportDefinition['columns'];

  @Column({ type: 'jsonb', nullable: true })
  filters?: ExportDefinition['filters'];

  @Column({ type: 'int', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', default: 0 })
  processedRows!: number;

  @Column({ length: 500, nullable: true })
  outputFileName?: string;

  @Column({ type: 'text', nullable: true })
  outputUrl?: string;

  @Column({ type: 'bigint', nullable: true })
  outputFileSize?: number;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// ============ Connection Definition ============

export type ConnectionType = 'rest_api' | 'graphql' | 'database' | 'oauth2' | 'webhook' | 'sftp';
export type ConnectionStatus = 'active' | 'inactive' | 'error';
export type AuthType = 'none' | 'basic' | 'api_key' | 'bearer' | 'oauth2' | 'certificate';

@Entity('connection_definition')
export class ConnectionDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 50, unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20 })
  type!: ConnectionType;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  @Index()
  status!: ConnectionStatus;

  @Column({ type: 'text', nullable: true })
  baseUrl?: string;

  @Column({ type: 'varchar', length: 20, default: 'none' })
  authType!: AuthType;

  @Column({ type: 'jsonb', nullable: true })
  authConfig?: {
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    bearerToken?: string;
    oauth2Config?: {
      clientId?: string;
      clientSecret?: string;
      authUrl?: string;
      tokenUrl?: string;
      scopes?: string[];
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: string;
    };
    certificate?: string;
    privateKey?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  headers?: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  options?: {
    timeout?: number;
    retries?: number;
    verifySsl?: boolean;
    proxyUrl?: string;
  };

  @Column({ type: 'timestamptz', nullable: true })
  lastTestedAt?: Date;

  @Column({ default: true })
  testSuccess?: boolean;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastErrorAt?: Date;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// ============ Webhook Definition ============

export type WebhookDirection = 'inbound' | 'outbound';

@Entity('webhook_definition')
export class WebhookDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 20 })
  direction!: WebhookDirection;

  @Column({ type: 'text', nullable: true })
  targetUrl?: string;

  @Column({ type: 'varchar', length: 10, default: 'POST' })
  httpMethod?: string;

  @Column({ type: 'jsonb', nullable: true })
  headers?: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  triggerEvents?: string[];

  @Column({ length: 100, nullable: true })
  collectionCode?: string;

  @Column({ type: 'jsonb', nullable: true })
  payloadTemplate?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, nullable: true })
  secretType?: 'hmac' | 'header';

  @Column({ type: 'text', nullable: true })
  secret?: string;

  @Column({ type: 'int', default: 3 })
  maxRetries!: number;

  @Column({ type: 'int', default: 30000 })
  timeoutMs!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// ============ Webhook Log ============

@Entity('webhook_log')
export class WebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  webhookDefinitionId!: string;

  @Column({ type: 'varchar', length: 20 })
  direction!: WebhookDirection;

  @Column({ type: 'varchar', length: 10, nullable: true })
  httpMethod?: string;

  @Column({ type: 'text', nullable: true })
  url?: string;

  @Column({ type: 'jsonb', nullable: true })
  requestHeaders?: Record<string, string>;

  @Column({ type: 'text', nullable: true })
  requestBody?: string;

  @Column({ type: 'int', nullable: true })
  responseStatus?: number;

  @Column({ type: 'jsonb', nullable: true })
  responseHeaders?: Record<string, string>;

  @Column({ type: 'text', nullable: true })
  responseBody?: string;

  @Column({ type: 'int', nullable: true })
  durationMs?: number;

  @Column({ default: false })
  success!: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @CreateDateColumn()
  @Index()
  createdAt!: Date;
}

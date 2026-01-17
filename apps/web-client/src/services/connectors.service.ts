import api from './api';

export type ConnectorType =
  | 'crm'
  | 'erp'
  | 'itsm'
  | 'project_management'
  | 'database'
  | 'file_storage'
  | 'generic';

export type ConnectorAuthType = 'none' | 'api_key' | 'basic' | 'oauth2' | 'jwt' | 'custom';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing';
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';
export type SyncMode = 'full' | 'incremental' | 'delta';
export type ConflictResolution = 'source_wins' | 'target_wins' | 'newest_wins' | 'manual';
export type SyncRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExternalConnector {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type: ConnectorType;
  version: string;
  iconUrl?: string | null;
  documentationUrl?: string | null;
  configSchema: Record<string, unknown>;
  authType: ConnectorAuthType;
  supportedOperations: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface ConnectorConnection {
  id: string;
  code?: string | null;
  connectorId: string;
  connector?: ExternalConnector;
  name: string;
  description?: string | null;
  config: Record<string, unknown>;
  credentialRef?: string | null;
  status: ConnectionStatus;
  lastConnectedAt?: string | null;
  lastSyncAt?: string | null;
  errorMessage?: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface PropertyMapping {
  id: string;
  code?: string | null;
  connectionId: string;
  name: string;
  sourceEntity: string;
  targetCollectionId?: string | null;
  direction: SyncDirection;
  mappings: Array<{
    sourceProperty: string;
    targetProperty: string;
    transformation?: string;
    defaultValue?: string;
    required?: boolean;
  }>;
  transformations: Array<{ type: string; config: Record<string, unknown> }>;
  filters?: Record<string, unknown> | null;
  syncMode: SyncMode;
  conflictResolution: ConflictResolution;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface SyncConfiguration {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  connectionId: string;
  mappingId?: string | null;
  schedule?: string | null;
  direction: SyncDirection;
  syncMode: SyncMode;
  conflictResolution: ConflictResolution;
  batchSize: number;
  isActive: boolean;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  metadata: Record<string, unknown>;
}

export interface SyncRun {
  id: string;
  configurationId: string;
  status: SyncRunStatus;
  direction?: SyncDirection | null;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  recordsSkipped: number;
  recordsFailed: number;
  conflictsDetected: number;
  conflictsResolved: number;
  errorMessage?: string | null;
  log: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }>;
}

export async function listConnectors(params?: { type?: string; isActive?: boolean }) {
  const response = await api.get<{ items: ExternalConnector[]; total: number }>('/connectors', {
    params,
  });
  return response.data;
}

export async function listConnections(params?: { connectorId?: string; status?: string }) {
  const response = await api.get<{ items: ConnectorConnection[]; total: number }>(
    '/connectors/connections',
    { params },
  );
  return response.data;
}

export async function createConnection(payload: {
  connectorId: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  credentialRef?: string;
}) {
  const response = await api.post<ConnectorConnection>('/connectors/connections', payload);
  return response.data;
}

export async function updateConnection(id: string, payload: Partial<{
  name: string;
  description?: string;
  config: Record<string, unknown>;
  credentialRef?: string;
}>) {
  const response = await api.put<ConnectorConnection>(`/connectors/connections/${id}`, payload);
  return response.data;
}

export async function testConnection(id: string) {
  const response = await api.post<{ success: boolean; error?: string }>(
    `/connectors/connections/${id}/test`,
  );
  return response.data;
}

export async function listMappings(connectionId: string) {
  const response = await api.get<PropertyMapping[]>(`/connectors/connections/${connectionId}/mappings`);
  return response.data;
}

export async function createMapping(payload: {
  connectionId: string;
  name: string;
  sourceEntity: string;
  targetCollectionId: string;
  direction?: SyncDirection;
  mappings: PropertyMapping['mappings'];
  syncMode?: SyncMode;
  conflictResolution?: ConflictResolution;
}) {
  const response = await api.post<PropertyMapping>('/connectors/mappings', payload);
  return response.data;
}

export async function updateMapping(
  id: string,
  payload: Partial<{
    name: string;
    sourceEntity: string;
    targetCollectionId?: string;
    direction?: SyncDirection;
    mappings?: PropertyMapping['mappings'];
    syncMode?: SyncMode;
    conflictResolution?: ConflictResolution;
  }>,
) {
  const response = await api.put<PropertyMapping>(`/connectors/mappings/${id}`, payload);
  return response.data;
}

export async function listSyncConfigs(params?: { connectionId?: string; isActive?: boolean }) {
  const response = await api.get<{ items: SyncConfiguration[]; total: number }>(
    '/connectors/sync-configs',
    { params },
  );
  return response.data;
}

export async function createSyncConfig(payload: {
  name: string;
  description?: string;
  connectionId: string;
  mappingId?: string;
  schedule?: string;
  direction?: SyncDirection;
  syncMode?: SyncMode;
  conflictResolution?: ConflictResolution;
  batchSize?: number;
}) {
  const response = await api.post<SyncConfiguration>('/connectors/sync-configs', payload);
  return response.data;
}

export async function updateSyncConfig(
  id: string,
  payload: Partial<{
    name: string;
    description?: string;
    mappingId?: string;
    schedule?: string;
    direction?: SyncDirection;
    syncMode?: SyncMode;
    conflictResolution?: ConflictResolution;
    batchSize?: number;
    isActive?: boolean;
  }>,
) {
  const response = await api.put<SyncConfiguration>(`/connectors/sync-configs/${id}`, payload);
  return response.data;
}

export async function runSync(configId: string) {
  const response = await api.post<SyncRun>(`/connectors/sync-configs/${configId}/run`);
  return response.data;
}

export async function listSyncRuns(configId: string, params?: { status?: SyncRunStatus }) {
  const response = await api.get<{ items: SyncRun[]; total: number }>(
    `/connectors/sync-configs/${configId}/runs`,
    { params },
  );
  return response.data;
}

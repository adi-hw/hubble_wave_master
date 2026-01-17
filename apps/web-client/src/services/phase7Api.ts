// ============================================================
// Phase 7: Revolutionary Features API Service
// ============================================================

import { apiFetch } from '../lib/api';

// Use the Vite proxy path for AI service - this goes through /api/ai which proxies to localhost:3004
// const AI_API_PREFIX = '/api/ai'; // Reserved for future use

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

// Predictive Operations
export interface PredictiveInsight {
  id: string;
  type: 'capacity' | 'security' | 'performance' | 'compliance' | 'usage';
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  title: string;
  description: string;
  affectedResources: string[];
  recommendations: string[];
  confidence: number;
  createdAt: string;
  resolvedAt?: string;
}

export interface InsightAnalysisJob {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  insightsGenerated: number;
  error?: string;
}

export interface PredictiveOpsDashboard {
  totalInsights: number;
  criticalCount: number;
  warningCount: number;
  openCount: number;
  recentInsights: PredictiveInsight[];
  jobs: InsightAnalysisJob[];
}

// Natural Language Query
export interface NLQueryResult {
  queryId: string;
  naturalLanguage: string;
  generatedSQL?: string;
  results: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
  explanation?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  query: string;
  isShared: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

// AI Reports
export interface AIReport {
  id: string;
  title: string;
  prompt: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  content?: string;
  format: 'detailed' | 'summary' | 'executive';
  createdAt: string;
  completedAt?: string;
}

export interface AIReportTemplate {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: unknown;
  }>;
  isShared: boolean;
}

// Digital Twins
export interface DigitalTwin {
  id: string;
  name: string;
  description?: string;
  assetId: string;
  assetType: string;
  status: 'active' | 'inactive' | 'error';
  currentState: Record<string, unknown>;
  sensorMappings: SensorMapping[];
  lastSyncAt?: string;
  createdAt: string;
}

export interface SensorMapping {
  sensorId: string;
  sensorType: string;
  propertyPath: string;
  unit?: string;
}

export interface SensorReading {
  id: string;
  twinId: string;
  sensorId: string;
  value: number;
  unit?: string;
  quality: 'good' | 'uncertain' | 'bad';
  timestamp: string;
}

// Self-Healing
export interface ServiceHealth {
  id: string;
  name: string;
  type: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheckAt?: string;
  metrics?: Record<string, unknown>;
}

export interface SelfHealingEvent {
  id: string;
  serviceId: string;
  eventType: 'health_check' | 'recovery_triggered' | 'recovery_completed' | 'recovery_failed' | 'alert';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RecoveryAction {
  id: string;
  eventId: string;
  actionType: 'restart' | 'scale_up' | 'scale_down' | 'circuit_break' | 'failover' | 'rollback';
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  executedAt?: string;
}

export interface SelfHealingDashboard {
  services: ServiceHealth[];
  recentEvents: SelfHealingEvent[];
  pendingActions: RecoveryAction[];
  healthyCount: number;
  unhealthyCount: number;
}

// Living Documentation
export interface GeneratedDoc {
  id: string;
  artifactType: 'collection' | 'process_flow' | 'view' | 'automation';
  artifactId: string;
  title: string;
  content: string;
  version: number;
  generatedAt: string;
  updatedAt: string;
}

// Agile Development
export interface SprintRecording {
  id: string;
  title: string;
  type: 'standup' | 'planning' | 'retrospective' | 'review';
  status: 'pending' | 'processing' | 'analyzed' | 'archived';
  transcript?: string;
  participants: string[];
  storiesGenerated: number;
  recordedAt: string;
}

export interface AvaStory {
  id: string;
  recordingId: string;
  title: string;
  description: string;
  type: 'feature' | 'enhancement' | 'bug' | 'chore';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'draft' | 'approved' | 'in_progress' | 'done';
  acceptanceCriteria: string[];
  storyPoints?: number;
  createdAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface UserStory {
  id: string;
  sprintId: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'backlog' | 'todo' | 'in_progress' | 'done';
  storyPoints?: number;
  assignee?: string;
  createdAt: string;
}

// Zero-Code App Builder
export type AppStatus = 'draft' | 'generating' | 'ready' | 'deployed' | 'error';

export interface GeneratedApp {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  status: AppStatus;
  generatedArtifacts?: {
    collections: number;
    views: number;
    automations: number;
  };
  createdAt: string;
}

export interface ZeroCodeApp {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'building' | 'active' | 'inactive' | 'failed' | 'archived';
  spec: AppSpec;
  deployedAt?: string;
  createdAt: string;
}

export interface AppSpec {
  name: string;
  description: string;
  collections: Array<{
    name: string;
    properties: Array<{
      name: string;
      type: string;
      required: boolean;
    }>;
  }>;
  views: Array<{
    name: string;
    type: string;
    collection: string;
  }>;
  navigation: Array<{
    label: string;
    icon: string;
    path: string;
  }>;
}

export interface AppVersion {
  id: string;
  appId: string;
  version: string;
  changelog: string;
  createdAt: string;
}

// Upgrade Assistant
export interface CustomizationItem {
  id: string;
  type: 'collection' | 'property' | 'rule' | 'flow' | 'script' | 'access_rule';
  name: string;
  isActive: boolean;
  dependencies: string[];
}

export interface UpgradeImpact {
  id: string;
  title: string;
  description: string;
  category: 'schema' | 'automation' | 'process_flow' | 'view' | 'code';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  affectedArtifact: string;
  suggestedFix?: string;
}

export interface UpgradeAnalysis {
  id: string;
  analysisId: string;
  targetVersion: string;
  riskScore: number;
  compatibilityScore: number;
  impacts: UpgradeImpact[];
  impactedCustomizations: Array<{
    id: string;
    name: string;
    type: string;
    impact: 'none' | 'low' | 'medium' | 'high' | 'critical';
    reason: string;
  }>;
  breakingChanges: Array<{
    change: string;
    affectedAreas: string[];
    suggestedFix: string;
  }>;
  estimatedEffort: {
    hours: number;
    complexity: 'low' | 'medium' | 'high';
  };
  recommendations: string[];
}

export interface UpgradeFix {
  id: string;
  customizationId: string;
  issue: string;
  suggestedFix: Record<string, unknown>;
  explanation: string;
  status: 'pending' | 'applied' | 'rejected' | 'skipped';
  isAutoFixable: boolean;
}

// Voice Control
export type VoiceCommandStatus = 'pending' | 'understood' | 'executing' | 'completed' | 'failed';

export interface VoiceCommand {
  id: string;
  text: string;
  status: VoiceCommandStatus;
  action?: string;
  response?: string;
  createdAt: string;
}

export interface VoiceCommandResult {
  commandId: string;
  transcript: string;
  intent: string;
  entities: Record<string, unknown>;
  confidence: number;
  action: string;
  result: unknown;
  executionTime: number;
}

// Predictive UI
export type SuggestionStatus = 'pending' | 'applied' | 'dismissed';

export interface UISuggestion {
  id: string;
  type: 'navigation' | 'action' | 'data' | 'shortcut';
  title: string;
  description: string;
  action: Record<string, unknown>;
  confidence: number;
  reason: string;
  reasoning?: string;
  status?: SuggestionStatus;
}

export interface UserInsights {
  totalActions: number;
  topActions: Array<{ action: string; count: number }>;
  activeHours: number[];
  patterns: Array<{ type: string; description: string }>;
}

// ─────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch from Phase 7 AI service endpoints.
 * Uses the Vite proxy path /api/phase7 which proxies to localhost:3004/api/phase7
 * Endpoint should include full path like '/api/phase7/nl-query/execute'
 */
const phase7Fetch = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  // The endpoint already includes /api/phase7/..., and apiFetch prepends /api
  // So we need to remove the /api prefix since apiFetch will add it
  const cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.slice(4) : endpoint;
  return apiFetch<T>(cleanEndpoint, options);
};

// Predictive Operations API
export const predictiveOpsApi = {
  getDashboard: () =>
    phase7Fetch<PredictiveOpsDashboard>('/api/phase7/predictive-ops/dashboard'),

  getInsights: (params?: { type?: string; severity?: string; status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.severity) searchParams.set('severity', params.severity);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    return phase7Fetch<{ insights: PredictiveInsight[] }>(
      `/api/phase7/predictive-ops/insights?${searchParams.toString()}`
    );
  },

  getInsight: (id: string) =>
    phase7Fetch<{ insight: PredictiveInsight }>(`/api/phase7/predictive-ops/insights/${id}`),

  resolveInsight: (id: string, resolution: string) =>
    phase7Fetch<{ insight: PredictiveInsight }>(`/api/phase7/predictive-ops/insights/${id}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ resolution }),
    }),

  dismissInsight: (id: string, reason: string) =>
    phase7Fetch<{ insight: PredictiveInsight }>(`/api/phase7/predictive-ops/insights/${id}/dismiss`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }),

  triggerAnalysis: (type: string, scope?: string) =>
    phase7Fetch<{ jobId: string }>('/api/phase7/predictive-ops/analyze', {
      method: 'POST',
      body: JSON.stringify({ type, scope }),
    }),

  getJobs: (status?: string) =>
    phase7Fetch<{ jobs: InsightAnalysisJob[] }>(
      `/api/phase7/predictive-ops/jobs${status ? `?status=${status}` : ''}`
    ),
};

// Natural Language Query API
export const nlQueryApi = {
  executeQuery: (query: string, options?: { preview?: boolean; limit?: number }) =>
    phase7Fetch<NLQueryResult>('/api/phase7/nl-query/execute', {
      method: 'POST',
      body: JSON.stringify({ query, options }),
    }),

  explainQuery: (query: string) =>
    phase7Fetch<{ explanation: string }>('/api/phase7/nl-query/explain', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  suggestQueries: (context?: string) =>
    phase7Fetch<{ suggestions: string[] }>('/api/phase7/nl-query/suggest', {
      method: 'POST',
      body: JSON.stringify({ context }),
    }),

  getHistory: (limit?: number) =>
    phase7Fetch<{ history: NLQueryResult[] }>(
      `/api/phase7/nl-query/history${limit ? `?limit=${limit}` : ''}`
    ),

  saveQuery: (name: string, query: string, description?: string, isShared?: boolean) =>
    phase7Fetch<{ saved: SavedQuery }>('/api/phase7/nl-query/save', {
      method: 'POST',
      body: JSON.stringify({ name, query, description, isShared }),
    }),

  getSavedQueries: (includeShared?: boolean) =>
    phase7Fetch<{ queries: SavedQuery[] }>(
      `/api/phase7/nl-query/saved${includeShared ? '?includeShared=true' : ''}`
    ),

  deleteSavedQuery: (id: string) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/nl-query/saved/${id}`, {
      method: 'DELETE',
    }),

  getExamples: () =>
    phase7Fetch<{ examples: Array<{ query: string; description: string }> }>(
      '/api/phase7/nl-query/examples'
    ),
};

// AI Reports API
export const aiReportsApi = {
  generateReport: (prompt: string, options?: { format?: string; includeCharts?: boolean }) =>
    phase7Fetch<{ report: AIReport }>('/api/phase7/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, options }),
    }),

  listReports: (status?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit) params.set('limit', String(limit));
    return phase7Fetch<{ reports: AIReport[] }>(`/api/phase7/reports?${params.toString()}`);
  },

  getReport: (id: string) =>
    phase7Fetch<{ report: AIReport }>(`/api/phase7/reports/${id}`),

  deleteReport: (id: string) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/reports/${id}`, {
      method: 'DELETE',
    }),

  exportReport: (id: string, format: string) =>
    phase7Fetch<Blob>(`/api/phase7/reports/${id}/export/${format}`),

  listTemplates: (includeShared?: boolean) =>
    phase7Fetch<{ templates: AIReportTemplate[] }>(
      `/api/phase7/reports/templates${includeShared ? '?includeShared=true' : ''}`
    ),

  createTemplate: (template: Omit<AIReportTemplate, 'id'>) =>
    phase7Fetch<{ template: AIReportTemplate }>('/api/phase7/reports/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    }),

  generateFromTemplate: (templateId: string, parameters?: Record<string, unknown>) =>
    phase7Fetch<{ report: AIReport }>(`/api/phase7/reports/templates/${templateId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ parameters }),
    }),
};

// Digital Twins API
export const digitalTwinsApi = {
  listTwins: (params?: { assetType?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.assetType) searchParams.set('assetType', params.assetType);
    if (params?.status) searchParams.set('status', params.status);
    return phase7Fetch<{ twins: DigitalTwin[] }>(
      `/api/phase7/digital-twins?${searchParams.toString()}`
    );
  },

  getTwin: (id: string) =>
    phase7Fetch<{ twin: DigitalTwin }>(`/api/phase7/digital-twins/${id}`),

  createTwin: (twin: Omit<DigitalTwin, 'id' | 'createdAt' | 'currentState' | 'sensorMappings'>) =>
    phase7Fetch<{ twin: DigitalTwin }>('/api/phase7/digital-twins', {
      method: 'POST',
      body: JSON.stringify(twin),
    }),

  updateTwin: (id: string, updates: Partial<DigitalTwin>) =>
    phase7Fetch<{ twin: DigitalTwin }>(`/api/phase7/digital-twins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteTwin: (id: string) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/digital-twins/${id}`, {
      method: 'DELETE',
    }),

  getCurrentState: (id: string) =>
    phase7Fetch<{ state: Record<string, unknown> }>(`/api/phase7/digital-twins/${id}/state`),

  addSensorMapping: (twinId: string, mapping: SensorMapping) =>
    phase7Fetch<{ mapping: SensorMapping }>(`/api/phase7/digital-twins/${twinId}/sensors`, {
      method: 'POST',
      body: JSON.stringify(mapping),
    }),

  getReadings: (twinId: string, params?: { sensorId?: string; from?: string; to?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.sensorId) searchParams.set('sensorId', params.sensorId);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    return phase7Fetch<{ readings: SensorReading[] }>(
      `/api/phase7/digital-twins/${twinId}/readings?${searchParams.toString()}`
    );
  },

  ingestReading: (twinId: string, reading: Omit<SensorReading, 'id' | 'twinId'>) =>
    phase7Fetch<{ reading: SensorReading }>(`/api/phase7/digital-twins/${twinId}/readings`, {
      method: 'POST',
      body: JSON.stringify(reading),
    }),
};

// Self-Healing API
export const selfHealingApi = {
  getDashboard: () =>
    phase7Fetch<SelfHealingDashboard>('/api/phase7/self-healing/dashboard'),

  listServices: (status?: string) =>
    phase7Fetch<{ services: ServiceHealth[] }>(
      `/api/phase7/self-healing/services${status ? `?status=${status}` : ''}`
    ),

  getService: (id: string) =>
    phase7Fetch<{ service: ServiceHealth }>(`/api/phase7/self-healing/services/${id}`),

  registerService: (service: Omit<ServiceHealth, 'id' | 'lastCheckAt'>) =>
    phase7Fetch<{ service: ServiceHealth }>('/api/phase7/self-healing/services', {
      method: 'POST',
      body: JSON.stringify(service),
    }),

  triggerHealthCheck: (serviceId: string) =>
    phase7Fetch<{ result: Record<string, unknown> }>(
      `/api/phase7/self-healing/services/${serviceId}/health-check`,
      { method: 'POST' }
    ),

  getEvents: (params?: { serviceId?: string; type?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.serviceId) searchParams.set('serviceId', params.serviceId);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.status) searchParams.set('status', params.status);
    return phase7Fetch<{ events: SelfHealingEvent[] }>(
      `/api/phase7/self-healing/events?${searchParams.toString()}`
    );
  },

  getRecoveryActions: (eventId?: string) =>
    phase7Fetch<{ actions: RecoveryAction[] }>(
      `/api/phase7/self-healing/recovery${eventId ? `?eventId=${eventId}` : ''}`
    ),

  executeRecoveryAction: (actionId: string) =>
    phase7Fetch<{ result: Record<string, unknown> }>(
      `/api/phase7/self-healing/recovery/${actionId}/execute`,
      { method: 'POST' }
    ),

  runAllHealthChecks: () =>
    phase7Fetch<{ results: Record<string, unknown>[] }>('/api/phase7/self-healing/run-checks', {
      method: 'POST',
    }),
};

// Living Documentation API
export const livingDocsApi = {
  generateForArtifact: (artifactType: string, artifactId: string, options?: Record<string, unknown>) =>
    phase7Fetch<{ documentation: GeneratedDoc }>('/api/phase7/docs/generate', {
      method: 'POST',
      body: JSON.stringify({ artifactType, artifactId, options }),
    }),

  generateForCollection: (collectionId: string, options?: Record<string, unknown>) =>
    phase7Fetch<{ documentation: GeneratedDoc }>(`/api/phase7/docs/generate/collection/${collectionId}`, {
      method: 'POST',
      body: JSON.stringify({ options }),
    }),

  regenerateAll: () =>
    phase7Fetch<{ jobId: string; count: number }>('/api/phase7/docs/regenerate-all', {
      method: 'POST',
    }),

  search: (query: string, type?: string, limit?: number) => {
    const params = new URLSearchParams({ q: query });
    if (type) params.set('type', type);
    if (limit) params.set('limit', String(limit));
    return phase7Fetch<{ results: GeneratedDoc[] }>(`/api/phase7/docs/search?${params.toString()}`);
  },

  getDoc: (id: string) =>
    phase7Fetch<{ documentation: GeneratedDoc }>(`/api/phase7/docs/${id}`),

  getVersionHistory: (id: string) =>
    phase7Fetch<{ versions: Array<{ version: number; createdAt: string }> }>(
      `/api/phase7/docs/${id}/versions`
    ),

  exportToMarkdown: (id: string) =>
    phase7Fetch<{ markdown: string }>(`/api/phase7/docs/${id}/export`),
};

// Agile Development API
export const agileDevApi = {
  getSprints: () =>
    phase7Fetch<{ sprints: Sprint[] }>('/api/phase7/agile/sprints'),

  createSprint: (sprint: Omit<Sprint, 'id' | 'createdAt'>) =>
    phase7Fetch<{ sprint: Sprint }>('/api/phase7/agile/sprints', {
      method: 'POST',
      body: JSON.stringify(sprint),
    }),

  getStories: (sprintId: string) =>
    phase7Fetch<{ stories: UserStory[] }>(`/api/phase7/agile/sprints/${sprintId}/stories`),

  createStory: (sprintId: string, story: Omit<UserStory, 'id' | 'sprintId' | 'createdAt'>) =>
    phase7Fetch<{ story: UserStory }>(`/api/phase7/agile/sprints/${sprintId}/stories`, {
      method: 'POST',
      body: JSON.stringify(story),
    }),

  updateStory: (storyId: string, updates: Partial<UserStory>) =>
    phase7Fetch<{ story: UserStory }>(`/api/phase7/agile/stories/${storyId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  generateStories: (sprintId: string, prompt: string) =>
    phase7Fetch<{ stories: UserStory[] }>(`/api/phase7/agile/sprints/${sprintId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  createRecording: (recording: { title: string; type: string; participants: string[] }) =>
    phase7Fetch<{ recording: SprintRecording }>('/api/phase7/agile/recordings', {
      method: 'POST',
      body: JSON.stringify(recording),
    }),

  processRecording: (id: string, transcript?: string) =>
    phase7Fetch<{ stories: AvaStory[] }>(`/api/phase7/agile/recordings/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),

  getRecordings: (limit?: number) =>
    phase7Fetch<{ recordings: SprintRecording[] }>(
      `/api/phase7/agile/recordings${limit ? `?limit=${limit}` : ''}`
    ),

  getRecording: (id: string) =>
    phase7Fetch<{ recording: SprintRecording }>(`/api/phase7/agile/recordings/${id}`),

  approveStory: (id: string, modifications?: Record<string, unknown>) =>
    phase7Fetch<{ story: AvaStory }>(`/api/phase7/agile/stories/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ modifications }),
    }),

  rejectStory: (id: string, reason: string) =>
    phase7Fetch<{ story: AvaStory }>(`/api/phase7/agile/stories/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }),
};

// App Builder API
export const appBuilderApi = {
  getApps: () =>
    phase7Fetch<{ apps: GeneratedApp[] }>('/api/phase7/app-builder/apps'),

  generateApp: (params: { name: string; description?: string; prompt: string }) =>
    phase7Fetch<{ app: GeneratedApp }>('/api/phase7/app-builder/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  deployApp: (id: string) =>
    phase7Fetch<{ app: GeneratedApp }>(`/api/phase7/app-builder/apps/${id}/deploy`, {
      method: 'POST',
    }),

  deleteApp: (id: string) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/app-builder/apps/${id}`, {
      method: 'DELETE',
    }),

  getApp: (id: string) =>
    phase7Fetch<{ app: GeneratedApp }>(`/api/phase7/app-builder/apps/${id}`),

  refineApp: (id: string, refinement: string) =>
    phase7Fetch<{ app: GeneratedApp }>(`/api/phase7/app-builder/apps/${id}/refine`, {
      method: 'PUT',
      body: JSON.stringify({ refinement }),
    }),

  listApps: (status?: string) =>
    phase7Fetch<{ apps: ZeroCodeApp[] }>(
      `/api/phase7/app-builder/legacy${status ? `?status=${status}` : ''}`
    ),

  buildApp: (id: string) =>
    phase7Fetch<{ success: boolean; errors: string[] }>(`/api/phase7/app-builder/apps/${id}/build`, {
      method: 'POST',
    }),

  duplicateApp: (id: string, newName: string) =>
    phase7Fetch<{ app: ZeroCodeApp }>(`/api/phase7/app-builder/apps/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ newName }),
    }),

  getVersionHistory: (id: string) =>
    phase7Fetch<{ versions: AppVersion[] }>(`/api/phase7/app-builder/apps/${id}/versions`),

  rollbackToVersion: (appId: string, versionId: string) =>
    phase7Fetch<{ spec: AppSpec }>(`/api/phase7/app-builder/apps/${appId}/rollback/${versionId}`, {
      method: 'POST',
    }),

  getComponents: () =>
    phase7Fetch<{ components: Array<{ id: string; name: string; category: string }> }>(
      '/api/phase7/app-builder/components'
    ),
};

// Upgrade Assistant API
export const upgradeAssistantApi = {
  getCurrentVersion: () =>
    phase7Fetch<{ version: string; latestVersion?: string; pendingAnalysis?: UpgradeAnalysis }>(
      '/api/phase7/upgrade-assistant/current-version'
    ),

  analyzeUpgrade: (currentVersion: string, targetVersion: string) =>
    phase7Fetch<{ analysis: UpgradeAnalysis }>('/api/phase7/upgrade-assistant/analyze', {
      method: 'POST',
      body: JSON.stringify({ currentVersion, targetVersion }),
    }),

  applyUpgrade: (analysisId: string) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/upgrade-assistant/analyses/${analysisId}/apply`, {
      method: 'POST',
    }),

  getCustomizations: (type?: string) =>
    phase7Fetch<{ customizations: CustomizationItem[] }>(
      `/api/phase7/upgrade-assistant/customizations${type ? `?type=${type}` : ''}`
    ),

  registerCustomization: (customization: Omit<CustomizationItem, 'id'>) =>
    phase7Fetch<{ customization: CustomizationItem }>('/api/phase7/upgrade-assistant/customizations', {
      method: 'POST',
      body: JSON.stringify(customization),
    }),

  getAnalysisHistory: () =>
    phase7Fetch<{ analyses: UpgradeAnalysis[] }>('/api/phase7/upgrade-assistant/analyses'),

  getAnalysis: (id: string) =>
    phase7Fetch<{ analysis: UpgradeAnalysis }>(`/api/phase7/upgrade-assistant/analyses/${id}`),

  generateFixes: (analysisId: string) =>
    phase7Fetch<{ fixes: UpgradeFix[] }>(`/api/phase7/upgrade-assistant/analyses/${analysisId}/fixes`, {
      method: 'POST',
    }),

  getFixes: (analysisId: string) =>
    phase7Fetch<{ fixes: UpgradeFix[] }>(`/api/phase7/upgrade-assistant/analyses/${analysisId}/fixes`),

  applyFix: (fixId: string) =>
    phase7Fetch<{ success: boolean; message: string }>(`/api/phase7/upgrade-assistant/fixes/${fixId}/apply`, {
      method: 'POST',
    }),

  rejectFix: (fixId: string, reason: string) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/upgrade-assistant/fixes/${fixId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }),

  getReadiness: (targetVersion: string) =>
    phase7Fetch<{
      readiness: {
        ready: boolean;
        blockers: string[];
        warnings: string[];
        customizationCount: number;
        pendingFixes: number;
      };
    }>(`/api/phase7/upgrade-assistant/readiness?targetVersion=${targetVersion}`),

  simulateUpgrade: (targetVersion: string) =>
    phase7Fetch<{
      result: {
        success: boolean;
        issues: Array<{ type: string; message: string; severity: string }>;
        duration: number;
      };
    }>('/api/phase7/upgrade-assistant/simulate', {
      method: 'POST',
      body: JSON.stringify({ targetVersion }),
    }),
};

// Voice Control API
export const voiceControlApi = {
  processCommand: (text: string, context?: Record<string, unknown>) =>
    phase7Fetch<{ command: VoiceCommand }>('/api/phase7/voice/command', {
      method: 'POST',
      body: JSON.stringify({ text, context }),
    }),

  processVoiceCommand: (audioData: string, context?: Record<string, unknown>) =>
    phase7Fetch<{ command: VoiceCommand }>('/api/phase7/voice/command', {
      method: 'POST',
      body: JSON.stringify({ audioData, context }),
    }),

  getSupportedCommands: () =>
    phase7Fetch<{ commands: Array<{ intent: string; description: string; examples: string[] }> }>(
      '/api/phase7/voice/commands'
    ),

  getCommandHistory: (limit?: number) =>
    phase7Fetch<{ commands: VoiceCommand[] }>(
      `/api/phase7/voice/history${limit ? `?limit=${limit}` : ''}`
    ),

  getHistory: (limit?: number) =>
    phase7Fetch<{ history: VoiceCommandResult[] }>(
      `/api/phase7/voice/history${limit ? `?limit=${limit}` : ''}`
    ),
};

// Predictive UI API
export const predictiveUIApi = {
  trackBehavior: (behavior: { type: string; action: string; target?: string; metadata?: Record<string, unknown> }) =>
    phase7Fetch<{ success: boolean }>('/api/phase7/predictive-ui/behavior', {
      method: 'POST',
      body: JSON.stringify(behavior),
    }),

  getSuggestions: (context?: string) =>
    phase7Fetch<{ suggestions: UISuggestion[] }>(
      `/api/phase7/predictive-ui/suggestions${context ? `?context=${encodeURIComponent(context)}` : ''}`
    ),

  applySuggestion: (suggestionId: string) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/predictive-ui/suggestions/${suggestionId}/apply`, {
      method: 'POST',
    }),

  dismissSuggestion: (suggestionId: string) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/predictive-ui/suggestions/${suggestionId}/dismiss`, {
      method: 'POST',
    }),

  provideFeedback: (suggestionId: string, helpful: boolean) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/predictive-ui/suggestions/${suggestionId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ helpful }),
    }),

  recordFeedback: (suggestionId: string, accepted: boolean) =>
    phase7Fetch<{ success: boolean }>(`/api/phase7/predictive-ui/suggestions/${suggestionId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ accepted }),
    }),

  getPersonalizedLayout: (page: string) =>
    phase7Fetch<{
      layout: {
        widgets: Array<{ id: string; position: number; priority: number }>;
        shortcuts: Array<{ action: string; label: string }>;
        recentItems: Array<{ type: string; id: string; label: string }>;
      };
    }>(`/api/phase7/predictive-ui/layout/${page}`),

  getUserInsights: () =>
    phase7Fetch<{ insights: UserInsights }>('/api/phase7/predictive-ui/insights'),

  getShortcuts: () =>
    phase7Fetch<{ shortcuts: Array<{ action: string; label: string }> }>('/api/phase7/predictive-ui/shortcuts'),
};

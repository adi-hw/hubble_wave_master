import { createApiClient } from './api';

export type MetricDefinition = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sourceType: 'collection' | 'analytics_event';
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  cadence: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
};

export type DashboardDefinition = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  layout?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
};

export type MetricPoint = {
  metricCode: string;
  periodStart: string;
  periodEnd: string;
  value: number;
};

const INSIGHTS_API_URL = import.meta.env.VITE_INSIGHTS_API_URL ?? '/api/insights';
const insightsApi = createApiClient(INSIGHTS_API_URL);

export async function listMetrics(): Promise<MetricDefinition[]> {
  const response = await insightsApi.get('/metrics');
  return Array.isArray(response.data) ? (response.data as MetricDefinition[]) : [];
}

export async function listDashboards(): Promise<DashboardDefinition[]> {
  const response = await insightsApi.get('/dashboards');
  return Array.isArray(response.data) ? (response.data as DashboardDefinition[]) : [];
}

export async function getDashboard(code: string): Promise<DashboardDefinition | null> {
  const response = await insightsApi.get(`/dashboards/${encodeURIComponent(code)}`);
  return response.data as DashboardDefinition;
}

export async function createDashboard(payload: {
  code: string;
  name: string;
  description?: string | null;
  layout?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const response = await insightsApi.post('/dashboards', payload);
  return response.data as DashboardDefinition;
}

export async function updateDashboard(
  code: string,
  payload: Partial<Omit<DashboardDefinition, 'id' | 'code'>>,
) {
  const response = await insightsApi.put(`/dashboards/${encodeURIComponent(code)}`, payload);
  return response.data as DashboardDefinition;
}

export async function getMetricPoints(
  code: string,
  params?: { start?: string; end?: string; limit?: number },
): Promise<MetricPoint[]> {
  const query = new URLSearchParams();
  if (params?.start) query.set('start', params.start);
  if (params?.end) query.set('end', params.end);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await insightsApi.get(`/metrics/${encodeURIComponent(code)}/points${suffix}`);
  return Array.isArray(response.data) ? (response.data as MetricPoint[]) : [];
}

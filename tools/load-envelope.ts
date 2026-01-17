import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

type Sample = {
  name: string;
  durationMs: number;
  ok: boolean;
  status?: number;
  error?: string;
};

type ScenarioStats = {
  name: string;
  count: number;
  successCount: number;
  errorCount: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  statusCounts: Record<string, number>;
  errors: { status?: number; message: string }[];
};

type LoadReport = {
  runId: string;
  release: string;
  startedAt: string;
  finishedAt: string;
  config: Record<string, unknown>;
  scenarios: ScenarioStats[];
};

type LoadConfig = {
  release: string;
  baseUrl: string;
  dataBaseUrl: string;
  viewBaseUrl: string;
  workflowBaseUrl: string;
  searchBaseUrl: string;
  avaBaseUrl: string;
  token: string;
  iterations: number;
  concurrency: number;
  timeoutMs: number;
  skipScenarios: Set<string>;
  outputDir: string;
  crud: {
    collectionCode: string;
    createPayload: Record<string, unknown>;
    updatePayload: Record<string, unknown>;
  };
  view: {
    kind: string;
    collection?: string;
    route?: string;
  };
  workflow: {
    definitionId: string;
    input?: Record<string, unknown>;
    recordId?: string;
    requireApproval: boolean;
  };
  search: {
    query: string;
    experienceCode?: string;
    sources?: string[];
  };
  ava: {
    message: string;
  };
};

type ScenarioDefinition = {
  name: string;
  required: (keyof LoadConfig)[];
  run: (config: LoadConfig, runId: string, index: number) => Promise<Sample[]>;
};

const env = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
};

const parseIntEnv = (key: string, fallback: number) => {
  const raw = env(key);
  if (!raw) {
    return fallback;
  }
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolEnv = (key: string, fallback: boolean) => {
  const raw = env(key);
  if (!raw) {
    return fallback;
  }
  return ['true', '1', 'yes'].includes(raw.toLowerCase());
};

const parseJsonEnv = (key: string): Record<string, unknown> | undefined => {
  const raw = env(key);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    throw new Error(`Invalid JSON in ${key}: ${(error as Error).message}`);
  }
  throw new Error(`${key} must be a JSON object`);
};

const parseListEnv = (key: string): string[] | undefined => {
  const raw = env(key);
  if (!raw) {
    return undefined;
  }
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
};

const ensureRequired = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required configuration: ${key}`);
  }
  return value;
};

const buildUrl = (base: string, path: string) => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase).toString();
};

const percentile = (values: number[], pct: number) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
};

const summarize = (name: string, samples: Sample[]): ScenarioStats => {
  const durations = samples.map((sample) => sample.durationMs);
  const statusCounts: Record<string, number> = {};
  const errors: { status?: number; message: string }[] = [];

  for (const sample of samples) {
    const statusKey = sample.status !== undefined ? String(sample.status) : 'error';
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    if (!sample.ok) {
      errors.push({ status: sample.status, message: sample.error || 'Request failed' });
    }
  }

  const total = samples.length;
  const successCount = samples.filter((sample) => sample.ok).length;
  const errorCount = total - successCount;
  const avgMs = total === 0 ? 0 : durations.reduce((sum, value) => sum + value, 0) / total;

  return {
    name,
    count: total,
    successCount,
    errorCount,
    minMs: total === 0 ? 0 : Math.min(...durations),
    maxMs: total === 0 ? 0 : Math.max(...durations),
    avgMs: Math.round(avgMs),
    p50Ms: percentile(durations, 50),
    p90Ms: percentile(durations, 90),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    statusCounts,
    errors: errors.slice(0, 10),
  };
};

const requestJson = async <T>(
  name: string,
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: Record<string, unknown>;
    timeoutMs: number;
  }
): Promise<{ sample: Sample; data?: T }> => {
  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const res = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const durationMs = Math.round(performance.now() - start);
    const sampleBase: Sample = {
      name,
      durationMs,
      ok: res.ok,
      status: res.status,
    };

    if (!res.ok) {
      const errorText = await res.text();
      return {
        sample: { ...sampleBase, error: errorText || `HTTP ${res.status}` },
      };
    }

    if (res.status === 204) {
      return { sample: sampleBase };
    }

    const data = (await res.json()) as T;
    return { sample: sampleBase, data };
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    return {
      sample: {
        name,
        durationMs,
        ok: false,
        error: (error as Error).message,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
};

const requestVoid = async (
  name: string,
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    timeoutMs: number;
  }
): Promise<Sample> => {
  const response = await requestJson(name, url, {
    method: options.method,
    headers: options.headers,
    timeoutMs: options.timeoutMs,
  });
  return response.sample;
};

const runWithConcurrency = async <T>(
  total: number,
  concurrency: number,
  task: (index: number) => Promise<T>
): Promise<T[]> => {
  let index = 0;
  const results: T[] = [];

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= total) {
        break;
      }
      const result = await task(current);
      results.push(result);
    }
  });

  await Promise.all(workers);
  return results;
};

const validateScenarioConfig = (scenario: ScenarioDefinition, config: LoadConfig) => {
  const missing = scenario.required.filter((key) => config[key] === undefined || config[key] === null);
  if (missing.length > 0) {
    throw new Error(`Scenario ${scenario.name} missing configuration: ${missing.join(', ')}`);
  }
};

const buildConfig = (): LoadConfig => {
  const baseUrl = env('HW_LOAD_BASE_URL') || 'http://localhost:4200';
  const token = ensureRequired(env('HW_LOAD_TOKEN'), 'HW_LOAD_TOKEN');
  const release = env('HW_LOAD_RELEASE') || 'dev';
  const outputRoot = env('HW_LOAD_OUTPUT_DIR') || join(process.cwd(), 'reports', 'load-envelope', release);

  const createPayload = parseJsonEnv('HW_LOAD_RECORD_PAYLOAD');
  const updatePayload = parseJsonEnv('HW_LOAD_RECORD_UPDATE_PAYLOAD') || createPayload;
  const collectionCode = env('HW_LOAD_COLLECTION_CODE');

  if (!createPayload || !updatePayload || !collectionCode) {
    const missing: string[] = [];
    if (!collectionCode) missing.push('HW_LOAD_COLLECTION_CODE');
    if (!createPayload) missing.push('HW_LOAD_RECORD_PAYLOAD');
    if (!updatePayload) missing.push('HW_LOAD_RECORD_UPDATE_PAYLOAD');
    throw new Error(`Missing CRUD configuration: ${missing.join(', ')}`);
  }

  const viewKind = env('HW_LOAD_VIEW_KIND') || 'list';
  const viewCollection = env('HW_LOAD_VIEW_COLLECTION');
  const viewRoute = env('HW_LOAD_VIEW_ROUTE');

  if (!viewCollection && !viewRoute) {
    throw new Error('Missing view configuration: set HW_LOAD_VIEW_COLLECTION or HW_LOAD_VIEW_ROUTE');
  }

  const workflowDefinitionId = env('HW_LOAD_WORKFLOW_DEFINITION_ID');
  if (!workflowDefinitionId) {
    throw new Error('Missing workflow configuration: set HW_LOAD_WORKFLOW_DEFINITION_ID');
  }

  const searchQuery = env('HW_LOAD_SEARCH_QUERY');
  if (!searchQuery) {
    throw new Error('Missing search configuration: set HW_LOAD_SEARCH_QUERY');
  }

  const avaMessage = env('HW_LOAD_AVA_MESSAGE');
  if (!avaMessage) {
    throw new Error('Missing AVA configuration: set HW_LOAD_AVA_MESSAGE');
  }

  return {
    release,
    baseUrl,
    dataBaseUrl: env('HW_LOAD_DATA_URL') || `${baseUrl}/api/data`,
    viewBaseUrl: env('HW_LOAD_VIEW_URL') || `${baseUrl}/api/view-engine`,
    workflowBaseUrl: env('HW_LOAD_WORKFLOW_URL') || `${baseUrl}/api/workflows`,
    searchBaseUrl: env('HW_LOAD_SEARCH_URL') || `${baseUrl}/api/search`,
    avaBaseUrl: env('HW_LOAD_AVA_URL') || `${baseUrl}/api/ava`,
    token,
    iterations: parseIntEnv('HW_LOAD_ITERATIONS', 10),
    concurrency: parseIntEnv('HW_LOAD_CONCURRENCY', 3),
    timeoutMs: parseIntEnv('HW_LOAD_TIMEOUT_MS', 15000),
    skipScenarios: new Set(parseListEnv('HW_LOAD_SKIP_SCENARIOS') || []),
    outputDir: outputRoot,
    crud: {
      collectionCode,
      createPayload,
      updatePayload,
    },
    view: {
      kind: viewKind,
      collection: viewCollection || undefined,
      route: viewRoute || undefined,
    },
    workflow: {
      definitionId: workflowDefinitionId,
      input: parseJsonEnv('HW_LOAD_WORKFLOW_INPUT') || undefined,
      recordId: env('HW_LOAD_WORKFLOW_RECORD_ID') || undefined,
      requireApproval: parseBoolEnv('HW_LOAD_REQUIRE_WORKFLOW_APPROVAL', false),
    },
    search: {
      query: searchQuery,
      experienceCode: env('HW_LOAD_SEARCH_EXPERIENCE_CODE') || undefined,
      sources: parseListEnv('HW_LOAD_SEARCH_SOURCES'),
    },
    ava: {
      message: avaMessage,
    },
  };
};

const buildHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const scenarios: ScenarioDefinition[] = [
  {
    name: 'crud',
    required: ['crud', 'dataBaseUrl'],
    run: async (config, runId, index) => {
      const headers = buildHeaders(config.token);
      const payload = {
        ...config.crud.createPayload,
        load_run_id: runId,
        load_sequence: index,
      };
      const createUrl = buildUrl(
        config.dataBaseUrl,
        `/collections/${config.crud.collectionCode}/data`
      );
      const createResponse = await requestJson<{ record?: Record<string, unknown> }>(
        'crud.create',
        createUrl,
        { method: 'POST', headers, body: payload, timeoutMs: config.timeoutMs }
      );

      const samples: Sample[] = [createResponse.sample];
      const record = createResponse.data?.record;
      const recordId = (record?.id as string | undefined) || (record?.['id'] as string | undefined);
      if (!recordId) {
        return samples;
      }

      const listUrl = buildUrl(
        config.dataBaseUrl,
        `/collections/${config.crud.collectionCode}/data?page=1&pageSize=10`
      );
      const listResponse = await requestJson('crud.list', listUrl, {
        method: 'GET',
        headers,
        timeoutMs: config.timeoutMs,
      });
      samples.push(listResponse.sample);

      const updatePayload = {
        ...config.crud.updatePayload,
        load_updated_at: new Date().toISOString(),
      };
      const updateUrl = buildUrl(
        config.dataBaseUrl,
        `/collections/${config.crud.collectionCode}/data/${recordId}`
      );
      const updateResponse = await requestJson('crud.update', updateUrl, {
        method: 'PUT',
        headers,
        body: updatePayload,
        timeoutMs: config.timeoutMs,
      });
      samples.push(updateResponse.sample);

      const deleteUrl = buildUrl(
        config.dataBaseUrl,
        `/collections/${config.crud.collectionCode}/data/${recordId}`
      );
      const deleteSample = await requestVoid('crud.delete', deleteUrl, {
        method: 'DELETE',
        headers,
        timeoutMs: config.timeoutMs,
      });
      samples.push(deleteSample);

      return samples;
    },
  },
  {
    name: 'view.resolve',
    required: ['view', 'viewBaseUrl'],
    run: async (config) => {
      const headers = buildHeaders(config.token);
      const qs = new URLSearchParams();
      qs.set('kind', config.view.kind);
      if (config.view.collection) {
        qs.set('collection', config.view.collection);
      }
      if (config.view.route) {
        qs.set('route', config.view.route);
      }
      const url = buildUrl(config.viewBaseUrl, `/views/resolve?${qs.toString()}`);
      const response = await requestJson('view.resolve', url, {
        method: 'GET',
        headers,
        timeoutMs: config.timeoutMs,
      });
      return [response.sample];
    },
  },
  {
    name: 'workflow.advance',
    required: ['workflow', 'workflowBaseUrl'],
    run: async (config) => {
      const headers = buildHeaders(config.token);
      const startUrl = buildUrl(
        config.workflowBaseUrl,
        `/definitions/${config.workflow.definitionId}/start`
      );
      const startResponse = await requestJson<{ id?: string }>('workflow.start', startUrl, {
        method: 'POST',
        headers,
        body: {
          input: config.workflow.input || {},
          recordId: config.workflow.recordId || undefined,
        },
        timeoutMs: config.timeoutMs,
      });

      const samples: Sample[] = [startResponse.sample];
      const instanceId = startResponse.data?.id;
      if (!instanceId) {
        return samples;
      }

      const approvalsUrl = buildUrl(
        config.workflowBaseUrl,
        `/approvals/by-instance?processFlowInstanceId=${encodeURIComponent(instanceId)}`
      );
      const approvalsResponse = await requestJson<{ id?: string }[]>(
        'workflow.approvals.list',
        approvalsUrl,
        {
          method: 'GET',
          headers,
          timeoutMs: config.timeoutMs,
        }
      );
      samples.push(approvalsResponse.sample);

      const approvalId = approvalsResponse.data?.[0]?.id;
      if (!approvalId) {
        if (config.workflow.requireApproval) {
          samples.push({
            name: 'workflow.approvals.approve',
            durationMs: 0,
            ok: false,
            error: 'No approval found for workflow instance',
          });
        }
        return samples;
      }

      const approveUrl = buildUrl(
        config.workflowBaseUrl,
        `/approvals/${approvalId}/approve`
      );
      const approveResponse = await requestJson('workflow.approvals.approve', approveUrl, {
        method: 'POST',
        headers,
        body: { comments: 'Load envelope approval' },
        timeoutMs: config.timeoutMs,
      });
      samples.push(approveResponse.sample);

      return samples;
    },
  },
  {
    name: 'search.query',
    required: ['search', 'searchBaseUrl'],
    run: async (config) => {
      const headers = buildHeaders(config.token);
      const qs = new URLSearchParams();
      qs.set('q', config.search.query);
      if (config.search.experienceCode) {
        qs.set('experience_code', config.search.experienceCode);
      }
      if (config.search.sources && config.search.sources.length > 0) {
        qs.set('sources', config.search.sources.join(','));
      }
      const url = buildUrl(config.searchBaseUrl, `/query?${qs.toString()}`);
      const response = await requestJson('search.query', url, {
        method: 'GET',
        headers,
        timeoutMs: config.timeoutMs,
      });
      return [response.sample];
    },
  },
  {
    name: 'ava.answers',
    required: ['ava', 'avaBaseUrl'],
    run: async (config, runId) => {
      const headers = buildHeaders(config.token);
      const url = buildUrl(config.avaBaseUrl, '/chat');
      const response = await requestJson('ava.chat', url, {
        method: 'POST',
        headers,
        body: {
          message: config.ava.message,
          context: { runId },
        },
        timeoutMs: config.timeoutMs,
      });
      return [response.sample];
    },
  },
];

const main = async () => {
  const config = buildConfig();
  const runId = `load-${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-')}`;

  const startedAt = new Date().toISOString();
  const samples: Sample[] = [];

  for (const scenario of scenarios) {
    if (config.skipScenarios.has(scenario.name)) {
      continue;
    }

    validateScenarioConfig(scenario, config);

    const scenarioKey = scenario.name.toUpperCase().replace(/\./g, '_');
    const totalIterations = parseIntEnv(`HW_LOAD_SCENARIO_${scenarioKey}_ITERATIONS`, config.iterations);
    const concurrency = parseIntEnv(`HW_LOAD_SCENARIO_${scenarioKey}_CONCURRENCY`, config.concurrency);

    const results = await runWithConcurrency(totalIterations, concurrency, async (index) => {
      return scenario.run(config, runId, index);
    });

    for (const batch of results) {
      samples.push(...batch);
    }
  }

  const finishedAt = new Date().toISOString();

  const byScenario: Record<string, Sample[]> = {};
  for (const sample of samples) {
    if (!byScenario[sample.name]) {
      byScenario[sample.name] = [];
    }
    byScenario[sample.name].push(sample);
  }

  const scenarioStats = Object.entries(byScenario)
    .map(([name, sampleList]) => summarize(name, sampleList))
    .sort((a, b) => a.name.localeCompare(b.name));

  const report: LoadReport = {
    runId,
    release: config.release,
    startedAt,
    finishedAt,
    config: {
      baseUrl: config.baseUrl,
      dataBaseUrl: config.dataBaseUrl,
      viewBaseUrl: config.viewBaseUrl,
      workflowBaseUrl: config.workflowBaseUrl,
      searchBaseUrl: config.searchBaseUrl,
      avaBaseUrl: config.avaBaseUrl,
      iterations: config.iterations,
      concurrency: config.concurrency,
      timeoutMs: config.timeoutMs,
      scenarios: scenarios.map((scenario) => {
        const scenarioKey = scenario.name.toUpperCase().replace(/\./g, '_');
        return {
          name: scenario.name,
          iterations: parseIntEnv(`HW_LOAD_SCENARIO_${scenarioKey}_ITERATIONS`, config.iterations),
          concurrency: parseIntEnv(`HW_LOAD_SCENARIO_${scenarioKey}_CONCURRENCY`, config.concurrency),
        };
      }),
    },
    scenarios: scenarioStats,
  };

  mkdirSync(config.outputDir, { recursive: true });
  const reportPath = join(config.outputDir, `${runId}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Load envelope report written to ${reportPath}`);

  const failed = report.scenarios.some((scenario) => scenario.errorCount > 0);
  if (failed) {
    console.error('Load envelope completed with errors.');
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

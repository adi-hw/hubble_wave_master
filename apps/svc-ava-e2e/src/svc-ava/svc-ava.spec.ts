import axios from 'axios';

const baseURL = process.env.AVA_BASE_URL || 'http://localhost:3004';

describe('svc-ava /api/health', () => {
  it('returns ok', async () => {
    const res = await axios.get('/api/health', { baseURL });
    expect(res.status).toBe(200);
    expect(['ok', 'degraded']).toContain(res.data.status);
    expect(res.data.service).toBe('svc-ava');
    expect(res.data.timestamp).toEqual(expect.any(String));
    expect(res.data.dependencies).toBeDefined();
    expect(res.data.dependencies.avaRuntime).toBeDefined();
    expect(['ok', 'unreachable']).toContain(res.data.dependencies.avaRuntime.status);
  });
});

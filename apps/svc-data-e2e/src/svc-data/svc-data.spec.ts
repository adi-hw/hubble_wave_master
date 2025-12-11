import axios from 'axios';

const baseURL = process.env.DATA_BASE_URL || 'http://localhost:3001';

describe('svc-data /api/health', () => {
  it('returns ok', async () => {
    const res = await axios.get('/api/health', { baseURL });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ status: 'ok', service: 'data' });
  });
});

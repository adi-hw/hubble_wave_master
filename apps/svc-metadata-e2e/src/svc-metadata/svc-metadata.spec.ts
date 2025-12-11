import axios from 'axios';

const baseURL = process.env.METADATA_BASE_URL || 'http://localhost:3333';

describe('svc-metadata /api/health', () => {
  it('returns ok', async () => {
    const res = await axios.get('/api/health', { baseURL });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ status: 'ok', service: 'metadata' });
  });
});

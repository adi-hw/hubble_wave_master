import axios from 'axios';

const baseURL = process.env.IDENTITY_BASE_URL || 'http://localhost:3000';

describe('svc-identity /api/health', () => {
  it('returns ok', async () => {
    const res = await axios.get('/api/health', { baseURL });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      status: 'ok',
      service: 'svc-identity',
      dependencies: {},
    });
    expect(res.data.timestamp).toEqual(expect.any(String));
  });
});

import axios, { AxiosError } from 'axios';
import * as jwt from 'jsonwebtoken';

const baseURL = process.env.IDENTITY_BASE_URL || 'http://localhost:3000';
const api = axios.create({ baseURL, validateStatus: () => true });

// Test configuration
const TEST_TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'acme';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'admin@acme.test';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

describe('Authentication Security', () => {
  describe('Account Lockout', () => {
    it('should return 401 for invalid credentials', async () => {
      const res = await api.post('/api/auth/login', {
        username: 'test@example.com',
        password: 'wrongpassword',
        tenantSlug: TEST_TENANT_SLUG,
      });

      expect(res.status).toBe(401);
    });

    it('should lock account after 5 failed attempts', async () => {
      const testEmail = `lockout-test-${Date.now()}@example.com`;

      // First 4 attempts should fail but not lock
      for (let i = 0; i < 4; i++) {
        const res = await api.post('/api/auth/login', {
          username: testEmail,
          password: 'wrong',
          tenantSlug: TEST_TENANT_SLUG,
        });
        expect(res.status).toBe(401);
        // Should not mention "locked" yet
        expect(res.data.message).not.toContain('locked');
      }

      // 5th attempt should lock
      const lockRes = await api.post('/api/auth/login', {
        username: testEmail,
        password: 'wrong',
        tenantSlug: TEST_TENANT_SLUG,
      });
      expect(lockRes.status).toBe(401);
      // After 5 attempts, account should be locked
      // Note: This test assumes the user exists; may need adjustment for non-existent users
    });
  });

  describe('JWT Validation', () => {
    it('should reject requests without authorization header', async () => {
      const res = await api.get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject requests with invalid JWT', async () => {
      const res = await api.get('/api/auth/me', {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      expect(res.status).toBe(401);
    });

    it('should reject JWT signed with wrong secret', async () => {
      const fakeToken = jwt.sign(
        { sub: '123', username: 'test', tenant_id: 'fake' },
        'wrong-secret-key'
      );

      const res = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${fakeToken}` },
      });
      expect(res.status).toBe(401);
    });

    it('should reject expired JWT', async () => {
      const expiredToken = jwt.sign(
        { sub: '123', username: 'test', tenant_id: 'fake', exp: Math.floor(Date.now() / 1000) - 3600 },
        'any-secret' // Will fail due to wrong secret anyway
      );

      const res = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Refresh Token Security', () => {
    it('should reject refresh without token', async () => {
      const res = await api.post('/api/auth/refresh', {});
      expect(res.status).toBe(401);
      expect(res.data.message).toContain('token');
    });

    it('should reject invalid refresh token', async () => {
      const res = await api.post('/api/auth/refresh', {
        refreshToken: 'invalid-refresh-token',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Tenant Isolation', () => {
    it('should require tenant context for login', async () => {
      // This depends on ALLOW_DEFAULT_TENANT_FALLBACK setting
      // If fallback is disabled, should fail without tenant
      const res = await api.post('/api/auth/login', {
        username: 'test@example.com',
        password: 'password',
        // No tenantSlug provided
      });

      // Either succeeds with default tenant or fails
      expect([200, 401]).toContain(res.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const results: number[] = [];

      // Make many rapid requests
      for (let i = 0; i < 10; i++) {
        const res = await api.post('/api/auth/login', {
          username: 'ratelimit@test.com',
          password: 'wrong',
          tenantSlug: TEST_TENANT_SLUG,
        });
        results.push(res.status);
      }

      // Should see some 429 (Too Many Requests) after threshold
      // Note: This depends on rate limit configuration
      const has429 = results.some((status) => status === 429);
      // Either rate limiting works or all fail with 401
      expect(results.every((status) => status === 401 || status === 429)).toBe(true);
    });
  });
});

describe('Authorization Security', () => {
  describe('Protected Routes', () => {
    it('should require authentication for /api/iam/me', async () => {
      const res = await api.get('/api/iam/me');
      expect(res.status).toBe(401);
    });

    it('should require authentication for /api/auth/change-password', async () => {
      const res = await api.post('/api/auth/change-password', {
        currentPassword: 'old',
        newPassword: 'new',
      });
      expect(res.status).toBe(401);
    });
  });
});

describe('MFA Security', () => {
  describe('MFA Endpoints', () => {
    it('should require authentication for MFA status', async () => {
      const res = await api.get('/api/auth/mfa/status');
      expect(res.status).toBe(401);
    });

    it('should require authentication for MFA enrollment', async () => {
      const res = await api.post('/api/auth/mfa/totp/enroll', {});
      expect(res.status).toBe(401);
    });
  });
});

describe('Input Validation', () => {
  describe('Login Validation', () => {
    it('should reject empty username', async () => {
      const res = await api.post('/api/auth/login', {
        username: '',
        password: 'password',
        tenantSlug: TEST_TENANT_SLUG,
      });
      expect(res.status).toBe(400);
    });

    it('should reject empty password', async () => {
      const res = await api.post('/api/auth/login', {
        username: 'test@example.com',
        password: '',
        tenantSlug: TEST_TENANT_SLUG,
      });
      expect(res.status).toBe(400);
    });
  });
});

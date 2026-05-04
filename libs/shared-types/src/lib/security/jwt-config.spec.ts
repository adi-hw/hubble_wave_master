import { assertJwtConfig, validateJwtConfig } from './jwt-config';

describe('validateJwtConfig', () => {
  describe('production (NODE_ENV=production)', () => {
    const baseProdEnv = {
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(64),
    };

    it('passes when JWT_AUDIENCE and JWT_ISSUER are set', () => {
      const result = validateJwtConfig({
        ...baseProdEnv,
        JWT_AUDIENCE: 'hubblewave-instance',
        JWT_ISSUER: 'hubblewave-identity',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('fails when JWT_AUDIENCE is missing', () => {
      const result = validateJwtConfig({
        ...baseProdEnv,
        JWT_ISSUER: 'hubblewave-identity',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('JWT_AUDIENCE'))).toBe(true);
    });

    it('fails when JWT_ISSUER is missing', () => {
      const result = validateJwtConfig({
        ...baseProdEnv,
        JWT_AUDIENCE: 'hubblewave-instance',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('JWT_ISSUER'))).toBe(true);
    });

    it('fails when JWT_SECRET is missing', () => {
      const result = validateJwtConfig({
        NODE_ENV: 'production',
        JWT_AUDIENCE: 'hubblewave-instance',
        JWT_ISSUER: 'hubblewave-identity',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
    });
  });

  describe('non-production (NODE_ENV=development)', () => {
    it('warns but does not fail when audience/issuer are missing', () => {
      const result = validateJwtConfig({
        NODE_ENV: 'development',
        JWT_SECRET: 'dev-secret-value',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings.some((w) => w.includes('JWT_AUDIENCE'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('JWT_ISSUER'))).toBe(true);
    });

    it('warns when JWT_SECRET is missing in non-prod', () => {
      const result = validateJwtConfig({ NODE_ENV: 'development' });
      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('JWT_SECRET'))).toBe(true);
    });

    it('treats unset NODE_ENV as non-production', () => {
      const result = validateJwtConfig({ JWT_SECRET: 'x'.repeat(32) });
      expect(result.isValid).toBe(true);
    });
  });

  describe('JWT_AUDIENCE_EXPECTED cross-service consistency', () => {
    it('passes when JWT_AUDIENCE matches JWT_AUDIENCE_EXPECTED', () => {
      const result = validateJwtConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(64),
        JWT_AUDIENCE: 'hubblewave-instance',
        JWT_ISSUER: 'hubblewave-identity',
        JWT_AUDIENCE_EXPECTED: 'hubblewave-instance',
      });
      expect(result.isValid).toBe(true);
    });

    it('fails on mismatch in production', () => {
      const result = validateJwtConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(64),
        JWT_AUDIENCE: 'foo',
        JWT_ISSUER: 'hubblewave-identity',
        JWT_AUDIENCE_EXPECTED: 'bar',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('JWT_AUDIENCE_EXPECTED'))).toBe(true);
    });

    it('fails on mismatch in non-production too', () => {
      const result = validateJwtConfig({
        NODE_ENV: 'development',
        JWT_SECRET: 'dev-secret',
        JWT_AUDIENCE: 'foo',
        JWT_AUDIENCE_EXPECTED: 'bar',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('JWT_AUDIENCE_EXPECTED'))).toBe(true);
    });

    it('does not check expected when audience is unset (other check covers it)', () => {
      const result = validateJwtConfig({
        NODE_ENV: 'development',
        JWT_SECRET: 'dev-secret',
        JWT_AUDIENCE_EXPECTED: 'bar',
      });
      // Mismatch error not raised because audience is undefined; the audience
      // warning still surfaces so the operator sees the missing value.
      expect(result.errors.some((e) => e.includes('JWT_AUDIENCE_EXPECTED'))).toBe(false);
    });
  });
});

describe('assertJwtConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('throws in production with missing audience', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(64);
    process.env.JWT_ISSUER = 'hubblewave-identity';
    delete process.env.JWT_AUDIENCE;
    delete process.env.JWT_AUDIENCE_EXPECTED;

    expect(() => assertJwtConfig()).toThrow(/JWT configuration validation failed/);
  });

  it('does not throw in non-prod with missing audience', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'dev-secret-value';
    delete process.env.JWT_AUDIENCE;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE_EXPECTED;

    expect(() => assertJwtConfig()).not.toThrow();
  });

  it('throws on JWT_AUDIENCE_EXPECTED mismatch even outside production', () => {
    process.env.NODE_ENV = 'staging';
    process.env.JWT_SECRET = 'staging-secret';
    process.env.JWT_AUDIENCE = 'foo';
    process.env.JWT_ISSUER = 'hubblewave-identity';
    process.env.JWT_AUDIENCE_EXPECTED = 'bar';

    expect(() => assertJwtConfig()).toThrow(/JWT configuration validation failed/);
  });
});

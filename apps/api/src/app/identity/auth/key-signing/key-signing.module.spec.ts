import { KEY_SIGNING_SERVICE } from '@hubblewave/auth-guard';
import { KeySigningModule } from './key-signing.module';
import { LocalEs256KeySigningService } from './local-es256.key-signing.service';
import { AwsKmsEs256KeySigningService } from './aws-kms-es256.key-signing.service';

/**
 * The factory's job is to enforce canon §29.9's hard guards at module
 * construction time. These tests intentionally avoid `Test.createTestingModule`
 * because they're exercising the factory's THROW behaviour — the module
 * graph would never be built when the guard fires.
 *
 * Mutating process.env inside tests is normally a code smell; here we
 * have no other way to exercise the production guard because that's
 * literally what it gates on.
 */

const KEY_ENV = ['NODE_ENV', 'JWT_KEY_PROVIDER', 'JWT_BOOTSTRAP_SECRET'] as const;
type EnvKey = (typeof KEY_ENV)[number];

describe('KeySigningModule.forRoot — canon §29.9 production guard', () => {
  const saved: Partial<Record<EnvKey, string | undefined>> = {};

  beforeEach(() => {
    for (const k of KEY_ENV) saved[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of KEY_ENV) {
      if (saved[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = saved[k];
      }
    }
  });

  it('throws when NODE_ENV=production and provider is local-es256', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['JWT_KEY_PROVIDER'] = 'local-es256';
    expect(() => KeySigningModule.forRoot()).toThrow(/aws-kms/);
  });

  it('throws when NODE_ENV=production and provider is unset', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['JWT_KEY_PROVIDER'];
    expect(() => KeySigningModule.forRoot()).toThrow(/aws-kms/);
  });

  it('throws when NODE_ENV=production and JWT_BOOTSTRAP_SECRET is set (even with aws-kms provider)', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['JWT_KEY_PROVIDER'] = 'aws-kms';
    process.env['JWT_BOOTSTRAP_SECRET'] = 'should-not-be-here';
    expect(() => KeySigningModule.forRoot()).toThrow(/JWT_BOOTSTRAP_SECRET/);
  });

  it('returns aws-kms module when NODE_ENV=production and provider is aws-kms', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['JWT_KEY_PROVIDER'] = 'aws-kms';
    delete process.env['JWT_BOOTSTRAP_SECRET'];
    const m = KeySigningModule.forRoot();
    expect(m.module).toBe(KeySigningModule);
    expect(m.providers).toEqual(
      expect.arrayContaining([
        AwsKmsEs256KeySigningService,
        expect.objectContaining({
          provide: KEY_SIGNING_SERVICE,
          useExisting: AwsKmsEs256KeySigningService,
        }),
      ]),
    );
  });

  it('defaults to local-es256 when NODE_ENV=development and provider unset', () => {
    process.env['NODE_ENV'] = 'development';
    delete process.env['JWT_KEY_PROVIDER'];
    const m = KeySigningModule.forRoot();
    expect(m.providers).toEqual(
      expect.arrayContaining([
        LocalEs256KeySigningService,
        expect.objectContaining({
          provide: KEY_SIGNING_SERVICE,
          useExisting: LocalEs256KeySigningService,
        }),
      ]),
    );
  });

  it('honours local-es256 explicitly in test environment', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['JWT_KEY_PROVIDER'] = 'local-es256';
    const m = KeySigningModule.forRoot();
    expect(m.providers).toEqual(
      expect.arrayContaining([LocalEs256KeySigningService]),
    );
  });

  it('honours aws-kms in development (operator can opt in)', () => {
    process.env['NODE_ENV'] = 'development';
    process.env['JWT_KEY_PROVIDER'] = 'aws-kms';
    const m = KeySigningModule.forRoot();
    expect(m.providers).toEqual(
      expect.arrayContaining([AwsKmsEs256KeySigningService]),
    );
  });
});

import { ConflictException } from '@nestjs/common';
import { MAINTENANCE_MODE_FLAG_KEY, MAINTENANCE_MODE_TTL_SECONDS } from '@hubblewave/auth-guard';
import { PacksService } from './packs.service';

/**
 * Focused spec for the W4.D maintenance-mode integration.
 *
 * The full PacksService.installPack / rollbackPack paths involve dozens of
 * collaborators (TypeORM repos, ingest services, the artifact loader). For
 * W4.D we only need to prove that the Redis maintenance-mode flag is set
 * before the work and cleared in finally{} regardless of outcome — those
 * are the only behaviors the global MaintenanceModeInterceptor depends on.
 *
 * We exercise that contract by stubbing every collaborator with `any` typing
 * so we can poke the prototype's private members.
 */
describe('PacksService maintenance-mode flag', () => {
  type RedisStub = { set: jest.Mock; del: jest.Mock };

  function buildService(redis: RedisStub) {
    const service: any = Object.create(PacksService.prototype);
    service.redis = redis;
    service.logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
    return service;
  }

  describe('setMaintenanceFlag / clearMaintenanceFlag', () => {
    it('sets the Redis flag with the documented key and TTL', async () => {
      const redis: RedisStub = {
        set: jest.fn().mockResolvedValue(true),
        del: jest.fn().mockResolvedValue(true),
      };
      const service = buildService(redis);

      await service.setMaintenanceFlag();

      expect(redis.set).toHaveBeenCalledWith(
        MAINTENANCE_MODE_FLAG_KEY,
        '1',
        MAINTENANCE_MODE_TTL_SECONDS,
      );
    });

    it('clears the Redis flag using DEL on the documented key', async () => {
      const redis: RedisStub = {
        set: jest.fn().mockResolvedValue(true),
        del: jest.fn().mockResolvedValue(true),
      };
      const service = buildService(redis);

      await service.clearMaintenanceFlag();

      expect(redis.del).toHaveBeenCalledWith(MAINTENANCE_MODE_FLAG_KEY);
    });

    it('warns and proceeds when Redis SET fails so the install is not aborted by a Redis outage', async () => {
      const redis: RedisStub = {
        set: jest.fn().mockResolvedValue(false),
        del: jest.fn().mockResolvedValue(true),
      };
      const service = buildService(redis);

      await expect(service.setMaintenanceFlag()).resolves.toBeUndefined();
      expect(service.logger.warn).toHaveBeenCalled();
    });

    it('warns when Redis DEL fails — TTL is the backstop', async () => {
      const redis: RedisStub = {
        set: jest.fn().mockResolvedValue(true),
        del: jest.fn().mockResolvedValue(false),
      };
      const service = buildService(redis);

      await expect(service.clearMaintenanceFlag()).resolves.toBeUndefined();
      expect(service.logger.warn).toHaveBeenCalled();
    });
  });

  describe('installPack', () => {
    it('sets the flag before the work and clears it in finally{}, even when install throws', async () => {
      const callOrder: string[] = [];
      const redis: RedisStub = {
        set: jest.fn().mockImplementation(async () => {
          callOrder.push('set');
          return true;
        }),
        del: jest.fn().mockImplementation(async () => {
          callOrder.push('del');
          return true;
        }),
      };
      const service = buildService(redis);

      service.loadArtifact = jest.fn().mockResolvedValue({
        manifest: {
          pack: { code: 'p', release_id: '20260101.1' },
          install: { lock_key: 'lk', apply_order: [] },
          assets: [],
          compatibility: { platform: '*' },
          dependencies: [],
        },
        checksums: new Map(),
        signature: 'sig',
        artifactSha256: 'sha',
        files: new Map(),
      });
      service.assertManifestMatches = jest.fn();
      service.assertCompatibility = jest.fn();
      service.assertDependencies = jest.fn().mockResolvedValue(undefined);
      service.acquireLock = jest.fn().mockImplementation(async () => {
        callOrder.push('acquireLock');
      });
      service.releaseLock = jest.fn().mockImplementation(async () => {
        callOrder.push('releaseLock');
      });

      const installError = new Error('synthetic install failure');
      service.releaseRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockRejectedValue(installError),
        create: jest.fn().mockReturnValue({}),
      };

      await expect(
        service.installPack(
          { packCode: 'p', releaseId: '20260101.1', manifest: {}, artifactUrl: 'u' },
        ),
      ).rejects.toBe(installError);

      // The flag MUST be set after acquireLock (so a failed acquireLock does
      // not leak a stuck flag) and cleared in finally{} BEFORE releaseLock.
      expect(callOrder).toEqual(['acquireLock', 'set', 'del', 'releaseLock']);
      expect(redis.set).toHaveBeenCalledWith(
        MAINTENANCE_MODE_FLAG_KEY,
        '1',
        MAINTENANCE_MODE_TTL_SECONDS,
      );
      expect(redis.del).toHaveBeenCalledWith(MAINTENANCE_MODE_FLAG_KEY);
    });
  });

  describe('rollbackPack', () => {
    it('sets and clears the flag, even when rollback throws', async () => {
      const callOrder: string[] = [];
      const redis: RedisStub = {
        set: jest.fn().mockImplementation(async () => {
          callOrder.push('set');
          return true;
        }),
        del: jest.fn().mockImplementation(async () => {
          callOrder.push('del');
          return true;
        }),
      };
      const service = buildService(redis);

      const target = {
        id: 't1',
        status: 'applied',
        packCode: 'p',
        packReleaseId: '20260101.1',
        manifest: {
          pack: { code: 'p', release_id: '20260101.1' },
          install: { lock_key: 'lk' },
        },
        artifactSha256: 'sha',
      };
      service.resolveRollbackTarget = jest.fn().mockResolvedValue(target);
      service.resolveLockKey = jest.fn().mockReturnValue('lk');
      service.acquireLock = jest.fn().mockImplementation(async () => {
        callOrder.push('acquireLock');
      });
      service.releaseLock = jest.fn().mockImplementation(async () => {
        callOrder.push('releaseLock');
      });

      const rollbackError = new Error('synthetic rollback failure');
      service.releaseRepo = {
        save: jest.fn().mockRejectedValue(rollbackError),
        create: jest.fn().mockReturnValue({}),
      };

      await expect(
        service.rollbackPack({ packCode: 'p', releaseId: '20260101.1' }),
      ).rejects.toBe(rollbackError);

      expect(callOrder).toEqual(['acquireLock', 'set', 'del', 'releaseLock']);
    });

    it('refuses to set the flag if the target release was never applied', async () => {
      const redis: RedisStub = {
        set: jest.fn().mockResolvedValue(true),
        del: jest.fn().mockResolvedValue(true),
      };
      const service = buildService(redis);
      service.resolveRollbackTarget = jest.fn().mockResolvedValue({ status: 'failed' });

      await expect(
        service.rollbackPack({ packCode: 'p', releaseId: '20260101.1' }),
      ).rejects.toBeInstanceOf(ConflictException);

      // No flag mutation if we never started the rollback.
      expect(redis.set).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});

/**
 * F125 (W1 task 6) regression — the loadArtifact() pack-download path
 * fetched caller-supplied URLs with no SSRF guard. Before this fix, an
 * authenticated install request with `artifactUrl: 'http://169.254.169.254/...'`
 * would hit cloud-metadata; with `'http://10.0.0.1/...'`, internal
 * services. The fix wires validateOutboundUrl() before the fetch.
 *
 * This spec exercises the private loadArtifact() via prototype-stub
 * (matching the W4.D pattern at the top of this file). The fetch is
 * mocked at the global level so we can assert it is NEVER invoked when
 * the URL fails validation.
 */
describe('PacksService.loadArtifact — F125 SSRF guard', () => {
  function buildLoadArtifactService() {
    const service: any = Object.create(PacksService.prototype);
    service.logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
    // getDownloadTimeoutMs is referenced after the validation check.
    // Stub so the test doesn't depend on a real config.
    service.getDownloadTimeoutMs = jest.fn().mockReturnValue(10_000);
    return service;
  }

  let originalFetch: typeof globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const SSRF_ATTACK_URLS: ReadonlyArray<{ url: string; label: string }> = [
    { url: 'http://169.254.169.254/latest/meta-data', label: 'AWS metadata link-local' },
    { url: 'https://169.254.169.254/latest/meta-data', label: 'AWS metadata over HTTPS (also blocked)' },
    { url: 'http://127.0.0.1:8080/admin', label: 'IPv4 loopback' },
    { url: 'http://10.0.0.1/internal', label: 'RFC1918 10.0.0.0/8' },
    { url: 'http://172.16.0.1/internal', label: 'RFC1918 172.16.0.0/12' },
    { url: 'http://192.168.1.1/internal', label: 'RFC1918 192.168.0.0/16' },
    { url: 'http://[::1]/admin', label: 'IPv6 loopback' },
    { url: 'http://[fc00::1]/admin', label: 'IPv6 ULA' },
    { url: 'file:///etc/passwd', label: 'file:// scheme' },
    { url: 'ftp://example.com/x', label: 'ftp:// scheme' },
    { url: 'gopher://example.com/x', label: 'gopher:// scheme' },
    { url: 'not a url', label: 'malformed input' },
  ];

  for (const { url, label } of SSRF_ATTACK_URLS) {
    it(`rejects ${label} (${url})`, async () => {
      const service = buildLoadArtifactService();

      await expect(service.loadArtifact(url)).rejects.toThrow(/F125/);
      // Critical: the underlying fetch MUST NOT be invoked. A
      // regression that just wraps the existing error would still let
      // the request out.
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it('rejects empty / non-string artifactUrl', async () => {
    const service = buildLoadArtifactService();
    await expect(service.loadArtifact('')).rejects.toThrow(/required/);
    await expect(service.loadArtifact(undefined as unknown as string)).rejects.toThrow(/required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes a public HTTPS URL to fetch (control case)', async () => {
    const service = buildLoadArtifactService();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    // We don't care about the return value here; the assertion is
    // that validateOutboundUrl DID NOT throw, so fetch was reached.
    await expect(
      service.loadArtifact('https://packs.example.com/pack-1.0.zip'),
    ).rejects.toThrow(/Failed to download/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchArgs = fetchMock.mock.calls[0];
    expect(fetchArgs[0]).toBe('https://packs.example.com/pack-1.0.zip');
    // F125 hardening: redirect: 'error' so a 302 to a private IP can't
    // sneak past the host validation.
    expect(fetchArgs[1]).toMatchObject({ redirect: 'error' });
  });
});

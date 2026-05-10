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

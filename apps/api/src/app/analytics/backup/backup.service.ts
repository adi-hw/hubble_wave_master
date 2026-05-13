import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { spawn } from 'child_process';
import { AuditLog, RuntimeAnomalyService } from '@hubblewave/instance-db';
import { RedisService } from '@hubblewave/redis';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import {
  STORAGE_CONFIG,
  StorageClient,
  StorageConfig,
  TENANT_SCOPED_STORAGE_CLIENT,
} from '@hubblewave/storage';
import {
  createTypesenseClient,
  loadTypesenseConfig,
} from '@hubblewave/search-typesense';
import { BackupArtifact, BackupSummary, RestoreSummary } from './backup.types';

const BACKUP_LOCK_KEY_PREFIX = 'backup:running:';
const BACKUP_LOCK_TTL_SECONDS = 2 * 60 * 60;
const SECRET_PATTERN = /(PGPASSWORD|password|api[_-]?key|token|secret|auth(?:orization)?)\s*[:=]\s*[^\s,;}]+/gi;

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly bucketName: string;
  private readonly cronSchedule: string;
  private readonly dumpTimeoutMs: number;
  private readonly restoreTimeoutMs: number;
  private readonly instanceLockId: string;
  private readonly signingKey: string | null;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @Inject(TENANT_SCOPED_STORAGE_CLIENT)
    private readonly storageClient: StorageClient,
    @Inject(STORAGE_CONFIG)
    private readonly storageConfig: StorageConfig,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly redisService: RedisService,
    private readonly runtimeAnomalyService: RuntimeAnomalyService,
  ) {
    this.bucketName = this.storageConfig.buckets.backups;
    this.cronSchedule = this.configService.get<string>('BACKUP_CRON') || '0 2 * * *';
    this.dumpTimeoutMs = parseInt(
      this.configService.get<string>('BACKUP_PG_DUMP_TIMEOUT_MS') || '900000',
      10,
    );
    this.restoreTimeoutMs = parseInt(
      this.configService.get<string>('BACKUP_PG_RESTORE_TIMEOUT_MS') || '900000',
      10,
    );
    this.instanceLockId =
      this.configService.get<string>('INSTANCE_ID')
      || this.configService.get<string>('INSTANCE_NAME')
      || 'default';
    this.signingKey = this.configService.get<string>('BACKUP_SIGNING_KEY') || null;
    if (!this.signingKey) {
      this.logger.error(
        'BACKUP_SIGNING_KEY is not configured; backups will not be signed and restores will fail. ' +
        'Set BACKUP_SIGNING_KEY to a 32+ byte secret rotated per SECRETS_ROTATION.md.',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    await this.storageClient.ensureBucket(this.bucketName);
    if (this.schedulerRegistry.doesExist('cron', 'instance-backup')) {
      this.schedulerRegistry.deleteCronJob('instance-backup');
    }
    const job = new CronJob(this.cronSchedule, () => {
      void this.runBackup('scheduled').catch((error) => {
        this.logger.error(`Scheduled backup failed: ${(error as Error).message}`);
      });
    });
    this.schedulerRegistry.addCronJob('instance-backup', job);
    job.start();
  }

  async runBackup(triggeredBy: 'scheduled' | 'manual', actorId?: string): Promise<BackupSummary> {
    if (await this.isLockHeld('restore')) {
      throw new BadRequestException('Restore in progress, backup is temporarily disabled');
    }
    if (!this.signingKey) {
      throw new BadRequestException('BACKUP_SIGNING_KEY is not configured; refusing to run backup');
    }

    const lockToken = randomUUID();
    const acquired = await this.acquireLock('backup', lockToken);
    if (!acquired) {
      throw new BadRequestException('Backup already running');
    }

    const backupId = randomUUID();
    const startedAt = new Date();
    const prefix = this.buildPrefix(startedAt, backupId);

    try {
      const postgresArtifact = await this.backupPostgres(prefix);
      const typesenseArtifacts = await this.backupTypesense(prefix);

      const manifestPayload = {
        backupId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        postgres: postgresArtifact,
        typesense: typesenseArtifacts,
        triggeredBy,
      };

      const manifestKey = `${prefix}/manifest.json`;
      const manifestBuffer = Buffer.from(JSON.stringify(manifestPayload, null, 2), 'utf8');
      const manifestChecksum = this.sha256(manifestBuffer);

      await this.storageClient.putObject({
        bucket: this.bucketName,
        key: manifestKey,
        body: manifestBuffer,
        contentType: 'application/json',
      });

      // Co-locate an HMAC alongside the manifest so restore can detect
      // tampering or accidental edits. The signing key never leaves the
      // service and must be rotated per SECRETS_ROTATION.md.
      const manifestSig = this.signBuffer(manifestBuffer);
      await this.storageClient.putObject({
        bucket: this.bucketName,
        key: `${manifestKey}.sig`,
        body: Buffer.from(manifestSig, 'utf8'),
        contentType: 'text/plain',
      });

      const manifestArtifact: BackupArtifact = {
        key: manifestKey,
        checksum: manifestChecksum,
        sizeBytes: manifestBuffer.length,
        contentType: 'application/json',
      };

      await this.logAudit(backupId, actorId, {
        backupId,
        triggeredBy,
        postgres: postgresArtifact,
        typesense: typesenseArtifacts,
        manifest: manifestArtifact,
      });

      return {
        backupId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        postgres: postgresArtifact,
        typesense: typesenseArtifacts,
        manifest: manifestArtifact,
      };
    } finally {
      await this.releaseLock('backup', lockToken);
    }
  }

  async restoreBackup(backupId: string, actorId?: string): Promise<RestoreSummary> {
    if (!backupId || !backupId.trim()) {
      throw new BadRequestException('backupId is required');
    }
    if (!this.signingKey) {
      throw new BadRequestException('BACKUP_SIGNING_KEY is not configured; refusing to run restore');
    }
    if (await this.isLockHeld('backup')) {
      throw new BadRequestException('Backup in progress, restore is temporarily disabled');
    }

    const lockToken = randomUUID();
    const acquired = await this.acquireLock('restore', lockToken);
    if (!acquired) {
      throw new BadRequestException('Restore already running');
    }

    const startedAt = new Date();
    try {
      const { manifest, manifestBuffer, manifestKey } = await this.findManifest(backupId.trim());
      const postgresArtifact = manifest.postgres as BackupArtifact | undefined;
      const typesenseArtifacts = Array.isArray(manifest.typesense)
        ? (manifest.typesense as BackupArtifact[])
        : [];
      if (!postgresArtifact) {
        throw new BadRequestException('Backup manifest missing postgres artifact');
      }

      await this.restorePostgres(postgresArtifact);
      await this.restoreTypesense(typesenseArtifacts);

      const postgresOk = await this.validatePostgres();
      const typesenseOk = await this.validateTypesense(typesenseArtifacts);

      await this.logAudit(backupId, actorId, {
        backupId,
        action: 'restore',
        manifestKey,
        validation: { postgresOk, typesenseOk },
      });

      const manifestArtifact: BackupArtifact = {
        key: manifestKey,
        checksum: this.sha256(manifestBuffer),
        sizeBytes: manifestBuffer.length,
        contentType: 'application/json',
      };

      return {
        backupId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        postgres: postgresArtifact,
        typesense: typesenseArtifacts,
        manifest: manifestArtifact,
        validation: { postgresOk, typesenseOk },
      };
    } finally {
      await this.releaseLock('restore', lockToken);
    }
  }

  private buildPrefix(startedAt: Date, backupId: string): string {
    const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
    return `backups/${stamp}-${backupId}`;
  }

  private async backupPostgres(prefix: string): Promise<BackupArtifact> {
    const options = this.dataSource.options as {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
    };
    if (!options.host || !options.port || !options.username || !options.database) {
      throw new BadRequestException('Database connection is not configured for backup');
    }

    const pgOptions = {
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password,
      database: options.database,
    };

    const dumpBuffer = await this.runPgDump(pgOptions);
    const checksum = this.sha256(dumpBuffer);
    const key = `${prefix}/postgres/instance.dump`;

    await this.storageClient.putObject({
      bucket: this.bucketName,
      key,
      body: dumpBuffer,
      contentType: 'application/octet-stream',
      metadata: {
        checksum,
        db: options.database,
      },
    });

    return {
      key,
      checksum,
      sizeBytes: dumpBuffer.length,
      contentType: 'application/octet-stream',
    };
  }

  private async runPgDump(options: {
    host: string;
    port: number;
    username: string;
    password?: string;
    database: string;
  }): Promise<Buffer> {
    const args = [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--host',
      options.host,
      '--port',
      String(options.port),
      '--username',
      options.username,
      '--dbname',
      options.database,
    ];

    const env = {
      ...process.env,
      PGPASSWORD: options.password || '',
    };

    return this.spawnToBuffer('pg_dump', args, env, this.dumpTimeoutMs);
  }

  private async backupTypesense(prefix: string): Promise<BackupArtifact[]> {
    const config = loadTypesenseConfig(process.env);
    const client = createTypesenseClient(config);
    const collections = await client.collections().retrieve();
    if (!Array.isArray(collections)) {
      throw new BadRequestException('Typesense collections response invalid');
    }

    const schemaKey = `${prefix}/typesense/collections.json`;
    const schemaBuffer = Buffer.from(JSON.stringify(collections, null, 2), 'utf8');
    await this.storageClient.putObject({
      bucket: this.bucketName,
      key: schemaKey,
      body: schemaBuffer,
      contentType: 'application/json',
    });
    // Sign the schema dump for the same reason we sign the manifest: restore
    // executes JSON.parse on this content, so an unsigned file is a tampering
    // vector.
    await this.storageClient.putObject({
      bucket: this.bucketName,
      key: `${schemaKey}.sig`,
      body: Buffer.from(this.signBuffer(schemaBuffer), 'utf8'),
      contentType: 'text/plain',
    });

    const artifacts: BackupArtifact[] = [
      {
        key: schemaKey,
        checksum: this.sha256(schemaBuffer),
        sizeBytes: schemaBuffer.length,
        contentType: 'application/json',
      },
    ];

    for (const collection of collections) {
      const name = (collection as { name?: string }).name;
      if (!name) {
        this.logger.warn('Typesense collection missing name field; skipping export');
        await this.runtimeAnomalyService.record({
          kind: 'typesense_collection_name_missing',
          serviceCode: 'svc-backup',
          message: 'Typesense collection missing name field during backup; collection skipped',
          context: { prefix, collection },
        });
        continue;
      }
      const exportPayload = await client.collections(name).documents().export();
      const exportBuffer = Buffer.from(exportPayload, 'utf8');
      const exportKey = `${prefix}/typesense/${name}.jsonl`;
      await this.storageClient.putObject({
        bucket: this.bucketName,
        key: exportKey,
        body: exportBuffer,
        contentType: 'application/x-ndjson',
      });
      artifacts.push({
        key: exportKey,
        checksum: this.sha256(exportBuffer),
        sizeBytes: exportBuffer.length,
        contentType: 'application/x-ndjson',
      });
    }

    return artifacts;
  }

  private async restorePostgres(artifact: BackupArtifact): Promise<void> {
    const options = this.dataSource.options as {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
    };
    if (!options.host || !options.port || !options.username || !options.database) {
      throw new BadRequestException('Database connection is not configured for restore');
    }

    const dumpBuffer = await this.storageClient.getObject({
      bucket: this.bucketName,
      key: artifact.key,
    });
    const checksum = this.sha256(dumpBuffer);
    if (checksum !== artifact.checksum) {
      throw new BadRequestException('Postgres backup checksum mismatch');
    }

    const args = [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '--host',
      options.host,
      '--port',
      String(options.port),
      '--username',
      options.username,
      '--dbname',
      options.database,
    ];

    const env = {
      ...process.env,
      PGPASSWORD: options.password || '',
    };

    await this.spawnWithInput('pg_restore', args, env, this.restoreTimeoutMs, dumpBuffer);
  }

  private async restoreTypesense(artifacts: BackupArtifact[]): Promise<void> {
    const config = loadTypesenseConfig(process.env);
    const client = createTypesenseClient(config);
    const schemaArtifact = artifacts.find((item) => item.key.endsWith('/typesense/collections.json'));
    if (!schemaArtifact) {
      throw new BadRequestException('Typesense schema backup not found');
    }

    const schemaBuffer = await this.storageClient.getObject({
      bucket: this.bucketName,
      key: schemaArtifact.key,
    });
    const schemaChecksum = this.sha256(schemaBuffer);
    if (schemaChecksum !== schemaArtifact.checksum) {
      throw new BadRequestException('Typesense schema checksum mismatch');
    }
    // Verify the HMAC before JSON.parse so a tampered schema cannot influence
    // collection creation. The signature is a sibling object next to the JSON.
    await this.verifyTypesenseSchemaSignature(schemaArtifact.key, schemaBuffer);

    const schemas = JSON.parse(schemaBuffer.toString('utf8')) as Array<Record<string, unknown>>;
    const existing = await client.collections().retrieve();
    if (Array.isArray(existing)) {
      for (const collection of existing) {
        const name = (collection as { name?: string }).name;
        if (name) {
          await client.collections(name).delete();
        }
      }
    }

    for (const schema of schemas) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.collections().create(schema as any);
    }

    for (const artifact of artifacts) {
      if (!artifact.key.endsWith('.jsonl')) {
        continue;
      }
      const jsonl = await this.storageClient.getObject({
        bucket: this.bucketName,
        key: artifact.key,
      });
      const checksum = this.sha256(jsonl);
      if (checksum !== artifact.checksum) {
        throw new BadRequestException(`Typesense backup checksum mismatch for ${artifact.key}`);
      }
      const name = artifact.key.split('/').pop()?.replace('.jsonl', '');
      if (!name) {
        this.logger.warn(`Typesense artifact key yielded empty collection name during restore; skipping: ${artifact.key}`);
        await this.runtimeAnomalyService.record({
          kind: 'typesense_artifact_name_missing',
          serviceCode: 'svc-backup',
          message: `Typesense artifact key yielded empty collection name during restore; skipping: ${artifact.key}`,
          context: { artifactKey: artifact.key },
        });
        continue;
      }
      await client.collections(name).documents().import(jsonl.toString('utf8'), { action: 'upsert' });
    }
  }

  private async validatePostgres(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async validateTypesense(artifacts: BackupArtifact[]): Promise<boolean> {
    try {
      const config = loadTypesenseConfig(process.env);
      const client = createTypesenseClient(config);
      const collections = await client.collections().retrieve();
      if (!Array.isArray(collections)) {
        return false;
      }
      const expected = artifacts.filter((item) => item.key.endsWith('.jsonl')).length;
      return collections.length >= expected;
    } catch {
      return false;
    }
  }

  private async findManifest(backupId: string): Promise<{
    manifest: Record<string, unknown>;
    manifestBuffer: Buffer;
    manifestKey: string;
  }> {
    const keys = await this.storageClient.listObjects({
      bucket: this.bucketName,
      prefix: 'backups/',
    });
    const manifestKeys = keys.filter((key) => key.endsWith('/manifest.json'));
    for (const key of manifestKeys) {
      const buffer = await this.storageClient.getObject({ bucket: this.bucketName, key });
      // Verify the HMAC signature before parsing. An attacker who can write to
      // the bucket but does not hold BACKUP_SIGNING_KEY cannot forge a valid
      // manifest, and accidental edits surface as a clear failure rather than
      // a silently corrupted restore.
      await this.verifyManifestSignature(key, buffer);
      const parsed = JSON.parse(buffer.toString('utf8')) as Record<string, unknown>;
      if (parsed.backupId === backupId) {
        return { manifest: parsed, manifestBuffer: buffer, manifestKey: key };
      }
    }
    throw new BadRequestException('Backup manifest not found');
  }

  private async verifyManifestSignature(manifestKey: string, manifestBuffer: Buffer): Promise<void> {
    const sigKey = `${manifestKey}.sig`;
    let sigBuffer: Buffer;
    try {
      sigBuffer = await this.storageClient.getObject({ bucket: this.bucketName, key: sigKey });
    } catch {
      throw new BadRequestException(`Backup manifest signature missing: ${sigKey}`);
    }
    const expected = this.signBuffer(manifestBuffer);
    const provided = sigBuffer.toString('utf8').trim();
    if (!this.timingSafeStringEqual(provided, expected)) {
      throw new BadRequestException(`Backup manifest signature mismatch: ${sigKey}`);
    }
  }

  private signBuffer(buffer: Buffer): string {
    if (!this.signingKey) {
      throw new BadRequestException('BACKUP_SIGNING_KEY is not configured');
    }
    return createHmac('sha256', this.signingKey).update(buffer).digest('hex');
  }

  private timingSafeStringEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  }

  private async verifyTypesenseSchemaSignature(schemaKey: string, schemaBuffer: Buffer): Promise<void> {
    const sigKey = `${schemaKey}.sig`;
    let sigBuffer: Buffer;
    try {
      sigBuffer = await this.storageClient.getObject({ bucket: this.bucketName, key: sigKey });
    } catch {
      throw new BadRequestException(`Typesense schema signature missing: ${sigKey}`);
    }
    const expected = this.signBuffer(schemaBuffer);
    const provided = sigBuffer.toString('utf8').trim();
    if (!this.timingSafeStringEqual(provided, expected)) {
      throw new BadRequestException(`Typesense schema signature mismatch: ${sigKey}`);
    }
  }

  /**
   * Strip credential-like patterns from spawn stderr before logging or
   * re-throwing. pg_dump/pg_restore embed PGPASSWORD into env warnings on
   * some platforms, and rejecting them verbatim leaks the secret into our
   * audit trail.
   */
  private redactStderr(raw: string): string {
    return raw.replace(SECRET_PATTERN, (_match, key) => `${key}=[REDACTED]`);
  }

  private async spawnToBuffer(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    timeoutMs: number,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { env });
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`${command} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      child.stderr.on('data', (chunk) => errChunks.push(Buffer.from(chunk)));

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(this.redactStderr(error.message)));
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          const details = this.redactStderr(Buffer.concat(errChunks).toString('utf8').trim());
          reject(new Error(details || `${command} failed with exit code ${code}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
  }

  private async spawnWithInput(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    timeoutMs: number,
    input: Buffer,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { env });
      const errChunks: Buffer[] = [];
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`${command} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stderr.on('data', (chunk) => errChunks.push(Buffer.from(chunk)));
      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(this.redactStderr(error.message)));
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          const details = this.redactStderr(Buffer.concat(errChunks).toString('utf8').trim());
          reject(new Error(details || `${command} failed with exit code ${code}`));
          return;
        }
        resolve();
      });

      child.stdin.write(input);
      child.stdin.end();
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Distributed locking — Redis-backed so concurrent backup or restore
  // attempts across pods cannot corrupt state.
  // ─────────────────────────────────────────────────────────────────

  private lockKey(operation: 'backup' | 'restore'): string {
    return `${BACKUP_LOCK_KEY_PREFIX}${this.instanceLockId}:${operation}`;
  }

  private async acquireLock(operation: 'backup' | 'restore', token: string): Promise<boolean> {
    const client = this.redisService.getClient();
    const result = await client.set(
      this.lockKey(operation),
      token,
      'EX',
      BACKUP_LOCK_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  private async releaseLock(operation: 'backup' | 'restore', token: string): Promise<void> {
    const client = this.redisService.getClient();
    // Only release if we still own the lock — another caller may have taken
    // over after our TTL expired.
    const lua =
      'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';
    try {
      await client.eval(lua, 1, this.lockKey(operation), token);
    } catch (error) {
      this.logger.warn(`Failed to release ${operation} lock: ${(error as Error).message}`);
      await this.runtimeAnomalyService.record({
        kind: 'backup_lock_release_failed',
        serviceCode: 'svc-backup',
        message: `Failed to release ${operation} lock ${this.lockKey(operation)}: ${(error as Error).message}`,
        context: { operation, lockKey: this.lockKey(operation) },
        error: error as Error,
      });
    }
  }

  private async isLockHeld(operation: 'backup' | 'restore'): Promise<boolean> {
    const client = this.redisService.getClient();
    const value = await client.get(this.lockKey(operation));
    return !!value;
  }

  private sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async logAudit(
    backupId: string,
    actorId: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const log = this.auditRepo.create({
      userId: actorId || null,
      action: 'backup.run',
      collectionCode: 'backups',
      recordId: backupId,
      newValues: payload,
    });
    await this.auditRepo.save(log);
  }
}

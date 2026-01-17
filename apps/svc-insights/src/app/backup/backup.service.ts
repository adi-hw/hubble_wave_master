import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { AuditLog } from '@hubblewave/instance-db';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import {
  STORAGE_CLIENT,
  STORAGE_CONFIG,
  StorageClient,
  StorageConfig,
} from '@hubblewave/storage';
import {
  createTypesenseClient,
  loadTypesenseConfig,
} from '@hubblewave/search-typesense';
import { BackupArtifact, BackupSummary, RestoreSummary } from './backup.types';

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly bucketName: string;
  private readonly cronSchedule: string;
  private readonly dumpTimeoutMs: number;
  private readonly restoreTimeoutMs: number;
  private isRestoring = false;
  private isBackingUp = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @Inject(STORAGE_CLIENT)
    private readonly storageClient: StorageClient,
    @Inject(STORAGE_CONFIG)
    private readonly storageConfig: StorageConfig,
    private readonly schedulerRegistry: SchedulerRegistry,
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
    if (this.isRestoring) {
      throw new BadRequestException('Restore in progress, backup is temporarily disabled');
    }
    if (this.isBackingUp) {
      throw new BadRequestException('Backup already running');
    }
    this.isBackingUp = true;
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
      this.isBackingUp = false;
    }
  }

  async restoreBackup(backupId: string, actorId?: string): Promise<RestoreSummary> {
    if (!backupId || !backupId.trim()) {
      throw new BadRequestException('backupId is required');
    }
    if (this.isBackingUp) {
      throw new BadRequestException('Backup in progress, restore is temporarily disabled');
    }
    if (this.isRestoring) {
      throw new BadRequestException('Restore already running');
    }
    this.isRestoring = true;

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
      this.isRestoring = false;
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

    const dumpBuffer = await this.runPgDump(options);
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
      await client.collections().create(schema);
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
      const parsed = JSON.parse(buffer.toString('utf8')) as Record<string, unknown>;
      if (parsed.backupId === backupId) {
        return { manifest: parsed, manifestBuffer: buffer, manifestKey: key };
      }
    }
    throw new BadRequestException('Backup manifest not found');
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
        reject(error);
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          const details = Buffer.concat(errChunks).toString('utf8').trim();
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
        reject(error);
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          const details = Buffer.concat(errChunks).toString('utf8').trim();
          reject(new Error(details || `${command} failed with exit code ${code}`));
          return;
        }
        resolve();
      });

      child.stdin.write(input);
      child.stdin.end();
    });
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

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImportExport1790000000000 implements MigrationInterface {
  name = 'ImportExport1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============ Import Definition ============
    await queryRunner.query(`
      CREATE TABLE import_definition (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        "collectionCode" VARCHAR(100) NOT NULL,
        format VARCHAR(20) NOT NULL,
        action VARCHAR(20) DEFAULT 'upsert',
        "columnMappings" JSONB DEFAULT '[]',
        "keyFields" JSONB,
        options JSONB,
        "validationRules" JSONB,
        "isActive" BOOLEAN DEFAULT true,
        "createdBy" UUID,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_import_def_collection ON import_definition("collectionCode")`);

    // ============ Import Job ============
    await queryRunner.query(`
      CREATE TABLE import_job (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "importDefinitionId" UUID,
        "collectionCode" VARCHAR(100),
        status VARCHAR(20) DEFAULT 'draft',
        "fileName" VARCHAR(500),
        "fileSize" BIGINT,
        format VARCHAR(20),
        "columnMappings" JSONB,
        "previewData" JSONB,
        "totalRows" INT DEFAULT 0,
        "processedRows" INT DEFAULT 0,
        "successCount" INT DEFAULT 0,
        "errorCount" INT DEFAULT 0,
        "skipCount" INT DEFAULT 0,
        errors JSONB DEFAULT '[]',
        "startedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "createdBy" UUID,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_import_job_def ON import_job("importDefinitionId")`);
    await queryRunner.query(`CREATE INDEX idx_import_job_collection ON import_job("collectionCode")`);
    await queryRunner.query(`CREATE INDEX idx_import_job_status ON import_job(status)`);

    // ============ Export Definition ============
    await queryRunner.query(`
      CREATE TABLE export_definition (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        "collectionCode" VARCHAR(100) NOT NULL,
        format VARCHAR(20) NOT NULL,
        columns JSONB DEFAULT '[]',
        filters JSONB,
        "sortBy" JSONB,
        "maxRows" INT,
        options JSONB,
        schedule VARCHAR(20) DEFAULT 'once',
        "scheduleConfig" JSONB,
        "isActive" BOOLEAN DEFAULT true,
        "createdBy" UUID,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_export_def_collection ON export_definition("collectionCode")`);

    // ============ Export Job ============
    await queryRunner.query(`
      CREATE TABLE export_job (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "exportDefinitionId" UUID,
        "collectionCode" VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        format VARCHAR(20),
        columns JSONB,
        filters JSONB,
        "totalRows" INT DEFAULT 0,
        "processedRows" INT DEFAULT 0,
        "outputFileName" VARCHAR(500),
        "outputUrl" TEXT,
        "outputFileSize" BIGINT,
        "expiresAt" TIMESTAMPTZ,
        "errorMessage" TEXT,
        "startedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "createdBy" UUID,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_export_job_def ON export_job("exportDefinitionId")`);
    await queryRunner.query(`CREATE INDEX idx_export_job_collection ON export_job("collectionCode")`);
    await queryRunner.query(`CREATE INDEX idx_export_job_status ON export_job(status)`);

    // ============ Connection Definition ============
    await queryRunner.query(`
      CREATE TABLE connection_definition (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        "baseUrl" TEXT,
        "authType" VARCHAR(20) DEFAULT 'none',
        "authConfig" JSONB,
        headers JSONB,
        options JSONB,
        "lastTestedAt" TIMESTAMPTZ,
        "testSuccess" BOOLEAN DEFAULT true,
        "lastError" TEXT,
        "lastErrorAt" TIMESTAMPTZ,
        "isActive" BOOLEAN DEFAULT true,
        "createdBy" UUID,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_connection_status ON connection_definition(status)`);

    // ============ Webhook Definition ============
    await queryRunner.query(`
      CREATE TABLE webhook_definition (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        direction VARCHAR(20) NOT NULL,
        "targetUrl" TEXT,
        "httpMethod" VARCHAR(10) DEFAULT 'POST',
        headers JSONB,
        "triggerEvents" JSONB,
        "collectionCode" VARCHAR(100),
        "payloadTemplate" JSONB,
        "secretType" VARCHAR(20),
        secret TEXT,
        "maxRetries" INT DEFAULT 3,
        "timeoutMs" INT DEFAULT 30000,
        "isActive" BOOLEAN DEFAULT true,
        "createdBy" UUID,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ============ Webhook Log ============
    await queryRunner.query(`
      CREATE TABLE webhook_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "webhookDefinitionId" UUID NOT NULL,
        direction VARCHAR(20) NOT NULL,
        "httpMethod" VARCHAR(10),
        url TEXT,
        "requestHeaders" JSONB,
        "requestBody" TEXT,
        "responseStatus" INT,
        "responseHeaders" JSONB,
        "responseBody" TEXT,
        "durationMs" INT,
        success BOOLEAN DEFAULT false,
        "errorMessage" TEXT,
        "retryCount" INT DEFAULT 0,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_webhook_log_def ON webhook_log("webhookDefinitionId")`);
    await queryRunner.query(`CREATE INDEX idx_webhook_log_created ON webhook_log("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_definition`);
    await queryRunner.query(`DROP TABLE IF EXISTS connection_definition`);
    await queryRunner.query(`DROP TABLE IF EXISTS export_job`);
    await queryRunner.query(`DROP TABLE IF EXISTS export_definition`);
    await queryRunner.query(`DROP TABLE IF EXISTS import_job`);
    await queryRunner.query(`DROP TABLE IF EXISTS import_definition`);
  }
}

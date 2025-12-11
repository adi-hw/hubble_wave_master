const { Client } = require('pg');
require('dotenv').config();

async function createTenantSchema() {
  console.log('🏗️  Creating tenant database schema...\n');

  const client = new Client({
    host: process.env.TENANT_DB_HOST || 'localhost',
    port: parseInt(process.env.TENANT_DB_PORT || '5432'),
    user: process.env.TENANT_DB_USER || 'admin',
    password: process.env.TENANT_DB_PASSWORD || 'password',
    database: 'eam_tenant_acme',
  });

  await client.connect();
  console.log('✓ Connected to tenant DB\n');

  try {
    // Enable UUID extension
    console.log('Enabling UUID extension...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    console.log('✓ UUID extension enabled\n');
    
    // Create tables from migration (lines 22-49 of init-tenant.ts)
    console.log('Creating tables...');
    
    await client.query(`CREATE TABLE IF NOT EXISTS "user_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "email" character varying, "displayName" character varying, "authSource" character varying NOT NULL DEFAULT 'LOCAL', "passwordHash" character varying, "previousPasswords" text NOT NULL DEFAULT '', "failedLoginCount" integer NOT NULL DEFAULT '0', "lastFailedLoginAt" TIMESTAMP, "lockedUntil" TIMESTAMP, "status" character varying NOT NULL DEFAULT 'ACTIVE', "emailVerified" boolean NOT NULL DEFAULT false, "passwordChangedAt" TIMESTAMP WITH TIME ZONE, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_125e915cf23ad1cfb43815ce59b" PRIMARY KEY ("id"))`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_d45e7ca4a62293443961558c56" ON "user_accounts" ("username")`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "permissions" text NOT NULL DEFAULT '', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "category" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_48ce552495d14eae9b187bb6716" UNIQUE ("name"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "user_role_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "PK_ac634a3aa59d70bf0fb7b423b47" PRIMARY KEY ("id"))`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY ("id"))`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_664ea405ae2a10c264d582ee56" ON "groups" ("name")`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "user_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "groupId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_dc24675c437bf3c70d3d0dff67f" UNIQUE ("userId", "groupId"), CONSTRAINT "PK_ea7760dc75ee1bf0b09ab9b3289" PRIMARY KEY ("id"))`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "group_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "groupId" uuid NOT NULL, "roleId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_681b827dab7faf2f26680850743" UNIQUE ("groupId", "roleId"), CONSTRAINT "PK_c88b2351f40bf170bc7ab7e8fda" PRIMARY KEY ("id"))`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "password_policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "minLength" integer NOT NULL DEFAULT '12', "requireUppercase" boolean NOT NULL DEFAULT true, "requireLowercase" boolean NOT NULL DEFAULT true, "requireNumbers" boolean NOT NULL DEFAULT true, "requireSymbols" boolean NOT NULL DEFAULT false, "passwordExpiryDays" integer NOT NULL DEFAULT '0', "passwordHistoryDepth" integer NOT NULL DEFAULT '5', "maxFailedAttempts" integer NOT NULL DEFAULT '5', "lockoutDurationMinutes" integer NOT NULL DEFAULT '15', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5468b65a86afc8563ac81cb9153" PRIMARY KEY ("id"))`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "revokedAt" TIMESTAMP WITH TIME ZONE, "replacedByToken" character varying, "ipAddress" character varying, "userAgent" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c25bc63d248ca90e8dcc1d92d06" UNIQUE ("tokenHash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_fd99bb073033ec13353c5f62c5" ON "refresh_tokens" ("userId", "revoked")`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "mfa_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "verified" boolean NOT NULL DEFAULT false, "secret" character varying, "destination" character varying, "recoveryCodes" text NOT NULL DEFAULT '', "lastUsedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_60e4d183e6dbd427aa5549da581" PRIMARY KEY ("id"))`);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_b8cf794d73ba5870a92032da94" ON "mfa_methods" ("userId", "type")`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "used" boolean NOT NULL DEFAULT false, "usedAt" TIMESTAMP WITH TIME ZONE, "ipAddress" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1143abb8c3fad8b06dd857a8c9c" UNIQUE ("tokenHash"), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_9bfba70726ffca74288d85e6fd" ON "password_reset_tokens" ("userId", "used")`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "used" boolean NOT NULL DEFAULT false, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_90489f8f3368c45f461e90efbe5" UNIQUE ("tokenHash"), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_aee6bd8cf4c84b0a0561adfe0e" ON "email_verification_tokens" ("userId", "used")`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "api_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "keyPrefix" character varying NOT NULL, "keyHash" character varying NOT NULL, "scopes" text NOT NULL DEFAULT '', "expiresAt" TIMESTAMP, "lastUsedAt" TIMESTAMP, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "auth_ldap_config" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "enabled" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "host" character varying NOT NULL, "bindDn" character varying NOT NULL, "bindPassword" character varying NOT NULL, "userBaseDn" character varying NOT NULL, "userFilter" character varying NOT NULL DEFAULT '(uid={username})', "mapUsernameAttr" character varying NOT NULL DEFAULT 'uid', "mapEmailAttr" character varying NOT NULL DEFAULT 'mail', "mapDisplayNameAttr" character varying NOT NULL DEFAULT 'cn', "timeoutMs" integer NOT NULL DEFAULT '5000', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_90986c98ae492dc5f1128db80e2" PRIMARY KEY ("id"))`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "auth_sso_provider" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "enabled" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "type" character varying NOT NULL DEFAULT 'OIDC', "issuerUrl" character varying NOT NULL, "clientId" character varying NOT NULL, "clientSecret" character varying NOT NULL, "redirectUri" character varying NOT NULL, "mapUsernameClaim" character varying NOT NULL DEFAULT 'preferred_username', "mapEmailClaim" character varying NOT NULL DEFAULT 'email', "mapDisplayNameClaim" character varying NOT NULL DEFAULT 'name', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2f5ca268f5196113d6aa752109c" PRIMARY KEY ("id"))`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "abac_policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "resource" character varying NOT NULL, "action" character varying NOT NULL, "effect" character varying NOT NULL DEFAULT 'allow', "conditions" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_97380849c09333fdd772a2e9c2a" PRIMARY KEY ("id"))`);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_af551834b45f1c593ce39da4cf" ON "abac_policies" ("resource", "action")`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS "config_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scope" character varying NOT NULL, "category" character varying NOT NULL, "key" character varying NOT NULL, "type" character varying NOT NULL, "value" jsonb NOT NULL, "version" integer NOT NULL DEFAULT '1', "createdBy" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4028e0f2bb7ee5e2679f9008c62" PRIMARY KEY ("id"))`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_5d0213ac2ba49fada349fe3101" ON "config_settings" ("scope", "key")`);
    
    console.log('✅ Core tables created successfully!\n');
    
    // Check created tables
    const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename != 'migrations'
      ORDER BY tablename
    `);
    
    console.log(`✓ Created ${tables.rows.length} tables:`);
    tables.rows.forEach(t => console.log(`   - ${t.tablename}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }

  console.log('\n🚀 Next: Run seed script');
  console.log('   node tools/seed-acme.js');
}

createTenantSchema();

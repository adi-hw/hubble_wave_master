#!/usr/bin/env npx ts-node
/**
 * Tenant Database Provisioning Script
 *
 * Creates a new tenant database with all required tables and seed data.
 *
 * Usage:
 *   npx ts-node scripts/provision-tenant.ts <tenant_slug> [tenant_name]
 *   npm run tenant:create -- acme "Acme Corporation"
 */

import { Client } from 'pg';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

interface TenantConfig {
  slug: string;
  name: string;
  dbName: string;
}

const PLATFORM_DB = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: process.env.POSTGRES_DB || 'eam_global',
};

async function createTenantDatabase(config: TenantConfig): Promise<void> {
  const client = new Client({
    ...PLATFORM_DB,
    database: 'postgres', // Connect to default db to create new db
  });

  try {
    await client.connect();
    console.log(`Creating database: ${config.dbName}...`);

    // Check if database already exists
    const checkResult = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.dbName]
    );

    if (checkResult.rows.length > 0) {
      console.log(`Database ${config.dbName} already exists, skipping creation.`);
      return;
    }

    // Create the tenant database
    await client.query(`CREATE DATABASE "${config.dbName}" ENCODING 'UTF8'`);
    console.log(`Database ${config.dbName} created successfully.`);
  } finally {
    await client.end();
  }
}

async function setupTenantSchema(config: TenantConfig): Promise<void> {
  const client = new Client({
    ...PLATFORM_DB,
    database: config.dbName,
  });

  try {
    await client.connect();
    console.log(`Setting up schema for tenant: ${config.slug}...`);

    // Enable extensions
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pg_trgm";
      CREATE EXTENSION IF NOT EXISTS "citext";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);

    // Create tenant data schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS tenant_data`);

    // Create core tenant tables
    await client.query(`
      -- Users table (tenant-specific user data)
      CREATE TABLE IF NOT EXISTS tenant_data.users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        platform_user_id UUID NOT NULL,
        display_name VARCHAR(255),
        preferences JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- User groups table
      CREATE TABLE IF NOT EXISTS tenant_data.user_groups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_group_id UUID REFERENCES tenant_data.user_groups(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- User group memberships
      CREATE TABLE IF NOT EXISTS tenant_data.user_group_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES tenant_data.users(id) ON DELETE CASCADE,
        group_id UUID NOT NULL REFERENCES tenant_data.user_groups(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, group_id)
      );

      -- Tenant roles
      CREATE TABLE IF NOT EXISTS tenant_data.roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '[]',
        is_system BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- User role assignments
      CREATE TABLE IF NOT EXISTS tenant_data.user_roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES tenant_data.users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES tenant_data.roles(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, role_id)
      );

      -- Audit log
      CREATE TABLE IF NOT EXISTS tenant_data.audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_users_platform_user_id ON tenant_data.users(platform_user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON tenant_data.audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON tenant_data.audit_log(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON tenant_data.audit_log(created_at DESC);
    `);

    console.log(`Schema setup complete for tenant: ${config.slug}`);
  } finally {
    await client.end();
  }
}

async function seedTenantData(config: TenantConfig): Promise<void> {
  const client = new Client({
    ...PLATFORM_DB,
    database: config.dbName,
  });

  try {
    await client.connect();
    console.log(`Seeding default data for tenant: ${config.slug}...`);

    // Seed default roles
    await client.query(`
      INSERT INTO tenant_data.roles (code, name, description, permissions, is_system)
      VALUES
        ('admin', 'Administrator', 'Full administrative access', '["*"]', true),
        ('user', 'Standard User', 'Standard user access', '["read:*", "write:own"]', true),
        ('viewer', 'Viewer', 'Read-only access', '["read:*"]', true)
      ON CONFLICT (code) DO NOTHING
    `);

    // Seed default user groups
    await client.query(`
      INSERT INTO tenant_data.user_groups (code, name, description)
      VALUES
        ('all_users', 'All Users', 'Default group containing all users'),
        ('managers', 'Managers', 'Management team members')
      ON CONFLICT (code) DO NOTHING
    `);

    console.log(`Seed data complete for tenant: ${config.slug}`);
  } finally {
    await client.end();
  }
}

async function registerTenantInPlatform(config: TenantConfig): Promise<void> {
  const client = new Client(PLATFORM_DB);

  try {
    await client.connect();
    console.log(`Registering tenant in platform database...`);

    // Check if tenant already exists
    const existingTenant = await client.query(
      `SELECT id FROM tenants WHERE slug = $1`,
      [config.slug]
    );

    if (existingTenant.rows.length > 0) {
      console.log(`Tenant ${config.slug} already registered in platform.`);
      return;
    }

    // Generate tenant ID
    const tenantId = crypto.randomUUID();

    // Insert tenant record
    await client.query(`
      INSERT INTO tenants (id, slug, name, db_host, db_port, db_name, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
    `, [
      tenantId,
      config.slug,
      config.name,
      process.env.DB_HOST || 'localhost',
      parseInt(process.env.DB_PORT || '5432'),
      config.dbName,
    ]);

    console.log(`Tenant ${config.slug} registered with ID: ${tenantId}`);
  } finally {
    await client.end();
  }
}

async function provisionTenant(slug: string, name?: string): Promise<void> {
  const config: TenantConfig = {
    slug: slug.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    name: name || slug,
    dbName: `eam_tenant_${slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
  };

  console.log('='.repeat(60));
  console.log(`Provisioning tenant: ${config.name} (${config.slug})`);
  console.log(`Database: ${config.dbName}`);
  console.log('='.repeat(60));

  try {
    await createTenantDatabase(config);
    await setupTenantSchema(config);
    await seedTenantData(config);
    await registerTenantInPlatform(config);

    console.log('='.repeat(60));
    console.log(`✓ Tenant ${config.slug} provisioned successfully!`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error provisioning tenant:', error);
    process.exit(1);
  }
}

// Main execution
const [,, slug, name] = process.argv;

if (!slug) {
  console.error('Usage: npx ts-node scripts/provision-tenant.ts <tenant_slug> [tenant_name]');
  console.error('Example: npx ts-node scripts/provision-tenant.ts acme "Acme Corporation"');
  process.exit(1);
}

provisionTenant(slug, name);

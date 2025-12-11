import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityTarget, Repository, ObjectLiteral } from 'typeorm';
import { join } from 'path';
import {
  Tenant,
  UserAccount,
  TenantUserMembership,
  Role,
  Permission,
  UserRoleAssignment,
  Group,
  UserGroup,
  GroupRole,
  PasswordPolicy,
  RefreshToken,
  MfaMethod,
  PasswordResetToken,
  EmailVerificationToken,
  ApiKey,
  LdapConfig,
  SsoProvider,
  AbacPolicy,
  ConfigSetting,
  NavProfile,
  NavProfileItem,
  RolePermission,
  PasswordHistory,
  RoleInheritance,
  TableAcl,
  FieldAcl,
} from '@eam-platform/platform-db';
import { ModuleEntity } from './entities/module.entity';
import { FormDefinition } from './entities/form-definition.entity';
import { FormVersion } from './entities/form-version.entity';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowRun } from './entities/workflow-run.entity';
import { ModelFieldType } from './entities/model-field-type.entity';
import { ModelTable } from './entities/model-table.entity';
import { ModelField } from './entities/model-field.entity';
import { AuditLog } from './entities/audit-log.entity';
import { ModelFormLayout } from './entities/model-form-layout.entity';
import { UserProfile } from './entities/user-profile.entity';
import { PlatformConfig } from './entities/platform-config.entity';
import { TenantCustomization } from './entities/tenant-customization.entity';
import { ConfigChangeHistory } from './entities/config-change-history.entity';
import { PlatformScript } from './entities/platform-script.entity';
import { ScriptExecutionLog } from './entities/script-execution-log.entity';
import { WorkflowStepType } from './entities/workflow-step-type.entity';
import { WorkflowStepExecution } from './entities/workflow-step-execution.entity';
import { ApprovalType } from './entities/approval-type.entity';
import { ApprovalRequest } from './entities/approval-request.entity';
import { ApprovalAssignment } from './entities/approval-assignment.entity';
import { ApprovalHistory } from './entities/approval-history.entity';
import { NotificationChannel } from './entities/notification-channel.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationSubscription } from './entities/notification-subscription.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { InAppNotification } from './entities/in-app-notification.entity';
import { EventDefinition } from './entities/event-definition.entity';
import { EventLog } from './entities/event-log.entity';
import { EventSubscription } from './entities/event-subscription.entity';
import { EventDelivery } from './entities/event-delivery.entity';
import { TenantRole } from './entities/tenant-role.entity';
import { TenantPermission } from './entities/tenant-permission.entity';
import { TenantRolePermission } from './entities/tenant-role-permission.entity';
import { TenantUserRole } from './entities/tenant-user-role.entity';
import { TenantGroup } from './entities/tenant-group.entity';
import { TenantGroupMember } from './entities/tenant-group-member.entity';
import { TenantGroupRole } from './entities/tenant-group-role.entity';
import { TenantNavProfile } from './entities/tenant-nav-profile.entity';
import { TenantNavProfileItem } from './entities/tenant-nav-profile-item.entity';
import { TenantTableAcl } from './entities/tenant-table-acl.entity';
import { TenantFieldAcl } from './entities/tenant-field-acl.entity';
import { UpgradeManifest } from './entities/upgrade-manifest.entity';
import { TenantUpgradeImpact } from './entities/tenant-upgrade-impact.entity';
import { BusinessRule } from './entities/business-rule.entity';
import { UserLayoutPreference } from './entities/user-layout-preference.entity';
import { FieldProtectionRule } from './entities/field-protection-rule.entity';
import { TableUiConfig } from './entities/table-ui-config.entity';
import { FieldUiConfig } from './entities/field-ui-config.entity';
import { Application } from './entities/application.entity';
import { NavTemplate } from './entities/nav-template.entity';
import { NavPatch } from './entities/nav-patch.entity';
import { extractTenantSlug } from './tenant-host.util';

export const platformEntities = new Set([
  Tenant,
  UserAccount,
  TenantUserMembership,
  Role,
  Permission,
  UserRoleAssignment,
  Group,
  UserGroup,
  GroupRole,
  PasswordPolicy,
  RefreshToken,
  MfaMethod,
  PasswordResetToken,
  EmailVerificationToken,
  ApiKey,
  LdapConfig,
  SsoProvider,
  AbacPolicy,
  ConfigSetting,
  NavProfile,
  NavProfileItem,
  RolePermission,
  PasswordHistory,
  RoleInheritance,
  TableAcl,
  FieldAcl,
]);

export const tenantEntities = [
  // Core metadata entities
  ModuleEntity,
  FormDefinition,
  FormVersion,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStepType,
  WorkflowStepExecution,
  ModelFieldType,
  ModelTable,
  ModelField,
  AuditLog,
  ModelFormLayout,
  UserProfile,
  PlatformConfig,
  TenantCustomization,
  ConfigChangeHistory,
  PlatformScript,
  ScriptExecutionLog,
  // Approval entities
  ApprovalType,
  ApprovalRequest,
  ApprovalAssignment,
  ApprovalHistory,
  // Notification entities
  NotificationChannel,
  NotificationTemplate,
  NotificationSubscription,
  NotificationDelivery,
  InAppNotification,
  // Event entities
  EventDefinition,
  EventLog,
  EventSubscription,
  EventDelivery,
  // Tenant RBAC entities
  TenantRole,
  TenantPermission,
  TenantRolePermission,
  TenantUserRole,
  TenantGroup,
  TenantGroupMember,
  TenantGroupRole,
  // Tenant navigation entities
  TenantNavProfile,
  TenantNavProfileItem,
  Application,
  NavTemplate,
  NavPatch,
  // Tenant ACL entities
  TenantTableAcl,
  TenantFieldAcl,
  // Upgrade and configuration management entities
  UpgradeManifest,
  TenantUpgradeImpact,
  BusinessRule,
  UserLayoutPreference,
  FieldProtectionRule,
  // Database-first UI configuration entities
  TableUiConfig,
  FieldUiConfig,
];

@Injectable()
export class TenantDbService implements OnModuleDestroy {
  private dataSources = new Map<string, DataSource>();
  private dataSourceOrder: string[] = [];
  private readonly maxDataSources: number;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly platformDataSource: DataSource
  ) {
    const parsedMax = Number(this.configService.get('TENANT_DB_MAX_CONNECTIONS') || 20);
    this.maxDataSources = Number.isNaN(parsedMax) ? 20 : parsedMax;
  }

  async findTenantBySlug(slug: string): Promise<Tenant | null> {
    if (!slug) {
      return null;
    }
    return this.tenantsRepo.findOne({ where: { slug } });
  }

  async getTenantOrThrow(slug: string): Promise<Tenant> {
    const tenant = await this.findTenantBySlug(slug);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async getTenantFromHost(host?: string | null): Promise<Tenant | null> {
    const slug = extractTenantSlug(host);
    if (!slug) return null;
    return this.findTenantBySlug(slug);
  }

  async getDataSource(tenantId: string): Promise<DataSource> {
    if (this.dataSources.has(tenantId)) {
      return this.dataSources.get(tenantId)!;
    }

    const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const dbHost =
      tenant.dbHost ||
      this.configService.get('TENANT_DB_HOST') ||
      this.configService.get('DB_HOST', 'localhost');
    const dbPort = Number(
      tenant.dbPort ??
        this.configService.get('TENANT_DB_PORT') ??
        this.configService.get('DB_PORT', 5432)
    );
    const dbUser =
      tenant.dbUser ||
      this.configService.get('TENANT_DB_USER') ||
      this.configService.get('DB_USER', 'admin');
    const dbPassword =
      tenant.dbPasswordEnc ||
      // TODO: Warning - dbPasswordEnc is currently used as cleartext. Implement decryption if this is actually encrypted.
      this.configService.get('TENANT_DB_PASSWORD') ||
      this.configService.get('DB_PASSWORD', 'password');
    const dbName =
      tenant.dbName ||
      this.configService.get('TENANT_DB_NAME') ||
      `${this.configService.get('TENANT_DB_PREFIX', 'eam_tenant_')}${tenant.slug}`;

    const dataSource = new DataSource({
      type: 'postgres',
      host: dbHost,
      port: Number(dbPort),
      username: dbUser,
      password: dbPassword,
      database: dbName,
      entities: tenantEntities,
      synchronize: false,
      migrationsRun: this.configService.get('RUN_TENANT_MIGRATIONS') !== 'false',
      migrations: [join(__dirname, '..', '..', '..', '..', 'migrations', 'tenant', '*{.ts,.js}')],
      logging: true,
    });

    await dataSource.initialize();

    const hasMigrations =
      Array.isArray(dataSource.options.migrations) &&
      dataSource.options.migrations.length > 0 &&
      Array.isArray(dataSource.migrations) &&
      dataSource.migrations.length > 0;

    if (hasMigrations) {
      await dataSource.runMigrations();
    }

    this.dataSources.set(tenantId, dataSource);
    this.dataSourceOrder.push(tenantId);
    if (this.dataSourceOrder.length > this.maxDataSources) {
      const oldest = this.dataSourceOrder.shift();
      if (oldest) {
        const ds = this.dataSources.get(oldest);
        if (ds) {
          await ds.destroy();
          this.dataSources.delete(oldest);
        }
      }
    }
    return dataSource;
  }

  async getRepository<T extends ObjectLiteral>(tenantId: string, entity: EntityTarget<T>): Promise<Repository<T>> {
    if (platformEntities.has(entity as any)) {
      return this.platformDataSource.getRepository(entity as any) as Repository<T>;
    }

    const dataSource = await this.getDataSource(tenantId);
    return dataSource.getRepository(entity as any) as Repository<T>;
  }

  async onModuleDestroy() {
    for (const ds of this.dataSources.values()) {
      await ds.destroy();
    }
    this.dataSources.clear();
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Permission,
  Role,
  RolePermission,
} from '@hubblewave/instance-db';

/**
 * Default permission definition
 */
interface PermissionDefinition {
  slug: string;
  name: string;
  description: string;
  category: string;
  requiresMfa?: boolean;
}

/**
 * Default role definition
 */
interface RoleDefinition {
  slug: string;
  name: string;
  description: string;
  color: string;
  parentSlug?: string;
  isDefault?: boolean;
  permissions: string[]; // Permission slugs
}

/**
 * Default system permissions
 */
const DEFAULT_PERMISSIONS: PermissionDefinition[] = [
  // Assets
  { slug: 'assets.view', name: 'View Assets', description: 'View asset records and details', category: 'assets' },
  { slug: 'assets.create', name: 'Create Assets', description: 'Create new asset records', category: 'assets' },
  { slug: 'assets.update', name: 'Update Assets', description: 'Modify existing asset records', category: 'assets' },
  { slug: 'assets.delete', name: 'Delete Assets', description: 'Remove asset records', category: 'assets', requiresMfa: true },
  { slug: 'assets.import', name: 'Import Assets', description: 'Bulk import assets from files', category: 'assets' },
  { slug: 'assets.export', name: 'Export Assets', description: 'Export asset data to files', category: 'assets' },

  // Work Orders
  { slug: 'work-orders.view', name: 'View Work Orders', description: 'View work order records', category: 'work-orders' },
  { slug: 'work-orders.create', name: 'Create Work Orders', description: 'Create new work orders', category: 'work-orders' },
  { slug: 'work-orders.update', name: 'Update Work Orders', description: 'Modify work orders', category: 'work-orders' },
  { slug: 'work-orders.delete', name: 'Delete Work Orders', description: 'Remove work orders', category: 'work-orders' },
  { slug: 'work-orders.assign', name: 'Assign Work Orders', description: 'Assign work orders to technicians', category: 'work-orders' },
  { slug: 'work-orders.close', name: 'Close Work Orders', description: 'Mark work orders as complete', category: 'work-orders' },

  // Users
  { slug: 'users.view', name: 'View Users', description: 'View user profiles', category: 'users' },
  { slug: 'users.create', name: 'Create Users', description: 'Create new user accounts', category: 'users' },
  { slug: 'users.update', name: 'Update Users', description: 'Modify user accounts', category: 'users' },
  { slug: 'users.delete', name: 'Delete Users', description: 'Deactivate user accounts', category: 'users', requiresMfa: true },
  { slug: 'users.assign-roles', name: 'Assign Roles', description: 'Assign roles to users', category: 'users' },
  { slug: 'users.impersonate', name: 'Impersonate Users', description: 'Login as another user (audit logged)', category: 'users', requiresMfa: true },

  // Groups
  { slug: 'groups.view', name: 'View Groups', description: 'View groups and teams', category: 'groups' },
  { slug: 'groups.create', name: 'Create Groups', description: 'Create new groups', category: 'groups' },
  { slug: 'groups.update', name: 'Update Groups', description: 'Modify group settings', category: 'groups' },
  { slug: 'groups.delete', name: 'Delete Groups', description: 'Remove groups', category: 'groups' },
  { slug: 'groups.manage-members', name: 'Manage Members', description: 'Add/remove group members', category: 'groups' },
  { slug: 'groups.assign-roles', name: 'Assign Roles to Groups', description: 'Assign roles to groups', category: 'groups' },

  // Roles
  { slug: 'roles.view', name: 'View Roles', description: 'View roles and permissions', category: 'roles' },
  { slug: 'roles.create', name: 'Create Roles', description: 'Create new roles', category: 'roles' },
  { slug: 'roles.update', name: 'Update Roles', description: 'Modify role permissions', category: 'roles' },
  { slug: 'roles.delete', name: 'Delete Roles', description: 'Remove roles', category: 'roles', requiresMfa: true },

  // Reports
  { slug: 'reports.view', name: 'View Reports', description: 'Access standard reports', category: 'reports' },
  { slug: 'reports.create', name: 'Create Reports', description: 'Create custom reports', category: 'reports' },
  { slug: 'reports.export', name: 'Export Reports', description: 'Export reports to PDF/Excel', category: 'reports' },
  { slug: 'reports.schedule', name: 'Schedule Reports', description: 'Set up automated report delivery', category: 'reports' },

  // Process Flows
  { slug: 'process-flows.view', name: 'View Process Flows', description: 'View process flow definitions', category: 'process-flows' },
  { slug: 'process-flows.create', name: 'Create Process Flows', description: 'Design new process flows', category: 'process-flows' },
  { slug: 'process-flows.update', name: 'Update Process Flows', description: 'Modify process flow definitions', category: 'process-flows' },
  { slug: 'process-flows.delete', name: 'Delete Process Flows', description: 'Remove process flows', category: 'process-flows' },
  { slug: 'process-flows.execute', name: 'Execute Process Flows', description: 'Manually trigger process flows', category: 'process-flows' },

  // Collections (Schema)
  { slug: 'collections.view', name: 'View Collections', description: 'View collection definitions', category: 'collections' },
  { slug: 'collections.create', name: 'Create Collections', description: 'Create new collections/tables', category: 'collections' },
  { slug: 'collections.update', name: 'Update Collections', description: 'Modify collection schema', category: 'collections' },
  { slug: 'collections.delete', name: 'Delete Collections', description: 'Remove collections', category: 'collections', requiresMfa: true },

  // Scripts
  { slug: 'scripts.view', name: 'View Scripts', description: 'View script definitions', category: 'scripts' },
  { slug: 'scripts.create', name: 'Create Scripts', description: 'Create new scripts', category: 'scripts' },
  { slug: 'scripts.update', name: 'Update Scripts', description: 'Modify scripts', category: 'scripts' },
  { slug: 'scripts.delete', name: 'Delete Scripts', description: 'Remove scripts', category: 'scripts' },
  { slug: 'scripts.execute', name: 'Execute Scripts', description: 'Run scripts', category: 'scripts' },

  // Administration
  { slug: 'admin.settings', name: 'System Settings', description: 'Modify system configuration', category: 'admin', requiresMfa: true },
  { slug: 'admin.audit', name: 'View Audit Logs', description: 'Access audit trail', category: 'admin' },
  { slug: 'admin.integrations', name: 'Manage Integrations', description: 'Configure external integrations', category: 'admin' },
  { slug: 'admin.backup', name: 'Backup/Restore', description: 'Create and restore backups', category: 'admin', requiresMfa: true },
];

/**
 * Default system roles with hierarchy
 */
const DEFAULT_ROLES: RoleDefinition[] = [
  {
    slug: 'admin',
    name: 'Administrator',
    description: 'Full system access with all permissions',
    color: '#ef4444',
    permissions: DEFAULT_PERMISSIONS.map((p) => p.slug), // All permissions
  },
  {
    slug: 'manager',
    name: 'Manager',
    description: 'Can manage users, assets, and process flows within their scope',
    color: '#f59e0b',
    parentSlug: 'admin',
    permissions: [
      'assets.view', 'assets.create', 'assets.update', 'assets.export',
      'work-orders.view', 'work-orders.create', 'work-orders.update', 'work-orders.assign', 'work-orders.close',
      'users.view', 'users.create', 'users.update', 'users.assign-roles',
      'groups.view', 'groups.create', 'groups.update', 'groups.manage-members',
      'reports.view', 'reports.create', 'reports.export', 'reports.schedule',
      'process-flows.view',
    ],
  },
  {
    slug: 'technician',
    name: 'Technician',
    description: 'Field technician with access to work orders and assets',
    color: '#06b6d4',
    parentSlug: 'manager',
    permissions: [
      'assets.view', 'assets.update',
      'work-orders.view', 'work-orders.update', 'work-orders.close',
      'reports.view',
    ],
  },
  {
    slug: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to dashboards and reports',
    color: '#64748b',
    isDefault: true, // Default role for new users
    permissions: [
      'assets.view',
      'work-orders.view',
      'reports.view',
    ],
  },
  {
    slug: 'auditor',
    name: 'Compliance Auditor',
    description: 'Read access to audit logs and compliance reports',
    color: '#8b5cf6',
    parentSlug: 'viewer',
    permissions: [
      'assets.view',
      'work-orders.view',
      'reports.view', 'reports.export',
      'admin.audit',
    ],
  },
];

/**
 * PermissionSeederService - Seeds default permissions and roles
 *
 * This service creates the initial set of permissions and roles
 * when the application starts for the first time.
 */
@Injectable()
export class PermissionSeederService {
  private readonly logger = new Logger(PermissionSeederService.name);

  constructor(
    @InjectRepository(Permission) private readonly permRepo: Repository<Permission>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(RolePermission) private readonly rolePermRepo: Repository<RolePermission>,
  ) {}

  /**
   * Seed default permissions and roles for the instance
   */
  async seed(): Promise<void> {
    this.logger.log(`Seeding permissions and roles...`);

    try {
      // Seed permissions first
      await this.seedPermissions();

      // Then seed roles
      await this.seedRoles();

      this.logger.log(`Successfully seeded permissions and roles.`);
    } catch (err) {
      this.logger.error(`Failed to seed permissions/roles: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Seed default permissions
   */
  private async seedPermissions(): Promise<void> {
    for (const def of DEFAULT_PERMISSIONS) {
      const existing = await this.permRepo.findOne({
        where: { code: def.slug },
      });

      if (!existing) {
        const permission = this.permRepo.create({
          code: def.slug,
          name: def.name,
          description: def.description,
          category: def.category,
          isDangerous: def.requiresMfa ?? false,
          isSystem: true,
        });
        await this.permRepo.save(permission);
        this.logger.debug(`Created permission: ${def.slug}`);
      } else if (existing.description !== def.description) {
        // Update description if changed
        existing.description = def.description;
        await this.permRepo.save(existing);
      }
    }
  }

  /**
   * Seed default roles with permissions
   */
  private async seedRoles(): Promise<void> {
    // First pass: Create all roles
    const roleMap = new Map<string, Role>();

    for (const def of DEFAULT_ROLES) {
      let role = await this.roleRepo.findOne({ where: { code: def.slug } });

      if (!role) {
        role = this.roleRepo.create({
          code: def.slug,
          name: def.name,
          description: def.description,
          color: def.color,
          isSystem: true,
          isDefault: def.isDefault ?? false,
          isActive: true,
        });
        role = await this.roleRepo.save(role);
        this.logger.debug(`Created role: ${def.slug}`);
      }

      roleMap.set(def.slug, role);
    }

    // Second pass: Set parent relationships
    for (const def of DEFAULT_ROLES) {
      if (def.parentSlug) {
        const role = roleMap.get(def.slug);
        const parent = roleMap.get(def.parentSlug);
        if (role && parent && role.parentId !== parent.id) {
          role.parentId = parent.id;
          await this.roleRepo.save(role);
        }
      }
    }

    // Third pass: Assign permissions to roles
    for (const def of DEFAULT_ROLES) {
      const role = roleMap.get(def.slug);
      if (!role) continue;

      // Get existing permission assignments
      const existingAssignments = await this.rolePermRepo.find({
        where: { roleId: role.id },
      });
      const existingPermIds = new Set(existingAssignments.map((a) => a.permissionId));

      // Get permission IDs for this role
      const permissions = await this.permRepo.find({
        where: def.permissions.map((slug) => ({ code: slug })),
      });

      // Create missing assignments
      for (const perm of permissions) {
        if (!existingPermIds.has(perm.id)) {
          await this.rolePermRepo.save(
            this.rolePermRepo.create({
              roleId: role.id,
              permissionId: perm.id,
            }),
          );
        }
      }
    }
  }

  /**
   * Get list of default permissions (for reference)
   */
  getDefaultPermissions(): PermissionDefinition[] {
    return [...DEFAULT_PERMISSIONS];
  }

  /**
   * Get list of default roles (for reference)
   */
  getDefaultRoles(): RoleDefinition[] {
    return [...DEFAULT_ROLES];
  }
}

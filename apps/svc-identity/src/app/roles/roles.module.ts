import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { PermissionResolverService } from './permission-resolver.service';
import { RoleService } from './role.service';
import { UserRoleService } from './user-role.service';
import { PermissionSeederService } from './permission-seeder.service';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { PermissionGuard } from './guards/permission.guard';

@Module({
  imports: [InstanceDbModule],
  controllers: [RolesController, PermissionsController],
  providers: [
    PermissionResolverService,
    RoleService,
    UserRoleService,
    PermissionSeederService,
    PermissionGuard,
  ],
  exports: [
    PermissionResolverService,
    RoleService,
    UserRoleService,
    PermissionSeederService,
    PermissionGuard,
  ],
})
export class RolesModule implements OnModuleInit {
  private readonly logger = new Logger(RolesModule.name);

  constructor(private readonly permissionSeeder: PermissionSeederService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing roles module - seeding permissions and roles...');
      await this.permissionSeeder.seed();
      this.logger.log('Permissions and roles seeded successfully');
    } catch (error) {
      this.logger.error(
        `Failed to seed permissions and roles: ${(error as Error).message}`,
        (error as Error).stack
      );
      // Don't throw - allow app to start even if seeding fails
      // The seeder is idempotent so it can be retried on next startup
    }
  }
}


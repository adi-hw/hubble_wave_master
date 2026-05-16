import { Module, Global } from '@nestjs/common';
import {
  IdentityCacheInvalidationSubscriber,
  InstanceDbModule,
} from '@hubblewave/instance-db';
import { EventBusModule, EventBusService } from '@hubblewave/event-bus';
import { PermissionResolverService } from './permission-resolver.service';
import { RoleService } from './role.service';
import { UserRoleService } from './user-role.service';
import { RolesController } from './roles.controller';
import { PermissionGuard } from './guards/permission.guard';

/**
 * Roles + permissions module.
 *
 * Per W2 spec §2.3, `identity.platform_permissions` is materialized from
 * the `PERMISSION_REGISTRY` TypeScript constant by Stream 2 PR3's
 * `seed-permission-registry-sync` script, not by an in-app seeder. The
 * pre-Pre-W2 `PermissionSeederService` (which wrote dot-style codes to
 * the now-dropped `identity.permissions` table) and the
 * `PermissionsController` (which CRUD-ed the same table) are deleted —
 * Stream 2 PR3 lands the registry-backed replacement controller.
 */
@Global()
@Module({
  imports: [InstanceDbModule, EventBusModule.forRoot()],
  controllers: [RolesController],
  providers: [
    PermissionResolverService,
    RoleService,
    UserRoleService,
    PermissionGuard,
  ],
  exports: [
    PermissionResolverService,
    RoleService,
    UserRoleService,
    PermissionGuard,
  ],
})
export class RolesModule {
  constructor(private readonly eventBus: EventBusService) {
    // Bind the cross-service event publisher into the TypeORM subscriber.
    // Subscribers run outside Nest's DI graph, so we hand them a reference
    // explicitly at module construction.
    IdentityCacheInvalidationSubscriber.setPublisher(this.eventBus);
  }
}


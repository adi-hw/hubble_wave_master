import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { LicensesModule } from './licenses/licenses.module';
import { CustomersModule } from './customers/customers.module';
import { HealthAggregatorModule } from './health-aggregator/health-aggregator.module';
import { PacksModule } from './packs/packs.module';
import { InstancesModule } from './instances/instances.module';
import { TerraformModule } from './terraform/terraform.module';

/**
 * ControlPlaneModule — canonical home for the platform's control plane
 * (formerly apps/svc-control-plane). Per canon §18, the control plane:
 *   - manages customers + instances + subscriptions + licenses
 *   - is multi-tenant by design (customerId in business logic, intentional)
 *   - has its own DB (@hubblewave/control-plane-db), distinct from instance-plane
 *   - is excluded from instance-plane authz scanners (canon §18 carve-out)
 *
 * Migration progress (per docs/superpowers/plans/2026-05-10-platform-w1-control-plane-migration.md):
 *   Foundation cyclic-core:
 *     [x] audit + auth (atomic bundle)
 *   Standard modules:
 *     [x] licenses (depends on audit+auth)
 *     [x] customers, health-aggregator, packs (single-dep on audit+auth) — all three done
 *     [ ] recovery, settings, subscriptions (single-dep)
 *   Infrastructure cyclic-core:
 *     [x] instances + terraform (atomic bundle)
 *   Final standard module:
 *     [ ] metrics (depends on instances)
 *   Final top-level (controller + service + app.module thin adapter):
 *     [ ] app.controller, app.service
 *     [ ] control-plane.module final composition
 *     [ ] svc-control-plane app.module thin adapter
 */
@Module({
  imports: [AuditModule, AuthModule, LicensesModule, CustomersModule, HealthAggregatorModule, PacksModule, InstancesModule, TerraformModule],
  controllers: [],
  providers: [],
  exports: [AuditModule, AuthModule, LicensesModule, CustomersModule, HealthAggregatorModule, PacksModule, InstancesModule, TerraformModule],
})
export class ControlPlaneModule {}

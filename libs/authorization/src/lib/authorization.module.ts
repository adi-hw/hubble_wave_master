import { Module } from '@nestjs/common';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { AuthorizationService } from './authorization.service';
import { TableAclRepository } from './table-acl.repository';
import { FieldAclRepository } from './field-acl.repository';
import { AbacService } from './abac.service';

@Module({
  imports: [TenantDbModule],
  providers: [AuthorizationService, TableAclRepository, FieldAclRepository, AbacService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}

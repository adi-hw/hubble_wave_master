import { Module } from '@nestjs/common';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { LdapService } from './ldap.service';
import { LdapController } from './ldap.controller';

@Module({
  imports: [TenantDbModule],
  controllers: [LdapController],
  providers: [LdapService],
  exports: [LdapService],
})
export class LdapModule {}

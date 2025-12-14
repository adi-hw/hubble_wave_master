import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SSOService } from './sso.service';
import { AuditService } from './audit.service';
import { ComplianceService } from './compliance.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SSOService, AuditService, ComplianceService],
  exports: [SSOService, AuditService, ComplianceService],
})
export class EnterpriseModule {}

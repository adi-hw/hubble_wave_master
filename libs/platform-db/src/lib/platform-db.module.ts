import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { Tenant } from './entities/tenant.entity';
import { UserAccount } from './entities/user-account.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRoleAssignment } from './entities/user-role-assignment.entity';
import { LdapConfig } from './entities/ldap-config.entity';
import { SsoProvider } from './entities/sso-provider.entity';
import { PasswordPolicy } from './entities/password-policy.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { MfaMethod } from './entities/mfa-method.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { ApiKey } from './entities/api-key.entity';
import { Group } from './entities/group.entity';
import { UserGroup } from './entities/user-group.entity';
import { GroupRole } from './entities/group-role.entity';
import { AbacPolicy } from './entities/abac-policy.entity';
import { RoleInheritance } from './entities/role-inheritance.entity';
import { ConfigSetting } from './entities/config-setting.entity';
import { NavProfile } from './entities/nav-profile.entity';
import { NavProfileItem } from './entities/nav-profile-item.entity';
import { RolePermission } from './entities/role-permission.entity';
import { PasswordHistory } from './entities/password-history.entity';
import { AuthEvent } from './entities/auth-event.entity';
import { TenantUserMembership } from './entities/tenant-user-membership.entity';
import { TableAcl } from './entities/table-acl.entity';
import { FieldAcl } from './entities/field-acl.entity';

// Control plane connection: only platform entities (tenants, authZ/authN, config)
export const platformEntities = [
  Tenant,
  UserAccount,
  TenantUserMembership,
  Role,
  RolePermission,
  RoleInheritance,
  Permission,
  UserRoleAssignment,
  LdapConfig,
  SsoProvider,
  PasswordPolicy,
  RefreshToken,
  MfaMethod,
  PasswordResetToken,
  EmailVerificationToken,
  PasswordHistory,
  ApiKey,
  Group,
  UserGroup,
  GroupRole,
  TableAcl,
  FieldAcl,
  AbacPolicy,
  ConfigSetting,
  NavProfile,
  NavProfileItem,
  AuthEvent,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host:
          configService.get('PLATFORM_DB_HOST') ||
          configService.get('DB_HOST') ||
          configService.get('POSTGRES_HOST') ||
          'localhost',
        port: Number(
          configService.get('PLATFORM_DB_PORT') ||
            configService.get('DB_PORT') ||
            configService.get('POSTGRES_PORT') ||
            5432
        ),
        username:
          configService.get('PLATFORM_DB_USER') ||
          configService.get('DB_USER') ||
          configService.get('POSTGRES_USER') ||
          'admin',
        password:
          configService.get('PLATFORM_DB_PASSWORD') ||
          configService.get('DB_PASSWORD') ||
          configService.get('POSTGRES_PASSWORD') ||
          'password',
        database:
          configService.get('PLATFORM_DB_NAME') ||
          configService.get('POSTGRES_DB') ||
          configService.get('DB_NAME') ||
          'eam_global',
        entities: platformEntities,
        synchronize: configService.get('NODE_ENV') !== 'production',
        migrationsRun: configService.get('RUN_PLATFORM_MIGRATIONS') !== 'false',
        migrations: [join(__dirname, '..', '..', '..', '..', 'migrations', 'platform', '*{.ts,.js}')],
        logging: true,
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class PlatformDbModule {}

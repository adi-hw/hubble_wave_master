import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { UserAccount, UserInvitation, Tenant } from '@eam-platform/platform-db';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TenantUserService } from './tenant-user.service';
import { TenantUserController } from './tenant-user.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TenantDbModule,
    TypeOrmModule.forFeature([UserAccount, UserInvitation, Tenant]),
    EmailModule,
  ],
  controllers: [UsersController, TenantUserController],
  providers: [UsersService, TenantUserService],
  exports: [TenantUserService],
})
export class UsersModule {}

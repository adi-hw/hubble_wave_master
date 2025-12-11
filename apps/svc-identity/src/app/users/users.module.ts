import { Module } from '@nestjs/common';
import { TenantDbModule } from '@eam-platform/tenant-db';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TenantDbModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

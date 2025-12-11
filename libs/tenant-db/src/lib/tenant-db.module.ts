import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '@eam-platform/platform-db';
import { PlatformDbModule } from '@eam-platform/platform-db';
import { TenantDbService } from './tenant-db.service';
import { TenantResolveMiddleware } from './tenant-resolve.middleware';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PlatformDbModule, TypeOrmModule.forFeature([Tenant])],
  providers: [TenantDbService, TenantResolveMiddleware],
  exports: [TenantDbService, TenantResolveMiddleware],
})
export class TenantDbModule {}

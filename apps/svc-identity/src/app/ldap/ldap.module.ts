import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstanceDbModule, LdapConfig } from '@hubblewave/instance-db';
import { LdapService } from './ldap.service';
import { LdapController } from './ldap.controller';

@Module({
  imports: [
    InstanceDbModule,
    TypeOrmModule.forFeature([LdapConfig]),
  ],
  controllers: [LdapController],
  providers: [LdapService],
  exports: [LdapService],
})
export class LdapModule {}

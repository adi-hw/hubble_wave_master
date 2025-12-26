import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstanceDbModule } from '@hubblewave/instance-db';
import { User, UserInvitation, AuthEvent } from '@hubblewave/instance-db';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { EmailModule } from '../email/email.module';
import { RolesModule } from '../roles/roles.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [
    InstanceDbModule,
    TypeOrmModule.forFeature([User, UserInvitation, AuthEvent]),
    EmailModule,
    RolesModule,
    GroupsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

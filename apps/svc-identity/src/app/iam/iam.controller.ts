import { Controller, Get, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RequestContext } from '@hubblewave/auth-guard';
import { User } from '@hubblewave/instance-db';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionResolverService } from '../roles/permission-resolver.service';

@Controller('iam')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class IamController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  @Get('me')
  async me(@Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    if (!ctx?.userId) {
      throw new NotFoundException('User context missing');
    }

    const user = await this.userRepo.findOne({ where: { id: ctx.userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Resolve roles and permissions using shared service (with caching)
    const cached = await this.permissionResolver.getUserPermissions(ctx.userId);
    const roleNames = cached.roles.map(r => r.code || r.name);

    return {
      id: user.id,
      userId: user.id,
      username: user.displayName || user.email,
      displayName: user.displayName || user.email || 'User',
      email: user.email,
      isAdmin: roleNames.includes('admin'),
      roles: roleNames,
      permissions: Array.from(cached.permissions),
    };
  }

  @Get('profile')
  async profile(@Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    if (!ctx?.userId) {
      throw new NotFoundException('User context missing');
    }

    const user = await this.userRepo.findOne({
      where: { id: ctx.userId },
    });

    if (!user) {
      return {
        displayName: 'User',
        preferences: {},
      };
    }

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phoneNumber: user.workPhone || user.mobilePhone,
      locale: user.locale,
      timeZone: user.timeZone,
      title: user.title,
      department: user.department,
      preferences: {},
    };
  }
}

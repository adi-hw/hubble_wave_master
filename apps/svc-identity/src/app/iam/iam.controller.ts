import { Controller, Get, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RequestContext } from '@eam-platform/auth-guard';
import { TenantDbService } from '@eam-platform/tenant-db';
import { TenantUserMembership, UserAccount } from '@eam-platform/platform-db';
import { UserProfile } from '@eam-platform/tenant-db';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('iam')
@UseGuards(JwtAuthGuard)
@SkipThrottle() // Profile endpoints are called frequently, skip rate limiting
export class IamController {
  constructor(private readonly tenantDb: TenantDbService) {}

  @Get('me')
  async me(@Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    if (!ctx?.tenantId || !ctx?.userId) {
      throw new NotFoundException('User context missing');
    }

    const membershipRepo = await this.tenantDb.getRepository<TenantUserMembership>(ctx.tenantId, TenantUserMembership as any);
    const userRepo = await this.tenantDb.getRepository<UserAccount>(ctx.tenantId, UserAccount as any);

    const membership = await membershipRepo.findOne({ where: { tenantId: ctx.tenantId, userId: ctx.userId } });
    const user = await userRepo.findOne({ where: { id: ctx.userId } });

    return {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      displayName: membership?.title || user?.displayName || user?.primaryEmail || 'User',
      email: user?.primaryEmail,
      isPlatformAdmin: ctx.isPlatformAdmin,
      isTenantAdmin: ctx.isTenantAdmin,
      roles: ctx.roles || [],
      permissions: ctx.permissions || [],
    };
  }

  @Get('profile')
  async profile(@Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    if (!ctx?.tenantId || !ctx?.userId) {
      throw new NotFoundException('User context missing');
    }

    try {
      const membershipRepo = await this.tenantDb.getRepository<TenantUserMembership>(ctx.tenantId, TenantUserMembership as any);
      const membership = await membershipRepo.findOne({ where: { tenantId: ctx.tenantId, userId: ctx.userId } });

      if (!membership) {
        return {
          displayName: ctx.username || 'User',
          preferences: {},
        };
      }

      // Try to get profile from tenant database - may not exist if tenant DB not fully set up
      try {
        const profileRepo = await this.tenantDb.getRepository<UserProfile>(ctx.tenantId, UserProfile as any);
        const profile = await profileRepo.findOne({ where: { tenantUserId: membership.id } });

        if (profile) {
          return {
            id: profile.id,
            displayName: profile.displayName,
            email: profile.email,
            phoneNumber: profile.phoneNumber,
            locale: profile.locale,
            timeZone: profile.timeZone,
            title: profile.title,
            department: profile.department,
            preferences: profile.preferences,
          };
        }
      } catch {
        // UserProfile table may not exist in tenant DB - fall through to default
      }

      // Return default profile based on membership
      return {
        displayName: membership.title || ctx.username || 'User',
        preferences: {},
      };
    } catch {
      // Fallback if anything fails
      return {
        displayName: ctx.username || 'User',
        preferences: {},
      };
    }
  }
}

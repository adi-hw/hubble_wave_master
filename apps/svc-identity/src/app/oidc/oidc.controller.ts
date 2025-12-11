import { BadRequestException, Controller, Get, Param, Res, Req, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { SsoProvider, UserAccount, UserRoleAssignment, TenantUserMembership } from '@eam-platform/platform-db';
import { OidcService } from './oidc.service';
import { JwtService } from '@nestjs/jwt';
import { TenantDbService, extractTenantSlug } from '@eam-platform/tenant-db';

@Controller('auth/sso')
export class OidcController {
  constructor(
    private readonly tenantDbService: TenantDbService,
    private oidcService: OidcService,
    private jwtService: JwtService,
  ) {}

  @Get(':providerId/login')
  async login(@Param('providerId') providerId: string, @Req() req: any, @Res() res: Response) {
    const tenantSlug = extractTenantSlug(req.headers.host || '');
    if (!tenantSlug) throw new BadRequestException('Tenant could not be determined');
    const tenant = await this.tenantDbService.getTenantOrThrow(tenantSlug);
    const ssoProviderRepo = await this.tenantDbService.getRepository<SsoProvider>(tenant.id, SsoProvider as any);
    const provider = await ssoProviderRepo.findOne({ where: { id: providerId, enabled: true } });
    if (!provider) throw new UnauthorizedException('Invalid provider');

    const url = await this.oidcService.getAuthorizationUrl(provider);
    res.redirect(url);
  }

  @Get(':providerId/callback')
  async callback(@Param('providerId') providerId: string, @Req() req: any, @Res() res: Response) {
    const tenantSlug = extractTenantSlug(req.headers.host || '');
    if (!tenantSlug) throw new BadRequestException('Tenant could not be determined');
    const tenant = await this.tenantDbService.getTenantOrThrow(tenantSlug);
    const ssoProviderRepo = await this.tenantDbService.getRepository<SsoProvider>(tenant.id, SsoProvider as any);
    const usersRepo = await this.tenantDbService.getRepository<UserAccount>(tenant.id, UserAccount as any);
    const membershipRepo = await this.tenantDbService.getRepository<TenantUserMembership>(tenant.id, TenantUserMembership as any);
    const userRolesRepo = await this.tenantDbService.getRepository<UserRoleAssignment>(tenant.id, UserRoleAssignment as any);

    const provider = await ssoProviderRepo.findOne({ 
      where: { id: providerId, enabled: true }
    });
    if (!provider) throw new UnauthorizedException('Invalid provider');

    const userInfo = await this.oidcService.handleCallback(provider, req);
    const email = userInfo.email || userInfo.username;

    if (!email) {
      throw new UnauthorizedException('SSO profile missing email/username');
    }

    // Find or create user by primary email
    let user = await usersRepo.findOne({
      where: { primaryEmail: email },
    });

    if (!user) {
      user = usersRepo.create({
        primaryEmail: email,
        displayName: userInfo.displayName || email,
        status: 'ACTIVE',
      });
      await usersRepo.save(user);
    } else {
      await usersRepo.update(user.id, {
        displayName: userInfo.displayName || user.displayName,
      });
    }

    // Ensure membership exists
    let membership = await membershipRepo.findOne({ where: { tenantId: tenant.id, userId: user.id } });
    if (!membership) {
      membership = membershipRepo.create({
        tenantId: tenant.id,
        userId: user.id,
        status: 'ACTIVE',
        isTenantAdmin: false,
      });
      membership = await membershipRepo.save(membership);
    }

    // Generate JWT
    const assignments = await userRolesRepo.find({
      where: { tenantUserMembershipId: membership.id },
      relations: ['role'],
    });
    const roles = assignments.map((a) => a.role.slug || a.role.name).filter(Boolean);

    const payload = {
      sub: user.id,
      tenantId: tenant.id,
      username: user.displayName || user.primaryEmail,
      roles,
    };

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '15m' });
    const refreshToken = await this.jwtService.signAsync(payload, { expiresIn: '7d' });

    // Redirect to frontend with tokens
    // In production, use a secure cookie or a temporary code exchange
    // For now, passing via query params (NOT SECURE for prod, but okay for dev/demo)
    res.redirect(`http://localhost:4200/login/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
  }
}

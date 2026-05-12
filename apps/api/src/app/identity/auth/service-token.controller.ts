import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IsString, MinLength } from 'class-validator';
import { Public } from '@hubblewave/auth-guard';
import { ServiceBootstrapService } from './service-bootstrap.service';
import { TokenIssuerService } from './token-issuer.service';

class MintServiceTokenDto {
  @IsString()
  @MinLength(1)
  audience!: string;
}

/**
 * Canon §29.7 — service-to-service token mint endpoint.
 *
 * Marked `@Public()` to bypass the global `JwtAuthGuard` because the
 * caller (by definition) has no HubbleWave JWT yet — they are
 * exchanging a Kubernetes projected SA token (production) or a
 * `JWT_BOOTSTRAP_SECRET` header (dev) for one. The actual
 * authentication runs inside `ServiceBootstrapService.authenticate`
 * and is enforced before any token is minted.
 *
 * Audit footprint: this controller's `@Public()` use is documented
 * in `tools/security-bypass-check.ts` `PUBLIC_ALLOWLIST` with the
 * canon §29.7 reference.
 */
@Controller('internal')
export class ServiceTokenController {
  constructor(
    private readonly serviceBootstrap: ServiceBootstrapService,
    private readonly tokenIssuer: TokenIssuerService,
    private readonly configService: ConfigService,
  ) {}

  @Post('service-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  async mintServiceToken(
    @Body() dto: MintServiceTokenDto,
    @Req() req: Request,
  ): Promise<{ token: string; expiresIn: number; tokenType: 'Bearer' }> {
    const principal = await this.serviceBootstrap.authenticate(req);
    if (!principal) {
      // Single 401 message for every authentication failure mode —
      // mirrors canon §29.5's refresh-token "your session has expired"
      // posture so probes cannot enumerate which bootstrap kind failed.
      throw new UnauthorizedException('Service bootstrap failed');
    }

    const instanceId =
      this.configService.get<string>('INSTANCE_ID') ||
      process.env['INSTANCE_ID'] ||
      'default-instance';

    const { token, expiresIn } = await this.tokenIssuer.issueServiceToken({
      serviceId: principal.serviceId,
      audience: dto.audience,
      instanceId,
    });

    return { token, expiresIn, tokenType: 'Bearer' };
  }
}

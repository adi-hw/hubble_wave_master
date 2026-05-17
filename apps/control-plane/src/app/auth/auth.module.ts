import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { ControlPlaneUser, RevokedToken, RefreshToken } from '@hubblewave/control-plane-db';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { JwksController } from './jwks.controller';
import { ControlPlaneKeySigningModule } from './key-signing/control-plane-key-signing.module';

/**
 * Canon §29.1 + §29.9: control-plane JWTs are signed ES256 via the
 * `KeySigningService` provided by `ControlPlaneKeySigningModule.forRoot()`.
 * The pre-Stream-1-PR3 `JwtModule.registerAsync({ secret })` HS256 path is
 * gone — HS256 is forbidden everywhere on the platform.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ControlPlaneUser, RevokedToken, RefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ControlPlaneKeySigningModule.forRoot(),
  ],
  controllers: [AuthController, JwksController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(private readonly authService: AuthService) {}

  async onModuleInit() {
    await this.authService.seedAdminUser();
  }
}

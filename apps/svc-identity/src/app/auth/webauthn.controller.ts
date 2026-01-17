/**
 * WebAuthn Controller
 * HubbleWave Platform - Phase 1
 *
 * REST endpoints for WebAuthn/FIDO2 passkey authentication.
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WebAuthnService } from './webauthn.service';

interface RequestWithUser {
  user: {
    sub: string;
    username: string;
  };
  ip?: string;
  headers: {
    'user-agent'?: string;
  };
}

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(private readonly webAuthnService: WebAuthnService) {}

  /**
   * Start passkey registration - get challenge and options
   */
  @Post('register/start')
  @UseGuards(JwtAuthGuard)
  async startRegistration(
    @Request() req: RequestWithUser,
    @Body() body: { credentialName?: string; authenticatorType?: 'platform' | 'cross-platform' },
  ) {
    return this.webAuthnService.generateRegistrationOptions(
      req.user.sub,
      body.credentialName || `${req.user.username}'s passkey`,
      body.authenticatorType,
    );
  }

  /**
   * Complete passkey registration - verify attestation
   */
  @Post('register/complete')
  @UseGuards(JwtAuthGuard)
  async completeRegistration(
    @Request() req: RequestWithUser,
    @Body() body: {
      credentialName?: string;
      attestation: {
        id: string;
        rawId: string;
        type: 'public-key';
        response: {
          clientDataJSON: string;
          attestationObject: string;
          transports?: string[];
        };
      };
    },
  ) {
    const credential = await this.webAuthnService.verifyRegistration(
      req.user.sub,
      body.attestation,
      body.credentialName || `${req.user.username}'s passkey`,
    );

    return {
      success: true,
      credential: {
        id: credential.id,
        name: credential.name,
        createdAt: credential.createdAt,
      },
    };
  }

  /**
   * Start passkey authentication - get challenge
   */
  @Post('authenticate/start')
  @HttpCode(HttpStatus.OK)
  async startAuthentication(
    @Body() body: { email?: string },
  ) {
    return this.webAuthnService.generateAuthenticationOptions(body.email);
  }

  /**
   * Complete passkey authentication - verify assertion
   */
  @Post('authenticate/complete')
  @HttpCode(HttpStatus.OK)
  async completeAuthentication(
    @Request() req: RequestWithUser,
    @Body() body: {
      assertion: {
        id: string;
        rawId: string;
        type: 'public-key';
        response: {
          clientDataJSON: string;
          authenticatorData: string;
          signature: string;
          userHandle?: string;
        };
      };
    },
  ) {
    return this.webAuthnService.verifyAuthentication(
      body.assertion,
      req.ip,
      req.headers['user-agent'],
    );
  }

  /**
   * List user's registered passkeys
   */
  @Get('credentials')
  @UseGuards(JwtAuthGuard)
  async listCredentials(@Request() req: RequestWithUser) {
    const credentials = await this.webAuthnService.listCredentials(req.user.sub);

    return credentials.map(cred => ({
      id: cred.id,
      name: cred.name,
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt,
      signCount: cred.signCount,
    }));
  }

  /**
   * Rename a passkey
   */
  @Post('credentials/:credentialId/rename')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async renameCredential(
    @Request() req: RequestWithUser,
    @Param('credentialId') credentialId: string,
    @Body() body: { name: string },
  ) {
    await this.webAuthnService.updateCredentialName(
      req.user.sub,
      credentialId,
      body.name,
    );

    return { success: true };
  }

  /**
   * Delete a passkey
   */
  @Delete('credentials/:credentialId')
  @UseGuards(JwtAuthGuard)
  async deleteCredential(
    @Request() req: RequestWithUser,
    @Param('credentialId') credentialId: string,
  ) {
    await this.webAuthnService.deleteCredential(req.user.sub, credentialId);

    return { success: true };
  }
}

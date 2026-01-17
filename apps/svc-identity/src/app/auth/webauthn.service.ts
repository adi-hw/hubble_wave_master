/**
 * WebAuthn Service
 * HubbleWave Platform - Phase 1
 *
 * Service for WebAuthn/FIDO2 passwordless authentication.
 * Implements passkey registration and authentication flows.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  WebAuthnCredential,
  WebAuthnChallenge,
  User,
} from '@hubblewave/instance-db';
import { AuthEventsService } from './auth-events.service';

// WebAuthn configuration
const RP_NAME = 'HubbleWave';
const RP_ID = process.env['WEBAUTHN_RP_ID'] || 'localhost';
const ORIGIN = process.env['WEBAUTHN_ORIGIN'] || 'http://localhost:3000';
const CHALLENGE_TIMEOUT_MS = 300000; // 5 minutes

export interface RegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  timeout: number;
  attestation: 'none' | 'indirect' | 'direct';
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey: 'required' | 'preferred' | 'discouraged';
    userVerification: 'required' | 'preferred' | 'discouraged';
  };
  excludeCredentials: Array<{
    type: 'public-key';
    id: string;
    transports?: string[];
  }>;
}

export interface AuthenticationOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials: Array<{
    type: 'public-key';
    id: string;
    transports?: string[];
  }>;
  userVerification: 'required' | 'preferred' | 'discouraged';
}

export interface RegistrationResponse {
  id: string;
  rawId: string;
  type: 'public-key';
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
}

export interface AuthenticationResponse {
  id: string;
  rawId: string;
  type: 'public-key';
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
}

@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);

  constructor(
    @InjectRepository(WebAuthnCredential)
    private readonly credentialRepo: Repository<WebAuthnCredential>,
    @InjectRepository(WebAuthnChallenge)
    private readonly challengeRepo: Repository<WebAuthnChallenge>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authEventsService: AuthEventsService,
  ) {}

  /**
   * Generate registration options for a new passkey
   */
  async generateRegistrationOptions(
    userId: string,
    _credentialName: string,
    authenticatorType?: 'platform' | 'cross-platform',
  ): Promise<RegistrationOptions> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get existing credentials to exclude
    const existingCredentials = await this.credentialRepo.find({
      where: { userId, isActive: true },
    });

    // Generate challenge
    const challenge = this.generateChallenge();

    // Store challenge for verification
    await this.storeChallenge(challenge, userId, 'registration');

    const options: RegistrationOptions = {
      challenge,
      rp: {
        name: RP_NAME,
        id: RP_ID,
      },
      user: {
        id: this.bufferToBase64Url(Buffer.from(userId)),
        name: user.email,
        displayName: user.displayName || user.email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      timeout: CHALLENGE_TIMEOUT_MS,
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: authenticatorType,
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existingCredentials.map((cred) => ({
        type: 'public-key',
        id: cred.credentialId,
        transports: cred.transports,
      })),
    };

    this.logger.log(`Generated registration options for user ${userId}`);
    return options;
  }

  /**
   * Verify registration response and store credential
   */
  async verifyRegistration(
    userId: string,
    response: RegistrationResponse,
    credentialName: string,
    deviceInfo?: { platform?: string; browser?: string; os?: string },
  ): Promise<WebAuthnCredential> {
    // Verify challenge
    const storedChallenge = await this.verifyAndConsumeChallenge(
      userId,
      'registration',
    );

    // Parse client data
    const clientData = this.parseClientDataJSON(response.response.clientDataJSON);

    // Verify client data
    if (clientData.type !== 'webauthn.create') {
      throw new BadRequestException('Invalid client data type');
    }

    if (clientData.challenge !== storedChallenge) {
      throw new BadRequestException('Challenge mismatch');
    }

    if (!this.verifyOrigin(clientData.origin)) {
      throw new BadRequestException('Invalid origin');
    }

    // Parse attestation object
    const attestation = this.parseAttestationObject(
      response.response.attestationObject,
    );

    // Extract public key from auth data
    const authData = this.parseAuthenticatorData(attestation.authData);

    if (!authData.attestedCredentialData) {
      throw new BadRequestException('No attested credential data');
    }

    // Check if credential already exists
    const existingCred = await this.credentialRepo.findOne({
      where: { credentialId: response.id },
    });
    if (existingCred) {
      throw new BadRequestException('Credential already registered');
    }

    // Create credential record
    const credential = this.credentialRepo.create({
      userId,
      credentialId: response.id,
      publicKey: authData.attestedCredentialData.publicKey,
      signCount: authData.signCount,
      credentialType: 'public-key',
      transports: response.response.transports || [],
      name: credentialName,
      aaguid: authData.attestedCredentialData.aaguid,
      isDiscoverable: true,
      isBackedUp: authData.flags.backupEligible || false,
      deviceInfo,
      isActive: true,
    });

    await this.credentialRepo.save(credential);

    this.logger.log(`Registered new WebAuthn credential for user ${userId}`);

    // Log auth event
    await this.authEventsService.record({
      userId,
      eventType: 'webauthn_register',
      success: true,
    });

    return credential;
  }

  /**
   * Generate authentication options for passwordless login
   */
  async generateAuthenticationOptions(
    email?: string,
    userId?: string,
  ): Promise<AuthenticationOptions> {
    let allowCredentials: Array<{
      type: 'public-key';
      id: string;
      transports?: string[];
    }> = [];

    // If user is known, only allow their credentials
    if (userId) {
      const credentials = await this.credentialRepo.find({
        where: { userId, isActive: true },
      });
      allowCredentials = credentials.map((cred) => ({
        type: 'public-key',
        id: cred.credentialId,
        transports: cred.transports,
      }));
    } else if (email) {
      const user = await this.userRepo.findOne({ where: { email } });
      if (user) {
        const credentials = await this.credentialRepo.find({
          where: { userId: user.id, isActive: true },
        });
        allowCredentials = credentials.map((cred) => ({
          type: 'public-key',
          id: cred.credentialId,
          transports: cred.transports,
        }));
      }
    }

    // Generate challenge
    const challenge = this.generateChallenge();

    // Store challenge for verification
    await this.storeChallenge(challenge, userId || null, 'authentication');

    const options: AuthenticationOptions = {
      challenge,
      timeout: CHALLENGE_TIMEOUT_MS,
      rpId: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    };

    this.logger.log('Generated authentication options');
    return options;
  }

  /**
   * Verify authentication response and return user
   */
  async verifyAuthentication(
    response: AuthenticationResponse,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: User; credential: WebAuthnCredential }> {
    // Find credential
    const credential = await this.credentialRepo.findOne({
      where: { credentialId: response.id, isActive: true },
      relations: ['user'],
    });

    if (!credential) {
      throw new UnauthorizedException('Credential not found');
    }

    // Verify challenge
    const storedChallenge = await this.verifyAndConsumeChallenge(
      credential.userId,
      'authentication',
    );

    // Parse client data
    const clientData = this.parseClientDataJSON(response.response.clientDataJSON);

    // Verify client data
    if (clientData.type !== 'webauthn.get') {
      throw new BadRequestException('Invalid client data type');
    }

    if (clientData.challenge !== storedChallenge) {
      throw new BadRequestException('Challenge mismatch');
    }

    if (!this.verifyOrigin(clientData.origin)) {
      throw new BadRequestException('Invalid origin');
    }

    // Parse authenticator data
    const authData = this.parseAuthenticatorData(
      Buffer.from(response.response.authenticatorData, 'base64url'),
    );

    // Verify user presence
    if (!authData.flags.userPresent) {
      throw new UnauthorizedException('User presence required');
    }

    // Verify signature
    const isValid = await this.verifySignature(
      credential.publicKey,
      response.response.authenticatorData,
      response.response.clientDataJSON,
      response.response.signature,
    );

    if (!isValid) {
      await this.authEventsService.record({
        userId: credential.userId,
        eventType: 'webauthn_authenticate',
        success: false,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid signature');
    }

    // Verify sign count (replay attack protection)
    if (authData.signCount > 0 && authData.signCount <= credential.signCount) {
      this.logger.warn(
        `Potential cloned authenticator detected for credential ${credential.id}`,
      );
      // Don't fail, but log the warning
    }

    // Update credential
    credential.signCount = authData.signCount;
    credential.lastUsedAt = new Date();
    await this.credentialRepo.save(credential);

    // Get user
    const user = await this.userRepo.findOne({
      where: { id: credential.userId },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User not active');
    }

    // Log success
    await this.authEventsService.record({
      userId: user.id,
      eventType: 'webauthn_authenticate',
      success: true,
      ipAddress,
      userAgent,
    });

    this.logger.log(`WebAuthn authentication successful for user ${user.id}`);

    return { user, credential };
  }

  /**
   * List user's WebAuthn credentials
   */
  async listCredentials(userId: string): Promise<WebAuthnCredential[]> {
    return this.credentialRepo.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete a credential
   */
  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    const credential = await this.credentialRepo.findOne({
      where: { id: credentialId, userId },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    credential.isActive = false;
    await this.credentialRepo.save(credential);

    await this.authEventsService.record({
      userId,
      eventType: 'webauthn_delete',
      success: true,
    });

    this.logger.log(`Deleted WebAuthn credential ${credentialId} for user ${userId}`);
  }

  /**
   * Update credential name
   */
  async updateCredentialName(
    userId: string,
    credentialId: string,
    name: string,
  ): Promise<WebAuthnCredential> {
    const credential = await this.credentialRepo.findOne({
      where: { id: credentialId, userId, isActive: true },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    credential.name = name;
    return this.credentialRepo.save(credential);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateChallenge(): string {
    return this.bufferToBase64Url(crypto.randomBytes(32));
  }

  private async storeChallenge(
    challenge: string,
    userId: string | null,
    type: 'registration' | 'authentication',
  ): Promise<void> {
    // Clean up old challenges
    await this.challengeRepo.delete({
      expiresAt: new Date() as any, // TypeORM will handle the comparison
    });

    const challengeEntity = this.challengeRepo.create({
      challenge,
      userId,
      type,
      expiresAt: new Date(Date.now() + CHALLENGE_TIMEOUT_MS),
    });

    await this.challengeRepo.save(challengeEntity);
  }

  private async verifyAndConsumeChallenge(
    userId: string | null,
    type: 'registration' | 'authentication',
  ): Promise<string> {
    const challengeEntity = await this.challengeRepo.findOne({
      where: { userId: userId || undefined, type },
      order: { createdAt: 'DESC' },
    });

    if (!challengeEntity) {
      throw new BadRequestException('No challenge found');
    }

    if (new Date() > challengeEntity.expiresAt) {
      await this.challengeRepo.delete({ id: challengeEntity.id });
      throw new BadRequestException('Challenge expired');
    }

    // Consume challenge
    await this.challengeRepo.delete({ id: challengeEntity.id });

    return challengeEntity.challenge;
  }

  private parseClientDataJSON(base64url: string): {
    type: string;
    challenge: string;
    origin: string;
  } {
    const json = Buffer.from(base64url, 'base64url').toString('utf8');
    return JSON.parse(json);
  }

  private parseAttestationObject(base64url: string): {
    fmt: string;
    authData: Buffer;
    attStmt: Record<string, unknown>;
  } {
    const buffer = Buffer.from(base64url, 'base64url');
    // Simple CBOR parsing for attestation object
    // In production, use a proper CBOR library
    return this.decodeCBOR(buffer);
  }

  private parseAuthenticatorData(authData: Buffer): {
    rpIdHash: Buffer;
    flags: {
      userPresent: boolean;
      userVerified: boolean;
      backupEligible: boolean;
      backupState: boolean;
      attestedCredentialData: boolean;
      extensionData: boolean;
    };
    signCount: number;
    attestedCredentialData?: {
      aaguid: string;
      credentialId: string;
      publicKey: string;
    };
  } {
    const rpIdHash = authData.subarray(0, 32);
    const flagsByte = authData[32];
    const flags = {
      userPresent: !!(flagsByte & 0x01),
      userVerified: !!(flagsByte & 0x04),
      backupEligible: !!(flagsByte & 0x08),
      backupState: !!(flagsByte & 0x10),
      attestedCredentialData: !!(flagsByte & 0x40),
      extensionData: !!(flagsByte & 0x80),
    };
    const signCount = authData.readUInt32BE(33);

    let attestedCredentialData: {
      aaguid: string;
      credentialId: string;
      publicKey: string;
    } | undefined;

    if (flags.attestedCredentialData) {
      const aaguid = authData.subarray(37, 53).toString('hex');
      const credIdLength = authData.readUInt16BE(53);
      const credentialId = this.bufferToBase64Url(
        authData.subarray(55, 55 + credIdLength),
      );
      const publicKeyBytes = authData.subarray(55 + credIdLength);
      const publicKey = this.bufferToBase64Url(publicKeyBytes);

      attestedCredentialData = { aaguid, credentialId, publicKey };
    }

    return { rpIdHash, flags, signCount, attestedCredentialData };
  }

  private async verifySignature(
    publicKeyBase64: string,
    authenticatorDataBase64: string,
    clientDataJSONBase64: string,
    signatureBase64: string,
  ): Promise<boolean> {
    try {
      const authenticatorData = Buffer.from(authenticatorDataBase64, 'base64url');
      const clientDataJSON = Buffer.from(clientDataJSONBase64, 'base64url');
      const signature = Buffer.from(signatureBase64, 'base64url');

      // Hash client data
      const clientDataHash = crypto
        .createHash('sha256')
        .update(clientDataJSON)
        .digest();

      // Concatenate authenticator data and client data hash
      const signedData = Buffer.concat([authenticatorData, clientDataHash]);

      // Parse public key and verify
      const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64url');
      const publicKey = this.coseToPublicKey(publicKeyBuffer);

      const verify = crypto.createVerify('SHA256');
      verify.update(signedData);
      return verify.verify(publicKey, signature);
    } catch (error) {
      this.logger.error('Signature verification failed', (error as Error).stack);
      return false;
    }
  }

  private coseToPublicKey(coseKey: Buffer): crypto.KeyObject {
    // Simplified COSE to PEM conversion
    // In production, use a proper COSE library
    const decoded = this.decodeCBOR(coseKey);
    const kty = decoded[1]; // Key type

    if (kty === 2) {
      // EC2 key
      const crv = decoded[-1]; // Curve
      const x = decoded[-2];
      const y = decoded[-3];

      if (crv === 1) {
        // P-256
        return crypto.createPublicKey({
          key: {
            kty: 'EC',
            crv: 'P-256',
            x: this.bufferToBase64Url(x),
            y: this.bufferToBase64Url(y),
          },
          format: 'jwk',
        });
      }
    }

    throw new Error('Unsupported key type');
  }

  private decodeCBOR(buffer: Buffer): any {
    // Simplified CBOR decoder for WebAuthn use cases
    // In production, use a proper CBOR library like 'cbor'
    let offset = 0;

    const decode = (): any => {
      const initialByte = buffer[offset++];
      const majorType = initialByte >> 5;
      const additionalInfo = initialByte & 0x1f;

      let value: number;
      if (additionalInfo < 24) {
        value = additionalInfo;
      } else if (additionalInfo === 24) {
        value = buffer[offset++];
      } else if (additionalInfo === 25) {
        value = buffer.readUInt16BE(offset);
        offset += 2;
      } else if (additionalInfo === 26) {
        value = buffer.readUInt32BE(offset);
        offset += 4;
      } else {
        throw new Error('Unsupported CBOR additional info');
      }

      switch (majorType) {
        case 0: // Unsigned integer
          return value;
        case 1: // Negative integer
          return -1 - value;
        case 2: // Byte string
          const bytes = buffer.subarray(offset, offset + value);
          offset += value;
          return bytes;
        case 3: // Text string
          const text = buffer.subarray(offset, offset + value).toString('utf8');
          offset += value;
          return text;
        case 4: // Array
          const arr = [];
          for (let i = 0; i < value; i++) {
            arr.push(decode());
          }
          return arr;
        case 5: // Map
          const map: Record<string | number, any> = {};
          for (let i = 0; i < value; i++) {
            const key = decode();
            map[key] = decode();
          }
          return map;
        default:
          throw new Error('Unsupported CBOR major type');
      }
    };

    return decode();
  }

  private bufferToBase64Url(buffer: Buffer): string {
    return buffer.toString('base64url');
  }

  private verifyOrigin(origin: string): boolean {
    const allowedOrigins = ORIGIN.split(',').map((o) => o.trim());
    return allowedOrigins.includes(origin);
  }
}

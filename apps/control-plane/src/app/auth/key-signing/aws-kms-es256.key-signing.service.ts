import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createPublicKey } from 'crypto';
import { exportJWK } from 'jose';
import {
  KMSClient,
  CreateAliasCommand,
  CreateKeyCommand,
  DescribeKeyCommand,
  GetPublicKeyCommand,
  SignCommand,
} from '@aws-sdk/client-kms';
import { KeyMetadata } from '@hubblewave/control-plane-db';
import {
  KeyMetadataView,
  KeySigningService,
  PublicJwk,
} from '@hubblewave/auth-guard';
import { generateKid } from '@hubblewave/auth-guard';
import { base64urlEncode, base64urlJson, derToConcat } from './der-to-concat';

/**
 * Canon §29.1 / §29.9 — control-plane production ES256 signing via AWS KMS.
 *
 * Mirrors `apps/api/src/app/identity/auth/key-signing/
 * aws-kms-es256.key-signing.service.ts` for the control plane:
 *   - Reads/writes `KeyMetadata` rows from the control-plane DB.
 *   - Default KMS alias base is `alias/hubblewave/control-plane/jwt-signing`
 *     (the instance plane uses a different alias keyed on `instance_id`).
 *
 * Direct KMS signing per token; no in-memory signing key cache, no
 * envelope-key shortcut (explicitly excluded by canon §29.8).
 */
@Injectable()
export class AwsKmsEs256KeySigningService
  implements KeySigningService, OnModuleInit
{
  private readonly logger = new Logger('ControlPlaneAwsKmsEs256KeySigningService');
  private readonly kms: KMSClient;
  private readonly region: string;
  private readonly aliasBase: string;

  constructor(
    @InjectRepository(KeyMetadata)
    private readonly keyRepo: Repository<KeyMetadata>,
    kmsClient?: KMSClient,
  ) {
    this.region = process.env['AWS_REGION'] ?? 'us-east-1';
    this.aliasBase =
      process.env['CONTROL_PLANE_JWT_KMS_ALIAS'] ??
      'alias/hubblewave/control-plane/jwt-signing';
    this.kms = kmsClient ?? new KMSClient({ region: this.region });
  }

  async onModuleInit(): Promise<void> {
    await this.bootstrap();
  }

  async sign(
    payload: Record<string, unknown>,
    header: { typ?: string } = {},
  ): Promise<string> {
    const active = await this.getActiveKey();
    if (!active.kmsArn && !active.kmsAlias) {
      throw new Error(
        `ControlPlaneAwsKmsEs256KeySigningService: active kid '${active.kid}' has neither kms_arn nor kms_alias. ` +
          `Cannot sign without a KMS key reference.`,
      );
    }

    const headerObj = {
      alg: 'ES256' as const,
      typ: header.typ ?? 'JWT',
      kid: active.kid,
    };
    const headerB64 = base64urlJson(headerObj);
    const payloadB64 = base64urlJson(payload);
    const signingInput = `${headerB64}.${payloadB64}`;

    const cmd = new SignCommand({
      KeyId: active.kmsArn ?? active.kmsAlias ?? undefined,
      Message: Buffer.from(signingInput, 'utf8'),
      MessageType: 'RAW',
      SigningAlgorithm: 'ECDSA_SHA_256',
    });
    const out = await this.kms.send(cmd);
    if (!out.Signature) {
      throw new Error(
        `ControlPlaneAwsKmsEs256KeySigningService: KMS Sign for kid '${active.kid}' returned no Signature`,
      );
    }
    const raw = derToConcat(out.Signature);
    const sigB64 = base64urlEncode(raw);
    return `${signingInput}.${sigB64}`;
  }

  async getPublicJwk(kid: string): Promise<PublicJwk> {
    const row = await this.keyRepo.findOne({ where: { kid } });
    if (!row) {
      throw new NotFoundException(`Unknown kid: ${kid}`);
    }
    if (row.state !== 'active' && row.state !== 'retiring') {
      throw new NotFoundException(
        `kid ${kid} is in state '${row.state}'; only active/retiring keys are publishable`,
      );
    }
    const publicKey = createPublicKey({ key: row.publicKeyPem, format: 'pem' });
    const jwk = (await exportJWK(publicKey)) as Partial<PublicJwk>;
    return {
      kty: 'EC',
      crv: 'P-256',
      x: jwk.x as string,
      y: jwk.y as string,
      kid,
      use: 'sig',
      alg: 'ES256',
    };
  }

  async rotateKey(): Promise<KeyMetadataView> {
    const previousActive = await this.keyRepo.findOne({
      where: { state: 'active' },
    });

    const now = new Date();
    const kid = generateKid(now);

    const createKeyOut = await this.kms.send(
      new CreateKeyCommand({
        KeySpec: 'ECC_NIST_P256',
        KeyUsage: 'SIGN_VERIFY',
        Description: `HubbleWave control-plane JWT signing key ${kid}`,
        Tags: [{ TagKey: 'hubblewave-kid', TagValue: kid }],
      }),
    );
    const arn = createKeyOut.KeyMetadata?.Arn;
    const kmsKeyId = createKeyOut.KeyMetadata?.KeyId;
    if (!arn || !kmsKeyId) {
      throw new Error(
        'ControlPlaneAwsKmsEs256KeySigningService: CreateKeyCommand returned no Arn / KeyId',
      );
    }

    const alias = `${this.aliasBase}/${kid}`;
    await this.kms.send(
      new CreateAliasCommand({ AliasName: alias, TargetKeyId: kmsKeyId }),
    );

    const pubOut = await this.kms.send(
      new GetPublicKeyCommand({ KeyId: kmsKeyId }),
    );
    if (!pubOut.PublicKey) {
      throw new Error(
        `ControlPlaneAwsKmsEs256KeySigningService: GetPublicKey for kid '${kid}' returned no PublicKey`,
      );
    }
    const publicKeyObj = createPublicKey({
      key: Buffer.from(pubOut.PublicKey),
      format: 'der',
      type: 'spki',
    });
    const publicKeyPem = publicKeyObj
      .export({ format: 'pem', type: 'spki' })
      .toString();

    await this.keyRepo.manager.transaction(async (tx) => {
      if (previousActive) {
        previousActive.state = 'retiring';
        previousActive.retiringAt = now;
        await tx.save(previousActive);
      }
      const row = tx.create(KeyMetadata, {
        kid,
        provider: 'aws-kms' as const,
        kmsAlias: alias,
        kmsArn: arn,
        algorithm: 'ES256' as const,
        state: 'active' as const,
        publicKeyPem,
        instanceId: null,
        createdAt: now,
        activatedAt: now,
      });
      await tx.save(row);
    });

    this.logger.log(
      `Rotated active aws-kms key: new kid='${kid}', arn='${arn}'${previousActive ? `, retired='${previousActive.kid}'` : ''}`,
    );

    return await this.getActiveKey();
  }

  async getActiveKey(): Promise<KeyMetadataView> {
    const row = await this.keyRepo.findOne({ where: { state: 'active' } });
    if (!row) {
      throw new Error(
        'ControlPlaneAwsKmsEs256KeySigningService: no active key in key_metadata. ' +
          'Bootstrap should have created one — this indicates a DB-level inconsistency.',
      );
    }
    return this.toView(row);
  }

  async getVerifyingKeys(): Promise<KeyMetadataView[]> {
    const rows = await this.keyRepo
      .createQueryBuilder('k')
      .where('k.state IN (:...states)', { states: ['active', 'retiring'] })
      .orderBy('k.activated_at', 'DESC', 'NULLS LAST')
      .getMany();
    return rows.map((r) => this.toView(r));
  }

  private async bootstrap(): Promise<void> {
    const active = await this.keyRepo.findOne({ where: { state: 'active' } });
    if (!active) {
      this.logger.log('No active aws-kms key found; minting initial key');
      await this.rotateKey();
      return;
    }
    if (active.provider !== 'aws-kms') {
      throw new Error(
        `ControlPlaneAwsKmsEs256KeySigningService refusing to start: active key '${active.kid}' has provider='${active.provider}'. ` +
          `Environment mismatch — JWT_KEY_PROVIDER was changed without rotating keys.`,
      );
    }
    await this.kms.send(
      new DescribeKeyCommand({ KeyId: active.kmsArn ?? active.kmsAlias ?? '' }),
    );
  }

  private toView(row: KeyMetadata): KeyMetadataView {
    return {
      kid: row.kid,
      provider: row.provider,
      kmsAlias: row.kmsAlias ?? null,
      kmsArn: row.kmsArn ?? null,
      algorithm: row.algorithm,
      state: row.state,
      publicKeyPem: row.publicKeyPem,
      instanceId: row.instanceId ?? null,
      createdAt: row.createdAt,
      activatedAt: row.activatedAt ?? null,
      retiringAt: row.retiringAt ?? null,
      retiredAt: row.retiredAt ?? null,
      compromisedAt: row.compromisedAt ?? null,
    };
  }
}

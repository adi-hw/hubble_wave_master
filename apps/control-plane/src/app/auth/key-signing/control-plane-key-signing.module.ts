import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KEY_SIGNING_SERVICE } from '@hubblewave/auth-guard';
import { KeyMetadata } from '@hubblewave/control-plane-db';
import { LocalEs256KeySigningService } from './local-es256.key-signing.service';
import { AwsKmsEs256KeySigningService } from './aws-kms-es256.key-signing.service';

/**
 * Canon §29.9 — control-plane binding between `JWT_KEY_PROVIDER` and the
 * runtime provider class.
 *
 * Mirrors `apps/api/src/app/identity/auth/key-signing/key-signing.module.ts`
 * for the control plane. Two hard guards at module construction:
 *
 *   1. Production must use AWS KMS. If `NODE_ENV === 'production'` and
 *      `JWT_KEY_PROVIDER !== 'aws-kms'`, throw at startup. No fallback.
 *   2. Production must NOT have `JWT_BOOTSTRAP_SECRET`. Its presence in
 *      production is a configuration error and the platform refuses to
 *      start (canon §29.7).
 */
@Global()
@Module({})
export class ControlPlaneKeySigningModule {
  static forRoot(): DynamicModule {
    const provider = process.env['JWT_KEY_PROVIDER'];
    const nodeEnv = process.env['NODE_ENV'];

    if (nodeEnv === 'production' && provider !== 'aws-kms') {
      throw new Error(
        `Production requires aws-kms JWT key provider (canon §29.9). ` +
          `Set JWT_KEY_PROVIDER=aws-kms. Current value: '${provider ?? '<unset>'}'`,
      );
    }

    if (nodeEnv === 'production' && process.env['JWT_BOOTSTRAP_SECRET']) {
      throw new Error(
        `Production must not have JWT_BOOTSTRAP_SECRET set (canon §29.7). ` +
          `This secret is a dev-only bootstrap path; its presence in production is a configuration error.`,
      );
    }

    const useKms = provider === 'aws-kms';
    const implClass = useKms
      ? AwsKmsEs256KeySigningService
      : LocalEs256KeySigningService;

    const providers: Provider[] = [
      implClass,
      {
        provide: KEY_SIGNING_SERVICE,
        useExisting: implClass,
      },
    ];

    return {
      module: ControlPlaneKeySigningModule,
      imports: [TypeOrmModule.forFeature([KeyMetadata])],
      providers,
      exports: [KEY_SIGNING_SERVICE, implClass],
    };
  }
}

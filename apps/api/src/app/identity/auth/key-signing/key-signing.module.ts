import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KEY_SIGNING_SERVICE } from '@hubblewave/auth-guard';
import { KeyMetadata } from '@hubblewave/instance-db';
import { LocalEs256KeySigningService } from './local-es256.key-signing.service';
import { AwsKmsEs256KeySigningService } from './aws-kms-es256.key-signing.service';

/**
 * Canon §29.9 — the binding between `JWT_KEY_PROVIDER` and the runtime
 * provider class.
 *
 * The factory enforces two hard guards:
 *
 *   1. **Production must use AWS KMS.** If `NODE_ENV === 'production'`
 *      and `JWT_KEY_PROVIDER !== 'aws-kms'`, throw at startup. No
 *      fallback. No "warn but continue."
 *
 *   2. **Production must NOT have `JWT_BOOTSTRAP_SECRET`.** This env var
 *      is a dev-only bootstrap path for service principals. Its presence
 *      in production is a configuration error and the platform refuses
 *      to start.
 *
 * Defaulting to `local-es256` when `JWT_KEY_PROVIDER` is unset is
 * intentional for non-production environments — the same dev/test/CI
 * machine never has to set the env var unless they want to test the KMS
 * path. Production deployments set it explicitly (and tooling enforces
 * the value is `aws-kms`).
 *
 * NOTE on async-vs-sync init: both providers expose `onModuleInit()` and
 * do their DB / AWS bootstrap there. The factory itself is synchronous —
 * the throw on misconfiguration happens at factory invocation, before
 * Nest constructs the module graph.
 */
@Module({})
export class KeySigningModule {
  static forRoot(): DynamicModule {
    const provider = process.env['JWT_KEY_PROVIDER'];
    const nodeEnv = process.env['NODE_ENV'];

    // Guard 1: production must use aws-kms.
    if (nodeEnv === 'production' && provider !== 'aws-kms') {
      throw new Error(
        `Production requires aws-kms JWT key provider (canon §29.9). ` +
          `Set JWT_KEY_PROVIDER=aws-kms. Current value: '${provider ?? '<unset>'}'`,
      );
    }

    // Guard 2: production must not have JWT_BOOTSTRAP_SECRET.
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
      module: KeySigningModule,
      imports: [TypeOrmModule.forFeature([KeyMetadata])],
      providers,
      exports: [KEY_SIGNING_SERVICE, implClass],
    };
  }
}

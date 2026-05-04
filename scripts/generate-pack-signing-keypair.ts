import { generateKeyPairSync } from 'crypto';

/**
 * Generates a fresh ed25519 keypair for HubbleWave pack manifest signing.
 *
 * Run via: npx ts-node scripts/generate-pack-signing-keypair.ts
 *
 * The keys are emitted to stdout as PEM. They are never written to disk by this
 * script. Operators must copy the values into the secrets store and configure:
 *   - PACK_SIGNING_PRIVATE_KEY  (build-pack tool, signing side)
 *   - PACK_SIGNING_PUBLIC_KEY   (svc-instance-api, verification side)
 */
function main(): void {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');

  const publicPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

  process.stdout.write('===== PACK_SIGNING_PUBLIC_KEY =====\n');
  process.stdout.write(`${publicPem.trim()}\n`);
  process.stdout.write('===== PACK_SIGNING_PRIVATE_KEY =====\n');
  process.stdout.write(`${privatePem.trim()}\n`);
}

main();

import { createPrivateKey, createPublicKey, sign, verify } from 'crypto';

function normalizePem(body: string): string {
  return body.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
}

function wrapPem(body: string, label: string): string {
  const trimmed = normalizePem(body).trim();
  if (trimmed.includes('BEGIN')) {
    return trimmed;
  }
  const lines = trimmed.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

export function normalizePrivateKey(key: string): string {
  return wrapPem(key, 'PRIVATE KEY');
}

export function normalizePublicKey(key: string): string {
  return wrapPem(key, 'PUBLIC KEY');
}

export function signEd25519(payload: Buffer, privateKey: string): string {
  const key = createPrivateKey(normalizePrivateKey(privateKey));
  return sign(null, payload, key).toString('base64');
}

export function verifyEd25519(payload: Buffer, signature: string, publicKey: string): boolean {
  const key = createPublicKey(normalizePublicKey(publicKey));
  return verify(null, payload, key, Buffer.from(signature, 'base64'));
}

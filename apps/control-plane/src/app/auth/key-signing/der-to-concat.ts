/**
 * Convert a DER-encoded ECDSA signature (returned by AWS KMS for ECC P-256)
 * to the concatenated r||s format required by JOSE / JWT ES256 (RFC 7515).
 *
 * DER form:
 *   30 LEN 02 RLEN r-bytes 02 SLEN s-bytes
 *
 * JOSE form for ES256:
 *   r-bytes (32) || s-bytes (32)   →  exactly 64 bytes
 *
 * Mirrors `apps/api/src/app/identity/auth/key-signing/der-to-concat.ts`.
 * The instance plane and the control plane each carry their own copy
 * rather than sharing a library because the helper is small (~80 lines)
 * and the canon §1 cost of an extra shared lib outweighs the value of
 * deduplication today.
 */
export function derToConcat(der: Uint8Array, fieldSizeBytes = 32): Uint8Array {
  if (der[0] !== 0x30) {
    throw new Error(
      `Invalid DER signature: expected 0x30 at offset 0, got 0x${der[0].toString(16)}`,
    );
  }

  let offset = 1;

  let totalLen: number;
  if (der[offset] < 0x80) {
    totalLen = der[offset];
    offset += 1;
  } else if (der[offset] === 0x81) {
    totalLen = der[offset + 1];
    offset += 2;
  } else {
    throw new Error(
      `Invalid DER signature: unsupported length form 0x${der[offset].toString(16)}`,
    );
  }

  if (totalLen !== der.length - offset) {
    throw new Error(
      `Invalid DER signature: declared length ${totalLen} does not match remaining ${der.length - offset}`,
    );
  }

  if (der[offset] !== 0x02) {
    throw new Error(
      `Invalid DER signature: expected 0x02 (INTEGER) for r, got 0x${der[offset].toString(16)}`,
    );
  }
  const rLen = der[offset + 1];
  const rStart = offset + 2;
  const rEnd = rStart + rLen;
  let r = der.subarray(rStart, rEnd);
  offset = rEnd;

  if (der[offset] !== 0x02) {
    throw new Error(
      `Invalid DER signature: expected 0x02 (INTEGER) for s, got 0x${der[offset].toString(16)}`,
    );
  }
  const sLen = der[offset + 1];
  const sStart = offset + 2;
  const sEnd = sStart + sLen;
  let s = der.subarray(sStart, sEnd);

  if (r.length === fieldSizeBytes + 1 && r[0] === 0x00) {
    r = r.subarray(1);
  }
  if (s.length === fieldSizeBytes + 1 && s[0] === 0x00) {
    s = s.subarray(1);
  }

  const out = new Uint8Array(fieldSizeBytes * 2);
  out.set(r, fieldSizeBytes - r.length);
  out.set(s, fieldSizeBytes * 2 - s.length);
  return out;
}

export function base64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64urlJson(obj: unknown): string {
  return base64urlEncode(Buffer.from(JSON.stringify(obj), 'utf8'));
}

/**
 * Convert a DER-encoded ECDSA signature (returned by AWS KMS for ECC P-256)
 * to the concatenated r||s format required by JOSE / JWT ES256 (RFC 7515).
 *
 * DER form:
 *   30 LEN 02 RLEN r-bytes 02 SLEN s-bytes
 *
 * - `LEN` is the length of the rest of the structure.
 * - Each integer (r, s) is at most 33 bytes when DER-encoded (a leading
 *   `0x00` is inserted whenever the high bit of the value is set, to keep
 *   the encoding strictly positive).
 *
 * JOSE form for ES256:
 *   r-bytes (32) || s-bytes (32)   →  exactly 64 bytes
 *
 * AWS KMS hands us DER; jose verifiers (and JWT validators in general)
 * expect the raw 64-byte concatenation. Per canon §29.1, the JWT format is
 * the same in dev and prod — meaning the KMS provider MUST emit the same
 * raw form the local provider emits via jose.SignJWT.
 *
 * This implementation is intentionally hand-rolled rather than pulled from
 * jose internals because (a) jose does not export a public conversion
 * helper for KMS output, and (b) the algorithm is simple, well-specified,
 * and easy to test exhaustively.
 */
export function derToConcat(der: Uint8Array, fieldSizeBytes = 32): Uint8Array {
  if (der[0] !== 0x30) {
    throw new Error(
      `Invalid DER signature: expected 0x30 at offset 0, got 0x${der[0].toString(16)}`,
    );
  }

  let offset = 1;

  // Length field — handle single-byte form (most common for P-256) and
  // single-byte long form (0x81 NN) defensively.
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

  // Sanity: total length should match what's left in the buffer.
  if (totalLen !== der.length - offset) {
    throw new Error(
      `Invalid DER signature: declared length ${totalLen} does not match remaining ${der.length - offset}`,
    );
  }

  // r INTEGER
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

  // s INTEGER
  if (der[offset] !== 0x02) {
    throw new Error(
      `Invalid DER signature: expected 0x02 (INTEGER) for s, got 0x${der[offset].toString(16)}`,
    );
  }
  const sLen = der[offset + 1];
  const sStart = offset + 2;
  const sEnd = sStart + sLen;
  let s = der.subarray(sStart, sEnd);

  // Strip DER leading zero (added to disambiguate positive integers).
  if (r.length === fieldSizeBytes + 1 && r[0] === 0x00) {
    r = r.subarray(1);
  }
  if (s.length === fieldSizeBytes + 1 && s[0] === 0x00) {
    s = s.subarray(1);
  }

  // Left-pad with zeros if the integer was shorter than `fieldSizeBytes`
  // (happens when the value's high bytes happen to be 0).
  const out = new Uint8Array(fieldSizeBytes * 2);
  out.set(r, fieldSizeBytes - r.length);
  out.set(s, fieldSizeBytes * 2 - s.length);
  return out;
}

/** Base64url-encode without padding, per RFC 7515 §2. */
export function base64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Base64url-encode an object as JSON (header / payload). */
export function base64urlJson(obj: unknown): string {
  return base64urlEncode(Buffer.from(JSON.stringify(obj), 'utf8'));
}

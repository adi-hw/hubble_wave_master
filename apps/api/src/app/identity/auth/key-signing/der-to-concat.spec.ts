import {
  createSign,
  createVerify,
  generateKeyPairSync,
  KeyObject,
} from 'crypto';
import { base64urlEncode, base64urlJson, derToConcat } from './der-to-concat';

describe('derToConcat', () => {
  it('produces exactly 64 bytes for ES256', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const sign = createSign('SHA256');
    sign.update('hello');
    sign.end();
    const der = sign.sign(privateKey);
    const raw = derToConcat(der);
    expect(raw.length).toBe(64);
  });

  it('result is verifiable when re-assembled as DER round-trip', () => {
    // Sign with the standard Node API (which emits DER), then convert
    // to concat. Re-encode as DER and verify with the public key. This
    // confirms our conversion does not corrupt r||s.
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });
    const data = Buffer.from('payload-bytes');
    const sign = createSign('SHA256');
    sign.update(data);
    sign.end();
    const der = sign.sign(privateKey);
    const raw = derToConcat(der);

    // Reconstruct DER from the raw r||s.
    const r = raw.subarray(0, 32);
    const s = raw.subarray(32, 64);
    const reconstructed = reEncodeDer(r, s);

    const verify = createVerify('SHA256');
    verify.update(data);
    verify.end();
    expect(verify.verify(publicKey, reconstructed)).toBe(true);
  });

  it('left-pads when r or s has high-order zero bytes', () => {
    // Construct a synthetic DER signature where r is only 30 bytes
    // (high bytes happen to be zero). The function must left-pad to 32.
    const r = new Uint8Array([0x01, 0x02, ...new Array(28).fill(0x33)]);
    const s = new Uint8Array(32).fill(0x44);
    const der = reEncodeDerFromBytes(r, s);
    const raw = derToConcat(der);
    expect(raw.length).toBe(64);
    expect(raw[0]).toBe(0x00);
    expect(raw[1]).toBe(0x00);
    expect(raw[2]).toBe(0x01);
    expect(raw[3]).toBe(0x02);
  });

  it('strips DER leading-zero pad introduced for sign disambiguation', () => {
    // r starts with 0x80 — DER inserts a leading 0x00 to keep the
    // integer strictly positive (33 bytes total). The result must
    // strip that 0x00 and produce 32 bytes for r.
    const r33 = new Uint8Array([0x00, 0x80, ...new Array(31).fill(0xaa)]);
    const s = new Uint8Array(32).fill(0xbb);
    const der = reEncodeDerFromBytes(r33, s);
    const raw = derToConcat(der);
    expect(raw.length).toBe(64);
    expect(raw[0]).toBe(0x80);
    expect(raw[31]).toBe(0xaa);
  });

  it('throws on invalid leading byte', () => {
    expect(() => derToConcat(new Uint8Array([0x00, 0x01]))).toThrow(
      /Invalid DER signature/,
    );
  });
});

describe('base64urlEncode', () => {
  it('uses URL-safe alphabet and strips padding (RFC 7515)', () => {
    // 'hello world' → base64 'aGVsbG8gd29ybGQ=' → url-safe 'aGVsbG8gd29ybGQ'
    const b = Buffer.from('hello world', 'utf8');
    expect(base64urlEncode(b)).toBe('aGVsbG8gd29ybGQ');
  });

  it('replaces + and / with - and _', () => {
    // 0xfb produces '+' in base64; 0xff produces '/'.
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
    const out = base64urlEncode(bytes);
    expect(out.includes('+')).toBe(false);
    expect(out.includes('/')).toBe(false);
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('base64urlJson', () => {
  it('serializes an object to base64url-encoded JSON', () => {
    const enc = base64urlJson({ a: 1 });
    expect(enc).toBe('eyJhIjoxfQ');
  });
});

// -----------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------

/** Build a DER ECDSA signature from r and s integer bytes. */
function reEncodeDerFromBytes(r: Uint8Array, s: Uint8Array): Uint8Array {
  // Add leading 0x00 if high bit is set (positive integer encoding).
  const rd = r[0] & 0x80 ? Buffer.concat([Buffer.from([0]), Buffer.from(r)]) : Buffer.from(r);
  const sd = s[0] & 0x80 ? Buffer.concat([Buffer.from([0]), Buffer.from(s)]) : Buffer.from(s);
  const rBlock = Buffer.concat([Buffer.from([0x02, rd.length]), rd]);
  const sBlock = Buffer.concat([Buffer.from([0x02, sd.length]), sd]);
  const body = Buffer.concat([rBlock, sBlock]);
  return new Uint8Array(Buffer.concat([Buffer.from([0x30, body.length]), body]));
}

/** Same, but takes Buffer subarrays. */
function reEncodeDer(r: Buffer | Uint8Array, s: Buffer | Uint8Array): Buffer {
  return Buffer.from(reEncodeDerFromBytes(new Uint8Array(r), new Uint8Array(s)));
}

// Keep the unused KeyObject import marker happy for older TS pipelines.
export type _KeyObject = KeyObject;

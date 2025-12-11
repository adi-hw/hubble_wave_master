import * as crypto from 'crypto';

/**
 * Encryption service for sensitive data using AES-256-GCM
 *
 * Usage:
 * - Set ENCRYPTION_KEY environment variable (64-character hex string)
 * - Generate key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private readonly key: Buffer;

  constructor(encryptionKey?: string) {
    const key = encryptionKey || process.env.ENCRYPTION_KEY;

    if (!key) {
      throw new Error(
        'ENCRYPTION_KEY environment variable must be set. ' +
        'Generate a secure key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    if (key.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }

    this.key = Buffer.from(key, 'hex');
  }

  /**
   * Encrypts plaintext using AES-256-GCM
   * @param plaintext - The string to encrypt
   * @returns Encrypted string in format: iv:authTag:ciphertext (all hex-encoded)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts ciphertext encrypted with this service
   * @param ciphertext - The encrypted string in format iv:authTag:ciphertext
   * @returns The original plaintext
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format. Expected iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== this.ivLength) {
      throw new Error('Invalid IV length');
    }

    if (authTag.length !== this.authTagLength) {
      throw new Error('Invalid auth tag length');
    }

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Checks if a string appears to be encrypted by this service
   * @param value - The string to check
   * @returns true if the string appears to be encrypted
   */
  isEncrypted(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const parts = value.split(':');
    if (parts.length !== 3) {
      return false;
    }

    const [ivHex, authTagHex] = parts;

    // Check if IV and authTag are valid hex of correct length
    return (
      ivHex.length === this.ivLength * 2 &&
      authTagHex.length === this.authTagLength * 2 &&
      /^[0-9a-f]+$/i.test(ivHex) &&
      /^[0-9a-f]+$/i.test(authTagHex)
    );
  }
}

/**
 * Singleton instance for use across the application
 * Initialize by calling initEncryption() at startup
 */
let encryptionInstance: EncryptionService | null = null;

export function initEncryption(key?: string): EncryptionService {
  if (!encryptionInstance) {
    encryptionInstance = new EncryptionService(key);
  }
  return encryptionInstance;
}

export function getEncryption(): EncryptionService {
  if (!encryptionInstance) {
    throw new Error('Encryption service not initialized. Call initEncryption() first.');
  }
  return encryptionInstance;
}

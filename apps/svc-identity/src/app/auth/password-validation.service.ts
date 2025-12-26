import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthSettings } from '@hubblewave/instance-db';

/**
 * Common password blocklist - Top 1000 most common passwords
 * Sources: SecLists, Have I Been Pwned, NCSC common passwords
 *
 * This is a curated subset of the most commonly used passwords.
 * In production, consider loading from a file or using a larger dataset.
 */
const COMMON_PASSWORDS = new Set([
  // Top 100 most common
  '123456', 'password', '12345678', 'qwerty', '123456789',
  '12345', '1234', '111111', '1234567', 'dragon',
  '123123', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
  'master', 'welcome', 'shadow', 'ashley', 'football',
  'jesus', 'michael', 'ninja', 'mustang', 'password1',
  'password123', 'password12', '123qwe', 'letmein', 'monkey',
  'abc123', 'charlie', 'donald', 'qwerty123', '1qaz2wsx',
  '1q2w3e4r', 'passw0rd', 'superman', 'admin', 'login',
  'starwars', 'hello', 'princess', 'qwertyuiop', 'solo',
  '654321', 'hottie', 'loveme', '696969', 'flower',
  'password1!', 'princess1', 'qazwsx', 'password!', 'test123',

  // Common patterns
  'abcdef', 'abcd1234', '1234qwer', 'qwer1234', 'asdf1234',
  'zxcvbn', 'asdfgh', 'asdfasdf', 'zxcvbnm', 'q1w2e3r4',
  '1234567890', '0987654321', '12341234', '00000000', '99999999',
  'aaaaaaaa', 'aaaaaa', 'qqqqqq', 'zzzzzz', 'xxxxxx',

  // Keyboard walks
  '1qazxsw2', '2wsx3edc', 'qweasdzxc', 'q1w2e3r4t5', 'zaq12wsx',
  'qweasd', 'asdzxc', 'qazwsxedc', '!qaz2wsx', '1qaz@wsx',

  // Common words
  'baseball', 'basketball', 'football', 'hockey', 'soccer',
  'summer', 'winter', 'spring', 'autumn', 'monday',
  'tuesday', 'friday', 'saturday', 'sunday', 'january',
  'december', 'november', 'computer', 'internet', 'server',
  'network', 'windows', 'apple', 'google', 'microsoft',

  // Common names
  'michael', 'jennifer', 'jessica', 'daniel', 'matthew',
  'andrew', 'joshua', 'christopher', 'elizabeth', 'ashley',
  'amanda', 'stephanie', 'nicole', 'michelle', 'william',
  'robert', 'david', 'james', 'john', 'richard',

  // Company/brand related
  'hubblewave', 'hubble', 'wave', 'admin123', 'root',
  'administrator', 'user', 'test', 'demo', 'guest',
  'default', 'changeme', 'temp', 'temporary', 'pass',

  // Common phrases
  'letmein', 'openup', 'iloveyou', 'trustno1', 'welcome1',
  'welcome123', 'hello123', 'goodbye', 'whatever', 'secret',
  'batman', 'superman', 'spiderman', 'ironman', 'captain',

  // Numeric patterns
  '147258369', '159357', '753951', '369258147', '123321',
  '456789', '987654', '135790', '246810', '112233',

  // Year patterns
  '2020', '2021', '2022', '2023', '2024', '2025',
  '2020!', '2021!', '2022!', '2023!', '2024!', '2025!',
  'pass2020', 'pass2021', 'pass2022', 'pass2023', 'pass2024',

  // Simple combinations
  'p@ssw0rd', 'p@ssword', 'passw0rd!', 'Password1', 'Password1!',
  'Pa$$w0rd', 'P@ssw0rd1', 'Qwerty123', 'Qwerty123!', 'Admin123',
  'Admin123!', 'Welcome1', 'Welcome1!', 'Changeme1', 'Changeme1!',
]);

/**
 * Context words that should not appear in passwords
 */
const CONTEXT_WORDS = [
  'hubblewave', 'hubble', 'wave', 'platform', 'eam', 'enterprise',
];

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very_strong';
  score: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  blockCommon: boolean;
}

@Injectable()
export class PasswordValidationService {
  constructor(
    @InjectRepository(AuthSettings)
    private readonly authSettingsRepo: Repository<AuthSettings>,
  ) {}

  /**
   * Validate password against policy and blocklist
   */
  async validatePassword(
    password: string,
    userContext?: {
      email?: string;
      username?: string;
      displayName?: string;
    },
  ): Promise<PasswordValidationResult> {
    const settings = await this.getAuthSettings();
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < settings.minLength) {
      errors.push(`Password must be at least ${settings.minLength} characters`);
    } else {
      score += Math.min(password.length - settings.minLength, 10) * 2;
    }

    // Uppercase check
    if (settings.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 10;
    }

    // Lowercase check
    if (settings.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 10;
    }

    // Number check
    if (settings.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (/[0-9]/.test(password)) {
      score += 10;
    }

    // Symbol check
    if (settings.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      score += 15;
    }

    // Common password blocklist check
    if (settings.blockCommon) {
      const blocklistError = this.checkBlocklist(password);
      if (blocklistError) {
        errors.push(blocklistError);
      } else {
        score += 20;
      }
    }

    // User context check (password shouldn't contain username/email)
    if (userContext) {
      const contextError = this.checkUserContext(password, userContext);
      if (contextError) {
        errors.push(contextError);
      } else {
        score += 10;
      }
    }

    // Pattern detection (keyboard walks, repeating chars, sequential)
    const patternErrors = this.checkPatterns(password);
    if (patternErrors.length > 0) {
      errors.push(...patternErrors);
    } else {
      score += 15;
    }

    // Calculate strength
    const strength = this.calculateStrength(score);

    return {
      valid: errors.length === 0,
      errors,
      strength,
      score: Math.min(score, 100),
    };
  }

  /**
   * Quick validation that throws on failure (for use in controllers)
   */
  async validatePasswordOrThrow(
    password: string,
    userContext?: {
      email?: string;
      username?: string;
      displayName?: string;
    },
  ): Promise<void> {
    const result = await this.validatePassword(password, userContext);
    if (!result.valid) {
      throw new BadRequestException({
        message: 'Password does not meet requirements',
        errors: result.errors,
      });
    }
  }

  /**
   * Check if password is in the common passwords blocklist
   */
  private checkBlocklist(password: string): string | null {
    const normalized = password.toLowerCase();

    // Direct match
    if (COMMON_PASSWORDS.has(normalized)) {
      return 'This password is too common. Please choose a more unique password.';
    }

    // Check with common substitutions reversed
    const desubstituted = normalized
      .replace(/@/g, 'a')
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/\$/g, 's')
      .replace(/!/g, 'i')
      .replace(/\|/g, 'l');

    if (COMMON_PASSWORDS.has(desubstituted)) {
      return 'This password is a common pattern. Please choose a more unique password.';
    }

    // Check context words
    for (const word of CONTEXT_WORDS) {
      if (normalized.includes(word)) {
        return 'Password should not contain platform-related words';
      }
    }

    return null;
  }

  /**
   * Check if password contains user-specific information
   */
  private checkUserContext(
    password: string,
    context: { email?: string; username?: string; displayName?: string },
  ): string | null {
    const normalized = password.toLowerCase();
    const checks: { value?: string; label: string }[] = [
      { value: context.email?.split('@')[0], label: 'email username' },
      { value: context.username, label: 'username' },
      { value: context.displayName, label: 'name' },
    ];

    for (const check of checks) {
      if (check.value && check.value.length >= 3) {
        const checkValue = check.value.toLowerCase();
        if (normalized.includes(checkValue) || checkValue.includes(normalized)) {
          return `Password should not contain your ${check.label}`;
        }
      }
    }

    return null;
  }

  /**
   * Check for common weak patterns
   */
  private checkPatterns(password: string): string[] {
    const errors: string[] = [];

    // Check for repeating characters (e.g., "aaa", "111")
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password should not contain repeating characters');
    }

    // Check for sequential characters (e.g., "abc", "123")
    if (this.hasSequentialChars(password, 4)) {
      errors.push('Password should not contain sequential characters');
    }

    // Check for keyboard walks (e.g., "qwerty", "asdf")
    const keyboardWalks = [
      'qwerty', 'qwer', 'asdf', 'zxcv', 'wasd',
      'qazwsx', 'wsxedc', 'rfvtgb', 'yhnujm',
    ];
    const lower = password.toLowerCase();
    for (const walk of keyboardWalks) {
      if (lower.includes(walk)) {
        errors.push('Password should not contain keyboard patterns');
        break;
      }
    }

    return errors;
  }

  /**
   * Check for sequential characters (ascending or descending)
   */
  private hasSequentialChars(str: string, minLength: number): boolean {
    for (let i = 0; i <= str.length - minLength; i++) {
      let ascending = true;
      let descending = true;

      for (let j = 0; j < minLength - 1; j++) {
        const curr = str.charCodeAt(i + j);
        const next = str.charCodeAt(i + j + 1);

        if (next !== curr + 1) ascending = false;
        if (next !== curr - 1) descending = false;
      }

      if (ascending || descending) return true;
    }

    return false;
  }

  /**
   * Calculate password strength based on score
   */
  private calculateStrength(score: number): 'weak' | 'fair' | 'good' | 'strong' | 'very_strong' {
    if (score < 30) return 'weak';
    if (score < 50) return 'fair';
    if (score < 70) return 'good';
    if (score < 90) return 'strong';
    return 'very_strong';
  }

  /**
   * Get auth settings with defaults
   */
  private async getAuthSettings(): Promise<PasswordPolicy> {
    const settings = await this.authSettingsRepo.findOne({ where: {} });
    return {
      minLength: settings?.passwordMinLength ?? 12,
      requireUppercase: settings?.passwordRequireUppercase ?? true,
      requireLowercase: settings?.passwordRequireLowercase ?? true,
      requireNumbers: settings?.passwordRequireNumbers ?? true,
      requireSymbols: settings?.passwordRequireSymbols ?? true,
      blockCommon: settings?.passwordBlockCommon ?? true,
    };
  }

  /**
   * Get password requirements for display to user
   */
  async getPasswordRequirements(): Promise<{
    minLength: number;
    requirements: string[];
  }> {
    const settings = await this.getAuthSettings();
    const requirements: string[] = [];

    requirements.push(`At least ${settings.minLength} characters`);
    if (settings.requireUppercase) requirements.push('At least one uppercase letter (A-Z)');
    if (settings.requireLowercase) requirements.push('At least one lowercase letter (a-z)');
    if (settings.requireNumbers) requirements.push('At least one number (0-9)');
    if (settings.requireSymbols) requirements.push('At least one special character (!@#$%^&*...)');
    if (settings.blockCommon) requirements.push('Not a commonly used password');

    return {
      minLength: settings.minLength,
      requirements,
    };
  }
}


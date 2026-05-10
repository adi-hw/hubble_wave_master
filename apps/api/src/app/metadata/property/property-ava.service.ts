import { Injectable } from '@nestjs/common';
import { CreatePropertyDto } from './property.service';

@Injectable()
export class PropertyAvaService {

  // Common patterns for property names to data types
  private readonly NAME_PATTERNS: Record<string, string[]> = {
    email: ['email', 'e-mail', 'mail'],
    phone: ['phone', 'mobile', 'cell', 'fax', 'tel'],
    url: ['website', 'url', 'link', 'homepage', 'site'],
    date: ['date', 'dob', 'birthday', 'anniversary', 'deadline'],
    datetime: ['time', 'timestamp', 'created', 'updated', 'at', 'schedule'],
    currency: ['price', 'cost', 'amount', 'total', 'fee', 'salary', 'budget', 'revenue'],
    percentage: ['percent', 'rate', 'ratio', 'probability', 'share'],
    checkbox: ['is_', 'has_', 'can_', 'should_', 'allow_', 'active', 'enabled', 'visible'],
    attachment: ['image', 'photo', 'file', 'document', 'attachment', 'avatar', 'logo'],
    rich_text: ['description', 'bio', 'content', 'body', 'notes', 'comment', 'summary'],
    user: ['user', 'owner', 'assignee', 'creator', 'author', 'manager', 'lead'],
  };

  /**
   * Suggest a property configuration based on a property name/label
   */
  suggestFromName(name: string): Partial<CreatePropertyDto> {
    const normalized = name.toLowerCase().trim();
    const code = normalized.replace(/[^a-z0-9_]/g, '_');

    // 1. Check for exact or pattern matches
    for (const [type, patterns] of Object.entries(this.NAME_PATTERNS)) {
      if (patterns.some(p => normalized.includes(p))) {
        return this.createSuggestion(type, name, code);
      }
    }

    // 2. Default to text
    return this.createSuggestion('text', name, code);
  }

  /**
   * Detect data type from a list of sample string values
   */
  detectTypeFromSamples(samples: string[]): { dataType: string; confidence: number; formatOptions?: any } {
    if (!samples || samples.length === 0) {
      return { dataType: 'text', confidence: 0.1 };
    }

    const cleanSamples = samples.filter(s => s !== null && s !== undefined && s !== '');
    if (cleanSamples.length === 0) {
      return { dataType: 'text', confidence: 0.1 };
    }

    // Check for Boolean
    if (this.checkBoolean(cleanSamples)) return { dataType: 'checkbox', confidence: 0.9 };

    // Check for Email
    if (this.checkEmail(cleanSamples)) return { dataType: 'email', confidence: 0.95 };

    // Check for URL
    if (this.checkUrl(cleanSamples)) return { dataType: 'url', confidence: 0.9 };

    // Check for Date/DateTime
    if (this.checkDate(cleanSamples)) return { dataType: 'datetime', confidence: 0.85 };

    // Check for Number/Currency
    const numberCheck = this.checkNumber(cleanSamples);
    if (numberCheck.isNumber) {
        if (numberCheck.isCurrency) return { dataType: 'currency', confidence: 0.8, formatOptions: { currency: '$' } };
        return { dataType: 'number', confidence: 0.9 };
    }

    // Default to Text
    if (cleanSamples.some(s => s.length > 255)) {
        return { dataType: 'long_text', confidence: 0.7 };
    }

    return { dataType: 'text', confidence: 0.5 };
  }

  private createSuggestion(dataType: string, label: string, code: string): Partial<CreatePropertyDto> {
    return {
      label,
      code,
      dataType,
      isSystem: false,
      isRequired: false,
      isUnique: false, // Default to false, let user decide
      showInGrid: true,
      showInDetail: true,
    } as any;
  }

  // --- Type Checkers ---

  private checkBoolean(samples: string[]): boolean {
    const bools = new Set(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']);
    return samples.every(s => bools.has(s.toLowerCase()));
  }

  private checkEmail(samples: string[]): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return samples.every(s => emailRegex.test(s));
  }

  private checkUrl(samples: string[]): boolean {
    try {
      return samples.every(s => {
          new URL(s); // Will throw if invalid
          return true;
      });
    } catch {
      return false;
    }
  }

  private checkDate(samples: string[]): boolean {
    return samples.every(s => !isNaN(Date.parse(s)));
  }

  private checkNumber(samples: string[]): { isNumber: boolean; isCurrency: boolean } {
    let isNumber = true;
    let isCurrency = false;
    
    for (const s of samples) {
        if (s.startsWith('$') || s.endsWith('USD') || s.endsWith('€') || s.endsWith('£')) {
            isCurrency = true;
        }
        const clean = s.replace(/[^0-9.-]/g, '');
        if (isNaN(parseFloat(clean)) || !isFinite(parseFloat(clean))) {
            isNumber = false;
            break;
        }
    }
    return { isNumber, isCurrency };
  }
}

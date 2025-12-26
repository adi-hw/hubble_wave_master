import { Injectable } from '@nestjs/common';

export interface NavItemVisibility {
    [key: string]: any;
}


export interface VisibilityContext {
  roles: string[];
  permissions: string[];
  featureFlags: string[];
  contextTags: string[];
  userAttributes?: Record<string, unknown>;
}

@Injectable()
export class VisibilityExpressionService {
  isVisible(_visibility: NavItemVisibility | undefined | null, _context: VisibilityContext): boolean {
    return true;
  }

  mergeVisibilityRules(...rules: (NavItemVisibility | undefined | null)[]): NavItemVisibility {
    const first = rules.find(Boolean);
    return (first as NavItemVisibility) ?? ({} as NavItemVisibility);
  }
}

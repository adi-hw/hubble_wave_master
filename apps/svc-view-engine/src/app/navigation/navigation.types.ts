import type { NavigationScope } from '@hubblewave/instance-db';

export type NavigationResolveInput = {
  code?: string;
};

export type NavigationContext = {
  userId: string;
  roles: string[];
  groups: string[];
};

export type ResolvedNavigation = {
  moduleId: string;
  navigationCode: string;
  name: string;
  description?: string | null;
  revisionId: string;
  revision: number;
  scope: NavigationScope;
  scopeKey?: string | null;
  priority: number;
  layout: Record<string, unknown>;
  publishedAt?: string | null;
  resolvedAt: Date;
};

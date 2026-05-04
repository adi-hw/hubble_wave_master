// Test-only stub for `@hubblewave/auth-guard`. The real package depends
// on the in-flight instance-db barrel through identity types; we expose
// only the RequestContext shape svc-automation references.

export interface RequestContext {
  userId: string;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
}

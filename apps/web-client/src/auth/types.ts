export interface CurrentUser {
  userId: string;
  tenantId: string;
  displayName: string;
  username?: string;
  email?: string;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  roles: string[];
  permissions: string[];
}

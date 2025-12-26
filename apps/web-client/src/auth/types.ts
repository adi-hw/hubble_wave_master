export interface CurrentUser {
  userId: string;
  displayName: string;
  username?: string;
  email?: string;
  isAdmin: boolean;
  roles: string[];
  permissions: string[];
}

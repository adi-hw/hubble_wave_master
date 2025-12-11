export class UserProfileDto {
  id!: string;
  username!: string;
  tenantId!: string;
  roles!: string[];
  permissions!: string[];
  displayName?: string;
  email?: string;
}

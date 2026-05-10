export class UserProfileDto {
  id!: string;
  username!: string;
  roles!: string[];
  permissions!: string[];
  displayName?: string;
  email?: string;
}

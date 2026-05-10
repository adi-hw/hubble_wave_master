export class UserProfileDto {
  id!: string;
  username!: string;
  email!: string;
  displayName?: string;
  roles!: string[];
  permissions!: string[];
  isAdmin?: boolean;
}

export class LoginResponseDto {
  accessToken!: string;
  refreshToken?: string;
  expiresIn?: number;
  user!: UserProfileDto;
  mfaRequired?: boolean;
  passwordExpired?: boolean;
  message?: string;
}

export class TokenRefreshResponseDto {
  accessToken!: string;
  refreshToken?: string;
}

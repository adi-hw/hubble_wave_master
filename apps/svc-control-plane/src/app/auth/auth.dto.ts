import { IsEmail, IsOptional, IsString, MinLength, MaxLength, IsIn } from 'class-validator';
import { ControlPlaneRole } from '@hubblewave/control-plane-db';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  mfaCode?: string;
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsIn(['super_admin', 'admin', 'operator', 'viewer'])
  role?: ControlPlaneRole;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(100)
  newPassword!: string;
}

export class VerifyMfaDto {
  @IsString()
  @MaxLength(10)
  code!: string;
}

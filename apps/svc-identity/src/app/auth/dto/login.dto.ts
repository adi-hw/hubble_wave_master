import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsOptional()
  instanceSlug?: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  mfaToken?: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}

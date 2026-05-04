import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const CODE_PATTERN = /^[a-z][a-z0-9_-]*$/;

export class CreateApplicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(CODE_PATTERN, {
    message:
      'code must start with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  scope?: string;
}

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  scope?: string;
}

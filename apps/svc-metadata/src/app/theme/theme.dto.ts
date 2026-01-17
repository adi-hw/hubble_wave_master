import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, IsObject } from 'class-validator';

const THEME_TYPE = ['system', 'instance', 'custom'] as const;
const CONTRAST = ['normal', 'high', 'highest'] as const;
const SCHEME = ['dark', 'light'] as const;
const COLOR_SCHEME_PREF = ['dark', 'light', 'auto'] as const;

export class CreateThemeDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  config!: Record<string, unknown>;

  @IsIn(THEME_TYPE as unknown as string[])
  @IsOptional()
  themeType?: (typeof THEME_TYPE)[number];

  @IsIn(CONTRAST as unknown as string[])
  @IsOptional()
  contrastLevel?: (typeof CONTRAST)[number];

  @IsIn(SCHEME as unknown as string[])
  @IsOptional()
  colorScheme?: (typeof SCHEME)[number];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePreferenceDto {
  @IsOptional()
  @IsString()
  themeId?: string | null;

  @IsOptional()
  @IsBoolean()
  autoDarkMode?: boolean;

  @IsOptional()
  @IsIn(COLOR_SCHEME_PREF as unknown as string[])
  colorScheme?: 'dark' | 'light' | 'auto';

  @IsOptional()
  @IsObject()
  customOverrides?: Record<string, unknown>;
}

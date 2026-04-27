import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  IsObject,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const THEME_TYPE = ['system', 'instance', 'custom'] as const;
const CONTRAST = ['normal', 'high', 'highest'] as const;
const SCHEME = ['dark', 'light'] as const;
const COLOR_SCHEME_PREF = ['dark', 'light', 'auto'] as const;

// Theme config is a constrained projection: only these top-level keys are allowed,
// and no nested string value may contain script-injection markers.
const ALLOWED_CONFIG_KEYS = new Set(['colors', 'fonts', 'spacing', 'radii']);
const SCRIPT_PATTERN = /<script\b|javascript:|\son\w+\s*=/i;

function assertSafeConfig(config: unknown, path = 'config'): string | null {
  if (config === null || config === undefined) return null;

  if (typeof config === 'string') {
    if (SCRIPT_PATTERN.test(config)) {
      return `${path} contains disallowed script content`;
    }
    return null;
  }

  if (Array.isArray(config)) {
    for (let i = 0; i < config.length; i++) {
      const err = assertSafeConfig(config[i], `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }

  if (typeof config === 'object') {
    if (path === 'config') {
      for (const key of Object.keys(config as Record<string, unknown>)) {
        if (!ALLOWED_CONFIG_KEYS.has(key)) {
          return `config.${key} is not an allowed top-level key`;
        }
      }
    }
    for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
      if (SCRIPT_PATTERN.test(key)) {
        return `${path}.${key} key contains disallowed script content`;
      }
      const err = assertSafeConfig(value, `${path}.${key}`);
      if (err) return err;
    }
    return null;
  }

  return null;
}

function IsSafeThemeConfig(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeThemeConfig',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return assertSafeConfig(value) === null;
        },
        defaultMessage(args: ValidationArguments) {
          return assertSafeConfig(args.value) || 'Invalid theme config';
        },
      },
    });
  };
}

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
  @IsSafeThemeConfig()
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
  @IsSafeThemeConfig()
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

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

// Theme configuration structure matching the database JSONB schema
export interface ThemeConfig {
  colors: {
    // Surface colors (void palette)
    voidPure: string;
    voidDeep: string;
    voidSpace: string;
    voidSurface: string;
    voidElevated: string;
    voidOverlay: string;
    // Primary spectrum
    primary50: string;
    primary100: string;
    primary200: string;
    primary300: string;
    primary400: string;
    primary500: string;
    primary600: string;
    primary700: string;
    primary800: string;
    primary900: string;
    // Accent spectrum
    accent50: string;
    accent100: string;
    accent200: string;
    accent300: string;
    accent400: string;
    accent500: string;
    accent600: string;
    accent700: string;
    accent800: string;
    accent900: string;
    // Gray spectrum
    gray100: string;
    gray200: string;
    gray300: string;
    gray400: string;
    gray500: string;
    gray600: string;
    gray700: string;
    gray800: string;
    // Semantic colors
    success: string;
    warning: string;
    danger: string;
    info: string;
    // Text colors
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    textMuted: string;
  };
  glass: {
    bg: string;
    bgHover: string;
    bgActive: string;
    border: string;
    borderHover: string;
    blur: string;
  };
  spacing: {
    radiusSm: string;
    radiusMd: string;
    radiusLg: string;
    radiusXl: string;
  };
}

export type ThemeType = 'system' | 'instance' | 'custom';
export type ContrastLevel = 'normal' | 'high' | 'highest';
export type ColorScheme = 'dark' | 'light';
export type ColorSchemePref = 'dark' | 'light' | 'auto';
export type PreferenceSource = 'manual' | 'suggested' | 'imported' | 'default';

@Entity('theme_definitions')
@Index(['code'], { unique: true })
@Index(['isDefault'])
@Index(['themeType'])
@Index(['colorScheme'])
export class ThemeDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', default: {} })
  config!: ThemeConfig;

  @Column({ name: 'theme_type', default: 'custom' })
  themeType!: ThemeType;

  @Column({ name: 'contrast_level', default: 'normal' })
  contrastLevel!: ContrastLevel;

  @Column({ name: 'color_scheme', default: 'dark' })
  colorScheme!: ColorScheme;

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'is_deletable', default: true })
  isDeletable!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('user_theme_preferences')
@Index(['userId'], { unique: true })
export class UserThemePreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'theme_id', type: 'uuid', nullable: true })
  themeId?: string | null;

  @ManyToOne(() => ThemeDefinition, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'theme_id' })
  theme?: ThemeDefinition;

  @Column({ type: 'jsonb', name: 'custom_overrides', default: {} })
  customOverrides!: Record<string, unknown>;

  @Column({ name: 'color_scheme', default: 'auto' })
  colorScheme!: ColorSchemePref;

  @Column({ name: 'auto_dark_mode', default: true })
  autoDarkMode!: boolean;

  @Column({ name: 'respect_reduced_motion', default: true })
  respectReducedMotion!: boolean;

  @Column({ name: 'preference_source', default: 'manual' })
  preferenceSource!: PreferenceSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('instance_branding')
export class InstanceBranding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'default_theme_id', type: 'uuid', nullable: true })
  defaultThemeId?: string | null;

  @ManyToOne(() => ThemeDefinition, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'default_theme_id' })
  defaultTheme?: ThemeDefinition;

  @Column({ type: 'jsonb', name: 'theme_overrides', default: {} })
  themeOverrides!: Record<string, unknown>;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl?: string;

  @Column({ name: 'logo_dark_url', type: 'varchar', length: 500, nullable: true })
  logoDarkUrl?: string;

  @Column({ name: 'favicon_url', type: 'varchar', length: 500, nullable: true })
  faviconUrl?: string;

  @Column({ name: 'primary_color', type: 'varchar', length: 7, nullable: true })
  primaryColor?: string;

  @Column({ name: 'accent_color', type: 'varchar', length: 7, nullable: true })
  accentColor?: string;

  @Column({ name: 'custom_css', type: 'text', nullable: true })
  customCss?: string;

  @Column({ name: 'allow_user_customization', default: true })
  allowUserCustomization!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

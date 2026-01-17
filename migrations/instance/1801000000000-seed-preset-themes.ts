import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the 5 preset themes for HubbleWave
 * - Void Dark (default) - Primary dark theme with indigo/cyan accents
 * - Light - Clean light mode for bright environments
 * - High Contrast Dark - Accessibility-focused with enhanced contrast
 * - Ocean - Blue-tinted dark theme
 * - Forest - Green-tinted dark theme
 */
export class SeedPresetThemes1801000000000 implements MigrationInterface {
  name = 'SeedPresetThemes1801000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Void Dark Theme (Default)
    await queryRunner.query(`
      INSERT INTO theme_definitions (
        id, code, name, description, theme_type, color_scheme, contrast_level,
        is_default, is_active, is_deletable, config, created_at, updated_at
      ) VALUES (
        'a0000000-0000-0000-0000-000000000001',
        'void-dark',
        'Void Dark',
        'The signature HubbleWave dark theme with deep space backgrounds and indigo/cyan accents',
        'system',
        'dark',
        'normal',
        true,
        true,
        false,
        '{
          "colors": {
            "voidPure": "#0a0a0b",
            "voidDeep": "#0f0f14",
            "voidSpace": "#16161d",
            "voidSurface": "#1c1c26",
            "voidElevated": "#252532",
            "voidOverlay": "rgba(0, 0, 0, 0.75)",
            "primary50": "#eef2ff",
            "primary100": "#e0e7ff",
            "primary200": "#c7d2fe",
            "primary300": "#a5b4fc",
            "primary400": "#818cf8",
            "primary500": "#6366f1",
            "primary600": "#4f46e5",
            "primary700": "#4338ca",
            "primary800": "#3730a3",
            "primary900": "#312e81",
            "accent50": "#ecfeff",
            "accent100": "#cffafe",
            "accent200": "#a5f3fc",
            "accent300": "#67e8f9",
            "accent400": "#22d3ee",
            "accent500": "#06b6d4",
            "accent600": "#0891b2",
            "accent700": "#0e7490",
            "accent800": "#155e75",
            "accent900": "#164e63",
            "gray100": "#f5f5f4",
            "gray200": "#e7e5e4",
            "gray300": "#d6d3d1",
            "gray400": "#a8a29e",
            "gray500": "#78716c",
            "gray600": "#57534e",
            "gray700": "#44403c",
            "gray800": "#292524",
            "success": "#22c55e",
            "warning": "#f59e0b",
            "danger": "#ef4444",
            "info": "#3b82f6",
            "textPrimary": "#fafafa",
            "textSecondary": "#a1a1aa",
            "textTertiary": "#71717a",
            "textMuted": "#52525b"
          },
          "glass": {
            "bg": "rgba(22, 22, 29, 0.7)",
            "bgHover": "rgba(28, 28, 38, 0.8)",
            "bgActive": "rgba(37, 37, 50, 0.9)",
            "border": "rgba(99, 102, 241, 0.2)",
            "borderHover": "rgba(99, 102, 241, 0.4)",
            "blur": "12px"
          },
          "spacing": {
            "radiusSm": "0.25rem",
            "radiusMd": "0.375rem",
            "radiusLg": "0.5rem",
            "radiusXl": "0.75rem"
          }
        }'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        updated_at = NOW()
    `);

    // Light Theme
    await queryRunner.query(`
      INSERT INTO theme_definitions (
        id, code, name, description, theme_type, color_scheme, contrast_level,
        is_default, is_active, is_deletable, config, created_at, updated_at
      ) VALUES (
        'a0000000-0000-0000-0000-000000000002',
        'light',
        'Light',
        'Clean and bright light theme for well-lit environments',
        'system',
        'light',
        'normal',
        false,
        true,
        false,
        '{
          "colors": {
            "voidPure": "#ffffff",
            "voidDeep": "#fafaf9",
            "voidSpace": "#f5f5f4",
            "voidSurface": "#ffffff",
            "voidElevated": "#ffffff",
            "voidOverlay": "rgba(0, 0, 0, 0.5)",
            "primary50": "#eef2ff",
            "primary100": "#e0e7ff",
            "primary200": "#c7d2fe",
            "primary300": "#a5b4fc",
            "primary400": "#818cf8",
            "primary500": "#6366f1",
            "primary600": "#4f46e5",
            "primary700": "#4338ca",
            "primary800": "#3730a3",
            "primary900": "#312e81",
            "accent50": "#ecfeff",
            "accent100": "#cffafe",
            "accent200": "#a5f3fc",
            "accent300": "#67e8f9",
            "accent400": "#22d3ee",
            "accent500": "#06b6d4",
            "accent600": "#0891b2",
            "accent700": "#0e7490",
            "accent800": "#155e75",
            "accent900": "#164e63",
            "gray100": "#f5f5f4",
            "gray200": "#e7e5e4",
            "gray300": "#d6d3d1",
            "gray400": "#a8a29e",
            "gray500": "#78716c",
            "gray600": "#57534e",
            "gray700": "#44403c",
            "gray800": "#292524",
            "success": "#22c55e",
            "warning": "#f59e0b",
            "danger": "#ef4444",
            "info": "#3b82f6",
            "textPrimary": "#1c1917",
            "textSecondary": "#57534e",
            "textTertiary": "#78716c",
            "textMuted": "#a8a29e"
          },
          "glass": {
            "bg": "rgba(255, 255, 255, 0.8)",
            "bgHover": "rgba(250, 250, 249, 0.9)",
            "bgActive": "rgba(245, 245, 244, 0.95)",
            "border": "rgba(99, 102, 241, 0.15)",
            "borderHover": "rgba(99, 102, 241, 0.3)",
            "blur": "12px"
          },
          "spacing": {
            "radiusSm": "0.25rem",
            "radiusMd": "0.375rem",
            "radiusLg": "0.5rem",
            "radiusXl": "0.75rem"
          }
        }'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        updated_at = NOW()
    `);

    // High Contrast Dark Theme
    await queryRunner.query(`
      INSERT INTO theme_definitions (
        id, code, name, description, theme_type, color_scheme, contrast_level,
        is_default, is_active, is_deletable, config, created_at, updated_at
      ) VALUES (
        'a0000000-0000-0000-0000-000000000003',
        'high-contrast-dark',
        'High Contrast Dark',
        'Accessibility-focused dark theme with enhanced contrast ratios (WCAG AAA)',
        'system',
        'dark',
        'high',
        false,
        true,
        false,
        '{
          "colors": {
            "voidPure": "#000000",
            "voidDeep": "#0a0a0a",
            "voidSpace": "#121212",
            "voidSurface": "#1a1a1a",
            "voidElevated": "#222222",
            "voidOverlay": "rgba(0, 0, 0, 0.85)",
            "primary50": "#f0f5ff",
            "primary100": "#e5edff",
            "primary200": "#cddbfe",
            "primary300": "#b4c6fc",
            "primary400": "#9aabf9",
            "primary500": "#7c8cf5",
            "primary600": "#6366f1",
            "primary700": "#4f46e5",
            "primary800": "#3730a3",
            "primary900": "#312e81",
            "accent50": "#f0fdff",
            "accent100": "#e0fafe",
            "accent200": "#b8f3fc",
            "accent300": "#7eeaf9",
            "accent400": "#3cdcf0",
            "accent500": "#14c8e4",
            "accent600": "#06b6d4",
            "accent700": "#0891b2",
            "accent800": "#155e75",
            "accent900": "#164e63",
            "gray100": "#ffffff",
            "gray200": "#f5f5f5",
            "gray300": "#e0e0e0",
            "gray400": "#c0c0c0",
            "gray500": "#909090",
            "gray600": "#606060",
            "gray700": "#404040",
            "gray800": "#303030",
            "success": "#4ade80",
            "warning": "#fbbf24",
            "danger": "#f87171",
            "info": "#60a5fa",
            "textPrimary": "#ffffff",
            "textSecondary": "#e0e0e0",
            "textTertiary": "#b0b0b0",
            "textMuted": "#808080"
          },
          "glass": {
            "bg": "rgba(18, 18, 18, 0.85)",
            "bgHover": "rgba(26, 26, 26, 0.9)",
            "bgActive": "rgba(34, 34, 34, 0.95)",
            "border": "rgba(124, 140, 245, 0.4)",
            "borderHover": "rgba(124, 140, 245, 0.6)",
            "blur": "8px"
          },
          "spacing": {
            "radiusSm": "0.25rem",
            "radiusMd": "0.375rem",
            "radiusLg": "0.5rem",
            "radiusXl": "0.75rem"
          }
        }'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        updated_at = NOW()
    `);

    // Ocean Theme
    await queryRunner.query(`
      INSERT INTO theme_definitions (
        id, code, name, description, theme_type, color_scheme, contrast_level,
        is_default, is_active, is_deletable, config, created_at, updated_at
      ) VALUES (
        'a0000000-0000-0000-0000-000000000004',
        'ocean',
        'Ocean',
        'Deep blue-tinted dark theme inspired by the ocean depths',
        'system',
        'dark',
        'normal',
        false,
        true,
        false,
        '{
          "colors": {
            "voidPure": "#080c12",
            "voidDeep": "#0c1219",
            "voidSpace": "#111a24",
            "voidSurface": "#16222f",
            "voidElevated": "#1c2a3a",
            "voidOverlay": "rgba(8, 12, 18, 0.8)",
            "primary50": "#e0f7ff",
            "primary100": "#b8ebff",
            "primary200": "#85dcff",
            "primary300": "#52c7ff",
            "primary400": "#29b1ff",
            "primary500": "#0096e6",
            "primary600": "#0077b8",
            "primary700": "#005a8a",
            "primary800": "#003d5c",
            "primary900": "#002133",
            "accent50": "#e0fff7",
            "accent100": "#b8ffeb",
            "accent200": "#85ffdc",
            "accent300": "#52ffc7",
            "accent400": "#29ffb1",
            "accent500": "#00e696",
            "accent600": "#00b877",
            "accent700": "#008a5a",
            "accent800": "#005c3d",
            "accent900": "#003321",
            "gray100": "#e8eef4",
            "gray200": "#c8d4e0",
            "gray300": "#a8bacc",
            "gray400": "#8899aa",
            "gray500": "#687888",
            "gray600": "#4a5a6a",
            "gray700": "#3a4a5a",
            "gray800": "#2a3a4a",
            "success": "#22c55e",
            "warning": "#f59e0b",
            "danger": "#ef4444",
            "info": "#0096e6",
            "textPrimary": "#f0f6fc",
            "textSecondary": "#a8bacc",
            "textTertiary": "#8899aa",
            "textMuted": "#687888"
          },
          "glass": {
            "bg": "rgba(17, 26, 36, 0.75)",
            "bgHover": "rgba(22, 34, 47, 0.85)",
            "bgActive": "rgba(28, 42, 58, 0.9)",
            "border": "rgba(0, 150, 230, 0.25)",
            "borderHover": "rgba(0, 150, 230, 0.45)",
            "blur": "14px"
          },
          "spacing": {
            "radiusSm": "0.25rem",
            "radiusMd": "0.375rem",
            "radiusLg": "0.5rem",
            "radiusXl": "0.75rem"
          }
        }'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        updated_at = NOW()
    `);

    // Forest Theme
    await queryRunner.query(`
      INSERT INTO theme_definitions (
        id, code, name, description, theme_type, color_scheme, contrast_level,
        is_default, is_active, is_deletable, config, created_at, updated_at
      ) VALUES (
        'a0000000-0000-0000-0000-000000000005',
        'forest',
        'Forest',
        'Earthy green-tinted dark theme inspired by nature',
        'system',
        'dark',
        'normal',
        false,
        true,
        false,
        '{
          "colors": {
            "voidPure": "#080c08",
            "voidDeep": "#0c120c",
            "voidSpace": "#111a11",
            "voidSurface": "#162216",
            "voidElevated": "#1c2a1c",
            "voidOverlay": "rgba(8, 12, 8, 0.8)",
            "primary50": "#e8f5e9",
            "primary100": "#c8e6c9",
            "primary200": "#a5d6a7",
            "primary300": "#81c784",
            "primary400": "#66bb6a",
            "primary500": "#4caf50",
            "primary600": "#43a047",
            "primary700": "#388e3c",
            "primary800": "#2e7d32",
            "primary900": "#1b5e20",
            "accent50": "#fff8e1",
            "accent100": "#ffecb3",
            "accent200": "#ffe082",
            "accent300": "#ffd54f",
            "accent400": "#ffca28",
            "accent500": "#ffc107",
            "accent600": "#ffb300",
            "accent700": "#ffa000",
            "accent800": "#ff8f00",
            "accent900": "#ff6f00",
            "gray100": "#e8ede8",
            "gray200": "#c8d4c8",
            "gray300": "#a8baa8",
            "gray400": "#889988",
            "gray500": "#687868",
            "gray600": "#4a5a4a",
            "gray700": "#3a4a3a",
            "gray800": "#2a3a2a",
            "success": "#4caf50",
            "warning": "#ffc107",
            "danger": "#ef4444",
            "info": "#3b82f6",
            "textPrimary": "#f0f6f0",
            "textSecondary": "#a8baa8",
            "textTertiary": "#889988",
            "textMuted": "#687868"
          },
          "glass": {
            "bg": "rgba(17, 26, 17, 0.75)",
            "bgHover": "rgba(22, 34, 22, 0.85)",
            "bgActive": "rgba(28, 42, 28, 0.9)",
            "border": "rgba(76, 175, 80, 0.25)",
            "borderHover": "rgba(76, 175, 80, 0.45)",
            "blur": "14px"
          },
          "spacing": {
            "radiusSm": "0.25rem",
            "radiusMd": "0.375rem",
            "radiusLg": "0.5rem",
            "radiusXl": "0.75rem"
          }
        }'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        updated_at = NOW()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM theme_definitions
      WHERE code IN ('void-dark', 'light', 'high-contrast-dark', 'ocean', 'forest')
    `);
  }
}

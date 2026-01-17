import { z } from 'zod';

export const PackAssetTypeSchema = z.enum([
  'metadata',
  'access',
  'search',
  'views',
  'navigation',
  'connectors',
  'localization',
  'automation',
  'workflows',
  'insights',
  'ava',
  'seed',
]);

export type PackAssetType = z.infer<typeof PackAssetTypeSchema>;

const AssetSchema = z.object({
  type: PackAssetTypeSchema,
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const DependencySchema = z.object({
  code: z.string().min(1),
  min_release_id: z.string().min(1),
});

const CompatibilitySchema = z.object({
  platform_min_release_id: z.string().min(1),
  platform_max_release_id: z.string().min(1),
});

const PackSchema = z.object({
  code: z.string().min(1).max(200),
  name: z.string().min(1).max(255),
  release_id: z.string().regex(/^\d{8}\.\d{3,}$/),
  publisher: z.string().min(1).max(100),
  description: z.string().min(1),
  license: z.string().min(1).max(100),
  installable_by_client: z.boolean().optional(),
});

const InstallSchema = z.object({
  lock_key: z.string().min(1),
  apply_order: z.array(PackAssetTypeSchema).min(1),
});

const SigningSchema = z.object({
  algorithm: z.literal('ed25519'),
  public_key_id: z.string().min(1),
});

export const PackManifestSchema = z.object({
  manifest: z.literal('hubblewave.pack'),
  manifest_revision: z.number().int().min(1),
  pack: PackSchema,
  dependencies: z.array(DependencySchema).optional(),
  compatibility: CompatibilitySchema,
  assets: z.array(AssetSchema).min(1),
  install: InstallSchema,
  signing: SigningSchema,
}).superRefine((manifest, ctx) => {
  const applyOrder = manifest.install.apply_order;
  const uniqueApplyOrder = new Set(applyOrder);

  if (uniqueApplyOrder.size !== applyOrder.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'install.apply_order must not contain duplicates',
      path: ['install', 'apply_order'],
    });
  }

  const assetTypes = new Set(manifest.assets.map((asset) => asset.type));
  for (const assetType of assetTypes) {
    if (!uniqueApplyOrder.has(assetType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `install.apply_order must include asset type "${assetType}"`,
        path: ['install', 'apply_order'],
      });
    }
  }

  for (const applyType of uniqueApplyOrder) {
    if (!assetTypes.has(applyType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `install.apply_order includes "${applyType}" without matching assets`,
        path: ['install', 'apply_order'],
      });
    }
  }
});

export type PackManifest = z.infer<typeof PackManifestSchema>;

export function validatePackManifest(input: unknown): PackManifest {
  return PackManifestSchema.parse(input);
}

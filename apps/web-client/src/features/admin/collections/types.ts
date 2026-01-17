/**
 * Owner type for collection governance
 * - system: Immutable platform collections (users, roles, permissions)
 * - platform: Core platform collections, extensible only
 * - custom: User-created collections with full control
 */
export type OwnerType = 'system' | 'platform' | 'custom';

/**
 * Collection interface aligned with database schema (collection_definitions table)
 */
export interface Collection {
  id: string;
  code: string;

  // Display names
  name: string;
  pluralName?: string;
  description?: string;
  icon?: string;
  color?: string;

  // Storage
  tableName: string;

  // Governance
  ownerType: OwnerType;
  isSystem: boolean;
  isExtensible: boolean;

  // Features
  isAudited: boolean;
  enableVersioning: boolean;
  enableAttachments: boolean;
  enableActivityLog: boolean;
  enableSearch: boolean;

  // Classification
  applicationId?: string;
  category?: string;

  // Access control
  defaultAccess: string;
  labelProperty: string;
  secondaryLabelProperty?: string;

  // Metadata
  metadata?: Record<string, unknown>;

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;

  // Runtime computed (not persisted)
  recordCount?: number;
  propertyCount?: number;

  // Optional fields from entity (not always present)
  tags?: string[];
  publishedAt?: string;
  isActive?: boolean;
}

/**
 * Collection statistics for dashboard display
 */
export interface CollectionStats {
  total: number;
  byOwnerType: {
    system: number;
    platform: number;
    custom: number;
  };
  byCategory: Record<string, number>;
  totalProperties: number;
  totalRecords: number;
}

/**
 * View mode for collections list
 */
export type ViewMode = 'grid' | 'table';

/**
 * Filter options for collections list
 */
export interface CollectionFilters {
  search: string;
  category: string;
  ownerType: OwnerType | 'all';
  includeSystem: boolean;
}

/**
 * Normalize collection data from API
 */
export function normalizeCollection(data: Partial<Collection>): Collection {
  return {
    id: data.id || '',
    code: data.code || '',

    // Display names
    name: data.name || '',
    pluralName: data.pluralName,
    description: data.description,
    icon: data.icon,
    color: data.color,

    // Storage
    tableName: data.tableName || '',

    // Governance
    ownerType: data.ownerType || 'custom',
    isSystem: data.isSystem ?? false,
    isExtensible: data.isExtensible ?? true,

    // Features
    isAudited: data.isAudited ?? true,
    enableVersioning: data.enableVersioning ?? false,
    enableAttachments: data.enableAttachments ?? true,
    enableActivityLog: data.enableActivityLog ?? true,
    enableSearch: data.enableSearch ?? true,

    // Classification
    applicationId: data.applicationId,
    category: data.category,

    // Access
    defaultAccess: data.defaultAccess || 'read',
    labelProperty: data.labelProperty || 'name',
    secondaryLabelProperty: data.secondaryLabelProperty,

    // Metadata
    metadata: data.metadata || {},

    // Audit
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,

    // Runtime
    recordCount: data.recordCount,
    propertyCount: data.propertyCount,
    tags: data.tags || [],
    publishedAt: data.publishedAt,
    isActive: data.isActive ?? true,
  };
}

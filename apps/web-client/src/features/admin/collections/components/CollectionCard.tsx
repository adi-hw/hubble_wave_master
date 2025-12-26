import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  MoreHorizontal,
  Settings,
  Copy,
  Eye,
  Trash2,
  Lock,
  Shield,
  Building2,
  Pencil,
  Table,
  ExternalLink,
} from 'lucide-react';
import { Collection, OwnerType } from '../types';

interface CollectionCardProps {
  collection: Collection;
  onAction: (collectionId: string, action: string) => void;
}

/**
 * Get display name for collection (handles name/label mapping)
 */
const getDisplayName = (collection: Collection): string => {
  return collection.name || collection.label || collection.code;
};

/**
 * Owner type badge configuration
 */
const ownerTypeConfig: Record<OwnerType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  system: {
    label: 'System',
    icon: Lock,
    color: 'var(--text-error)',
    bgColor: 'var(--bg-error-subtle)',
  },
  platform: {
    label: 'Platform',
    icon: Building2,
    color: 'var(--text-warning)',
    bgColor: 'var(--bg-warning-subtle)',
  },
  custom: {
    label: 'Custom',
    icon: Pencil,
    color: 'var(--text-success)',
    bgColor: 'var(--bg-success-subtle)',
  },
};

/**
 * Owner type badge component
 */
const OwnerTypeBadge: React.FC<{ ownerType: OwnerType }> = ({ ownerType }) => {
  const config = ownerTypeConfig[ownerType];
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: config.bgColor, color: config.color }}
      title={`${config.label} collection - ${
        ownerType === 'system'
          ? 'Cannot be modified'
          : ownerType === 'platform'
            ? 'Can add custom properties'
            : 'Full control'
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
};

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onAction }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Determine owner type (fallback to custom if not set)
  const ownerType: OwnerType = collection.ownerType || (collection.isSystem ? 'system' : 'custom');

  // Determine if collection can be modified
  const canModify = ownerType !== 'system';
  const canDelete = ownerType === 'custom';
  const canExtend = collection.isExtensible !== false;

  return (
    <div
      className="card-interactive group rounded-xl p-4 relative"
      onClick={() => navigate(`/studio/collections/${collection.id}`)}
    >
      {/* Header with icon, name, and owner badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{
              backgroundColor: collection.color
                ? `${collection.color}20`
                : 'var(--bg-surface-secondary)',
            }}
          >
            <Layers
              className="h-4 w-4"
              style={{
                color: collection.color || 'var(--text-muted)',
              }}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              {getDisplayName(collection)}
              {collection.isSystem && (
                <Lock className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
              )}
            </h3>
            <code className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {collection.code}
            </code>
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1.5 opacity-0 group-hover:opacity-100 rounded transition-all focus:opacity-100"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Collection actions"
          >
            <MoreHorizontal className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div
                className="dropdown absolute right-0 top-full mt-1 w-48 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(`/studio/collections/${collection.id}`);
                    }}
                    className="dropdown-item w-full"
                  >
                    <Settings className="h-4 w-4" />
                    {canModify ? 'Edit Collection' : 'View Collection'}
                  </button>
                  {canExtend && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate(`/studio/collections/${collection.id}/properties`);
                      }}
                      className="dropdown-item w-full"
                    >
                      <Layers className="h-4 w-4" />
                      Manage Properties
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(`/data/${collection.code}`);
                    }}
                    className="dropdown-item w-full"
                  >
                    <Table className="h-4 w-4" />
                    View Records
                  </button>
                  {canModify && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onAction(collection.id, 'clone');
                      }}
                      className="dropdown-item w-full"
                    >
                      <Copy className="h-4 w-4" />
                      Clone Collection
                    </button>
                  )}
                  {!collection.publishedAt && canModify && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onAction(collection.id, 'publish');
                      }}
                      className="dropdown-item w-full"
                      style={{ color: 'var(--text-success)' }}
                    >
                      <Eye className="h-4 w-4" />
                      Publish
                    </button>
                  )}
                  {canDelete && (
                    <>
                      <hr className="dropdown-separator" />
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onAction(collection.id, 'delete');
                        }}
                        className="dropdown-item danger w-full"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {collection.description && (
        <p className="text-xs mb-2 line-clamp-2 min-h-[2em]" style={{ color: 'var(--text-secondary)' }}>
          {collection.description}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex items-center gap-1">
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {collection.recordCount ?? 0}
          </span>{' '}
          records
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {collection.propertyCount ?? 0}
          </span>{' '}
          properties
        </div>
        {/* Table name on hover */}
        <div
          className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
          title={`Database table: ${collection.tableName || collection.storageTable}`}
        >
          <ExternalLink className="h-2.5 w-2.5" />
          <span className="truncate max-w-[80px]">{collection.tableName || collection.storageTable}</span>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Owner type badge - always show */}
        <OwnerTypeBadge ownerType={ownerType} />

        {/* Feature badges */}
        {collection.isAudited && (
          <span className="badge-info">
            <Shield className="h-2.5 w-2.5 mr-0.5" />
            Audited
          </span>
        )}
        {(collection.enableVersioning || collection.isVersioned) && (
          <span className="badge-primary">Versioned</span>
        )}
        {!collection.isExtensible && ownerType !== 'system' && (
          <span className="badge-neutral">
            <Lock className="h-2.5 w-2.5 mr-0.5" />
            Locked
          </span>
        )}
        {collection.publishedAt && (
          <span className="badge-success">Published</span>
        )}
        {collection.tags?.slice(0, 2).map((tag) => (
          <span key={tag} className="badge-neutral">
            {tag}
          </span>
        ))}
        {(collection.tags?.length ?? 0) > 2 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            +{collection.tags!.length - 2}
          </span>
        )}
      </div>
    </div>
  );
};

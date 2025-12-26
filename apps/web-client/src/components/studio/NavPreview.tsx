/**
 * NavPreview Component
 *
 * Preview navigation as different roles/permissions.
 */

import React, { useState, useCallback } from 'react';
import { Eye, Users, Key, Flag, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
import { Icon } from '../Icon';
import { ResolvedNavNode } from '../../types/navigation-v2';

interface PreviewContext {
  roles: string[];
  permissions: string[];
  featureFlags: string[];
  contextTags: string[];
}

interface NavPreviewProps {
  nodes: ResolvedNavNode[];
  loading?: boolean;
  onPreview: (context: PreviewContext) => Promise<void>;
  availableRoles?: string[];
  availablePermissions?: string[];
  availableFlags?: string[];
}

interface PreviewTreeProps {
  nodes: ResolvedNavNode[];
  depth?: number;
}

const PreviewTree: React.FC<PreviewTreeProps> = ({ nodes, depth = 0 }) => {
  return (
    <div className={depth > 0 ? 'ml-4 border-l border-slate-200 pl-2' : ''}>
      {nodes.map((node) => (
        <div key={node.key} className="py-1">
          <div 
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:opacity-80 transition-opacity"
            style={{ backgroundColor: 'var(--bg-surface-secondary)' }}
          >
            {node.icon && (
              <span style={{ color: 'var(--text-muted)' }}>
                <Icon name={node.icon} className="h-4 w-4" />
              </span>
            )}
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{node.label}</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{node.type}</span>
          </div>
          {node.children && node.children.length > 0 && (
            <PreviewTree nodes={node.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
};

export const NavPreview: React.FC<NavPreviewProps> = ({
  nodes,
  loading = false,
  onPreview,
  availableRoles = [],
  availablePermissions = [],
  availableFlags = [],
}) => {
  const [context, setContext] = useState<PreviewContext>({
    roles: [],
    permissions: [],
    featureFlags: [],
    contextTags: [],
  });
  const [isExpanded, setIsExpanded] = useState(true);

  const handleRefresh = useCallback(async () => {
    await onPreview(context);
  }, [context, onPreview]);

  const toggleRole = (role: string) => {
    setContext((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const togglePermission = (perm: string) => {
    setContext((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const toggleFlag = (flag: string) => {
    setContext((prev) => ({
      ...prev,
      featureFlags: prev.featureFlags.includes(flag)
        ? prev.featureFlags.filter((f) => f !== flag)
        : [...prev.featureFlags, flag],
    }));
  };

  const contextTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
    setContext((prev) => ({ ...prev, contextTags: tags }));
  };

  // Preset configurations
  const presets = [
    { label: 'Admin', roles: ['admin', 'admin'], permissions: [], flags: [] },
    { label: 'Standard User', roles: ['user'], permissions: ['asset.view'], flags: [] },
    { label: 'Mobile User', roles: ['user'], permissions: [], flags: [], tags: ['mobile'] },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setContext({
      roles: preset.roles,
      permissions: preset.permissions,
      featureFlags: preset.flags,
      contextTags: (preset as any).tags || [],
    });
  };

  return (
    <div 
      className="h-full flex flex-col rounded-xl overflow-hidden border"
      style={{ 
        backgroundColor: 'var(--bg-surface)', 
        borderColor: 'var(--border-default)' 
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ 
          backgroundColor: 'var(--bg-surface-secondary)', 
          borderColor: 'var(--border-default)' 
        }}
      >
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Preview</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      {/* Context Editor */}
      <div className="flex-shrink-0 border-b" style={{ borderColor: 'var(--border-default)' }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          {isExpanded ? (
            <ChevronRight className="h-4 w-4 rotate-90 transition-transform" />
          ) : (
            <ChevronRight className="h-4 w-4 transition-transform" />
          )}
          Preview Context
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4">
            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="px-2.5 py-1 text-xs font-medium rounded transition-colors"
                  style={{ 
                    backgroundColor: 'var(--bg-surface-secondary)',
                    color: 'var(--text-muted)' 
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Roles */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                <Users className="h-3.5 w-3.5" />
                Roles
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableRoles.slice(0, 10).map((role) => (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    className="px-2 py-0.5 text-xs rounded transition-colors border"
                    style={{
                      backgroundColor: context.roles.includes(role) ? 'var(--bg-selected)' : 'var(--bg-surface-secondary)',
                      borderColor: context.roles.includes(role) ? 'var(--border-primary)' : 'var(--border-default)',
                      color: context.roles.includes(role) ? 'var(--text-brand)' : 'var(--text-muted)'
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                <Key className="h-3.5 w-3.5" />
                Permissions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availablePermissions.slice(0, 10).map((perm) => (
                  <button
                    key={perm}
                    onClick={() => togglePermission(perm)}
                    className="px-2 py-0.5 text-xs rounded transition-colors border"
                    style={{
                      backgroundColor: context.permissions.includes(perm) ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface-secondary)',
                      borderColor: context.permissions.includes(perm) ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-default)',
                      color: context.permissions.includes(perm) ? 'rgb(16, 185, 129)' : 'var(--text-muted)'
                    }}
                  >
                    {perm}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Flags */}
            {availableFlags.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  <Flag className="h-3.5 w-3.5" />
                  Feature Flags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableFlags.map((flag) => (
                    <button
                      key={flag}
                      onClick={() => toggleFlag(flag)}
                      className="px-2 py-0.5 text-xs rounded transition-colors border"
                      style={{
                        backgroundColor: context.featureFlags.includes(flag) ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg-surface-secondary)',
                        borderColor: context.featureFlags.includes(flag) ? 'rgba(168, 85, 247, 0.2)' : 'var(--border-default)',
                        color: context.featureFlags.includes(flag) ? 'rgb(168, 85, 247)' : 'var(--text-muted)'
                      }}
                    >
                      {flag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Context Tags */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Context Tags
              </label>
              <input
                type="text"
                value={context.contextTags.join(', ')}
                onChange={contextTagsChange}
                placeholder="mobile, desktop, beta"
                className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-sky-500"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : nodes.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No navigation items visible</p>
            <p className="text-xs mt-1">Try adjusting the preview context</p>
          </div>
        ) : (
          <PreviewTree nodes={nodes} />
        )}
      </div>

      {/* Footer */}
      <div 
        className="px-4 py-2 border-t text-xs"
        style={{ 
          backgroundColor: 'var(--bg-surface-secondary)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-muted)'
        }}
      >
        {nodes.length} items visible
        {context.roles.length > 0 && ` • ${context.roles.length} roles`}
        {context.permissions.length > 0 && ` • ${context.permissions.length} permissions`}
      </div>
    </div>
  );
};

export default NavPreview;

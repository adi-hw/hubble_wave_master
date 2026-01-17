/**
 * NavPreview Component
 *
 * Preview navigation as different roles/permissions.
 */

import React, { useState, useCallback } from 'react';
import { Eye, Users, Key, Flag, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
import { Icon } from '../Icon';
import { ResolvedNavNode } from '../../types/navigation';

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
    <div
      className={depth > 0 ? 'ml-4 border-l border-border pl-2' : ''}
      role={depth === 0 ? 'tree' : 'group'}
    >
      {nodes.map((node) => (
        <div key={node.key} className="py-1" role="treeitem">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted hover:opacity-80 transition-opacity">
            {node.icon && (
              <span className="text-muted-foreground">
                <Icon name={node.icon} className="h-4 w-4" />
              </span>
            )}
            <span className="text-sm text-foreground">{node.label}</span>
            <span className="text-xs ml-auto text-muted-foreground">{node.type}</span>
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
    <div className="h-full flex flex-col rounded-xl overflow-hidden border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Preview</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-foreground rounded-lg disabled:opacity-50 transition-colors bg-primary min-h-[44px]"
          aria-label="Refresh preview"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      <div className="flex-shrink-0 border-b border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:opacity-80 transition-opacity min-h-[44px]"
          aria-expanded={isExpanded}
          aria-label="Toggle preview context editor"
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
            <div className="flex flex-wrap gap-2" role="group" aria-label="Preview presets">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="px-2.5 py-2 text-xs font-medium rounded transition-colors bg-muted text-muted-foreground min-h-[44px] hover:opacity-80"
                  aria-label={`Apply ${preset.label} preset`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Roles
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Available roles">
                {availableRoles.slice(0, 10).map((role) => (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={`px-2 py-2 text-xs rounded transition-colors border min-h-[44px] ${
                      context.roles.includes(role)
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted border-border text-muted-foreground hover:opacity-80'
                    }`}
                    aria-pressed={context.roles.includes(role)}
                    aria-label={`Toggle ${role} role`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Key className="h-3.5 w-3.5" />
                Permissions
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Available permissions">
                {availablePermissions.slice(0, 10).map((perm) => (
                  <button
                    key={perm}
                    onClick={() => togglePermission(perm)}
                    className={`px-2 py-2 text-xs rounded transition-colors border min-h-[44px] ${
                      context.permissions.includes(perm)
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted border-border text-muted-foreground hover:opacity-80'
                    }`}
                    aria-pressed={context.permissions.includes(perm)}
                    aria-label={`Toggle ${perm} permission`}
                  >
                    {perm}
                  </button>
                ))}
              </div>
            </div>

            {availableFlags.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Flag className="h-3.5 w-3.5" />
                  Feature Flags
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Available feature flags">
                  {availableFlags.map((flag) => (
                    <button
                      key={flag}
                      onClick={() => toggleFlag(flag)}
                      className={`px-2 py-2 text-xs rounded transition-colors border min-h-[44px] ${
                        context.featureFlags.includes(flag)
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-muted border-border text-muted-foreground hover:opacity-80'
                      }`}
                      aria-pressed={context.featureFlags.includes(flag)}
                      aria-label={`Toggle ${flag} feature flag`}
                    >
                      {flag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="context-tags-input" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Context Tags
              </label>
              <input
                id="context-tags-input"
                type="text"
                value={context.contextTags.join(', ')}
                onChange={contextTagsChange}
                placeholder="mobile, desktop, beta"
                className="w-full px-2.5 py-2 text-xs border rounded-lg transition-colors bg-card border-border text-foreground min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Context tags (comma-separated)"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4" role="region" aria-label="Preview navigation tree">
        {loading ? (
          <div className="flex items-center justify-center h-32" role="status" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading preview...</span>
          </div>
        ) : nodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No navigation items visible</p>
            <p className="text-xs mt-1">Try adjusting the preview context</p>
          </div>
        ) : (
          <PreviewTree nodes={nodes} />
        )}
      </div>

      <div
        className="px-4 py-2 border-t border-border text-xs bg-muted text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-label="Preview summary"
      >
        {nodes.length} items visible
        {context.roles.length > 0 && ` • ${context.roles.length} roles`}
        {context.permissions.length > 0 && ` • ${context.permissions.length} permissions`}
      </div>
    </div>
  );
};

export default NavPreview;

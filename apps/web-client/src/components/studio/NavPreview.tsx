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
          <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50">
            {node.icon && (
              <Icon name={node.icon} className="h-4 w-4 text-slate-400" />
            )}
            <span className="text-sm text-slate-700">{node.label}</span>
            <span className="text-xs text-slate-400 ml-auto">{node.type}</span>
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
    { label: 'Admin', roles: ['admin', 'tenant_admin'], permissions: [], flags: [] },
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
    <div className="h-full flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-slate-500" />
          <h3 className="font-semibold text-slate-800">Preview</h3>
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
      <div className="flex-shrink-0 border-b border-slate-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
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
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Roles */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Users className="h-3.5 w-3.5" />
                Roles
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableRoles.slice(0, 10).map((role) => (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={`
                      px-2 py-0.5 text-xs rounded transition-colors
                      ${context.roles.includes(role)
                        ? 'bg-sky-100 text-sky-700 border border-sky-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }
                    `}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Key className="h-3.5 w-3.5" />
                Permissions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availablePermissions.slice(0, 10).map((perm) => (
                  <button
                    key={perm}
                    onClick={() => togglePermission(perm)}
                    className={`
                      px-2 py-0.5 text-xs rounded transition-colors
                      ${context.permissions.includes(perm)
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }
                    `}
                  >
                    {perm}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Flags */}
            {availableFlags.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Flag className="h-3.5 w-3.5" />
                  Feature Flags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableFlags.map((flag) => (
                    <button
                      key={flag}
                      onClick={() => toggleFlag(flag)}
                      className={`
                        px-2 py-0.5 text-xs rounded transition-colors
                        ${context.featureFlags.includes(flag)
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }
                      `}
                    >
                      {flag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Context Tags */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                Context Tags
              </label>
              <input
                type="text"
                value={context.contextTags.join(', ')}
                onChange={contextTagsChange}
                placeholder="mobile, desktop, beta"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No navigation items visible</p>
            <p className="text-xs mt-1">Try adjusting the preview context</p>
          </div>
        ) : (
          <PreviewTree nodes={nodes} />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        {nodes.length} items visible
        {context.roles.length > 0 && ` • ${context.roles.length} roles`}
        {context.permissions.length > 0 && ` • ${context.permissions.length} permissions`}
      </div>
    </div>
  );
};

export default NavPreview;

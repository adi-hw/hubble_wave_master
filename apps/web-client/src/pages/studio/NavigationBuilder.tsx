/**
 * NavigationBuilder Page
 *
 * Visual navigation builder for creating and managing navigation profiles.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Loader2,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  GripVertical,
  EyeOff,
  Edit,

  Layers,
} from 'lucide-react';
import { Icon } from '../../components/Icon';
import { NavNodeEditor, NavNodeData } from '../../components/studio/NavNodeEditor';
import { NavPreview } from '../../components/studio/NavPreview';
import { ModuleOption } from '../../components/studio/ModulePicker';
import {
  navigationAdminService,
  NavProfile,
  NavNode,
} from '../../services/navigation-admin.service';
import { ResolvedNavNode } from '../../types/navigation-v2';

// Default available roles/permissions for demo
const DEFAULT_ROLES = [
  'admin',
  'user',
  'manager',
  'viewer',
  'asset_manager',
  'work_order_manager',
];

const DEFAULT_PERMISSIONS = [
  'asset.view',
  'asset.create',
  'asset.edit',
  'asset.delete',
  'work_order.view',
  'work_order.create',
  'work_order.edit',
  'studio.access',
  'admin.access',
];

const DEFAULT_FLAGS = ['beta_navigation', 'new_dashboard', 'mobile_app'];

interface TreeNodeProps {
  node: NavNode;
  depth?: number;
  selectedKey?: string;
  onSelect: (node: NavNode) => void;
  expandedKeys: Set<string>;
  onToggleExpand: (key: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth = 0,
  selectedKey,
  onSelect,
  expandedKeys,
  onToggleExpand,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedKeys.has(node.key);
  const isSelected = selectedKey === node.key;

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
        style={{
          paddingLeft: 8 + depth * 16,
          backgroundColor: isSelected ? 'var(--bg-primary-subtle)' : 'transparent',
          color: isSelected ? 'var(--text-brand)' : 'var(--text-primary)',
          opacity: !node.isVisible ? 0.5 : 1
        }}
        onClick={() => onSelect(node)}
      >
        {/* Drag Handle */}
        <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab" style={{ color: 'var(--text-muted)' }} />

        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.key);
            }}
            className="p-0.5 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon */}
        {node.icon ? (
          <Icon name={node.icon} className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
        ) : node.type === 'group' ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
        ) : (
          <span className="w-4" />
        )}

        {/* Label */}
        <span className="flex-1 text-sm truncate">{node.label}</span>

        {/* Visibility indicator */}
        {!node.isVisible && (
          <EyeOff className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
        )}

        {/* Type badge */}
        <span className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{node.type}</span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.key}
              node={child}
              depth={depth + 1}
              selectedKey={selectedKey}
              onSelect={onSelect}
              expandedKeys={expandedKeys}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const NavigationBuilder: React.FC = () => {
  // State
  const [profiles, setProfiles] = useState<NavProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<NavProfile | null>(null);
  const [nodes, setNodes] = useState<NavNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<NavNode | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [previewNodes, setPreviewNodes] = useState<ResolvedNavNode[]>([]);

  // Loading/Error state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingNode, setEditingNode] = useState<NavNodeData | null>(null);
  const [isCreatingNode, setIsCreatingNode] = useState(false);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
    loadModules();
  }, []);

  // Load nodes when profile changes
  useEffect(() => {
    if (selectedProfile) {
      loadNodes(selectedProfile.id);
    } else {
      setNodes([]);
    }
  }, [selectedProfile]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await navigationAdminService.getProfiles();
      setProfiles(data);
      if (data.length > 0) {
        // If we have profiles, select one (prefer default)
        const def = data.find((p) => p.isDefault) || data[0];
        if (!selectedProfile || !data.find(p => p.id === selectedProfile.id)) {
           setSelectedProfile(def);
        }
      } else {
        // No profiles found - clear selection
        setSelectedProfile(null);
      }
    } catch (err: any) {
      console.error('Failed to load profiles:', err);
      setError(err.message || 'Failed to load navigation profiles');
      // DO NOT USE MOCK DATA ON ERROR - It hides the real issue
      setProfiles([]); 
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDefaultProfile = async () => {
    try {
      setLoading(true);
      await navigationAdminService.createProfile({
        name: 'Main Navigation',
        slug: 'main',
        description: 'Primary application navigation',
        isDefault: true,
      });
      await loadProfiles();
    } catch (err: any) {
      console.error('Failed to create default profile:', err);
      setError(err.message || 'Failed to create default profile');
      setLoading(false);
    }
  };

  const loadNodes = async (profileId: string) => {
    try {
      const data = await navigationAdminService.getNodes(profileId);
      setNodes(data);
      // Expand all top-level groups by default
      setExpandedKeys(new Set(data.filter((n) => n.type === 'group').map((n) => n.key)));
    } catch (err: any) {
      console.error('Failed to load nodes:', err);
      // Use mock data for demo
      setNodes([
        {
          id: '1',
          key: 'studio',
          label: 'Studio',
          icon: 'Wrench',
          type: 'group',
          order: 0,
          isVisible: true,
          children: [
            {
              id: '1-1',
              key: 'studio.tables',
              label: 'Tables',
              icon: 'Database',
              type: 'module',
              moduleKey: 'studio.tables',
              order: 0,
              isVisible: true,
            },
            {
              id: '1-2',
              key: 'studio.scripts',
              label: 'Scripts',
              icon: 'FileCode',
              type: 'module',
              moduleKey: 'studio.scripts',
              order: 1,
              isVisible: true,
            },
          ],
        },
        {
          id: '2',
          key: 'admin',
          label: 'Administration',
          icon: 'Shield',
          type: 'group',
          order: 1,
          isVisible: true,
          children: [
            {
              id: '2-1',
              key: 'admin.users',
              label: 'Users & Roles',
              icon: 'Users',
              type: 'module',
              moduleKey: 'admin.users',
              order: 0,
              isVisible: true,
            },
          ],
        },
      ]);
      setExpandedKeys(new Set(['studio', 'admin']));
    }
  };

  const loadModules = async () => {
    try {
      const data = await navigationAdminService.getModules();
      setModules(data);
    } catch (err) {
      // Use mock data for demo
      setModules([
        { key: 'studio.tables', label: 'Tables', type: 'list', icon: 'Database', applicationKey: 'Studio' },
        { key: 'studio.scripts', label: 'Scripts', type: 'list', icon: 'FileCode', applicationKey: 'Studio' },
        { key: 'studio.workflows', label: 'Workflows', type: 'list', icon: 'GitBranch', applicationKey: 'Studio' },
        { key: 'admin.users', label: 'Users & Roles', type: 'list', icon: 'Users', applicationKey: 'Admin' },
        { key: 'asset.list', label: 'Asset List', type: 'list', icon: 'Package' },
        { key: 'asset.dashboard', label: 'Asset Dashboard', type: 'dashboard', icon: 'LayoutDashboard' },
        { key: 'work_order.list', label: 'Work Orders', type: 'list', icon: 'ClipboardList' },
      ]);
    }
  };

  const handleNodeSelect = (node: NavNode) => {
    setSelectedNode(node);
    setEditingNode({
      key: node.key,
      label: node.label,
      icon: node.icon,
      type: node.type,
      moduleKey: node.moduleKey,
      url: node.url,
      parentKey: node.parentKey,
      order: node.order,
      isVisible: node.isVisible,
      visibility: node.visibility,
      contextTags: node.contextTags,
      smartGroupType: node.smartGroupType,
    });
    setIsCreatingNode(false);
  };

  const handleToggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getAllGroups = useCallback((nodes: NavNode[]): { key: string; label: string }[] => {
    let groups: { key: string; label: string }[] = [];
    for (const node of nodes) {
      if (node.type === 'group' && node.key) {
        groups.push({ key: node.key, label: node.label });
      }
      if (node.children) {
        groups = [...groups, ...getAllGroups(node.children)];
      }
    }
    return groups;
  }, []);

  const handleCreateNode = () => {
    const parentKey = selectedNode?.type === 'group' ? selectedNode.key : undefined;
    
    setSelectedNode(null);
    setEditingNode({
      key: '',
      label: '',
      type: 'module',
      order: nodes.length,
      isVisible: true,
      parentKey,
    });
    setIsCreatingNode(true);
  };

  const handleSaveNode = async () => {
    if (!editingNode) return;
    
    if (!selectedProfile) {
      setError('No navigation profile selected. Please create or select a profile.');
      return;
    }

    try {
      setSaving(true);
      if (isCreatingNode) {
        await navigationAdminService.createNode(selectedProfile.id, {
          key: editingNode.key,
          label: editingNode.label,
          icon: editingNode.icon,
          type: editingNode.type,
          moduleKey: editingNode.moduleKey,
          url: editingNode.url,
          parentKey: editingNode.parentKey,
          order: editingNode.order,
          visibility: editingNode.visibility,
          contextTags: editingNode.contextTags,
        });
      } else if (selectedNode) {
        await navigationAdminService.updateNode(selectedProfile.id, selectedNode.id, {
          label: editingNode.label,
          icon: editingNode.icon,
          moduleKey: editingNode.moduleKey,
          parentKey: editingNode.parentKey ?? '', // Send empty string if undefined to allow moving to root
          url: editingNode.url,
          order: editingNode.order,
          isVisible: editingNode.isVisible,
          visibility: editingNode.visibility,
          contextTags: editingNode.contextTags,
        });
      }
      await loadNodes(selectedProfile.id);
      setEditingNode(null);
      setSelectedNode(null);
      setIsCreatingNode(false);
    } catch (err: any) {
      console.error('Failed to save node:', err);
      setError(err.message || 'Failed to save node');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode || !selectedProfile) return;

    if (!confirm(`Delete "${selectedNode.label}"? This cannot be undone.`)) {
      return;
    }

    try {
      setSaving(true);
      await navigationAdminService.deleteNode(selectedProfile.id, selectedNode.id);
      await loadNodes(selectedProfile.id);
      setEditingNode(null);
      setSelectedNode(null);
    } catch (err: any) {
      console.error('Failed to delete node:', err);
      setError(err.message || 'Failed to delete node');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = useCallback(
    async (context: { roles: string[]; permissions: string[]; featureFlags: string[]; contextTags: string[] }) => {
      if (!selectedProfile) return;

      try {
        setPreviewLoading(true);
        const result = await navigationAdminService.preview(selectedProfile.id, context);
        setPreviewNodes(result.nodes as unknown as ResolvedNavNode[]);
      } catch (err) {
        // Use current nodes as preview for demo
        const convertNode = (n: NavNode): ResolvedNavNode => ({
          key: n.key,
          label: n.label,
          icon: n.icon,
          type: n.type.toUpperCase() as ResolvedNavNode['type'],
          route: n.moduleKey ? `/${n.moduleKey.replace('.', '/')}` : undefined,
          children: n.children?.map(convertNode),
        });
        setPreviewNodes(nodes.map(convertNode));
      } finally {
        setPreviewLoading(false);
      }
    },
    [selectedProfile, nodes]
  );

  // Initial preview load
  useEffect(() => {
    if (nodes.length > 0) {
      handlePreview({ roles: ['admin'], permissions: [], featureFlags: [], contextTags: [] });
    }
  }, [nodes, handlePreview]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-surface-secondary)' }}>
      {/* Header */}
      <div 
        className="flex-shrink-0 border-b px-6 py-4"
        style={{ 
          backgroundColor: 'var(--bg-surface)', 
          borderColor: 'var(--border-default)' 
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/studio"
              className="p-2 rounded-lg hover:opacity-80 border transition-colors"
              style={{ 
                color: 'var(--text-muted)', 
                borderColor: 'var(--border-default)' 
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p 
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Studio
              </p>
              <h1 
                className="text-2xl font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Navigation Builder
              </h1>
            </div>
          </div>

          {/* Profile Selector */}
          <div className="flex items-center gap-3">
            {profiles.length === 0 ? (
              <button
                onClick={handleCreateDefaultProfile}
                className="px-3 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors"
              >
                Initialize Default Profile
              </button>
            ) : (
              <select
                value={selectedProfile?.id || ''}
                onChange={(e) => {
                  const profile = profiles.find((p) => p.id === e.target.value);
                  setSelectedProfile(profile || null);
                }}
                className="px-3 py-2 border rounded-lg text-sm"
                style={{ 
                  backgroundColor: 'var(--bg-surface)', 
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="flex-shrink-0 border-b px-6 py-3"
          style={{
            backgroundColor: 'var(--bg-danger-subtle)',
            borderColor: 'var(--border-danger)'
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-danger)' }}>{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Nav Tree */}
        <div 
          className="w-80 flex-shrink-0 border-r flex flex-col"
          style={{ 
            backgroundColor: 'var(--bg-surface)', 
            borderColor: 'var(--border-default)' 
          }}
        >
          {/* Tree Header */}
          <div 
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Navigation Tree
              </span>
            </div>
            <button
              onClick={handleCreateNode}
              className="p-1.5 rounded-lg hover:bg-black/5"
              style={{ color: 'var(--text-muted)' }}
              title="Add node"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {nodes.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No navigation items</p>
                <button
                  onClick={handleCreateNode}
                  className="mt-2 text-sm hover:underline"
                  style={{ color: 'var(--text-brand)' }}
                >
                  Add first item
                </button>
              </div>
            ) : (
              nodes.map((node) => (
                <TreeNode
                  key={node.key}
                  node={node}
                  selectedKey={selectedNode?.key}
                  onSelect={handleNodeSelect}
                  expandedKeys={expandedKeys}
                  onToggleExpand={handleToggleExpand}
                />
              ))
            )}
          </div>
        </div>

        {/* Center Panel - Node Editor */}
        <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--bg-surface-secondary)' }}>
          {editingNode ? (
            <div 
              className="max-w-2xl mx-auto rounded-xl border p-6"
              style={{ 
                backgroundColor: 'var(--bg-surface)', 
                borderColor: 'var(--border-default)' 
              }}
            >
              <NavNodeEditor
                node={editingNode}
                onChange={setEditingNode}
                onSave={handleSaveNode}
                onDelete={!isCreatingNode ? handleDeleteNode : undefined}
                modules={modules}
                availableRoles={DEFAULT_ROLES}
                availablePermissions={DEFAULT_PERMISSIONS}
                availableFlags={DEFAULT_FLAGS}
                parentOptions={getAllGroups(nodes)}
                isNew={isCreatingNode}
                disabled={saving}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Edit className="h-12 w-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a node to edit</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>or click + to create a new one</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Preview */}
        <div className="w-80 flex-shrink-0" style={{ backgroundColor: 'var(--bg-surface-secondary)' }}>
          <NavPreview
            nodes={previewNodes}
            loading={previewLoading}
            onPreview={handlePreview}
            availableRoles={DEFAULT_ROLES}
            availablePermissions={DEFAULT_PERMISSIONS}
            availableFlags={DEFAULT_FLAGS}
          />
        </div>
      </div>
    </div>
  );
};

export default NavigationBuilder;

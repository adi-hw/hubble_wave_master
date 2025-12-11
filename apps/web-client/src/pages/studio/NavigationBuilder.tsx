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
  Settings,
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
  'tenant_admin',
  'platform_admin',
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
        className={`
          flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
          ${isSelected ? 'bg-sky-100 text-sky-800' : 'hover:bg-slate-100'}
          ${!node.isVisible ? 'opacity-50' : ''}
        `}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(node)}
      >
        {/* Drag Handle */}
        <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0 cursor-grab" />

        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.key);
            }}
            className="p-0.5 hover:bg-slate-200 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon */}
        {node.icon ? (
          <Icon name={node.icon} className="h-4 w-4 text-slate-500 flex-shrink-0" />
        ) : node.type === 'group' ? (
          <FolderOpen className="h-4 w-4 text-slate-500 flex-shrink-0" />
        ) : (
          <span className="w-4" />
        )}

        {/* Label */}
        <span className="flex-1 text-sm truncate">{node.label}</span>

        {/* Visibility indicator */}
        {!node.isVisible && (
          <EyeOff className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        )}

        {/* Type badge */}
        <span className="text-[10px] text-slate-400 uppercase">{node.type}</span>
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
      if (data.length > 0 && !selectedProfile) {
        setSelectedProfile(data.find((p) => p.isDefault) || data[0]);
      }
    } catch (err: any) {
      console.error('Failed to load profiles:', err);
      setError(err.message || 'Failed to load navigation profiles');
      // Use mock data for demo
      setProfiles([
        {
          id: 'demo-1',
          slug: 'default',
          name: 'Default Profile',
          description: 'Standard navigation for all users',
          isDefault: true,
          isActive: true,
          isLocked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      setSelectedProfile({
        id: 'demo-1',
        slug: 'default',
        name: 'Default Profile',
        description: 'Standard navigation for all users',
        isDefault: true,
        isActive: true,
        isLocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } finally {
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
        { key: 'asset.list', label: 'Asset List', type: 'list', icon: 'Package', applicationKey: 'EAM' },
        { key: 'asset.dashboard', label: 'Asset Dashboard', type: 'dashboard', icon: 'LayoutDashboard', applicationKey: 'EAM' },
        { key: 'work_order.list', label: 'Work Orders', type: 'list', icon: 'ClipboardList', applicationKey: 'EAM' },
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

  const handleCreateNode = () => {
    setSelectedNode(null);
    setEditingNode({
      key: '',
      label: '',
      type: 'module',
      order: nodes.length,
      isVisible: true,
    });
    setIsCreatingNode(true);
  };

  const handleSaveNode = async () => {
    if (!editingNode || !selectedProfile) return;

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
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/studio"
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 border border-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Studio
              </p>
              <h1 className="text-xl font-bold text-slate-800">Navigation Builder</h1>
            </div>
          </div>

          {/* Profile Selector */}
          <div className="flex items-center gap-3">
            <select
              value={selectedProfile?.id || ''}
              onChange={(e) => {
                const profile = profiles.find((p) => p.id === e.target.value);
                setSelectedProfile(profile || null);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="p-2 rounded-lg hover:bg-slate-100 border border-slate-200">
              <Settings className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-6 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Nav Tree */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
          {/* Tree Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Navigation Tree</span>
            </div>
            <button
              onClick={handleCreateNode}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              title="Add node"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {nodes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No navigation items</p>
                <button
                  onClick={handleCreateNode}
                  className="mt-2 text-sm text-sky-600 hover:text-sky-700"
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
        <div className="flex-1 overflow-y-auto p-6">
          {editingNode ? (
            <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 p-6">
              <NavNodeEditor
                node={editingNode}
                onChange={setEditingNode}
                onSave={handleSaveNode}
                onDelete={!isCreatingNode ? handleDeleteNode : undefined}
                modules={modules}
                availableRoles={DEFAULT_ROLES}
                availablePermissions={DEFAULT_PERMISSIONS}
                availableFlags={DEFAULT_FLAGS}
                isNew={isCreatingNode}
                disabled={saving}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Edit className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a node to edit</p>
                <p className="text-xs mt-1">or click + to create a new one</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Preview */}
        <div className="w-80 flex-shrink-0">
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

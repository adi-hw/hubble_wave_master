/**
 * NavigationBuilder Page
 *
 * Visual navigation builder for creating and managing navigation modules.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Save,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  X,
} from 'lucide-react';
import { Icon } from '../../components/Icon';
import { NavNodeEditor, NavNodeData } from '../../components/studio/NavNodeEditor';
import { NavPreview } from '../../components/studio/NavPreview';
import { ModuleOption } from '../../components/studio/ModulePicker';
import { ResolvedNavNode } from '../../types/navigation';
import metadataApi from '../../services/metadataApi';
import {
  navigationMetadataApi,
  NavigationModuleListItem,
  NavigationScope,
} from '../../services/navigationMetadataApi';

const DEFAULT_NAVIGATION_CODE = 'primary';

const SCOPE_LABELS: Record<NavigationScope, string> = {
  system: 'System',
  instance: 'Instance',
  role: 'Role',
  group: 'Group',
  personal: 'Personal',
};

interface CollectionSummary {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

interface ModuleEditorState {
  open: boolean;
  isNew: boolean;
}

interface NavNode extends NavNodeData {
  children?: NavNode[];
}

const buildTree = (nodes: NavNodeData[]): ResolvedNavNode[] => {
  const map = new Map<string, ResolvedNavNode & { parentKey?: string; order: number }>();

  nodes.forEach((node, index) => {
    map.set(node.key, {
      key: node.key,
      type: node.type,
      label: node.label,
      icon: node.icon,
      route: node.type === 'link' ? node.url : undefined,
      url: node.type === 'link' ? node.url : undefined,
      moduleKey: node.moduleKey,
      smartGroupType: node.smartGroupType,
      isExpanded: false,
      isFavorite: false,
      metadata: {
        visibility: node.visibility,
        contextTags: node.contextTags,
      },
      children: [],
      parentKey: node.parentKey,
      order: node.order ?? index,
    });
  });

  const roots: Array<ResolvedNavNode & { order: number }> = [];
  map.forEach((node) => {
    if (node.parentKey) {
      const parent = map.get(node.parentKey);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: Array<ResolvedNavNode & { order: number }>) => {
    items.sort((a, b) => a.order - b.order);
    items.forEach((item) => {
      if (item.children && item.children.length > 0) {
        sortNodes(item.children as Array<ResolvedNavNode & { order: number }>);
      }
    });
  };

  sortNodes(roots);
  return roots.map(({ order, ...rest }) => rest);
};

const flattenTree = (nodes: ResolvedNavNode[], parentKey?: string): NavNodeData[] => {
  const result: NavNodeData[] = [];
  nodes.forEach((node, index) => {
    result.push({
      key: node.key,
      label: node.label,
      icon: node.icon,
      type: node.type as NavNodeData['type'],
      moduleKey: node.moduleKey,
      url: node.url || node.route,
      parentKey,
      order: index,
      isVisible: node.metadata && typeof node.metadata === 'object'
        ? (node.metadata as Record<string, unknown>).isVisible as boolean | undefined
        : undefined,
      visibility:
        node.metadata && typeof node.metadata === 'object'
          ? ((node.metadata as Record<string, unknown>).visibility as NavNodeData['visibility'])
          : undefined,
      contextTags:
        node.metadata && typeof node.metadata === 'object'
          ? ((node.metadata as Record<string, unknown>).contextTags as string[] | undefined)
          : undefined,
      smartGroupType: node.smartGroupType,
    });
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, node.key));
    }
  });
  return result;
};

export const NavigationBuilder: React.FC = () => {
  const [modules, setModules] = useState<NavigationModuleListItem[]>([]);
  const [selectedModule, setSelectedModule] = useState<NavigationModuleListItem | null>(null);
  const [nodes, setNodes] = useState<NavNodeData[]>([]);
  const [previewNodes, setPreviewNodes] = useState<ResolvedNavNode[]>([]);
  const [moduleOptions, setModuleOptions] = useState<ModuleOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorNode, setEditorNode] = useState<NavNodeData | null>(null);
  const [moduleEditor, setModuleEditor] = useState<ModuleEditorState>({ open: false, isNew: true });
  const [moduleNameDraft, setModuleNameDraft] = useState('');
  const [moduleCodeDraft, setModuleCodeDraft] = useState(DEFAULT_NAVIGATION_CODE);
  const [moduleScopeDraft, setModuleScopeDraft] = useState<NavigationScope>('instance');
  const [moduleScopeKeyDraft, setModuleScopeKeyDraft] = useState('');

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await navigationMetadataApi.listModules();
      setModules(list);
      const selected = list.find((item) => item.module.code === DEFAULT_NAVIGATION_CODE) || list[0] || null;
      setSelectedModule(selected || null);
    } catch (err) {
      console.error('Failed to load navigation modules:', err);
      setError('Failed to load navigation modules.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadModuleOptions = useCallback(async () => {
    try {
      const res = await metadataApi.get<{ data: CollectionSummary[] }>('/collections');
      const options = (res.data.data || []).map((collection) => ({
        key: `/${collection.code}.list`,
        label: collection.name,
        description: collection.description || undefined,
        icon: 'List',
        type: 'list',
        applicationKey: collection.code,
      }));
      setModuleOptions(options);
    } catch (err) {
      console.error('Failed to load module options:', err);
    }
  }, []);

  useEffect(() => {
    loadModules();
    loadModuleOptions();
  }, [loadModules, loadModuleOptions]);

  useEffect(() => {
    if (!selectedModule) {
      setNodes([]);
      setPreviewNodes([]);
      return;
    }
    const layout =
      selectedModule.latestRevision?.layout
      || selectedModule.latestPublishedRevision?.layout
      || {};
    const layoutNodes =
      (layout as { nodes?: ResolvedNavNode[] }).nodes
      || (layout as { navigation?: { nodes?: ResolvedNavNode[] } }).navigation?.nodes
      || [];
    const flat = flattenTree(layoutNodes);
    setNodes(flat);
    setPreviewNodes(layoutNodes);
  }, [selectedModule]);

  const parentOptions = useMemo(() => {
    return nodes
      .filter((node) => node.type === 'group')
      .map((node) => ({ key: node.key, label: node.label || node.key }));
  }, [nodes]);

  const selectedVariant = useMemo(() => {
    if (!selectedModule) return null;
    const variants = selectedModule.variants || [];
    return variants[0] || null;
  }, [selectedModule]);

  const openModuleEditor = (isNew: boolean) => {
    setModuleEditor({ open: true, isNew });
    if (isNew) {
      setModuleNameDraft('');
      setModuleCodeDraft(DEFAULT_NAVIGATION_CODE);
      setModuleScopeDraft('instance');
      setModuleScopeKeyDraft('');
    } else if (selectedModule) {
      setModuleNameDraft(selectedModule.module.name);
      setModuleCodeDraft(selectedModule.module.code);
      setModuleScopeDraft(selectedVariant?.scope || 'instance');
      setModuleScopeKeyDraft(selectedVariant?.scopeKey || '');
    }
  };

  const closeModuleEditor = () => {
    setModuleEditor({ open: false, isNew: true });
    setModuleNameDraft('');
    setModuleCodeDraft(DEFAULT_NAVIGATION_CODE);
    setModuleScopeDraft('instance');
    setModuleScopeKeyDraft('');
  };

  const saveModule = async () => {
    if (!moduleNameDraft.trim() || !moduleCodeDraft.trim()) return;
    if ((moduleScopeDraft === 'role' || moduleScopeDraft === 'group' || moduleScopeDraft === 'personal') && !moduleScopeKeyDraft.trim()) {
      setError('Scope key is required for role, group, and personal scopes.');
      return;
    }
    try {
      await navigationMetadataApi.createDraft({
        code: moduleEditor.isNew ? moduleCodeDraft.trim() : selectedModule?.module.code || moduleCodeDraft.trim(),
        name: moduleNameDraft.trim(),
        description: undefined,
        layout: { nodes: buildTree(nodes) },
        variant: {
          scope: moduleScopeDraft,
          scope_key: moduleScopeKeyDraft || undefined,
        },
      });
      await navigationMetadataApi.publish(moduleEditor.isNew ? moduleCodeDraft.trim() : selectedModule?.module.code || moduleCodeDraft.trim());
      closeModuleEditor();
      await loadModules();
    } catch (err) {
      console.error('Failed to save navigation module:', err);
      setError('Failed to save navigation module.');
    }
  };

  const handleSaveLayout = async () => {
    if (!selectedModule) return;
    setSaving(true);
    setError(null);
    try {
      await navigationMetadataApi.createDraft({
        code: selectedModule.module.code,
        name: selectedModule.module.name,
        description: selectedModule.module.description || undefined,
        layout: { nodes: buildTree(nodes) },
        variant: {
          scope: selectedVariant?.scope || 'instance',
          scope_key: selectedVariant?.scopeKey || undefined,
          priority: selectedVariant?.priority,
        },
      });
      await navigationMetadataApi.publish(selectedModule.module.code);
      await loadModules();
    } catch (err) {
      console.error('Failed to publish navigation layout:', err);
      setError('Failed to publish navigation layout.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNode = () => {
    const newNode: NavNodeData = {
      key: `node_${Date.now()}`,
      label: 'New Node',
      type: 'module',
      isVisible: true,
    };
    setEditorNode(newNode);
  };

  const handleSaveNode = () => {
    if (!editorNode) return;
    setNodes((prev) => {
      const existingIndex = prev.findIndex((node) => node.key === editorNode.key);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = editorNode;
        setPreviewNodes(buildTree(next));
        return next;
      }
      const next = [...prev, { ...editorNode, order: prev.length }];
      setPreviewNodes(buildTree(next));
      return next;
    });
    setEditorNode(null);
  };

  const handleDeleteNode = () => {
    if (!editorNode) return;
    setNodes((prev) => {
      const next = prev.filter((node) => node.key !== editorNode.key && node.parentKey !== editorNode.key);
      setPreviewNodes(buildTree(next));
      return next;
    });
    setEditorNode(null);
  };

  const treeNodes = useMemo(() => buildTree(nodes), [nodes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/studio"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Studio
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openModuleEditor(!selectedModule)}
            className="px-3 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted"
          >
            {selectedModule ? 'Edit Navigation' : 'Create Navigation'}
          </button>
          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving || !selectedModule}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Publish
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!selectedModule && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Create a navigation module to start building.</p>
          <button
            type="button"
            onClick={() => openModuleEditor(true)}
            className="mt-4 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground"
          >
            Create Navigation
          </button>
        </div>
      )}

      {selectedModule && (
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Nodes</h2>
                <p className="text-xs text-muted-foreground">{selectedModule.module.name}</p>
              </div>
              <button
                type="button"
                onClick={handleAddNode}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-border text-foreground hover:bg-muted"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {treeNodes.length === 0 && (
                <div className="text-sm text-muted-foreground">No nodes yet.</div>
              )}
              {treeNodes.map((node) => (
                <TreeNode
                  key={node.key}
                  node={node as NavNode}
                  onSelect={(selected) => setEditorNode(selected)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-4">
              {editorNode ? (
                <NavNodeEditor
                  node={editorNode}
                  onChange={setEditorNode}
                  onSave={handleSaveNode}
                  onDelete={handleDeleteNode}
                  modules={moduleOptions}
                  parentOptions={parentOptions}
                  isNew={!nodes.find((node) => node.key === editorNode.key)}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select a node to edit or add a new node.
                </div>
              )}
            </div>

            <NavPreview
              nodes={previewNodes.length > 0 ? previewNodes : treeNodes}
              loading={false}
              onPreview={async () => setPreviewNodes(buildTree(nodes))}
              availableRoles={['admin', 'user']}
              availablePermissions={[]}
              availableFlags={[]}
            />
          </div>
        </div>
      )}

      {moduleEditor.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-overlay/50" onClick={closeModuleEditor} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-lg shadow-xl bg-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {moduleEditor.isNew ? 'Create Navigation' : 'Edit Navigation'}
              </h2>
              <button
                type="button"
                onClick={closeModuleEditor}
                className="p-1 rounded hover:bg-hover"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={moduleNameDraft}
                  onChange={(event) => setModuleNameDraft(event.target.value)}
                  className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                  placeholder="Navigation name"
                />
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Name
                </label>
              </div>

              {moduleEditor.isNew && (
                <div className="relative">
                  <input
                    type="text"
                    value={moduleCodeDraft}
                    onChange={(event) => setModuleCodeDraft(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                    placeholder="primary_navigation"
                  />
                  <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                    Code
                  </label>
                </div>
              )}

              <div className="relative">
                <select
                  value={moduleScopeDraft}
                  onChange={(event) => setModuleScopeDraft(event.target.value as NavigationScope)}
                  className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                >
                  {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                  Scope
                </label>
              </div>

              {(moduleScopeDraft === 'role' || moduleScopeDraft === 'group' || moduleScopeDraft === 'personal') && (
                <div className="relative">
                  <input
                    type="text"
                    value={moduleScopeKeyDraft}
                    onChange={(event) => setModuleScopeKeyDraft(event.target.value)}
                    className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
                    placeholder={moduleScopeDraft === 'role' ? 'Role code' : moduleScopeDraft === 'group' ? 'Group id' : 'User id'}
                  />
                  <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
                    Scope Key
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                type="button"
                onClick={closeModuleEditor}
                className="px-4 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveModule}
                className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TreeNodeProps {
  node: NavNode;
  depth?: number;
  onSelect: (node: NavNodeData) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth = 0, onSelect }) => {
  const hasChildren = node.children && node.children.length > 0;
  const padding = depth * 16;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-muted cursor-pointer"
        style={{ paddingLeft: padding + 8 }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        {node.icon ? (
          <Icon name={node.icon} className="w-4 h-4 text-muted-foreground" />
        ) : node.type === 'group' ? (
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
        ) : (
          <span className="w-4 h-4" />
        )}
        <span className="flex-1 truncate">{node.label}</span>
        <span className="text-xs uppercase text-muted-foreground">{node.type}</span>
      </div>
      {hasChildren && node.children?.map((child) => (
        <TreeNode key={child.key} node={child} depth={depth + 1} onSelect={onSelect} />
      ))}
    </div>
  );
};

export default NavigationBuilder;

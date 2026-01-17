import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Users,
  Shield,
  Building,
  FolderTree,
  RefreshCw,
  Trash2,
  Edit2,
  UserPlus,
  GitBranch,
  Layers,
  MapPin,
  Settings,
  Zap,
} from 'lucide-react';
import identityApi from '../../../services/identityApi';

type GroupType = 'organization' | 'department' | 'team' | 'location' | 'dynamic' | 'standard';

interface Group {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: GroupType;
  parentId?: string | null;
  hierarchyLevel: number;
  hierarchyPath?: string;
  icon?: string;
  color?: string;
  metadata: Record<string, unknown>;
  isSystem: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  children?: Group[];
  directMemberCount?: number;
  totalMemberCount?: number;
  childGroupCount?: number;
  roleCount?: number;
}

interface GroupStats {
  organization: number;
  department: number;
  team: number;
  location: number;
  dynamic: number;
  standard: number;
  total: number;
}

const groupTypeConfig: Record<GroupType, { label: string; icon: React.FC<{ className?: string }>; bgClass: string; iconClass: string }> = {
  organization: { label: 'Organization', icon: Building, bgClass: 'bg-info-subtle', iconClass: 'text-info-text' },
  department: { label: 'Department', icon: Layers, bgClass: 'bg-primary/10', iconClass: 'text-primary' },
  team: { label: 'Team', icon: Users, bgClass: 'bg-success-subtle', iconClass: 'text-success-text' },
  location: { label: 'Location', icon: MapPin, bgClass: 'bg-warning-subtle', iconClass: 'text-warning-text' },
  dynamic: { label: 'Dynamic', icon: Zap, bgClass: 'bg-purple-50 dark:bg-purple-900/20', iconClass: 'text-purple-500' },
  standard: { label: 'Standard', icon: Settings, bgClass: 'bg-muted', iconClass: 'text-muted-foreground' },
};

const GroupTreeNode: React.FC<{
  group: Group;
  level: number;
  onSelect: (group: Group) => void;
  selectedId?: string;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}> = ({ group, level, onSelect, selectedId, expandedIds, onToggleExpand }) => {
  const hasChildren = group.children && group.children.length > 0;
  const isExpanded = expandedIds.has(group.id);
  const isSelected = selectedId === group.id;
  const config = groupTypeConfig[group.type] || groupTypeConfig.standard;
  const Icon = config.icon;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors rounded-lg mx-2 my-0.5 ${
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
        }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => onSelect(group)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(group.id);
            }}
            className="p-0.5 rounded transition-colors hover:bg-muted"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <div className={`p-1.5 rounded ${config.bgClass}`}>
          <Icon className={`h-4 w-4 ${config.iconClass}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate text-foreground">
            {group.name}
            {!group.isActive && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Inactive
              </span>
            )}
            {group.isSystem && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-info-subtle text-info-text">
                System
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {group.directMemberCount !== undefined && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {group.directMemberCount}
            </span>
          )}
          {group.roleCount !== undefined && group.roleCount > 0 && (
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {group.roleCount}
            </span>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {group.children!.map((child) => (
            <GroupTreeNode
              key={child.id}
              group={child}
              level={level + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<GroupType | 'all'>('all');
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const [treeResponse, statsResponse] = await Promise.all([
        identityApi.get<{ data: Group[] }>('/admin/groups/tree'),
        identityApi.get<{ data: GroupStats }>('/admin/groups/stats'),
      ]);
      setGroups(treeResponse.data.data);
      setStats(statsResponse.data.data);

      const rootIds = treeResponse.data.data.map((g) => g.id);
      setExpandedIds(new Set(rootIds));
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const filterGroups = (groupList: Group[]): Group[] => {
    if (!searchQuery && typeFilter === 'all') return groupList;

    return groupList.reduce<Group[]>((acc, group) => {
      const filteredChildren = group.children ? filterGroups(group.children) : [];
      const matchesSearch =
        !searchQuery ||
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || group.type === typeFilter;

      if (matchesSearch && matchesType) {
        acc.push({ ...group, children: filteredChildren });
      } else if (filteredChildren.length > 0) {
        acc.push({ ...group, children: filteredChildren });
      }
      return acc;
    }, []);
  };

  const filteredGroups = filterGroups(groups);

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds: string[] = [];
    const collectIds = (list: Group[]) => {
      list.forEach((g) => {
        if (g.children && g.children.length > 0) {
          allIds.push(g.id);
          collectIds(g.children);
        }
      });
    };
    collectIds(groups);
    setExpandedIds(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleAction = async (groupId: string, action: string) => {
    setActionMenuOpen(null);
    try {
      switch (action) {
        case 'delete':
          if (window.confirm('Are you sure you want to delete this group?')) {
            await identityApi.delete(`/admin/groups/${groupId}`);
            setSelectedGroup(null);
            fetchGroups();
          }
          break;
        case 'restore':
          await identityApi.post(`/admin/groups/${groupId}/restore`);
          fetchGroups();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} group:`, error);
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">
              Groups
            </h2>
            <button
              onClick={() => navigate('/studio/groups/new')}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-card text-foreground"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as GroupType | 'all')}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-card text-foreground"
          >
            <option value="all">All Types</option>
            {Object.entries(groupTypeConfig).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={expandAll}
              className="text-xs px-2 py-1 rounded transition-colors text-muted-foreground hover:bg-muted"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-2 py-1 rounded transition-colors text-muted-foreground hover:bg-muted"
            >
              Collapse All
            </button>
            <button
              onClick={() => fetchGroups()}
              className="ml-auto p-1 rounded transition-colors hover:bg-muted"
              aria-label="Refresh groups"
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <FolderTree className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searchQuery || typeFilter !== 'all' ? 'No matching groups' : 'No groups yet'}
              </p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <GroupTreeNode
                key={group.id}
                group={group}
                level={0}
                onSelect={setSelectedGroup}
                selectedId={selectedGroup?.id}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
              />
            ))
          )}
        </div>

        <div className="p-4 border-t border-border">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {stats &&
              Object.entries(groupTypeConfig)
                .slice(0, 3)
                .map(([type, config]) => (
                  <div key={type} className="p-2 rounded-lg bg-background">
                    <div className="font-semibold text-foreground">
                      {stats[type as GroupType] || 0}
                    </div>
                    <div className="text-muted-foreground">{config.label}s</div>
                  </div>
                ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedGroup ? (
          <>
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${(groupTypeConfig[selectedGroup.type] || groupTypeConfig.standard).bgClass}`}>
                    {React.createElement((groupTypeConfig[selectedGroup.type] || groupTypeConfig.standard).icon, {
                      className: `h-6 w-6 ${(groupTypeConfig[selectedGroup.type] || groupTypeConfig.standard).iconClass}`,
                    })}
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground">
                      {selectedGroup.name}
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-muted-foreground">
                        {(groupTypeConfig[selectedGroup.type] || groupTypeConfig.standard).label}
                      </span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-sm font-mono text-muted-foreground">
                        {selectedGroup.code}
                      </span>
                      {!selectedGroup.isActive && (
                        <span className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                          Inactive
                        </span>
                      )}
                      {selectedGroup.isSystem && (
                        <span className="px-2 py-0.5 text-xs rounded bg-info-subtle text-info-text">
                          System
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/studio/groups/${selectedGroup.id}/members`)}
                    className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
                  >
                    <UserPlus className="h-4 w-4" />
                    Members
                  </button>
                  <button
                    onClick={() => navigate(`/studio/groups/${selectedGroup.id}/roles`)}
                    className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
                  >
                    <Shield className="h-4 w-4" />
                    Roles
                  </button>
                  <button
                    onClick={() => navigate(`/studio/groups/${selectedGroup.id}/edit`)}
                    className="btn-primary flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setActionMenuOpen(actionMenuOpen === selectedGroup.id ? null : selectedGroup.id)}
                      className="btn-secondary p-2 rounded-lg"
                      aria-label={`More actions for ${selectedGroup.name}`}
                      aria-expanded={actionMenuOpen === selectedGroup.id}
                      aria-haspopup="menu"
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </button>
                    {actionMenuOpen === selectedGroup.id && (
                      <div
                        className="absolute right-0 mt-1 w-48 rounded-lg border border-border z-10 bg-popover shadow-lg"
                        role="menu"
                        aria-label={`Actions for ${selectedGroup.name}`}
                      >
                        <div className="py-1">
                          {selectedGroup.isActive ? (
                            <button
                              onClick={() => handleAction(selectedGroup.id, 'delete')}
                              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors text-destructive hover:bg-destructive/10"
                              disabled={selectedGroup.isSystem}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Group
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction(selectedGroup.id, 'restore')}
                              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors text-foreground hover:bg-muted"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Restore Group
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedGroup.description && (
                <p className="mt-4 text-sm text-muted-foreground">
                  {selectedGroup.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-4 gap-4 p-6">
              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-info-subtle">
                    <Users className="h-4 w-4 text-info-text" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {selectedGroup.directMemberCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Direct Members
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {selectedGroup.totalMemberCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Members
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success-subtle">
                    <GitBranch className="h-4 w-4 text-success-text" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {selectedGroup.childGroupCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Child Groups
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning-subtle">
                    <Shield className="h-4 w-4 text-warning-text" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {selectedGroup.roleCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Assigned Roles
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-0">
              <div className="rounded-xl border border-border p-4 bg-card">
                <h3 className="font-medium mb-4 text-foreground">
                  Details
                </h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Code</dt>
                    <dd className="font-mono text-foreground">
                      {selectedGroup.code}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="text-foreground">
                      {(groupTypeConfig[selectedGroup.type] || groupTypeConfig.standard).label}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Hierarchy Level</dt>
                    <dd className="text-foreground">
                      {selectedGroup.hierarchyLevel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="text-foreground">
                      {new Date(selectedGroup.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                  {selectedGroup.updatedAt && (
                    <div>
                      <dt className="text-muted-foreground">Last Updated</dt>
                      <dd className="text-foreground">
                        {new Date(selectedGroup.updatedAt).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                  {selectedGroup.hierarchyPath && (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Hierarchy Path</dt>
                      <dd className="font-mono text-xs text-foreground">
                        {selectedGroup.hierarchyPath}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FolderTree className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-medium mb-2 text-foreground">
                Select a Group
              </h2>
              <p className="text-sm max-w-sm text-muted-foreground">
                Choose a group from the tree on the left to view its details, members, and role assignments.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupsPage;

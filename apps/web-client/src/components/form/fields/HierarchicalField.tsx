import React, { useState, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, GitBranch, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { FieldComponentProps } from '../types';
import { FieldWrapper } from './FieldWrapper';
import { useAuth } from '../../../auth/AuthContext';

interface HierarchicalConfig {
  parentProperty?: string;
  maxDepth?: number;
  displayMode?: 'tree' | 'path' | 'breadcrumb' | 'flat';
  pathSeparator?: string;
  referenceCollection?: string;
}

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  level: number;
}

/**
 * HierarchicalField - Displays and selects from tree-structured data
 *
 * Supports multiple display modes:
 * - tree: Expandable tree view
 * - path: Full path display (e.g., "Parent > Child > Grandchild")
 * - breadcrumb: Breadcrumb-style navigation
 * - flat: Simple dropdown/select
 */
export const HierarchicalField: React.FC<FieldComponentProps<string>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  const { token } = useAuth();
  const config = field.config as HierarchicalConfig | undefined;
  const displayMode = config?.displayMode ?? 'path';
  const pathSeparator = config?.pathSeparator ?? ' > ';
  const referenceCollection = config?.referenceCollection || '';
  const parentProperty = config?.parentProperty || 'parent';

  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!referenceCollection) return;

    const fetchTreeData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/data/${referenceCollection}/hierarchy?parentProperty=${parentProperty}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setTreeData(data);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTreeData();
  }, [referenceCollection, parentProperty, token]);

  useEffect(() => {
    if (!value || !referenceCollection) {
      setCurrentPath([]);
      return;
    }

    const fetchPath = async () => {
      try {
        const response = await fetch(`/api/data/${referenceCollection}/${value}/path`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const pathData = await response.json();
          setCurrentPath(pathData.path || []);
        }
      } catch {
        setCurrentPath([]);
      }
    };

    fetchPath();
  }, [value, referenceCollection, token]);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const renderBreadcrumb = () => (
    <div className="flex items-center flex-wrap gap-1">
      {currentPath.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </span>
          )}
          <button
            type="button"
            className={cn(
              'px-2 py-0.5 rounded text-sm hover:underline',
              index === currentPath.length - 1
                ? 'text-foreground font-medium'
                : 'text-muted-foreground font-normal'
            )}
            disabled={disabled || readOnly}
          >
            {segment}
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  const renderPath = () => (
    <div className="flex items-center gap-1">
      <span className="flex-shrink-0" title="Hierarchy">
        <GitBranch className="w-4 h-4 text-muted-foreground" />
      </span>
      <span className="flex-1 truncate">
        {loading ? (
          <span className="text-muted-foreground">Loading...</span>
        ) : currentPath.length > 0 ? (
          currentPath.join(pathSeparator)
        ) : (
          <span className="text-muted-foreground">No selection</span>
        )}
      </span>
    </div>
  );

  const renderTree = () => (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : treeData ? (
        <TreeItem
          node={treeData}
          selectedId={value}
          expandedNodes={expandedNodes}
          onToggle={toggleNode}
          onSelect={(id) => onChange(id)}
          disabled={disabled || readOnly}
        />
      ) : (
        <div className="px-2 py-4 text-sm text-muted-foreground">
          No hierarchical data available
        </div>
      )}
    </div>
  );

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && !readOnly && setIsExpanded(!isExpanded)}
          disabled={disabled || readOnly}
          className={cn(
            'w-full px-3 py-2 rounded-md text-sm text-left flex items-center justify-between border text-foreground',
            disabled ? 'bg-muted cursor-default' : 'bg-card cursor-pointer',
            error ? 'border-destructive' : 'border-border',
            readOnly && 'cursor-default'
          )}
        >
          {displayMode === 'breadcrumb' ? renderBreadcrumb() : renderPath()}
          {!readOnly && !disabled && (
            <ChevronDown
              className={cn('w-4 h-4 transition-transform text-muted-foreground', isExpanded && 'rotate-180')}
            />
          )}
        </button>

        {isExpanded && displayMode === 'tree' && (
          <div className="absolute z-10 w-full mt-1 p-2 rounded-md shadow-lg bg-card border border-border">
            {renderTree()}
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};

interface TreeItemProps {
  node: TreeNode;
  selectedId?: string;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  selectedId,
  expandedNodes,
  onToggle,
  onSelect,
  disabled,
}) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const paddingClass = node.level === 0 ? 'pl-0' : node.level === 1 ? 'pl-4' : node.level === 2 ? 'pl-8' : 'pl-12';

  return (
    <div className={paddingClass}>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 rounded cursor-pointer',
          isSelected ? 'bg-primary/10' : 'bg-transparent'
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5"
            disabled={disabled}
          >
            <ChevronRight
              className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          type="button"
          onClick={() => !disabled && onSelect(node.id)}
          disabled={disabled}
          className={cn(
            'flex-1 text-left text-sm hover:underline',
            isSelected ? 'text-primary' : 'text-foreground'
          )}
        >
          {node.label}
        </button>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onSelect={onSelect}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};

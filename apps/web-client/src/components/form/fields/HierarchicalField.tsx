import React, { useState, useCallback } from 'react';
import { cn } from '../../../lib/utils';
import { FieldComponentProps } from '../types';
import { FieldWrapper } from './FieldWrapper';

interface HierarchicalConfig {
  parentProperty?: string;
  maxDepth?: number;
  displayMode?: 'tree' | 'path' | 'breadcrumb' | 'flat';
  pathSeparator?: string;
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
  const config = field.config as HierarchicalConfig | undefined;
  const displayMode = config?.displayMode ?? 'path';
  const pathSeparator = config?.pathSeparator ?? ' > ';

  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Mock path data - in production this would come from the API
  const currentPath = value ? ['Root', 'Category', String(value)] : [];

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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
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
        <svg
          className="w-4 h-4 text-warning-text"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
          />
        </svg>
      </span>
      <span className="flex-1 truncate">
        {currentPath.length > 0 ? currentPath.join(pathSeparator) : (
          <span className="text-muted-foreground">No selection</span>
        )}
      </span>
    </div>
  );

  const renderTree = () => (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {/* Mock tree data - in production this would come from API */}
      <TreeItem
        node={{ id: 'root', label: 'Root', level: 0, children: [
          { id: 'cat1', label: 'Category 1', level: 1, children: [
            { id: 'sub1', label: 'Subcategory 1.1', level: 2 },
            { id: 'sub2', label: 'Subcategory 1.2', level: 2 },
          ]},
          { id: 'cat2', label: 'Category 2', level: 1 },
        ]}}
        selectedId={value}
        expandedNodes={expandedNodes}
        onToggle={toggleNode}
        onSelect={(id) => onChange(id)}
        disabled={disabled || readOnly}
      />
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
            <svg
              className={cn('w-4 h-4 transition-transform text-muted-foreground', isExpanded && 'rotate-180')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
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
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
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

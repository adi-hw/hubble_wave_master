/**
 * PinnedNavigation - User-pinned navigation items
 *
 * Displays pinned items in the sidebar with drag-and-drop reordering.
 */

import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Pin,
  GripVertical,
  X,
  MoreHorizontal,
  Box,
  FileText,
  Layout,
  ExternalLink,
  Star,
} from 'lucide-react';
import { useUserPreferences, PinnedNavigationItem } from '../../contexts/UserPreferencesContext';
import { cn } from '../../lib/utils';

// ============================================================================
// Icon Mapping
// ============================================================================

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Box,
  FileText,
  Layout,
  ExternalLink,
  Star,
  Pin,
};

function getIcon(iconName?: string) {
  if (!iconName) return Star;
  return iconMap[iconName] || Star;
}

// ============================================================================
// Props
// ============================================================================

interface PinnedNavigationProps {
  collapsed?: boolean;
  onItemClick?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function PinnedNavigation({ collapsed = false, onItemClick }: PinnedNavigationProps) {
  const location = useLocation();
  const {
    pinnedItems,
    removePinnedItem,
    reorderPinnedItems,
    loading,
  } = useUserPreferences();

  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<string | null>(null);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');

    if (!draggedId) return;

    const currentIndex = pinnedItems.findIndex((item) => item.id === draggedId);
    if (currentIndex === -1 || currentIndex === targetIndex) return;

    // Create new order
    const newOrder = [...pinnedItems];
    const [removed] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    // Update order
    reorderPinnedItems(newOrder.map((item) => item.id));
    setDraggedItem(null);
  }, [pinnedItems, reorderPinnedItems]);

  // Handle remove item
  const handleRemove = useCallback(async (itemId: string) => {
    try {
      await removePinnedItem(itemId);
      setShowContextMenu(null);
    } catch (err) {
      console.error('Failed to remove pinned item:', err);
    }
  }, [removePinnedItem]);

  // Generate route for item
  const getItemRoute = (item: PinnedNavigationItem): string => {
    if (item.route) return item.route;

    switch (item.type) {
      case 'collection':
        return `/data/${item.code}`;
      case 'view':
        return `/views/${item.code}`;
      case 'module':
        return `/${item.code}`;
      case 'link':
        return item.route || '#';
      default:
        return '#';
    }
  };

  if (loading || pinnedItems.length === 0) {
    return null;
  }

  return (
    <div className="py-2">
      {/* Section Header */}
      {!collapsed && (
        <div className="px-3 mb-1 flex items-center justify-between">
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Pinned
          </span>
          <Pin size={12} style={{ color: 'var(--text-muted)' }} />
        </div>
      )}

      {/* Pinned Items */}
      <div className="space-y-0.5">
        {pinnedItems
          .sort((a, b) => a.position - b.position)
          .map((item, index) => {
            const Icon = getIcon(item.icon);
            const route = getItemRoute(item);
            const isActive = location.pathname === route || location.pathname.startsWith(route + '/');
            const isDragging = draggedItem === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  'group relative',
                  isDragging && 'opacity-50'
                )}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={() => setDraggedItem(null)}
              >
                <Link
                  to={route}
                  onClick={onItemClick}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    'text-sm',
                    collapsed && 'justify-center px-2'
                  )}
                  style={{
                    background: isActive ? 'var(--glass-bg-hover)' : 'transparent',
                    color: isActive ? 'var(--color-primary-400)' : 'var(--text-secondary)',
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  {/* Drag Handle - Only visible on hover when not collapsed */}
                  {!collapsed && (
                    <span
                      className="opacity-0 group-hover:opacity-50 cursor-grab"
                      style={{ marginRight: '-8px', marginLeft: '-4px' }}
                    >
                      <GripVertical size={14} />
                    </span>
                  )}

                  <Icon size={collapsed ? 20 : 16} />

                  {!collapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}

                  {/* Action Button - Only visible on hover */}
                  {!collapsed && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowContextMenu(showContextMenu === item.id ? null : item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  )}
                </Link>

                {/* Context Menu */}
                {showContextMenu === item.id && !collapsed && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowContextMenu(null)}
                    />
                    <div
                      className="absolute right-0 top-full mt-1 z-50 py-1 rounded-lg shadow-lg min-w-[120px]"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                        style={{ color: 'var(--color-danger-400)' }}
                      >
                        <X size={14} />
                        Unpin
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ============================================================================
// Pin Button Component - For use in other parts of the app
// ============================================================================

interface PinButtonProps {
  itemType: 'collection' | 'view' | 'module' | 'link';
  itemCode: string;
  itemLabel: string;
  itemIcon?: string;
  itemRoute?: string;
  className?: string;
}

export function PinButton({
  itemType,
  itemCode,
  itemLabel,
  itemIcon,
  itemRoute,
  className,
}: PinButtonProps) {
  const { pinnedItems, addPinnedItem, removePinnedItem } = useUserPreferences();
  const [loading, setLoading] = useState(false);

  const isPinned = pinnedItems.some(
    (item) => item.type === itemType && item.code === itemCode
  );

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isPinned) {
        const item = pinnedItems.find(
          (i) => i.type === itemType && i.code === itemCode
        );
        if (item) {
          await removePinnedItem(item.id);
        }
      } else {
        await addPinnedItem({
          type: itemType,
          code: itemCode,
          label: itemLabel,
          icon: itemIcon,
          route: itemRoute,
        });
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        'p-1.5 rounded-lg transition-colors',
        isPinned ? 'text-primary-400' : 'text-secondary',
        className
      )}
      style={{
        background: isPinned ? 'var(--bg-primary-subtle)' : 'transparent',
        color: isPinned ? 'var(--color-primary-400)' : 'var(--text-tertiary)',
      }}
      title={isPinned ? 'Unpin' : 'Pin to sidebar'}
    >
      <Pin
        size={16}
        className={cn(
          'transition-transform',
          isPinned && 'fill-current'
        )}
      />
    </button>
  );
}

/**
 * KanbanView Component
 * HubbleWave Platform - Phase 1
 *
 * A drag-and-drop Kanban board view for visualizing records grouped by a property.
 * Features WIP limits, collapsible lanes, and inline card editing.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import './KanbanView.css';
// @dnd-kit/sortable is used by child components
import { KanbanLane as LaneComponent } from './KanbanLane';
import { KanbanCard as CardComponent } from './KanbanCard';
import { KanbanViewConfig, KanbanCard, KanbanLane, BaseViewProps } from '../types';
import {
  Loader2,
  AlertCircle,
  Plus,
  Settings,
} from 'lucide-react';

interface KanbanViewProps extends BaseViewProps<KanbanViewConfig> {
  onCardMove?: (
    cardId: string,
    fromLane: string,
    toLane: string,
    toIndex: number
  ) => Promise<void>;
  onCreateRecord?: (laneValue: string | null) => void;
  onEditLaneProperty?: () => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  config,
  data,
  loading,
  error,
  onRecordClick,
  onRecordUpdate,
  onRefresh,
  onCardMove,
  onCreateRecord,
  onEditLaneProperty,
}) => {
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());

  // Configure DnD sensors with touch support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Transform records into cards grouped by lanes
  const { cardsByLane, laneCardCounts } = useMemo(() => {
    const groupedCards: Record<string, KanbanCard[]> = {};
    const counts: Record<string, number> = {};

    // Initialize lanes
    config.lanes.forEach((lane) => {
      groupedCards[lane.id] = [];
      counts[lane.id] = 0;
    });

    // Group records into lanes
    data.forEach((record) => {
      const groupValue = record[config.groupByProperty];
      const lane = config.lanes.find((l) =>
        l.value === null
          ? groupValue === null || groupValue === undefined || groupValue === ''
          : l.value === groupValue
      );

      if (lane) {
        const card: KanbanCard = {
          id: record.id,
          title: record[config.titleProperty] || 'Untitled',
          subtitle: config.subtitleProperty
            ? record[config.subtitleProperty]
            : undefined,
          coverImage: config.coverImageProperty
            ? record[config.coverImageProperty]
            : undefined,
          color: config.colorProperty ? record[config.colorProperty] : undefined,
          labels: config.labelProperties?.map((prop) => ({
            text: record[prop],
            color: 'var(--hw-color-primary-100)',
          })).filter((l) => l.text),
          dueDate: config.dueDateProperty
            ? record[config.dueDateProperty]
            : undefined,
          assignees: config.assigneeProperty
            ? (Array.isArray(record[config.assigneeProperty])
                ? record[config.assigneeProperty]
                : record[config.assigneeProperty]
                ? [record[config.assigneeProperty]]
                : []
              ).map((a: any) => ({
                id: a.id || a,
                name: a.name || a.username || a,
                avatar: a.avatar,
              }))
            : undefined,
          record,
        };

        groupedCards[lane.id].push(card);
        counts[lane.id]++;
      }
    });

    return { cardsByLane: groupedCards, laneCardCounts: counts };
  }, [data, config]);

  // Check if lane is over WIP limit
  const isOverWipLimit = useCallback(
    (lane: KanbanLane): boolean => {
      if (!config.enableWipLimits || !lane.wipLimit) return false;
      return laneCardCounts[lane.id] > lane.wipLimit;
    },
    [config.enableWipLimits, laneCardCounts]
  );

  // Toggle lane collapsed state
  const toggleLaneCollapsed = useCallback((laneId: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) {
        next.delete(laneId);
      } else {
        next.add(laneId);
      }
      return next;
    });
  }, []);

  // DnD handlers
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const cardId = active.id as string;

      // Find the card being dragged
      for (const laneId in cardsByLane) {
        const card = cardsByLane[laneId].find((c) => c.id === cardId);
        if (card) {
          setActiveCard(card);
          break;
        }
      }
    },
    [cardsByLane]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCard(null);

      if (!over) return;

      const cardId = active.id as string;
      const overId = over.id as string;

      // Find source lane
      let sourceLaneId: string | null = null;
      let sourceIndex = -1;

      for (const laneId in cardsByLane) {
        const index = cardsByLane[laneId].findIndex((c) => c.id === cardId);
        if (index !== -1) {
          sourceLaneId = laneId;
          sourceIndex = index;
          break;
        }
      }

      if (!sourceLaneId) return;

      // Determine target lane
      let targetLaneId = overId;
      let targetIndex = 0;

      // Check if dropped on a card or lane
      const isDroppedOnLane = config.lanes.some((l) => l.id === overId);

      if (!isDroppedOnLane) {
        // Dropped on a card - find its lane
        for (const laneId in cardsByLane) {
          const idx = cardsByLane[laneId].findIndex((c) => c.id === overId);
          if (idx !== -1) {
            targetLaneId = laneId;
            targetIndex = idx;
            break;
          }
        }
      }

      // Don't do anything if dropped in same position
      if (sourceLaneId === targetLaneId && sourceIndex === targetIndex) return;

      // Call the move handler
      if (onCardMove) {
        await onCardMove(cardId, sourceLaneId, targetLaneId, targetIndex);
      }

      // Also update the record's group property
      if (onRecordUpdate && sourceLaneId !== targetLaneId) {
        const targetLane = config.lanes.find((l) => l.id === targetLaneId);
        if (targetLane) {
          await onRecordUpdate(cardId, {
            [config.groupByProperty]: targetLane.value,
          });
        }
      }
    },
    [cardsByLane, config.lanes, config.groupByProperty, onCardMove, onRecordUpdate]
  );

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-base text-muted-foreground">
          Loading board...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-destructive">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-base font-medium text-destructive">
          Failed to load board
        </p>
        <p className="text-sm mt-1 text-destructive">
          {error}
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-6 px-4 py-2 rounded-lg font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col rounded-xl overflow-hidden bg-background border border-border">
      {/* Board Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {config.name}
          </h2>
          <span className="text-sm px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {data.length} records
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Board settings"
          >
            <Settings size={18} />
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-muted text-foreground border border-border hover:bg-muted/80"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            {config.lanes.map((lane) => (
              <LaneComponent
                key={lane.id}
                lane={lane}
                cards={cardsByLane[lane.id] || []}
                isCollapsed={collapsedLanes.has(lane.id)}
                onToggleCollapse={() => toggleLaneCollapsed(lane.id)}
                isOverWipLimit={isOverWipLimit(lane)}
                wipLimit={lane.wipLimit}
                onCardClick={onRecordClick}
                onAddCard={() => onCreateRecord?.(lane.value)}
                cardProperties={config.cardProperties}
              />
            ))}

            {/* Add Lane Button - Opens collection property editor to add choice values */}
            {onEditLaneProperty && (
              <button
                type="button"
                className="w-72 flex-shrink-0 flex items-center justify-center rounded-xl cursor-pointer transition-colors min-h-[120px] bg-muted border-2 border-dashed border-border hover:bg-muted/80 hover:border-muted-foreground"
                onClick={onEditLaneProperty}
                aria-label="Add new lane by editing the grouping property choices"
              >
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Plus size={20} aria-hidden="true" />
                  <span className="font-medium">Add Lane</span>
                </div>
              </button>
            )}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeCard ? (
              <CardComponent card={activeCard} isDragging={true} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default KanbanView;

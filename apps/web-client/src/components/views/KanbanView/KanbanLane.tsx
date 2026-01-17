/**
 * KanbanLane Component
 * HubbleWave Platform - Phase 1
 *
 * A single lane/column in the Kanban board containing draggable cards.
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard as CardComponent } from './KanbanCard';
import { KanbanLane as LaneType, KanbanCard } from '../types';
import { ChevronDown, ChevronRight, Plus, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface KanbanLaneProps {
  lane: LaneType;
  cards: KanbanCard[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isOverWipLimit: boolean;
  wipLimit?: number;
  onCardClick?: (record: Record<string, any>) => void;
  onAddCard?: () => void;
  cardProperties?: string[];
}

export const KanbanLane: React.FC<KanbanLaneProps> = ({
  lane,
  cards,
  isCollapsed,
  onToggleCollapse,
  isOverWipLimit,
  wipLimit,
  onCardClick,
  onAddCard,
  cardProperties,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: lane.id,
  });

  // Lane has custom color from config
  const hasCustomColor = !!lane.color;

  if (isCollapsed) {
    return (
      <div
        className={cn(
          'w-12 flex-shrink-0 rounded-xl flex flex-col items-center py-4 cursor-pointer transition-colors border border-border',
          !hasCustomColor && 'bg-muted'
        )}
        style={hasCustomColor ? { backgroundColor: lane.color } : undefined}
        onClick={onToggleCollapse}
      >
        <ChevronRight size={18} className="text-muted-foreground" />
        <div className="mt-4 font-medium text-sm text-foreground [writing-mode:vertical-rl] rotate-180">
          {lane.title}
        </div>
        <div className="mt-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-card text-foreground">
          {cards.length}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-72 flex-shrink-0 rounded-xl flex flex-col transition-all',
        isOver
          ? 'border-2 border-primary bg-primary/10'
          : 'border border-border',
        !hasCustomColor && !isOver && 'bg-muted'
      )}
      style={hasCustomColor && !isOver ? { backgroundColor: lane.color } : undefined}
    >
      {/* Lane Header */}
      <div className="flex items-center justify-between px-3 py-3 flex-shrink-0 border-b border-border/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded transition-colors text-muted-foreground hover:bg-muted"
          >
            <ChevronDown size={16} />
          </button>
          <h3 className="font-medium text-sm truncate text-foreground">
            {lane.title}
          </h3>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
              isOverWipLimit
                ? 'bg-destructive/10 text-destructive'
                : 'bg-card text-muted-foreground'
            )}
          >
            {cards.length}
            {wipLimit && `/${wipLimit}`}
          </span>
        </div>

        {/* WIP Limit Warning */}
        {isOverWipLimit && (
          <div
            className="p-1"
            title={`WIP limit exceeded (${cards.length}/${wipLimit})`}
          >
            <AlertTriangle size={16} className="text-warning" />
          </div>
        )}

        {/* Add Card Button */}
        {onAddCard && (
          <button
            onClick={onAddCard}
            className="p-1.5 rounded transition-colors text-muted-foreground bg-transparent hover:bg-muted"
            title="Add card"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Cards Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              onClick={() => onCardClick?.(card.record)}
              cardProperties={cardProperties}
            />
          ))}
        </SortableContext>

        {/* Empty Lane State */}
        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed border-border bg-card">
            <p className="text-sm text-muted-foreground">No cards</p>
            {onAddCard && (
              <button
                onClick={onAddCard}
                className="mt-2 text-sm font-medium flex items-center gap-1 transition-colors text-primary hover:text-primary/80"
              >
                <Plus size={14} />
                Add card
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lane Footer - Quick Add */}
      {onAddCard && cards.length > 0 && (
        <div className="px-2 py-2 flex-shrink-0 border-t border-border/50">
          <button
            onClick={onAddCard}
            className="w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors text-muted-foreground bg-transparent hover:bg-muted"
          >
            <Plus size={14} />
            Add card
          </button>
        </div>
      )}
    </div>
  );
};

export default KanbanLane;

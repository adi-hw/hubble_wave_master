/**
 * KanbanCard Component
 * HubbleWave Platform - Phase 1
 *
 * A draggable card component for the Kanban board.
 * Displays record data with support for cover images, labels, due dates, and assignees.
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KanbanCard as KanbanCardType } from '../types';
import { Calendar, User } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface KanbanCardProps {
  card: KanbanCardType;
  onClick?: () => void;
  cardProperties?: string[];
  isDragging?: boolean;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  card,
  onClick,
  isDragging = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = () => {
    if (!isSortableDragging && onClick) {
      onClick();
    }
  };

  const formatDueDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`;
    }

    return date.toLocaleDateString();
  };

  const isDueOverdue = (dateStr: string): boolean => {
    return new Date(dateStr) < new Date();
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...attributes}
      {...listeners}
      role="article"
      aria-label={`Card: ${card.title}`}
      className={cn(
        'rounded-lg cursor-grab active:cursor-grabbing transition-all',
        isSortableDragging && 'opacity-50'
      )}
      onClick={handleClick}
    >
      <div
        className={cn(
          'rounded-lg overflow-hidden bg-card border shadow-sm transition-all',
          isDragging
            ? 'border-primary shadow-md'
            : 'border-border hover:border-primary hover:shadow-md'
        )}
      >
        {/* Cover Image */}
        {card.coverImage && (
          <div
            className="w-full h-32 bg-cover bg-center bg-muted"
            style={{ backgroundImage: `url(${card.coverImage})` }}
          />
        )}

        {/* Card Color Bar */}
        {card.color && (
          <div
            className="h-1"
            style={{ backgroundColor: card.color }}
          />
        )}

        {/* Card Content */}
        <div className="p-3 space-y-2">
          {/* Labels */}
          {card.labels && card.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {card.labels.map((label, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-xs font-medium text-foreground"
                  style={{ backgroundColor: label.color }}
                >
                  {label.text}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h4 className="font-medium text-sm leading-snug line-clamp-2 text-foreground">
            {card.title}
          </h4>

          {/* Subtitle */}
          {card.subtitle && (
            <p className="text-xs line-clamp-2 text-muted-foreground">
              {card.subtitle}
            </p>
          )}

          {/* Footer - Due Date and Assignees */}
          {(card.dueDate || (card.assignees && card.assignees.length > 0)) && (
            <div className="flex items-center justify-between pt-2">
              {/* Due Date */}
              {card.dueDate && (
                <div
                  className={cn(
                    'flex items-center gap-1 text-xs',
                    isDueOverdue(card.dueDate) ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  <Calendar size={12} />
                  <span>{formatDueDate(card.dueDate)}</span>
                </div>
              )}

              {/* Assignees */}
              {card.assignees && card.assignees.length > 0 && (
                <div className="flex -space-x-2">
                  {card.assignees.slice(0, 3).map((assignee) => (
                    <div
                      key={assignee.id}
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ring-2 ring-card bg-cover',
                        assignee.avatar ? 'bg-transparent' : 'bg-primary text-primary-foreground'
                      )}
                      style={assignee.avatar ? { backgroundImage: `url(${assignee.avatar})` } : undefined}
                      title={assignee.name}
                    >
                      {!assignee.avatar && (
                        <User size={12} />
                      )}
                    </div>
                  ))}
                  {card.assignees.length > 3 && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground ring-2 ring-card">
                      +{card.assignees.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanCard;

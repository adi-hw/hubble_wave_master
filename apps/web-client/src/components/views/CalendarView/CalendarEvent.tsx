/**
 * CalendarEvent Component
 * HubbleWave Platform - Phase 1
 *
 * A draggable calendar event card for the CalendarView.
 */

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarEvent as EventType } from '../types';
import { Clock, GripVertical } from 'lucide-react';

interface CalendarEventProps {
  event: EventType;
  onClick?: (record: Record<string, any>) => void;
  isDragging?: boolean;
  enableDragDrop?: boolean;
  compact?: boolean;
}

export const CalendarEvent: React.FC<CalendarEventProps> = ({
  event,
  onClick,
  isDragging = false,
  enableDragDrop = true,
  compact = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: event.id,
    disabled: !enableDragDrop,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const getEventDuration = (): string => {
    if (event.allDay) return 'All day';
    if (!event.end) return formatTime(event.start);
    return `${formatTime(event.start)} - ${formatTime(event.end)}`;
  };

  const eventColor = event.color || '#3b82f6';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(event.record);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(event.record);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg overflow-hidden transition-all ${
        compact ? 'mb-1' : 'mb-2'
      }`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${event.title} - ${getEventDuration()}`}
    >
      <div
        className={`relative ${compact ? 'p-1' : 'p-2'} cursor-pointer min-h-[44px]`}
        style={{
          backgroundColor: isHovered
            ? `${eventColor}15`
            : `${eventColor}10`,
          borderLeft: `3px solid ${eventColor}`,
        }}
      >
        {/* Drag Handle */}
        {enableDragDrop && !compact && (
          <div
            {...attributes}
            {...listeners}
            className={`absolute top-2 right-2 cursor-grab active:cursor-grabbing transition-opacity text-muted-foreground ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label="Drag to reschedule event"
          >
            <GripVertical size={16} aria-hidden="true" />
          </div>
        )}

        {/* Event Title */}
        <div
          className={`font-medium ${
            compact ? 'text-xs' : 'text-sm'
          } truncate pr-6 text-foreground`}
        >
          {event.title}
        </div>

        {/* Event Time */}
        {!compact && !event.allDay && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock size={12} aria-hidden="true" />
            <span>{getEventDuration()}</span>
          </div>
        )}

        {/* All Day Badge */}
        {!compact && event.allDay && (
          <div
            className="inline-block px-2 py-0.5 mt-1 rounded text-xs font-medium"
            style={{
              backgroundColor: `${eventColor}20`,
              color: eventColor,
            }}
          >
            All day
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarEvent;

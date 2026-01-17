/**
 * CalendarView Component
 * HubbleWave Platform - Phase 1
 *
 * A flexible calendar view for visualizing time-based records.
 * Supports month, week, day, and agenda views with drag-and-drop event rescheduling.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CalendarEvent as EventComponent } from './CalendarEvent';
import {
  CalendarViewConfig,
  CalendarEvent,
  CalendarViewMode,
  BaseViewProps,
} from '../types';
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  Clock,
} from 'lucide-react';

interface CalendarViewProps extends BaseViewProps<CalendarViewConfig> {
  onEventMove?: (
    eventId: string,
    newStart: Date,
    newEnd?: Date
  ) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  config,
  data,
  loading,
  error,
  onRecordClick,
  onRecordUpdate,
  onRefresh,
  onConfigChange,
  onEventMove,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>(
    config.defaultViewMode || 'month'
  );
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Transform records into calendar events
  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];

    for (const record of data) {
      const startValue = record[config.startDateProperty];
      if (!startValue) continue;

      const start = new Date(startValue);
      if (isNaN(start.getTime())) continue;

      const endValue = config.endDateProperty
        ? record[config.endDateProperty]
        : null;
      const endDate = endValue ? new Date(endValue) : undefined;
      const end = endDate && !isNaN(endDate.getTime()) ? endDate : undefined;

      const allDay = config.allDayProperty
        ? Boolean(record[config.allDayProperty])
        : false;

      const color = config.colorProperty
        ? record[config.colorProperty]
        : undefined;

      const event: CalendarEvent = {
        id: record.id,
        title: record[config.titleProperty] || 'Untitled',
        start,
        allDay,
        color,
        record,
      };

      if (end) {
        event.end = end;
      }

      result.push(event);
    }

    return result;
  }, [data, config]);

  // Get week start day (0 = Sunday, 1 = Monday, etc.)
  const weekStartsOn = config.weekStartsOn || 0;

  // Date calculation helpers
  const startOfWeek = useCallback(
    (date: Date): Date => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d;
    },
    [weekStartsOn]
  );

  const startOfMonth = (date: Date): Date => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const addDays = (date: Date, days: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const addMonths = (date: Date, months: number): Date => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const isToday = (date: Date): boolean => {
    return isSameDay(date, new Date());
  };

  const getWeekNumber = (date: Date): number => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  // Get events for a specific day
  const getEventsForDay = useCallback(
    (date: Date): CalendarEvent[] => {
      return events.filter((event) => {
        const eventStart = new Date(event.start);
        const eventEnd = event.end ? new Date(event.end) : eventStart;

        eventStart.setHours(0, 0, 0, 0);
        eventEnd.setHours(23, 59, 59, 999);

        const checkDate = new Date(date);
        checkDate.setHours(12, 0, 0, 0);

        return checkDate >= eventStart && checkDate <= eventEnd;
      });
    },
    [events]
  );

  // Navigation handlers
  const handlePrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, -1));
    } else if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, -7));
    } else if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleViewModeChange = (mode: CalendarViewMode) => {
    setViewMode(mode);
    onConfigChange?.({ defaultViewMode: mode });
  };

  // DnD handlers
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const eventId = event.active.id as string;
      const draggedEvent = events.find((e) => e.id === eventId);
      if (draggedEvent) {
        setActiveEvent(draggedEvent);
      }
    },
    [events]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveEvent(null);

      if (!over) return;

      const eventId = active.id as string;
      const targetDateStr = over.id as string;

      if (!targetDateStr.startsWith('day-')) return;

      const targetDate = new Date(targetDateStr.substring(4));
      const draggedEvent = events.find((e) => e.id === eventId);

      if (!draggedEvent) return;

      const oldStart = new Date(draggedEvent.start);
      const daysDiff = Math.floor(
        (targetDate.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 0) return;

      const newStart = new Date(draggedEvent.start);
      newStart.setDate(newStart.getDate() + daysDiff);

      let newEnd: Date | undefined;
      if (draggedEvent.end) {
        newEnd = new Date(draggedEvent.end);
        newEnd.setDate(newEnd.getDate() + daysDiff);
      }

      if (onEventMove) {
        await onEventMove(eventId, newStart, newEnd);
      }

      if (onRecordUpdate) {
        const updates: Record<string, any> = {
          [config.startDateProperty]: newStart.toISOString(),
        };
        if (newEnd && config.endDateProperty) {
          updates[config.endDateProperty] = newEnd.toISOString();
        }
        await onRecordUpdate(eventId, updates);
      }
    },
    [events, config, onEventMove, onRecordUpdate]
  );

  // Render month view
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = addDays(calendarStart, 41); // 6 weeks

    const weeks: Date[][] = [];
    let currentWeekStart = calendarStart;

    while (currentWeekStart <= calendarEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(addDays(currentWeekStart, i));
      }
      weeks.push(week);
      currentWeekStart = addDays(currentWeekStart, 7);
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const orderedDayNames = [
      ...dayNames.slice(weekStartsOn),
      ...dayNames.slice(0, weekStartsOn),
    ];

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 flex-shrink-0 border-b border-border">
          {config.showWeekNumbers && (
            <div className="px-2 py-3 text-center text-sm font-medium text-muted-foreground/60">
              Wk
            </div>
          )}
          {orderedDayNames.map((day) => (
            <div
              key={day}
              className="px-2 py-3 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto">
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className="grid grid-cols-7 min-h-[120px] border-b border-border"
            >
              {config.showWeekNumbers && (
                <div className="px-2 py-2 text-center text-xs font-medium text-muted-foreground/60 bg-muted/50 border-r border-border">
                  {getWeekNumber(week[0])}
                </div>
              )}
              {week.map((date, dayIndex) => {
                const dayEvents = getEventsForDay(date);
                const isCurrentMonth =
                  date.getMonth() === currentDate.getMonth();
                const isTodayDate = isToday(date);

                return (
                  <div
                    key={dayIndex}
                    id={`day-${date.toISOString()}`}
                    className={`relative px-2 py-2 overflow-hidden transition-colors ${
                      isTodayDate ? 'bg-primary/10' : 'bg-card'
                    } ${dayIndex < 6 ? 'border-r border-border' : ''} ${
                      isCurrentMonth ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <div
                        className={`text-sm font-medium ${
                          isTodayDate
                            ? 'px-2 py-0.5 rounded-full bg-primary text-primary-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {date.getDate()}
                      </div>
                    </div>

                    {/* Events */}
                    <SortableContext
                      items={dayEvents.map((e) => e.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <EventComponent
                            key={event.id}
                            event={event}
                            onClick={onRecordClick}
                            enableDragDrop={config.enableDragDrop !== false}
                            compact={true}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <div
                            className="text-xs px-2 py-1 rounded cursor-pointer transition-colors text-primary bg-primary/10 hover:bg-primary/20"
                            role="button"
                            tabIndex={0}
                            aria-label={`${dayEvents.length - 3} more events`}
                          >
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </SortableContext>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(addDays(weekStart, i));
    }

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-8 flex-shrink-0 border-b border-border">
          <div className="px-2 py-3"></div>
          {weekDays.map((date, index) => {
            const isTodayDate = isToday(date);
            return (
              <div
                key={index}
                className={`px-2 py-3 text-center ${
                  index > 0 ? 'border-l border-border' : ''
                }`}
              >
                <div className="text-xs text-muted-foreground">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div
                  className={`text-lg font-medium mt-1 ${
                    isTodayDate
                      ? 'px-2 py-1 rounded-full bg-primary text-primary-foreground'
                      : 'text-foreground'
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-y-auto">
          {hours.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-8 min-h-[60px] border-b border-border"
            >
              <div className="px-2 py-1 text-xs text-right text-muted-foreground/60">
                {hour === 0
                  ? '12 AM'
                  : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                  ? '12 PM'
                  : `${hour - 12} PM`}
              </div>
              {weekDays.map((date, dayIndex) => {
                const dayEvents = getEventsForDay(date).filter((event) => {
                  if (event.allDay) return false;
                  const eventHour = event.start.getHours();
                  return eventHour === hour;
                });

                return (
                  <div
                    key={dayIndex}
                    id={`day-${date.toISOString()}`}
                    className={`relative px-1 py-1 bg-card ${
                      dayIndex > 0 ? 'border-l border-border' : ''
                    }`}
                  >
                    <SortableContext
                      items={dayEvents.map((e) => e.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {dayEvents.map((event) => (
                        <EventComponent
                          key={event.id}
                          event={event}
                          onClick={onRecordClick}
                          enableDragDrop={config.enableDragDrop !== false}
                        />
                      ))}
                    </SortableContext>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render day view
  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = getEventsForDay(currentDate);
    const isTodayDate = isToday(currentDate);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Day header */}
        <div className="px-6 py-4 flex-shrink-0 border-b border-border">
          <div className="text-sm text-muted-foreground">
            {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
          <div
            className={`text-2xl font-medium mt-1 inline-block ${
              isTodayDate
                ? 'px-3 py-1 rounded-full bg-primary text-primary-foreground'
                : 'text-foreground'
            }`}
          >
            {currentDate.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>

        {/* All-day events */}
        {dayEvents.some((e) => e.allDay) && (
          <div className="px-6 py-3 flex-shrink-0 border-b border-border bg-muted">
            <div className="text-xs font-medium mb-2 text-muted-foreground">
              All Day
            </div>
            <SortableContext
              items={dayEvents.filter((e) => e.allDay).map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              {dayEvents
                .filter((e) => e.allDay)
                .map((event) => (
                  <EventComponent
                    key={event.id}
                    event={event}
                    onClick={onRecordClick}
                    enableDragDrop={config.enableDragDrop !== false}
                  />
                ))}
            </SortableContext>
          </div>
        )}

        {/* Time slots */}
        <div className="flex-1 overflow-y-auto">
          {hours.map((hour) => {
            const hourEvents = dayEvents.filter((event) => {
              if (event.allDay) return false;
              const eventHour = event.start.getHours();
              return eventHour === hour;
            });

            return (
              <div
                key={hour}
                className="flex min-h-[80px] border-b border-border"
              >
                <div className="w-20 flex-shrink-0 px-3 py-2 text-xs text-right text-muted-foreground/60">
                  {hour === 0
                    ? '12 AM'
                    : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                    ? '12 PM'
                    : `${hour - 12} PM`}
                </div>
                <div
                  className="flex-1 px-4 py-2 border-l border-border bg-card"
                  id={`day-${currentDate.toISOString()}`}
                >
                  <SortableContext
                    items={hourEvents.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {hourEvents.map((event) => (
                      <EventComponent
                        key={event.id}
                        event={event}
                        onClick={onRecordClick}
                        enableDragDrop={config.enableDragDrop !== false}
                      />
                    ))}
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render agenda view
  const renderAgendaView = () => {
    const sortedEvents = [...events].sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );

    const groupedEvents = sortedEvents.reduce((acc, event) => {
      const dateKey = event.start.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(event);
      return acc;
    }, {} as Record<string, CalendarEvent[]>);

    return (
      <div className="flex-1 overflow-y-auto">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <Calendar
              size={48}
              className="text-muted-foreground/60"
              aria-hidden="true"
            />
            <p className="mt-4 text-base text-muted-foreground">
              No events scheduled
            </p>
          </div>
        ) : (
          <div className="px-6 py-4">
            {Object.entries(groupedEvents).map(([dateKey, events]) => (
              <div key={dateKey} className="mb-6">
                <div className="text-sm font-medium mb-3 pb-2 text-muted-foreground border-b border-border">
                  {dateKey}
                </div>
                <SortableContext
                  items={events.map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {events.map((event) => (
                      <EventComponent
                        key={event.id}
                        event={event}
                        onClick={onRecordClick}
                        enableDragDrop={false}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Format current date display
  const getCurrentDateDisplay = (): string => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = addDays(weekStart, 6);
      return `${weekStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${weekEnd.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    } else if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } else {
      return 'Agenda';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Loader2
          className="h-10 w-10 animate-spin mb-4 text-primary"
          aria-hidden="true"
        />
        <p className="text-base text-muted-foreground">Loading calendar...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-destructive">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-destructive/10">
          <AlertCircle
            className="h-8 w-8 text-destructive"
            aria-hidden="true"
          />
        </div>
        <p className="text-base font-medium text-destructive">
          Failed to load calendar
        </p>
        <p className="text-sm mt-1 text-destructive">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-6 px-4 min-h-[44px] rounded-lg font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label="Retry loading calendar"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col rounded-xl overflow-hidden bg-background border border-border">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-card border-b border-border">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors bg-muted text-foreground border border-border hover:bg-muted/80"
            aria-label="Go to today"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevious}
              className="p-2 min-h-[44px] min-w-[44px] rounded-lg transition-colors text-muted-foreground hover:bg-muted"
              aria-label="Previous period"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              onClick={handleNext}
              className="p-2 min-h-[44px] min-w-[44px] rounded-lg transition-colors text-muted-foreground hover:bg-muted"
              aria-label="Next period"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
          <h2 className="text-lg font-semibold ml-2 text-foreground">
            {getCurrentDateDisplay()}
          </h2>
        </div>

        {/* Right: View mode switcher and actions */}
        <div className="flex items-center gap-2">
          {/* View mode buttons */}
          <div
            className="flex items-center rounded-lg overflow-hidden border border-border bg-muted"
            role="group"
            aria-label="Calendar view modes"
          >
            <button
              onClick={() => handleViewModeChange('month')}
              className={`px-3 py-2 min-h-[44px] text-sm font-medium flex items-center gap-1 transition-colors border-r border-border ${
                viewMode === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-foreground hover:bg-muted/80'
              }`}
              aria-pressed={viewMode === 'month'}
              aria-label="Month view"
            >
              <Calendar size={16} aria-hidden="true" />
              Month
            </button>
            <button
              onClick={() => handleViewModeChange('week')}
              className={`px-3 py-2 min-h-[44px] text-sm font-medium transition-colors border-r border-border ${
                viewMode === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-foreground hover:bg-muted/80'
              }`}
              aria-pressed={viewMode === 'week'}
              aria-label="Week view"
            >
              Week
            </button>
            <button
              onClick={() => handleViewModeChange('day')}
              className={`px-3 py-2 min-h-[44px] text-sm font-medium flex items-center gap-1 transition-colors border-r border-border ${
                viewMode === 'day'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-foreground hover:bg-muted/80'
              }`}
              aria-pressed={viewMode === 'day'}
              aria-label="Day view"
            >
              <Clock size={16} aria-hidden="true" />
              Day
            </button>
            <button
              onClick={() => handleViewModeChange('agenda')}
              className={`px-3 py-2 min-h-[44px] text-sm font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'agenda'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-foreground hover:bg-muted/80'
              }`}
              aria-pressed={viewMode === 'agenda'}
              aria-label="Agenda view"
            >
              <List size={16} aria-hidden="true" />
              Agenda
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors bg-muted text-foreground border border-border hover:bg-muted/80"
              aria-label="Refresh calendar data"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Calendar Body */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'agenda' && renderAgendaView()}

        {/* Drag Overlay */}
        <DragOverlay>
          {activeEvent ? (
            <EventComponent
              event={activeEvent}
              isDragging={true}
              enableDragDrop={false}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default CalendarView;

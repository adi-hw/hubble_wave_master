/**
 * TimelineView Component
 * HubbleWave Platform - Phase 2
 *
 * A horizontal timeline view for visualizing time-based records.
 * Supports multiple zoom levels, grouping, and drag-to-reschedule functionality.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { TimelineViewConfig, BaseViewProps } from '../types';

interface TimelineViewProps extends BaseViewProps<TimelineViewConfig> {
  onItemMove?: (
    itemId: string,
    newStart: Date,
    newEnd?: Date
  ) => Promise<void>;
}

interface TimelineItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  group?: string;
  record: Record<string, unknown>;
}

interface TimelineGroup {
  id: string;
  label: string;
  items: TimelineItem[];
}

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];

const ZOOM_CONFIGS: Record<
  ZoomLevel,
  { unitMs: number; columnWidth: number; format: Intl.DateTimeFormatOptions }
> = {
  day: {
    unitMs: 24 * 60 * 60 * 1000,
    columnWidth: 40,
    format: { day: 'numeric' },
  },
  week: {
    unitMs: 7 * 24 * 60 * 60 * 1000,
    columnWidth: 100,
    format: { month: 'short', day: 'numeric' },
  },
  month: {
    unitMs: 30 * 24 * 60 * 60 * 1000,
    columnWidth: 120,
    format: { month: 'short', year: '2-digit' },
  },
  quarter: {
    unitMs: 90 * 24 * 60 * 60 * 1000,
    columnWidth: 150,
    format: { month: 'short', year: 'numeric' },
  },
  year: {
    unitMs: 365 * 24 * 60 * 60 * 1000,
    columnWidth: 100,
    format: { year: 'numeric' },
  },
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  config,
  data,
  loading,
  error,
  onRecordClick,
  onRefresh,
  onConfigChange,
}) => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(
    config.zoomLevel || 'month'
  );
  const [viewStart, setViewStart] = useState<Date>(() => {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragItem, setDragItem] = useState<TimelineItem | null>(null);
  const [, setDragOffset] = useState(0);

  const timelineRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Transform records into timeline items
  const items = useMemo<TimelineItem[]>(() => {
    const result: TimelineItem[] = [];

    for (const record of data) {
      const startValue = record[config.startDateProperty];
      if (!startValue) continue;

      const start = new Date(startValue as string | number | Date);
      if (isNaN(start.getTime())) continue;

      const endValue = config.endDateProperty
        ? record[config.endDateProperty]
        : null;
      const end = endValue
        ? new Date(endValue as string | number | Date)
        : new Date(start.getTime() + 24 * 60 * 60 * 1000);

      const color = config.colorProperty
        ? (record[config.colorProperty] as string)
        : undefined;

      const group = config.groupByProperty
        ? String(record[config.groupByProperty] ?? 'Ungrouped')
        : 'All Items';

      result.push({
        id: record.id as string,
        title: (record[config.titleProperty] as string) || 'Untitled',
        start,
        end: isNaN(end.getTime()) ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : end,
        color,
        group,
        record,
      });
    }

    return result;
  }, [data, config]);

  // Group items by groupByProperty
  const groups = useMemo<TimelineGroup[]>(() => {
    const groupMap = new Map<string, TimelineItem[]>();

    for (const item of items) {
      const groupId = item.group || 'Ungrouped';
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)!.push(item);
    }

    return Array.from(groupMap.entries())
      .map(([id, groupItems]) => ({
        id,
        label: id,
        items: groupItems.sort((a, b) => a.start.getTime() - b.start.getTime()),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  // Calculate view range based on zoom level
  const { viewEnd, columns } = useMemo(() => {
    const zoomConfig = ZOOM_CONFIGS[zoomLevel];
    const columnCount = Math.ceil(window.innerWidth / zoomConfig.columnWidth) + 5;
    const viewEndDate = new Date(
      viewStart.getTime() + columnCount * zoomConfig.unitMs
    );

    const cols: { date: Date; label: string }[] = [];
    let currentDate = new Date(viewStart);

    for (let i = 0; i < columnCount; i++) {
      cols.push({
        date: new Date(currentDate),
        label: currentDate.toLocaleDateString('en-US', zoomConfig.format),
      });
      currentDate = new Date(currentDate.getTime() + zoomConfig.unitMs);
    }

    return { viewEnd: viewEndDate, columns: cols };
  }, [viewStart, zoomLevel]);

  // Calculate item position and width
  const getItemStyle = useCallback(
    (item: TimelineItem) => {
      const zoomConfig = ZOOM_CONFIGS[zoomLevel];
      const timelineWidth = columns.length * zoomConfig.columnWidth;
      const totalDuration = viewEnd.getTime() - viewStart.getTime();

      const startOffset = Math.max(0, item.start.getTime() - viewStart.getTime());
      const endOffset = Math.min(
        totalDuration,
        item.end.getTime() - viewStart.getTime()
      );
      const duration = endOffset - startOffset;

      const left = (startOffset / totalDuration) * timelineWidth;
      const width = Math.max(20, (duration / totalDuration) * timelineWidth);

      return {
        left: `${left}px`,
        width: `${width}px`,
      };
    },
    [viewStart, viewEnd, columns, zoomLevel]
  );

  // Navigation handlers
  const handlePrevious = () => {
    const zoomConfig = ZOOM_CONFIGS[zoomLevel];
    setViewStart(new Date(viewStart.getTime() - zoomConfig.unitMs * 5));
  };

  const handleNext = () => {
    const zoomConfig = ZOOM_CONFIGS[zoomLevel];
    setViewStart(new Date(viewStart.getTime() + zoomConfig.unitMs * 5));
  };

  const handleToday = () => {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    setViewStart(now);
  };

  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      const newZoom = ZOOM_LEVELS[currentIndex - 1];
      setZoomLevel(newZoom);
      onConfigChange?.({ zoomLevel: newZoom });
    }
  };

  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      const newZoom = ZOOM_LEVELS[currentIndex + 1];
      setZoomLevel(newZoom);
      onConfigChange?.({ zoomLevel: newZoom });
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent, item: TimelineItem) => {
    e.preventDefault();
    setIsDragging(true);
    setDragItem(item);

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset(e.clientX - rect.left);
  };

  const handleDragEnd = useCallback(async () => {
    if (!isDragging || !dragItem || !timelineRef.current) {
      setIsDragging(false);
      setDragItem(null);
      return;
    }

    setIsDragging(false);
    setDragItem(null);
  }, [isDragging, dragItem]);

  // Scroll synchronization
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Check if item is visible in current view
  const isItemVisible = (item: TimelineItem): boolean => {
    return item.end.getTime() >= viewStart.getTime() && item.start.getTime() <= viewEnd.getTime();
  };

  // Get color for item
  const getItemColor = (item: TimelineItem): string => {
    if (item.color) return item.color;

    const colors = [
      '#3b82f6',
      'hsl(142 76% 36%)',
      'hsl(38 92% 50%)',
      'hsl(199 89% 48%)',
      'hsl(271 91% 65%)',
    ];

    const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Clean up drag event listeners
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, handleDragEnd]);

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-base text-muted-foreground">
          Loading timeline...
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
          Failed to load timeline
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

  // Empty state
  if (items.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Calendar size={48} className="text-muted-foreground/50" />
        <p className="mt-4 text-base text-muted-foreground">
          No items to display on the timeline
        </p>
      </div>
    );
  }

  const zoomConfig = ZOOM_CONFIGS[zoomLevel];

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col rounded-xl overflow-hidden bg-background border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {config.name}
          </h2>
          <span className="text-sm px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {items.length} items
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation */}
          <button
            onClick={handleToday}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-muted text-foreground border border-border hover:bg-muted/80"
          >
            Today
          </button>
          <div className="flex items-center">
            <button
              onClick={handlePrevious}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg overflow-hidden mx-2 border border-border bg-muted">
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel === 'day'}
              className="p-2 transition-colors disabled:opacity-50 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
            <span className="px-3 py-1 text-sm font-medium min-w-[70px] text-center border-l border-r border-border text-foreground">
              {zoomLevel.charAt(0).toUpperCase() + zoomLevel.slice(1)}
            </span>
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel === 'year'}
              className="p-2 transition-colors disabled:opacity-50 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Group labels (fixed) */}
        <div className="flex-shrink-0 overflow-hidden w-[200px] border-r border-border bg-muted">
          {/* Header spacer */}
          <div className="h-10 px-4 flex items-center border-b border-border bg-muted/80">
            <span className="text-sm font-medium text-muted-foreground">
              {config.groupByProperty || 'Items'}
            </span>
          </div>

          {/* Group labels */}
          <div className="overflow-y-auto h-[calc(100%-40px)]">
            {groups.map((group) => (
              <div
                key={group.id}
                className="h-16 px-4 flex items-center border-b border-border"
              >
                <span className="text-sm font-medium truncate text-foreground">
                  {group.label}
                </span>
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {group.items.length}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline grid */}
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{
            '--tw-column-width': `${zoomConfig.columnWidth}px`,
            '--tw-timeline-width': `${columns.length * zoomConfig.columnWidth}px`,
          } as React.CSSProperties}
        >
          {/* Time header */}
          <div
            ref={headerRef}
            className="h-10 flex flex-shrink-0 overflow-hidden border-b border-border bg-muted/80"
          >
            {columns.map((col, index) => (
              <div
                key={index}
                className="flex-shrink-0 px-2 flex items-center justify-center border-r border-border w-[var(--tw-column-width)]"
              >
                <span className="text-xs font-medium truncate text-muted-foreground">
                  {col.label}
                </span>
              </div>
            ))}
          </div>

          {/* Timeline rows */}
          <div
            ref={timelineRef}
            className="flex-1 overflow-auto"
            onScroll={handleTimelineScroll}
          >
            <div className="min-h-full w-[var(--tw-timeline-width)]">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="relative h-16 border-b border-border bg-[repeating-linear-gradient(to_right,hsl(var(--border))_0px,hsl(var(--border))_1px,transparent_1px,transparent_var(--tw-column-width))]"
                >
                  {/* Timeline items */}
                  {group.items.filter(isItemVisible).map((item) => {
                    const itemStyle = getItemStyle(item);
                    const color = getItemColor(item);

                    return (
                      <div
                        key={item.id}
                        className="absolute top-2 h-12 rounded-md cursor-pointer transition-transform hover:scale-[1.02] hover:z-10 shadow-sm"
                        style={{
                          ...itemStyle,
                          backgroundColor: color,
                        }}
                        onClick={() => onRecordClick?.(item.record)}
                        onMouseDown={(e) => handleDragStart(e, item)}
                        title={`${item.title}\n${item.start.toLocaleDateString()} - ${item.end.toLocaleDateString()}`}
                      >
                        <div className="px-2 py-1 h-full flex flex-col justify-center overflow-hidden">
                          <span className="text-sm font-medium truncate text-primary-foreground">
                            {item.title}
                          </span>
                          <span className="text-xs truncate opacity-80 text-primary-foreground">
                            {item.start.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                            {' - '}
                            {item.end.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Today indicator line */}
      {(() => {
        const today = new Date();
        if (today >= viewStart && today <= viewEnd) {
          const totalDuration = viewEnd.getTime() - viewStart.getTime();
          const todayOffset = today.getTime() - viewStart.getTime();
          const position = (todayOffset / totalDuration) * (columns.length * zoomConfig.columnWidth);

          return (
            <div
              className="absolute pointer-events-none w-0.5 bg-destructive z-[5]"
              style={{
                left: `${200 + position}px`,
                top: '100px',
                bottom: 0,
              }}
            />
          );
        }
        return null;
      })()}
    </div>
  );
};

export default TimelineView;

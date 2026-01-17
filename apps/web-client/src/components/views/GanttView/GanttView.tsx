/**
 * GanttView Component
 * HubbleWave Platform - Phase 2
 *
 * A project-oriented Gantt chart view for visualizing tasks, dependencies,
 * and progress. Supports hierarchical tasks, dependency arrows, and drag-and-drop.
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Calendar,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { GanttViewConfig, GanttTask, BaseViewProps } from '../types';

interface GanttViewProps extends BaseViewProps<GanttViewConfig> {
  onTaskMove?: (
    taskId: string,
    newStart: Date,
    newEnd: Date
  ) => Promise<void>;
  onProgressUpdate?: (taskId: string, progress: number) => Promise<void>;
}

interface ProcessedTask extends GanttTask {
  level: number;
  isExpanded: boolean;
  hasChildren: boolean;
  isVisible: boolean;
  isCritical: boolean;
}

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];

const ZOOM_CONFIGS: Record<
  ZoomLevel,
  { unitMs: number; columnWidth: number; format: Intl.DateTimeFormatOptions; subFormat?: Intl.DateTimeFormatOptions }
> = {
  day: {
    unitMs: 24 * 60 * 60 * 1000,
    columnWidth: 40,
    format: { day: 'numeric' },
    subFormat: { weekday: 'short' },
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

const ROW_HEIGHT = 40;
const TASK_HEIGHT = 28;
const TASK_MARGIN = (ROW_HEIGHT - TASK_HEIGHT) / 2;

interface GanttTimelineContainerProps {
  width: number;
  height: number;
  columnWidth: number;
  rowHeight: number;
  viewStart: Date;
  viewEnd: Date;
  svgRef: React.RefObject<SVGSVGElement | null>;
  renderDependencyLines: () => React.ReactElement[] | null;
  children: React.ReactNode;
}

const GanttTimelineContainer: React.FC<GanttTimelineContainerProps> = ({
  width,
  height,
  columnWidth,
  rowHeight,
  viewStart,
  viewEnd,
  svgRef,
  renderDependencyLines,
  children,
}) => {
  const today = new Date();
  const showTodayMarker = today >= viewStart && today <= viewEnd;
  const todayPosition = showTodayMarker
    ? ((today.getTime() - viewStart.getTime()) / (viewEnd.getTime() - viewStart.getTime())) * width
    : 0;

  const containerStyle = {
    '--gantt-container-width': `${width}px`,
    '--gantt-container-height': `${height}px`,
    '--gantt-column-width': `${columnWidth}px`,
    '--gantt-row-height': `${rowHeight}px`,
    '--gantt-today-position': `${todayPosition}px`,
  } as React.CSSProperties;

  return (
    <div
      className="relative w-[var(--gantt-container-width)] h-[var(--gantt-container-height)]"
      style={containerStyle}
    >
      <div
        className="absolute inset-0 bg-[repeating-linear-gradient(to_right,hsl(var(--border))_0px,hsl(var(--border))_1px,transparent_1px,transparent_var(--gantt-column-width)),repeating-linear-gradient(to_bottom,hsl(var(--border))_0px,hsl(var(--border))_1px,transparent_1px,transparent_var(--gantt-row-height))]"
      />
      {showTodayMarker && (
        <div className="absolute top-0 bottom-0 pointer-events-none z-10 w-0.5 bg-destructive left-[var(--gantt-today-position)]" />
      )}
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none w-[var(--gantt-container-width)] h-[var(--gantt-container-height)]"
      >
        {renderDependencyLines()}
      </svg>
      {children}
    </div>
  );
};

interface GanttTaskBarProps {
  task: ProcessedTask;
  left: number;
  top: number;
  width: number;
  progressWidth: number;
  colorClass: string;
  borderClass: string;
  customColorStyle?: React.CSSProperties;
  customBorderStyle?: React.CSSProperties;
  isSelected: boolean;
  showProgress?: boolean;
  enableDragDrop?: boolean;
  onClick: () => void;
}

const GanttTaskBar: React.FC<GanttTaskBarProps> = ({
  task,
  left,
  top,
  width,
  progressWidth,
  colorClass,
  borderClass,
  customColorStyle,
  customBorderStyle,
  isSelected,
  showProgress,
  enableDragDrop,
  onClick,
}) => {
  const cssVars = {
    '--gantt-left': `${left}px`,
    '--gantt-top': `${top}px`,
    '--gantt-width': `${width}px`,
    '--gantt-progress': `${progressWidth}%`,
  } as React.CSSProperties;

  return (
    <div
      className="absolute cursor-pointer transition-transform h-7 left-[var(--gantt-left)] top-[var(--gantt-top)] w-[var(--gantt-width)] hover:z-20"
      style={cssVars}
      onClick={onClick}
      title={`${task.title}\n${task.start.toLocaleDateString()} - ${task.end.toLocaleDateString()}${
        task.progress !== undefined ? `\nProgress: ${task.progress}%` : ''
      }`}
    >
      <div
        className={`absolute inset-0 rounded-md shadow-sm opacity-25 ${colorClass}`}
        style={customColorStyle}
      />
      {showProgress && task.progress !== undefined && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-[var(--gantt-progress)] ${colorClass} ${
            task.progress >= 100 ? 'rounded-md' : 'rounded-l-md'
          }`}
          style={customColorStyle}
        />
      )}
      <div
        className={`absolute inset-0 rounded-md border-2 ${borderClass} ${
          isSelected ? 'bg-primary-foreground/10' : 'bg-transparent'
        }`}
        style={customBorderStyle}
      />
      <div
        className={`absolute inset-0 flex items-center px-2 overflow-hidden ${
          task.hasChildren ? 'text-primary-foreground' : 'text-foreground'
        }`}
      >
        <span className="text-xs font-medium truncate">
          {width > 60 ? task.title : ''}
        </span>
      </div>
      {enableDragDrop && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-transparent" />
          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-transparent" />
        </>
      )}
    </div>
  );
};

export const GanttView: React.FC<GanttViewProps> = ({
  config,
  data,
  loading,
  error,
  onRecordClick,
  onRefresh,
  onConfigChange,
}) => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(
    config.defaultZoom || 'week'
  );
  const [viewStart, setViewStart] = useState<Date>(() => {
    const now = new Date();
    now.setDate(now.getDate() - 7);
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Transform records into Gantt tasks
  const tasks = useMemo<GanttTask[]>(() => {
    const result: GanttTask[] = [];

    for (const record of data) {
      const startValue = record[config.startDateProperty];
      const endValue = record[config.endDateProperty];

      if (!startValue || !endValue) continue;

      const start = new Date(startValue as string | number | Date);
      const end = new Date(endValue as string | number | Date);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

      const progress = config.progressProperty
        ? Number(record[config.progressProperty]) || 0
        : undefined;

      const dependencies = config.dependencyProperty
        ? (record[config.dependencyProperty] as string[] | undefined)
        : undefined;

      const parentId = config.parentProperty
        ? (record[config.parentProperty] as string | undefined)
        : undefined;

      const color = config.colorProperty
        ? (record[config.colorProperty] as string)
        : undefined;

      const assigneeData = config.assigneeProperty
        ? record[config.assigneeProperty]
        : undefined;

      const assignees = Array.isArray(assigneeData)
        ? assigneeData.map((a: Record<string, unknown>) => ({
            id: String(a.id || ''),
            name: String(a.name || 'Unknown'),
            avatar: a.avatar as string | undefined,
          }))
        : undefined;

      result.push({
        id: record.id as string,
        title: (record[config.titleProperty] as string) || 'Untitled',
        start,
        end,
        progress,
        dependencies,
        parentId,
        color,
        assignees,
        record,
      });
    }

    return result;
  }, [data, config]);

  // Build task hierarchy and calculate visibility
  const processedTasks = useMemo<ProcessedTask[]>(() => {
    const taskMap = new Map<string, GanttTask>();
    const childrenMap = new Map<string, GanttTask[]>();

    // Build maps
    for (const task of tasks) {
      taskMap.set(task.id, task);
      if (task.parentId) {
        if (!childrenMap.has(task.parentId)) {
          childrenMap.set(task.parentId, []);
        }
        childrenMap.get(task.parentId)!.push(task);
      }
    }

    // Calculate critical path (simplified - tasks with no slack)
    const criticalTasks = new Set<string>();
    if (config.showCriticalPath) {
      const endDates = tasks.map((t) => t.end.getTime());
      const projectEnd = Math.max(...endDates);

      for (const task of tasks) {
        if (task.end.getTime() === projectEnd) {
          criticalTasks.add(task.id);
          // Trace back through dependencies
          const traceDependencies = (taskId: string) => {
            const t = taskMap.get(taskId);
            if (t?.dependencies) {
              for (const depId of t.dependencies) {
                if (taskMap.has(depId)) {
                  criticalTasks.add(depId);
                  traceDependencies(depId);
                }
              }
            }
          };
          traceDependencies(task.id);
        }
      }
    }

    // Flatten hierarchy for rendering
    const result: ProcessedTask[] = [];

    const processTask = (task: GanttTask, level: number, parentVisible: boolean): void => {
      const children = childrenMap.get(task.id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedTasks.has(task.id);
      const isVisible = parentVisible;

      result.push({
        ...task,
        level,
        isExpanded,
        hasChildren,
        isVisible,
        isCritical: criticalTasks.has(task.id),
      });

      if (hasChildren && isExpanded) {
        for (const child of children.sort((a, b) => a.start.getTime() - b.start.getTime())) {
          processTask(child, level + 1, isVisible);
        }
      }
    };

    // Process root tasks (no parent)
    const rootTasks = tasks.filter((t) => !t.parentId);
    for (const task of rootTasks.sort((a, b) => a.start.getTime() - b.start.getTime())) {
      processTask(task, 0, true);
    }

    return result;
  }, [tasks, expandedTasks, config.showCriticalPath]);

  // Calculate view range
  const { viewEnd, columns } = useMemo(() => {
    const zoomConfig = ZOOM_CONFIGS[zoomLevel];
    const columnCount = Math.ceil(window.innerWidth / zoomConfig.columnWidth) + 10;
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

  // Calculate task bar position and width
  const getTaskStyle = useCallback(
    (task: ProcessedTask) => {
      const zoomConfig = ZOOM_CONFIGS[zoomLevel];
      const timelineWidth = columns.length * zoomConfig.columnWidth;
      const totalDuration = viewEnd.getTime() - viewStart.getTime();

      const startOffset = task.start.getTime() - viewStart.getTime();
      const endOffset = task.end.getTime() - viewStart.getTime();
      const duration = endOffset - startOffset;

      const left = (startOffset / totalDuration) * timelineWidth;
      const width = Math.max(20, (duration / totalDuration) * timelineWidth);

      return { left, width };
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
    now.setDate(now.getDate() - 7);
    now.setHours(0, 0, 0, 0);
    setViewStart(now);
  };

  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      const newZoom = ZOOM_LEVELS[currentIndex - 1];
      setZoomLevel(newZoom);
      onConfigChange?.({ defaultZoom: newZoom });
    }
  };

  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      const newZoom = ZOOM_LEVELS[currentIndex + 1];
      setZoomLevel(newZoom);
      onConfigChange?.({ defaultZoom: newZoom });
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Scroll synchronization
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleTaskListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Get task color class
  const getTaskColorClass = (task: ProcessedTask): string => {
    if (task.isCritical) return 'bg-destructive';
    if (task.color) return '';

    const colorClasses = [
      'bg-primary',
      'bg-success',
      'bg-info',
      'bg-purple-500',
      'bg-warning',
    ];

    const hash = task.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colorClasses[hash % colorClasses.length];
  };

  // Get task border color class
  const getTaskBorderClass = (task: ProcessedTask): string => {
    if (task.isCritical) return 'border-destructive';
    if (task.color) return '';

    const borderClasses = [
      'border-primary',
      'border-success-border',
      'border-info-border',
      'border-purple-500',
      'border-warning-border',
    ];

    const hash = task.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return borderClasses[hash % borderClasses.length];
  };

  // Get custom color style if task has explicit color
  const getCustomColorStyle = (task: ProcessedTask): React.CSSProperties | undefined => {
    if (task.isCritical || !task.color) return undefined;
    return { backgroundColor: task.color };
  };

  const getCustomBorderStyle = (task: ProcessedTask): React.CSSProperties | undefined => {
    if (task.isCritical || !task.color) return undefined;
    return { borderColor: task.color };
  };

  // Draw dependency lines
  const renderDependencyLines = () => {
    if (!config.showDependencies) return null;

    const lines: React.ReactElement[] = [];
    const zoomConfig = ZOOM_CONFIGS[zoomLevel];
    const timelineWidth = columns.length * zoomConfig.columnWidth;
    const totalDuration = viewEnd.getTime() - viewStart.getTime();

    const taskIndexMap = new Map<string, number>();
    processedTasks.forEach((task, index) => {
      if (task.isVisible) {
        taskIndexMap.set(task.id, index);
      }
    });

    for (const task of processedTasks) {
      if (!task.isVisible || !task.dependencies) continue;

      const targetIndex = taskIndexMap.get(task.id);
      if (targetIndex === undefined) continue;

      for (const depId of task.dependencies) {
        const sourceIndex = taskIndexMap.get(depId);
        const sourceTask = processedTasks.find((t) => t.id === depId);

        if (sourceIndex === undefined || !sourceTask) continue;

        const sourceEndOffset = sourceTask.end.getTime() - viewStart.getTime();
        const targetStartOffset = task.start.getTime() - viewStart.getTime();

        const sourceX = (sourceEndOffset / totalDuration) * timelineWidth;
        const targetX = (targetStartOffset / totalDuration) * timelineWidth;
        const sourceY = sourceIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const targetY = targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        const midX = sourceX + (targetX - sourceX) / 2;

        lines.push(
          <g key={`${depId}-${task.id}`}>
            <path
              d={`M ${sourceX} ${sourceY}
                  C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX - 8} ${targetY}`}
              fill="none"
              className="stroke-muted-foreground/50"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <polygon
              points={`${targetX - 8},${targetY - 4} ${targetX},${targetY} ${targetX - 8},${targetY + 4}`}
              className="fill-muted-foreground/50"
            />
          </g>
        );
      }
    }

    return lines;
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-base text-muted-foreground">
          Loading Gantt chart...
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
          Failed to load Gantt chart
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
  if (tasks.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col items-center justify-center rounded-xl bg-muted border border-border">
        <Calendar size={48} className="text-muted-foreground/50" />
        <p className="mt-4 text-base text-muted-foreground">
          No tasks to display in the Gantt chart
        </p>
      </div>
    );
  }

  const zoomConfig = ZOOM_CONFIGS[zoomLevel];
  const visibleTasks = processedTasks.filter((t) => t.isVisible);

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[500px] flex flex-col rounded-xl overflow-hidden bg-background border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {config.name}
          </h2>
          <span className="text-sm px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {tasks.length} tasks
          </span>
          {config.showCriticalPath && (
            <span className="text-sm px-2 py-0.5 rounded-full flex items-center gap-1 bg-destructive/10 text-destructive">
              <Link2 size={12} />
              Critical Path
            </span>
          )}
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
              className="p-2 transition-colors disabled:opacity-50 text-muted-foreground hover:text-foreground hover:bg-muted/80"
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
              className="p-2 transition-colors disabled:opacity-50 text-muted-foreground hover:text-foreground hover:bg-muted/80"
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

      {/* Gantt content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task list (fixed) */}
        <div className="flex-shrink-0 flex flex-col w-[280px] border-r-2 border-border bg-muted">
          {/* Task list header */}
          <div className="h-10 px-4 flex items-center flex-shrink-0 border-b border-border bg-muted/80">
            <span className="text-sm font-medium text-muted-foreground">
              Task Name
            </span>
          </div>

          {/* Task list items */}
          <div
            ref={taskListRef}
            className="flex-1 overflow-y-auto"
            onScroll={handleTaskListScroll}
          >
            {visibleTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-2 px-2 cursor-pointer transition-colors border-b border-border h-10 hover:bg-accent/50 ${
                  selectedTask === task.id ? 'bg-primary/10' : ''
                } ${task.level === 0 ? 'pl-2' : task.level === 1 ? 'pl-7' : task.level === 2 ? 'pl-12' : 'pl-16'}`}
                onClick={() => {
                  setSelectedTask(task.id);
                  onRecordClick?.(task.record);
                }}
              >
                {task.hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskExpansion(task.id);
                    }}
                    className="p-0.5 rounded text-muted-foreground hover:bg-accent"
                  >
                    {task.isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronUp size={14} className="rotate-180" />
                    )}
                  </button>
                )}
                <span
                  className={`flex-1 text-sm truncate ${
                    task.isCritical ? 'text-destructive' : 'text-foreground'
                  } ${task.hasChildren ? 'font-semibold' : 'font-normal'}`}
                >
                  {task.title}
                </span>
                {config.showProgress && task.progress !== undefined && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      task.progress >= 100
                        ? 'bg-success-subtle text-success-text'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {task.progress}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Time header */}
          <div
            ref={headerRef}
            className="h-10 flex flex-shrink-0 overflow-hidden border-b border-border bg-muted/80"
          >
            {columns.map((col, index) => {
              const columnWidthClass = zoomLevel === 'day' ? 'w-10' : zoomLevel === 'week' ? 'w-[100px]' : zoomLevel === 'month' ? 'w-[120px]' : zoomLevel === 'quarter' ? 'w-[150px]' : 'w-[100px]';
              return (
                <div
                  key={index}
                  className={`flex-shrink-0 px-2 flex items-center justify-center border-r border-border ${columnWidthClass}`}
                >
                  <span className="text-xs font-medium truncate text-muted-foreground">
                    {col.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Timeline rows with tasks */}
          <div
            ref={timelineRef}
            className="flex-1 overflow-auto relative"
            onScroll={handleTimelineScroll}
          >
            <GanttTimelineContainer
              width={columns.length * zoomConfig.columnWidth}
              height={visibleTasks.length * ROW_HEIGHT}
              columnWidth={zoomConfig.columnWidth}
              rowHeight={ROW_HEIGHT}
              viewStart={viewStart}
              viewEnd={viewEnd}
              svgRef={svgRef}
              renderDependencyLines={renderDependencyLines}
            >
              {visibleTasks.map((task, index) => {
                const { left, width } = getTaskStyle(task);
                const colorClass = getTaskColorClass(task);
                const borderClass = getTaskBorderClass(task);
                const customColorStyle = getCustomColorStyle(task);
                const customBorderStyle = getCustomBorderStyle(task);
                const topPosition = index * ROW_HEIGHT + TASK_MARGIN;
                const progressWidth = task.progress !== undefined ? Math.min(100, task.progress) : 0;

                return (
                  <GanttTaskBar
                    key={task.id}
                    task={task}
                    left={left}
                    top={topPosition}
                    width={width}
                    progressWidth={progressWidth}
                    colorClass={colorClass}
                    borderClass={borderClass}
                    customColorStyle={customColorStyle}
                    customBorderStyle={customBorderStyle}
                    isSelected={selectedTask === task.id}
                    showProgress={config.showProgress}
                    enableDragDrop={config.enableDragDrop}
                    onClick={() => {
                      setSelectedTask(task.id);
                      onRecordClick?.(task.record);
                    }}
                  />
                );
              })}
            </GanttTimelineContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttView;

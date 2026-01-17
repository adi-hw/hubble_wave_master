/**
 * ScheduleBuilder Component
 * HubbleWave Platform - Phase 3
 *
 * Visual schedule configuration for scheduled jobs with:
 * - Multiple frequency options
 * - Cron expression support
 * - Timezone selection
 * - Next run preview
 */

import React, { useCallback, useMemo } from 'react';
import { Clock, Calendar, RefreshCw, Timer } from 'lucide-react';

export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron' | 'once';

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  cronExpression?: string;
  timezone: string;
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  runDate?: string;
}

interface ScheduleBuilderProps {
  value: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function calculateNextRuns(config: ScheduleConfig, count: number = 5): Date[] {
  const now = new Date();
  const runs: Date[] = [];

  if (config.frequency === 'once' && config.runDate) {
    const runDate = new Date(config.runDate);
    if (runDate > now) runs.push(runDate);
    return runs;
  }

  const [hours, minutes] = (config.time ?? '09:00').split(':').map(Number);
  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  if (nextRun <= now) {
    switch (config.frequency) {
      case 'hourly':
        nextRun.setHours(nextRun.getHours() + 1);
        break;
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      default:
        nextRun.setDate(nextRun.getDate() + 1);
    }
  }

  if (config.frequency === 'weekly' && config.dayOfWeek !== undefined) {
    while (nextRun.getDay() !== config.dayOfWeek) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  }

  if (config.frequency === 'monthly' && config.dayOfMonth !== undefined) {
    nextRun.setDate(config.dayOfMonth);
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
  }

  for (let i = 0; i < count; i++) {
    runs.push(new Date(nextRun));

    switch (config.frequency) {
      case 'hourly':
        nextRun.setHours(nextRun.getHours() + 1);
        break;
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      default:
        break;
    }
  }

  return runs;
}

function formatDate(date: Date, timezone: string): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  });
}

export const ScheduleBuilder: React.FC<ScheduleBuilderProps> = ({ value, onChange }) => {
  const updateConfig = useCallback(
    <K extends keyof ScheduleConfig>(key: K, val: ScheduleConfig[K]) => {
      onChange({ ...value, [key]: val });
    },
    [value, onChange]
  );

  const nextRuns = useMemo(() => calculateNextRuns(value), [value]);

  const getScheduleDescription = (): string => {
    switch (value.frequency) {
      case 'hourly':
        return 'Every hour at minute 0';
      case 'daily':
        return `Every day at ${value.time ?? '09:00'} ${value.timezone}`;
      case 'weekly':
        const dayName = DAYS_OF_WEEK.find((d) => d.value === value.dayOfWeek)?.label ?? 'Sunday';
        return `Every ${dayName} at ${value.time ?? '09:00'} ${value.timezone}`;
      case 'monthly':
        return `On day ${value.dayOfMonth ?? 1} of every month at ${value.time ?? '09:00'} ${value.timezone}`;
      case 'cron':
        return `Custom cron: ${value.cronExpression ?? '0 9 * * *'}`;
      case 'once':
        return `Once on ${value.runDate ?? 'not set'}`;
      default:
        return 'Not configured';
    }
  };

  const frequencyOptions = [
    { value: 'hourly', label: 'Hourly', icon: Timer },
    { value: 'daily', label: 'Daily', icon: Clock },
    { value: 'weekly', label: 'Weekly', icon: Calendar },
    { value: 'monthly', label: 'Monthly', icon: Calendar },
    { value: 'cron', label: 'Custom', icon: RefreshCw },
    { value: 'once', label: 'Once', icon: Clock },
  ];

  return (
    <div className="p-5 rounded border bg-muted border-border">
      <h4 className="mb-4 font-semibold text-sm text-foreground">
        Schedule Configuration
      </h4>

      {/* Frequency Selection */}
      <div className="mb-6">
        <p className="mb-2 text-sm text-muted-foreground">
          Frequency
        </p>
        <div className="grid grid-cols-3 gap-2">
          {frequencyOptions.map((opt) => {
            const IconComponent = opt.icon;
            const isSelected = value.frequency === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateConfig('frequency', opt.value as ScheduleFrequency)}
                className={`p-4 text-center rounded border-2 cursor-pointer transition-all hover:shadow-sm ${
                  isSelected
                    ? 'bg-primary/10 border-primary'
                    : 'bg-card border-border hover:border-primary/50'
                }`}
                role="radio"
                aria-checked={isSelected}
              >
                <IconComponent
                  className={`w-4 h-4 mx-auto ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                />
                <span
                  className={`block mt-1 text-sm ${
                    isSelected ? 'font-semibold text-primary' : 'text-foreground'
                  }`}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Configuration */}
      {value.frequency !== 'cron' && value.frequency !== 'once' && (
        <div className="flex gap-4 mb-6 p-4 rounded border bg-card border-border">
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Time
            </label>
            <input
              type="time"
              value={value.time ?? '09:00'}
              onChange={(e) => updateConfig('time', e.target.value)}
              className="w-[140px] px-3 py-1.5 text-sm rounded border bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="min-w-[200px]">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Timezone
            </label>
            <select
              value={value.timezone}
              onChange={(e) => updateConfig('timezone', e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded border bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Weekly: Day of Week */}
      {value.frequency === 'weekly' && (
        <div className="mb-6">
          <p className="mb-2 text-sm text-muted-foreground">
            Day of Week
          </p>
          <div className="inline-flex rounded border border-border">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = (value.dayOfWeek ?? 1) === day.value;
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => updateConfig('dayOfWeek', day.value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors border-r border-border last:border-r-0 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-transparent text-foreground hover:bg-muted'
                  }`}
                >
                  {day.label.substring(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly: Day of Month */}
      {value.frequency === 'monthly' && (
        <div className="mb-6">
          <label className="block text-xs font-medium mb-1 text-muted-foreground">
            Day of Month
          </label>
          <select
            value={value.dayOfMonth ?? 1}
            onChange={(e) => updateConfig('dayOfMonth', parseInt(e.target.value, 10))}
            className="min-w-[150px] px-3 py-1.5 text-sm rounded border bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Cron Expression */}
      {value.frequency === 'cron' && (
        <div className="mb-6">
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Cron Expression
            </label>
            <input
              type="text"
              value={value.cronExpression ?? '0 9 * * *'}
              onChange={(e) => updateConfig('cronExpression', e.target.value)}
              placeholder="0 9 * * *"
              className="w-full px-3 py-1.5 text-sm font-mono rounded border bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground/70">
              Format: minute hour day-of-month month day-of-week
            </p>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Timezone
            </label>
            <select
              value={value.timezone}
              onChange={(e) => updateConfig('timezone', e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded border bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Once: Date picker */}
      {value.frequency === 'once' && (
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Run Date
            </label>
            <input
              type="datetime-local"
              value={value.runDate ?? ''}
              onChange={(e) => updateConfig('runDate', e.target.value)}
              className="px-3 py-1.5 text-sm rounded border bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Timezone
            </label>
            <select
              value={value.timezone}
              onChange={(e) => updateConfig('timezone', e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded border bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="p-4 rounded border border-border bg-card border-l-4 border-l-primary">
        <h5 className="mb-2 font-semibold text-sm text-foreground">
          Preview
        </h5>
        <p className="mb-4 text-sm text-muted-foreground">
          {getScheduleDescription()}
        </p>

        {nextRuns.length > 0 && (
          <>
            <p className="mb-2 text-xs text-muted-foreground/70">
              Next {nextRuns.length} runs:
            </p>
            <div className="flex flex-col gap-1">
              {nextRuns.map((run, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs rounded bg-muted text-muted-foreground">
                    {i + 1}
                  </span>
                  <span
                    className={`text-sm ${i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground/70'}`}
                  >
                    {formatDate(run, value.timezone)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * BusinessScheduleEditor
 * HubbleWave Platform - Phase 3
 *
 * Editor for business schedule configurations (work hours, days).
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { BusinessSchedule, commitmentApi } from '../../../services/commitmentApi';

interface BusinessScheduleEditorProps {
  scheduleId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  size?: 'sm' | 'md';
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9';
  const thumbSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const translate = size === 'sm' ? 'translate-x-3' : 'translate-x-4';

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`toggle-track ${sizeClasses} ${checked ? 'toggle-track-on' : ''}`}
      >
        <span
          className={`toggle-thumb inline-block ${thumbSize} transform ${
            checked ? translate : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-sm text-foreground">
        {label}
      </span>
    </label>
  );
};

const defaultSchedule: Partial<BusinessSchedule> = {
  name: 'New Schedule',
  code: 'new_schedule',
  timezone: 'UTC',
  is_default: false,
  work_days: {
    monday: [{ start: '09:00', end: '17:00' }],
    tuesday: [{ start: '09:00', end: '17:00' }],
    wednesday: [{ start: '09:00', end: '17:00' }],
    thursday: [{ start: '09:00', end: '17:00' }],
    friday: [{ start: '09:00', end: '17:00' }],
    saturday: [],
    sunday: [],
  },
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const BusinessScheduleEditor: React.FC<BusinessScheduleEditorProps> = ({
  scheduleId,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Partial<BusinessSchedule>>(defaultSchedule);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scheduleId && scheduleId !== 'new') {
      loadSchedule(scheduleId);
    }
  }, [scheduleId]);

  const loadSchedule = async (id: string) => {
    try {
      setLoading(true);
      const data = await commitmentApi.getSchedule(id);
      setFormData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (scheduleId && scheduleId !== 'new') {
        await commitmentApi.updateSchedule(scheduleId, formData);
      } else {
        await commitmentApi.createSchedule(formData);
      }
      if (onSave) onSave();
    } catch (e) {
      console.error(e);
      alert('Failed to save schedule');
    }
  };

  const updateDay = (day: string, intervals: { start: string; end: string }[]) => {
    setFormData((prev) => ({
      ...prev,
      work_days: {
        ...prev.work_days,
        [day]: intervals,
      },
    }));
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );

  return (
    <div className="rounded-lg border bg-card border-border">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {scheduleId === 'new' ? 'New Schedule' : 'Edit Schedule'}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm rounded border border-border text-foreground transition-colors hover:bg-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground transition-colors hover:opacity-90"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
            />
            <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
              Name
            </label>
          </div>
          <div className="relative">
            <input
              type="text"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
            />
            <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
              Code
            </label>
          </div>
          <div className="relative">
            <input
              type="text"
              value={formData.timezone || ''}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-3 py-2 rounded border text-sm bg-muted border-border text-foreground"
            />
            <label className="absolute -top-2 left-2 px-1 text-xs bg-card text-muted-foreground">
              Timezone
            </label>
            <span className="text-xs mt-1 block text-muted-foreground">
              e.g. America/New_York or UTC
            </span>
          </div>
          <div className="flex items-center">
            <ToggleSwitch
              checked={formData.is_default || false}
              onChange={(checked) => setFormData({ ...formData, is_default: checked })}
              label="Default Schedule"
            />
          </div>
        </div>

        <hr className="my-4 border-border" />

        <h4 className="text-sm font-semibold mb-3 text-foreground">
          Work Hours
        </h4>

        {DAYS.map((day) => {
          const intervals = formData.work_days?.[day] || [];
          const isOpen = intervals.length > 0;

          return (
            <div key={day} className="flex items-start mb-4">
              <div className="w-24 pt-1">
                <span className="text-sm capitalize text-foreground">
                  {day}
                </span>
              </div>
              <div className="flex-1">
                <ToggleSwitch
                  checked={isOpen}
                  onChange={(checked) => {
                    if (checked) updateDay(day, [{ start: '09:00', end: '17:00' }]);
                    else updateDay(day, []);
                  }}
                  label={isOpen ? 'Open' : 'Closed'}
                  size="sm"
                />

                {intervals.map((interval, idx) => (
                  <div key={idx} className="flex items-center gap-2 mt-2">
                    <input
                      type="time"
                      value={interval.start}
                      onChange={(e) => {
                        const newIntervals = [...intervals];
                        newIntervals[idx].start = e.target.value;
                        updateDay(day, newIntervals);
                      }}
                      className="px-2 py-1 rounded border text-sm w-28 bg-muted border-border text-foreground"
                    />
                    <span className="text-sm text-muted-foreground">
                      to
                    </span>
                    <input
                      type="time"
                      value={interval.end}
                      onChange={(e) => {
                        const newIntervals = [...intervals];
                        newIntervals[idx].end = e.target.value;
                        updateDay(day, newIntervals);
                      }}
                      className="px-2 py-1 rounded border text-sm w-28 bg-muted border-border text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => updateDay(day, intervals.filter((_, i) => i !== idx))}
                      className="p-1 rounded transition-colors hover:bg-danger-subtle"
                      aria-label="Remove interval"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                ))}

                {isOpen && (
                  <button
                    type="button"
                    onClick={() =>
                      updateDay(day, [...intervals, { start: '12:00', end: '13:00' }])
                    }
                    className="flex items-center gap-1 mt-2 text-sm text-primary transition-colors hover:opacity-80"
                  >
                    <Plus className="w-4 h-4" />
                    Add Break/Shift
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

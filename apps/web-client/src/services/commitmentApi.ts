
import api from './api';

export interface BusinessSchedule {
  id: string;
  code: string;
  name: string;
  timezone: string;
  is_default: boolean;
  work_days: Record<string, { start: string; end: string }[]>;
}

export interface HolidayCalendar {
  id: string;
  code: string;
  name: string;
  holidays: { date: string; name: string }[];
}

export interface CommitmentDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  collection_id: string;
  commitment_type: 'sla' | 'ola';
  target_field?: string;
  start_condition?: Record<string, unknown>;
  stop_condition?: Record<string, unknown>;
  pause_condition?: Record<string, unknown>;
  breach_threshold: number; // minutes
  warning_threshold?: number; // minutes
  business_schedule_id?: string;
  is_active: boolean;
}

export interface CommitmentTracker {
  id: string;
  commitment_id: string;
  collection_id: string;
  record_id: string;
  tracker_type: 'sla' | 'ola';
  state: 'active' | 'paused' | 'breached' | 'fulfilled' | 'cancelled' | 'warning';
  started_at: string;
  target_at: string;
  paused_at?: string;
  total_paused_ms: string; // bigint sent as string
  escalation_level: number;
  commitmentDefinition?: CommitmentDefinition;
}

export const commitmentApi = {
  // Schedules
  getSchedules: () => api.get<BusinessSchedule[]>('/business-schedules').then(r => r.data),
  getSchedule: (id: string) => api.get<BusinessSchedule>(`/business-schedules/${id}`).then(r => r.data),
  createSchedule: (data: Partial<BusinessSchedule>) => api.post<BusinessSchedule>('/business-schedules', data).then(r => r.data),
  updateSchedule: (id: string, data: Partial<BusinessSchedule>) => api.put<BusinessSchedule>(`/business-schedules/${id}`, data).then(r => r.data),
  deleteSchedule: (id: string) => api.delete(`/business-schedules/${id}`),

  // Calendars
  getCalendars: () => api.get<HolidayCalendar[]>('/holiday-calendars').then(r => r.data),
  getCalendar: (id: string) => api.get<HolidayCalendar>(`/holiday-calendars/${id}`).then(r => r.data),
  createCalendar: (data: Partial<HolidayCalendar>) => api.post<HolidayCalendar>('/holiday-calendars', data).then(r => r.data),
  updateCalendar: (id: string, data: Partial<HolidayCalendar>) => api.put<HolidayCalendar>(`/holiday-calendars/${id}`, data).then(r => r.data),
  deleteCalendar: (id: string) => api.delete(`/holiday-calendars/${id}`),
  addHoliday: (calendarId: string, holiday: { date: string; name: string }) => api.post(`/holiday-calendars/${calendarId}/holidays`, holiday).then(r => r.data),
  removeHoliday: (calendarId: string, date: string) => api.delete(`/holiday-calendars/${calendarId}/holidays/${date}`),

  // Definitions
  getDefinitions: (collectionId: string) => api.get<CommitmentDefinition[]>(`/commitment-definitions?collectionId=${collectionId}`).then(r => r.data),
  getDefinition: (id: string) => api.get<CommitmentDefinition>(`/commitment-definitions/${id}`).then(r => r.data),
  createDefinition: (data: Partial<CommitmentDefinition>) => api.post<CommitmentDefinition>('/commitment-definitions', data).then(r => r.data),
  updateDefinition: (id: string, data: Partial<CommitmentDefinition>) => api.put<CommitmentDefinition>(`/commitment-definitions/${id}`, data).then(r => r.data),
  deleteDefinition: (id: string) => api.delete(`/commitment-definitions/${id}`),

  // Trackers
  getTrackersByRecord: (collectionCode: string, recordId: string) => api.get<CommitmentTracker[]>(`/commitment-trackers/record/${collectionCode}/${recordId}`).then(r => r.data),
  getTracker: (id: string) => api.get<CommitmentTracker>(`/commitment-trackers/${id}`).then(r => r.data),
  pauseTracker: (id: string, reason?: string) => api.post<CommitmentTracker>(`/commitment-trackers/${id}/pause`, { reason }).then(r => r.data),
  resumeTracker: (id: string) => api.post<CommitmentTracker>(`/commitment-trackers/${id}/resume`).then(r => r.data),
  cancelTracker: (id: string, reason?: string) => api.post<CommitmentTracker>(`/commitment-trackers/${id}/cancel`, { reason }).then(r => r.data),
};

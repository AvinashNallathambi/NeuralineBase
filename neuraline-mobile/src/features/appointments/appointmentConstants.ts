/**
 * Appointment constants & helpers — shared across all appointment screens.
 *
 * Mirrors the web app's color scheme and label mappings.
 */
import type { AppointmentStatus, AppointmentType } from '@neuraline/shared';

// ── Status metadata ──────────────────────────────────────────────────────────

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; bgClass: string; textClass: string; dotColor: string }
> = {
  scheduled: {
    label: 'Scheduled',
    bgClass: 'bg-info/15',
    textClass: 'text-info',
    dotColor: '#1890ff',
  },
  confirmed: {
    label: 'Confirmed',
    bgClass: 'bg-primary/15',
    textClass: 'text-primary',
    dotColor: '#0D7C8A',
  },
  checked_in: {
    label: 'Checked In',
    bgClass: 'bg-primary/20',
    textClass: 'text-primary',
    dotColor: '#0D7C8A',
  },
  in_progress: {
    label: 'In Progress',
    bgClass: 'bg-warning/15',
    textClass: 'text-warning',
    dotColor: '#faad14',
  },
  completed: {
    label: 'Completed',
    bgClass: 'bg-success/15',
    textClass: 'text-success',
    dotColor: '#52c41a',
  },
  cancelled: {
    label: 'Cancelled',
    bgClass: 'bg-muted/30',
    textClass: 'text-muted-foreground',
    dotColor: '#9ca3af',
  },
  no_show: {
    label: 'No Show',
    bgClass: 'bg-destructive/15',
    textClass: 'text-destructive',
    dotColor: '#ff4d4f',
  },
};

// ── Type metadata ────────────────────────────────────────────────────────────

export const TYPE_META: Record<
  AppointmentType,
  { label: string; bgClass: string; textClass: string; icon: string }
> = {
  new_patient: {
    label: 'New Patient',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
    icon: 'account-plus',
  },
  follow_up: {
    label: 'Follow-Up',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: 'refresh',
  },
  annual_physical: {
    label: 'Annual Physical',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: 'heart-pulse',
  },
  urgent_care: {
    label: 'Urgent Care',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    icon: 'alert-circle',
  },
  telehealth: {
    label: 'Telehealth',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    icon: 'video',
  },
  procedure: {
    label: 'Procedure',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    icon: 'surgical-variant',
  },
  consultation: {
    label: 'Consultation',
    bgClass: 'bg-teal-100',
    textClass: 'text-teal-700',
    icon: 'stethoscope',
  },
  group_therapy: {
    label: 'Group Therapy',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-700',
    icon: 'account-group',
  },
  group_session: {
    label: 'Group Session',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    icon: 'account-multiple',
  },
};

export const APPOINTMENT_TYPES: AppointmentType[] = [
  'consultation',
  'follow_up',
  'new_patient',
  'annual_physical',
  'urgent_care',
  'telehealth',
  'procedure',
  'group_therapy',
  'group_session',
];

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
];

// ── Status workflow transitions ──────────────────────────────────────────────

export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'in_progress', 'cancelled', 'no_show'],
  checked_in: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

// ── Date/time helpers ────────────────────────────────────────────────────────

/** Format time as "9:30 AM" */
export const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/** Format date as "Mon, Aug 19" */
export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

/** Format date as "2025-08-19" (for API queries and calendar keys).
 *  Uses local date components (not UTC) to avoid off-by-one timezone shifts. */
export const toDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Get duration in minutes between two ISO times */
export const getDurationMinutes = (start: string, end: string): number => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 60000);
};

/** Format duration as "30 min" or "1 hr 15 min" */
export const formatDuration = (start: string, end: string): string => {
  const mins = getDurationMinutes(start, end);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
};

/** Check if appointment is today */
export const isToday = (iso: string): boolean => {
  // Parse as local date (YYYY-MM-DD format) to avoid UTC offset issues
  const parts = iso.split('T')[0].split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

/** Check if appointment is in the past */
export const isPast = (iso: string): boolean => {
  return new Date(iso) < new Date();
};

/** Check if appointment is upcoming (future or today) */
export const isUpcoming = (iso: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const aptDate = new Date(iso);
  aptDate.setHours(0, 0, 0, 0);
  return aptDate >= today;
};

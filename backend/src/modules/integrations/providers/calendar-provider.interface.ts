// ─────────────────────────────────────────────────────────────────────────────
// Calendar Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees: Array<{ email: string; name?: string; optional?: boolean }>;
  reminders?: Array<{ minutesBefore: number; method: 'email' | 'popup' }>;
  metadata?: Record<string, unknown>;
  /** ID of the corresponding appointment in our system */
  appointmentId?: string;
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink?: string;
  hangoutLink?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CalendarSyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: Array<{ appointmentId: string; error: string }>;
}

export interface CalendarProvider {
  readonly name: string;

  /** Test that the credentials are valid */
  testConnection(credentials: Record<string, unknown>): Promise<{ success: boolean; message: string }>;

  /** Get OAuth authorization URL */
  getAuthUrl(redirectUri: string, state: string): string;

  /** Exchange OAuth code for tokens */
  exchangeCode(code: string, redirectUri: string): Promise<Record<string, unknown>>;

  /** Refresh OAuth token if needed */
  refreshToken?(credentials: Record<string, unknown>): Promise<Record<string, unknown>>;

  /** Create or update an event in the calendar */
  upsertEvent(credentials: Record<string, unknown>, event: CalendarEvent): Promise<CalendarEventResult>;

  /** Delete an event from the calendar */
  deleteEvent(credentials: Record<string, unknown>, eventId: string): Promise<void>;

  /** List events in a time range */
  listEvents(
    credentials: Record<string, unknown>,
    startTime: Date,
    endTime: Date,
  ): Promise<CalendarEvent[]>;

  /** Sync appointments from our system to the calendar */
  syncFromAppointments(
    credentials: Record<string, unknown>,
    appointments: CalendarEvent[],
  ): Promise<CalendarSyncResult>;
}

export const CALENDAR_PROVIDER = Symbol('CALENDAR_PROVIDER');

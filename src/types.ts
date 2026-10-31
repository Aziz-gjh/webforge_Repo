export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export interface Site { id: string; name: string; tripLength: number; blurb: string; image: string }

export interface ScheduleSettings { openHour: number; closeHour: number; windowDays: number }

export interface Booking {
  id: string; customerId: string; customerName: string; customerEmail: string;
  siteId: string; siteName: string; tripLength: number;
  date: string;          // "2026-11-03" (Riyadh)
  startHour: number;     // 10
  startAt: Date;
  slotKeys: string[];    // ["2026-11-03T10", "2026-11-03T11"]
  partySize: number; status: BookingStatus;
  createdAt: Date; updatedAt: Date; reminderSentFor: string | null;
}

export interface TakenHour { hour: number; bookingId: string }

/**
 * Change request: a recurring unavailable time set by the Provider, e.g. every Friday 12:00-14:00.
 * weekdays use JS numbering on the Riyadh date (0 = Sunday ... 6 = Saturday); hours are Riyadh,
 * endHour is exclusive. Conflicts with bookings are worked out from this, never stored, so
 * existing bookings stay exactly as they were.
 */
export interface RecurringBlock {
  id: string; weekdays: number[]; startHour: number; endHour: number; label: string; createdAt: Date;
}

/** A confirmed booking that overlaps one or more recurring blocks. */
export interface BlockConflict { booking: Booking; blocks: RecurringBlock[] }

export type BookingErrorCode = 'slot-taken' | 'too-late' | 'invalid' | 'blocked' | 'permission-denied' | 'network';

export class BookingError extends Error {
  constructor(public code: BookingErrorCode, message: string) { super(message) }
}

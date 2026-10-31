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

export type BookingErrorCode = 'slot-taken' | 'too-late' | 'invalid' | 'permission-denied' | 'network';

export class BookingError extends Error {
  constructor(public code: BookingErrorCode, message: string) { super(message) }
}

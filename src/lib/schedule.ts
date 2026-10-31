// Every scheduling rule lives here. Pure functions: no Firebase, no browser time zone.
// All dates and hours are Asia/Riyadh (UTC+3, no daylight saving).
import type { BlockConflict, Booking, RecurringBlock, ScheduleSettings, TakenHour } from '../types';

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date in Riyadh, "YYYY-MM-DD". */
export function riyadhToday(now: Date = new Date()): string {
  return new Date(now.getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

/** The Booking Window: today (Riyadh) plus the following days. */
export function windowDates(settings: ScheduleSettings, now: Date = new Date()): string[] {
  const start = Date.parse(`${riyadhToday(now)}T00:00:00Z`);
  return Array.from({ length: settings.windowDays }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10));
}

/** Lock id for one Slot, e.g. "2026-11-03T10". */
export function slotKey(date: string, hour: number): string {
  return `${date}T${pad(hour)}`;
}

/** Every Slot a Booking holds, in order. */
export function slotKeysFor(date: string, startHour: number, tripLength: number): string[] {
  return Array.from({ length: tripLength }, (_, i) => slotKey(date, startHour + i));
}

/** The exact moment a Riyadh date + hour begins. */
export function riyadhStartAt(date: string, hour: number): Date {
  return new Date(`${date}T${pad(hour)}:00:00+03:00`);
}

/**
 * Start hours where the whole trip fits inside Operating Hours, inside the Booking Window,
 * starts after `now`, and touches no taken hour. A reschedule passes its own bookingId as
 * `ignoreBookingId` so its current hours count as free.
 */
export function getOpenStartTimes(args: {
  date: string; tripLength: number; settings: ScheduleSettings;
  taken: TakenHour[]; now: Date; ignoreBookingId?: string; blocks?: RecurringBlock[];
}): number[] {
  const { date, tripLength, settings, taken, now, ignoreBookingId, blocks = [] } = args;
  if (!Number.isInteger(tripLength) || tripLength < 1) return [];
  if (!windowDates(settings, now).includes(date)) return [];

  const takenHours = new Set(taken.filter(t => t.bookingId !== ignoreBookingId).map(t => t.hour));
  blockedHours(date, blocks).forEach(h => takenHours.add(h));
  const open: number[] = [];
  for (let h = settings.openHour; h + tripLength <= settings.closeHour; h++) {
    if (riyadhStartAt(date, h) <= now) continue;
    let free = true;
    for (let i = 0; i < tripLength; i++) if (takenHours.has(h + i)) free = false;
    if (free) open.push(h);
  }
  return open;
}

// ---- Change request: recurring unavailable time --------------------------------------------

/** Day of the week of a Riyadh date, JS numbering (0 = Sunday ... 6 = Saturday). */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Every hour on `date` that a recurring block makes unavailable. */
export function blockedHours(date: string, blocks: RecurringBlock[]): Set<number> {
  const day = weekdayOf(date);
  const hours = new Set<number>();
  for (const b of blocks) {
    if (!b.weekdays.includes(day)) continue;
    for (let h = b.startHour; h < b.endHour; h++) hours.add(h);
  }
  return hours;
}

/** True when a booking's hours overlap the block on the booking's weekday. Touching edges do not count. */
export function overlapsBlock(booking: Pick<Booking, 'date' | 'startHour' | 'tripLength'>, block: RecurringBlock): boolean {
  if (!block.weekdays.includes(weekdayOf(booking.date))) return false;
  return booking.startHour < block.endHour && booking.startHour + booking.tripLength > block.startHour;
}

/**
 * Confirmed bookings that clash with any recurring block, in time order.
 * Read-only: it never changes a booking, it only reports the clash.
 */
export function findConflicts(bookings: Booking[], blocks: RecurringBlock[]): BlockConflict[] {
  return bookings
    .filter(b => b.status === 'confirmed')
    .map(booking => ({ booking, blocks: blocks.filter(bl => overlapsBlock(booking, bl)) }))
    .filter(c => c.blocks.length > 0)
    .sort((a, b) => a.booking.startAt.getTime() - b.booking.startAt.getTime());
}

// Every scheduling rule lives here. Pure functions: no Firebase, no browser time zone.
// All dates and hours are Asia/Riyadh (UTC+3, no daylight saving).
import type { ScheduleSettings, TakenHour } from '../types';

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
  taken: TakenHour[]; now: Date; ignoreBookingId?: string;
}): number[] {
  const { date, tripLength, settings, taken, now, ignoreBookingId } = args;
  if (!Number.isInteger(tripLength) || tripLength < 1) return [];
  if (!windowDates(settings, now).includes(date)) return [];

  const takenHours = new Set(taken.filter(t => t.bookingId !== ignoreBookingId).map(t => t.hour));
  const open: number[] = [];
  for (let h = settings.openHour; h + tripLength <= settings.closeHour; h++) {
    if (riyadhStartAt(date, h) <= now) continue;
    let free = true;
    for (let i = 0; i < tripLength; i++) if (takenHours.has(h + i)) free = false;
    if (free) open.push(h);
  }
  return open;
}

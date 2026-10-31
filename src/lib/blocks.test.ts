// Change request: recurring unavailable time. Conflict and non-conflict cases against existing bookings.
import { describe, expect, it } from 'vitest';
import { blockedHours, findConflicts, getOpenStartTimes, overlapsBlock, riyadhStartAt, weekdayOf } from './schedule';
import type { Booking, RecurringBlock, ScheduleSettings } from '../types';

const settings: ScheduleSettings = { openHour: 6, closeHour: 19, windowDays: 7 };
const midnight = new Date('2026-11-02T21:00:00Z'); // 00:00 Tue 3 Nov 2026, Riyadh

// Every Friday 12:00-14:00 (Friday prayer), added after bookings already exist.
const friNoon: RecurringBlock = { id: 'b1', weekdays: [5], startHour: 12, endHour: 14, label: 'Friday prayer', createdAt: midnight };

function booking(over: Partial<Booking>): Booking {
  const date = over.date ?? '2026-11-06';
  const startHour = over.startHour ?? 12;
  return {
    id: 'x', customerId: 'c', customerName: 'Sara', customerEmail: 's@example.com',
    siteId: 'hegra', siteName: 'Hegra', tripLength: 2, date, startHour,
    startAt: riyadhStartAt(date, startHour), slotKeys: [], partySize: 4, status: 'confirmed',
    createdAt: midnight, updatedAt: midnight, reminderSentFor: null, ...over,
  };
}

describe('weekdays on Riyadh dates', () => {
  it('knows the day of the week', () => {
    expect(weekdayOf('2026-10-31')).toBe(6); // Saturday
    expect(weekdayOf('2026-11-03')).toBe(2); // Tuesday
    expect(weekdayOf('2026-11-06')).toBe(5); // Friday
  });
});

describe('conflicts between a new recurring block and existing bookings', () => {
  it('CONFLICT: a Friday 11:00-13:00 trip overlaps Friday 12:00-14:00', () => {
    const b = booking({ id: 'clash', date: '2026-11-06', startHour: 11, tripLength: 2 });
    expect(overlapsBlock(b, friNoon)).toBe(true);
    const found = findConflicts([b], [friNoon]);
    expect(found).toHaveLength(1);
    expect(found[0].booking.id).toBe('clash');
    expect(found[0].blocks.map(x => x.id)).toEqual(['b1']);
  });

  it('NON-CONFLICT: a Friday trip ending exactly at 12:00 only touches the block', () => {
    const b = booking({ date: '2026-11-06', startHour: 10, tripLength: 2 }); // 10:00-12:00
    expect(overlapsBlock(b, friNoon)).toBe(false);
    expect(findConflicts([b], [friNoon])).toEqual([]);
  });

  it('NON-CONFLICT: the same hours on a Tuesday are not affected', () => {
    expect(findConflicts([booking({ date: '2026-11-03', startHour: 12 })], [friNoon])).toEqual([]);
  });

  it('ignores cancelled bookings, and never changes the bookings it checks', () => {
    const cancelled = booking({ id: 'gone', status: 'cancelled', startHour: 12 });
    const kept = booking({ id: 'kept', startHour: 13, tripLength: 1 });
    const before = JSON.stringify([cancelled, kept]);
    const found = findConflicts([cancelled, kept], [friNoon]);
    expect(found.map(c => c.booking.id)).toEqual(['kept']);
    expect(JSON.stringify([cancelled, kept])).toBe(before);
  });

  it('lists every block a booking clashes with, in time order', () => {
    const second: RecurringBlock = { ...friNoon, id: 'b2', startHour: 13, endHour: 15, label: 'Maintenance' };
    const later = booking({ id: 'later', date: '2026-11-13', startHour: 12 });
    const sooner = booking({ id: 'sooner', date: '2026-11-06', startHour: 12 });
    const found = findConflicts([later, sooner], [friNoon, second]);
    expect(found.map(c => c.booking.id)).toEqual(['sooner', 'later']);
    expect(found[0].blocks.map(b => b.id)).toEqual(['b1', 'b2']);
  });
});

describe('new bookings cannot start inside a recurring block', () => {
  it('blocks the right hours only on the right weekday', () => {
    expect([...blockedHours('2026-11-06', [friNoon])]).toEqual([12, 13]);
    expect(blockedHours('2026-11-03', [friNoon]).size).toBe(0);
  });

  it('removes start times whose trip would overlap the block, and keeps the rest', () => {
    const fri = getOpenStartTimes({ date: '2026-11-06', tripLength: 2, settings, taken: [], now: midnight, blocks: [friNoon] });
    expect(fri).not.toContain(11); // 11-13 overlaps
    expect(fri).not.toContain(12);
    expect(fri).not.toContain(13);
    expect(fri).toContain(10); // 10-12 ends as the block starts
    expect(fri).toContain(14); // starts as the block ends
    const tue = getOpenStartTimes({ date: '2026-11-03', tripLength: 2, settings, taken: [], now: midnight, blocks: [friNoon] });
    expect(tue).toContain(12);
  });
});

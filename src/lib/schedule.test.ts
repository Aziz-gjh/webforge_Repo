import { describe, expect, it } from 'vitest';
import { getOpenStartTimes, riyadhStartAt, riyadhToday, slotKey, slotKeysFor, windowDates } from './schedule';
import type { ScheduleSettings } from '../types';

const settings: ScheduleSettings = { openHour: 6, closeHour: 19, windowDays: 7 };
// 00:00 on 3 Nov 2026 in Riyadh (21:00 UTC the day before)
const midnight = new Date('2026-11-02T21:00:00Z');
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const open = (over: Partial<Parameters<typeof getOpenStartTimes>[0]> = {}) =>
  getOpenStartTimes({ date: '2026-11-03', tripLength: 1, settings, taken: [], now: midnight, ...over });

describe('Riyadh time helpers', () => {
  it('uses Riyadh date, not UTC, just after midnight', () => {
    expect(riyadhToday(new Date('2026-11-02T21:30:00Z'))).toBe('2026-11-03');
    expect(riyadhToday(new Date('2026-11-02T20:59:00Z'))).toBe('2026-11-02');
  });

  it('builds a 7-day window starting today', () => {
    expect(windowDates(settings, midnight)).toEqual([
      '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09',
    ]);
  });

  it('formats slot keys and start moments', () => {
    expect(slotKey('2026-11-03', 9)).toBe('2026-11-03T09');
    expect(slotKeysFor('2026-11-03', 10, 2)).toEqual(['2026-11-03T10', '2026-11-03T11']);
    expect(riyadhStartAt('2026-11-03', 10).toISOString()).toBe('2026-11-03T07:00:00.000Z');
  });
});

describe('getOpenStartTimes', () => {
  it('empty day: every start that fits (06–18 for 1 h, 06–17 for 2 h)', () => {
    expect(open({ tripLength: 1 })).toEqual(range(6, 18));
    expect(open({ tripLength: 2 })).toEqual(range(6, 17));
  });

  it('conflict: 10:00 taken blocks a 2 h trip at 09:00 and 10:00', () => {
    const result = open({ tripLength: 2, taken: [{ hour: 10, bookingId: 'b1' }] });
    expect(result).not.toContain(9);
    expect(result).not.toContain(10);
  });

  it('non-conflict: 10:00 taken still allows a 2 h trip at 08:00 and 11:00', () => {
    const result = open({ tripLength: 2, taken: [{ hour: 10, bookingId: 'b1' }] });
    expect(result).toContain(8);
    expect(result).toContain(11);
  });

  it('a Slot taken for one Site is taken for every Site (1 h trip at 10:00 refused)', () => {
    expect(open({ taken: [{ hour: 10, bookingId: 'b1' }] })).not.toContain(10);
  });

  it('excludes start times that have already passed today', () => {
    const now = new Date('2026-11-03T07:30:00Z'); // 10:30 Riyadh
    expect(open({ now })).toEqual(range(11, 18));
  });

  it('a start time exactly now is not offered', () => {
    const now = new Date('2026-11-03T07:00:00Z'); // 10:00 Riyadh
    expect(open({ now })[0]).toBe(11);
  });

  it('reschedule: the Booking\'s own hours count as free', () => {
    const taken = [{ hour: 10, bookingId: 'mine' }, { hour: 11, bookingId: 'mine' }, { hour: 14, bookingId: 'other' }];
    const result = open({ tripLength: 2, taken, ignoreBookingId: 'mine' });
    expect(result).toContain(10);
    expect(result).toContain(11); // 11–13 overlaps only its own 11:00
    expect(result).not.toContain(13); // 13–15 hits someone else's 14:00
  });

  it('nothing outside the Booking Window or for a bad Trip Length', () => {
    expect(open({ date: '2026-11-10' })).toEqual([]);
    expect(open({ date: '2026-11-02' })).toEqual([]);
    expect(open({ tripLength: 0 })).toEqual([]);
  });
});

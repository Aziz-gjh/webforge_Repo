import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createReminderHandler, runReminders, tomorrowInRiyadh,
  type ReminderBooking, type ReminderDependencies, type ReminderEmail,
} from '../../api/send-reminders';

const now = new Date('2026-10-31T15:00:00Z');

function booking(overrides: Partial<ReminderBooking> = {}): ReminderBooking {
  return {
    id: 'booking-a', date: '2026-11-01', status: 'confirmed',
    customerName: 'Customer One', customerEmail: 'customer@example.com',
    siteName: 'Hegra', startHour: 10, tripLength: 2, partySize: 4,
    slotKeys: ['2026-11-01T10', '2026-11-01T11'],
    startAt: new Date('2026-11-01T07:00:00Z'), updatedAt: '12345:0', reminderSentFor: null,
    ...overrides,
  };
}

function fixture(records: ReminderBooking[] = [booking()]) {
  const rows = new Map(records.map((record) => [record.id, record]));
  const sent: ReminderEmail[] = [];
  const dependencies: ReminderDependencies = {
    appUrl: 'https://tours.example.com',
    store: {
      listIds: vi.fn(async () => [...rows.keys()]),
      read: vi.fn(async (id: string) => rows.get(id) ?? null),
      markSentIfCurrent: vi.fn(async (original, key) => {
        const current = rows.get(original.id);
        if (current?.status === 'confirmed' && current.updatedAt === original.updatedAt && current.slotKeys[0] === key) {
          rows.set(current.id, { ...current, reminderSentFor: key });
        }
      }),
    },
    send: vi.fn(async (email) => { sent.push(email); }),
  };
  return { dependencies, rows, sent };
}

async function request(options: Parameters<typeof createReminderHandler>[0] = {}, {
  method = 'GET', authorization = 'Bearer test-secret',
} = {}) {
  let body = '';
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) { headers.set(name, value); },
    end(value: string) { body = value; },
  };
  await createReminderHandler({ env: { CRON_SECRET: 'test-secret' }, now: () => now, ...options })(
    { method, headers: { authorization } } as IncomingMessage,
    response as unknown as ServerResponse,
  );
  return { status: response.statusCode, body: JSON.parse(body), headers };
}

beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('Reminder scheduling and state', () => {
  it('uses the Riyadh date across UTC midnight, month boundaries and leap years', () => {
    expect(tomorrowInRiyadh(new Date('2026-10-31T20:59:59Z'))).toBe('2026-11-01');
    expect(tomorrowInRiyadh(new Date('2026-10-31T21:00:00Z'))).toBe('2026-11-02');
    expect(tomorrowInRiyadh(new Date('2028-02-28T15:00:00Z'))).toBe('2028-02-29');
  });

  it('sends tomorrow’s Confirmed Booking and skips it on a repeated run', async () => {
    const { dependencies, rows, sent } = fixture();
    expect(await runReminders(dependencies, now)).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(dependencies.store.listIds).toHaveBeenCalledWith('2026-11-01');
    expect(rows.get('booking-a')?.reminderSentFor).toBe('2026-11-01T10');
    expect(sent[0].text).toContain('10:00–12:00 (Riyadh time)');
    expect(sent[0].text).toContain('Party Size: 4');
    expect(sent[0].text).toContain('https://tours.example.com/trips');
    expect(await runReminders(dependencies, now)).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(sent).toHaveLength(1);
  });

  it('skips stale query results that were cancelled, completed or moved to another day', async () => {
    const { dependencies, sent } = fixture([
      booking({ id: 'cancelled', status: 'cancelled' }),
      booking({ id: 'completed', status: 'completed' }),
      booking({ id: 'moved', date: '2026-11-02' }),
    ]);
    expect(await runReminders(dependencies, now)).toEqual({ sent: 0, skipped: 3, failed: 0 });
    expect(sent).toHaveLength(0);
  });

  it('does not send if a Booking disappeared after the query', async () => {
    const { dependencies } = fixture();
    vi.mocked(dependencies.store.read).mockResolvedValue(null);
    expect(await runReminders(dependencies, now)).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(dependencies.send).not.toHaveBeenCalled();
  });

  it('uses a fresh idempotency key for a Reschedule', async () => {
    const { dependencies, rows, sent } = fixture();
    await runReminders(dependencies, now);
    rows.set('booking-a', booking({ startHour: 11, startAt: new Date('2026-11-01T08:00:00Z'),
      slotKeys: ['2026-11-01T11', '2026-11-01T12'], updatedAt: '12346:0' }));
    await runReminders(dependencies, now);
    expect(sent).toHaveLength(2);
    expect(sent[0].idempotencyKey).not.toBe(sent[1].idempotencyKey);
    expect(rows.get('booking-a')?.reminderSentFor).toBe('2026-11-01T11');
  });

  it('reuses the idempotency key if persisting the marker fails after email acceptance', async () => {
    const { dependencies, sent } = fixture();
    vi.mocked(dependencies.store.markSentIfCurrent).mockRejectedValueOnce(new Error('Disconnected'));
    expect((await runReminders(dependencies, now)).failed).toBe(1);
    await runReminders(dependencies, now);
    expect(sent).toHaveLength(2);
    expect(sent[0].idempotencyKey).toBe(sent[1].idempotencyKey);
  });

  it('does not mark a failed delivery as sent and continues with other Bookings', async () => {
    const { dependencies, rows } = fixture([booking(), booking({ id: 'booking-b' })]);
    vi.mocked(dependencies.send).mockRejectedValueOnce(new Error('Email unavailable'));
    expect(await runReminders(dependencies, now)).toEqual({ sent: 1, skipped: 0, failed: 1 });
    expect(rows.get('booking-a')?.reminderSentFor).toBeNull();
    expect(rows.get('booking-b')?.reminderSentFor).toBe('2026-11-01T10');
  });

  it('does not mark a new start time as reminded when a Reschedule happens during delivery', async () => {
    const { dependencies, rows } = fixture();
    vi.mocked(dependencies.send).mockImplementationOnce(async () => {
      rows.set('booking-a', booking({ startHour: 11, updatedAt: '99999:0', slotKeys: ['2026-11-01T11', '2026-11-01T12'] }));
    });
    await runReminders(dependencies, now);
    expect(rows.get('booking-a')?.reminderSentFor).toBeNull();
  });

  it('escapes customer-controlled HTML in the email', async () => {
    const { dependencies, sent } = fixture([booking({ customerName: '<img src=x>', siteName: 'Hegra & "Rock"' })]);
    await runReminders(dependencies, now);
    expect(sent[0].html).toContain('&lt;img src=x&gt;');
    expect(sent[0].html).toContain('Hegra &amp; &quot;Rock&quot;');
    expect(sent[0].html).not.toContain('<img');
  });

  it('rejects malformed start times rather than sending misleading details', async () => {
    const { dependencies } = fixture([booking({ startHour: 9 })]);
    expect((await runReminders(dependencies, now)).failed).toBe(1);
    expect(dependencies.send).not.toHaveBeenCalled();
  });
});

describe('Reminder endpoint access', () => {
  it.each(['', 'Bearer wrong-secret', 'Bearer undefined'])('rejects %j without accessing Firebase or email', async (authorization) => {
    const dependencies = vi.fn();
    const result = await request({ dependencies }, { authorization });
    expect(result.status).toBe(401);
    expect(dependencies).not.toHaveBeenCalled();
    expect(result.headers.get('Cache-Control')).toBe('no-store');
  });

  it('fails closed when CRON_SECRET is missing', async () => {
    const dependencies = vi.fn();
    expect((await request({ env: {}, dependencies })).status).toBe(503);
    expect(dependencies).not.toHaveBeenCalled();
  });

  it('rejects methods other than GET', async () => {
    const result = await request({}, { method: 'POST' });
    expect(result.status).toBe(405);
    expect(result.headers.get('Allow')).toBe('GET');
  });

  it('returns sent/skipped counts for an authenticated invocation', async () => {
    const { dependencies } = fixture();
    const result = await request({ dependencies: () => dependencies });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ sent: 1, skipped: 0 });
  });

  it('reports partial failures without leaking email service errors or credentials', async () => {
    const { dependencies } = fixture();
    vi.mocked(dependencies.send).mockRejectedValue(new Error('re_private-secret customer@example.com'));
    const result = await request({ dependencies: () => dependencies });
    expect(result.status).toBe(500);
    expect(result.body.failed).toBe(1);
    expect(JSON.stringify(result.body)).not.toContain('re_private-secret');
    expect(JSON.stringify(result.body)).not.toContain('customer@example.com');
  });
});

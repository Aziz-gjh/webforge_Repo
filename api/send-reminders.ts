import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface ReminderBooking {
  id: string;
  date: string;
  status: string;
  customerName: string;
  customerEmail: string;
  siteName: string;
  startHour: number;
  tripLength: number;
  partySize: number;
  slotKeys: string[];
  startAt: Date;
  updatedAt: string;
  reminderSentFor: string | null;
}

export interface ReminderStore {
  listIds(date: string): Promise<string[]>;
  read(id: string): Promise<ReminderBooking | null>;
  markSentIfCurrent(booking: ReminderBooking, startKey: string): Promise<void>;
}

export interface ReminderEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}

export interface ReminderDependencies {
  store: ReminderStore;
  send(email: ReminderEmail): Promise<void>;
  appUrl: string;
}

export function tomorrowInRiyadh(now: Date): string {
  return new Date(now.getTime() + RIYADH_OFFSET_MS + 86_400_000)
    .toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function makeEmail(booking: ReminderBooking, appUrl: string): ReminderEmail {
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(booking.startAt);
  const hour = (value: number) => `${String(value).padStart(2, '0')}:00`;
  const time = `${hour(booking.startHour)}–${hour(booking.startHour + booking.tripLength)} (Riyadh time)`;
  const tripsUrl = new URL('/trips', appUrl).href;
  // Stable through retries; a Reschedule resets updatedAt and gets a fresh key.
  const idempotencyKey = 'reminder/' + createHash('sha256')
    .update(JSON.stringify([booking.id, booking.slotKeys[0], booking.updatedAt]))
    .digest('hex');
  return {
    to: booking.customerEmail,
    subject: `Your trip to ${booking.siteName} is tomorrow`,
    text: `Hello ${booking.customerName},\n\nYour private trip to ${booking.siteName} is tomorrow.\n${date}\n${time}\nParty Size: ${booking.partySize}\n\nView My trips: ${tripsUrl}\n\nAlUla Site Tours`,
    html: `<h1>Your trip is tomorrow</h1><p>Hello ${escapeHtml(booking.customerName)},</p><p>Your private trip to <strong>${escapeHtml(booking.siteName)}</strong> is tomorrow.</p><p>${escapeHtml(date)}<br>${escapeHtml(time)}<br>Party Size: ${booking.partySize}</p><p><a href="${escapeHtml(tripsUrl)}">View My trips</a></p><p>AlUla Site Tours</p>`,
    idempotencyKey,
  };
}

function validateBooking(booking: ReminderBooking): void {
  const startKey = `${booking.date}T${String(booking.startHour).padStart(2, '0')}`;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(booking.date) ||
    !Number.isInteger(booking.startHour) || booking.startHour < 0 || booking.startHour > 23 ||
    !Number.isInteger(booking.tripLength) || booking.tripLength < 1 || booking.tripLength > 3 ||
    booking.startHour + booking.tripLength > 24 ||
    !Number.isInteger(booking.partySize) || booking.partySize < 1 || booking.partySize > 8 ||
    booking.slotKeys[0] !== startKey || booking.slotKeys.length !== booking.tripLength ||
    !booking.updatedAt || !booking.customerName || !booking.siteName ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.customerEmail) ||
    booking.startAt.getTime() !== new Date(`${booking.date}T${String(booking.startHour).padStart(2, '0')}:00:00+03:00`).getTime()
  ) {
    throw new Error('Invalid Reminder Booking');
  }
}

export async function runReminders(dependencies: ReminderDependencies, now = new Date()) {
  const tomorrow = tomorrowInRiyadh(now);
  const ids = await dependencies.store.listIds(tomorrow);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      // Re-read immediately before sending: the initial query may be stale.
      const booking = await dependencies.store.read(id);
      if (!booking || booking.status !== 'confirmed' || booking.date !== tomorrow ||
        booking.reminderSentFor === booking.slotKeys[0] || booking.startAt <= now) {
        skipped += 1;
        continue;
      }
      validateBooking(booking);
      await dependencies.send(makeEmail(booking, dependencies.appUrl));
      sent += 1;
      // Never put an old marker onto a concurrently rescheduled Booking.
      await dependencies.store.markSentIfCurrent(booking, booking.slotKeys[0]);
    } catch (error) {
      failed += 1;
      // Do not log email addresses, credentials, provider responses or email bodies.
      console.error('Reminder processing failed', { bookingId: id, error: error instanceof Error ? error.name : 'Error' });
    }
  }
  return { sent, skipped, failed };
}

function productionDependencies(env: NodeJS.ProcessEnv): ReminderDependencies {
  if (!env.FIREBASE_SERVICE_ACCOUNT || !env.RESEND_API_KEY || !env.APP_URL) {
    throw new Error('Missing Reminder configuration');
  }
  const appUrl = new URL(env.APP_URL);
  if (appUrl.protocol !== 'https:' || appUrl.username || appUrl.password ||
    appUrl.pathname !== '/' || appUrl.search || appUrl.hash || appUrl.hostname.endsWith('.invalid')) {
    throw new Error('APP_URL must be the production HTTPS origin');
  }
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as Record<string, unknown>;
  if (typeof account.project_id !== 'string' || typeof account.client_email !== 'string' ||
    typeof account.private_key !== 'string') {
    throw new Error('Invalid Firebase service account');
  }
  const appName = 'reminder-service';
  const app = getApps().find((item) => item.name === appName) ?? initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key.replace(/\\n/g, '\n'),
    }),
  }, appName);
  const db = getFirestore(app);
  const resend = new Resend(env.RESEND_API_KEY);
  const from = env.REMINDER_FROM || `AlUla Site Tours <reminders@${appUrl.hostname}>`;

  return {
    appUrl: appUrl.origin,
    store: {
      async listIds(date) {
        const results = await db.collection('bookings')
          .where('date', '==', date).where('status', '==', 'confirmed').get();
        return results.docs.map((document) => document.id);
      },
      async read(id) {
        const document = await db.collection('bookings').doc(id).get();
        if (!document.exists) return null;
        const data = document.data()!;
        if (!(data.startAt instanceof Timestamp) || !(data.updatedAt instanceof Timestamp) ||
          !Array.isArray(data.slotKeys)) throw new Error('Invalid Booking timestamps or Slots');
        return {
          id, date: data.date, status: data.status,
          customerName: data.customerName, customerEmail: data.customerEmail,
          siteName: data.siteName, startHour: data.startHour,
          tripLength: data.tripLength, partySize: data.partySize,
          slotKeys: data.slotKeys, startAt: data.startAt.toDate(),
          updatedAt: `${data.updatedAt.seconds}:${data.updatedAt.nanoseconds}`,
          reminderSentFor: data.reminderSentFor,
        };
      },
      async markSentIfCurrent(booking, startKey) {
        const reference = db.collection('bookings').doc(booking.id);
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(reference);
          const current = snapshot.data();
          if (current?.status === 'confirmed' && current.slotKeys?.[0] === startKey &&
            current.updatedAt instanceof Timestamp &&
            `${current.updatedAt.seconds}:${current.updatedAt.nanoseconds}` === booking.updatedAt) {
            transaction.update(reference, { reminderSentFor: startKey });
          }
        });
      },
    },
    async send(email) {
      const { idempotencyKey, ...message } = email;
      const { data, error } = await resend.emails.send({ ...message, from }, { idempotencyKey });
      // Leave room below the default two-requests-per-second email rate limit.
      await delay(600);
      if (error || !data?.id) throw new Error('Resend rejected Reminder');
    },
  };
}

export function createReminderHandler(options: {
  env?: NodeJS.ProcessEnv;
  dependencies?: () => ReminderDependencies;
  now?: () => Date;
} = {}) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    const respond = (status: number, body: object) => {
      response.statusCode = status;
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      respond(405, { error: 'Method not allowed' });
      return;
    }
    const env = options.env ?? process.env;
    if (!env.CRON_SECRET) {
      respond(503, { error: 'Reminders are not configured' });
      return;
    }
    const header = request.headers.authorization;
    const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
    const actual = Buffer.from(typeof header === 'string' ? header : '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      respond(401, { error: 'Unauthorised' });
      return;
    }
    try {
      const dependencies = options.dependencies?.() ?? productionDependencies(env);
      const result = await runReminders(dependencies, options.now?.());
      if (result.failed) {
        respond(500, { ...result, error: 'Some Reminders could not be processed. Retry this request.' });
      } else {
        respond(200, { sent: result.sent, skipped: result.skipped });
      }
    } catch (error) {
      console.error('Reminder job failed', { error: error instanceof Error ? error.name : 'Error' });
      respond(500, { error: 'Reminders could not be processed' });
    }
  };
}

export default createReminderHandler();

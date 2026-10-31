import type { IncomingMessage, ServerResponse } from 'node:http';
import { productionDependencies, remindNow, type ReminderDependencies } from './send-reminders.js';

// POST /api/remind-now?booking=<id> with `Authorization: Bearer <Firebase ID token>`.
// Called by the app right after a Customer makes or moves a Booking whose daily Reminder run
// has already passed (ADR 0003). Only the Booking's own Customer can trigger it, and it never
// sends more than once per start time, so repeated calls are harmless.
export function createRemindNowHandler(options: {
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
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      respond(405, { error: 'Method not allowed' });
      return;
    }
    const bookingId = new URL(request.url ?? '/', 'http://localhost').searchParams.get('booking') ?? '';
    const header = request.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!/^[A-Za-z0-9]{1,64}$/.test(bookingId) || !token) {
      respond(400, { error: 'Missing booking or sign-in' });
      return;
    }
    let dependencies: ReminderDependencies;
    let verify: (token: string) => Promise<string>;
    let uid: string;
    try {
      dependencies = options.dependencies?.() ?? productionDependencies(options.env ?? process.env);
      if (!dependencies.verifyIdToken) throw new Error('Missing token verification');
      verify = dependencies.verifyIdToken;
    } catch {
      respond(503, { error: 'Reminders are not configured' });
      return;
    }
    try {
      uid = await verify(token);
    } catch {
      respond(401, { error: 'Unauthorised' });
      return;
    }
    try {
      respond(200, { result: await remindNow(dependencies, bookingId, uid, options.now?.()) });
    } catch (error) {
      // Do not log email addresses, credentials, provider responses or email bodies.
      console.error('Immediate Reminder failed', { bookingId, error: error instanceof Error ? error.name : 'Error' });
      respond(500, { error: 'Reminder could not be sent' });
    }
  };
}

export default createRemindNowHandler();

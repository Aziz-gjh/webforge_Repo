# Reminders are sent by one daily Vercel Cron function that reads the current state

A Vercel Cron job runs `api/send-reminders` once a day at 18:00 Riyadh time (`0 15 * * *` UTC). It uses the Firebase Admin SDK to find tomorrow's Confirmed Bookings that haven't had a Reminder for their current start time. It sends each one an email through Resend, from our own domain, verified in Cloudflare. It then records `reminderSentFor` with the start-time key.

Because the job reads the current state every time, cancelled Bookings are skipped and rescheduled ones get a fresh Reminder without any extra code. Nothing scheduled ever needs cancelling. A once-a-day job also fits Vercel's free Hobby plan.

The endpoint rejects any request without `Authorization: Bearer $CRON_SECRET`. This is also how we trigger it by hand during the demo.

## Considered Options

- **Scheduling each email at booking time** (Resend's scheduled send). Rejected: every cancel and reschedule would also have to cancel or update the scheduled email, and that call needs a server anyway.
- **Firebase "Trigger Email" extension or Cloud Functions.** Rejected: these need Firebase's paid Blaze plan, plus a second place to deploy code.
- **Sending email from the browser** (for example EmailJS). Rejected: it can't send anything later, and it puts sending credentials in the browser.

## Consequences

- This is the only code with admin access, which ignores the security rules. It reads Bookings and writes only `reminderSentFor`.
- A Booking made or rescheduled after the daily run that covers it (for tomorrow after 18:00, or for later today) would miss its Reminder. So right after such a change the app calls `POST /api/remind-now?booking=<id>` with the Customer's Firebase ID token. The function checks the token belongs to the Booking's Customer, skips it if the daily run is still ahead, and otherwise sends the same email at once ("today" or "tomorrow"). It uses the same `reminderSentFor` marker and Resend idempotency key as the daily run, so the two paths can never send twice.
- `vercel.json` must not route `/api/*` to `index.html`.

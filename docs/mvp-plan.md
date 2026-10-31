# MVP Plan — AlUla Site Tours

Terms are defined in [CONTEXT.md](../CONTEXT.md). The lasting design choices are in [docs/adr/](adr/).

## Product settings (starting values, stored in Firestore)

| Setting | Value |
|---|---|
| Time zone | **Asia/Riyadh (UTC+3, no daylight saving)**. All times are shown and calculated in Riyadh time, whatever the viewer's browser is set to. |
| Operating Hours | 06:00–19:00 every day |
| Booking Window | **7 days**: today plus the next 6. Start times that have already passed today are not offered. |
| Party Size | 1–8, required |
| Sites | Elephant Rock (1 h), AlUla Old Town (1 h), Hegra (2 h), Harrat Viewpoint (2 h). Keep every Trip Length at 3 h or less, because the security rules check each lock one by one. |
| Reminder | One email at about 18:00 Riyadh time, the day before the trip |

## Roles and access

| Who | Can see | Can do |
|---|---|---|
| Visitor | Sites, open start times | Browse. Tapping Book starts Google sign-in, then returns to the same Site and time. |
| Customer | The above, plus their own Bookings | Book; **cancel or reschedule** their own Confirmed Bookings before the trip starts |
| Provider | Every Booking, with customer name, email and Party Size | Cancel any Booking, mark one Completed |

**Sign-in is Google only** (Firebase Auth's Google sign-in, using `signInWithPopup`). There is no email-and-password sign-in. The rules reject any account whose email isn't verified, and Google accounts always have verified emails. Any Google account works, including university Google Workspace accounts. To allow only `@gmail.com` addresses, add `request.auth.token.email.matches('.*@gmail[.]com$')` to `isCustomer()`. The name and email come from the Google profile, so there's no sign-up form. The Provider is the Google account whose `providers/{uid}` record you create in the console after its first sign-in.

## Firestore data

```
sites/{siteId}          { name, tripLength, blurb, image }              read: public · write: none (seeded in console)
settings/schedule       { openHour: 6, closeHour: 19, windowDays: 7 }     read: public · write: none
users/{uid}             { name, email }                                  read/write: owner only
providers/{uid}         {}                                               read: owner · write: none
bookings/{bookingId}    { customerId, customerName, customerEmail,
                          siteId, siteName, tripLength,
                          date: "2026-11-03", startHour: 10,
                          startAt: Timestamp,                 // the exact start moment, used by the rules to block changes after the trip starts
                          slotKeys: ["2026-11-03T10","2026-11-03T11"],
                          partySize, status, createdAt, updatedAt,
                          reminderSentFor: null | "2026-11-03T10" }
slotLocks/{YYYY-MM-DDTHH} { bookingId, date, hour }                      read: public · create only · never update
```

## Security rules (what they must enforce)

Helpers: `isCustomer()` checks the user is signed in, `auth.token.email_verified == true`, and `auth.token.firebase.sign_in_provider == "google.com"`. `isProvider()` checks that `providers/{auth.uid}` exists.

- **bookings, create:** the user is a Customer; `customerId == auth.uid`; `status == "confirmed"`; `partySize` is a whole number from 1 to 8; `tripLength` equals the Site's `tripLength`; there are that many `slotKeys`; `startAt > request.time`; `reminderSentFor == null`; and the lock for each slot key exists after the write and points back to this booking (use `getAfter`).
- **bookings, read:** the owner or the Provider. A Customer's list query must include `where("customerId", "==", uid)`, or the rules will reject it.
- **bookings, update by the owner:** only while `resource.data.startAt > request.time`, and only one of two changes:
  - **Cancel:** `status` changes from confirmed to cancelled, and nothing else changes.
  - **Reschedule:** `status` stays confirmed; only `date`, `startHour`, `startAt`, `slotKeys`, `updatedAt` and `reminderSentFor` change; `reminderSentFor` becomes null; the new `startAt` is after `request.time`; there are still `tripLength` slot keys; and every new key's lock exists after the write and points back to this booking.
- **bookings, update by the Provider:** `status` changes to cancelled or completed.
- **slotLocks, create:** the booking it points to (checked with `getAfter`) belongs to the user and lists this lock's key. **slotLocks, update:** never. This is what blocks double booking.
- **slotLocks, delete:** the Provider; or the owner, when the booking after the write is cancelled or no longer lists this key (the reschedule case).

## Core logic (`src/lib/`)

- **`schedule.ts`:** a pure function, `getOpenStartTimes(date, tripLength, settings, takenHours, now)`. It returns every start hour where all `tripLength` hours are inside Operating Hours, none are taken, and the first is after `now`. When rescheduling, the Booking's own hours count as free. Unit tests in Vitest.
- **`bookings.ts`** has four functions:
  - **`createBooking`:** a `runTransaction` reads each slot's lock, aborts with "That time was just taken — pick another" if any exists, and otherwise writes the booking and all of its locks.
  - **`cancelBooking`:** one write batch sets `status: "cancelled"` and deletes the booking's locks.
  - **`rescheduleBooking`:** a `runTransaction` reads the new slots' locks, aborts if any is held by a different booking, deletes the old locks that aren't needed, creates the new locks, and updates the booking with `reminderSentFor: null`.
  - **`listMyBookings`** and **`listBookingsForDate`** (Provider).
- **Live updates:** the booking and reschedule pages listen (`onSnapshot`) to `slotLocks` for the chosen date, so a time disappears in other browsers immediately.

## Reminders (`api/send-reminders.ts`, a Vercel serverless function)

See ADR 0003.
- A Vercel Cron job (`0 15 * * *` UTC, which is 18:00 Riyadh time) calls the function. It rejects requests without `Authorization: Bearer $CRON_SECRET`.
- Using the Firebase Admin SDK, it finds bookings where `date == tomorrow (Riyadh)`, `status == "confirmed"`, and `reminderSentFor` differs from the booking's current start key.
- For each one, it sends an email through Resend from `reminders@<your-domain>`: Site, date and time, Party Size, and a link to My trips. It then sets `reminderSentFor` to the start key.
- It returns `{ sent, skipped }` for the demo.
- Environment variables (in Vercel only, never committed): `FIREBASE_SERVICE_ACCOUNT` (JSON), `RESEND_API_KEY`, `CRON_SECRET`, `APP_URL`.
- If Resend's domain check stalls: send through Gmail with an app password using nodemailer, from a team Gmail account.

## Screens

1. **Home / Sites** (public): the hero, the Site cards, and a "Book a trip" button. This is the page search engines index.
2. **Book** (public to browse): pick a Site, then a date (7 days), then a start time, then Party Size, then confirm (Google sign-in required at this step), then a confirmation page that says a Reminder will arrive the day before.
3. **My trips** (Customer): upcoming Bookings, each with a status label and **Reschedule** and **Cancel** buttons, and a sensible message when there are none.
4. **Reschedule:** the same date and time picker as Book, with the Site and Party Size fixed. The current time is shown and counts as free.
5. **Provider schedule** (Provider): a date picker (default today) and filters by Site and status, showing every Booking that day in time order. Each Booking shows its Site, customer, Party Size and a status label. Clicking a Booking shows its full details (created and updated times, whether the Reminder was sent), with Cancel / Mark completed buttons.
6. **Sign in:** one "Continue with Google" button.

Every screen that loads data handles four states: loading, empty, success and error. Cancelling asks for confirmation first.

## Stack

- Vite + React + TypeScript, React Router, Tailwind CSS, Firebase JS SDK (modular imports), Vitest.
- `api/` functions run on Vercel's Node runtime with `firebase-admin` and `resend`.
- `vercel.json`:
  - rewrite `/((?!api/).*)` to `/index.html`, so app routes work on refresh but `/api` isn't caught;
  - the cron entry.
- Firebase config for the browser goes in `VITE_FIREBASE_*` environment variables, set in Vercel.
- `public/robots.txt`, `public/sitemap.xml`, and a page title, meta description and Open Graph tags in `index.html`.
- **Look:** dark night-sky background, a sand-gold accent, one teal for statuses, monospace "terminal" labels. Photos are WebP, under 150 KB each, with a fixed width and height set.

## Production checklist

- [ ] Vercel project linked to GitHub, with the first deploy done within the first 30 minutes.
- [ ] Cloudflare: a CNAME record pointing the subdomain to `cname.vercel-dns.com`, set to **DNS only (grey cloud)**. Add the domain in Vercel.
- [ ] Firebase Auth: turn on the Google provider, and add the custom domain and the `*.vercel.app` domain under **Authorized domains**.
- [ ] Resend: add the domain, put its DNS records (SPF/DKIM) in Cloudflare set to DNS only, and wait for "Verified". **Start this in the first 30 minutes.**
- [ ] Vercel environment variables set; the cron job appears under Project → Settings → Cron Jobs.
- [ ] Google Search Console: a Domain property, verified with a TXT record in Cloudflare. Submit the sitemap.
- [ ] Bing Webmaster Tools: import from Search Console.
- [ ] Run PageSpeed Insights on the production URL and screenshot the mobile and desktop scores.
- [ ] Open the site in a fresh incognito window on the production domain. Sign in with Google, book, reschedule, refresh, sign out, sign in again, and check the booking is still there.

## Demo script

Set up beforehand: **three real Google accounts**, one Provider and two Customers, plus a few Bookings, at least one of them for tomorrow.

1. Show the public Sites page.
2. Customer 1 (normal window) and Customer 2 (incognito window) open the same date side by side. Customer 1 books Hegra at 10:00, and 10:00 and 11:00 disappear in Customer 2's window live.
3. Customer 2 tries an overlapping start time and is refused, then books a time that doesn't overlap.
4. Customer 1 reschedules Hegra from 10:00 to 11:00: the 10:00 slot frees up, and 12:00 disappears for Customer 2.
5. Customer 1 cancels a different trip, and its hours reappear.
6. Show the Provider schedule.
7. Trigger reminders: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/send-reminders`, then show the email arriving.
8. Walk through the diagram and the security rules.
9. Show the change request in action, with its unit tests (one conflict case, one non-conflict case).

## Out of scope for the MVP

- Changing the Site of an existing Booking (cancel and rebook instead).
- The Provider rescheduling a Booking for a Customer.
- Email-and-password sign-in.
- A Provider screen for editing Sites and Operating Hours.
- Payments.
- Travel time between Sites.
- Confirmation and cancellation emails (only Reminders are sent).

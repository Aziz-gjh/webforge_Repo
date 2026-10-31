# AlUla Site Tours

Private guided trips to Elephant Rock, AlUla Old Town, Hegra and Harrat Viewpoint. One Provider manages one Schedule shared across all Sites. Customers book their own group; Party Size never changes which Slots are open.

**Live URL:** not deployed yet. This checkout contains the plans and Person 3's platform implementation. Person 1's app skeleton and Person 2's Firebase contract are still required to run the complete app.

## Stack and ownership

Vite, React, TypeScript, React Router, Tailwind CSS, Firebase Google sign-in and Firestore. Vercel hosts the app and a Node.js Reminder function. Cloudflare manages domain DNS; Resend delivers email.

| Person | Owns |
| --- | --- |
| 1 | App skeleton, Customer and Visitor screens, routes, shared UI |
| 2 | Firebase, shared types and functions, scheduling, transactions, rules and indexes |
| 3 | Vercel, Provider screen, Reminders, domain/search setup, diagram, evidence and demo |

## How it works

![System diagram](docs/system-diagram.png)

The [editable Excalidraw diagram](docs/system-diagram.excalidraw) shows the agreed architecture, including components still being built by Persons 1 and 2.

Slots are calculated from Operating Hours and the Booking Window. A Booking claims one Firestore `slotLocks` record per hour in a transaction. Locks can be created but never overwritten, preventing overlaps across every Site. Rescheduling preserves shared hours and swaps the remaining locks atomically; cancellation releases locks in the same batch as its status change. Person 2 implements and verifies these protections.

| Role | Access enforced by Firestore rules |
| --- | --- |
| Visitor | Sites, Schedule settings and taken-hour locks; no Customer details |
| Customer | Own Bookings; book, cancel or reschedule before the trip starts |
| Provider | All Bookings; cancel and mark Completed |

## Person 3 implementation

- `vercel.json`: Vite build, app-route refreshes excluding `/api`, and daily cron.
- `api/send-reminders.ts`: authenticated Reminders, Riyadh dates, escaped email content, retry idempotency and conditional sent markers.
- `src/pages/provider/ProviderSchedule.tsx`: live Schedule, filters, details, cancellation confirmation and completion.
- `index.html`, `public/robots.txt`, `public/sitemap.xml`: metadata and crawl assets. The sitemap host remains a placeholder until the production address is known.

Follow [Person 3 setup](docs/part3-setup.md) for service configuration and integration, then use the [demo runbook](docs/demo-runbook.md).

## Run locally

After Person 1's skeleton and Person 2's contract are merged, install Node.js 22 or newer:

```sh
npm install
cp .env.example .env.local
# Fill in Person 2's VITE_FIREBASE_* settings in .env.local.
npm run dev
```

The complete app cannot run from this branch alone yet. Vite serves the app; the Reminder endpoint runs on Vercel. Keep the service account, email key and cron secret in Vercel's environment settings, never in browser code or variables prefixed with `VITE_`.

## Verification

27 Person 3 tests pass against isolated stubs matching the shared contract, along with a strict TypeScript check. See [verification evidence](docs/evidence/part3-verification.md) for the method and limits. Production checks remain pending.

With the shared dependencies installed:

```sh
npx vitest run docs/evidence/reminders.test.ts docs/evidence/provider.test.tsx
```

## Trade-offs and known limitations

- No travel time between Sites, payments, Provider rescheduling or editing Operating Hours in the UI.
- Scheduling is checked in the browser; the planned rules prevent overlapping locks but do not prove consecutive hours or Operating Hours. See [ADR 0001](docs/adr/0001-calculated-slots-and-hour-locks.md).
- Customer and Provider actions go straight to Firestore. Reminders are the one Admin SDK exception. See [ADR 0002](docs/adr/0002-no-server-code-rules-enforce-access.md).
- The Reminder job is scheduled at 18:00 Riyadh. On Hobby it can run later within that hour. Bookings made or rescheduled for tomorrow after the run get no automatic Reminder. See [ADR 0003](docs/adr/0003-reminders-via-daily-vercel-cron.md) and [Vercel's timing documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-jobs-accuracy).
- An email already being sent can contain the previous time after a concurrent Reschedule. It cannot mark the new time as reminded. Resend's retry keys last 24 hours; the persisted Firestore marker provides deduplication afterwards. See [Resend's idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).
- `watchBookingsForDate` has no asynchronous error callback. The Provider page bounds the initial wait; errors after a successful snapshot need a contract extension from Person 2.

## Change request

Not announced. Nothing has been implemented in anticipation of it. Person 2 leads the change after the team agrees its scope.

## References

[Glossary](CONTEXT.md) · [MVP plan](docs/mvp-plan.md) · [Team plan](docs/team-plan.md) · [Competition](https://acmchapter-psu.github.io/acm-webforge-2026/competition.html)

Original team notes: ABDELRAHMAN WAS HERE! · ABDULMOHSEN WAS HERE!

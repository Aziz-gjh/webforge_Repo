# Production demo runbook

Run after Persons 1 and 2's code is merged and production is configured. Record actual results in `docs/evidence/`; instructions alone are not evidence.

## Prepare

- Record the real production URL in the README and configure its search assets.
- Use three Google accounts: one Provider and two Customers. Person 2 creates the Provider's `providers/{uid}` record after sign-in.
- Make a Confirmed Booking for tomorrow using an inbox the team controls. Keep Customer names, emails and secrets out of public evidence.
- Open normal and private browser sessions with different Customer accounts. Keep the deployed commit and diagram ready.

## Walkthrough

1. Signed out, show Sites and open start times.
2. Open the same future date in both Customer sessions. Customer 1 books Hegra at 10:00. Show 10:00 and 11:00 disappear in Customer 2's window.
3. Attempt an overlap from Customer 2, then book a non-overlapping time.
4. Reschedule Customer 1's Hegra Booking from 10:00 to 11:00. Show 10:00 open, 11:00 still held and 12:00 newly held.
5. Cancel a different Confirmed Booking; show its Slots return. Refresh and sign out/in to check persistence.
6. In the Provider account, open `/provider`. Show filters, full Booking details, cancellation confirmation and completion. A Customer must see “Not authorised” on this route.
7. Trigger Reminders below. Show the response, received email and updated Reminder marker. Repeat: unchanged Bookings should be skipped.
8. Explain the diagram, private Bookings, public create-only hour locks, Firestore rules and the Admin-only Reminder function. Show Person 2's real access-test results.
9. After the announced change request is implemented, show its conflict/non-conflict cases and passing tests. Do not invent a change request.

## Reminder trigger

In a trusted terminal, set `CRON_SECRET` privately and `APP_URL` to the real website origin. Do not record the expanded secret.

```sh
curl --fail-with-body \
  --header "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/send-reminders"
```

For one eligible Booking, expect `{ "sent": 1, "skipped": 0 }`, then `{ "sent": 0, "skipped": 1 }` on repetition. These are example expectations, not measured results. Check the inbox too: acceptance by Resend does not prove delivery.

With server configuration present, requesting the endpoint without authorization must return HTTP 401 and send nothing.

## Submission evidence

| Evidence | Status |
| --- | --- |
| Local Person 3 tests and type check | `docs/evidence/part3-verification.md` |
| Production URL and deployed commit | Pending |
| Overlap, Reschedule, cancellation and persistence | Pending; Persons 1 and 2 required |
| Provider actions and Customer refusal | Pending |
| Email receipt, duplicate skip and unauthorized endpoint refusal | Pending |
| Firestore break-it tests | Person 2: `docs/evidence/access-tests.md` |
| Search Console/Bing verification | Pending |
| PageSpeed mobile/desktop screenshots | Pending |
| Responsive checks at 375 px and 1280 px | Pending |

Stop code changes 15 minutes before the competition deadline. Confirm every branch is merged and each teammate can explain the system.

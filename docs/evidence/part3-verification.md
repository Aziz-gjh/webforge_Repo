# Person 3 local verification — 31 October 2026

Historical isolated check. The newer [Part 2 integration verification](part2-person3-integration.md) records 38 passing tests and the actual checkout build after merging Person 2's implementation.

Branch: `person3` (originally prepared on `part3-platform`). These checks validate Person 3's code locally. They do not establish that the complete app is deployed, that Firebase rules work, or that an email reaches a real inbox.

## Environment and method

The checkout initially contained only documentation and the competition brief. There was no Node.js installation, app skeleton, shared types, Firebase implementation or package manifest.

For validation, the official Node.js 22.23.4 macOS ARM64 archive was downloaded into `/private/tmp` and checked against the published SHA-256 checksum. Dependencies were installed in `/private/tmp/webforge-part3-check`, leaving Person 1's future package files untouched. No secrets were created or used.

An isolated fixture copied the actual Reminder endpoint, Provider page, CSS and tests. The fixture's `src/types.ts` was extracted from `docs/team-plan.md` section 2. Temporary `src/lib` stubs matched the exact imported contract signatures and threw if accidentally used; Provider tests replaced those imports with controlled mocks. The fixture alone supplied a React entry point and TypeScript/Vite configuration. No stubs were added to Person 2's repository folders.

Package versions and actual command output are in [part3-test-output.txt](part3-test-output.txt).

## Results

| Check | Result |
| --- | --- |
| Strict TypeScript, including unused imports/parameters | Passed |
| Reminder and Provider tests with `TZ=Pacific/Honolulu` | 27 passed |
| Same tests with `TZ=Asia/Tokyo` | 27 passed |
| Production Vite bundle of the Provider contract fixture | Passed |
| Domain setup helper rejects HTTP, path/query/credentials and placeholder hosts | Passed in an isolated copy |
| Repeating domain setup preserves a single canonical URL, `og:url` and Sitemap directive | Passed |
| Vercel configuration JSON and routing pattern | Parsed; app paths match, `/api` and its children are excluded |
| Editable architecture diagram and PNG | Generated; PNG visually inspected |

The Vite build verifies packaging against the documented interfaces; its fixture contains no real Firebase implementation and is not a deployable version of the full app. The routing-pattern check is local, rather than a deployed Vercel routing check.

## Tested behavior

The 17 Reminder test cases cover Riyadh date rollover/leap years, Confirmed Bookings for tomorrow, repeat skips, cancellation/completion and missing-record skips, fresh Reschedule retry keys, retries after marker-write failures, partial delivery failures, concurrent Reschedules, HTML escaping, invalid start times, wrong/missing authorization, missing cron configuration, method refusal, successful counts and redaction of external error details.

The 10 Provider tests cover Visitor/Customer refusal without a data subscription, delayed role checks, Customer details and Riyadh timestamps, Site/status filtering, cancellation confirmation, duplicate completion prevention, cancellation errors, date-change privacy and listener cleanup, initial-load timeout/Retry, empty days and invalid dates.

Mocks do not verify Firestore transactions or the Admin adapter against a live database. The function's real email adapter and conditional Firestore marker transaction still need the production checks below. The dialog tests use jsdom shims for `showModal` and `close`; native focus trapping and mobile layout need a real browser.

## Repeat after integration

After Persons 1 and 2's files are merged and Person 1 has added the development dependencies listed in [setup](../part3-setup.md):

```sh
npx vitest run docs/evidence/reminders.test.ts docs/evidence/provider.test.tsx
npm run build
```

The shared app's own TypeScript configuration should also include or separately check `api/send-reminders.ts` with Node types. Do not assume a Vite configuration limited to `src/` type-checks server functions.

## Production evidence still required

- Actual production URL and deployed commit.
- Google sign-in and Provider role on the production hostname.
- Two-browser overlap refusal, atomic Reschedule, cancellation and persistence.
- Real Firestore access-rule denials from Person 2.
- Provider filters and actions using live records.
- Authenticated Reminder trigger, real inbox receipt, repeat skip and unauthenticated refusal.
- Search Console and Bing ownership/sitemap confirmation.
- PageSpeed mobile/desktop screenshots and responsive checks at 375 px and 1280 px.

Use the [demo runbook](../demo-runbook.md) to collect these results. No production evidence has been fabricated.

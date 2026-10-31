# Person 2 + Person 3 integration — 31 October 2026

Branch: `person3`. Integrated `origin/part2-data` at `bbdbe00`.

## Changes

- Merged Person 2's actual shared types, Firebase setup, authentication, Booking operations, scheduling, rules/indexes, basic React/Vite skeleton and evidence.
- Resolved the `index.html` add/add conflict by retaining Person 3's product metadata. Both versions used the same React root and entry point.
- Recorded Node `^24.12.0` because the merged Firebase packages require at least that version; verification used an official checksum-verified Node 24.22.2 runtime under `/private/tmp`.
- Added the three test-only dependencies to the manifest and lockfile so a fresh install can run the Provider checks.
- Made two Person 3 assertions compatible with Vitest 2 and used Testing Library's `act` wrapper with React 18. Person 2's shared functions and rules were not edited.

## Actual checkout results

`npm test -- --run`:

```text
RUN v2.1.9 /Users/aziz/Desktop/webforge_Repo

✓ src/lib/schedule.test.ts (11 tests)
✓ docs/evidence/reminders.test.ts (17 tests)
✓ docs/evidence/provider.test.tsx (10 tests)

Test Files  3 passed (3)
     Tests  38 passed (38)
```

`npm run build` passed. It ran `tsc -b` and Vite 5.4.21 with the actual React 18 project, checking every file under `src/`, including the Provider page against Person 2's real types and imports.

The API and test files also passed a separate strict TypeScript check, because the normal app build does not include `api/` or `docs/evidence/`:

```sh
node node_modules/typescript/bin/tsc \
  --noEmit --strict --skipLibCheck --module ESNext --moduleResolution Bundler \
  --target ES2022 --lib ES2022,DOM,DOM.Iterable --jsx react-jsx \
  --esModuleInterop --types node \
  api/send-reminders.ts src/vite-env.d.ts \
  docs/evidence/provider.test.tsx docs/evidence/reminders.test.ts
```

The first combined test run passed 36 of 38 tests; the two failures were unsupported `toHaveBeenCalledExactlyOnceWith` matchers in Person 3's tests. Replacing each with call-count plus argument assertions made all 38 pass. The original tests' intent is preserved.

## Limits and remaining work

- Provider tests use controlled authentication and Booking responses. They do not perform real Google sign-in or make live Booking changes.
- The merged `App.tsx` is still the Vite starter. Person 1 must add the Customer screens and `/provider` route; the production bundle currently serves that starter.
- The local Firebase browser configuration still lacks required populated values. Person 2 needs to share the web config privately for `.env.local` and Vercel. Secret values were not logged or committed.
- A Provider account, live Provider writes, complete Customer flow and two-browser race still need validation after routing/configuration are ready.
- Vercel deployment, domain setup, real Reminder email delivery and search/PageSpeed evidence remain pending.

Person 2's existing [access tests](access-tests.md) and [scheduling test output](test-output.md) are included unchanged. Their recorded production-rule checks were not rerun in this integration.

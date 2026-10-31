# Local preview verification — 31 October 2026

Branch: `two+3`. User requested tests and a URL to view the work.

## Preview

Vite was started on `127.0.0.1:5173`, bound to the local computer. The following URLs returned HTTP 200:

- `http://127.0.0.1:5173/design/index.html`
- `http://127.0.0.1:5173/design/book.html`
- `http://127.0.0.1:5173/design/trips.html`
- `http://127.0.0.1:5173/provider-preview.html`

The Provider preview entry module, preview component, shared view, CSS and representative Site image also returned HTTP 200.

The Customer pages are the existing design mockups. The Provider preview renders the real shared Provider view with clearly labelled sample records. Filtering, details, Cancel, Mark Completed and Reset samples use an in-memory store. Reloading clears changes. Neither preview is a completed live Customer Booking flow.

## Implementation

`ProviderSchedule.tsx` remains the production Firebase-connected component. Its view was extracted to `ProviderScheduleView.tsx` so the local preview can render it without importing authentication or Firestore. Existing Provider tests still exercise the real wrapper with controlled service responses.

The new sample-preview tests intentionally throw if the preview imports the real Firebase, authentication or Booking modules. They verify sample labelling, filtering, completion, cancellation and reset. Testing also exposed a missing separator in the screen-reader details-button name; an explicit accessible label fixes it.

## Checks

With Node 24.22.2 in the actual checkout:

```text
npm test -- --run

✓ src/lib/schedule.test.ts (11 tests)
✓ docs/evidence/reminders.test.ts (17 tests)
✓ docs/evidence/provider-preview.test.tsx (2 tests)
✓ docs/evidence/provider.test.tsx (10 tests)

Test Files  4 passed (4)
     Tests  40 passed (40)
```

`npm run build` passed, including the app's strict TypeScript check. A separate Vite build using `provider-preview.html` as its input also passed, emitting its HTML, CSS and JavaScript into `/private/tmp/webforge-provider-preview-build`. The standard production entry remains unchanged.

HTTP and component checks verify serving, compilation and tested interactions. Native browser layout/focus, live Google sign-in, real database writes and email delivery were not verified by this run.

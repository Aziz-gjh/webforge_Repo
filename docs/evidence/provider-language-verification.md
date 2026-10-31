# Provider language switching — 31 October 2026

The Provider wrapper now reads the same `useApp().lang` value as the header and passes it to the shared view. English and Arabic copy covers headings, filters, statuses, Booking details, buttons, accessibility labels, confirmation dialogs, access/loading/empty states and feedback.

Site names use the shared bilingual catalogue, with translations for older `old-town` and `harrat-viewpoint` Bookings. Customer names and email addresses remain the original Customer data. Dates use the selected language with an explicit Gregorian calendar, Latin digits and the Riyadh time zone. Time ranges, email addresses and numeric values are isolated for correct display in Arabic.

Feedback and load errors are stored as message keys, so text already on screen changes language too. Language changes do not restart the Booking subscription or reset date, Site, status or selected details.

## Regression checks

Six new component tests use the actual header language switch and shared app context. Firebase auth/Booking responses are controlled mocks.

- English → Arabic → English updates labels, current and legacy Site names, dates and details while preserving filters and selection.
- Dates stay Gregorian and time ranges remain left-to-right inside the Arabic view.
- An open confirmation and its existing error update with the language.
- A success message updates without repeating the Booking action.
- Loading, timeout/Retry, access-denied/sign-in, empty and invalid-date states translate.

Actual checkout results with Node 24.22.2:

```text
npm test -- --run

✓ src/lib/schedule.test.ts (11 tests)
✓ docs/evidence/reminders.test.ts (17 tests)
✓ docs/evidence/provider-preview.test.tsx (2 tests)
✓ docs/evidence/provider.test.tsx (10 tests)
✓ docs/evidence/provider-language.test.tsx (6 tests)

Test Files  5 passed (5)
     Tests  46 passed (46)
```

`npm run build` passed, including strict TypeScript checks. Firebase operations and security rules were not changed. Native browser layout and live database writes were not exercised by these component tests.

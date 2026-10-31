# Change request: recurring unavailable time

> The provider now needs to block out a recurring unavailable time after bookings already exist.
> The application must detect and flag conflicts between that new recurring block and bookings
> already on the schedule.

## What we built

| Need from the brief | How |
|---|---|
| Provider defines a recurring unavailable period | `/provider` → "Recurring unavailable time": pick weekdays, from/to hour, optional reason |
| Compare it against existing bookings | `findConflicts(bookings, blocks)` in `src/lib/schedule.ts`, run live over every upcoming booking |
| Clearly flag conflicting bookings | Red "Conflict" list on the provider page: site, date, time, customer, and which block it clashes with. The customer also sees a notice on that trip in My trips |
| Keep booking data intact | Blocks never write to `bookings` or `slotLocks`. Nothing is deleted or moved |
| New bookings respect the block | Blocked hours are removed from the open times on the Book page, and `createBooking` / `rescheduleBooking` refuse them (`BookingError` code `blocked`) |

## Data model

```text
blocks/{blockId}
  weekdays:  number[]   // JS numbering on the Riyadh date: 0 = Sunday ... 6 = Saturday
  startHour: number     // Riyadh hour, inclusive
  endHour:   number     // Riyadh hour, exclusive
  label:     string     // optional reason, e.g. "Friday prayer"
  createdBy: uid
  createdAt: timestamp
```

**A conflict is not stored. It is derived:** a confirmed booking conflicts with a block when the
booking's weekday is in `weekdays` and `[startHour, startHour + tripLength)` overlaps
`[block.startHour, block.endHour)`. Trips that only touch the edge (ending exactly when the block
starts) do not conflict.

Why derived instead of a `conflict` flag on each booking:

- Booking documents stay exactly as the customer created them (the brief: keep data intact).
- It can never go stale: removing a block clears its flags instantly, adding one flags at once.
- No write to someone else's booking, so the existing security rules did not need loosening.

## Permissions (`firestore.rules`)

- `blocks`: anyone can read (the booking page needs to hide blocked hours); only the Provider can
  create or delete; updates are refused; the shape is validated (1-7 weekdays, 0 <= start < end <= 24,
  label at most 60 characters, `createdBy` must be the signed-in Provider).
- `bookings` and `slotLocks`: unchanged.

## Tests

`src/lib/blocks.test.ts`, run with `npm test`:

- conflict: Friday 11:00-13:00 trip vs a Friday 12:00-14:00 block → flagged
- non-conflict: Friday 10:00-12:00 (touches the edge) → not flagged
- non-conflict: same hours on a Tuesday → not flagged
- cancelled bookings are ignored and the input bookings are not changed
- several blocks, results in time order
- blocked hours are removed from open start times only on the blocked weekday

The non-conflict edge test was watched failing with the overlap check deliberately broken
(`>=` instead of `>`), then passing again with the real code.

## Deploy

The new rules must be deployed once (needs a Firebase CLI login with access to the project):

```bash
npx firebase-tools deploy --only firestore:rules --project alula-site-tours-wf26
```

Until then the app keeps working; the provider just cannot save a block yet.

## Known limitations / with more time

- New bookings inside a block are refused in the app and in `createBooking`, but not yet by the
  security rules themselves (the rules would need the weekday of `startAt` and a block lookup).
- No "notify the customer" action yet; the provider contacts them from the conflict list.
- Blocks repeat weekly with no end date; a date range would be the next step.

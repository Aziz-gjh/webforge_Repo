# Calculated Slots, with one lock record per booked hour

Slots are never stored. The app works them out from the Operating Hours, the Booking Window and each Site's Trip Length, using one pure function that can be unit-tested. The only stored scheduling data is Bookings plus one `slotLocks/{YYYY-MM-DDTHH}` record per booked hour, in Riyadh time. A Booking and all of its lock records are created together in one Firestore transaction. Security rules allow a lock to be created but never overwritten, so a second Booking for a taken hour fails on the server even if someone bypasses the UI. Lock records hold no customer details and anyone can read them. Visitors can therefore see which hours are taken but never who took them, while the Booking records stay private to their owner and the Provider.

## Considered Options

- **Stored Slot records with an open/booked flag.** Rejected: any change to Operating Hours or Trip Lengths would mean rewriting records that already have Bookings, and the stored Slots would need topping up every day.
- **Making each Booking's ID unique by its start time.** Rejected: Bookings span several hours, so two Bookings with different start times can still overlap. One lock per hour catches every overlap.

## Consequences

- Cancelling must delete the Booking's lock records in the same write batch that marks it Cancelled, or those hours stay blocked.
- Rescheduling is one transaction. It deletes the locks the Booking no longer needs, creates only the new ones it needs, and keeps any hour the old and new times share (for example, moving Hegra from 10:00 to 11:00 keeps the 11:00 lock). A Booking never runs into its own lock.
- The security rules check ownership, Party Size and the number of locks against the Site's Trip Length. They do not check that the locked hours are consecutive or inside Operating Hours. A tampered client could therefore lock odd hours, but it can never overlap someone else's Booking. This is a known limitation.

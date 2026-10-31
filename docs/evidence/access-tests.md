# Access tests: trying to break the security rules

The brief says: *"Do not rely on hiding a button in the UI as your only permission check. Verify that users cannot access or alter another customer's bookings."*

These attacks skip the UI completely. They call Firestore directly from the browser console, signed in as **Customer 2**, and target data that belongs to **Customer 1**. Every one of them must fail with `permission-denied`.

## How to run

1. Run `npm run dev`. The dev build exposes the SDK as `window.__wf`; production builds don't.
2. Sign in as Customer 1 and book a trip. Copy its booking ID and one of its slot keys, such as `2026-11-03T10`.
3. Sign out, then sign in as Customer 2.
4. Open DevTools → Console and paste:

```js
const { db, fs } = window.__wf;
const C1_BOOKING = '<customer 1 booking id>';
const C1_LOCK = '<one of its slot keys, e.g. 2026-11-03T10>';
const me = window.__wf.auth.currentUser;
const t = p => p.then(() => 'ALLOWED ❌', e => `refused ✅ (${e.code})`);
const tomorrow10 = new Date(Date.now() + 864e5); tomorrow10.setUTCHours(7, 0, 0, 0); // 10:00 Riyadh
const day = tomorrow10.toISOString().slice(0, 10);

console.table({
  '1 read Customer 1 booking':      await t(fs.getDoc(fs.doc(db, 'bookings', C1_BOOKING))),
  '2 change its status':            await t(fs.updateDoc(fs.doc(db, 'bookings', C1_BOOKING), { status: 'cancelled' })),
  '3 overwrite its slot lock':      await t(fs.setDoc(fs.doc(db, 'slotLocks', C1_LOCK), { bookingId: 'hijack', date: C1_LOCK.slice(0, 10), hour: 10 })),
  '4 book with partySize 20':       await t((() => {
    const b = fs.doc(fs.collection(db, 'bookings')); const key = `${day}T15`;
    const batch = fs.writeBatch(db);
    batch.set(b, { customerId: me.uid, customerName: me.displayName, customerEmail: me.email, siteId: 'elephant-rock',
      siteName: 'Elephant Rock', tripLength: 1, date: day, startHour: 15, startAt: fs.Timestamp.fromDate(new Date(`${day}T12:00:00Z`)),
      slotKeys: [key], partySize: 20, status: 'confirmed', reminderSentFor: null,
      createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() });
    batch.set(fs.doc(db, 'slotLocks', key), { bookingId: b.id, date: day, hour: 15 });
    return batch.commit();
  })()),
  '5 list every booking (no filter)': await t(fs.getDocs(fs.collection(db, 'bookings'))),
  '6 delete its slot lock':         await t(fs.deleteDoc(fs.doc(db, 'slotLocks', C1_LOCK))),
  '7 make myself Provider':         await t(fs.setDoc(fs.doc(db, 'providers', me.uid), {})),
});
```

## Results

**Run 1: 31 Oct 2026, 08:41 UTC.** The attacks came from the **Run break-it tests** button on `dev-part2.html`, which issues the same calls as the script above, against live production rules on project `alula-site-tours-wf26`.
- Attacker: Customer `abdelrahmanschool06@gmail.com` (uid `PDq6sx…`).
- Target: Booking `iRS23xWm7f9xoELbFyin`, Harrat Viewpoint, 31 Oct 13:00, owned by a second Google account (uid `RlkxFe…`).

| # | Attack | Expected | Result |
|---|---|---|---|
| 1 | Read another Customer's Booking by ID | permission-denied | refused ✅ (permission-denied) |
| 2 | Change its `status` to cancelled | permission-denied | refused ✅ (permission-denied) |
| 3 | Overwrite its `slotLocks` record | permission-denied | refused ✅ (permission-denied) |
| 4 | Create a Booking with `partySize: 20` | permission-denied | refused ✅ (permission-denied) |
| 5 | List all Bookings without a `customerId` filter | permission-denied | refused ✅ (permission-denied) |
| 6 | Delete its slot lock | permission-denied | refused ✅ (permission-denied) |
| 7 | Create `providers/{myUid}` | permission-denied | refused ✅ (permission-denied) |

## Visitor (signed out) checks

Run through the Firestore REST API with only the public API key and no sign-in, on 31 Oct 2026.

| Request | Expected | HTTP |
|---|---|---|
| Read `sites` | allowed | 200 ✅ |
| Read `settings/schedule` | allowed | 200 ✅ |
| List `slotLocks` (taken hours, no customer details) | allowed | 200 ✅ |
| List `bookings` | refused | 403 ✅ |
| Write a Site | refused | 403 ✅ |
| Create a `slotLocks` record | refused | 403 ✅ |
| Create a `providers` record | refused | 403 ✅ |

## Data integrity check

On 31 Oct 2026, after manual testing with two accounts (10 Bookings: book, cancel, reschedule), we used admin access to dump every Booking and lock.
- There were 17 locks. Each one pointed to exactly one Confirmed Booking, and every hour of every Confirmed Booking had its lock.
- The cancelled Booking held no locks.
- No two Confirmed Bookings shared an hour.

## Two-browser race

Customer 1 and Customer 2 tap Confirm on the same hour at the same moment. One gets the booking, and the other gets "That time was just taken — pick another" (`slot-taken`).

Result: _not run yet_

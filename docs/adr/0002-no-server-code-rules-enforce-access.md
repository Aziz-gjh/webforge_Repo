---
status: accepted, narrowed by ADR 0003
---

# Customer and Provider actions go straight to Firestore; security rules are the access control

Every action a Customer or the Provider takes goes from the browser straight to Firebase. There is no API layer in between. Every permission check that matters happens in Firestore security rules, not in the UI:

- Customers can read, cancel and reschedule only their own Bookings.
- Locks can be created but never overwritten.
- Only verified Google sign-ins are accepted.
- The Provider is recognised by a `providers/{uid}` record that can only be created by hand in the Firebase console.

We chose this over an API layer because it removes a set of secrets and a second deployment that could fail during a 4-hour build, and it still gives server-side checks the brief requires ("do not rely on hiding a button"). The cost is that anything the rules language can't express, such as checking that booked hours are consecutive, is checked only in the browser (see ADR 0001).

The one exception is Reminder emails, which need a server; see ADR 0003.

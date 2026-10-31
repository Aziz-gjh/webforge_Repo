# Desert Site Tours

A booking app for one small tour operator that runs short, private guided trips to viewing Sites in Saudi Arabia (for example, in AlUla). Customers reserve time with the operator, and the operator manages the bookings.

## Language

### People

**Provider**:
The single tour operator that runs trips to Sites and owns the Schedule. There is exactly one Provider.
_Avoid_: Admin, staff, guide, business owner, vendor

**Customer**:
A person signed in with a verified Google account who books trips for their own group. A Customer can only see and act on their own Bookings.
_Avoid_: User, client, tourist, guest

**Visitor**:
Someone browsing without signing in. A Visitor can see Sites and open start times but can't book, and can never see who holds a Booking.
_Avoid_: Guest, anonymous user

### Scheduling

**Site**:
A viewing location the Provider offers trips to, such as a landmark in AlUla. Each Site has one fixed Trip Length.
_Avoid_: Place, destination, location, attraction

**Trip Length**:
The fixed number of whole hours that every Booking for a given Site lasts. It belongs to the Site and is never chosen by the Customer.
_Avoid_: Duration, tour length

**Schedule**:
The Provider's single timeline of Slots, shared across all Sites. Because there is one operator, a Slot booked for any Site is taken for every Site.
_Avoid_: Calendar, timetable, site schedule

**Operating Hours**:
The daily hours during which the Provider runs trips. Slots exist only inside Operating Hours, and a Booking must start and end within them.
_Avoid_: Availability, business hours, opening times

**Booking Window**:
How many days ahead, starting today, a Customer can book.
_Avoid_: Horizon, lead time

**Slot**:
A one-hour period on the Schedule, starting on the hour, that can be claimed by at most one Booking. A Slot is either open or booked.
_Avoid_: Appointment, time, opening

**Booking**:
A Customer's private claim on one or more consecutive Slots for a trip to one Site. While it holds those Slots, no other Customer can book them, whatever the group size.
_Avoid_: Appointment, reservation, order, trip

**Booking Status**:
Where a Booking stands: **Confirmed** (holds its Slots), **Cancelled** (has released its Slots; done by the Customer or the Provider) or **Completed** (the trip happened; marked by the Provider). A Booking is Confirmed as soon as it is made; there is no pending state.
_Avoid_: State, pending, approved

**Reschedule**:
Moving a Confirmed Booking to a different start time at the same Site. It stays the same Booking: the old Slots are released and the new ones claimed in one step, so the Customer never holds both or neither. Only the Customer can reschedule, and only before the trip starts.
_Avoid_: Rebook, move, change booking

**Reminder**:
An email sent to the Customer the day before a Confirmed Booking. A rescheduled Booking gets a fresh Reminder for its new time.
_Avoid_: Notification, alert

**Party Size**:
The number of people in the Customer's own group on a Booking. It is information only and never affects whether a Slot is available.
_Avoid_: Seats, capacity, headcount

## Relationships

- There is one **Provider**, who offers trips to one or more **Sites** on one **Schedule**.
- The **Schedule** is not divided by **Site**: a **Slot** has no Site until a **Booking** claims it.
- The **Schedule**'s **Slots** are the hours inside **Operating Hours**, on each day within the **Booking Window**. They are worked out from those settings, never stored one by one.
- A **Booking** belongs to exactly one **Customer**, is for exactly one **Site**, and holds as many consecutive **Slots** as that Site's **Trip Length**.
- A **Slot** is held by zero or one **Booking**. A **Cancelled** **Booking** holds no Slots, because cancelling releases them at once.
- A **Customer** has zero or more **Bookings**.

## Example dialogue

> **Dev:** "A Customer books a trip for a group of 6. Can another Customer join that trip if there's room?"
> **Domain expert:** "No. Every Booking is private. Once those Slots are held, they're gone for everyone else, whether the Party Size is 1 or 8."
> **Dev:** "So Party Size never changes what's available?"
> **Domain expert:** "Right. It just tells the Provider how many people are coming."

## Flagged ambiguities

- The brief says "appointment slots" and "bookings" interchangeably. Resolved: a **Slot** is the period of time, and a **Booking** is a Customer's claim on it. Don't use "appointment" in code or UI labels where the two could be confused.
- "Trip" was used for both the product being sold and a Customer's reservation. Resolved: the reservation is a **Booking**. "Trip" is used only in customer-facing wording such as "Book a trip."
- Changing a Booking's Site is not a Reschedule. To change Site, the Customer cancels and makes a new Booking.
- Travel time between Sites is deliberately ignored. A Booking at one Site may start the moment a Booking at another Site ends. This is a known simplification.
- Shared seat-based group tours were considered and rejected. Bookings are private so that a booked Slot is never shown as available to another Customer, as the brief requires.

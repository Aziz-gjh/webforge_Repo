# Team Plan — AlUla Site Tours (3 people)

Everyone reads these before writing code (10 minutes):
1. [CONTEXT.md](../CONTEXT.md): the shared words. Use them in code and the UI: **Site, Slot, Booking, Trip Length, Party Size, Reschedule, Reminder, Provider, Customer, Visitor**.
2. [docs/mvp-plan.md](mvp-plan.md): the full spec, including the data, the security rules, the screens and the demo script.
3. [docs/adr/](adr/): why bookings are protected by hour locks, why there is no API layer, and why reminders are sent by a daily scheduled job.

| Part | Owner | One line |
|---|---|---|
| **Part 1 — UI/UX & Front End** | _name_ | Everything the Customer and Visitor see and touch |
| **Part 2 — Data, Logic & Security** | _name_ | Firebase, the booking logic, and the rules that make it safe |
| **Part 3 — Platform, Email & Delivery** | _name_ | Deployment, domain, reminders, the Provider screen, search setup, and the demo and diagram |

---

## 0. Ground rules (everyone)

- **Build with Claude Code or Codex in VS Code.** Start every AI session with: *"Read CONTEXT.md, docs/mvp-plan.md and docs/team-plan.md. I own Part N."* Use only AI plans the competition allows (Rule 1).
- **Branches:** `part1-ui`, `part2-data`, `part3-platform`. Pull `main` often and merge into `main` small and often, at least once an hour. **`main` must always deploy.** Vercel gives every branch its own preview link.
- **Commits:** short and meaningful, for example `feat(book): start-time picker with live taken hours`. Judges read the commit history.
- **Stay in your own folders** (listed under each part). Changes to someone else's files go through that person.
- **Secrets never go in git:** no service account JSON, no Resend key, no `CRON_SECRET`. `.env.local` is in `.gitignore`.
- **Don't build anything for the change request before it's announced.** Only make sure the scheduling rules stay in one tested function.
- **If you're blocked for more than 10 minutes, say so out loud.**

---

## 1. Shared setup (first 15 minutes, all in parallel)

| Who | Does | Done when |
|---|---|---|
| **Part 1** | Sets up the project skeleton (below) and pushes it to `main` | The other two can `git pull` and run `npm run dev` |
| **Part 2** | Creates the Firebase project, turns on Google sign-in, creates Firestore in production mode, adds the web app, and shares its config privately with the team. Adds the other two as project members. Commits the **shared contract** (section 2) as stub files. | `src/types.ts`, `src/lib/*.ts` stubs and `.env.example` are on `main` |
| **Part 3** | Sets up Vercel (linked to the repo), Cloudflare DNS for the subdomain, Resend (adds the domain and puts its DNS records in Cloudflare), and Search Console (the TXT record). These all take time to go through, so start them now. | The first production deploy is live on the subdomain, even if it's empty |

**Project skeleton (Part 1).** Install every dependency at once, so `package.json` doesn't cause merge conflicts later:

```bash
npm create vite@latest . -- --template react-ts
npm i firebase react-router-dom
npm i -D tailwindcss @tailwindcss/vite vitest
npm i firebase-admin resend          # used by Part 3's api/ function
```

Create the folders `src/pages`, `src/components`, `src/lib`, `api` and `public`. Add `.env.local` to `.gitignore`. Add a `"test": "vitest"` script to `package.json`.

**Domain:** confirm now who controls the domain in Cloudflare and which subdomain you'll use. Part 3 needs that access in the first 15 minutes.

---

## 2. The shared contract (Part 2 commits it as stubs; everyone codes against it)

Part 1 and Part 3 can start straight away using simple placeholder versions of these functions. Part 2 replaces the stubs with real Firebase code, keeping the same names and inputs. **Changing a name or input requires telling the other two first.**

```ts
// src/types.ts
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';
export interface Site { id: string; name: string; tripLength: number; blurb: string; image: string }
export interface ScheduleSettings { openHour: number; closeHour: number; windowDays: number }
export interface Booking {
  id: string; customerId: string; customerName: string; customerEmail: string;
  siteId: string; siteName: string; tripLength: number;
  date: string;          // "2026-11-03" (Riyadh)
  startHour: number;     // 10
  startAt: Date;
  slotKeys: string[];    // ["2026-11-03T10", "2026-11-03T11"]
  partySize: number; status: BookingStatus;
  createdAt: Date; updatedAt: Date; reminderSentFor: string | null;
}
export interface TakenHour { hour: number; bookingId: string }
export type BookingErrorCode = 'slot-taken' | 'too-late' | 'invalid' | 'permission-denied' | 'network';
export class BookingError extends Error { constructor(public code: BookingErrorCode, message: string) { super(message) } }

// src/lib/schedule.ts  (pure functions, no Firebase, unit-tested)
export function riyadhToday(now?: Date): string;
export function windowDates(settings: ScheduleSettings, now?: Date): string[];        // 7 "YYYY-MM-DD" dates
export function slotKey(date: string, hour: number): string;                          // "2026-11-03T10"
export function riyadhStartAt(date: string, hour: number): Date;
export function getOpenStartTimes(args: {
  date: string; tripLength: number; settings: ScheduleSettings;
  taken: TakenHour[]; now: Date; ignoreBookingId?: string;                            // ignoreBookingId: a reschedule treats its own hours as free
}): number[];

// src/lib/auth.ts
export function signInWithGoogle(): Promise<void>;
export function signOutUser(): Promise<void>;
export function useAuth(): { user: { uid: string; name: string; email: string } | null; loading: boolean };
export function useIsProvider(): { isProvider: boolean; loading: boolean };

// src/lib/bookings.ts  (throws BookingError)
export function getSites(): Promise<Site[]>;
export function getScheduleSettings(): Promise<ScheduleSettings>;
export function watchTakenHours(date: string, cb: (taken: TakenHour[]) => void): () => void;
export function createBooking(input: { site: Site; date: string; startHour: number; partySize: number }): Promise<Booking>;
export function rescheduleBooking(bookingId: string, to: { date: string; startHour: number }): Promise<Booking>;
export function cancelBooking(bookingId: string): Promise<void>;
export function watchMyBookings(uid: string, cb: (b: Booking[]) => void): () => void;      // upcoming, ordered by startAt
export function watchBookingsForDate(date: string, cb: (b: Booking[]) => void): () => void; // Provider only
export function markCompleted(bookingId: string): Promise<void>;                           // Provider only
```

**Placeholder data for Part 1 and Part 3:** until Part 2 merges, call the stubs, which return hard-coded Sites (Elephant Rock 1 h, AlUla Old Town 1 h, Hegra 2 h, Harrat Viewpoint 2 h) and a couple of fake Bookings.

---

## 3. Part 1 — UI/UX & Front End

**You own:** `src/pages/` (everything except `src/pages/provider/`), `src/components/`, `src/index.css`, `src/App.tsx` (routes), and the design in Variant.

**Your goal:** a Visitor can browse; a Customer can sign in, book, see My trips, reschedule and cancel. It works on a phone and a laptop, and looks like one coherent product.

### Tasks, in order
1. **Design (Variant), about 20 minutes.** Key screens: Home/Sites, Book, My trips, Reschedule, Provider schedule (to share with Part 3), and the Sign-in prompt. Show the loading, empty, success and error states.
   - **Look:** dark night-sky background, a sand-gold accent, one teal for statuses only, monospace "terminal" labels (for example `SITE // HEGRA · 2H`), clean sans-serif body text. Keep decoration restrained, and **don't make it all pink**. Use small, purposeful motion such as fade-ins and slot appear/disappear, and respect `prefers-reduced-motion`.
2. **Theme:** Tailwind colours and fonts as CSS variables, plus shared components: `Button`, `Card`, `StatusBadge` (confirmed / cancelled / completed), `Spinner`, `EmptyState`, `ErrorBanner`, `Toast`, `ConfirmDialog`.
3. **Routes in `App.tsx`:** `/` Home, `/book` and `/book/:siteId` (public), `/trips` (requires sign-in), `/trips/:bookingId/reschedule`, `/signin`, and `/provider`. Part 3 builds the `/provider` page and you add its route.
4. **Home / Sites (`/`):** hero, Site cards (name, Trip Length, blurb, image) and "Book a trip". This is the page search engines index, so give it real text and a single `<h1>`.
5. **Book flow:**
   - Pick a Site, then a date (7 chips from `windowDates`), then a start time (from `getOpenStartTimes`, updating live through `watchTakenHours`), then Party Size (1–8 stepper), then Confirm.
   - When a signed-out Visitor taps Confirm, remember the selection, run `signInWithGoogle()`, and come back to the same selection.
   - **Success:** a confirmation page saying "We'll email you a reminder the day before." **`slot-taken` error:** "That time was just taken — pick another", and refresh the times.
6. **My trips (`/trips`):** `watchMyBookings`. Each card shows Site, date and time (Riyadh time, for example "Tue 3 Nov · 10:00–12:00"), Party Size, a `StatusBadge`, and **Reschedule** and **Cancel** buttons (only for Confirmed trips that haven't started). Cancel asks for confirmation first. Empty state: "No upcoming trips — Book one."
7. **Reschedule (`/trips/:id/reschedule`):** the same picker as Book, with the Site and Party Size locked. Pass `ignoreBookingId` so the current time shows as free, and mark the current time. Confirm calls `rescheduleBooking`.
8. **Header:** logo, "Book", "My trips", "Provider" (only if `useIsProvider()` is true; hiding it is cosmetic, because the rules do the real protection), and a sign-in or avatar button.
9. **Accessibility and validation:**
   - real `<button>`/`<label>` elements, visible focus rings, colour contrast of at least 4.5:1;
   - time slots use `aria-pressed`, and results are announced with `aria-live` (for example "Booked");
   - Party Size can't go below 1 or above 8, and buttons are disabled while a request is in progress, so a double tap can't double-submit.
10. **Phone and desktop:** check at 375 px and 1280 px. Nothing should scroll sideways, and the time grid wraps.

### Done when
- [ ] A Visitor sees Sites and open times without signing in.
- [ ] Booking works end to end on the production URL, and the slot disappears in a second browser.
- [ ] Reschedule and Cancel work from My trips.
- [ ] Every data screen has loading, empty, success and error states.
- [ ] Usable at 375 px and 1280 px.

### Starting prompt for Claude Code
> I own Part 1 (UI/UX). Using the contract in docs/team-plan.md section 2 and the screens in docs/mvp-plan.md, build the theme and shared components first, then the Home page, then the Book flow against the placeholder functions in src/lib. Use the glossary terms from CONTEXT.md in the UI text.

---

## 4. Part 2 — Data, Logic & Security

**You own:** `src/types.ts`, `src/lib/` (`schedule.ts`, `auth.ts`, `bookings.ts`, `firebase.ts`), `src/lib/*.test.ts`, `firestore.rules`, `firestore.indexes.json`, `firebase.json`, and the starting data.

**Your goal:** the data is correct and safe. No double bookings, no access to someone else's Bookings, data kept across refreshes and sign-ins, and every scheduling rule in one tested function. **You lead the change request.**

### Tasks, in order
1. **Firebase project (first 15 minutes):**
   - turn on Google sign-in;
   - add `localhost`, the `*.vercel.app` domain and the custom domain under Auth → Settings → **Authorized domains**;
   - create Firestore in **production mode** in a nearby region, such as `me-central2` or `europe-west`;
   - share the web config, which becomes `VITE_FIREBASE_*` in `.env.local` and in Vercel (Part 3 sets it there).
2. **Commit the shared contract stubs** (section 2) together with `.env.example`.
3. **Starting data (Firebase console):**
   - `sites/elephant-rock` (1), `sites/old-town` (1), `sites/hegra` (2), `sites/harrat-viewpoint` (2). Each has `name`, `tripLength`, `blurb` and `image`.
   - `settings/schedule` = `{ openHour: 6, closeHour: 19, windowDays: 7 }`.
4. **`schedule.ts` plus Vitest tests.** All times use **Asia/Riyadh (UTC+3)**, whatever the browser is set to. At least these tests:
   - an empty day returns every start time that fits (06–18 for 1 h, 06–17 for 2 h);
   - **conflict:** 10:00 taken means a 2 h trip can't start at 09:00 or 10:00;
   - **non-conflict:** 10:00 taken still allows a 2 h trip at 11:00 and 08:00;
   - start times that have already passed today are excluded;
   - with `ignoreBookingId`, the Booking's own hours count as free.
5. **`auth.ts`:** `signInWithPopup(GoogleAuthProvider)`; on first sign-in, create `users/{uid}`. `useIsProvider` reads whether `providers/{uid}` exists. Use a popup rather than a redirect, because redirect sign-in breaks in browsers that block third-party storage.
6. **`bookings.ts`:**
   - `createBooking` and `rescheduleBooking` use `runTransaction`, reading the locks first and then writing.
   - `cancelBooking` uses a `writeBatch`.
   - Turn Firestore errors into `BookingError` codes.
   - A taken lock found by a transaction, or a rules rejection of a lock write, both become **`slot-taken`**.
7. **`firestore.rules`:** follow **"Security rules"** in mvp-plan.md exactly. Use `isCustomer()` (verified Google account) and `isProvider()`. Locks can be **created but never updated**. Deploy with `npx firebase-tools deploy --only firestore:rules,firestore:indexes`, or paste the rules into the console.
8. **Indexes:** `bookings` sorted by (`customerId`, `startAt`) and by (`date`, `startHour`). If a query fails, the error message in the console links straight to creating the index it needs.
9. **Try to break it (keep this as evidence for the judges).** Signed in as Customer 2, run these from the browser console and confirm each one gets **permission-denied**:
   - read Customer 1's booking by its ID;
   - update its `status`;
   - overwrite an existing `slotLocks` record;
   - create a booking with `partySize: 20`.
   Record the results in `docs/evidence/access-tests.md`.
10. **Make yourself the Provider:** after Part 3's Provider account signs in once, create `providers/{thatUid}` in the console.

### Done when
- [ ] `npm test` passes, with both a conflict and a non-conflict case.
- [ ] Two browsers racing for the same hour: one succeeds, the other gets `slot-taken`.
- [ ] A reschedule from 10:00 to 11:00 keeps the 11:00 lock and frees 10:00.
- [ ] Every attempt in the break-it tests is refused, and the results are written up.
- [ ] Data is still there after a refresh, and after signing out and back in, on the production URL.

### Starting prompt for Claude Code
> I own Part 2 (data, logic, security). Implement the contract in docs/team-plan.md section 2 exactly. Start with src/lib/schedule.ts and its Vitest tests, then auth.ts, then bookings.ts with transactions as described in docs/mvp-plan.md and ADR 0001, then firestore.rules following the "Security rules" section. Times are Asia/Riyadh.

---

## 5. Part 3 — Platform, Email & Delivery

**You own:** `vercel.json`, `api/`, `public/robots.txt`, `public/sitemap.xml`, the meta tags in `index.html`, `src/pages/provider/`, the Excalidraw diagram (`docs/system-diagram.excalidraw` plus an exported PNG), `docs/evidence/`, the README, and the demo.

**Your goal:** the app is live on the custom domain, Reminders arrive by email, the Provider can manage the Schedule, search and PageSpeed are set up and recorded, and the team can explain and demonstrate everything.

### Tasks, in order
1. **Start everything that takes time to go through (first 15 minutes):**
   - **Vercel:** import the GitHub repo, framework preset Vite.
   - **Cloudflare:** a `CNAME` record pointing `<sub>` to `cname.vercel-dns.com`, set to **DNS only (grey cloud)**. Then add the domain in Vercel.
   - **Resend:** add the domain, copy its SPF/DKIM records into Cloudflare (DNS only), and wait for "Verified".
   - **Search Console:** a Domain property, verified with a TXT record in Cloudflare.
2. **`vercel.json`:**
   ```json
   {
     "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
     "crons": [{ "path": "/api/send-reminders", "schedule": "0 15 * * *" }]
   }
   ```
3. **Vercel environment variables:** `VITE_FIREBASE_*` (from Part 2), `FIREBASE_SERVICE_ACCOUNT` (the service account JSON from Firebase → Project settings → Service accounts), `RESEND_API_KEY`, `CRON_SECRET` (a long random string), and `APP_URL`.
4. **Excalidraw system diagram (in the first hour, then update it):**
   - **boxes:** Browser (React app), Firebase Auth (Google), Firestore (`sites`, `settings`, `bookings`, `slotLocks`, `users`, `providers`), Security Rules, Vercel (static site + `api/send-reminders`), Vercel Cron, Resend, Cloudflare DNS;
   - **arrows:** book (transaction), reschedule, cancel, live updates (`onSnapshot`), the daily reminder;
   - **side panel:** who can read and write what (Visitor / Customer / Provider).
5. **Provider schedule (`src/pages/provider/`):**
   - Signing in as the Provider opens `/provider`; anyone else sees "Not authorised". The rules enforce this too.
   - A date picker (default today) plus **filters** by Site and status, using `watchBookingsForDate`.
   - Each row shows the time range, Site, customer name and email, Party Size and a `StatusBadge`. **Clicking a row shows full details:** created and updated times, and whether a Reminder has been sent.
   - Actions: **Cancel** (with confirmation) and **Mark completed**.
   - Empty state: "No bookings on this day."
   - Use Part 1's components so it matches the rest of the app.
6. **`api/send-reminders.ts`:** follow ADR 0003.
   - Check `Authorization: Bearer ${CRON_SECRET}`.
   - Use `firebase-admin` to find bookings for tomorrow (Riyadh time) with `status == confirmed` and `reminderSentFor != slotKeys[0]`.
   - Send each one an email through Resend from `reminders@<domain>`: Site, date and time, Party Size, and a link to `${APP_URL}/trips`.
   - Set `reminderSentFor`, and return `{ sent, skipped }`.
   - **Fallback** if Resend isn't verified: send through Gmail with an app password using nodemailer.
7. **Search and speed:**
   - `index.html`: a page title ("AlUla Site Tours — Book private trips to Hegra, Elephant Rock & more"), a meta description, Open Graph tags and `lang="en"`.
   - `public/robots.txt`, which allows everything and points to the sitemap; `public/sitemap.xml`, which lists `/` and `/book`.
   - Submit the sitemap in Search Console, then **import the site into Bing Webmaster Tools** from Search Console.
   - Run **PageSpeed Insights** on the production URL, mobile and desktop, and save screenshots in `docs/evidence/`. If the score is low, compress images to WebP with a fixed width and height, and load the hero image with `fetchpriority="high"`.
8. **README** (judges read it). Include:
   - the live URL;
   - the stack;
   - how it works, with the diagram image;
   - how double booking is prevented;
   - who can see what;
   - key trade-offs (from the ADRs);
   - **known limitations** (no travel time between Sites; no reminder for a trip booked for tomorrow after 18:00; consecutive hours checked in the browser only; no Provider screen for editing hours);
   - what changed for the change request;
   - how to run it locally.
9. **Demo:** create the three Google accounts (one Provider, two Customers) and some Bookings, including one for tomorrow. Rehearse the demo script from mvp-plan.md, and run the `curl` reminder trigger at least once before the demo.

### Done when
- [ ] The custom domain loads over HTTPS, and Google sign-in works on it.
- [ ] A reminder `curl` returns `{ sent: ≥1 }`, and the email arrives.
- [ ] The Provider screen shows every Customer's Bookings with filters, and non-Providers are refused.
- [ ] Search Console and Bing are verified, the sitemap is submitted, and the PageSpeed screenshots are saved.
- [ ] The diagram and README are committed.

### Starting prompt for Claude Code
> I own Part 3 (platform, email, delivery, provider view). Read docs/mvp-plan.md and ADR 0003. First create vercel.json, robots.txt, sitemap.xml and the index.html meta tags. Then build api/send-reminders.ts with firebase-admin and resend. Then build the Provider schedule page in src/pages/provider using the contract in docs/team-plan.md section 2 and Part 1's components.

---

## 6. Timeline and joint checkpoints

| Time (from when the challenge is released) | Part 1 | Part 2 | Part 3 | Checkpoint |
|---|---|---|---|---|
| 0:00–0:15 | Project skeleton | Firebase + contract stubs | Vercel, DNS, Resend, Search Console | **M0:** `main` runs, first deploy is live |
| 0:15–0:45 | Variant designs, theme, Home | `schedule.ts` + tests, auth | Diagram v1, `vercel.json`, SEO files | |
| 0:45–1:30 | Book flow, Sign-in | `bookings.ts`, rules, starting data | Provider page | **M1 (1:30):** a booking works on the **production URL** from start to finish, and the slot disappears in a second browser |
| 1:30–2:15 | My trips, Reschedule, Cancel | Reschedule/cancel logic, break-it tests | Reminder function, env vars | **M2 (2:15):** everything in the MVP is on production |
| Change request is announced | See section 7 | | | Hold back **at least 45 minutes** |
| Last 30 min | Polish for phone, accessibility pass | Final rules check | PageSpeed, Bing, README, rehearse the demo | **Code freeze 15 minutes before the deadline** |

At every checkpoint, take a 3-minute standup: what's merged, what's blocked, and what gets cut if the team is behind. **Cut order if you're behind:** filters, then motion, then the reminder email (fall back to just explaining it), then reschedule. **Never cut:** browse, sign in, book, My trips, the Provider schedule, or keeping data across refreshes.

---

## 7. Change request playbook (when it's announced)

1. **Everyone stops and meets for 10 minutes.** Read the change out loud, then write down its impact on:
   - **screens** (Part 1);
   - **data, logic and security rules** (Part 2);
   - **existing production data, the diagram and the demo** (Part 3).
2. **Agree on the smallest version that can be tested** before writing any code.
3. **Part 2:** change `schedule.ts` and/or the rules first, and add tests for **a conflict case and a non-conflict case**, run against Bookings that already exist.
4. **Part 1:** update the screens and messages. **Part 3:** update the diagram, the README section "What changed", and the demo step.
5. Deploy, then test on production with the existing Bookings.
6. **Everyone** must be able to explain what changed, what you prioritised, and what you'd improve with more time.

---

## 8. Before you submit (everyone, the last 20 minutes)

- [ ] Open the production URL in a **fresh incognito window**. Browse, then sign in with Google, book, reschedule, cancel, refresh, sign out, sign in again, and check everything is still there.
- [ ] Check the layout at **375 px and 1280 px**.
- [ ] Check sign-in and saved data work on the **production domain**, not only on localhost.
- [ ] GitHub `main` is the version that's deployed. Every branch is merged.
- [ ] `npm test` passes, and the output is saved in `docs/evidence/`.
- [ ] **Each person explains the system to the other two in 3 minutes**: the diagram, double-booking protection, and who can see what. The brief requires that every team member understands it.

---

## 9. Requirements coverage (checked against the PDF and the competition site)

✅ = planned; the owner delivers it. Nothing in the brief is left without an owner.

### Brief, page 1 — Mission and design
| Requirement | How we meet it | Owner |
|---|---|---|
| Responsive web app | Tailwind layouts tested at 375 px and 1280 px | P1 |
| Customers find open Slots, book, and review upcoming Bookings | Book flow + My trips | P1 + P2 |
| Provider views and manages the whole Schedule | `/provider` page | P3 + P2 |
| "Connected product, not static screens" | Live updates through `onSnapshot`; Firebase data | P2 + P1 |
| Understand → Build → Ship → Explain | This plan, the MVP checkpoints, production deploy, README/diagram/demo | All |
| Design: dark, technical, editorial; terminal-style labels; crisp type; restrained accents; purposeful motion; not all pink | Night-sky theme, monospace labels, sand-gold + teal, small transitions | P1 |

### Brief, page 2 — Product requirements
| Requirement | How we meet it | Owner |
|---|---|---|
| Customer 1: Browse open Slots | Public Book page, no sign-in needed | P1 |
| Customer 2: Sign in or create an account | Google sign-in; the account is created on first sign-in | P2 + P1 |
| Customer 3: Book an open Slot | `createBooking` transaction | P2 + P1 |
| Customer 4: See upcoming Bookings | My trips | P1 + P2 |
| Customer 5: Cancel or reschedule | **In the MVP:** `cancelBooking`, `rescheduleBooking` | P2 + P1 |
| Provider 1: Sign in to the Provider view | `providers/{uid}` + `useIsProvider` + rules | P2 + P3 |
| Provider 2: See the Schedule across all Customers | `watchBookingsForDate` | P3 + P2 |
| Provider 3: Review Booking details and status | Clicking a row shows details; `StatusBadge` | P3 |
| Provider 4: Manage Bookings clearly and consistently | Cancel and Mark completed, with confirmation dialogs | P3 + P2 |
| **Required:** Bookings tied to the signed-in Customer | Rules: `customerId == auth.uid` | P2 |
| **Required:** a booked Slot is never shown as available to others | Hour locks (create-only) + live updates | P2 |
| **Required:** each Customer sees their own Bookings | Rules + `watchMyBookings` | P2 + P1 |
| **Required:** the Provider sees Bookings across Customers | `/provider` | P3 |
| **Required:** data survives a refresh and a new session | Firestore + Firebase Auth keeps users signed in | P2 |
| **Required:** usable on phone and desktop | Checked at 375 and 1280 px | P1 |
| Stretch: cancel or reschedule | In the MVP | P2 + P1 |
| Stretch: status labels, empty states, filters, confirmation feedback | `StatusBadge`, `EmptyState`, Provider filters, confirmation page and toasts | P1 + P3 |
| Stretch: accessibility, validation, loading and error states | Section 3, task 9; four states on every screen; rules validate the data | P1 + P2 |
| **Extra (ours):** email Reminder | Daily cron function + Resend | P3 |

### Brief, page 3 — Technical expectations
| Requirement | How we meet it | Owner |
|---|---|---|
| 01 Excalidraw system map | `docs/system-diagram.excalidraw` | P3 |
| 02 Variant UI/UX | Key screens and states | P1 |
| 03 VS Code + Codex/Claude Code | Everyone; starting prompts above | All |
| 04 Firebase for auth and saved data | Google Auth + Firestore | P2 |
| 05 GitHub with meaningful commits | Branch per part, small descriptive commits | All |
| 06 Deploy on Vercel | Production + branch previews | P3 |
| 07 Domain through Cloudflare | CNAME, DNS only | P3 |
| 08 Search Console, Bing, PageSpeed | Verified, sitemap submitted, screenshots saved | P3 |
| Checklist: data and how it connects | CONTEXT.md + diagram + the data section of mvp-plan.md | P2 + P3 |
| Checklist: stopping double booking | ADR 0001 (hour locks in a transaction, create-only rules) | P2 |
| Checklist: what Customers and the Provider can see and do | The access table in mvp-plan.md + the rules | P2 |
| Checklist: screens and states (loading, empty, success, error) | Variant + components | P1 |
| Checklist: agree the minimum version before stretch work | Checkpoint M1 comes before M2 | All |
| Security checked on the server, not by hiding buttons | Firestore rules + break-it tests in `docs/evidence/` | P2 |
| Deliverables: working URL, repo, diagram, demo, explanation of trade-offs and limitations | Production URL, GitHub, diagram, demo script, README | P3 (all contribute) |

### Brief, page 4 — Change request
| Requirement | How we meet it | Owner |
|---|---|---|
| Work out what it affects: screens, data, logic, permissions | Section 7, step 1 | All |
| Smallest version that can be tested | Section 7, step 2 | All |
| Test against existing data with a conflict and a non-conflict case | Vitest cases + checks on production | P2 |
| Explain what changed, what was prioritised, what you'd improve | README "What changed" + demo | P3 (all) |

### Brief, pages 5–6 — Judging, demo and submission
| Requirement | How we meet it | Owner |
|---|---|---|
| Show the main flow live | Demo script, steps 1–6 | P3 |
| Show a booked Slot is no longer available | Two-browser step | P3 |
| Show the Customer view and the Provider schedule | Demo steps 4–6 | P3 |
| Explain the diagram and the data and access decisions | Diagram + rules walkthrough | All |
| Show the change request working, with at least one test case | Demo step 9 + `npm test` | P2 + P3 |
| Before submitting: fresh browser, layout widths, auth and data on production, GitHub up to date, everyone understands | Section 8 | All |

### Competition site (rules and FAQ)
| Requirement | How we meet it | Owner |
|---|---|---|
| Custom domain or subdomain | Cloudflare → Vercel | P3 |
| Evidence the team tested and measured the result | `docs/evidence/`: test output, break-it tests, PageSpeed screenshots | P2 + P3 |
| App public and working during judging | Production on Vercel; nothing deployed after the freeze | P3 |
| Allowed AI tiers only; no outside human help; nothing shared with other teams | Ground rules | All |
| The version at the deadline is the one judged | Code freeze 15 minutes before | All |

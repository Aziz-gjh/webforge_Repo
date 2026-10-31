// Dev-only page (dev-part2.html) for exercising src/lib without Part 1's UI. Not in the production build.
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { signInWithGoogle, signOutUser } from '../lib/auth';
import { cancelBooking, createBooking, getScheduleSettings, getSites, rescheduleBooking, watchMyBookings, watchTakenHours } from '../lib/bookings';
import { getOpenStartTimes, riyadhStartAt, windowDates } from '../lib/schedule';
import type { Booking, BookingError, TakenHour } from '../types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log = (msg: unknown) => { $('log').textContent = `${new Date().toLocaleTimeString()}  ${typeof msg === 'string' ? msg : JSON.stringify(msg)}\n` + $('log').textContent };
const run = (fn: () => Promise<unknown>) => fn().then(r => log(r ?? 'ok'), e => log(`ERROR ${e.code ?? ''}: ${e.message}`));

const [sites, settings] = await Promise.all([getSites(), getScheduleSettings()]);
let taken: TakenHour[] = [];
let hour: number | null = null;
let unwatchTaken = () => {};
let unwatchMine = () => {};

$<HTMLSelectElement>('site').innerHTML = sites.map(s => `<option value="${s.id}">${s.name} (${s.tripLength} h)</option>`).join('');
$<HTMLSelectElement>('date').innerHTML = windowDates(settings).map(d => `<option>${d}</option>`).join('');
const site = () => sites.find(s => s.id === $<HTMLSelectElement>('site').value)!;
const date = () => $<HTMLSelectElement>('date').value;

function renderTimes() {
  $('taken').textContent = taken.map(t => `${t.hour}:00`).sort().join(', ') || 'none';
  const open = getOpenStartTimes({ date: date(), tripLength: site().tripLength, settings, taken, now: new Date() });
  if (hour !== null && !open.includes(hour)) hour = null;
  $('times').innerHTML = open.map(h => `<button data-h="${h}" aria-pressed="${h === hour}">${h}:00</button>`).join('') || 'No open start times';
}
function watchDate() { unwatchTaken(); unwatchTaken = watchTakenHours(date(), t => { taken = t; renderTimes() }) }

$('times').onclick = e => { const h = (e.target as HTMLElement).dataset.h; if (h) { hour = +h; renderTimes() } };
$('site').onchange = renderTimes;
$('date').onchange = () => { hour = null; watchDate() };
$('signin').onclick = () => run(signInWithGoogle);
$('signout').onclick = () => run(signOutUser);
$('book').onclick = () => hour === null ? log('pick a time') :
  run(() => createBooking({ site: site(), date: date(), startHour: hour!, partySize: +$<HTMLInputElement>('party').value }));

$('mine').onclick = e => {
  const { act, id } = (e.target as HTMLElement).dataset;
  if (act === 'cancel') run(() => cancelBooking(id!));
  if (act === 'move' && hour === null) log('pick a new time above first');
  else if (act === 'move') run(() => rescheduleBooking(id!, { date: date(), startHour: hour! }));
};

// --- Automated evidence for docs/evidence/access-tests.md ---------------------------------
const outcome = (p: Promise<unknown>) => p.then(() => 'ALLOWED ❌', e => `refused ✅ (${e.code})`);
async function report(title: string, rows: [string, string][]) {
  const md = `### ${title} — ${new Date().toISOString()} — ${auth.currentUser?.email}\n\n| Test | Result |\n|---|---|\n`
    + rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n');
  log(md);
  try { await navigator.clipboard.writeText(md); log('(results copied to clipboard)') } catch { /* copy from the log */ }
}

// Two transactions race for the same free hour, then a client that skips the transaction tries to overwrite the lock.
$('race').onclick = () => run(async () => {
  const s = site(), d = date();
  const h = getOpenStartTimes({ date: d, tripLength: s.tripLength, settings, taken, now: new Date() })[0];
  if (h === undefined) throw new Error('no open hour on this date');
  const results = await Promise.allSettled([1, 2].map(() => createBooking({ site: s, date: d, startHour: h, partySize: 1 })));
  const winner = results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<Booking> | undefined;
  const rows: [string, string][] = results.map((r, i) =>
    [`Racer ${i + 1}: ${s.name} ${d} ${h}:00`, r.status === 'fulfilled' ? `booked ${r.value.id}` : `refused (${(r.reason as BookingError).code})`]);

  if (winner) {
    const fake = doc(collection(db, 'bookings'));
    const fields: Partial<Booking> = { ...winner.value };
    delete fields.id;
    const batch = writeBatch(db);
    batch.set(fake, { ...fields, startAt: Timestamp.fromDate(winner.value.startAt), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    batch.set(doc(db, 'slotLocks', winner.value.slotKeys[0]), { bookingId: fake.id, date: d, hour: h });
    rows.push(['No-transaction client overwrites the taken lock', await outcome(batch.commit())]);
    await cancelBooking(winner.value.id);
    rows.push(['Cleanup: winner cancelled, hours released', 'done']);
  }
  await report('Race test', rows);
});

// Signed in as Customer 2: attack a Booking that belongs to someone else, found through the public locks.
$('breakit').onclick = () => run(async () => {
  const me = auth.currentUser!;
  const mineIds = new Set((await getDocs(query(collection(db, 'bookings'), where('customerId', '==', me.uid)))).docs.map(d => d.id));
  const locks = await getDocs(query(collection(db, 'slotLocks'), where('date', 'in', windowDates(settings))));
  const target = locks.docs.find(l => !mineIds.has(l.data().bookingId));
  if (!target) throw new Error('no other account has a booking in the window — book one with the other account first');
  const victim = target.data().bookingId as string;

  const d = windowDates(settings)[1];
  const freeHour = getOpenStartTimes({ date: d, tripLength: 1, settings, now: new Date(),
    taken: locks.docs.filter(l => l.data().date === d).map(l => ({ hour: l.data().hour, bookingId: l.data().bookingId })) })[0];
  const key = `${d}T${String(freeHour).padStart(2, '0')}`;
  const big = doc(collection(db, 'bookings'));
  const bigBatch = writeBatch(db);
  bigBatch.set(big, { customerId: me.uid, customerName: me.displayName ?? '', customerEmail: me.email, siteId: 'elephant-rock',
    siteName: 'Elephant Rock', tripLength: 1, date: d, startHour: freeHour, startAt: Timestamp.fromDate(riyadhStartAt(d, freeHour)),
    slotKeys: [key], partySize: 20, status: 'confirmed', reminderSentFor: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  bigBatch.set(doc(db, 'slotLocks', key), { bookingId: big.id, date: d, hour: freeHour });

  await report(`Break-it tests against booking ${victim}`, [
    ['1 Read another Customer\'s Booking by ID', await outcome(getDoc(doc(db, 'bookings', victim)))],
    ['2 Change its status to cancelled', await outcome(updateDoc(doc(db, 'bookings', victim), { status: 'cancelled' }))],
    ['3 Overwrite its slotLocks record', await outcome(setDoc(target.ref, { bookingId: 'hijack', date: target.data().date, hour: target.data().hour }))],
    ['4 Create a Booking with partySize 20', await outcome(bigBatch.commit())],
    ['5 List all Bookings without a customerId filter', await outcome(getDocs(collection(db, 'bookings')))],
    ['6 Delete its slot lock', await outcome(deleteDoc(target.ref))],
    ['7 Make myself the Provider', await outcome(setDoc(doc(db, 'providers', me.uid), {}))],
  ]);
});

onAuthStateChanged(auth, async u => {
  unwatchMine();
  if (!u) { $('who').textContent = 'Signed out (Visitor)'; $('mine').textContent = ''; return; }
  const provider = (await getDoc(doc(db, 'providers', u.uid))).exists();
  $('who').textContent = `${u.displayName} <${u.email}> uid=${u.uid}${provider ? ' [PROVIDER]' : ''}`;
  unwatchMine = watchMyBookings(u.uid, (bs: Booking[]) => {
    $('mine').innerHTML = bs.map(b => `<div>${b.id.slice(0, 6)} · ${b.siteName} · ${b.date} ${b.startHour}:00 (${b.slotKeys.join(', ')}) · party ${b.partySize} · <b>${b.status}</b>
      ${b.status === 'confirmed' ? `<button data-act="move" data-id="${b.id}">Reschedule to selected</button><button data-act="cancel" data-id="${b.id}">Cancel</button>` : ''}</div>`).join('') || 'No upcoming trips';
  });
});

watchDate();

// Dev-only page (dev-part2.html) for exercising src/lib without Part 1's UI. Not in the production build.
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { signInWithGoogle, signOutUser } from '../lib/auth';
import { cancelBooking, createBooking, getScheduleSettings, getSites, rescheduleBooking, watchMyBookings, watchTakenHours } from '../lib/bookings';
import { getOpenStartTimes, windowDates } from '../lib/schedule';
import type { Booking, TakenHour } from '../types';

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

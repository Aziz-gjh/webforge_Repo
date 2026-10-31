// Booking reads and writes. Every change goes straight to Firestore; firestore.rules is the
// access control (ADR 0002). Hour locks in slotLocks stop double booking (ADR 0001).
import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where, writeBatch, type DocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { getOpenStartTimes, riyadhStartAt, riyadhToday, slotKeysFor } from './schedule';
import { BookingError, type Booking, type ScheduleSettings, type Site, type TakenHour } from '../types';

const TAKEN_MESSAGE = 'That time was just taken — pick another';

const lockRef = (key: string) => doc(db, 'slotLocks', key);

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : new Date());

function toBooking(snap: DocumentSnapshot): Booking {
  const d = snap.data({ serverTimestamps: 'estimate' })!;
  return {
    id: snap.id, customerId: d.customerId, customerName: d.customerName, customerEmail: d.customerEmail,
    siteId: d.siteId, siteName: d.siteName, tripLength: d.tripLength,
    date: d.date, startHour: d.startHour, startAt: toDate(d.startAt), slotKeys: d.slotKeys,
    partySize: d.partySize, status: d.status,
    createdAt: toDate(d.createdAt), updatedAt: toDate(d.updatedAt), reminderSentFor: d.reminderSentFor ?? null,
  };
}

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new BookingError('permission-denied', 'Please sign in first.');
  return user;
}

function toBookingError(e: unknown): BookingError {
  if (e instanceof BookingError) return e;
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') return new BookingError('permission-denied', 'You are not allowed to do that.');
  if (code === 'aborted') return new BookingError('slot-taken', TAKEN_MESSAGE);
  if (code === 'invalid-argument' || code === 'failed-precondition' || code === 'not-found')
    return new BookingError('invalid', 'That booking request is not valid.');
  return new BookingError('network', 'Could not reach the server. Check your connection and try again.');
}

// A rules rejection of a lock write looks like permission-denied; if another booking now
// holds one of the hours, it was really a race we lost.
async function explainFailure(e: unknown, keys: string[], bookingId: string): Promise<BookingError> {
  const err = toBookingError(e);
  if (err.code !== 'permission-denied') return err;
  try {
    const locks = await Promise.all(keys.map(k => getDoc(lockRef(k))));
    if (locks.some(l => l.exists() && l.data().bookingId !== bookingId))
      return new BookingError('slot-taken', TAKEN_MESSAGE);
  } catch { /* fall through */ }
  return err;
}

function checkStartTime(date: string, startHour: number, tripLength: number, settings: ScheduleSettings) {
  const now = new Date();
  if (riyadhStartAt(date, startHour) <= now) throw new BookingError('too-late', 'That start time has already passed.');
  if (!getOpenStartTimes({ date, tripLength, settings, taken: [], now }).includes(startHour))
    throw new BookingError('invalid', 'That start time is outside Operating Hours or the Booking Window.');
}

export async function getSites(): Promise<Site[]> {
  try {
    const snap = await getDocs(collection(db, 'sites'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as Site)
      .sort((a, b) => a.tripLength - b.tripLength || a.name.localeCompare(b.name));
  } catch (e) { throw toBookingError(e) }
}

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'schedule'));
    if (!snap.exists()) throw new BookingError('invalid', 'Schedule settings are missing.');
    return snap.data() as ScheduleSettings;
  } catch (e) { throw toBookingError(e) }
}

export function watchTakenHours(date: string, cb: (taken: TakenHour[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'slotLocks'), where('date', '==', date)),
    snap => cb(snap.docs.map(d => ({ hour: d.data().hour, bookingId: d.data().bookingId }))),
    err => console.error('watchTakenHours', err),
  );
}

export async function createBooking(input: { site: Site; date: string; startHour: number; partySize: number }): Promise<Booking> {
  const { site, date, startHour, partySize } = input;
  const user = requireUser();
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8)
    throw new BookingError('invalid', 'Party Size must be between 1 and 8.');
  checkStartTime(date, startHour, site.tripLength, await getScheduleSettings());

  const bookingRef = doc(collection(db, 'bookings'));
  const slotKeys = slotKeysFor(date, startHour, site.tripLength);
  const startAt = riyadhStartAt(date, startHour);
  const booking = {
    customerId: user.uid, customerName: user.displayName ?? user.email ?? '', customerEmail: user.email ?? '',
    siteId: site.id, siteName: site.name, tripLength: site.tripLength,
    date, startHour, slotKeys, partySize, status: 'confirmed' as const, reminderSentFor: null,
  };

  try {
    await runTransaction(db, async tx => {
      const locks = await Promise.all(slotKeys.map(k => tx.get(lockRef(k))));
      if (locks.some(l => l.exists())) throw new BookingError('slot-taken', TAKEN_MESSAGE);
      tx.set(bookingRef, {
        ...booking, startAt: Timestamp.fromDate(startAt), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      slotKeys.forEach((k, i) => tx.set(lockRef(k), { bookingId: bookingRef.id, date, hour: startHour + i }));
    });
  } catch (e) { throw await explainFailure(e, slotKeys, bookingRef.id) }

  const now = new Date();
  return { id: bookingRef.id, ...booking, startAt, createdAt: now, updatedAt: now };
}

export async function rescheduleBooking(bookingId: string, to: { date: string; startHour: number }): Promise<Booking> {
  requireUser();
  const settings = await getScheduleSettings();
  const ref = doc(db, 'bookings', bookingId);
  let newKeys: string[] = [];

  try {
    return await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new BookingError('invalid', 'Booking not found.');
      const current = toBooking(snap);
      if (current.status !== 'confirmed') throw new BookingError('invalid', 'Only Confirmed Bookings can be rescheduled.');
      if (current.startAt <= new Date()) throw new BookingError('too-late', 'This trip has already started.');
      if (current.date === to.date && current.startHour === to.startHour) return current;
      checkStartTime(to.date, to.startHour, current.tripLength, settings);

      newKeys = slotKeysFor(to.date, to.startHour, current.tripLength);
      const locks = await Promise.all(newKeys.map(k => tx.get(lockRef(k))));
      if (locks.some(l => l.exists() && l.data().bookingId !== bookingId))
        throw new BookingError('slot-taken', TAKEN_MESSAGE);

      // Keep shared hours, release the old ones, claim only the new ones (ADR 0001).
      current.slotKeys.filter(k => !newKeys.includes(k)).forEach(k => tx.delete(lockRef(k)));
      newKeys.forEach((k, i) => {
        if (!locks[i].exists()) tx.set(lockRef(k), { bookingId, date: to.date, hour: to.startHour + i });
      });
      const startAt = riyadhStartAt(to.date, to.startHour);
      tx.update(ref, {
        date: to.date, startHour: to.startHour, startAt: Timestamp.fromDate(startAt), slotKeys: newKeys,
        updatedAt: serverTimestamp(), reminderSentFor: null,
      });
      return { ...current, date: to.date, startHour: to.startHour, startAt, slotKeys: newKeys, updatedAt: new Date(), reminderSentFor: null };
    });
  } catch (e) { throw await explainFailure(e, newKeys, bookingId) }
}

// Used by both the Customer and the Provider. Marks it Cancelled and frees its hours in one batch.
export async function cancelBooking(bookingId: string): Promise<void> {
  requireUser();
  try {
    const ref = doc(db, 'bookings', bookingId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new BookingError('invalid', 'Booking not found.');
    const current = toBooking(snap);
    if (current.status !== 'confirmed') throw new BookingError('invalid', 'Only Confirmed Bookings can be cancelled.');
    const batch = writeBatch(db);
    batch.update(ref, { status: 'cancelled', updatedAt: serverTimestamp() });
    current.slotKeys.forEach(k => batch.delete(lockRef(k)));
    await batch.commit();
  } catch (e) { throw toBookingError(e) }
}

// Upcoming = from the start of today (Riyadh), so today's trips stay visible.
export function watchMyBookings(uid: string, cb: (b: Booking[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'bookings'),
      where('customerId', '==', uid),
      where('startAt', '>=', Timestamp.fromDate(riyadhStartAt(riyadhToday(), 0))),
      orderBy('startAt')),
    snap => cb(snap.docs.map(toBooking)),
    err => console.error('watchMyBookings', err),
  );
}

export function watchBookingsForDate(date: string, cb: (b: Booking[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'bookings'), where('date', '==', date), orderBy('startHour')),
    snap => cb(snap.docs.map(toBooking)),
    err => console.error('watchBookingsForDate', err),
  );
}

export async function markCompleted(bookingId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { status: 'completed', updatedAt: serverTimestamp() });
  } catch (e) { throw toBookingError(e) }
}

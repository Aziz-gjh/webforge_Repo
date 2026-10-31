// Change request: recurring unavailable time. Blocks live in their own collection; a booking's
// conflict with a block is worked out on the fly (findConflicts in schedule.ts), so adding a
// block never changes, moves or deletes an existing booking.
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { toBooking } from './bookings';
import { riyadhStartAt, riyadhToday } from './schedule';
import { BookingError, type Booking, type RecurringBlock } from '../types';

const blocksCol = () => collection(db, 'blocks');

function toBlock(id: string, d: Record<string, unknown>): RecurringBlock {
  return {
    id,
    weekdays: (d.weekdays as number[]) ?? [],
    startHour: d.startHour as number,
    endHour: d.endHour as number,
    label: (d.label as string) ?? '',
    createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date(),
  };
}

/** One-off read, used by createBooking/rescheduleBooking to refuse blocked start times. */
export async function getBlocks(): Promise<RecurringBlock[]> {
  try {
    const snap = await getDocs(blocksCol());
    return snap.docs.map(d => toBlock(d.id, d.data()));
  } catch {
    return []; // Blocks are a Provider preference: if they cannot load, booking still works.
  }
}

export function watchBlocks(cb: (blocks: RecurringBlock[]) => void): () => void {
  return onSnapshot(blocksCol(),
    snap => cb(snap.docs.map(d => toBlock(d.id, d.data({ serverTimestamps: 'estimate' })))),
    err => { console.error('watchBlocks', err); cb([]); });
}

/** Provider only (enforced by firestore.rules). */
export async function addBlock(input: { weekdays: number[]; startHour: number; endHour: number; label: string }): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new BookingError('permission-denied', 'Please sign in first.');
  const weekdays = [...new Set(input.weekdays)].sort();
  if (!weekdays.length || input.endHour <= input.startHour)
    throw new BookingError('invalid', 'Pick at least one day and an end time after the start time.');
  try {
    await addDoc(blocksCol(), {
      weekdays, startHour: input.startHour, endHour: input.endHour,
      label: input.label.trim().slice(0, 60), createdBy: user.uid, createdAt: serverTimestamp(),
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    throw new BookingError(code === 'permission-denied' ? 'permission-denied' : 'network', 'Could not save the unavailable time.');
  }
}

export async function removeBlock(id: string): Promise<void> {
  try { await deleteDoc(doc(db, 'blocks', id)); } catch (e) {
    const code = (e as { code?: string })?.code;
    throw new BookingError(code === 'permission-denied' ? 'permission-denied' : 'network', 'Could not remove the unavailable time.');
  }
}

/** Provider only: every booking from today on, across all customers, to scan for conflicts. */
export function watchUpcomingBookings(cb: (b: Booking[]) => void): () => void {
  return onSnapshot(
    query(collection(db, 'bookings'),
      where('startAt', '>=', Timestamp.fromDate(riyadhStartAt(riyadhToday(), 0))),
      orderBy('startAt')),
    snap => cb(snap.docs.map(toBooking)),
    err => console.error('watchUpcomingBookings', err),
  );
}

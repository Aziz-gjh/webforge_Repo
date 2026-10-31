import { useMemo } from 'react';
import { BookingError, type Booking } from '../../types';
import { riyadhStartAt, slotKeysFor } from '../../lib/schedule';
import ProviderScheduleView, { type ProviderScheduleData } from './ProviderScheduleView';
import './preview.css';

// This preview imports the shared view and pure scheduling helpers only.
// All changes stay in memory; no Firebase module is imported.
function createSampleData(): ProviderScheduleData & { reset(): void } {
  const days = new Map<string, Booking[]>();
  const listeners = new Map<string, Set<(bookings: Booking[]) => void>>();
  const examples = [
    { siteId: 'hegra', siteName: 'Hegra', tripLength: 2, startHour: 10, partySize: 4, status: 'confirmed' as const },
    { siteId: 'elephant-rock', siteName: 'Elephant Rock', tripLength: 1, startHour: 13, partySize: 2, status: 'confirmed' as const },
    { siteId: 'harrat-viewpoint', siteName: 'Harrat Viewpoint', tripLength: 2, startHour: 15, partySize: 3, status: 'completed' as const },
    { siteId: 'old-town', siteName: 'AlUla Old Town', tripLength: 1, startHour: 18, partySize: 5, status: 'cancelled' as const },
  ];
  function read(date: string): Booking[] {
    if (!days.has(date)) {
      days.set(date, examples.map((example, index) => ({
        ...example,
        id: `sample-${date}-${index}`,
        date,
        customerId: `sample-customer-${index}`,
        customerName: `Sample Customer ${index + 1}`,
        customerEmail: `customer${index + 1}@example.com`,
        startAt: riyadhStartAt(date, example.startHour),
        slotKeys: slotKeysFor(date, example.startHour, example.tripLength),
        createdAt: riyadhStartAt(date, 6),
        updatedAt: riyadhStartAt(date, 7),
        reminderSentFor: index === 2 ? slotKeysFor(date, example.startHour, 1)[0] : null,
      })));
    }
    return days.get(date)!;
  }
  function notify(date: string) {
    for (const listener of listeners.get(date) ?? []) listener([...read(date)]);
  }
  async function update(id: string, status: 'cancelled' | 'completed') {
    const day = [...days.entries()].find(([, bookings]) => bookings.some((booking) => booking.id === id));
    if (!day || day[1].find((booking) => booking.id === id)?.status !== 'confirmed') {
      throw new BookingError('invalid', 'Choose a Confirmed sample Booking.');
    }
    days.set(day[0], day[1].map((booking) => booking.id === id ? { ...booking, status, updatedAt: new Date() } : booking));
    notify(day[0]);
  }
  return {
    watchBookingsForDate(date, callback) {
      if (!listeners.has(date)) listeners.set(date, new Set());
      listeners.get(date)!.add(callback);
      callback([...read(date)]);
      return () => { listeners.get(date)?.delete(callback); };
    },
    cancelBooking: (id) => update(id, 'cancelled'),
    markCompleted: (id) => update(id, 'completed'),
    reset() {
      days.clear();
      for (const date of listeners.keys()) notify(date);
    },
  };
}

const sampleProvider = { uid: 'sample-provider', name: 'Sample Provider', email: 'provider@example.com' };

export default function ProviderPreview() {
  const data = useMemo(createSampleData, []);
  return <>
    <aside className="provider-preview-banner" aria-label="Preview information">
      <div><strong>Provider preview · sample data</strong>
        <p>Try filters, details, Cancel and Mark Completed. Changes stay in this page and reset on reload.</p></div>
      <nav aria-label="Preview pages">
        <a href="/design/index.html">Home design</a>
        <a href="/design/book.html">Book design</a>
        <a href="/design/trips.html">My trips design</a>
        <button type="button" onClick={() => data.reset()}>Reset samples</button>
      </nav>
    </aside>
    <ProviderScheduleView user={sampleProvider} authLoading={false} isProvider
      providerLoading={false} data={data} sample />
  </>;
}

import { useEffect, useId, useRef, useState } from 'react';
import { riyadhToday } from '../../lib/schedule';
import type { Booking, BookingStatus } from '../../types';
import './provider.css';

const statusLabels: Record<BookingStatus, string> = {
  confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed',
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Riyadh', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});
const timestampFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function timeRange(booking: Booking): string {
  const hour = (value: number) => `${String(value).padStart(2, '0')}:00`;
  return `${hour(booking.startHour)}–${hour(booking.startHour + booking.tripLength)}`;
}

function timestamp(value: Date): string {
  return Number.isFinite(value.getTime()) ? timestampFormatter.format(value) : 'Unavailable';
}

function validDate(value: string): boolean {
  const parsed = new Date(`${value}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function errorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'permission-denied') return 'Your Provider access could not be verified. Sign in again.';
  if (code === 'network') return 'Connection lost. Check your connection and try again.';
  if (code === 'too-late') return 'This Booking can no longer be changed.';
  return 'The request could not be completed. Try again.';
}

function CancelDialog({ booking, pending, error, onClose, onConfirm }: {
  booking: Booking;
  pending: boolean;
  error: string | null;
  onClose(): void;
  onConfirm(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog ref={dialog} className="provider-dialog" aria-labelledby={headingId}
      aria-describedby={descriptionId} onCancel={(event) => {
        if (pending) event.preventDefault();
        else onClose();
      }}>
      <h2 id={headingId}>Cancel this Booking?</h2>
      <p id={descriptionId}>{booking.siteName} · {dateFormatter.format(booking.startAt)} · {timeRange(booking)}.
        {' '}The Slots will become open for other Customers.</p>
      {error && <p role="alert" className="provider-error">{error}</p>}
      <div className="provider-actions">
        <button type="button" className="provider-button" disabled={pending} onClick={onClose} autoFocus>Keep Booking</button>
        <button type="button" className="provider-button provider-button-danger" disabled={pending} onClick={onConfirm}>
          {pending ? 'Cancelling…' : 'Cancel Booking'}
        </button>
      </div>
    </dialog>
  );
}

interface BookingList {
  key: string;
  status: 'loading' | 'ready' | 'error';
  bookings: Booking[];
  error?: string;
}

export interface ProviderScheduleData {
  watchBookingsForDate(date: string, callback: (bookings: Booking[]) => void): () => void;
  cancelBooking(bookingId: string): Promise<void>;
  markCompleted(bookingId: string): Promise<void>;
}

export interface ProviderScheduleViewProps {
  user: { uid: string; name: string; email: string } | null;
  authLoading: boolean;
  isProvider: boolean;
  providerLoading: boolean;
  data: ProviderScheduleData;
  sample?: boolean;
}

export default function ProviderScheduleView({
  user, authLoading, isProvider, providerLoading, data, sample = false,
}: ProviderScheduleViewProps) {
  const { watchBookingsForDate, cancelBooking, markCompleted } = data;
  const [date, setDate] = useState(() => riyadhToday());
  const [siteId, setSiteId] = useState('all');
  const [status, setStatus] = useState<BookingStatus | 'all'>('all');
  const [retry, setRetry] = useState(0);
  const [list, setList] = useState<BookingList>({ key: '', status: 'loading', bookings: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const [feedback, setFeedback] = useState<{ key: string; text: string; error: boolean } | null>(null);
  const key = `${user?.uid ?? ''}:${date}`;
  const canRead = !authLoading && !providerLoading && !!user && isProvider && validDate(date);

  useEffect(() => {
    if (!canRead) return;
    let active = true;
    setList({ key, status: 'loading', bookings: [] });
    // The shared watch contract has no error callback. Bound the initial wait
    // so a denied or unavailable subscription does not leave a permanent spinner.
    const timeout = window.setTimeout(() => {
      if (active) setList({ key, status: 'error', bookings: [], error: 'The Schedule did not load. Check your connection and Provider access, then retry.' });
    }, 12_000);
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = watchBookingsForDate(date, (bookings) => {
        if (!active) return;
        window.clearTimeout(timeout);
        setList({ key, status: 'ready', bookings: [...bookings].sort((a, b) => a.startHour - b.startHour || a.id.localeCompare(b.id)) });
      });
    } catch (error) {
      window.clearTimeout(timeout);
      setList({ key, status: 'error', bookings: [], error: errorMessage(error) });
    }
    return () => {
      active = false;
      window.clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [canRead, date, key, retry, watchBookingsForDate]);

  if (authLoading || providerLoading) {
    return <main className="provider-page"><p role="status">Checking Provider access…</p></main>;
  }
  if (!user || !isProvider) {
    return <main className="provider-page"><h1>Not authorised</h1>
      <p>The Provider Schedule is available to the Provider account.</p>
      {!user && <a className="provider-button" href="/signin">Sign in with Google</a>}
    </main>;
  }

  // Never display a previous Customer's or date's records while a new listener starts.
  const current = list.key === key ? list : { status: 'loading', bookings: [] };
  const bookings = current.bookings;
  const sites = [...new Map(bookings.map((booking) => [booking.siteId, booking.siteName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const visible = bookings.filter((booking) => (siteId === 'all' || booking.siteId === siteId) &&
    (status === 'all' || booking.status === status));
  const selected = visible.find((booking) => booking.id === selectedId);
  const cancelTarget = bookings.find((booking) => booking.id === cancelId && booking.status === 'confirmed');
  const message = feedback?.key === key ? feedback : null;

  async function updateBooking(booking: Booking, action: 'cancelled' | 'completed') {
    // A ref also blocks two clicks before React has committed disabled buttons.
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(booking.id);
    setFeedback(null);
    try {
      if (action === 'cancelled') await cancelBooking(booking.id);
      else await markCompleted(booking.id);
      setList((previous) => previous.key === key ? {
        ...previous,
        bookings: previous.bookings.map((item) => item.id === booking.id ? { ...item, status: action } : item),
      } : previous);
      setFeedback({ key, text: action === 'cancelled' ? 'Booking cancelled. Its Slots are open again.' : 'Booking marked Completed.', error: false });
      setCancelId(null);
    } catch (error) {
      setFeedback({ key, text: errorMessage(error), error: true });
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  return (
    <main className="provider-page" aria-labelledby="provider-heading">
      <header className="provider-heading">
        <div><p className="provider-eyebrow">PROVIDER // SCHEDULE</p><h1 id="provider-heading">Your day, at a glance.</h1>
          <p className="provider-muted">Every Site. One Schedule. All times in Riyadh (UTC+3).</p></div>
        <span className="provider-live">{current.status === 'ready' ? (sample ? 'Sample Schedule' : 'Live Schedule') : current.status === 'error' ? 'Connection unavailable' : 'Connecting…'}</span>
      </header>

      <section className="provider-filters" aria-label="Schedule filters">
        <label>Date<input type="date" value={date} disabled={!!pending} onChange={(event) => {
          setDate(event.target.value); setSelectedId(null); setCancelId(null); setSiteId('all'); setFeedback(null);
        }} /></label>
        <label>Site<select value={siteId} disabled={!!pending} onChange={(event) => setSiteId(event.target.value)}>
          <option value="all">All Sites</option>
          {sites.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <label>Booking Status<select value={status} disabled={!!pending}
          onChange={(event) => setStatus(event.target.value as BookingStatus | 'all')}>
          <option value="all">All statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </section>

      <div aria-live="polite" aria-atomic="true">
        {message && !message.error && <p className="provider-success" role="status">{message.text}</p>}
      </div>
      {message?.error && !cancelTarget && <p className="provider-error" role="alert">{message.text}</p>}

      {!validDate(date) ? <p role="alert" className="provider-error">Choose a valid date to view the Schedule.</p>
        : current.status === 'loading' ? <p role="status" className="provider-state">Loading the Schedule…</p>
          : current.status === 'error' ? <div className="provider-state provider-error" role="alert">
            <p>{'error' in current ? current.error : 'The Schedule could not be loaded.'}</p>
            <button type="button" className="provider-button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
            : <>
              <p className="provider-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'Booking' : 'Bookings'}</p>
              {visible.length === 0 ? <div className="provider-state">
                <h2>{bookings.length === 0 ? 'No Bookings on this day.' : 'No Bookings match these filters.'}</h2>
                <p className="provider-muted">{bookings.length === 0 ? 'Choose another date to view the Schedule.' : 'Choose another Site or Booking Status.'}</p>
              </div> : <ul className="provider-bookings" aria-label="Bookings">
                {visible.map((booking) => <li key={booking.id} className="provider-booking">
                  <div className="provider-booking-time"><strong>{timeRange(booking)}</strong><span>{booking.tripLength} h · Party Size {booking.partySize}</span></div>
                  <div className="provider-booking-customer"><h2>{booking.siteName}</h2><p>{booking.customerName}</p><p><a href={`mailto:${booking.customerEmail}`}>{booking.customerEmail}</a></p></div>
                  <span className={`provider-status provider-status-${booking.status}`}>{statusLabels[booking.status]}</span>
                  <button type="button" className="provider-button" aria-expanded={selectedId === booking.id}
                    aria-label={`${selectedId === booking.id ? 'Hide' : 'View'} details for ${booking.siteName} at ${timeRange(booking)}`}
                    aria-controls="provider-booking-details" onClick={() => setSelectedId(selectedId === booking.id ? null : booking.id)}>
                    {selectedId === booking.id ? 'Hide details' : 'View details'}<span className="provider-sr-only"> for {booking.siteName} at {timeRange(booking)}</span>
                  </button>
                </li>)}
              </ul>}
            </>}

      {selected && <section id="provider-booking-details" className="provider-details" aria-labelledby="provider-details-heading">
        <p className="provider-eyebrow">BOOKING // DETAILS</p><h2 id="provider-details-heading">{selected.siteName}</h2>
        <dl>
          <div><dt>Customer</dt><dd>{selected.customerName}</dd></div>
          <div><dt>Email</dt><dd><a href={`mailto:${selected.customerEmail}`}>{selected.customerEmail}</a></dd></div>
          <div><dt>Date and time</dt><dd>{dateFormatter.format(selected.startAt)} · {timeRange(selected)} (Riyadh)</dd></div>
          <div><dt>Party Size</dt><dd>{selected.partySize}</dd></div>
          <div><dt>Booking Status</dt><dd>{statusLabels[selected.status]}</dd></div>
          <div><dt>Created</dt><dd>{timestamp(selected.createdAt)} (Riyadh)</dd></div>
          <div><dt>Updated</dt><dd>{timestamp(selected.updatedAt)} (Riyadh)</dd></div>
          <div><dt>Reminder</dt><dd>{selected.reminderSentFor === selected.slotKeys[0] ? 'Sent for the current start time' : 'Not sent for the current start time'}</dd></div>
        </dl>
        {selected.status === 'confirmed' && <div className="provider-actions">
          <button type="button" className="provider-button" disabled={!!pending} onClick={() => {
            setFeedback(null); setCancelId(selected.id);
          }}>Cancel Booking</button>
          <button type="button" className="provider-button provider-button-primary" disabled={!!pending}
            onClick={() => void updateBooking(selected, 'completed')}>
            {pending === selected.id ? 'Saving…' : 'Mark Completed'}
          </button>
        </div>}
      </section>}
      {cancelTarget && <CancelDialog booking={cancelTarget} pending={!!pending} error={message?.error ? message.text : null}
        onClose={() => { setCancelId(null); setFeedback(null); }}
        onConfirm={() => void updateBooking(cancelTarget, 'cancelled')} />}
    </main>
  );
}

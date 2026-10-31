import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { riyadhToday } from '../../lib/schedule';
import type { Lang } from '../../content';
import type { Booking, BookingStatus } from '../../types';
import { providerCopy, providerDateFormatters, providerSiteName, providerText, type ProviderTextKey } from './providerI18n';
import './provider.css';

const statuses: BookingStatus[] = ['confirmed', 'cancelled', 'completed'];

function timeRange(booking: Booking): string {
  const hour = (value: number) => `${String(value).padStart(2, '0')}:00`;
  return `${hour(booking.startHour)}–${hour(booking.startHour + booking.tripLength)}`;
}

function validDate(value: string): boolean {
  const parsed = new Date(`${value}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function errorMessageKey(error: unknown): ProviderTextKey {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'permission-denied') return 'permissionError';
  if (code === 'network') return 'networkError';
  if (code === 'too-late') return 'tooLateError';
  return 'requestError';
}

function CancelDialog({ booking, pending, error, lang, onClose, onConfirm }: {
  booking: Booking;
  pending: boolean;
  error: string | null;
  lang: Lang;
  onClose(): void;
  onConfirm(): void;
}) {
  const copy = providerCopy[lang];
  const formatters = useMemo(() => providerDateFormatters(lang), [lang]);
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
      <h2 id={headingId}>{copy.cancelTitle}</h2>
      <p id={descriptionId}>{providerSiteName(booking.siteId, booking.siteName, lang)} · {formatters.date.format(booking.startAt)} · <bdi dir="ltr">{timeRange(booking)}</bdi>.
        {' '}{copy.cancelDescription}</p>
      {error && <p role="alert" className="provider-error">{error}</p>}
      <div className="provider-actions">
        <button type="button" className="provider-button" disabled={pending} onClick={onClose} autoFocus>{copy.keepBooking}</button>
        <button type="button" className="provider-button provider-button-danger" disabled={pending} onClick={onConfirm}>
          {pending ? copy.cancelling : copy.cancelBooking}
        </button>
      </div>
    </dialog>
  );
}

interface BookingList {
  key: string;
  status: 'loading' | 'ready' | 'error';
  bookings: Booking[];
  error?: ProviderTextKey;
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
  lang?: Lang;
}

export default function ProviderScheduleView({
  user, authLoading, isProvider, providerLoading, data, sample = false, lang = 'en',
}: ProviderScheduleViewProps) {
  const copy = providerCopy[lang];
  const formatters = useMemo(() => providerDateFormatters(lang), [lang]);
  const siteName = (booking: Booking) => providerSiteName(booking.siteId, booking.siteName, lang);
  const timestamp = (value: Date) => Number.isFinite(value.getTime()) ? formatters.timestamp.format(value) : copy.unavailable;
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
  const [feedback, setFeedback] = useState<{ key: string; message: ProviderTextKey; error: boolean } | null>(null);
  const key = `${user?.uid ?? ''}:${date}`;
  const canRead = !authLoading && !providerLoading && !!user && isProvider && validDate(date);

  useEffect(() => {
    if (!canRead) return;
    let active = true;
    setList({ key, status: 'loading', bookings: [] });
    // The shared watch contract has no error callback. Bound the initial wait
    // so a denied or unavailable subscription does not leave a permanent spinner.
    const timeout = window.setTimeout(() => {
      if (active) setList({ key, status: 'error', bookings: [], error: 'loadError' });
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
      setList({ key, status: 'error', bookings: [], error: errorMessageKey(error) });
    }
    return () => {
      active = false;
      window.clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [canRead, date, key, retry, watchBookingsForDate]);

  if (authLoading || providerLoading) {
    return <main className="provider-page" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}><p role="status">{copy.checkingAccess}</p></main>;
  }
  if (!user || !isProvider) {
    return <main className="provider-page" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}><h1>{copy.notAuthorised}</h1>
      <p>{copy.accessDescription}</p>
      {!user && <a className="provider-button" href="/signin">{copy.signIn}</a>}
    </main>;
  }

  // Never display a previous Customer's or date's records while a new listener starts.
  const current = list.key === key ? list : { status: 'loading', bookings: [] };
  const bookings = current.bookings;
  const sites = [...new Map(bookings.map((booking) => [booking.siteId, siteName(booking)])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], lang));
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
      setFeedback({ key, message: action === 'cancelled' ? 'cancelSuccess' : 'completedSuccess', error: false });
      setCancelId(null);
    } catch (error) {
      setFeedback({ key, message: errorMessageKey(error), error: true });
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  return (
    <main className="provider-page" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="provider-heading">
      <header className="provider-heading">
        <div><p className="provider-eyebrow">{copy.eyebrow}</p><h1 id="provider-heading">{copy.title}</h1>
          <p className="provider-muted">{copy.subtitle} <bdi dir="ltr">(UTC+3)</bdi>.</p></div>
        <span className="provider-live">{current.status === 'ready' ? (sample ? copy.sample : copy.live) : current.status === 'error' ? copy.connectionUnavailable : copy.connecting}</span>
      </header>

      <section className="provider-filters" aria-label={copy.filters}>
        <label>{copy.date}<input type="date" dir="ltr" value={date} disabled={!!pending} onChange={(event) => {
          setDate(event.target.value); setSelectedId(null); setCancelId(null); setSiteId('all'); setFeedback(null);
        }} /></label>
        <label>{copy.site}<select value={siteId} disabled={!!pending} onChange={(event) => setSiteId(event.target.value)}>
          <option value="all">{copy.allSites}</option>
          {sites.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <label>{copy.bookingStatus}<select value={status} disabled={!!pending}
          onChange={(event) => setStatus(event.target.value as BookingStatus | 'all')}>
          <option value="all">{copy.allStatuses}</option>
          {statuses.map((value) => <option key={value} value={value}>{copy[value]}</option>)}
        </select></label>
      </section>

      <div aria-live="polite" aria-atomic="true">
        {message && !message.error && <p className="provider-success" role="status">{copy[message.message]}</p>}
      </div>
      {message?.error && !cancelTarget && <p className="provider-error" role="alert">{copy[message.message]}</p>}

      {!validDate(date) ? <p role="alert" className="provider-error">{copy.invalidDate}</p>
        : current.status === 'loading' ? <p role="status" className="provider-state">{copy.loading}</p>
          : current.status === 'error' ? <div className="provider-state provider-error" role="alert">
            <p>{copy[('error' in current && current.error) || 'loadError']}</p>
            <button type="button" className="provider-button" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button>
          </div>
            : <>
              <p className="provider-count" aria-live="polite">{providerText(lang, visible.length === 1 ? 'bookingOne' : 'bookingMany', { count: visible.length })}</p>
              {visible.length === 0 ? <div className="provider-state">
                <h2>{bookings.length === 0 ? copy.emptyDay : copy.emptyFilters}</h2>
                <p className="provider-muted">{bookings.length === 0 ? copy.chooseDate : copy.chooseFilters}</p>
              </div> : <ul className="provider-bookings" aria-label={copy.bookings}>
                {visible.map((booking) => <li key={booking.id} className="provider-booking">
                  <div className="provider-booking-time"><strong><bdi dir="ltr">{timeRange(booking)}</bdi></strong><span><bdi dir="ltr">{booking.tripLength}</bdi> {copy.hourUnit} · {copy.partySize} <bdi dir="ltr">{booking.partySize}</bdi></span></div>
                  <div className="provider-booking-customer"><h2>{siteName(booking)}</h2><p><bdi>{booking.customerName}</bdi></p><p><a dir="ltr" href={`mailto:${booking.customerEmail}`}>{booking.customerEmail}</a></p></div>
                  <span className={`provider-status provider-status-${booking.status}`}>{copy[booking.status]}</span>
                  <button type="button" className="provider-button" aria-expanded={selectedId === booking.id}
                    aria-label={providerText(lang, 'detailsLabel', { action: selectedId === booking.id ? copy.hideDetails : copy.viewDetails, site: siteName(booking), time: timeRange(booking) })}
                    aria-controls="provider-booking-details" onClick={() => setSelectedId(selectedId === booking.id ? null : booking.id)}>
                    {selectedId === booking.id ? copy.hideDetails : copy.viewDetails}
                  </button>
                </li>)}
              </ul>}
            </>}

      {selected && <section id="provider-booking-details" className="provider-details" aria-labelledby="provider-details-heading">
        <p className="provider-eyebrow">{copy.detailsEyebrow}</p><h2 id="provider-details-heading">{siteName(selected)}</h2>
        <dl>
          <div><dt>{copy.customer}</dt><dd><bdi>{selected.customerName}</bdi></dd></div>
          <div><dt>{copy.email}</dt><dd><a dir="ltr" href={`mailto:${selected.customerEmail}`}>{selected.customerEmail}</a></dd></div>
          <div><dt>{copy.dateAndTime}</dt><dd>{formatters.date.format(selected.startAt)} · <bdi dir="ltr">{timeRange(selected)}</bdi> ({copy.riyadh})</dd></div>
          <div><dt>{copy.partySize}</dt><dd><bdi dir="ltr">{selected.partySize}</bdi></dd></div>
          <div><dt>{copy.bookingStatus}</dt><dd>{copy[selected.status]}</dd></div>
          <div><dt>{copy.created}</dt><dd>{timestamp(selected.createdAt)} ({copy.riyadh})</dd></div>
          <div><dt>{copy.updated}</dt><dd>{timestamp(selected.updatedAt)} ({copy.riyadh})</dd></div>
          <div><dt>{copy.reminder}</dt><dd>{selected.reminderSentFor === selected.slotKeys[0] ? copy.reminderSent : copy.reminderNotSent}</dd></div>
        </dl>
        {selected.status === 'confirmed' && <div className="provider-actions">
          <button type="button" className="provider-button" disabled={!!pending} onClick={() => {
            setFeedback(null); setCancelId(selected.id);
          }}>{copy.cancelBooking}</button>
          <button type="button" className="provider-button provider-button-primary" disabled={!!pending}
            onClick={() => void updateBooking(selected, 'completed')}>
            {pending === selected.id ? copy.saving : copy.markCompleted}
          </button>
        </div>}
      </section>}
      {cancelTarget && <CancelDialog booking={cancelTarget} pending={!!pending} lang={lang} error={message?.error ? copy[message.message] : null}
        onClose={() => { setCancelId(null); setFeedback(null); }}
        onConfirm={() => void updateBooking(cancelTarget, 'cancelled')} />}
    </main>
  );
}

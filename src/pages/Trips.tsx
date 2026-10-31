import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Layout';
import { dateLabel, timeRange } from '../format';
import { useApp } from '../i18n';
import { useAuth } from '../lib/auth';
import { cancelBooking, watchMyBookings } from '../lib/bookings';
import { BookingError, type Booking } from '../types';
import '../styles/trips.css';

const CalendarIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
const ClockIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const PeopleIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></svg>;

export default function Trips() {
  const { t, list, hours, place, text } = useApp();
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState<Booking[] | null>(null);
  const [target, setTarget] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!user) return;
    return watchMyBookings(user.uid, setTrips);
  }, [user]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);

  async function doCancel() {
    if (!target) return;
    setPending(true);
    setError(null);
    try {
      await cancelBooking(target.id);
      setTarget(null);
    } catch (e) {
      setError(t(`err.${e instanceof BookingError ? e.code : 'network'}`));
    } finally {
      setPending(false);
    }
  }

  const days = list('days'), months = list('months');
  const now = new Date();
  const upcoming = (trips ?? []).filter(b => b.status !== 'cancelled' || b.startAt > now);
  const activeCount = upcoming.filter(b => b.status === 'confirmed').length;

  let body;
  if (loading || (user && trips === null)) {
    body = <p className="state" role="status">{t('state.loading')}</p>;
  } else if (!user) {
    body = <div className="state"><p>{t('trips.signin')}</p><Link className="btn" to="/signin?next=/trips">{t('nav.signin')}</Link></div>;
  } else if (!activeCount && !upcoming.length) {
    body = (
      <div className="empty show">
        <h2>{t('trips.empty')}</h2>
        <p>{t('trips.emptyd')}</p>
        <Link className="btn small" to="/book">{t('trips.book')}</Link>
      </div>
    );
  } else {
    body = (
      <div className="list">
        {upcoming.map(b => {
          const p = place(b.siteId);
          const L = p && text(p);
          const started = b.startAt <= now;
          const canChange = b.status === 'confirmed' && !started;
          const badge = b.status === 'cancelled' ? 'cancelled' : 'confirmed';
          return (
            <article key={b.id} className={'trip' + (b.status === 'cancelled' ? ' cancelled' : '')}>
              <img src={p?.img ?? '/img/elephant-card.webp'} alt={L?.name ?? b.siteName} width={900} height={600} />
              <div className="info">
                <h2>{L?.name ?? b.siteName}</h2>
                <span className="where">{L ? `${L.region} · ` : ''}{hours(b.tripLength)}</span>
                <div className="facts">
                  <span><CalendarIcon />{dateLabel(b.date, days, months)}</span>
                  <span><ClockIcon />{timeRange(b.startHour, b.tripLength)}</span>
                  <span><PeopleIcon />{b.partySize} {t(b.partySize === 1 ? 'book.person' : 'book.people')}</span>
                </div>
              </div>
              <span className={`badge ${badge}`}>
                {b.status === 'completed' || (started && b.status === 'confirmed') ? t('trips.past') : t(`trips.${badge}`)}
              </span>
              {canChange && (
                <div className="actions">
                  <Link className="btn ghost" to={`/book?reschedule=${b.id}`}>{t('trips.reschedule')}</Link>
                  <button className="btn danger" type="button" onClick={() => { setError(null); setTarget(b); }}>{t('trips.cancel')}</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <Page title="title.trips">
      <main className="wrap page-main page-trips">
        <div className="head">
          <div>
            <span className="label">{t('trips.eyebrow')}</span>
            <h1 className="display">{t('trips.title')}</h1>
          </div>
          <Link className="btn small" to="/book">{t('trips.another')}</Link>
        </div>
        {body}

        <dialog ref={dialog} aria-labelledby="cancel-title" onCancel={e => { e.preventDefault(); if (!pending) setTarget(null); }}>
          <h3 id="cancel-title">{t('trips.q')}</h3>
          <p>{t('trips.qd')}</p>
          {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
          <div className="row">
            <button className="btn ghost" type="button" disabled={pending} onClick={() => setTarget(null)}>{t('trips.keep')}</button>
            <button className="btn" type="button" disabled={pending} style={{ background: 'var(--danger)', color: '#fff' }} onClick={doCancel}>{t('trips.yes')}</button>
          </div>
        </dialog>
      </main>
    </Page>
  );
}

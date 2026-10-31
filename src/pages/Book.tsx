import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { PLACES, type Place } from '../content';
import { dayParts, dateLabel, hourLabel, timeRange } from '../format';
import { useApp } from '../i18n';
import { signInWithGoogle, useAuth } from '../lib/auth';
import { watchBlocks } from '../lib/blocks';
import { createBooking, getScheduleSettings, getSites, rescheduleBooking, watchMyBookings, watchTakenHours } from '../lib/bookings';
import { blockedHours, getOpenStartTimes, windowDates } from '../lib/schedule';
import { BookingError, type Booking, type RecurringBlock, type ScheduleSettings, type Site, type TakenHour } from '../types';
import '../styles/book.css';

type Choice = { place: Place; site: Site };

export default function Book() {
  const { t, list, hours, text } = useApp();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const rescheduleId = params.get('reschedule');

  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  const [choice, setChoice] = useState<Choice | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [party, setParty] = useState(() => {
    const n = Number(params.get('party'));
    return Number.isInteger(n) && n >= 1 && n <= 8 ? n : 4;
  });
  const [taken, setTaken] = useState<TakenHour[]>([]);
  const [blocks, setBlocks] = useState<RecurringBlock[]>([]);
  useEffect(() => watchBlocks(setBlocks), []);
  const [current, setCurrent] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Sites + schedule settings. Only destinations that exist in Firestore can be booked.
  useEffect(() => {
    let live = true;
    setLoadError(false);
    Promise.all([getSites(), getScheduleSettings()])
      .then(([sites, s]) => {
        if (!live) return;
        const merged = PLACES.flatMap(p => {
          const site = sites.find(x => x.id === p.id);
          return site ? [{ place: p, site }] : [];
        });
        setChoices(merged);
        setSettings(s);
      })
      .catch(() => live && setLoadError(true));
    return () => { live = false };
  }, [reload]);

  const dates = useMemo(() => (settings ? windowDates(settings, now) : []), [settings, now]);

  // First pick: from the URL, else sensible defaults.
  useEffect(() => {
    if (!choices || !dates.length || choice) return;
    const wanted = params.get('place');
    setChoice(choices.find(c => c.place.id === wanted) ?? choices[0] ?? null);
    const d = params.get('date');
    setDate(d && dates.includes(d) ? d : dates[0]);
  }, [choices, dates, choice, params]);

  // Reschedule: load the booking and lock the destination to it.
  useEffect(() => {
    if (!rescheduleId || !user) return;
    return watchMyBookings(user.uid, list => {
      const b = list.find(x => x.id === rescheduleId) ?? null;
      setCurrent(b);
      if (b) setParty(b.partySize);
    });
  }, [rescheduleId, user]);
  useEffect(() => {
    if (!current || !choices) return;
    const c = choices.find(x => x.site.id === current.siteId);
    if (c) setChoice(c);
    if (dates.includes(current.date)) setDate(d => d ?? current.date);
  }, [current, choices, dates]);

  // Live taken hours for the chosen date, so a slot vanishes the moment someone else books it.
  useEffect(() => {
    if (!date) return;
    setTaken([]);
    return watchTakenHours(date, setTaken);
  }, [date]);

  // Keep "now" fresh so start times that just passed drop out.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tripLength = choice?.site.tripLength ?? 1;
  const ignore = current?.id;
  const open = useMemo(() => (settings && date
    ? getOpenStartTimes({ date, tripLength, settings, taken, now, ignoreBookingId: ignore, blocks })
    : []), [settings, date, tripLength, taken, now, ignore, blocks]);

  // Drop a selection that is no longer open (someone else just took it).
  useEffect(() => { if (start !== null && !open.includes(start)) setStart(null); }, [open, start]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  async function confirm() {
    if (!choice || !date || start === null) return;
    setSaving(true);
    try {
      if (!user) await signInWithGoogle();
      if (current) await rescheduleBooking(current.id, { date, startHour: start });
      else await createBooking({ site: choice.site, date, startHour: start, partySize: party });
      setDone(true);
    } catch (e) {
      const code = e instanceof BookingError ? e.code : (e as { code?: string })?.code?.startsWith('auth/') ? 'auth' : 'network';
      if (code === 'slot-taken') setStart(null);
      showToast(code === 'auth' ? t('signin.failed') : t(`err.${code}`));
    } finally {
      setSaving(false);
    }
  }

  const days = list('days'), months = list('months');
  const takenHours = new Set(taken.filter(x => x.bookingId !== ignore).map(x => x.hour));
  const blockedNow = date ? blockedHours(date, blocks) : new Set<number>();
  const currentHours = current && current.date === date
    ? new Set(Array.from({ length: current.tripLength }, (_, i) => current.startHour + i)) : new Set<number>();

  // Loaded, but no destination in Firestore matches the content (the seed has not run): say so.
  if (loadError || (choices && !choices.length)) {
    return (
      <Page title="title.book">
        <main className="wrap page-main"><div className="state" role="alert">
          <p>{t('state.error')}</p>
          <button className="btn" type="button" onClick={() => setReload(n => n + 1)}>{t('state.retry')}</button>
        </div></main>
      </Page>
    );
  }
  if (!choices || !settings || !choice || !date) {
    return <Page title="title.book"><main className="wrap page-main"><p className="state" role="status">{t('state.loading')}</p></main></Page>;
  }

  const L = text(choice.place);
  const hourCells = Array.from({ length: settings.closeHour - settings.openHour }, (_, i) => settings.openHour + i);

  return (
    <Page title="title.book">
      <main className="wrap page-main page-book">
        <div className="steps">
          <div>
            <span className="mono" style={{ color: 'var(--accent)' }}>{t(current ? 'book.reschedule' : 'book.eyebrow')}</span>
            <h1 className="serif">{t('book.title')}</h1>
          </div>

          {!current && (
            <section className="step">
              <div className="step-head"><span className="mono muted">{t('book.s1')}</span></div>
              <div className="place-pick">
                {choices.map(c => (
                  <button key={c.place.id} type="button" aria-pressed={c === choice}
                    onClick={() => { setChoice(c); setStart(null); setDone(false); }}>
                    <img src={c.place.img} alt="" width={300} height={200} />
                    <span>{text(c.place).name}<small>{text(c.place).region} · {hours(c.site.tripLength)}</small></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="step">
            <div className="step-head"><span className="mono muted">{t('book.s2')}</span><span className="mono muted">{t('book.s2r')}</span></div>
            <div className="dates">
              {dates.map((d, i) => {
                const { dow, day } = dayParts(d, days);
                return (
                  <button key={d} type="button" className="chip" aria-pressed={d === date}
                    onClick={() => { setDate(d); setStart(null); setDone(false); }}>
                    <small>{i === 0 ? t('book.today') : dow}</small><b>{day}</b>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="step">
            <div className="step-head">
              <span className="mono muted">{t('book.s3')}</span>
              <span className="legend mono muted">
                <span><i className="l-sel" />{t('book.yours')}</span>
                <span><i className="l-taken" />{t('book.taken')}</span>
                <span><i />{t('book.open')}</span>
              </span>
            </div>
            <div className="ruler" role="group" aria-label={t('book.s3')}>
              {hourCells.map(h => {
                const inTrip = start !== null && h >= start && h < start + tripLength;
                const held = takenHours.has(h);
                const canStart = open.includes(h);
                const cls = inTrip ? ' sel' : held ? ' taken' : !canStart ? ' blocked' : '';
                return (
                  <button key={h} type="button" className={'slot' + cls} disabled={!inTrip && !canStart}
                    aria-pressed={inTrip}
                    title={blockedNow.has(h) ? t('book.blocked') : currentHours.has(h) ? t('book.current') : undefined}
                    aria-label={hourLabel(h) + (held ? ` · ${t('book.taken')}` : blockedNow.has(h) ? ` · ${t('book.blocked')}` : '')}
                    onClick={() => { setStart(h); setDone(false); }}>
                    {String(h).padStart(2, '0')}
                    {currentHours.has(h) && !inTrip && <span className="mono" style={{ fontSize: 9 }}>●</span>}
                    <span className="bar" />
                  </button>
                );
              })}
            </div>
            <span className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
              {open.length ? `${L.name} ${t('book.note1')} ${hours(tripLength)}${t('book.note2').startsWith('،') ? '' : ', '}${t('book.note2')}` : t('book.none')}
            </span>
          </section>

          {!current && (
            <section className="step">
              <div className="step-head"><span className="mono muted">{t('book.s4')}</span></div>
              <div className="stepper">
                <button type="button" aria-label={t('book.less')} onClick={() => setParty(p => Math.max(1, p - 1))}>−</button>
                <output aria-live="polite">{party}</output>
                <button type="button" aria-label={t('book.more')} onClick={() => setParty(p => Math.min(8, p + 1))}>+</button>
              </div>
              <span className="muted" style={{ fontSize: 14 }}>{t('book.s4d')}</span>
            </section>
          )}
        </div>

        <aside>
          <img src={choice.place.img} alt={L.name} width={900} height={600} />
          <div className="body">
            <span className="mono muted">{t('book.sum')}</span>
            <h2 className="serif">{L.name}</h2>
            <dl>
              <dt className="mono muted">{t('book.date')}</dt><dd>{dateLabel(date, days, months)}</dd>
              <dt className="mono muted">{t('book.time')}</dt><dd>{start === null ? t('book.pick') : timeRange(start, tripLength)}</dd>
              <dt className="mono muted">{t('book.group')}</dt><dd>{party} {t(party === 1 ? 'book.person' : 'book.people')}</dd>
            </dl>
            {done && (
              <div className="done show" role="status">
                <div className="mono">{t('book.done')}</div>
                <div style={{ marginTop: 6 }}>{t(current ? 'book.moved' : 'book.doned')}</div>
                <Link to="/trips" style={{ display: 'inline-block', marginTop: 8, color: 'var(--accent)', fontWeight: 600 }}>{t('book.go')}</Link>
              </div>
            )}
            {!done && (
              <button className="btn" type="button" disabled={start === null || saving} onClick={confirm}>
                {saving ? t('book.saving') : !user ? t('book.signin') : t(current ? 'book.rescheduleCta' : 'book.confirm')}
              </button>
            )}
            <span className="muted" style={{ fontSize: 13 }}>{t('book.free')}</span>
          </div>
        </aside>

        {toast && <div className="toast show" role="alert">{toast}</div>}
      </main>
    </Page>
  );
}

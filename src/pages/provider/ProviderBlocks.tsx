// Change request: the Provider sets a recurring unavailable time and sees which existing
// bookings clash with it. Bookings are only flagged here, never moved or deleted.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { dateLabel, hourLabel, timeRange } from '../../format';
import { useApp } from '../../i18n';
import { addBlock, removeBlock, watchBlocks, watchUpcomingBookings } from '../../lib/blocks';
import { findConflicts } from '../../lib/schedule';
import { BookingError, type Booking, type RecurringBlock } from '../../types';
import './blocks.css';

// JS weekday numbers in Saturday-first order, to match the day names in the dictionary.
const WEEK = [6, 0, 1, 2, 3, 4, 5];

export default function ProviderBlocks() {
  const { t, list, place, text, lang } = useApp();
  const days = list('days'), months = list('months');
  const sep = lang === 'ar' ? '، ' : ', ';
  const dayName = (w: number) => days[(w + 1) % 7];

  const [blocks, setBlocks] = useState<RecurringBlock[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([5]);
  const [from, setFrom] = useState(12);
  const [to, setTo] = useState(14);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchBlocks(setBlocks), []);
  useEffect(() => watchUpcomingBookings(setBookings), []);

  const conflicts = useMemo(() => findConflicts(bookings, blocks), [bookings, blocks]);

  const toggleDay = (w: number) =>
    setWeekdays(ws => (ws.includes(w) ? ws.filter(x => x !== w) : [...ws, w]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!weekdays.length || to <= from) { setError(t('blk.pickDay')); return; }
    setSaving(true);
    setError(null);
    try {
      await addBlock({ weekdays, startHour: from, endHour: to, label: reason });
      setReason('');
    } catch (err) {
      setError(err instanceof BookingError && err.code === 'invalid' ? t('blk.pickDay') : t('blk.failed'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try { await removeBlock(id); } catch { setError(t('blk.failed')); }
  }

  const hours = Array.from({ length: 25 }, (_, h) => h);
  const describe = (b: RecurringBlock) =>
    `${t('blk.every')} ${WEEK.filter(w => b.weekdays.includes(w)).map(dayName).join(sep)} · ${timeRange(b.startHour, b.endHour - b.startHour)}`;

  return (
    <section className="blk wrap" aria-labelledby="blk-title">
      <div className="blk-head">
        <span className="label">{t('blk.label')}</span>
        <h2 id="blk-title" className="display">{t('blk.title')}</h2>
        <p className="muted">{t('blk.sub')}</p>
      </div>

      <div className="blk-grid">
        <form className="blk-card blk-form" onSubmit={submit}>
          <fieldset>
            <legend>{t('blk.days')}</legend>
            <div className="blk-days">
              {WEEK.map(w => (
                <button key={w} type="button" className="tab" aria-pressed={weekdays.includes(w)} onClick={() => toggleDay(w)}>
                  {dayName(w)}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="blk-row">
            <label>{t('blk.from')}
              <select value={from} onChange={e => setFrom(Number(e.target.value))}>
                {hours.slice(0, 24).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </label>
            <label>{t('blk.to')}
              <select value={to} onChange={e => setTo(Number(e.target.value))}>
                {hours.slice(1).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </label>
          </div>
          <label>{t('blk.reason')}
            <input type="text" maxLength={60} value={reason} placeholder={t('blk.reasonPh')} onChange={e => setReason(e.target.value)} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={saving}>{saving ? t('blk.adding') : t('blk.add')}</button>

          <h3>{t('blk.active')}</h3>
          {blocks.length === 0
            ? <p className="muted">{t('blk.none')}</p>
            : (
              <ul className="blk-list">
                {blocks.map(b => (
                  <li key={b.id}>
                    <div><b>{b.label || t('blk.unnamed')}</b><span className="muted">{describe(b)}</span></div>
                    <button className="btn ghost small" type="button" onClick={() => remove(b.id)}>{t('blk.remove')}</button>
                  </li>
                ))}
              </ul>
            )}
        </form>

        <div className="blk-card">
          <div className="blk-conf-head">
            <h3>{t('blk.conflicts')}</h3>
            <span className={'blk-count' + (conflicts.length ? ' has' : '')}>{conflicts.length}</span>
          </div>
          {conflicts.length === 0
            ? <p className="blk-ok" role="status">{t('blk.noConflicts')}</p>
            : (
              <>
                <p className="muted blk-note">{t('blk.conflictNote')}</p>
                <ul className="blk-conflicts" aria-live="polite">
                  {conflicts.map(({ booking: b, blocks: hits }) => {
                    const p = place(b.siteId);
                    return (
                      <li key={b.id}>
                        <span className="blk-flag">{t('blk.flag')}</span>
                        <div className="blk-what">
                          <b>{p ? text(p).name : b.siteName}</b>
                          <span>{dateLabel(b.date, days, months)} · {timeRange(b.startHour, b.tripLength)}</span>
                          <span className="muted">{b.customerName} · {b.customerEmail} · {b.partySize}</span>
                          <span className="blk-why">{t('blk.with')}: {hits.map(h => h.label || t('blk.unnamed')).join(sep)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
        </div>
      </div>
    </section>
  );
}

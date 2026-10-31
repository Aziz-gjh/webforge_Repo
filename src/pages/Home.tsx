import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Arrow, Page } from '../components/Layout';
import { EXPERIENCES, PLACES, type Place } from '../content';
import { dateLabel } from '../format';
import { useApp } from '../i18n';
import { windowDates } from '../lib/schedule';
import '../styles/home.css';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
);

/** Photos fade in once they have loaded instead of popping in. */
function FadeImg(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  return <img {...props} className={['fade', loaded && 'loaded', props.className].filter(Boolean).join(' ')}
    onLoad={() => setLoaded(true)} ref={el => { if (el?.complete && el.naturalWidth && !loaded) setLoaded(true); }} />;
}

/** A fixed scatter so the night sky looks the same on every visit. */
function useStars() {
  return useMemo(() => {
    let seed = 11;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const count = window.innerWidth < 760 ? 46 : 90;
    return Array.from({ length: count }, (_, i) => {
      const twinkle = rnd() < 0.3;
      const size = rnd() < 0.85 ? 1 + rnd() : 2 + rnd() * 0.8;
      return {
        key: i, twinkle,
        style: {
          left: `${(rnd() * 100).toFixed(2)}%`, top: `${(Math.pow(rnd(), 1.4) * 100).toFixed(2)}%`,
          width: `${size.toFixed(1)}px`, height: `${size.toFixed(1)}px`,
          '--o': (0.35 + rnd() * 0.65).toFixed(2), '--d': `${(1200 + rnd() * 1300).toFixed(0)}ms`,
          '--t': `${(3 + rnd() * 4).toFixed(1)}s`, '--td': `${(rnd() * 4).toFixed(1)}s`,
        } as CSSProperties,
      };
    });
  }, []);
}

function Hero() {
  const { t, list, text } = useApp();
  const navigate = useNavigate();
  const stars = useStars();
  const [placeId, setPlaceId] = useState(PLACES[0].id);
  const dates = useMemo(() => windowDates({ openHour: 6, closeHour: 19, windowDays: 7 }), []);
  const [date, setDate] = useState(dates[1] ?? dates[0]);
  const [party, setParty] = useState(4);
  const [shown, setShown] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); return () => cancelAnimationFrame(id); }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/book?${new URLSearchParams({ place: placeId, date, party: String(party) })}`);
  };
  const days = list('days'), months = list('months');

  return (
    <section className={'hero' + (shown ? ' is-in' : '')} id="hero">
      <div className="scene" aria-hidden="true">
        <div className="sky-day" /><div className="sky-dusk" /><div className="sky-night" />
        <div className="sunlight" />
        <div className="stars">{stars.map(s => <span key={s.key} className={'star' + (s.twinkle ? ' tw' : '')} style={s.style} />)}</div>
        <div className="moon" /><div className="glow-day" /><div className="glow-night" />
        <img className="land land-day" src="/img/land-day-1920.webp" srcSet="/img/land-day-1080.webp 1080w, /img/land-day-1920.webp 1920w" sizes="100vw" alt="" width={1920} height={1280} fetchPriority="high" />
        <img className="land land-night" src="/img/land-night-1920.webp" srcSet="/img/land-night-1080.webp 1080w, /img/land-night-1920.webp 1920w" sizes="100vw" alt="" width={1920} height={1280} loading="lazy" />
      </div>
      <div className="scrim" aria-hidden="true" />

      <div className="hero-content wrap">
        <div className="hero-top rise">
          <div className="hero-text">
            <span className="label">{t('hero.eyebrow')}</span>
            <h1 className="display"><span>{t('hero.title1')}</span><span>{t('hero.title2')}</span></h1>
            <p className="hero-sub">{t('hero.sub')}</p>
          </div>
          <div className="where">
            <span className="when-day">{t('hero.day')}</span>
            <span className="when-night">{t('hero.night')}</span>
            <span>{t('hero.place')}</span>
          </div>
        </div>

        <form className="finder rise" onSubmit={submit}>
          <label className="field"><span className="lbl">{t('find.place')}</span>
            <select value={placeId} onChange={e => setPlaceId(e.target.value)}>
              {PLACES.map(p => <option key={p.id} value={p.id}>{text(p).name} · {text(p).region}</option>)}
            </select>
          </label>
          <label className="field"><span className="lbl">{t('find.date')}</span>
            <select value={date} onChange={e => setDate(e.target.value)}>
              {dates.map((d, i) => <option key={d} value={d}>{i === 0 ? `${t('book.today')} · ` : ''}{dateLabel(d, days, months)}</option>)}
            </select>
          </label>
          <div className="field" role="group" aria-label={t('find.group')}>
            <span className="lbl">{t('find.group')}</span>
            <div className="stepper">
              <button type="button" aria-label={t('find.less')} onClick={() => setParty(p => Math.max(1, p - 1))}>−</button>
              <output aria-live="polite">{party} {t(party === 1 ? 'book.person' : 'book.people')}</output>
              <button type="button" aria-label={t('find.more')} onClick={() => setParty(p => Math.min(8, p + 1))}>+</button>
            </div>
          </div>
          <button className="btn" type="submit"><span>{t('find.go')}</span><Arrow /></button>
        </form>
      </div>

      <a className="scroll-cue" href="#about"><span>{t('hero.scroll')}</span><span className="rail" /></a>
      <div className="dunes" aria-hidden="true">
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none"><path d="M0 40 C 240 18, 460 14, 700 32 S 1140 56, 1440 26 L1440 64 L0 64 Z" /></svg>
      </div>
    </section>
  );
}

function About() {
  const { t, place, text } = useApp();
  const main = place('turaif'), second = place('rijal');
  return (
    <section className="section about" id="about">
      <div className="wrap grid">
        <div className="reveal">
          <span className="label">{t('discover.label')}</span>
          <h2 className="display h2">{t('discover.title')}</h2>
          <p className="body">{t('discover.body')}</p>
          <ul className="points">
            {['discover.p1', 'discover.p2', 'discover.p3'].map(k => <li key={k}><Check /><span>{t(k)}</span></li>)}
          </ul>
          <a className="text-link" href="#places"><span>{t('discover.cta')}</span><Arrow size={16} /></a>
        </div>
        <figure className="duo" style={{ margin: 0 }}>
          {main && <FadeImg className="main" src={main.img} alt={text(main).name} width={900} height={675} loading="lazy" />}
          {second && <FadeImg className="second" src={second.img} alt={text(second).name} width={900} height={675} loading="lazy" />}
          {main && <figcaption>{text(main).name} · {text(main).region}</figcaption>}
        </figure>
      </div>
    </section>
  );
}

function Experiences({ onPick }: { onPick: (id: string) => void }) {
  const { t } = useApp();
  return (
    <section className="section experiences" id="experiences">
      <div className="wrap">
        <div className="sec-head reveal"><div>
          <span className="label">{t('exp.label')}</span>
          <h2 className="display h2">{t('exp.title')}</h2>
        </div></div>
        <div className="exp-grid">
          {EXPERIENCES.map((x, i) => {
            const count = PLACES.filter(p => p.exp.includes(x.id)).length;
            return (
              <a key={x.id} href="#places" className="pcard reveal" style={{ '--delay': `${i * 60}ms` } as CSSProperties}
                onClick={e => { e.preventDefault(); onPick(x.id); }}>
                <FadeImg src={x.img} alt="" width={900} height={600} loading="lazy" />
                <span className="count">{count} {t('exp.count')}</span>
                <div className="body"><h3>{t(`exp.${x.id}`)}</h3><p>{t(`exp.${x.id}d`)}</p></div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Destinations({ filter, setFilter, onOpen }: { filter: string; setFilter: (f: string) => void; onOpen: (p: Place) => void }) {
  const { t, hours, text, lang } = useApp();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [entering, setEntering] = useState(true);
  const list = PLACES.filter(p => filter === 'all' || p.exp.includes(filter));

  const updateArrows = () => {
    const el = track.current;
    if (!el) return;
    const pos = Math.abs(el.scrollLeft), max = el.scrollWidth - el.clientWidth;
    setEdges({ start: pos < 4, end: pos > max - 4 });
  };
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = 0;
    setEntering(true);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => { setEntering(false); updateArrows(); }));
    return () => cancelAnimationFrame(id);
  }, [filter, lang]);
  useEffect(() => {
    window.addEventListener('resize', updateArrows, { passive: true });
    return () => window.removeEventListener('resize', updateArrows);
  }, []);

  // In RTL the scroll position runs negative, so flip the direction.
  const step = (dir: number) => {
    const el = track.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * dir;
    el.scrollBy({ left: document.documentElement.dir === 'rtl' ? -amount : amount, behavior: reduced() ? 'auto' : 'smooth' });
  };
  const tabs = [{ id: 'all' }, ...EXPERIENCES].map(x => ({
    id: x.id, count: x.id === 'all' ? PLACES.length : PLACES.filter(p => p.exp.includes(x.id)).length,
  })).filter(x => x.count);

  return (
    <section className="section" id="places">
      <div className="wrap">
        <div className="sec-head reveal">
          <div><span className="label">{t('places.label')}</span><h2 className="display h2">{t('places.title')}</h2></div>
          <p>{t('places.sub')}</p>
        </div>
        <div className="dest-tools reveal">
          <div className="tabs" role="toolbar">
            {tabs.map(x => (
              <button key={x.id} type="button" className="tab" aria-pressed={x.id === filter} onClick={() => setFilter(x.id)}>
                {t(x.id === 'all' ? 'places.all' : `exp.${x.id}`)}<small className="num">{x.count}</small>
              </button>
            ))}
          </div>
          <div className="arrows">
            <button type="button" aria-label={t('places.prev')} disabled={edges.start} onClick={() => step(-1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" aria-label={t('places.next')} disabled={edges.end} onClick={() => step(1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
        <div className="track" ref={track} onScroll={() => requestAnimationFrame(updateArrows)}>
          {list.map((p, i) => {
            const L = text(p);
            return (
              <a key={p.id} href={`#${p.id}`} aria-haspopup="dialog"
                className={'pcard' + (entering && !reduced() ? ' enter' : '')}
                style={{ transitionDelay: `${Math.min(i, 6) * 50}ms` }}
                onClick={e => { e.preventDefault(); onOpen(p); }}>
                <FadeImg src={p.img} alt={`${L.name} · ${L.region}`} width={900} height={600} loading="lazy" />
                <div className="body">
                  <div className="meta"><span>{L.region}</span><i /><span>{hours(p.len)}</span></div>
                  <h3>{L.name}</h3>
                  <p>{L.line}</p>
                  <span className="go">{t('places.details')}<Arrow size={16} /></span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PlaceSheet({ place, onClose }: { place: Place | null; onClose: () => void }) {
  const { t, hours, text } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (place && !d.open) {
      d.showModal();
      d.querySelector('.scroll')?.scrollTo(0, 0);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
      return () => cancelAnimationFrame(id);
    }
  }, [place]);

  const close = () => {
    setShow(false);
    setTimeout(() => { ref.current?.close(); onClose(); }, reduced() ? 0 : 320);
  };
  const L = place && text(place);

  return (
    <dialog ref={ref} className={'sheet' + (show ? ' show' : '')} aria-labelledby="sheet-title"
      onCancel={e => { e.preventDefault(); close(); }}
      onClick={e => { if (e.target === ref.current) close(); }}>
      {place && L && (
        <div className="scroll">
          <div className="photo">
            <img src={place.img} alt={`${L.name} · ${L.region}`} width={900} height={600} />
            <button className="close" type="button" aria-label={t('detail.close')} onClick={close}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div className="inner">
            <div className="meta"><span className="chip">{L.region}</span><span className="chip">{hours(place.len)}</span></div>
            <h2 className="display" id="sheet-title">{L.name}</h2>
            <p className="desc">{L.desc}</p>
            <div><h4>{t('detail.why')}</h4><ul>{L.why.map(w => <li key={w}><Check /><span>{w}</span></li>)}</ul></div>
            <div className="facts">
              <div><span>{t('detail.length')}</span><b>{hours(place.len)}</b></div>
              <div><span>{t('detail.best')}</span><b>{L.best}</b></div>
              <div><span>{t('detail.vibe')}</span><b>{L.vibe}</b></div>
            </div>
            <p className="note">{t('detail.private')}</p>
          </div>
          <div className="foot">
            <button className="btn" type="button" onClick={() => { ref.current?.close(); navigate(`/book?place=${place.id}`); }}>
              <span>{t('detail.cta')}</span><Arrow />
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

function How() {
  const { t } = useApp();
  const icons = [
    <path key="1" d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5" />,
    <path key="2" d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 10h18 M8 3v4 M16 3v4" />,
    <path key="3" d="M3 20l6-12 4 7 3-4 5 9z" />,
  ];
  return (
    <section className="section how alt" id="how">
      <div className="wrap grid">
        <div className="intro reveal">
          <span className="label">{t('how.label')}</span>
          <h2 className="display h2">{t('how.title')}</h2>
          <p>{t('how.sub')}</p>
          <a className="btn" href="/book"><span>{t('how.cta')}</span><Arrow /></a>
        </div>
        <ol className="timeline">
          {[1, 2, 3].map((n, i) => (
            <li key={n} className="tstep reveal" style={{ '--delay': `${i * 150}ms` } as CSSProperties}>
              <span className="dot">{n}</span>
              <div className="card">
                <h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[i]}</svg><span>{t(`how.${n}`)}</span></h3>
                <p>{t(`how.${n}d`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Final() {
  const { t, place, text } = useApp();
  const edge = place('edge');
  return (
    <section className="final">
      <img src="/img/edge.webp" alt={edge ? text(edge).name : ''} width={900} height={601} loading="lazy" />
      <div className="inner reveal">
        <h2 className="display">{t('cta.title')}</h2>
        <p>{t('cta.sub')}</p>
        <div className="actions">
          <a className="btn" href="/book"><span>{t('cta.go')}</span><Arrow /></a>
          <a className="btn ghost" href="#places">{t('cta.browse')}</a>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { place } = useApp();
  const [filter, setFilter] = useState('all');
  // A shared link like /#hegra opens that destination.
  const [open, setOpen] = useState<Place | null>(() => place(window.location.hash.slice(1)) ?? null);

  const openPlace = (p: Place) => { setOpen(p); history.replaceState(null, '', `#${p.id}`); };
  const closePlace = () => { setOpen(null); history.replaceState(null, '', window.location.pathname + window.location.search); };
  const pickExperience = (id: string) => {
    setFilter(id);
    document.getElementById('places')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
  };

  return (
    <Page overHero title="title.home">
      <main className="page-home">
        <Hero />
        <About />
        <Experiences onPick={pickExperience} />
        <Destinations filter={filter} setFilter={setFilter} onOpen={openPlace} />
        <How />
        <Final />
        <PlaceSheet place={open} onClose={closePlace} />
      </main>
    </Page>
  );
}

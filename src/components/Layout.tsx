import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useReveal } from '../useReveal';
import { signOutUser, useAuth, useIsProvider } from '../lib/auth';
import { useApp } from '../i18n';

export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="رحلتنا Rihlatna">
      <svg className="mark" viewBox="0 0 26 30" aria-hidden="true"><path d="M2.5 29V12.5a10.5 10.5 0 0 1 21 0V29" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M13 14.5l4.2 7.5H8.8z" fill="#D6A756" /></svg>
      <span className="word">رحلتنا</span><span className="latin">Rihlatna</span>
    </Link>
  );
}

export function Arrow({ size = 18 }: { size?: number }) {
  return (
    <svg className="arrow" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  );
}

export function Header({ overHero = false }: { overHero?: boolean }) {
  const { t, lang, setLang, sky, setSky } = useApp();
  const { user } = useAuth();
  const { isProvider } = useIsProvider();
  const [solid, setSolid] = useState(!overHero);
  const home = useLocation().pathname === '/';

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  const night = sky === 'night';
  return (
    <header className={'site-header' + (solid ? ' is-solid' : '')}>
      <div className="wrap bar">
        <Logo />
        <nav className="links" aria-label="Main">
          <a href={home ? '#places' : '/#places'}>{t('nav.places')}</a>
          <NavLink to="/book">{t('nav.book')}</NavLink>
          <NavLink to="/trips">{t('nav.trips')}</NavLink>
          {isProvider && <NavLink to="/provider">{t('nav.provider')}</NavLink>}
        </nav>
        <div className="tools">
          <button className="lang-switch" type="button" lang={lang === 'ar' ? 'en' : 'ar'}
            aria-label={t('switch.langLabel')} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
            {t('switch.lang')}
          </button>
          <button className="sky-switch" type="button" aria-pressed={night}
            aria-label={t(night ? 'switch.day' : 'switch.night')} title={t(night ? 'switch.day' : 'switch.night')}
            onClick={() => setSky(night ? 'morning' : 'night')}>
            <span className="pip" /><span className="pip" /><span className="pip" /><span className="orb" />
          </button>
          {user
            ? <button className="btn small light" type="button" onClick={() => signOutUser()}>{t('nav.signout')}</button>
            : <Link className="btn small light" to="/signin">{t('nav.signin')}</Link>}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useApp();
  return (
    <footer className="site-footer">
      <svg className="ridge" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0 60 L0 44 C 160 30, 260 14, 380 22 S 600 50, 760 36 S 1040 6, 1200 18 S 1380 40, 1440 34 L1440 60 Z" /></svg>
      <div className="wrap">
        <div className="grid">
          <div>
            <Logo />
            <p className="muted" style={{ maxWidth: 340, margin: '16px 0 0' }}>{t('foot.about')}</p>
          </div>
          <div>
            <h4>{t('foot.explore')}</h4>
            <ul>
              <li><a href="/#places">{t('nav.places')}</a></li>
              <li><a href="/#experiences">{t('nav.experiences')}</a></li>
              <li><a href="/#how">{t('nav.how')}</a></li>
            </ul>
          </div>
          <div>
            <h4>{t('foot.account')}</h4>
            <ul>
              <li><Link to="/book">{t('nav.book')}</Link></li>
              <li><Link to="/trips">{t('nav.trips')}</Link></li>
              <li><Link to="/signin">{t('nav.signin')}</Link></li>
              <li><Link to="/signin?mode=signup">{t('nav.signup')}</Link></li>
            </ul>
          </div>
        </div>
        <div className="base">
          <span>{t('foot.times')}</span>
          <span>{t('foot.photos')}</span>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children, overHero = false, title }: { children: ReactNode; overHero?: boolean; title: string }) {
  const { t } = useApp();
  useReveal();
  useEffect(() => { document.title = t(title); }, [t, title]);
  return (
    <>
      <Header overHero={overHero} />
      {children}
      <Footer />
    </>
  );
}

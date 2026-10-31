// Language (Arabic/English) and sky (morning/night) for the whole app.
// Both are saved in localStorage and mirrored onto <html> so the CSS can react to them.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18N, PLACES, type Lang, type Place, type PlaceText } from './content';

export type Sky = 'morning' | 'night';

interface AppState {
  lang: Lang;
  sky: Sky;
  setLang: (l: Lang) => void;
  setSky: (s: Sky) => void;
  t: (key: string) => string;
  list: (key: string) => string[];
  hours: (n: number) => string;
  place: (id: string) => Place | undefined;
  text: (p: Place) => PlaceText;
}

const Ctx = createContext<AppState | null>(null);

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: still switches */ }
}

function initialLang(): Lang {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'ar' || fromUrl === 'en') return fromUrl;
  return read('rihlatna-lang') === 'en' ? 'en' : 'ar';
}
function initialSky(): Sky {
  const saved = read('rihlatna-sky');
  if (saved === 'morning' || saved === 'night') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'morning';
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [sky, setSkyState] = useState<Sky>(initialSky);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => { document.documentElement.dataset.theme = sky; }, [sky]);

  // Scene animations only run after first paint, so the page never plays a sunset on load.
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() =>
      document.documentElement.classList.add('sky-ready')));
    return () => cancelAnimationFrame(id);
  }, []);

  const setLang = useCallback((l: Lang) => { write('rihlatna-lang', l); setLangState(l); }, []);
  const setSky = useCallback((s: Sky) => { write('rihlatna-sky', s); setSkyState(s); }, []);

  const value = useMemo<AppState>(() => {
    const dict = I18N[lang];
    const t = (key: string) => {
      const v = dict[key] ?? I18N.en[key];
      return typeof v === 'string' ? v : key;
    };
    return {
      lang, sky, setLang, setSky, t,
      list: key => (Array.isArray(dict[key]) ? dict[key] : I18N.en[key]) as string[],
      hours: n => dict.hours(n) as string,
      place: id => PLACES.find(p => p.id === id),
      text: p => p[lang],
    };
  }, [lang, sky, setLang, setSky]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}

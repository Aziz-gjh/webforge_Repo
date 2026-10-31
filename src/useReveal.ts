import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Fades in every .reveal element as it scrolls into view, including ones rendered later. */
export function useReveal() {
  const { pathname } = useLocation();
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      const showAll = () => document.querySelectorAll('.reveal:not(.in)').forEach(el => el.classList.add('in'));
      showAll();
      const mo = new MutationObserver(showAll);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    const watch = () => document.querySelectorAll('.reveal:not(.in), .timeline:not(.in)').forEach(el => io.observe(el));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [pathname]);
}

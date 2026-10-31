// Rihlatna shared behaviour: day/night, Arabic/English, header state and scroll reveals.
(function () {
  var SKY = 'rihlatna-sky';
  var LANG = 'rihlatna-lang';
  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode: the switch still works */ }
  }

  // Translate a key for the current language. Falls back to English, then to the key.
  window.t = function (key) {
    var dict = window.RIHLATNA_I18N || {};
    var lang = root.getAttribute('lang') === 'ar' ? 'ar' : 'en';
    if (dict[lang] && dict[lang][key] !== undefined) return dict[lang][key];
    if (dict.en && dict.en[key] !== undefined) return dict.en[key];
    return key;
  };
  window.currentLang = function () { return root.getAttribute('lang') === 'ar' ? 'ar' : 'en'; };

  function applySky(mode) {
    root.setAttribute('data-theme', mode);
    document.querySelectorAll('.sky-switch').forEach(function (b) {
      b.setAttribute('aria-pressed', mode === 'night' ? 'true' : 'false');
      b.setAttribute('aria-label', window.t(mode === 'night' ? 'switch.day' : 'switch.night'));
      b.title = b.getAttribute('aria-label');
    });
    document.dispatchEvent(new CustomEvent('skychange', { detail: mode }));
  }

  function applyLang(lang) {
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = window.t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', window.t(el.getAttribute('data-i18n-aria')));
    });
    document.querySelectorAll('.lang-switch').forEach(function (b) {
      b.textContent = window.t('switch.lang');
      b.setAttribute('aria-label', window.t('switch.langLabel'));
      b.setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
    });
    var titleKey = document.body && document.body.getAttribute('data-title');
    if (titleKey) document.title = window.t(titleKey);
    applySky(root.getAttribute('data-theme'));
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  var sky = read(SKY) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'morning');
  var urlLang = new URLSearchParams(window.location.search).get('lang');
  var lang = (urlLang === 'ar' || urlLang === 'en') ? urlLang : (read(LANG) || 'ar');
  root.setAttribute('data-theme', sky);
  root.setAttribute('lang', lang);
  root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

  document.addEventListener('DOMContentLoaded', function () {
    // Scroll reveals first, so content rendered on the first langchange can register.
    var io = null;
    if (!reduced && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    }
    window.observeReveal = function (el) {
      if (io) io.observe(el); else el.classList.add('in');
    };
    document.querySelectorAll('.reveal').forEach(window.observeReveal);

    applyLang(root.getAttribute('lang'));

    // Scene animations only run after first paint, so a page never "sets" on load.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.add('sky-ready'); });
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest('.sky-switch')) {
        var next = root.getAttribute('data-theme') === 'night' ? 'morning' : 'night';
        write(SKY, next);
        applySky(next);
      } else if (e.target.closest('.lang-switch')) {
        var nextLang = window.currentLang() === 'ar' ? 'en' : 'ar';
        write(LANG, nextLang);
        applyLang(nextLang);
      }
    });

    // Header: transparent over the hero, a readable surface once the page scrolls.
    var header = document.querySelector('.site-header:not([data-solid])');
    if (header) {
      var onScroll = function () { header.classList.toggle('is-solid', window.scrollY > 40); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  });

  window.prefersReducedMotion = reduced;
})();

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { useApp } from '../i18n';
import { signInWithGoogle, useAuth } from '../lib/auth';

// Only same-site paths, so ?next= cannot send people to another website.
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/trips');

export default function SignIn() {
  const { t } = useApp();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const next = safeNext(params.get('next'));
  const signup = params.get('mode') === 'signup';

  // A brand-new account sees the welcome card first; everyone else goes straight on.
  useEffect(() => { if (user && !welcome && !pending) navigate(next, { replace: true }); }, [user, welcome, pending, next, navigate]);

  async function go() {
    setPending(true);
    setFailed(false);
    try { setWelcome((await signInWithGoogle()).created); } catch { setFailed(true); } finally { setPending(false); }
  }

  function switchMode() {
    const p = new URLSearchParams(params);
    if (signup) p.delete('mode'); else p.set('mode', 'signup');
    setParams(p, { replace: true });
    setFailed(false);
  }

  if (welcome && user) {
    return (
      <Page title="title.home">
        <main className="signin-page">
          <div className="signin-card">
            <h1 className="display">{t('signup.doneTitle')}</h1>
            <p>{t('signup.doneBody')} <strong>{user.email}</strong></p>
            <button className="btn" type="button" onClick={() => navigate(next, { replace: true })}>{t('signup.continue')}</button>
          </div>
        </main>
      </Page>
    );
  }

  return (
    <Page title="title.home">
      <main className="signin-page">
        <div className="signin-card">
          <h1 className="display">{t(signup ? 'signup.title' : 'signin.title')}</h1>
          <p>{t(signup ? 'signup.body' : 'signin.body')}</p>
          {failed && <p className="form-error" role="alert">{t('signin.failed')}</p>}
          <button className="btn" type="button" disabled={pending} onClick={go}>
            {pending ? t('state.loading') : t(signup ? 'signup.google' : 'signin.google')}
          </button>
          <p className="signin-switch">
            {t(signup ? 'signup.haveAccount' : 'signin.noAccount')}{' '}
            <button className="link-btn" type="button" onClick={switchMode}>{t(signup ? 'nav.signin' : 'nav.signup')}</button>
          </p>
        </div>
      </main>
    </Page>
  );
}

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
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const next = safeNext(params.get('next'));

  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, next, navigate]);

  async function go() {
    setPending(true);
    setFailed(false);
    try { await signInWithGoogle(); } catch { setFailed(true); } finally { setPending(false); }
  }

  return (
    <Page title="title.home">
      <main className="signin-page">
        <div className="signin-card">
          <h1 className="display">{t('signin.title')}</h1>
          <p>{t('signin.body')}</p>
          {failed && <p className="form-error" role="alert">{t('signin.failed')}</p>}
          <button className="btn" type="button" disabled={pending} onClick={go}>{pending ? t('state.loading') : t('signin.google')}</button>
        </div>
      </main>
    </Page>
  );
}

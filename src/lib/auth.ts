import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

type AuthUser = { uid: string; name: string; email: string };

const toAuthUser = (u: User): AuthUser =>
  ({ uid: u.uid, name: u.displayName ?? u.email ?? '', email: u.email ?? '' });

// Popup, not redirect: redirect sign-in breaks in browsers that block third-party storage.
// The account is the users/{uid} record: created (with createdAt) the first time, refreshed after.
export async function signInWithGoogle(): Promise<{ created: boolean }> {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  const { name, email } = toAuthUser(user);
  const ref = doc(db, 'users', user.uid);
  const created = !(await getDoc(ref)).exists();
  await setDoc(ref, created ? { name, email, createdAt: serverTimestamp() } : { name, email }, { merge: true });
  return { created };
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}

export function useAuth(): { user: AuthUser | null; loading: boolean } {
  const [state, setState] = useState<{ user: AuthUser | null; loading: boolean }>(() =>
    ({ user: auth.currentUser && toAuthUser(auth.currentUser), loading: !auth.currentUser }));
  useEffect(() => onAuthStateChanged(auth, u => setState({ user: u && toAuthUser(u), loading: false })), []);
  return state;
}

// Cosmetic only (shows the Provider link). The security rules do the real check.
export function useIsProvider(): { isProvider: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<{ uid: string; isProvider: boolean } | null>(null);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    let live = true;
    getDoc(doc(db, 'providers', uid))
      .then(snap => live && setState({ uid, isProvider: snap.exists() }))
      .catch(() => live && setState({ uid, isProvider: false }));
    return () => { live = false };
  }, [uid]);

  if (authLoading) return { isProvider: false, loading: true };
  if (!user) return { isProvider: false, loading: false };
  if (state?.uid !== user.uid) return { isProvider: false, loading: true };
  return { isProvider: state.isProvider, loading: false };
}

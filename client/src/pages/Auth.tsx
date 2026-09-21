import { useState } from 'react';
import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ErrorMessage } from '../components/Buttons';
export default function Auth() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const register = params.get('mode') === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (auth.session) return <Navigate to="/history" replace />;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = register
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin + '/login' },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (register && !result.data.session)
        setNotice('Check your email to confirm your account, then sign in.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page panel">
      <div className="eyebrow">YOUR PERSONAL VOICE LIBRARY</div>
      <h1>{register ? 'Create your account.' : 'Welcome back.'}</h1>
      <p>Keep your speech, save favorites, and pick up where you left off.</p>
      {!auth.configured ? (
        <div className="provider-notice">
          Account services are not configured. Follow the Supabase setup in the project README to
          enable accounts.
        </div>
      ) : (
        <form onSubmit={submit}>
          <label className="field">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Password
            <input
              required
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete={register ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <ErrorMessage message={error} />
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          <button className="primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
          </button>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to LabMentix?'}{' '}
            <Link
              to={register ? '/login' : '/login?mode=register'}
              onClick={() => {
                setError('');
                setNotice('');
              }}
            >
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </form>
      )}
      <Link className="text-button" to="/">
        Back to speech studio
      </Link>
    </div>
  );
}

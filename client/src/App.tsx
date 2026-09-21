import { Waveform } from '@phosphor-icons/react';
import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import Studio from './pages/Studio';
import Auth from './pages/Auth';
import History from './pages/History';
import Admin from './pages/Admin';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorMessage } from './components/Buttons';
function Shell() {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/">
            <span className="brand-mark">
              <Waveform size={24} weight="bold" />
            </span>
            LabMentix
            <span className="brand-divider" /> <span className="brand-product">Voice</span>
          </Link>
          <nav aria-label="Main navigation">
            <NavLink end className={({ isActive }) => (isActive ? 'nav-active' : '')} to="/">
              Speech studio
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'nav-active' : '')} to="/history">
              History
            </NavLink>
            {auth.admin && (
              <NavLink className={({ isActive }) => (isActive ? 'nav-active' : '')} to="/admin">
                Admin
              </NavLink>
            )}
          </nav>
          {auth.configured ? (
            <div className="account-nav">
              {auth.session ? (
                <button
                  className="subtle"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await auth.signOut();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Unable to sign out.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Signing out…' : 'Sign out'}
                </button>
              ) : (
                <Link className="sign-in" to="/login">
                  Sign in
                </Link>
              )}
            </div>
          ) : (
            <span className="header-caption">A little text. A lot of possibility.</span>
          )}
        </div>
      </header>
      <main id="main" className="main-container">
        <ErrorMessage message={error} />
        <Routes>
          <Route path="/" element={<Studio />} />
          <Route path="/login" element={<Auth />} />
          <Route
            path="/history"
            element={
              auth.configured ? (
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              ) : (
                <History />
              )
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute admin>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <div className="empty-state">
                <h1>Page not found.</h1>
                <Link className="primary" to="/">
                  Back to studio
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer>
        <span>LabMentix Voice</span>
        <span>Made for words that deserve to be heard.</span>
      </footer>
    </>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}

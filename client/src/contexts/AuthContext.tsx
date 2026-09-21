import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { api, setAccessToken, type Capabilities } from '../services/api';
type Auth = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  admin: boolean;
  capabilities: Capabilities | null;
  signOut: () => Promise<void>;
};
const Context = createContext<Auth>({
  session: null,
  loading: true,
  configured: false,
  admin: false,
  capabilities: null,
  signOut: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  useEffect(() => {
    let active = true;
    api<Capabilities>('/config')
      .then((c) => {
        if (active) setCapabilities(c);
      })
      .catch(() => {});
    if (!supabase) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    const apply = (s: Session | null) => {
      setAccessToken(s?.access_token);
      setSession(s);
      setLoading(false);
    };
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) apply(error ? null : data.session);
      })
      .catch(() => {
        if (active) apply(null);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active) apply(s);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setAdmin(false);
    if (session)
      api<{ profile: { role: string } }>('/me')
        .then((r) => {
          if (active) setAdmin(r.profile.role === 'admin');
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [session]);
  async function signOut() {
    const { error } = await supabase!.auth.signOut();
    if (error) throw Error(error.message);
    setAccessToken();
    setSession(null);
    setAdmin(false);
  }
  return (
    <Context.Provider
      value={{
        session,
        loading,
        configured: !!supabase && !!capabilities?.auth,
        admin,
        capabilities,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);

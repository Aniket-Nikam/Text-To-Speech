import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
export function ProtectedRoute({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const auth = useAuth();
  if (auth.loading) return <p role="status">Checking your session…</p>;
  if (!auth.session) return <Navigate to="/login" replace />;
  if (admin && !auth.admin) return <p role="alert">Administrator access is required.</p>;
  return children;
}

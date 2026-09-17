import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Caricamento…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
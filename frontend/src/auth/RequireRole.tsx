import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/api/types';
import { PageLoader } from '@/components/ui/Feedback';
import { UnauthorizedPage } from '@/pages/public/StatusPages';
import { PORTAL_LOGIN, useAuth } from './AuthProvider';

/**
 * Client-side route guard. It only shapes navigation; every API endpoint enforces the
 * same role on the server, so a hand-typed URL never exposes data.
 */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${PORTAL_LOGIN[role]}?next=${next}`} replace />;
  }
  if (user.role !== role) return <UnauthorizedPage expectedRole={role} />;
  return <>{children}</>;
}

import { Compass, ShieldAlert } from 'lucide-react';
import type { Role } from '@/api/types';
import { PORTAL_HOME, PORTAL_LOGIN, useAuth } from '@/auth/AuthProvider';
import { ButtonLink } from '@/components/ui/Button';
import { PageMeta } from '@/lib/seo';

function StatusShell({ icon, code, title, children }: { icon: React.ReactNode; code: string; title: string; children: React.ReactNode }) {
  return (
    <div className="page-container grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100 text-forest-700">{icon}</div>
        <p className="eyebrow mt-6">{code}</p>
        <h1 className="mt-2 text-4xl">{title}</h1>
        <div className="mt-4 text-charcoal-600">{children}</div>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <StatusShell icon={<Compass className="h-6 w-6" aria-hidden="true" />} code="404" title="This field is empty">
      <PageMeta title="Page not found" noindex />
      <p>We couldn&apos;t find the page you were looking for. It may have moved, or the listing may no longer be available.</p>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink to="/products">Browse the market</ButtonLink>
        <ButtonLink to="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </StatusShell>
  );
}

const ROLE_NAMES: Record<Role, string> = { CONSUMER: 'shopper', PRODUCER: 'producer', ADMIN: 'administrator' };

export function UnauthorizedPage({ expectedRole }: { expectedRole: Role }) {
  const { user } = useAuth();
  return (
    <StatusShell icon={<ShieldAlert className="h-6 w-6" aria-hidden="true" />} code="403" title="This area isn't for your account">
      <PageMeta title="Not available" noindex />
      <p>
        This page is for {ROLE_NAMES[expectedRole]} accounts. You&apos;re signed in as a {user ? ROLE_NAMES[user.role] : 'guest'}.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {user ? <ButtonLink to={PORTAL_HOME[user.role]}>Go to your dashboard</ButtonLink> : null}
        <ButtonLink to={PORTAL_LOGIN[expectedRole]} variant="secondary">
          Sign in with a different account
        </ButtonLink>
      </div>
    </StatusShell>
  );
}

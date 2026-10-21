import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { toApiError } from '@/api/errors';
import type { Role } from '@/api/types';
import { PORTAL_HOME, PORTAL_LOGIN, useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Field';
import { PageMeta } from '@/lib/seo';
import { AuthShell, safeNext, type Portal } from './AuthShell';

const schema = z.object({
  email: z.string().trim().email('Enter the email you registered with.'),
  password: z.string().min(1, 'Enter your password.'),
});
type Values = z.infer<typeof schema>;

const PORTAL_ROLE: Record<Portal, Role> = { consumer: 'CONSUMER', producer: 'PRODUCER', admin: 'ADMIN' };
const PORTAL_NAMES: Record<Role, string> = { CONSUMER: 'shopper', PRODUCER: 'producer', ADMIN: 'admin' };

interface Problem {
  code: string;
  message: string;
  portal?: Role;
}

export default function LoginPage({ portal }: { portal: Portal }) {
  const role = PORTAL_ROLE[portal];
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [problem, setProblem] = useState<Problem | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: params.get('email') ?? '', password: '' } });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setProblem(null);
    try {
      await login(email, password, role);
      navigate(safeNext(params.get('next'), PORTAL_HOME[role]), { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      setProblem({ code: apiError.code, message: apiError.message, portal: apiError.errors.portal as Role | undefined });
    }
  });

  const titles: Record<Portal, string> = { consumer: 'Welcome back', producer: 'Sign in to your farm', admin: 'Administrator sign in' };

  return (
    <AuthShell
      portal={portal}
      title={titles[portal]}
      subtitle={
        portal === 'admin' ? undefined : portal === 'producer' ? (
          <>
            New to Farm2Home?{' '}
            <Link to="/producer/register" className="font-medium text-forest-700 underline-offset-2 hover:underline">
              Register your farm
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link to="/consumer/register" className="font-medium text-forest-700 underline-offset-2 hover:underline">
              Create an account
            </Link>
          </>
        )
      }
    >
      <PageMeta title={titles[portal]} noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {!problem && params.get('verified') ? <Alert tone="success">Email verified. Sign in to continue.</Alert> : null}
        {!problem && params.get('reset') ? <Alert tone="success">Password updated. Sign in with your new password.</Alert> : null}
        {problem ? (
          <Alert tone="error">
            {problem.message}
            {problem.code === 'email_not_verified' ? (
              <>
                {' '}
                <Link to={`/verify-email?email=${encodeURIComponent(getValues('email'))}&role=${role}`} className="font-medium underline">
                  Verify your email
                </Link>
              </>
            ) : null}
            {problem.code === 'wrong_portal' && problem.portal ? (
              <>
                {' '}
                <Link to={`${PORTAL_LOGIN[problem.portal]}?email=${encodeURIComponent(getValues('email'))}`} className="font-medium underline">
                  Go to the {PORTAL_NAMES[problem.portal]} sign-in
                </Link>
              </>
            ) : null}
          </Alert>
        ) : null}
        <TextField label="Email" type="email" autoComplete="email" autoFocus error={errors.email?.message} {...register('email')} />
        <TextField label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="flex items-center justify-between gap-4">
          <Button type="submit" loading={isSubmitting} className={portal === 'admin' ? 'w-full bg-charcoal-900 hover:bg-charcoal-800' : ''}>
            Sign in
          </Button>
          {portal !== 'admin' ? (
            <Link to={`/forgot-password?role=${role}`} className="text-sm text-charcoal-600 underline-offset-2 hover:underline">
              Forgot password?
            </Link>
          ) : null}
        </div>
      </form>
    </AuthShell>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { api, ensureCsrfCookie } from '@/api/client';
import { applyFieldErrors, errorMessage } from '@/api/errors';
import type { Role } from '@/api/types';
import { PORTAL_LOGIN } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Field';
import { PageMeta } from '@/lib/seo';
import { AuthShell, type Portal } from './AuthShell';
import { PASSWORD_HINT, passwordSchema } from './passwordRules';

function usePortal(): { role: Role; portal: Portal } {
  const [params] = useSearchParams();
  const role = (['CONSUMER', 'PRODUCER', 'ADMIN'].includes(params.get('role') ?? '') ? params.get('role') : 'CONSUMER') as Role;
  return { role, portal: role === 'PRODUCER' ? 'producer' : role === 'ADMIN' ? 'admin' : 'consumer' };
}

const codeSchema = z.string().trim().regex(/^[0-9]{6}$/, 'Enter the 6-digit code from the email.');

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { role, portal } = usePortal();
  const navigate = useNavigate();
  const [resent, setResent] = useState<string | null>(null);
  const schema = z.object({ email: z.string().trim().email('Enter your email.'), code: codeSchema });
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: params.get('email') ?? '', code: '' } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await ensureCsrfCookie();
      await api.post('/auth/verify-email/', values);
      navigate(`${PORTAL_LOGIN[role]}?email=${encodeURIComponent(values.email)}&verified=1`);
    } catch (error) {
      const message = applyFieldErrors(error, setError, ['email', 'code']);
      if (message) setError('code', { message });
    }
  });

  async function resend() {
    setResent(null);
    try {
      await ensureCsrfCookie();
      const { data } = await api.post('/auth/verify-email/resend/', { email: getValues('email') });
      setResent(data.detail);
    } catch (error) {
      setResent(errorMessage(error));
    }
  }

  return (
    <AuthShell portal={portal} title="Check your email" subtitle="We sent a 6-digit code to confirm your address. It expires in 15 minutes.">
      <PageMeta title="Verify your email" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {params.get('new') ? (
          <Alert tone="success">
            Account created.{role === 'PRODUCER' ? ' After you verify your email, our team will review your farm.' : ''}
          </Alert>
        ) : null}
        {resent ? <Alert>{resent}</Alert> : null}
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField label="Verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} error={errors.code?.message} {...register('code')} />
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" loading={isSubmitting}>
            Verify email
          </Button>
          <button type="button" onClick={resend} className="text-sm text-charcoal-600 underline-offset-2 hover:underline">
            Send a new code
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { role, portal } = usePortal();
  const navigate = useNavigate();
  const schema = z.object({ email: z.string().trim().email('Enter the email for your account.') });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await ensureCsrfCookie();
      await api.post('/auth/password/forgot/', { email });
      navigate(`/reset-password?email=${encodeURIComponent(email)}&role=${role}`);
    } catch (error) {
      setError('email', { message: errorMessage(error) });
    }
  });

  return (
    <AuthShell portal={portal} title="Reset your password" subtitle="Enter your email and we'll send you a code to choose a new password.">
      <PageMeta title="Reset your password" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <div className="flex items-center gap-4">
          <Button type="submit" loading={isSubmitting}>
            Send code
          </Button>
          <Link to={PORTAL_LOGIN[role]} className="text-sm text-charcoal-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const { role, portal } = usePortal();
  const navigate = useNavigate();
  const schema = z
    .object({ email: z.string().trim().email('Enter your email.'), code: codeSchema, new_password: passwordSchema, confirm_password: z.string() })
    .refine((values) => values.new_password === values.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match.' });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: params.get('email') ?? '' } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await ensureCsrfCookie();
      await api.post('/auth/password/reset/', values);
      navigate(`${PORTAL_LOGIN[role]}?email=${encodeURIComponent(values.email)}&reset=1`);
    } catch (error) {
      const message = applyFieldErrors(error, setError, ['email', 'code', 'new_password', 'confirm_password']);
      if (message) setError('root', { message });
    }
  });

  return (
    <AuthShell portal={portal} title="Choose a new password" subtitle="If an account exists for that email, we've sent it a 6-digit code.">
      <PageMeta title="Choose a new password" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {errors.root?.message ? <Alert tone="error">{errors.root.message}</Alert> : null}
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} error={errors.code?.message} {...register('code')} />
        <TextField label="New password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} error={errors.new_password?.message} {...register('new_password')} />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm_password?.message} {...register('confirm_password')} />
        <Button type="submit" loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

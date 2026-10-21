import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '@/api/client';
import { applyFieldErrors } from '@/api/errors';
import type { Session, User } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PASSWORD_HINT, passwordSchema, phoneSchema } from '@/pages/auth/passwordRules';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Alert } from '../ui/Feedback';
import { TextField } from '../ui/Field';
import { useToast } from '../ui/Toaster';

const profileSchema = z.object({ full_name: z.string().trim().min(2, 'Enter your full name.').max(150), phone_number: phoneSchema });
const passwordForm = z
  .object({ current_password: z.string().min(1, 'Enter your current password.'), new_password: passwordSchema, confirm_password: z.string() })
  .refine((values) => values.new_password === values.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match.' });

function ProfileCard() {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.full_name ?? '', phone_number: user?.phone_number ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { data } = await api.patch<User>('/auth/me/', values);
      await refreshUser();
      reset({ full_name: data.full_name, phone_number: data.phone_number });
      notify('Profile updated.');
    } catch (error) {
      const message = applyFieldErrors(error, setError, ['full_name', 'phone_number']);
      if (message) setError('root', { message });
    }
  });

  return (
    <Card>
      <CardHeader title="Your details" description="Your email address is your sign-in and can't be changed here." />
      <form onSubmit={onSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        {errors.root?.message ? <Alert tone="error">{errors.root.message}</Alert> : null}
        <TextField label="Email" value={user?.email ?? ''} disabled readOnly />
        <TextField label="Full name" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
        <TextField label="Phone" type="tel" autoComplete="tel" optional={user?.role === 'CONSUMER'} error={errors.phone_number?.message} {...register('phone_number')} />
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { applySession } = useAuth();
  const notify = useToast();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof passwordForm>>({ resolver: zodResolver(passwordForm) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { data } = await api.post<Session>('/auth/password/change/', values);
      applySession(data);
      reset({ current_password: '', new_password: '', confirm_password: '' });
      notify('Password changed. Other devices have been signed out.');
    } catch (error) {
      const message = applyFieldErrors(error, setError, ['current_password', 'new_password', 'confirm_password']);
      if (message) setError('root', { message });
    }
  });

  return (
    <Card>
      <CardHeader title="Password" description="Changing your password signs you out everywhere else." />
      <form onSubmit={onSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        {errors.root?.message ? <Alert tone="error">{errors.root.message}</Alert> : null}
        <TextField label="Current password" type="password" autoComplete="current-password" error={errors.current_password?.message} {...register('current_password')} />
        <TextField label="New password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} error={errors.new_password?.message} {...register('new_password')} />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm_password?.message} {...register('confirm_password')} />
        <Button type="submit" loading={isSubmitting}>
          Change password
        </Button>
      </form>
    </Card>
  );
}

export function AccountSettings() {
  return (
    <div className="grid max-w-2xl gap-6">
      <ProfileCard />
      <PasswordCard />
    </div>
  );
}

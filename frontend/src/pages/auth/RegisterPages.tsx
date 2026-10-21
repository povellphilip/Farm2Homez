import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api, ensureCsrfCookie } from '@/api/client';
import { applyFieldErrors } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { TextArea, TextField } from '@/components/ui/Field';
import { PageMeta } from '@/lib/seo';
import { AuthShell } from './AuthShell';
import { PASSWORD_HINT, passwordSchema, phoneSchema } from './passwordRules';

const account = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name.').max(150),
  email: z.string().trim().email('Enter a valid email address.'),
  password: passwordSchema,
  confirm_password: z.string(),
});

const consumerSchema = account
  .extend({ phone_number: phoneSchema })
  .refine((values) => values.password === values.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match.' });

const producerSchema = account
  .extend({
    phone_number: phoneSchema.refine((value) => value !== '', 'A phone number is required for producers.'),
    farm_name: z.string().trim().min(2, 'Enter your farm or business name.').max(150),
    description: z.string().trim().min(20, 'Tell customers a little about your farm (at least 20 characters).').max(4000),
    address_line1: z.string().trim().min(3, 'Enter the farm address.').max(200),
    address_line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(2, 'Enter the town or village.').max(100),
    district: z.string().trim().max(100).optional(),
    state: z.string().trim().min(2, 'Enter the state.').max(100),
    postal_code: z.string().trim().regex(/^[0-9]{4,10}$/, 'Enter a valid PIN code.'),
    registration_number: z.string().trim().max(80).optional(),
    verification_details: z.string().trim().max(4000).optional(),
  })
  .refine((values) => values.password === values.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match.' });

type ConsumerValues = z.infer<typeof consumerSchema>;
type ProducerValues = z.infer<typeof producerSchema>;

export function ConsumerRegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConsumerValues>({ resolver: zodResolver(consumerSchema), defaultValues: { phone_number: '' } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await ensureCsrfCookie();
      await api.post('/auth/consumer/register/', values);
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}&role=CONSUMER&new=1`);
    } catch (error) {
      const message = applyFieldErrors(error, setError, Object.keys(consumerSchema.innerType().shape));
      if (message) setError('root', { message });
    }
  });

  return (
    <AuthShell
      portal="consumer"
      title="Create your account"
      subtitle={
        <>
          Already have one?{' '}
          <Link to="/consumer/login" className="font-medium text-forest-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <PageMeta title="Create a shopper account" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {errors.root?.message ? <Alert tone="error">{errors.root.message}</Alert> : null}
        <TextField label="Full name" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField label="Phone" type="tel" autoComplete="tel" optional hint="Used by farms only for delivery." error={errors.phone_number?.message} {...register('phone_number')} />
        <TextField label="Password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} error={errors.password?.message} {...register('password')} />
        <TextField label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm_password?.message} {...register('confirm_password')} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Create account
        </Button>
        <p className="text-xs leading-5 text-charcoal-500">
          By creating an account you agree to our <Link to="/terms" className="underline">terms</Link> and{' '}
          <Link to="/privacy" className="underline">privacy policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}

const PRODUCER_FIELDS = Object.keys(producerSchema.innerType().shape);

export function ProducerRegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProducerValues>({ resolver: zodResolver(producerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await ensureCsrfCookie();
      await api.post('/auth/producer/register/', values);
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}&role=PRODUCER&new=1`);
    } catch (error) {
      const message = applyFieldErrors(error, setError, PRODUCER_FIELDS);
      if (message) setError('root', { message });
    }
  });

  return (
    <AuthShell
      portal="producer"
      wide
      title="Register your farm"
      subtitle={
        <>
          Our team reviews every farm before listings go live, usually within two working days. Already registered?{' '}
          <Link to="/producer/login" className="font-medium text-forest-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <PageMeta title="Register your farm" description="Sell your produce directly to customers across India on Farm2Home." />
      <form onSubmit={onSubmit} noValidate className="space-y-10">
        {errors.root?.message ? <Alert tone="error">{errors.root.message}</Alert> : null}
        <fieldset className="space-y-5">
          <legend className="font-display text-xl text-charcoal-900">About you</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Full name" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
            <TextField label="Phone" type="tel" autoComplete="tel" error={errors.phone_number?.message} {...register('phone_number')} />
            <TextField label="Email" type="email" autoComplete="email" className="sm:col-span-2" error={errors.email?.message} {...register('email')} />
            <TextField label="Password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} error={errors.password?.message} {...register('password')} />
            <TextField label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm_password?.message} {...register('confirm_password')} />
          </div>
        </fieldset>
        <fieldset className="space-y-5">
          <legend className="font-display text-xl text-charcoal-900">Your farm</legend>
          <TextField label="Farm or business name" error={errors.farm_name?.message} {...register('farm_name')} />
          <TextArea
            label="Describe your farm"
            rows={4}
            hint="What you grow, how you grow it, and anything customers should know. Shown on your public farm page."
            error={errors.description?.message}
            {...register('description')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Address" autoComplete="address-line1" className="sm:col-span-2" error={errors.address_line1?.message} {...register('address_line1')} />
            <TextField label="Address line 2" autoComplete="address-line2" optional className="sm:col-span-2" {...register('address_line2')} />
            <TextField label="Town or village" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
            <TextField label="District" optional {...register('district')} />
            <TextField label="State" autoComplete="address-level1" error={errors.state?.message} {...register('state')} />
            <TextField label="PIN code" inputMode="numeric" autoComplete="postal-code" error={errors.postal_code?.message} {...register('postal_code')} />
          </div>
        </fieldset>
        <fieldset className="space-y-5">
          <legend className="font-display text-xl text-charcoal-900">Verification</legend>
          <p className="text-sm text-charcoal-600">Anything that helps us confirm your farm speeds up approval. These details are only seen by our team.</p>
          <TextField label="Registration number" optional hint="FSSAI, business or farmer registration number, if you have one." {...register('registration_number')} />
          <TextArea label="Anything else we should know" optional rows={3} hint="E.g. co-operative membership, organic certification, or a reference." {...register('verification_details')} />
        </fieldset>
        <Button type="submit" size="lg" loading={isSubmitting}>
          Submit registration
        </Button>
      </form>
    </AuthShell>
  );
}

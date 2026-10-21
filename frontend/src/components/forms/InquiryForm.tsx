import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { applyFieldErrors } from '@/api/errors';
import { useSendInquiry } from '@/api/queries/catalog';
import { useAuth } from '@/auth/AuthProvider';
import { Alert } from '../ui/Feedback';
import { Button } from '../ui/Button';
import { TextArea, TextField } from '../ui/Field';

const schema = z.object({
  name: z.string().trim().max(150),
  email: z.string().trim().max(254),
  phone: z.string().trim().max(20).optional(),
  subject: z.string().trim().min(3, 'Add a short subject.').max(200),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters).').max(5000),
});
type Values = z.infer<typeof schema>;

interface InquiryFormProps {
  producerSlug?: string;
  productSlug?: string;
  defaultSubject?: string;
  onSent?: () => void;
  submitLabel?: string;
}

export function InquiryForm({ producerSlug, productSlug, defaultSubject = '', onSent, submitLabel = 'Send message' }: InquiryFormProps) {
  const { user } = useAuth();
  const send = useSendInquiry();
  const signedIn = Boolean(user);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(
      signedIn
        ? schema
        : schema.extend({
            name: z.string().trim().min(2, 'Enter your name.').max(150),
            email: z.string().trim().email('Enter a valid email so the farm can reply.'),
          }),
    ),
    defaultValues: { name: '', email: '', phone: '', subject: defaultSubject, message: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await send.mutateAsync({ ...values, producer_slug: producerSlug, product_slug: productSlug });
      reset({ name: '', email: '', phone: '', subject: defaultSubject, message: '' });
      onSent?.();
    } catch (error) {
      const message = applyFieldErrors(error, setError, ['name', 'email', 'phone', 'subject', 'message']);
      if (message) setError('root', { message });
    }
  });

  if (send.isSuccess && !onSent) {
    return (
      <Alert tone="success" title="Message sent">
        We&apos;ve emailed you a copy. Replies arrive by email{signedIn ? ' and in your account' : ''}.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.message ? <Alert tone="error">{errors.root.message}</Alert> : null}
      {signedIn ? (
        <p className="text-sm text-charcoal-500">
          Sending as <span className="font-medium text-charcoal-800">{user?.full_name}</span> ({user?.email}).
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Your name" autoComplete="name" error={errors.name?.message} {...register('name')} />
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <TextField label="Phone" type="tel" autoComplete="tel" optional className="sm:col-span-2" error={errors.phone?.message} {...register('phone')} />
        </div>
      )}
      <TextField label="Subject" error={errors.subject?.message} {...register('subject')} />
      <TextArea label="Message" rows={5} error={errors.message?.message} {...register('message')} />
      <Button type="submit" loading={send.isPending}>
        {submitLabel}
      </Button>
    </form>
  );
}

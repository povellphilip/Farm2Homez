import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import { phoneSchema } from '@/pages/auth/passwordRules';
import { TextField } from '../ui/Field';

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  recipient_name: z.string().trim().min(2, 'Enter the name for delivery.').max(150),
  phone_number: phoneSchema.refine((value) => value !== '', 'A phone number is needed for delivery.'),
  line1: z.string().trim().min(3, 'Enter the street address.').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, 'Enter the city or town.').max(100),
  district: z.string().trim().max(100).optional(),
  state: z.string().trim().min(2, 'Enter the state.').max(100),
  postal_code: z.string().trim().regex(/^[0-9]{4,10}$/, 'Enter a valid PIN code.'),
});
export type AddressValues = z.infer<typeof addressSchema>;
export const ADDRESS_FIELDS = Object.keys(addressSchema.shape);

export function AddressFields({
  register,
  errors,
  showLabel = false,
}: {
  register: UseFormRegister<AddressValues>;
  errors: FieldErrors<AddressValues>;
  showLabel?: boolean;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {showLabel ? <TextField label="Label" optional placeholder="Home, Office…" className="sm:col-span-2" {...register('label')} /> : null}
      <TextField label="Full name" autoComplete="name" error={errors.recipient_name?.message} {...register('recipient_name')} />
      <TextField label="Phone" type="tel" autoComplete="tel" error={errors.phone_number?.message} {...register('phone_number')} />
      <TextField label="Address" autoComplete="address-line1" className="sm:col-span-2" error={errors.line1?.message} {...register('line1')} />
      <TextField label="Apartment, landmark" optional autoComplete="address-line2" className="sm:col-span-2" {...register('line2')} />
      <TextField label="City or town" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
      <TextField label="District" optional {...register('district')} />
      <TextField label="State" autoComplete="address-level1" error={errors.state?.message} {...register('state')} />
      <TextField label="PIN code" inputMode="numeric" autoComplete="postal-code" error={errors.postal_code?.message} {...register('postal_code')} />
    </div>
  );
}

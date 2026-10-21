import { z } from 'zod';

/** Mirrors the server's password validators so most problems are caught before submitting. */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128)
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  .refine((value) => value === '' || /^\+?[0-9]{8,15}$/.test(value), 'Enter a valid phone number, e.g. +91 98765 43210.');

export const PASSWORD_HINT = 'At least 10 characters, with a letter and a number.';

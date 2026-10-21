import { isAxiosError } from 'axios';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

export interface ApiErrorBody {
  code: string;
  message: string;
  errors: Record<string, unknown>;
  retry_after?: number;
}

export class ApiError extends Error {
  status: number;
  code: string;
  errors: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.errors = body.errors ?? {};
  }
}

const NETWORK_MESSAGE = 'We could not reach Farm2Home. Check your connection and try again.';

/** Normalise anything thrown by the API client into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiErrorBody> | undefined;
    if (error.response && body && typeof body.message === 'string') {
      return new ApiError(error.response.status, { code: body.code ?? 'error', message: body.message, errors: body.errors ?? {} });
    }
    if (error.response) {
      return new ApiError(error.response.status, { code: 'error', message: 'Something went wrong on our side. Please try again.', errors: {} });
    }
  }
  return new ApiError(0, { code: 'network_error', message: NETWORK_MESSAGE, errors: {} });
}

export function errorMessage(error: unknown): string {
  return toApiError(error).message;
}

function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length) return firstMessage(value[0]);
  return null;
}

/**
 * Copy field errors from an API validation response onto a react-hook-form form.
 * Returns the message for errors that do not belong to a visible field.
 */
export function applyFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly string[]): string | null {
  const apiError = toApiError(error);
  let unmatched = false;
  for (const [field, value] of Object.entries(apiError.errors)) {
    const message = firstMessage(value);
    if (message && fields.includes(field)) {
      setError(field as Path<T>, { type: 'server', message });
    } else {
      unmatched = true;
    }
  }
  const hasFieldErrors = Object.keys(apiError.errors).some((field) => fields.includes(field));
  return unmatched || !hasFieldErrors ? apiError.message : null;
}

import type { FulfillmentStatus, ModerationStatus, OrderStatus, ProductStatus, Unit, VerificationStatus } from '@/api/types';

const wholeRupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rupeesAndPaise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Format a decimal string from the API. Values stay strings until display to avoid float drift. */
export function money(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  // Whole rupees read cleanly as ₹320; anything with paise always shows two digits (₹48.50, never ₹48.5).
  return (Number.isInteger(amount) ? wholeRupees : rupeesAndPaise).format(amount);
}

export function date(value: string | null | undefined) {
  return value ? dateFormat.format(new Date(value)) : '—';
}

export function dateTime(value: string | null | undefined) {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

export const UNIT_LABELS: Record<Unit, string> = {
  kg: 'kg',
  g: 'g',
  litre: 'litre',
  ml: 'ml',
  dozen: 'dozen',
  piece: 'piece',
  bunch: 'bunch',
  pack: 'pack',
  box: 'box',
};

export function perUnit(unit: Unit) {
  return `per ${UNIT_LABELS[unit]}`;
}

export function plural(count: number, word: string, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

export const FULFILMENT_LABELS: Record<FulfillmentStatus, string> = {
  PENDING: 'Awaiting farm',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Being prepared',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  REJECTED: 'Declined by farm',
  CANCELLED: 'Cancelled',
};

export const ORDER_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Placed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  UNPUBLISHED: 'Unpublished',
};

export const MODERATION_LABELS: Record<ModerationStatus, string> = {
  PENDING: 'In review',
  APPROVED: 'Approved',
  REJECTED: 'Needs changes',
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  PENDING: 'Pending review',
  VERIFIED: 'Verified',
  REJECTED: 'Needs more information',
};

/** Actions a producer sees for moving an order forward, in display order. */
export const TRANSITION_ACTIONS: Partial<Record<FulfillmentStatus, string>> = {
  CONFIRMED: 'Accept order',
  PROCESSING: 'Mark as preparing',
  SHIPPED: 'Mark as shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Mark as delivered',
  REJECTED: 'Decline order',
  CANCELLED: 'Cancel order',
};

export function idempotencyKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

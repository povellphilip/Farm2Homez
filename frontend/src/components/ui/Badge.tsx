import type { ReactNode } from 'react';
import type { FulfillmentStatus, InquiryStatus, ModerationStatus, OrderStatus, ProductStatus, VerificationStatus } from '@/api/types';
import { cn } from '@/lib/cn';
import { FULFILMENT_LABELS, MODERATION_LABELS, ORDER_LABELS, PRODUCT_STATUS_LABELS, VERIFICATION_LABELS } from '@/lib/format';

export type BadgeTone = 'neutral' | 'green' | 'sage' | 'amber' | 'red';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-ivory-200 text-charcoal-700',
  green: 'bg-forest-100 text-forest-800',
  sage: 'bg-sage-100 text-charcoal-700',
  amber: 'bg-[#F7E7C6] text-[#6B4A0E]',
  red: 'bg-terracotta-100 text-terracotta-700',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

const FULFILMENT_TONES: Record<FulfillmentStatus, BadgeTone> = {
  PENDING: 'amber',
  CONFIRMED: 'sage',
  PROCESSING: 'sage',
  SHIPPED: 'sage',
  OUT_FOR_DELIVERY: 'sage',
  DELIVERED: 'green',
  REJECTED: 'red',
  CANCELLED: 'neutral',
};

const ORDER_TONES: Record<OrderStatus, BadgeTone> = { PENDING: 'amber', IN_PROGRESS: 'sage', COMPLETED: 'green', CANCELLED: 'neutral' };
const PRODUCT_TONES: Record<ProductStatus, BadgeTone> = { DRAFT: 'neutral', PUBLISHED: 'green', UNPUBLISHED: 'sage' };
const MODERATION_TONES: Record<ModerationStatus, BadgeTone> = { PENDING: 'amber', APPROVED: 'green', REJECTED: 'red' };
const VERIFICATION_TONES: Record<VerificationStatus, BadgeTone> = { PENDING: 'amber', VERIFIED: 'green', REJECTED: 'red' };
const INQUIRY_TONES: Record<InquiryStatus, BadgeTone> = { OPEN: 'amber', ANSWERED: 'green', CLOSED: 'neutral' };

export const FulfilmentBadge = ({ status }: { status: FulfillmentStatus }) => <Badge tone={FULFILMENT_TONES[status]}>{FULFILMENT_LABELS[status]}</Badge>;
export const OrderBadge = ({ status }: { status: OrderStatus }) => <Badge tone={ORDER_TONES[status]}>{ORDER_LABELS[status]}</Badge>;
export const ProductStatusBadge = ({ status }: { status: ProductStatus }) => <Badge tone={PRODUCT_TONES[status]}>{PRODUCT_STATUS_LABELS[status]}</Badge>;
export const ModerationBadge = ({ status }: { status: ModerationStatus }) => <Badge tone={MODERATION_TONES[status]}>{MODERATION_LABELS[status]}</Badge>;
export const VerificationBadge = ({ status }: { status: VerificationStatus }) => (
  <Badge tone={VERIFICATION_TONES[status]}>{VERIFICATION_LABELS[status]}</Badge>
);
export const InquiryBadge = ({ status }: { status: InquiryStatus }) => (
  <Badge tone={INQUIRY_TONES[status]}>{status === 'OPEN' ? 'Open' : status === 'ANSWERED' ? 'Answered' : 'Closed'}</Badge>
);

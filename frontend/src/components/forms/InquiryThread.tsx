import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { useReplyToInquiry } from '@/api/queries/consumer';
import type { Inquiry } from '@/api/types';
import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/format';
import { InquiryBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Field';

const AUTHOR: Record<string, string> = { CONSUMER: 'Customer', PRODUCER: 'Farm', ADMIN: 'Farm2Home team' };

/** A conversation view used by consumers, producers and admins. */
export function InquiryThread({
  inquiry,
  scope,
  canReply = true,
  actions,
}: {
  inquiry: Inquiry;
  scope: 'consumer' | 'producer' | 'admin';
  canReply?: boolean;
  actions?: React.ReactNode;
}) {
  const reply = useReplyToInquiry(scope);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const closed = inquiry.status === 'CLOSED';

  async function send() {
    if (!message.trim()) return setError('Write a reply first.');
    setError(null);
    try {
      await reply.mutateAsync({ id: inquiry.id, message: message.trim() });
      setMessage('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-sans text-base font-semibold text-charcoal-900">{inquiry.subject}</h3>
          <p className="text-sm text-charcoal-500">
            {scope === 'consumer'
              ? `To ${inquiry.producer?.farm_name ?? 'the Farm2Home team'}`
              : `From ${inquiry.name} · ${inquiry.email}${inquiry.phone ? ` · ${inquiry.phone}` : ''}`}
            {inquiry.product ? ` · about ${inquiry.product.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InquiryBadge status={inquiry.status} />
          {actions}
        </div>
      </div>
      <ol className="mt-4 space-y-3">
        <li className="rounded-xl bg-ivory-100 p-4 text-sm">
          <p className="text-xs text-charcoal-500">
            {scope === 'consumer' ? 'You' : inquiry.name} · {dateTime(inquiry.created_at)}
          </p>
          <p className="mt-1 whitespace-pre-line leading-6 text-charcoal-800">{inquiry.message}</p>
        </li>
        {inquiry.replies.map((entry) => {
          const mine = (scope === 'consumer' && entry.author_role === 'CONSUMER') || (scope !== 'consumer' && entry.author_role !== 'CONSUMER');
          return (
            <li key={entry.id} className={cn('rounded-xl p-4 text-sm', mine ? 'ml-6 bg-forest-50' : 'mr-6 bg-ivory-100')}>
              <p className="text-xs text-charcoal-500">
                {mine ? 'You' : AUTHOR[entry.author_role] ?? entry.author_role} · {dateTime(entry.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-line leading-6 text-charcoal-800">{entry.message}</p>
            </li>
          );
        })}
      </ol>
      {canReply && !closed ? (
        <div className="mt-4 space-y-3">
          <TextArea label="Reply" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} error={error ?? undefined} />
          <Button size="sm" loading={reply.isPending} onClick={send}>
            Send reply
          </Button>
        </div>
      ) : null}
    </div>
  );
}

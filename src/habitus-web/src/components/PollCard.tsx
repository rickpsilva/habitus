import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Lock, Vote } from 'lucide-react';
import Button from './ui/Button';
import Badge, { type BadgeVariant } from './ui/Badge';
import { useTranslation } from '../i18n/I18nProvider';
import { LOCALE_BY_LANGUAGE } from '../i18n/types';
import type { PollDto, PollStatus } from '../types';

interface PollCardProps {
  poll: PollDto;
  /** Casts a vote server-side; the parent refreshes polls afterwards. */
  onVote: (pollId: string, optionId: string) => Promise<void>;
  /** Forces the read-only results view (e.g. announcement not published yet). */
  votingDisabled?: boolean;
}

/** Voting stays open only while the poll is active, unclosed and untouched by this user. */
function canReceiveVote(poll: PollDto): boolean {
  return poll.status === 'Active' && !poll.isClosed && poll.myVoteOptionId == null;
}

function statusVariant(status: PollStatus): BadgeVariant {
  return status === 'Closed' ? 'neutral' : 'success';
}

/**
 * Humanized distance to/from the closing time ("in 3 days", "há 2 horas") using
 * Intl.RelativeTimeFormat so wording follows the active UI language.
 */
function formatRelativeClosing(isoDate: string, locale: string): string {
  const diffSeconds = Math.round((new Date(isoDate).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) return formatter.format(diffSeconds, 'second');

  const unitSteps = [
    { limit: 3600, unit: 'minute' as const, divisor: 60 },
    { limit: 86_400, unit: 'hour' as const, divisor: 3600 },
    { limit: Number.MAX_SAFE_INTEGER, unit: 'day' as const, divisor: 86_400 },
  ];
  const step = unitSteps.find((candidate) => absSeconds < candidate.limit)!;
  return formatter.format(Math.round(diffSeconds / step.divisor), step.unit);
}

export default function PollCard({ poll, onVote, votingDisabled = false }: PollCardProps) {
  const { t, language, formatDateTime } = useTranslation();
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const percentFormatter = useMemo(
    () => new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language], { maximumFractionDigits: 1 }),
    [language],
  );
  const formatPercent = (value: number) => `${percentFormatter.format(value)}%`;

  const votable = !votingDisabled && canReceiveVote(poll);
  const hasVoted = poll.myVoteOptionId != null;
  const sortedOptions = useMemo(
    () => [...poll.options].sort((a, b) => a.displayOrder - b.displayOrder),
    [poll.options],
  );

  const closed = poll.isClosed || poll.status === 'Closed';

  const statusLabel = closed
    ? t('poll.card.status.closed')
    : t('poll.card.status.active');

  const closingText = closed
    ? t('poll.card.endedAt', { datetime: formatDateTime(poll.closesAtUtc) })
    : t('poll.card.endsRelative', {
        relative: formatRelativeClosing(poll.closesAtUtc, LOCALE_BY_LANGUAGE[language]),
      });

  const submitVote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOptionId || submitting) return;

    setSubmitting(true);
    try {
      await onVote(poll.id, selectedOptionId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="bg-surface border border-line rounded-xl p-4" aria-label={poll.title}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink break-words">{poll.title}</h3>
          {poll.description && (
            <p className="text-sm text-ink-subtle mt-1 whitespace-pre-line break-words">{poll.description}</p>
          )}
          <p className="text-xs text-ink-subtle mt-1.5 flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
            {closingText}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={statusVariant(poll.status)}>{statusLabel}</Badge>
        </div>
      </header>

      {votable ? (
        <form onSubmit={submitVote} className="mt-4 space-y-3">
          <div
            role="radiogroup"
            aria-label={t('poll.card.optionsGroup')}
            className="grid grid-cols-1 gap-2"
          >
            {sortedOptions.map((option) => (
              <label
                key={option.id}
                className="flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-lg border border-line bg-surface cursor-pointer hover:bg-surface-hover has-checked:border-indigo-500 has-checked:bg-indigo-50 transition-colors"
              >
                <input
                  type="radio"
                  name={`poll-${poll.id}`}
                  value={option.id}
                  checked={selectedOptionId === option.id}
                  onChange={() => setSelectedOptionId(option.id)}
                  disabled={submitting}
                  className="w-4 h-4 accent-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm text-ink">{option.text}</span>
              </label>
            ))}
          </div>
          <Button type="submit" icon={Vote} disabled={!selectedOptionId} loading={submitting}>
            {t('poll.card.vote')}
          </Button>
        </form>
      ) : (
        <div className="mt-4 space-y-3" aria-live="polite">
          {sortedOptions.map((option) => {
            const isMyChoice = option.id === poll.myVoteOptionId;
            const fillWidth = Math.min(Math.max(option.percentage, 0), 100);

            return (
              <div key={option.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className={isMyChoice ? 'flex items-center gap-1 font-medium text-ink' : 'text-ink-muted'}>
                    {isMyChoice && (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
                        <span className="sr-only">{t('poll.card.myVote')}:</span>
                      </>
                    )}
                    {option.text}
                  </span>
                  <span className="text-ink-muted tabular-nums shrink-0">{formatPercent(option.percentage)}</span>
                </div>
                <div
                  className="mt-1 h-2 rounded-full bg-surface-hover overflow-hidden"
                  role="img"
                  aria-label={t('poll.card.optionResult', {
                    text: option.text,
                    percentage: formatPercent(option.percentage),
                  })}
                >
                  <div
                    className={isMyChoice ? 'h-full rounded-full bg-indigo-600' : 'h-full rounded-full bg-indigo-400'}
                    style={{ width: `${fillWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="pt-1 flex items-center gap-1 text-xs text-ink-subtle">
            {poll.status === 'Closed' && <Lock className="w-3 h-3" aria-hidden="true" />}
            <span>
              {hasVoted
                ? t('poll.card.votedWithTotal', { count: poll.totalVotes })
                : t('poll.card.totalVotes', { count: poll.totalVotes })}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

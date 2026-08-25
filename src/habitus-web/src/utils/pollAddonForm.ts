import type { PollDto } from '../types';

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 6;

/** Field values of the poll add-on, read by the parent at submit time. */
export interface PollAddonSnapshot {
  enabled: boolean;
  description: string;
  /** Raw datetime-local input value; converted to UTC ISO on submit. */
  closesLocal: string;
  options: string[];
}

/** Converts an UTC ISO timestamp to a datetime-local input value in the user's timezone. */
function isoToLocalInputValue(isoDate: string): string {
  const date = new Date(isoDate);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Builds the editor prefill from an existing poll (options ordered by displayOrder). */
export function buildPollFormState(poll: PollDto): PollAddonSnapshot {
  const options = [...poll.options]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((option) => option.text);
  while (options.length < MIN_POLL_OPTIONS) options.push('');

  return {
    enabled: true,
    description: poll.description,
    closesLocal: isoToLocalInputValue(poll.closesAtUtc),
    options,
  };
}

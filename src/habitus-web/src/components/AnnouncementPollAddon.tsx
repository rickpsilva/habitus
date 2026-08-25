import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field, Input, Textarea } from './ui/Field';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import {
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
  buildPollFormState,
  type PollAddonSnapshot,
} from '../utils/pollAddonForm';
import type { PollDto } from '../types';

export interface AnnouncementPollAddonHandle {
  /** Validates the enabled fields; renders inline errors and returns false when invalid. */
  validate: () => boolean;
  getSnapshot: () => PollAddonSnapshot;
}

interface AnnouncementPollAddonProps {
  mode: 'create' | 'edit';
  /** Parent-controlled: kept true until removal is confirmed via the ConfirmModal in the page. */
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Poll prefilled into the fields when editing an announcement that already has one. */
  existingPoll?: PollDto | null;
}

type PollAddonErrors = Partial<Record<'closing' | 'options', string>>;

/** Client-side mirror of the backend rules (future closing time, ≥2 distinct non-empty options). */
function validateSnapshot(snapshot: PollAddonSnapshot, t: TranslateFn): PollAddonErrors {
  const errors: PollAddonErrors = {};

  const closesAt = new Date(snapshot.closesLocal);
  if (!snapshot.closesLocal || Number.isNaN(closesAt.getTime())) {
    errors.closing = t('poll.create.error.closingRequired');
  } else if (closesAt.getTime() <= Date.now()) {
    errors.closing = t('poll.create.error.closingPast');
  }

  const trimmedOptions = snapshot.options.map((text) => text.trim()).filter(Boolean);
  if (trimmedOptions.length < MIN_POLL_OPTIONS) {
    errors.options = t('poll.create.error.optionsMin');
  } else if (new Set(trimmedOptions).size !== trimmedOptions.length) {
    errors.options = t('poll.create.error.optionsDistinct');
  }

  return errors;
}

/**
 * "Add-ons" section of the announcement editor: toggles an inline poll form
 * (description, dynamic options, closing datetime). The poll title is always
 * the announcement title, so no title field is shown.
 */
const AnnouncementPollAddon = forwardRef<AnnouncementPollAddonHandle, AnnouncementPollAddonProps>(
  ({ mode, enabled, onEnabledChange, existingPoll = null }, ref) => {
    const { t } = useTranslation();
    const prefill = useMemo(
      () => (existingPoll ? buildPollFormState(existingPoll) : null),
      [existingPoll],
    );

    const [description, setDescription] = useState(prefill?.description ?? '');
    const [closesLocal, setClosesLocal] = useState(prefill?.closesLocal ?? '');
    const [options, setOptions] = useState<string[]>(prefill?.options ?? ['', '']);
    const [errors, setErrors] = useState<PollAddonErrors>({});

    useImperativeHandle(ref, () => ({
      validate() {
        if (!enabled) return true;
        const nextErrors = validateSnapshot({ enabled, description, closesLocal, options }, t);
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
      },
      getSnapshot() {
        return { enabled, description, closesLocal, options };
      },
    }));

    const updateOption = (index: number, text: string) => {
      setOptions((prev) => prev.map((existing, i) => (i === index ? text : existing)));
    };

    const removeOption = (index: number) => {
      setOptions((prev) => prev.filter((_, i) => i !== index));
    };

    const addOption = () => {
      setOptions((prev) => [...prev, '']);
    };

    const canAddOption = options.length < MAX_POLL_OPTIONS;
    const canRemoveOption = options.length > MIN_POLL_OPTIONS;
    const showRemoveAction = mode === 'edit' && existingPoll !== null;

    return (
      <section className="border border-line rounded-lg p-3 space-y-3" aria-label={t('poll.addon.title')}>
        <p className="text-sm font-medium text-ink">{t('poll.addon.title')}</p>

        <label className="flex items-start gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {t('poll.addon.poll')}
            <span className="block text-xs text-ink-subtle">{t('poll.addon.pollHint')}</span>
          </span>
        </label>

        {enabled && (
          <div className="space-y-3">
            <Field label={t('common.description')} htmlFor="poll-addon-description">
              <Textarea
                id="poll-addon-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('poll.create.placeholder.description')}
              />
            </Field>

            <div className="space-y-2">
              {options.map((option, index) => (
                <Field
                  key={index}
                  label={t('poll.create.field.option', { number: index + 1 })}
                  htmlFor={`poll-addon-option-${index}`}
                  required
                  error={index === 0 ? errors.options : undefined}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      id={`poll-addon-option-${index}`}
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      maxLength={200}
                      className="flex-1"
                    />
                    {canRemoveOption && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="p-2 rounded hover:bg-red-50 text-red-600 shrink-0"
                        aria-label={t('poll.create.removeOption', { number: index + 1 })}
                        title={t('poll.create.removeOption', { number: index + 1 })}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </Field>
              ))}

              {canAddOption && (
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-control hover:bg-control-hover text-ink"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  {t('poll.create.addOption')}
                </button>
              )}
            </div>

            <Field
              label={t('poll.create.field.closing')}
              htmlFor="poll-addon-closing"
              required
              error={errors.closing}
              hint={t('poll.create.hint.closingTimezone')}
            >
              <Input
                id="poll-addon-closing"
                type="datetime-local"
                value={closesLocal}
                onChange={(e) => setClosesLocal(e.target.value)}
                invalid={!!errors.closing}
              />
            </Field>

            {showRemoveAction && (
              <button
                type="button"
                onClick={() => onEnabledChange(false)}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-600"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {t('poll.addon.remove')}
              </button>
            )}
          </div>
        )}
      </section>
    );
  },
);

AnnouncementPollAddon.displayName = 'AnnouncementPollAddon';

export default AnnouncementPollAddon;

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ModalPopup from './ModalPopup';
import Button from './ui/Button';
import { Field, Input, Select, Textarea } from './ui/Field';
import { pollsApi } from '../api/services';
import { useTranslation } from '../i18n/I18nProvider';
import type { TranslateFn } from '../i18n/types';
import type { AnnouncementDto, CreatePollRequest } from '../types';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

interface CreatePollModalProps {
  open: boolean;
  onClose: () => void;
  condominiumId: string;
  /** Announcements offered for linking (published ones read best). */
  announcements: AnnouncementDto[];
  /** When set, the poll is created for this announcement and the selector is hidden. */
  lockedAnnouncement?: AnnouncementDto | null;
  /** Invoked after a successful create so the parent can refresh its lists. */
  onCreated: () => void;
}

interface PollFormState {
  title: string;
  description: string;
  announcementId: string;
  /** Raw datetime-local input value; converted to UTC ISO on submit. */
  expiresLocal: string;
  options: string[];
}

type PollFormErrors = Partial<Record<'title' | 'expires' | 'announcement' | 'options', string>>;

const EMPTY_FORM: PollFormState = {
  title: '',
  description: '',
  announcementId: '',
  expiresLocal: '',
  options: ['', ''],
};

/**
 * Backend 400 bodies are either plain strings (ArgumentException) or
 * ProblemDetails-like objects with a `message`; accept both.
 */
function getApiErrorMessage(error: unknown, fallback: string): string {
  const data: unknown = (error as { response?: { data?: unknown } })?.response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data;
  }
  if (data && typeof data === 'object') {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
}

/** Client-side mirror of the backend creation rules (title, linked announcement, future expiry, ≥2 distinct options). */
function validate(form: PollFormState, announcementId: string, t: TranslateFn): PollFormErrors {
  const errors: PollFormErrors = {};

  if (!form.title.trim()) {
    errors.title = t('poll.create.error.titleRequired');
  }

  if (!announcementId) {
    errors.announcement = t('poll.create.error.announcementRequired');
  }

  const expiresAt = new Date(form.expiresLocal);
  if (!form.expiresLocal || Number.isNaN(expiresAt.getTime())) {
    errors.expires = t('poll.create.error.expiryRequired');
  } else if (expiresAt.getTime() <= Date.now()) {
    errors.expires = t('poll.create.error.expiryPast');
  }

  const trimmedOptions = form.options.map((text) => text.trim()).filter(Boolean);
  if (trimmedOptions.length < MIN_OPTIONS) {
    errors.options = t('poll.create.error.optionsMin');
  } else if (new Set(trimmedOptions).size !== trimmedOptions.length) {
    errors.options = t('poll.create.error.optionsDistinct');
  }

  return errors;
}

export default function CreatePollModal({ open, onClose, condominiumId, announcements, lockedAnnouncement = null, onCreated }: CreatePollModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PollFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<PollFormErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fresh form whenever the modal closes, so reopening always starts clean.
  const resetAndClose = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError('');
    onClose();
  };

  const updateField = <K extends keyof PollFormState>(key: K, value: PollFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateOption = (index: number, text: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((existing, i) => (i === index ? text : existing)),
    }));
  };

  const removeOption = (index: number) => {
    setForm((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  const addOption = () => {
    setForm((prev) => ({ ...prev, options: [...prev.options, ''] }));
  };

  const submit = async () => {
    const announcementId = lockedAnnouncement?.id ?? form.announcementId;
    const validationErrors = validate(form, announcementId, t);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setServerError('');
    try {
      const payload: CreatePollRequest = {
        title: form.title.trim(),
        description: form.description.trim(),
        announcementId: announcementId || null,
        // datetime-local is interpreted in the user's timezone; toISOString emits UTC.
        expiresAtUtc: new Date(form.expiresLocal).toISOString(),
        options: form.options
          .map((text) => ({ text: text.trim() }))
          .filter((option) => option.text.length > 0),
      };

      await pollsApi.create(condominiumId, payload);
      onCreated();
      resetAndClose();
    } catch (error) {
      console.error('Erro ao criar votação:', error);
      setServerError(getApiErrorMessage(error, t('poll.create.error.generic')));
    } finally {
      setSubmitting(false);
    }
  };

  const canAddOption = form.options.length < MAX_OPTIONS;
  const canRemoveOption = form.options.length > MIN_OPTIONS;

  return (
    <ModalPopup
      open={open}
      onClose={resetAndClose}
      title={t('poll.create.title')}
      maxWidthClass="max-w-2xl"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {serverError && (
          <div role="alert" className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <Field label={t('poll.create.field.title')} htmlFor="poll-title" required error={errors.title}>
          <Input
            id="poll-title"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder={t('poll.create.placeholder.title')}
            maxLength={200}
            invalid={!!errors.title}
          />
        </Field>

        <Field label={t('common.description')} htmlFor="poll-description">
          <Textarea
            id="poll-description"
            rows={2}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder={t('poll.create.placeholder.description')}
          />
        </Field>

        {lockedAnnouncement ? (
          <Field label={t('poll.create.field.linkAnnouncement')} htmlFor="poll-announcement-locked">
            <Input id="poll-announcement-locked" value={lockedAnnouncement.title} readOnly disabled />
          </Field>
        ) : (
          <Field label={t('poll.create.field.linkAnnouncement')} htmlFor="poll-announcement" required error={errors.announcement}>
            <Select
              id="poll-announcement"
              value={form.announcementId}
              onChange={(e) => updateField('announcementId', e.target.value)}
              invalid={!!errors.announcement}
            >
              <option value="">{t('poll.create.selectAnnouncement')}</option>
              {announcements.map((announcement) => (
                <option key={announcement.id} value={announcement.id}>
                  {announcement.title.slice(0, 80)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="space-y-2">
          {form.options.map((option, index) => (
            <Field
              key={index}
              label={t('poll.create.field.option', { number: index + 1 })}
              htmlFor={`poll-option-${index}`}
              required
              error={index === 0 ? errors.options : undefined}
            >
              <div className="flex items-center gap-2">
                <Input
                  id={`poll-option-${index}`}
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
          label={t('poll.create.field.expiry')}
          htmlFor="poll-expires"
          required
          error={errors.expires}
          hint={t('poll.create.hint.expiryTimezone')}
        >
          <Input
            id="poll-expires"
            type="datetime-local"
            value={form.expiresLocal}
            onChange={(e) => updateField('expiresLocal', e.target.value)}
            invalid={!!errors.expires}
          />
        </Field>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={resetAndClose} fullWidth className="sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={submitting} fullWidth className="sm:w-auto">
            {t('poll.create.submit')}
          </Button>
        </div>
      </form>
    </ModalPopup>
  );
}

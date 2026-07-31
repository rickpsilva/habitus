import { useEffect, useRef, useState } from 'react';
import { Languages, ChevronDown, Search, Check } from 'lucide-react';
import { useTranslation } from '../i18n/I18nProvider';
import { useToast } from '../contexts/ToastContext';
import { meApi } from '../api/services';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_ENDONYMS,
  LANGUAGE_SEARCH_THRESHOLD,
} from '../i18n/types';
import type { Language } from '../i18n/types';

interface LanguageSwitcherProps {
  variant?: 'full' | 'icon' | 'menu';
  className?: string;
}

// Adaptive, accessible language picker. Scales from a plain list to a
// searchable list once SUPPORTED_LANGUAGES crosses LANGUAGE_SEARCH_THRESHOLD.
export default function LanguageSwitcher({ variant = 'full', className = '' }: LanguageSwitcherProps) {
  const { t, language, setLanguage } = useTranslation();
  const { error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const showSearch = SUPPORTED_LANGUAGES.length >= LANGUAGE_SEARCH_THRESHOLD;

  const filtered = SUPPORTED_LANGUAGES.filter((l) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return LANGUAGE_ENDONYMS[l].toLowerCase().includes(q) || l.toLowerCase().includes(q);
  });

  // Attach the outside-click listener only while the popover is open. The effect
  // body never calls a state setter — `setOpen(false)` runs inside the handler.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const closeAndFocus = () => {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  // Persists the chosen language, then updates the in-app i18n state. Mirrors the
  // former Layout handler: on a disabled/invalid response we toast and keep the
  // current language unchanged.
  const handleSelect = async (next: Language) => {
    if (next !== language) {
      setChanging(true);
      try {
        await meApi.setLanguage({ language: next });
        setLanguage(next);
      } catch (err) {
        const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
        if (code === 'multilanguage_disabled') {
          toastError(t('localization.errorDisabled'));
        } else if (code === 'invalid_language') {
          toastError(t('localization.errorInvalid'));
        } else {
          toastError(t('localization.errorSave'));
        }
      } finally {
        setChanging(false);
      }
    }
    closeAndFocus();
  };

  const currentEndonym = LANGUAGE_ENDONYMS[language];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {variant === 'full' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => e.key === 'Escape' && open && closeAndFocus()}
          disabled={changing}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm bg-surface-muted hover:bg-surface-hover text-ink border border-line rounded-lg transition-colors disabled:opacity-60"
        >
          <Languages className="w-4 h-4 shrink-0" />
          <span className="truncate">{currentEndonym}</span>
          <ChevronDown className="w-4 h-4 shrink-0 ml-auto" />
        </button>
      ) : variant === 'menu' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => e.key === 'Escape' && open && closeAndFocus()}
          disabled={changing}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-muted hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-60"
        >
          <Languages className="w-4 h-4 shrink-0" />
          <span>{t('localization.selectorLabel')}</span>
          <span className="ml-auto text-ink-subtle truncate">{currentEndonym}</span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => e.key === 'Escape' && open && closeAndFocus()}
          disabled={changing}
          title={currentEndonym}
          aria-label={currentEndonym}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center justify-center w-9 h-9 bg-surface-muted hover:bg-surface-hover text-ink border border-line rounded-lg transition-colors disabled:opacity-60"
        >
          <Languages className="w-4 h-4 shrink-0" />
        </button>
      )}

      {open && (
        <div
          role="listbox"
          aria-label={t('localization.selectorLabel')}
          className={`absolute bottom-full mb-2 bg-surface border border-line rounded-lg shadow-lg z-50 ${
            variant === 'full' || variant === 'menu' ? 'w-full' : 'min-w-52'
          }`}
        >
          {showSearch && (
            <div className="p-2 border-b border-line">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && closeAndFocus()}
                  placeholder={t('localization.search')}
                  className="w-full pl-8 pr-2 py-1.5 text-sm bg-surface-muted text-ink placeholder:text-ink-subtle border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.map((l) => (
              <li key={l} role="option" aria-selected={l === language}>
                <button
                  type="button"
                  onClick={() => handleSelect(l)}
                  disabled={changing}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors disabled:opacity-60 ${
                    l === language
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-ink-muted hover:bg-surface-hover'
                  }`}
                >
                  <span className="truncate">{LANGUAGE_ENDONYMS[l]}</span>
                  <span className="text-ink-subtle text-xs ml-auto">{l.toUpperCase()}</span>
                  {l === language && <Check className="w-4 h-4 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

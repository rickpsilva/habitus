import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Badge } from './index';

export interface AutocompleteOption {
  id: string;
  label: string;
  hashtags?: string[];
  disabled?: boolean;
}

export interface AutocompleteProps {
  label?: string;
  placeholder?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  options: AutocompleteOption[];
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  emptyMessage?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
  showSelectedHashtags?: boolean;
}

export default function Autocomplete({
  label,
  placeholder = 'Search...',
  value,
  onChange,
  options,
  loading = false,
  disabled = false,
  required = false,
  error,
  hint,
  emptyMessage = 'No results',
  className,
  id: externalId,
  'aria-label': ariaLabel,
  showSelectedHashtags = false,
}: AutocompleteProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const listboxId = `${id}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  );

  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    const handleScrollOrResize = () => updateDropdownPosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateDropdownPosition]);

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return options.filter((o) => !o.disabled);
    return options.filter(
      (o) =>
        !o.disabled &&
        (o.label.toLowerCase().includes(query) ||
          o.hashtags?.some((h) => h.toLowerCase().includes(query))),
    );
  }, [options, inputValue]);

  // Consolidated effect for active index management
  useEffect(() => {
    setActiveIndex(0);
    if (isOpen && selectedOption) {
      const idx = filteredOptions.findIndex((o) => o.id === selectedOption.id);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [filteredOptions, isOpen, selectedOption]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
        setInputValue(selectedOption?.label ?? '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  const handleSelect = useCallback((option: AutocompleteOption) => {
    onChange(option.id);
    setInputValue(option.label);
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setInputValue('');
    setIsOpen(true);
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (isOpen && option) {
        handleSelect(option);
      } else {
        setIsOpen(true);
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setInputValue(selectedOption?.label ?? '');
      inputRef.current?.blur();
    }
  }, [filteredOptions, activeIndex, isOpen, selectedOption, handleSelect]);

  const handleFocus = () => {
    setInputValue('');
    setIsOpen(true);
  };

  const handleBlur = () => {
    // Delay so clicks on options are handled first
    setTimeout(() => {
      setInputValue(selectedOption?.label ?? '');
      setIsOpen(false);
    }, 150);
  };

  return (
    <div className={cn('space-y-1', className)} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-muted">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={isOpen ? `${id}-option-${activeIndex}` : undefined}
          aria-label={ariaLabel}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            'w-full px-3 py-2 pr-16 border rounded-lg text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed',
            error ? 'border-red-400' : 'border-line',
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          )}
          {value && !disabled && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-ink-subtle hover:text-ink-muted rounded-md hover:bg-surface-hover"
              aria-label="Clear selection"
              tabIndex={-1}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {!loading && (
            <ChevronDown
              className={cn(
                'w-4 h-4 text-ink-subtle transition-transform',
                isOpen && 'rotate-180',
              )}
            />
          )}
        </div>
      </div>

      {showSelectedHashtags && selectedOption?.hashtags && selectedOption.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {selectedOption.hashtags.map((tag) => (
            <Badge key={tag} variant="info" size="sm">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {isOpen &&
        dropdownPosition &&
        createPortal(
          <ul
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            className="fixed z-[80] max-h-60 overflow-auto rounded-lg border border-line bg-surface shadow-lg py-1"
            style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
          >
            {loading ? (
              <li className="px-3 py-2 text-sm text-ink-subtle">Loading...</li>
            ) : filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-subtle">{emptyMessage}</li>
            ) : (
              filteredOptions.map((option, index) => (
                <li
                  key={option.id}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={option.id === value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(option);
                  }}
                  className={cn(
                    'px-3 py-2 cursor-pointer text-sm',
                    index === activeIndex ? 'bg-indigo-50 text-indigo-900' : 'text-ink hover:bg-surface-hover',
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium break-words">{option.label}</span>
                    {option.hashtags && option.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {option.hashtags.map((tag) => (
                          <span key={tag} className="text-xs text-ink-subtle break-words">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

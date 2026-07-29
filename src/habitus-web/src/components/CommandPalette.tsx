import { useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface CommandItem {
  to: string;
  label: string;
  icon: LucideIcon;
  section?: string;
}

interface CommandPaletteProps {
  items: CommandItem[];
  onNavigate: (to: string) => void;
  onClose: () => void;
}

/**
 * Additive quick-navigation overlay (⌘K / Ctrl+K). Mounted only while open so
 * its internal state always starts fresh — no reset effects required.
 */
export default function CommandPalette({ items, onNavigate, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  const focusInput = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    node?.focus();
  };

  const select = (item: CommandItem | undefined) => {
    if (!item) return;
    onNavigate(item.to);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((prev) => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(filtered[highlighted]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Pesquisa rápida"
      onKeyDown={handleKeyDown}
    >
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-md">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
          <input
            ref={focusInput}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            placeholder="Ir para…"
            className="w-full bg-transparent py-3.5 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>

        <ul className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-subtle">Sem resultados</li>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === highlighted;
              return (
                <li key={item.to}>
                  <button
                    type="button"
                    onClick={() => select(item)}
                    onMouseEnter={() => setHighlighted(index)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-ink-muted hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.section && <span className="text-xs text-ink-subtle">{item.section}</span>}
                    {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-ink-subtle" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

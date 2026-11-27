import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router';

import {
  AppWindow,
  Cloud,
  CornerDownLeft,
  LayoutGrid,
  Network,
  Search,
} from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import { useSearchCatalog } from '@/hooks/useSearchCatalog';

import { cn } from '@/lib/utils';

import {
  countSearchResults,
  emptySearchResults,
  SEARCH_KIND_LABELS,
  SEARCH_KINDS,
  searchCatalog,
  type SearchKind,
  type SearchResult,
} from '@/utils/global-search';

type KindFilter = SearchKind | 'all';

const KIND_ICONS: Record<SearchKind, ReactNode> = {
  landscape: <Network className="size-[18px]" />,
  account: <Cloud className="size-[18px]" />,
  application: <AppWindow className="size-[18px]" />,
  resource: <LayoutGrid className="size-[18px]" />,
};

function isMacPlatform(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.userAgent)
  );
}

/**
 * Header search box plus the dialog it opens (also on Cmd/Ctrl+K). Searches
 * every landscape, provider account, application and resource in the
 * browser; see `searchCatalog` for what matches.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [activeIndex, setActiveIndex] = useState(0);

  const { catalog, isLoading, isError } = useSearchCatalog(open);
  const shortcutLabel = isMacPlatform() ? '⌘K' : 'Ctrl K';

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useMemo(
    () => (catalog ? searchCatalog(catalog, query) : emptySearchResults()),
    [catalog, query],
  );
  const total = countSearchResults(results);
  const visibleKinds =
    kindFilter === 'all'
      ? SEARCH_KINDS.filter((k) => results[k].length > 0)
      : [kindFilter];
  const flat: SearchResult[] = visibleKinds.flatMap((k) => results[k]);
  const active = flat[activeIndex];
  const optionId = (r: SearchResult): string =>
    `${listboxId}-${r.key.replace(/[^A-Za-z0-9_-]/g, '_')}`;

  const activeId = active ? optionId(active) : undefined;

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  function changeOpen(next: boolean): void {
    setOpen(next);
    if (!next) {
      setQuery('');
      setKindFilter('all');
      setActiveIndex(0);
    }
  }

  function changeQuery(value: string): void {
    setQuery(value);
    setActiveIndex(0);
  }

  function changeKind(kind: KindFilter): void {
    setKindFilter(kind);
    setActiveIndex(0);
  }

  async function openResult(result: SearchResult): Promise<void> {
    changeOpen(false);
    await navigate(result.href);
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (flat.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter' && active) {
      e.preventDefault();
      void openResult(active);
    }
  }

  const trimmed = query.trim();
  let status: string | null = null;
  if (trimmed === '') {
    status =
      'Search landscapes, provider accounts, applications and resources by name, description, account number or resource ID.';
  } else if (isError) {
    status = 'Could not load the inventory. Close this and try again.';
  } else if (isLoading) {
    status = 'Loading…';
  } else if (total === 0) {
    status = `No matches for “${trimmed}”.`;
  }

  return (
    <>
      <button
        type="button"
        aria-keyshortcuts="Meta+K Control+K"
        className="flex h-9 min-w-0 max-w-[520px] flex-1 items-center gap-2.5 rounded-md border border-white/15 bg-white/10 px-3 text-sm text-teal-100 transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">
          <span className="sm:hidden">Search</span>
          <span className="hidden sm:inline">
            Search applications, landscapes, accounts, resources…
          </span>
        </span>
        <kbd className="ml-auto hidden shrink-0 rounded bg-white/15 px-1.5 py-0.5 font-sans text-xs text-white sm:inline">
          {shortcutLabel}
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="top-[10vh] max-h-[80vh] bg-white w-[calc(100%-2rem)] max-w-[680px] translate-y-0 gap-0 overflow-hidden p-0 sm:rounded-xl [&>button:last-child]:hidden"
        >
          <DialogTitle className="sr-only">Search everything</DialogTitle>

          <div className="flex h-14 items-center gap-3 border-b border-slate-200 px-4">
            <Search className="size-[18px] shrink-0 text-slate-500" />
            <input
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={flat.length > 0}
              aria-label="Search everything"
              className="h-10 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Search…"
              role="combobox"
              type="text"
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
            />
            <kbd className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-xs text-slate-600">
              Esc
            </kbd>
          </div>

          {trimmed !== '' && total > 0 ? (
            <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
              {(['all', ...SEARCH_KINDS] as const).map((kind) => {
                const count = kind === 'all' ? total : results[kind].length;
                if (kind !== 'all' && count === 0) return null;
                const selected = kindFilter === kind;
                return (
                  <button
                    key={kind}
                    aria-pressed={selected}
                    className={cn(
                      'h-7 rounded-full border px-3 text-[13px] transition-colors',
                      selected
                        ? 'border-teal-700 bg-teal-700 text-slate-50'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                    type="button"
                    onClick={() => changeKind(kind)}
                  >
                    {kind === 'all' ? 'All' : SEARCH_KIND_LABELS[kind]} ·{' '}
                    {count}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="min-h-0 overflow-y-auto px-2 pt-2 pb-3">
            {status ? (
              <p className="px-3 py-6 text-center text-sm text-slate-600">
                {status}
              </p>
            ) : (
              <div aria-label="Search results" id={listboxId} role="listbox">
                {visibleKinds.map((kind) => (
                  <div
                    key={kind}
                    aria-labelledby={`${listboxId}-${kind}`}
                    role="group"
                  >
                    <p
                      className="mx-2 mt-3 mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase first:mt-2"
                      id={`${listboxId}-${kind}`}
                    >
                      {SEARCH_KIND_LABELS[kind]}
                    </p>
                    {results[kind].map((result) => {
                      const isActive = result === active;
                      return (
                        <div
                          key={result.key}
                          aria-selected={isActive}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5',
                            isActive ? 'bg-teal-50' : 'hover:bg-slate-50',
                          )}
                          id={optionId(result)}
                          role="option"
                          onClick={() => void openResult(result)}
                          onMouseMove={() => {
                            const index = flat.indexOf(result);
                            if (index !== activeIndex) setActiveIndex(index);
                          }}
                        >
                          <span
                            className={cn(
                              'shrink-0',
                              isActive ? 'text-teal-700' : 'text-slate-500',
                            )}
                          >
                            {KIND_ICONS[kind]}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span
                              className={cn(
                                'truncate font-medium',
                                isActive ? 'text-teal-900' : 'text-slate-900',
                              )}
                            >
                              {result.title}
                            </span>
                            <span className="truncate text-[13px] text-slate-600">
                              {result.subtitle}
                            </span>
                          </span>
                          {isActive ? (
                            <CornerDownLeft className="size-4 shrink-0 text-slate-500" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hidden flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600 sm:flex">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-sans">
                ↑
              </kbd>
              <kbd className="rounded border border-slate-200 bg-white px-1 font-sans">
                ↓
              </kbd>
              move
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-sans">
                ↵
              </kbd>
              open
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-sans">
                Esc
              </kbd>
              close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Building2, Briefcase, Cog, Hash, History, User as UserIcon, X } from 'lucide-react';
import type { KPIRow } from '@/lib/mockData';
import { cn } from '@/lib/utils';

const RECENTS_KEY = 'globalSearch.recents';
const MAX_RECENTS = 10;
const MAX_SUGGESTIONS = 8;

export type RecentEntry = { q: string; kpiId?: string; at: number };

export type SuggestionPick =
  | { kind: 'kpi'; label: string; query: string; row: KPIRow }
  | { kind: 'system' | 'lob' | 'process' | 'source' | 'person' | 'hash' | 'text'; label: string; query: string };

type Group =
  | { type: 'recents'; items: RecentEntry[] }
  | { type: 'suggestions'; items: Suggestion[] };

export type Suggestion = SuggestionPick & { sub?: string; rag?: KPIRow['ragState'] };

function loadRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_RECENTS) : [];
  } catch { return []; }
}
function saveRecents(r: RecentEntry[]) {
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(r.slice(0, MAX_RECENTS))); } catch { /* noop */ }
}

export function useRecents() {
  const [recents, setRecents] = useState<RecentEntry[]>(() => loadRecents());
  const push = (entry: Omit<RecentEntry, 'at'>) => {
    setRecents(prev => {
      const dedup = prev.filter(p => !(p.q === entry.q && p.kpiId === entry.kpiId));
      const next = [{ ...entry, at: Date.now() }, ...dedup].slice(0, MAX_RECENTS);
      saveRecents(next);
      return next;
    });
  };
  const remove = (q: string, kpiId?: string) => {
    setRecents(prev => {
      const next = prev.filter(p => !(p.q === q && p.kpiId === kpiId));
      saveRecents(next);
      return next;
    });
  };
  const clearAll = () => { setRecents([]); saveRecents([]); };
  return { recents, push, remove, clearAll };
}

const RAG_DOT: Record<string, string> = {
  GREEN: 'bg-rag-green', AMBER: 'bg-rag-amber', RED: 'bg-rag-red',
  GREY: 'bg-rag-grey', BLUE: 'bg-rag-blue', UNCONFIGURED: 'bg-muted-foreground',
};

function iconFor(kind: SuggestionPick['kind']) {
  switch (kind) {
    case 'kpi': return Activity;
    case 'system': return Cog;
    case 'lob': return Building2;
    case 'process': return Briefcase;
    case 'source': return Briefcase;
    case 'person': return UserIcon;
    case 'hash': return Hash;
    default: return Activity;
  }
}
function tagFor(kind: SuggestionPick['kind']) {
  return kind === 'kpi' ? 'KPI'
    : kind === 'system' ? 'System'
    : kind === 'lob' ? 'LoB'
    : kind === 'process' ? 'Process'
    : kind === 'source' ? 'Source'
    : kind === 'person' ? 'Person'
    : kind === 'hash' ? 'Hash' : '';
}

export function buildSuggestions(
  query: string,
  rows: KPIRow[],
  lobs: string[],
  systems: string[],
  processes: string[],
): Suggestion[] {
  let q = query.trim().toLowerCase();
  if (!q) return [];
  if (/^\d+$/.test(q)) q = `kpi-${q}`.toLowerCase();

  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (s: Suggestion) => {
    const key = `${s.kind}:${s.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  const kpiMatches = rows.filter(r => r.id.toLowerCase().includes(q));
  for (const r of kpiMatches.slice(0, 6)) {
    push({
      kind: 'kpi', label: r.id, query: r.id, row: r,
      sub: `${r.system} · ${r.resolutionStatus}`, rag: r.ragState,
    });
  }
  for (const s of systems.filter(x => x.toLowerCase().includes(q)).slice(0, 4)) {
    push({ kind: 'system', label: s, query: s });
  }
  for (const l of lobs.filter(x => x.toLowerCase().includes(q)).slice(0, 4)) {
    push({ kind: 'lob', label: l, query: l });
  }
  for (const p of processes.filter(x => x.toLowerCase().includes(q)).slice(0, 3)) {
    push({ kind: 'process', label: p, query: p });
  }
  const people = new Set<string>();
  for (const r of rows) if (r.assignee?.name) people.add(r.assignee.name);
  for (const n of Array.from(people).filter(x => x.toLowerCase().includes(q)).slice(0, 3)) {
    push({ kind: 'person', label: n, query: n });
  }
  if (q.length >= 4) {
    const hashRow = rows.find(r => r.auditLedgerId.toLowerCase().includes(q));
    if (hashRow) push({ kind: 'hash', label: hashRow.auditLedgerId, query: hashRow.auditLedgerId, sub: hashRow.id });
  }
  return out.slice(0, MAX_SUGGESTIONS);
}

type Props = {
  query: string;
  rows: KPIRow[];
  lobs: string[];
  systems: string[];
  processes: string[];
  recents: RecentEntry[];
  onPick: (s: SuggestionPick) => void;
  onPickRecent: (r: RecentEntry) => void;
  onRemoveRecent: (q: string, kpiId?: string) => void;
  onClearAll: () => void;
  activeIndex: number;
  setActiveIndex: (n: number) => void;
  registerItems: (n: number) => void;
};

export function GlobalSearchSuggest({
  query, rows, lobs, systems, processes,
  recents, onPick, onPickRecent, onRemoveRecent, onClearAll,
  activeIndex, setActiveIndex, registerItems,
}: Props) {
  const suggestions = useMemo(
    () => buildSuggestions(query, rows, lobs, systems, processes),
    [query, rows, lobs, systems, processes],
  );

  const showRecents = !query.trim();
  const visibleRecents = recents.slice(0, 6);

  // Flat list for keyboard nav: suggestions first, then recents (or just recents when empty query)
  const flat: Array<{ kind: 'sug'; s: Suggestion } | { kind: 'rec'; r: RecentEntry }> = showRecents
    ? visibleRecents.map(r => ({ kind: 'rec' as const, r }))
    : suggestions.map(s => ({ kind: 'sug' as const, s }));

  useEffect(() => { registerItems(flat.length); }, [flat.length, registerItems]);

  if (flat.length === 0 && !showRecents) {
    return (
      <div className="absolute top-full left-0 mt-1 w-[360px] bg-popover border border-border rounded-md shadow-lg z-50 text-xs">
        <div className="px-3 py-2 text-muted-foreground">No matches for "{query}"</div>
        {visibleRecents.length > 0 && (
          <RecentsBlock recents={visibleRecents} onPick={onPickRecent} onRemove={onRemoveRecent} onClearAll={onClearAll} startIndex={0} activeIndex={-1} setActiveIndex={setActiveIndex} />
        )}
      </div>
    );
  }
  if (flat.length === 0) return null;

  return (
    <div className="absolute top-full left-0 mt-1 w-[360px] bg-popover border border-border rounded-md shadow-lg z-50 text-xs overflow-hidden">
      {showRecents ? (
        <RecentsBlock recents={visibleRecents} onPick={onPickRecent} onRemove={onRemoveRecent} onClearAll={onClearAll} startIndex={0} activeIndex={activeIndex} setActiveIndex={setActiveIndex} />
      ) : (
        <div className="py-1 max-h-[360px] overflow-y-auto scrollbar-thin">
          <div className="px-3 pt-1.5 pb-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Suggestions</div>
          {suggestions.map((s, i) => {
            const Icon = iconFor(s.kind);
            const active = i === activeIndex;
            return (
              <button
                key={`${s.kind}-${s.label}-${i}`}
                onMouseDown={(e) => { e.preventDefault(); onPick(s); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-accent',
                  active && 'bg-accent',
                )}
              >
                <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                {s.kind === 'kpi' && s.rag && (
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', RAG_DOT[s.rag])} />
                )}
                <span className="font-semibold text-foreground truncate">{s.label}</span>
                {s.sub && <span className="text-muted-foreground truncate">· {s.sub}</span>}
                <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">{tagFor(s.kind)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentsBlock({
  recents, onPick, onRemove, onClearAll, startIndex, activeIndex, setActiveIndex,
}: {
  recents: RecentEntry[];
  onPick: (r: RecentEntry) => void;
  onRemove: (q: string, kpiId?: string) => void;
  onClearAll: () => void;
  startIndex: number;
  activeIndex: number;
  setActiveIndex: (n: number) => void;
}) {
  if (recents.length === 0) {
    return (
      <div className="px-3 py-2 text-muted-foreground flex items-center gap-2">
        <History className="h-3 w-3" /> No recent searches
      </div>
    );
  }
  return (
    <div className="py-1">
      <div className="px-3 pt-1.5 pb-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
        <span className="flex items-center gap-1"><History className="h-3 w-3" /> Recent</span>
        <button onClick={(e) => { e.preventDefault(); onClearAll(); }} className="text-[9px] text-muted-foreground hover:text-foreground normal-case tracking-normal">Clear all</button>
      </div>
      {recents.map((r, i) => {
        const idx = startIndex + i;
        const active = idx === activeIndex;
        return (
          <div
            key={`${r.q}-${r.kpiId ?? ''}-${r.at}`}
            onMouseEnter={() => setActiveIndex(idx)}
            className={cn('flex items-center gap-2 px-3 py-1.5 hover:bg-accent', active && 'bg-accent')}
          >
            <button
              onMouseDown={(e) => { e.preventDefault(); onPick(r); }}
              className="flex-1 text-left flex items-center gap-2 min-w-0"
            >
              {r.kpiId ? <Activity className="h-3 w-3 text-muted-foreground shrink-0" /> : <History className="h-3 w-3 text-muted-foreground shrink-0" />}
              <span className="text-foreground truncate">{r.q}</span>
              {r.kpiId && <span className="text-muted-foreground text-[10px] truncate">· {r.kpiId}</span>}
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); onRemove(r.q, r.kpiId); }}
              className="p-0.5 hover:bg-background rounded shrink-0"
              aria-label="Remove recent"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

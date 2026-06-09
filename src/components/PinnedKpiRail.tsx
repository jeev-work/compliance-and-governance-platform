import { useEffect, useMemo, useState, useCallback } from 'react';
import { useFilters, Role } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { Pin, X, Layers } from 'lucide-react';
import { RagState, RAG_SHORT, Severity } from '@/lib/mockData';

const RAG_BG: Record<RagState, string> = {
  GREEN: 'bg-rag-green border-rag-green',
  AMBER: 'bg-rag-amber border-rag-amber',
  RED:   'bg-rag-red border-rag-red',
  GREY:  'bg-rag-grey border-rag-grey',
  BLUE:  'bg-rag-blue border-rag-blue',
  UNCONFIGURED: 'rag-unconfigured',
};

const RAG_TEXT: Record<RagState, string> = {
  GREEN: 'rag-green', AMBER: 'rag-amber', RED: 'rag-red',
  GREY: 'rag-grey', BLUE: 'rag-blue', UNCONFIGURED: 'rag-unconfigured',
};

function storageKey(role: Role) { return `pinned-kpis:${role}`; }

export function getPinned(role: Role): string[] {
  try { return JSON.parse(localStorage.getItem(storageKey(role)) || '[]'); } catch { return []; }
}
export function setPinned(role: Role, ids: string[]) {
  localStorage.setItem(storageKey(role), JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent('pinned-kpis-changed'));
}
export function togglePin(role: Role, id: string) {
  const cur = getPinned(role);
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
  setPinned(role, next);
  return next.includes(id);
}

/** Subscribe hook so any component re-renders when pins change. */
export function usePinned(role: Role): [string[], (id: string) => void] {
  const [pins, setPins] = useState<string[]>(() => getPinned(role));
  useEffect(() => {
    const handler = () => setPins(getPinned(role));
    window.addEventListener('pinned-kpis-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('pinned-kpis-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, [role]);
  const toggle = useCallback((id: string) => { togglePin(role, id); }, [role]);
  return [pins, toggle];
}

export function PinnedKpiRail() {
  const { filters, allData, openDrilldown } = useFilters();
  const [pins, toggle] = usePinned(filters.role);

  const pinnedRows = useMemo(
    () => pins.map(id => allData.find(r => r.id === id)).filter(Boolean) as ReturnType<typeof allData['find']> extends infer T ? NonNullable<T>[] : never,
    [pins, allData],
  );

  // Group pins by severity bucket
  const groupedSev = useMemo(() => {
    const buckets: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    allData.forEach(r => { if (r.status === 'BREACHED') buckets[r.severity]++; });
    return buckets;
  }, [allData]);

  if (pinnedRows.length === 0 && groupedSev.Critical + groupedSev.High === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-md mb-2 px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <Pin className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pinned KPIs ({pinnedRows.length})
        </span>
        <span className="text-[9px] text-muted-foreground italic ml-1">
          Pin any KPI from its diagnostic modal to track it here.
        </span>
      </div>
      {pinnedRows.length === 0 ? (
        <div className="text-[10px] text-muted-foreground italic py-1">
          No pins yet — open any KPI and click the <Pin className="inline h-2.5 w-2.5 align-text-bottom" /> icon to pin.
        </div>
      ) : (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-1">
          {pinnedRows.map(r => (
            <div
              key={r.id}
              onClick={() => openDrilldown('breach', r.id, r)}
              className={cn(
                'group shrink-0 flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all',
                RAG_BG[r.ragState],
                r.executiveFlag && 'exec-pulse',
              )}
              title={`${r.system} · ${r.process} · ${r.lob}`}
            >
              <span className={cn('font-bold font-mono text-[9px]', RAG_TEXT[r.ragState])}>{RAG_SHORT[r.ragState]}</span>
              <span className="font-mono font-semibold text-foreground">{r.id}</span>
              <span className="text-muted-foreground truncate max-w-[110px]">{r.system}</span>
              <button
                onClick={(e) => { e.stopPropagation(); toggle(r.id); }}
                title="Unpin"
                className="opacity-50 group-hover:opacity-100 hover:text-rag-red"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

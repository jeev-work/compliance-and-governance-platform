import { useFilters, FILTER_OPTIONS, DatePreset } from '@/lib/filterContext';
import { ROLE_LABEL } from '@/lib/rbac';
import { Role } from '@/lib/filterContext';
import { RagState, Severity, StateFlag, RAG_SHORT, ImpactTier, IMPACT_LABEL } from '@/lib/mockData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon, Info, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GlobalSearchSuggest, useRecents, buildSuggestions, type SuggestionPick, type RecentEntry } from './GlobalSearchSuggest';

const PRESETS: DatePreset[] = ['1H', '24H', '7D', '30D', '60D', '90D'];

const RAG_COLORS: Record<RagState, string> = {
  GREEN: 'bg-rag-green rag-green border-rag-green',
  AMBER: 'bg-rag-amber rag-amber border-rag-amber',
  RED:   'bg-rag-red rag-red border-rag-red',
  GREY:  'bg-rag-grey rag-grey border-rag-grey',
  BLUE:  'bg-rag-blue rag-blue border-rag-blue',
  UNCONFIGURED: 'rag-unconfigured',
};

export function GlobalFilterBar() {
  const { filters, setFilters, filteredData, allData, registries, openDrilldown } = useFilters();
  const [customOpen, setCustomOpen] = useState(false);
  const { recents, push: pushRecent, remove: removeRecent, clearAll: clearAllRecents } = useRecents();
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [itemCount, setItemCount] = useState(0);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggest on outside click
  useEffect(() => {
    if (!searchFocused) return;
    const onDown = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSearchFocused(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchFocused]);

  useEffect(() => { setActiveIndex(-1); }, [filters.searchQuery]);

  const commitPick = (s: SuggestionPick) => {
    setFilters(f => ({ ...f, searchQuery: s.query }));
    pushRecent({ q: s.query, kpiId: s.kind === 'kpi' ? s.label : undefined });
    if (s.kind === 'kpi') openDrilldown('breach', s.row.id, s.row);
    setSearchFocused(false);
    inputRef.current?.blur();
  };
  const commitRecent = (r: RecentEntry) => {
    setFilters(f => ({ ...f, searchQuery: r.q }));
    pushRecent({ q: r.q, kpiId: r.kpiId });
    if (r.kpiId) {
      const row = allData.find(x => x.id === r.kpiId);
      if (row) openDrilldown('breach', row.id, row);
    }
    setSearchFocused(false);
    inputRef.current?.blur();
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setSearchFocused(false); inputRef.current?.blur(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, itemCount - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') {
      // delegate to suggest panel via synthetic click — handled by useEffect not possible; replicate logic here
      const q = filters.searchQuery.trim();
      if (q) pushRecent({ q });
      setSearchFocused(false);
      inputRef.current?.blur();
    }
  };

  const toggleArr = <K extends 'lobs' | 'systems' | 'processes' | 'stateFlags' | 'ragStates' | 'severities' | 'impacts'>(
    key: K, value: string,
  ) => {
    setFilters(f => {
      const arr = f[key] as string[];
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      return { ...f, [key]: next } as typeof f;
    });
  };
  const clearArr = (key: 'lobs' | 'systems' | 'processes' | 'stateFlags' | 'ragStates' | 'severities' | 'impacts') =>
    setFilters(f => ({ ...f, [key]: [] }));
  const buildSuggestionsList = (): Array<{ kind: 'sug'; s: ReturnType<typeof buildSuggestions>[number] } | { kind: 'rec'; r: RecentEntry }> => {
    const q = filters.searchQuery.trim();
    if (!q) return recents.slice(0, 6).map(r => ({ kind: 'rec' as const, r }));
    return buildSuggestions(q, allData, registries.lobs, registries.systems, registries.processes).map(s => ({ kind: 'sug' as const, s }));
  };

  const breachCount = filteredData.filter(r => r.status === 'BREACHED').length;
  const greyCount = filteredData.filter(r => r.ragState === 'GREY').length;




  return (
    <div className="border-b border-border bg-card px-3 py-2 flex items-center gap-2 flex-wrap">
      {/* Global search */}
      <div className="relative" ref={searchWrapRef}>
        <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={filters.searchQuery}
          onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
          onFocus={() => setSearchFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && activeIndex >= 0) {
              const items = buildSuggestionsList();
              const it = items[activeIndex];
              if (it) {
                e.preventDefault();
                if (it.kind === 'sug') commitPick(it.s);
                else commitRecent(it.r);
                return;
              }
            }
            onSearchKey(e);
          }}
          placeholder="Search KPI id (e.g. 108), system, LoB, person…"
          className="h-7 w-[260px] text-xs bg-secondary border border-border rounded pl-7 pr-6 focus:outline-none focus:border-primary/50"
        />
        {filters.searchQuery && (
          <button
            onClick={() => setFilters(f => ({ ...f, searchQuery: '' }))}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-accent rounded"
            aria-label="Clear search"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        {searchFocused && (
          <GlobalSearchSuggest
            query={filters.searchQuery}
            rows={allData}
            lobs={registries.lobs}
            systems={registries.systems}
            processes={registries.processes}
            recents={recents}
            onPick={commitPick}
            onPickRecent={commitRecent}
            onRemoveRecent={removeRecent}
            onClearAll={clearAllRecents}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            registerItems={setItemCount}
          />
        )}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Role */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Role</span>
        <Select value={filters.role} onValueChange={(v) => setFilters(f => ({ ...f, role: v as Role }))}>
          <SelectTrigger className="h-7 text-xs w-[200px] bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABEL) as Role[]).map(k => (
              <SelectItem key={k} value={k} className="text-xs">{ROLE_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Date presets + custom */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Date</span>
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => setFilters(f => ({ ...f, datePreset: p, customFrom: null, customTo: null }))}
            className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors',
              filters.datePreset === p
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-secondary border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {p}
          </button>
        ))}
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 transition-colors',
                filters.datePreset === 'CUSTOM'
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-secondary border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <CalendarIcon className="h-3 w-3" />
              {filters.datePreset === 'CUSTOM' && filters.customFrom && filters.customTo
                ? `${format(filters.customFrom, 'MMM d HH:mm')} → ${format(filters.customTo, 'MMM d HH:mm')}`
                : 'Custom'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 pointer-events-auto" align="start">
            <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">From</div>
            <Calendar mode="single" selected={filters.customFrom ?? undefined}
              onSelect={(d) => d && setFilters(f => ({ ...f, datePreset: 'CUSTOM', customFrom: d }))}
              className="pointer-events-auto" />
            <div className="text-[10px] text-muted-foreground mt-2 mb-1 uppercase tracking-wider">From hour</div>
            <input type="number" min={0} max={23} defaultValue={0}
              onChange={(e) => filters.customFrom && setFilters(f => {
                const d = new Date(f.customFrom!); d.setHours(Number(e.target.value));
                return { ...f, customFrom: d };
              })}
              className="w-16 h-7 text-xs bg-secondary border border-border rounded px-2" />
            <div className="text-[10px] text-muted-foreground mt-3 mb-2 uppercase tracking-wider">To</div>
            <Calendar mode="single" selected={filters.customTo ?? undefined}
              onSelect={(d) => d && setFilters(f => ({ ...f, datePreset: 'CUSTOM', customTo: d }))}
              className="pointer-events-auto" />
            <div className="text-[10px] text-muted-foreground mt-2 mb-1 uppercase tracking-wider">To hour</div>
            <input type="number" min={0} max={23} defaultValue={23}
              onChange={(e) => filters.customTo && setFilters(f => {
                const d = new Date(f.customTo!); d.setHours(Number(e.target.value));
                return { ...f, customTo: d };
              })}
              className="w-16 h-7 text-xs bg-secondary border border-border rounded px-2" />
          </PopoverContent>
        </Popover>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* LoB with tooltip (was Departments) */}
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-0.5 cursor-help">
              LoB <Info className="h-2.5 w-2.5 opacity-60" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Line of Business</TooltipContent>
        </Tooltip>
        <MultiSelect
          options={FILTER_OPTIONS.LOBS} selected={filters.lobs}
          onToggle={v => toggleArr('lobs', v)} onClear={() => clearArr('lobs')}
        />
      </div>

      <MultiFilter label="Systems" options={FILTER_OPTIONS.SYSTEMS} selected={filters.systems}
        onToggle={v => toggleArr('systems', v)} onClear={() => clearArr('systems')} />
      <MultiFilter label="Process" options={FILTER_OPTIONS.PROCESSES} selected={filters.processes}
        onToggle={v => toggleArr('processes', v)} onClear={() => clearArr('processes')} />

      <div className="w-px h-5 bg-border" />

      {/* State Flags */}
      <MultiFilter label="State" options={FILTER_OPTIONS.STATE_FLAGS} selected={filters.stateFlags}
        onToggle={v => toggleArr('stateFlags', v as StateFlag)} onClear={() => clearArr('stateFlags')} />

      {/* RAG chips */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">RAG</span>
        {FILTER_OPTIONS.RAG_STATES.map(s => {
          const active = filters.ragStates.includes(s);
          return (
            <button
              key={s}
              onClick={() => toggleArr('ragStates', s)}
              className={cn(
                'text-[9px] font-semibold font-mono px-1.5 py-0.5 rounded border transition-all',
                active ? RAG_COLORS[s] : 'bg-secondary border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {RAG_SHORT[s]}
            </button>
          );
        })}
      </div>

      {/* Severity chips */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sev</span>
        {FILTER_OPTIONS.SEVERITIES.map(s => {
          const active = filters.severities.includes(s);
          const color = s === 'Critical' ? 'rag-red border-rag-red' : s === 'High' ? 'rag-amber border-rag-amber' : s === 'Medium' ? 'text-chart-5 border-chart-5' : 'text-muted-foreground border-border';
          return (
            <button
              key={s}
              onClick={() => toggleArr('severities', s as Severity)}
              title={s}
              className={cn(
                'text-[9px] font-semibold px-1.5 py-0.5 rounded border transition-all',
                active ? `${color} bg-accent/40` : 'bg-secondary border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {s[0]}
            </button>
          );
        })}
      </div>

      {/* Impact tier chips */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-0.5 cursor-help">
              Impact <Info className="h-2.5 w-2.5 opacity-60" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[280px]">
            Business impact tier · fixed when KPI is created. T1 = customer-facing critical, T4 = back-office.
          </TooltipContent>
        </Tooltip>
        {(['T1', 'T2', 'T3', 'T4'] as ImpactTier[]).map(t => {
          const active = filters.impacts.includes(t);
          const color = t === 'T1' ? 'rag-red border-rag-red' : t === 'T2' ? 'rag-amber border-rag-amber' : t === 'T3' ? 'text-chart-5 border-chart-5' : 'text-muted-foreground border-border';
          return (
            <button
              key={t}
              onClick={() => toggleArr('impacts', t)}
              title={IMPACT_LABEL[t]}
              className={cn(
                'text-[9px] font-semibold font-mono px-1.5 py-0.5 rounded border transition-all',
                active ? `${color} bg-accent/40` : 'bg-secondary border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {greyCount > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rag-grey rag-grey font-semibold">
            {greyCount} GREY
          </span>
        )}
        {breachCount > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rag-red rag-red font-semibold">
            {breachCount} breaches
          </span>
        )}
        <span className="text-[10px] text-muted-foreground font-mono">{filteredData.length.toLocaleString()} records</span>
      </div>
    </div>
  );
}

function MultiFilter({ label, options, selected, onToggle, onClear }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void; onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      <MultiSelect options={options} selected={selected} onToggle={onToggle} onClear={onClear} />
    </div>
  );
}

function MultiSelect({ options, selected, onToggle, onClear }: {
  options: string[]; selected: string[]; onToggle: (v: string) => void; onClear: () => void;
}) {
  return (
    <Select value="__placeholder" onValueChange={(v) => v !== '__placeholder' && onToggle(v)}>
      <SelectTrigger className="h-7 text-xs w-[130px] bg-secondary border-border">
        <span className={cn('truncate', selected.length === 0 && 'text-muted-foreground')}>
          {selected.length === 0 ? 'All' : `${selected.length} selected`}
        </span>
      </SelectTrigger>
      <SelectContent>
        {selected.length > 0 && (
          <button onClick={onClear} className="w-full text-left px-2 py-1 text-xs text-primary hover:bg-accent">
            Clear all
          </button>
        )}
        {options.map(o => (
          <SelectItem key={o} value={o} className="text-xs">
            <span className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full border border-border', selected.includes(o) && 'bg-primary border-primary')} />
              {o}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ExportItem({ title, subtitle, onClick, disabled }: {
  title: string; subtitle: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full text-left px-2 py-1.5 rounded hover:bg-accent transition-colors',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
      )}
    >
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <div className="text-[10px] text-muted-foreground">{subtitle}</div>
    </button>
  );
}

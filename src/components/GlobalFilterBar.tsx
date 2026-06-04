import { useFilters, FILTER_OPTIONS, DatePreset } from '@/lib/filterContext';
import { ROLE_LABEL } from '@/lib/rbac';
import { Role } from '@/lib/filterContext';
import { RagState, Severity, StateFlag } from '@/lib/mockData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon, Info, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

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
  const { filters, setFilters, filteredData } = useFilters();
  const [customOpen, setCustomOpen] = useState(false);

  const toggleArr = <K extends 'lobs' | 'systems' | 'processes' | 'stateFlags' | 'ragStates' | 'severities'>(
    key: K, value: string,
  ) => {
    setFilters(f => {
      const arr = f[key] as string[];
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      return { ...f, [key]: next } as typeof f;
    });
  };
  const clearArr = (key: 'lobs' | 'systems' | 'processes' | 'stateFlags' | 'ragStates' | 'severities') =>
    setFilters(f => ({ ...f, [key]: [] }));

  const breachCount = filteredData.filter(r => r.status === 'BREACHED').length;
  const greyCount = filteredData.filter(r => r.ragState === 'GREY').length;

  return (
    <div className="border-b border-border bg-card px-3 py-2 flex items-center gap-2 flex-wrap">
      {/* Global search */}
      <div className="relative">
        <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={filters.searchQuery}
          onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
          placeholder="Search KPI, system, LoB, assignee, hash…"
          className="h-7 w-[240px] text-xs bg-secondary border border-border rounded pl-7 pr-6 focus:outline-none focus:border-primary/50"
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
              {s === 'UNCONFIGURED' ? 'UNC' : s.slice(0, 3)}
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

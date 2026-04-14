import { useFilters, FILTER_OPTIONS, Persona } from '@/lib/filterContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PERSONA_LABELS: Record<Persona, string> = {
  leadership: 'Leadership / Executives',
  techops: 'Tech Ops (DevOps/IT)',
  compliance: 'Compliance & Risk (Auditors)',
};

export function GlobalFilterBar() {
  const { filters, setFilters, filteredData } = useFilters();

  const toggleArrayFilter = (key: 'departments' | 'systems' | 'processes', value: string) => {
    setFilters((f) => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  const clearFilter = (key: 'departments' | 'systems' | 'processes') => {
    setFilters((f) => ({ ...f, [key]: [] }));
  };

  const breachCount = filteredData.filter(r => r.status === 'BREACHED').length;

  return (
    <div className="border-b border-border bg-card px-4 py-2 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Persona</span>
        <Select value={filters.persona} onValueChange={(v) => setFilters((f) => ({ ...f, persona: v as Persona }))}>
          <SelectTrigger className="h-7 text-xs w-[180px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERSONA_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-5 bg-border" />

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Period</span>
        <Select value={String(filters.dateRange)} onValueChange={(v) => setFilters((f) => ({ ...f, dateRange: Number(v) as 30 | 60 | 90 }))}>
          <SelectTrigger className="h-7 text-xs w-[100px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30" className="text-xs">30 Days</SelectItem>
            <SelectItem value="60" className="text-xs">60 Days</SelectItem>
            <SelectItem value="90" className="text-xs">90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-5 bg-border" />

      <MultiFilter
        label="Departments"
        options={FILTER_OPTIONS.DEPARTMENTS}
        selected={filters.departments}
        onToggle={(v) => toggleArrayFilter('departments', v)}
        onClear={() => clearFilter('departments')}
      />
      <MultiFilter
        label="Systems"
        options={FILTER_OPTIONS.SYSTEMS}
        selected={filters.systems}
        onToggle={(v) => toggleArrayFilter('systems', v)}
        onClear={() => clearFilter('systems')}
      />
      <MultiFilter
        label="Processes"
        options={FILTER_OPTIONS.PROCESSES}
        selected={filters.processes}
        onToggle={(v) => toggleArrayFilter('processes', v)}
        onClear={() => clearFilter('processes')}
      />

      <div className="ml-auto flex items-center gap-3">
        {breachCount > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rag-red rag-red font-semibold">
            {breachCount} breaches
          </span>
        )}
        <span className="text-[10px] text-muted-foreground font-mono">
          {filteredData.length.toLocaleString()} records
        </span>
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
      <Select value="__placeholder" onValueChange={(v) => { if (v !== '__placeholder') onToggle(v); }}>
        <SelectTrigger className="h-7 text-xs w-[140px] bg-secondary border-border">
          <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
            {selected.length === 0 ? 'All' : `${selected.length} selected`}
          </span>
        </SelectTrigger>
        <SelectContent>
          {selected.length > 0 && (
            <button onClick={onClear} className="w-full text-left px-2 py-1 text-xs text-primary hover:bg-accent">
              Clear all
            </button>
          )}
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-xs">
              <span className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full border border-border", selected.includes(o) && "bg-primary border-primary")} />
                {o}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

import { Shield, Flame, Network, Flag, MinusCircle, FileCheck, ServerCog, Play, Activity } from 'lucide-react';
import { useFilters, Role } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { KPIRow, RagState } from '@/lib/mockData';

type Scenario = {
  id: string;
  label: string;
  blurb: string;
  icon: any;
  role: Role;
  pick: (rows: KPIRow[]) => KPIRow | undefined;
  ragStates?: RagState[];
  severities?: any[];
};

const SCENARIOS: Scenario[] = [
  {
    id: 'critical-breach',
    label: 'Critical Breach E2E',
    blurb: 'Exec spots RED → drilldown → SPOC actions',
    icon: Flame,
    role: 'executive',
    ragStates: ['RED'],
    pick: (rows) => rows.find(r => r.ragState === 'RED' && r.severity === 'Critical') || rows.find(r => r.ragState === 'RED'),
  },
  {
    id: 'multi-team',
    label: 'Multi-Team Dependency',
    blurb: 'SPOC view with active cross-team case',
    icon: Network,
    role: 'spoc',
    pick: (rows) => rows.find(r => r.dependency) || rows.find(r => r.ragState === 'RED'),
  },
  {
    id: 'exec-flag',
    label: 'Executive Flag Override',
    blurb: 'Auto timers nullified by leadership',
    icon: Flag,
    role: 'executive',
    pick: (rows) => rows.find(r => r.executiveFlag),
  },
  {
    id: 'grey-blue',
    label: 'Grey / Blue States',
    blurb: 'Data-starved & maintenance windows',
    icon: MinusCircle,
    role: 'executive',
    ragStates: ['GREY', 'BLUE'],
    pick: (rows) => rows.find(r => r.ragState === 'GREY') || rows.find(r => r.ragState === 'BLUE'),
  },
  {
    id: 'compliance',
    label: 'Compliance Audit Ledger',
    blurb: 'Immutable hashes & export trail',
    icon: FileCheck,
    role: 'compliance',
    pick: () => undefined,
  },
  {
    id: 'admin-health',
    label: 'Admin Connector Health',
    blurb: 'Connector outages & registry control',
    icon: ServerCog,
    role: 'admin',
    pick: () => undefined,
  },
];

export function AppSidebar() {
  const { filters, setFilters, allData, openDrilldown } = useFilters();

  const runScenario = (s: Scenario) => {
    setFilters(f => ({
      ...f,
      role: s.role,
      ragStates: s.ragStates ?? [],
      severities: s.severities ?? [],
      lobs: [], systems: [], processes: [], stateFlags: [],
      searchQuery: '',
      datePreset: '30D',
    }));
    const row = s.pick(allData);
    if (row) {
      // Defer so view mounts before drilldown opens
      setTimeout(() => openDrilldown('breach', row.id, row), 50);
    }
  };

  return (
    <aside className="w-14 hover:w-64 transition-all duration-200 bg-sidebar border-r border-sidebar-border flex flex-col group overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-sidebar-border">
        <Shield className="h-5 w-5 text-primary shrink-0" />
        <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-xs font-semibold text-sidebar-accent-foreground">GovShield</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Demo Scenarios</div>
        </div>
      </div>

      <nav className="flex-1 py-2 space-y-0.5">
        {SCENARIOS.map((s) => {
          const active = filters.role === s.role;
          return (
            <button
              key={s.id}
              onClick={() => runScenario(s)}
              title={`${s.label} — ${s.blurb}`}
              className={cn(
                'w-full flex items-start gap-2 px-3 py-2 text-xs transition-colors text-left',
                active
                  ? 'bg-sidebar-accent text-primary border-l-2 border-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent',
              )}
            >
              <s.icon className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity min-w-0">
                <div className="flex items-center gap-1 font-semibold">
                  <Play className="h-2.5 w-2.5" />
                  <span className="truncate">{s.label}</span>
                </div>
                <div className="text-[9px] text-muted-foreground truncate">{s.blurb}</div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-2 border-t border-sidebar-border flex items-center gap-2">
        <Activity className="h-4 w-4 rag-green shrink-0" />
        <span className="text-[10px] text-sidebar-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Click any scenario to launch
        </span>
      </div>
    </aside>
  );
}

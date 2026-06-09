import { Shield, LayoutDashboard, LineChart, Wrench, Flag, FileCheck, ServerCog, Siren, Play, Activity } from 'lucide-react';
import { useFilters, Role } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { KPIRow, RagState, Severity } from '@/lib/mockData';

type Scenario = {
  id: string;
  num: number;
  label: string;
  blurb: string;
  icon: any;
  role?: Role;
  ragStates?: RagState[];
  severities?: Severity[];
  pick?: (rows: KPIRow[]) => KPIRow | undefined;
  wallboard?: boolean;
};

const SCENARIOS: Scenario[] = [
  {
    id: 's1', num: 1, label: 'Macro-Control Board', icon: LayoutDashboard,
    blurb: '5-state KPI tiles · LoB tabs · live indicator',
    role: 'executive',
  },
  {
    id: 's2', num: 2, label: 'Dynamic Control Chart', icon: LineChart,
    blurb: 'Trendline · SLA limit · debounce timer',
    role: 'executive',
    pick: (rows) => rows.find(r => r.ragState === 'AMBER') || rows.find(r => r.ragState === 'RED'),
  },
  {
    id: 's3', num: 3, label: 'Diagnostic — SPOC', icon: Wrench,
    blurb: 'Acknowledge · RCA · dependency toggle',
    role: 'spoc',
    pick: (rows) =>
      rows.find(r => r.ragState === 'RED' && r.resolutionStatus === 'Open' && !r.executiveFlag)
      || rows.find(r => r.ragState === 'RED'),
  },
  {
    id: 's4', num: 4, label: 'Diagnostic — Exec/LoB', icon: Flag,
    blurb: 'Read-only · Executive Flag prominent',
    role: 'executive',
    pick: (rows) => rows.find(r => r.executiveFlag) || rows.find(r => r.ragState === 'RED' && r.severity === 'Critical'),
  },
  {
    id: 's5', num: 5, label: 'Compliance / Auditor / Analyst', icon: FileCheck,
    blurb: 'WORM ledger · SLA% trend · SHA-256 export',
    role: 'compliance',
  },
  {
    id: 's6', num: 6, label: 'Admin Configuration', icon: ServerCog,
    blurb: 'SLA editor · API keys · connector health',
    role: 'admin',
  },
  {
    id: 's7', num: 7, label: 'NOC Wallboard', icon: Siren,
    blurb: 'Blackout overlay · OOB SMS · siren',
    wallboard: true,
  },
];

export function AppSidebar({ onLaunchWallboard, activeWallboard }: {
  onLaunchWallboard: () => void;
  activeWallboard: boolean;
}) {
  const { filters, setFilters, allData, openDrilldown, closeDrilldown } = useFilters();

  const runScenario = (s: Scenario) => {
    if (s.wallboard) { onLaunchWallboard(); return; }

    setFilters(f => ({
      ...f,
      role: s.role ?? f.role,
      ragStates: s.ragStates ?? [],
      severities: s.severities ?? [],
      lobs: [], systems: [], processes: [], stateFlags: [],
      searchQuery: '',
      datePreset: '30D',
    }));

    if (s.pick) {
      const row = s.pick(allData);
      if (row) {
        setTimeout(() => openDrilldown('breach', row.id, row), 60);
        return;
      }
    }
    closeDrilldown();
  };

  return (
    <aside className="w-14 hover:w-64 transition-all duration-200 bg-sidebar border-r border-sidebar-border flex flex-col group overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-sidebar-border">
        <Shield className="h-5 w-5 text-primary shrink-0" />
        <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-xs font-semibold text-sidebar-accent-foreground">GovShield</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Demo Screens · 7</div>
        </div>
      </div>

      <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {SCENARIOS.map((s) => {
          const isActive = s.wallboard ? activeWallboard : (filters.role === s.role && !activeWallboard);
          return (
            <button
              key={s.id}
              onClick={() => runScenario(s)}
              title={`Screen ${s.num} — ${s.label}: ${s.blurb}`}
              className={cn(
                'w-full flex items-start gap-2 px-3 py-2 text-xs transition-colors text-left',
                isActive
                  ? 'bg-sidebar-accent text-primary border-l-2 border-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent',
              )}
            >
              <div className="relative shrink-0 mt-0.5">
                <s.icon className="h-4 w-4" />
                <span className="absolute -top-1.5 -right-2 text-[8px] font-bold text-muted-foreground">{s.num}</span>
              </div>
              <div className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity min-w-0 flex-1">
                <div className="flex items-center gap-1 font-semibold">
                  <Play className="h-2.5 w-2.5 shrink-0" />
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
          Click to launch screen
        </span>
      </div>
    </aside>
  );
}

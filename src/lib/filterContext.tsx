import React, { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect } from 'react';
import { generateMockData, KPIRow, FILTER_OPTIONS, RagState, Severity, StateFlag, LedgerEntry, SlaVersionRecord, ImpactTier, getImpactTier } from './mockData';

export type Role = 'executive' | 'lobManager' | 'spoc' | 'compliance' | 'analyst' | 'admin';

export type DatePreset = '1H' | '24H' | '7D' | '30D' | '60D' | '90D' | 'CUSTOM';

export type FilterState = {
  role: Role;
  datePreset: DatePreset;
  customFrom: Date | null;
  customTo: Date | null;
  lobs: string[];
  systems: string[];
  processes: string[];
  stateFlags: StateFlag[];
  ragStates: RagState[];
  severities: Severity[];
  impacts: ImpactTier[];
  searchQuery: string;
};

type DrilldownState = {
  type: 'system' | 'process' | 'lob' | 'breach' | 'matrixCell' | null;
  value: string | null;          // for matrixCell: "system||process"
  row: KPIRow | null;
};

export type HistoryView = {
  pivot: KPIRow;
  rows: KPIRow[];
} | null;

export type ConfigSnapshot = {
  id: string;                    // snapshot id (e.g. SLA_v1.3)
  capturedAt: string;
  thresholds: Record<string, number>;  // KPI-id → threshold at snapshot time
  ragRules: string;              // human-readable summary
};

export type Registries = {
  lobs: string[];
  systems: string[];
  processes: string[];
};

type Ctx = {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  filteredData: KPIRow[];
  allData: KPIRow[];
  historyView: HistoryView;
  drilldown: DrilldownState;
  drilldownStack: DrilldownState[];
  openDrilldown: (type: DrilldownState['type'], value: string | null, row?: KPIRow | null) => void;
  popDrilldown: () => void;
  closeDrilldown: () => void;
  mutateRow: (id: string, patch: Partial<KPIRow>) => void;

  // Admin authoring
  registries: Registries;
  addLob: (name: string, actor: string) => void;
  addSystem: (name: string, actor: string) => void;
  addKpi: (input: AddKpiInput, actor: string) => void;

  // Ledgers + config integrity
  masterLedger: LedgerEntry[];
  lobLedgers: Record<string, LedgerEntry[]>;
  systemLedgers: Record<string, LedgerEntry[]>;
  configSnapshots: ConfigSnapshot[];
};

export type AddKpiInput = {
  lob: string;
  system: string;
  process: string;
  source: string;
  targetSLA: number;
  severity: Severity;
  spoc: string;
  configFile: string;
};

const FilterContext = createContext<Ctx | null>(null);
export function useFilters() {
  const c = useContext(FilterContext);
  if (!c) throw new Error('useFilters must be inside FilterProvider');
  return c;
}

const seedData = generateMockData(1800);
const BASELINE = new Date(2026, 4, 14);

function presetToCutoff(p: DatePreset): Date {
  const d = new Date(BASELINE.getTime());
  switch (p) {
    case '1H':  d.setHours(d.getHours() - 1); break;
    case '24H': d.setDate(d.getDate() - 1);   break;
    case '7D':  d.setDate(d.getDate() - 7);   break;
    case '30D': d.setDate(d.getDate() - 30);  break;
    case '60D': d.setDate(d.getDate() - 60);  break;
    case '90D': d.setDate(d.getDate() - 90);  break;
  }
  return d;
}

function fakeHash(prefix = 'LDG') {
  const hex = 'abcdef0123456789';
  let h = '';
  for (let i = 0; i < 16; i++) h += hex[Math.floor(Math.random() * 16)];
  return `${prefix}-${h}`;
}
function newEntry(action: string, actor: string, details?: string): LedgerEntry {
  return { timestamp: new Date().toISOString(), actor, action, hash: fakeHash('LDG'), details };
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [allData, setAllData] = useState<KPIRow[]>(seedData);
  const [filters, setFilters] = useState<FilterState>({
    role: 'executive',
    datePreset: '30D',
    customFrom: null,
    customTo: null,
    lobs: [],
    systems: [],
    processes: [],
    stateFlags: [],
    ragStates: [],
    severities: [],
    impacts: [],
    searchQuery: '',
  });
  const [drilldown, setDrilldown] = useState<DrilldownState>({ type: null, value: null, row: null });
  const [drilldownStack, setDrilldownStack] = useState<DrilldownState[]>([]);

  const [registries, setRegistries] = useState<Registries>({
    lobs: [...FILTER_OPTIONS.LOBS],
    systems: [...FILTER_OPTIONS.SYSTEMS],
    processes: [...FILTER_OPTIONS.PROCESSES],
  });

  const [masterLedger, setMasterLedger] = useState<LedgerEntry[]>([
    newEntry('Platform Initialized', 'System', `${seedData.length.toLocaleString()} KPIs hydrated`),
  ]);
  const [lobLedgers, setLobLedgers] = useState<Record<string, LedgerEntry[]>>({});
  const [systemLedgers, setSystemLedgers] = useState<Record<string, LedgerEntry[]>>({});

  const [configSnapshots, setConfigSnapshots] = useState<ConfigSnapshot[]>(() => {
    const versions = ['SLA_v1.0', 'SLA_v1.1', 'SLA_v1.2', 'SLA_v1.3'];
    return versions.map((v, i) => ({
      id: v,
      capturedAt: `2026-0${i + 1}-01T00:00:00.000Z`,
      thresholds: {},
      ragRules: ['Initial baseline thresholds',
                 'Tightened API latency 500→400ms',
                 'Added KYC failure debounce 3m',
                 'Festival peak contextual profile'][i],
    }));
  });

  const openDrilldown = useCallback((type: DrilldownState['type'], value: string | null, row?: KPIRow | null) => {
    setDrilldown(prev => {
      if (prev.type) setDrilldownStack(s => [...s.slice(-2), prev]); // keep last 3
      return { type, value, row: row ?? null };
    });
  }, []);
  const popDrilldown = useCallback(() => {
    setDrilldownStack(s => {
      if (s.length === 0) { setDrilldown({ type: null, value: null, row: null }); return s; }
      const prev = s[s.length - 1];
      setDrilldown(prev);
      return s.slice(0, -1);
    });
  }, []);
  const closeDrilldown = useCallback(() => {
    setDrilldown({ type: null, value: null, row: null });
    setDrilldownStack([]);
  }, []);

  // B2: Executive Flag auto-expiry sweep (24h)
  useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      setAllData(prev => {
        let changed = false;
        const next = prev.map(r => {
          if (r.executiveFlag && r.executiveFlagSetAt) {
            const ageH = (now - new Date(r.executiveFlagSetAt).getTime()) / 3600000;
            if (ageH > 24) {
              changed = true;
              const entry = newEntry('Executive Flag auto-expired (24h)', 'System', `KPI ${r.id} · flag cleared after timeout`);
              setMasterLedger(m => [...m, entry]);
              return { ...r, executiveFlag: false, executiveFlagSetAt: null, ledgerEntries: [...r.ledgerEntries, entry] };
            }
          }
          return r;
        });
        return changed ? next : prev;
      });
    };
    sweep();
    const t = setInterval(sweep, 60_000);
    return () => clearInterval(t);
  }, []);

  // Dependency cascade sweep — flip a small fraction of open child sub-tickets
  // to "resolved" each tick so the auto-suggest banner shows up live during a demo.
  useEffect(() => {
    const sweep = () => {
      setAllData(prev => {
        let changed = false;
        const nowIso = new Date().toISOString();
        const next = prev.map(r => {
          if (!r.dependency || r.dependency.status !== 'open') return r;
          if (r.resolutionStatus === 'Resolved' || r.status === 'CLEAN') return r;
          if (Math.random() > 0.03) return r;            // ~3% per tick
          changed = true;
          const entry = newEntry(
            `Linked child ${r.dependency.linkedId} resolved by ${r.dependency.team}`,
            'System · Dependency Bridge',
            'Child sub-ticket closed — parent eligible for cascade close',
          );
          setMasterLedger(m => [...m, entry]);
          return {
            ...r,
            dependency: {
              ...r.dependency,
              status: 'resolved' as const,
              resolvedAt: nowIso,
              resolvedBy: `${r.dependency.team} on-call`,
            },
            ledgerEntries: [...r.ledgerEntries, entry],
          };
        });
        return changed ? next : prev;
      });
    };
    const t = setInterval(sweep, 60_000);
    return () => clearInterval(t);
  }, []);

  const appendMaster = useCallback((e: LedgerEntry) => setMasterLedger(prev => [...prev, e]), []);

  const mutateRow = useCallback((id: string, patch: Partial<KPIRow>) => {
    setAllData(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    setDrilldown(d => d.row && d.row.id === id ? { ...d, row: { ...d.row, ...patch } as KPIRow } : d);
  }, []);

  const addLob = useCallback((name: string, actor: string) => {
    if (!name || registries.lobs.includes(name)) return;
    setRegistries(r => ({ ...r, lobs: [...r.lobs, name] }));
    const e = newEntry('LoB Created', actor, `name=${name}`);
    setLobLedgers(prev => ({ ...prev, [name]: [e] }));
    appendMaster(e);
  }, [registries.lobs, appendMaster]);

  const addSystem = useCallback((name: string, actor: string) => {
    if (!name || registries.systems.includes(name)) return;
    setRegistries(r => ({ ...r, systems: [...r.systems, name] }));
    const e = newEntry('System / Department Created', actor, `name=${name}`);
    setSystemLedgers(prev => ({ ...prev, [name]: [e] }));
    appendMaster(e);
  }, [registries.systems, appendMaster]);

  const addKpi = useCallback((input: AddKpiInput, actor: string) => {
    const id = `KPI-${90000 + Math.floor(Math.random() * 9999)}`;
    const ts = new Date().toISOString();
    const snapshotId = configSnapshots[configSnapshots.length - 1]?.id ?? 'SLA_v1.0';
    const initialHistory: SlaVersionRecord[] = [{
      version: snapshotId,
      activeFrom: ts,
      changedBy: actor,
      threshold: input.targetSLA,
      changeNote: `Initial config · file=${input.configFile} · SPOC=${input.spoc}`,
    }];
    const ledger: LedgerEntry[] = [
      newEntry('KPI Created', actor, `id=${id} · LoB=${input.lob} · system=${input.system} · process=${input.process} · target=${input.targetSLA} · file=${input.configFile}`),
    ];
    const row: KPIRow = {
      id, date: ts.slice(0, 10), timestamp: ts,
      lob: input.lob as any, system: input.system, process: input.process,
      source: input.source, baseVolume: 0, breaches: 0, failureRate: 0,
      targetSLA: input.targetSLA, slaVersion: snapshotId, slaHistory: initialHistory,
      configSnapshotId: snapshotId,
      ragState: 'UNCONFIGURED', status: 'CLEAN', resolutionStatus: 'Clean',
      stateFlags: ['Unconfigured'],
      assignee: { name: input.spoc, role: 'KPI SPOC' },
      escalations: [], comments: [], chaseTimeline: [], dependency: null,
      executiveFlag: false, executiveFlagSetAt: null, auditLedgerId: fakeHash('LDG'),
      maintenanceWindow: null,
      timeToDetectMin: null, timeToEscalateMin: null, timeToResolveMin: null,
      resolvedBy: null, severity: input.severity, impactTier: getImpactTier(input.lob, input.system), urgencyScore: 1, riskScore: 0,
      ledgerEntries: ledger,
    };
    setAllData(prev => [row, ...prev]);
    // Ensure registry contains LoB/system
    setRegistries(r => ({
      ...r,
      lobs: r.lobs.includes(input.lob) ? r.lobs : [...r.lobs, input.lob],
      systems: r.systems.includes(input.system) ? r.systems : [...r.systems, input.system],
      processes: r.processes.includes(input.process) ? r.processes : [...r.processes, input.process],
    }));
    setLobLedgers(prev => ({
      ...prev,
      [input.lob]: [...(prev[input.lob] ?? []), newEntry('KPI Attached', actor, `→ ${id}`)],
    }));
    setSystemLedgers(prev => ({
      ...prev,
      [input.system]: [...(prev[input.system] ?? []), newEntry('KPI Attached', actor, `→ ${id}`)],
    }));
    appendMaster(newEntry('KPI Created', actor, `${id} · ${input.lob}/${input.system}/${input.process} · snapshot=${snapshotId}`));
  }, [configSnapshots, appendMaster]);

  const filteredData = useMemo(() => {
    const cutoffStart = filters.datePreset === 'CUSTOM' && filters.customFrom
      ? filters.customFrom
      : presetToCutoff(filters.datePreset);
    const cutoffEnd = filters.datePreset === 'CUSTOM' && filters.customTo
      ? filters.customTo
      : BASELINE;

    const q = filters.searchQuery.trim().toLowerCase();

    return allData.filter((row) => {
      const t = new Date(row.timestamp).getTime();
      if (t < cutoffStart.getTime() || t > cutoffEnd.getTime()) return false;
      if (filters.lobs.length && !filters.lobs.includes(row.lob)) return false;
      if (filters.systems.length && !filters.systems.includes(row.system)) return false;
      if (filters.processes.length && !filters.processes.includes(row.process)) return false;
      if (filters.ragStates.length && !filters.ragStates.includes(row.ragState)) return false;
      if (filters.severities.length && (row.status !== 'BREACHED' || !filters.severities.includes(row.severity))) return false;
      if (filters.impacts.length && !filters.impacts.includes(row.impactTier)) return false;
      if (filters.stateFlags.length && !filters.stateFlags.some(f => row.stateFlags.includes(f))) return false;
      if (q) {
        const hay = `${row.id} ${row.system} ${row.process} ${row.lob} ${row.assignee?.name ?? ''} ${row.auditLedgerId} ${row.resolutionStatus}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filters, allData]);

  const historyView = useMemo<HistoryView>(() => {
    const q = filters.searchQuery.trim().toLowerCase();
    if (!q.startsWith('kpi-')) return null;
    const pivot = allData.find(r => r.id.toLowerCase() === q);
    if (!pivot) return null;
    const rows = allData
      .filter(r => r.system === pivot.system && r.process === pivot.process && r.lob === pivot.lob)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return { pivot, rows };
  }, [filters.searchQuery, allData]);

  return (
    <FilterContext.Provider value={{
      filters, setFilters, filteredData, allData, historyView,
      drilldown, drilldownStack, openDrilldown, popDrilldown, closeDrilldown, mutateRow,
      registries, addLob, addSystem, addKpi,
      masterLedger, lobLedgers, systemLedgers, configSnapshots,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export { FILTER_OPTIONS };

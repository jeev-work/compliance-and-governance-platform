import React, { createContext, useContext, useState, useMemo, ReactNode, useCallback } from 'react';
import { generateMockData, KPIRow, FILTER_OPTIONS, RagState, Severity, StateFlag } from './mockData';

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
};

type DrilldownState = {
  type: 'system' | 'process' | 'lob' | 'breach' | null;
  value: string | null;
  row: KPIRow | null;
};

type Ctx = {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  filteredData: KPIRow[];
  allData: KPIRow[];
  drilldown: DrilldownState;
  openDrilldown: (type: DrilldownState['type'], value: string | null, row?: KPIRow | null) => void;
  closeDrilldown: () => void;
  /** In-memory mutation for demo actions (acknowledge / deploy / exec flag / fork) */
  mutateRow: (id: string, patch: Partial<KPIRow>) => void;
};

const FilterContext = createContext<Ctx | null>(null);
export function useFilters() {
  const c = useContext(FilterContext);
  if (!c) throw new Error('useFilters must be inside FilterProvider');
  return c;
}

// Generate once
const seedData = generateMockData(30000);
const BASELINE = new Date(2026, 4, 14); // matches mockData

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
  });
  const [drilldown, setDrilldown] = useState<DrilldownState>({ type: null, value: null, row: null });

  const openDrilldown = useCallback((type: DrilldownState['type'], value: string | null, row?: KPIRow | null) => {
    setDrilldown({ type, value, row: row ?? null });
  }, []);
  const closeDrilldown = useCallback(() => setDrilldown({ type: null, value: null, row: null }), []);

  const mutateRow = useCallback((id: string, patch: Partial<KPIRow>) => {
    setAllData(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    setDrilldown(d => d.row && d.row.id === id ? { ...d, row: { ...d.row, ...patch } as KPIRow } : d);
  }, []);

  const filteredData = useMemo(() => {
    const cutoffStart = filters.datePreset === 'CUSTOM' && filters.customFrom
      ? filters.customFrom
      : presetToCutoff(filters.datePreset);
    const cutoffEnd = filters.datePreset === 'CUSTOM' && filters.customTo
      ? filters.customTo
      : BASELINE;

    return allData.filter((row) => {
      const t = new Date(row.timestamp).getTime();
      if (t < cutoffStart.getTime() || t > cutoffEnd.getTime()) return false;
      if (filters.lobs.length && !filters.lobs.includes(row.lob)) return false;
      if (filters.systems.length && !filters.systems.includes(row.system)) return false;
      if (filters.processes.length && !filters.processes.includes(row.process)) return false;
      if (filters.ragStates.length && !filters.ragStates.includes(row.ragState)) return false;
      if (filters.severities.length && (row.status !== 'BREACHED' || !filters.severities.includes(row.severity))) return false;
      if (filters.stateFlags.length && !filters.stateFlags.some(f => row.stateFlags.includes(f))) return false;
      return true;
    });
  }, [filters, allData]);

  return (
    <FilterContext.Provider value={{ filters, setFilters, filteredData, allData, drilldown, openDrilldown, closeDrilldown, mutateRow }}>
      {children}
    </FilterContext.Provider>
  );
}

export { FILTER_OPTIONS };

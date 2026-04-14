import React, { createContext, useContext, useState, useMemo, ReactNode, useCallback } from 'react';
import { generateMockData, KPIRow, FILTER_OPTIONS } from './mockData';

export type Persona = 'leadership' | 'techops' | 'compliance';

type FilterState = {
  persona: Persona;
  dateRange: 30 | 60 | 90;
  departments: string[];
  systems: string[];
  processes: string[];
};

type DrilldownState = {
  type: 'system' | 'process' | 'department' | 'breach' | null;
  value: string | null;
  row: KPIRow | null;
};

type FilterContextType = {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  filteredData: KPIRow[];
  allData: KPIRow[];
  drilldown: DrilldownState;
  openDrilldown: (type: DrilldownState['type'], value: string | null, row?: KPIRow | null) => void;
  closeDrilldown: () => void;
};

const FilterContext = createContext<FilterContextType | null>(null);

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be inside FilterProvider');
  return ctx;
}

// Generate once - 30K rows
const allData = generateMockData(30000);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>({
    persona: 'leadership',
    dateRange: 30,
    departments: [],
    systems: [],
    processes: [],
  });

  const [drilldown, setDrilldown] = useState<DrilldownState>({ type: null, value: null, row: null });

  const openDrilldown = useCallback((type: DrilldownState['type'], value: string | null, row?: KPIRow | null) => {
    setDrilldown({ type, value, row: row ?? null });
  }, []);

  const closeDrilldown = useCallback(() => {
    setDrilldown({ type: null, value: null, row: null });
  }, []);

  const filteredData = useMemo(() => {
    const cutoff = new Date(2026, 3, 14); // Use same baseline as mock data
    cutoff.setDate(cutoff.getDate() - filters.dateRange);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return allData.filter((row) => {
      if (row.date < cutoffStr) return false;
      if (filters.departments.length > 0 && !filters.departments.includes(row.department)) return false;
      if (filters.systems.length > 0 && !filters.systems.includes(row.system)) return false;
      if (filters.processes.length > 0 && !filters.processes.includes(row.process)) return false;
      return true;
    });
  }, [filters]);

  return (
    <FilterContext.Provider value={{ filters, setFilters, filteredData, allData, drilldown, openDrilldown, closeDrilldown }}>
      {children}
    </FilterContext.Provider>
  );
}

export { FILTER_OPTIONS };

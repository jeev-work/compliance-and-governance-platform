import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { generateMockData, KPIRow, FILTER_OPTIONS } from './mockData';

export type Persona = 'leadership' | 'techops' | 'compliance';

type FilterState = {
  persona: Persona;
  dateRange: 30 | 60 | 90;
  verticals: string[];
  systems: string[];
  processes: string[];
};

type FilterContextType = {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  filteredData: KPIRow[];
  allData: KPIRow[];
};

const FilterContext = createContext<FilterContextType | null>(null);

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be inside FilterProvider');
  return ctx;
}

const allData = generateMockData(600);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>({
    persona: 'leadership',
    dateRange: 30,
    verticals: [],
    systems: [],
    processes: [],
  });

  const filteredData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.dateRange);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return allData.filter((row) => {
      if (row.date < cutoffStr) return false;
      if (filters.verticals.length > 0 && !filters.verticals.includes(row.vertical)) return false;
      if (filters.systems.length > 0 && !filters.systems.includes(row.system)) return false;
      if (filters.processes.length > 0 && !filters.processes.includes(row.process)) return false;
      return true;
    });
  }, [filters]);

  return (
    <FilterContext.Provider value={{ filters, setFilters, filteredData, allData }}>
      {children}
    </FilterContext.Provider>
  );
}

export { FILTER_OPTIONS };

import { useMemo, useState } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { ChevronUp, ChevronDown } from 'lucide-react';

type SortKey = 'date' | 'vertical' | 'system' | 'process' | 'failureRate' | 'breaches';

export function TechOpsView() {
  const { filteredData } = useFilters();
  const [sortKey, setSortKey] = useState<SortKey>('failureRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const breachBySystem = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach((r) => {
      map.set(r.system, (map.get(r.system) || 0) + r.breaches);
    });
    return Array.from(map.entries())
      .map(([name, breaches]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, breaches, fullName: name }))
      .sort((a, b) => b.breaches - a.breaches);
  }, [filteredData]);

  const breachByProcess = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach((r) => {
      map.set(r.process, (map.get(r.process) || 0) + r.breaches);
    });
    return Array.from(map.entries())
      .map(([name, breaches]) => ({ name: name.length > 14 ? name.slice(0, 14) + '…' : name, breaches, fullName: name }))
      .sort((a, b) => b.breaches - a.breaches);
  }, [filteredData]);

  const sorted = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredData, sortKey, sortDir]);

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />;
  };

  return (
    <div className="space-y-3">
      {/* Top charts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breaches by System</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={breachBySystem} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
              <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215 15% 50%)' }} width={90} />
              <Tooltip contentStyle={{ background: 'hsl(222 44% 8%)', border: '1px solid hsl(222 30% 16%)', fontSize: 11 }} />
              <Bar dataKey="breaches" radius={[0, 2, 2, 0]}>
                {breachBySystem.map((_, i) => (
                  <Cell key={i} fill={i < 3 ? 'hsl(0 72% 51%)' : 'hsl(38 92% 50%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breaches by Process</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={breachByProcess} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
              <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215 15% 50%)' }} width={100} />
              <Tooltip contentStyle={{ background: 'hsl(222 44% 8%)', border: '1px solid hsl(222 30% 16%)', fontSize: 11 }} />
              <Bar dataKey="breaches" radius={[0, 2, 2, 0]}>
                {breachByProcess.map((_, i) => (
                  <Cell key={i} fill={i < 3 ? 'hsl(0 72% 51%)' : 'hsl(38 92% 50%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Exception Log Table */}
      <div className="bg-card border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exception Log</h3>
          <span className="text-[10px] text-muted-foreground font-mono">Page {page + 1}/{totalPages}</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {([['date', 'Date'], ['vertical', 'Vertical'], ['system', 'System'], ['process', 'Process']] as [SortKey, string][]).map(([k, l]) => (
                  <th key={k} className="px-2 py-1.5 text-left font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort(k)}>
                    {l} <SortIcon k={k} />
                  </th>
                ))}
                <th className="px-2 py-1.5 text-left font-medium">Checkpoint</th>
                <th className="px-2 py-1.5 text-right font-medium">Base Vol</th>
                <th className="px-2 py-1.5 text-right font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('breaches')}>
                  Breaches <SortIcon k="breaches" />
                </th>
                <th className="px-2 py-1.5 text-right font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('failureRate')}>
                  Fail % <SortIcon k="failureRate" />
                </th>
                <th className="px-2 py-1.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border/50 hover:bg-accent/30 transition-colors',
                    row.status === 'Breach' && 'bg-rag-red',
                  )}
                >
                  <td className="px-2 py-1 font-mono">{row.date}</td>
                  <td className="px-2 py-1">{row.vertical}</td>
                  <td className="px-2 py-1">{row.system}</td>
                  <td className="px-2 py-1">{row.process}</td>
                  <td className="px-2 py-1">{row.checkpoint}</td>
                  <td className="px-2 py-1 text-right font-mono">{row.baseVolume.toLocaleString()}</td>
                  <td className={cn('px-2 py-1 text-right font-mono', row.breaches > 0 && 'rag-red font-semibold')}>{row.breaches}</td>
                  <td className={cn('px-2 py-1 text-right font-mono', row.failureRate > 2 ? 'rag-red' : row.failureRate > 0 ? 'rag-amber' : 'rag-green')}>
                    {row.failureRate.toFixed(2)}%
                  </td>
                  <td className="px-2 py-1">
                    <span className={cn(
                      'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                      row.status === 'Compliant' && 'bg-rag-green rag-green',
                      row.status === 'Warning' && 'bg-rag-amber rag-amber',
                      row.status === 'Breach' && 'bg-rag-red rag-red',
                    )}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 flex items-center justify-end gap-2 border-t border-border">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground disabled:opacity-30">Prev</button>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground disabled:opacity-30">Next</button>
        </div>
      </div>
    </div>
  );
}

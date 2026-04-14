import { useMemo, useState } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { ChevronUp, ChevronDown } from 'lucide-react';

type SortKey = 'date' | 'department' | 'system' | 'process' | 'failureRate' | 'breaches' | 'severity' | 'riskScore';

export function TechOpsView() {
  const { filteredData, openDrilldown } = useFilters();
  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const breachBySystem = useMemo(() => {
    const map = new Map<string, { breaches: number; critical: number }>();
    filteredData.forEach((r) => {
      const curr = map.get(r.system) || { breaches: 0, critical: 0 };
      curr.breaches += r.breaches;
      if (r.severity === 'Critical') curr.critical++;
      map.set(r.system, curr);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.breaches - a.breaches);
  }, [filteredData]);

  const breachByProcess = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach((r) => {
      map.set(r.process, (map.get(r.process) || 0) + r.breaches);
    });
    return Array.from(map.entries())
      .map(([name, breaches]) => ({ name, breaches }))
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

  const severityColor = (s: string) => s === 'Critical' ? 'rag-red' : s === 'High' ? 'rag-amber' : s === 'Medium' ? 'text-chart-5' : 'text-muted-foreground';

  return (
    <div className="space-y-3">
      {/* Top charts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breaches by System</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={breachBySystem} layout="vertical" onClick={(e) => { if (e?.activeLabel) openDrilldown('system', e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
              <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215 15% 50%)' }} width={90} />
              <Tooltip contentStyle={{ background: 'hsl(222 44% 8%)', border: '1px solid hsl(222 30% 16%)', fontSize: 11 }} />
              <Bar dataKey="breaches" radius={[0, 2, 2, 0]} cursor="pointer">
                {breachBySystem.map((d, i) => (
                  <Cell key={i} fill={d.critical > 0 ? 'hsl(0 72% 51%)' : 'hsl(38 92% 50%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breaches by Process</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={breachByProcess} layout="vertical" onClick={(e) => { if (e?.activeLabel) openDrilldown('process', e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
              <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215 15% 50%)' }} width={100} />
              <Tooltip contentStyle={{ background: 'hsl(222 44% 8%)', border: '1px solid hsl(222 30% 16%)', fontSize: 11 }} />
              <Bar dataKey="breaches" radius={[0, 2, 2, 0]} cursor="pointer">
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
          <span className="text-[10px] text-muted-foreground font-mono">Page {page + 1}/{totalPages} · {sorted.length.toLocaleString()} rows</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {([['date', 'Date'], ['department', 'Dept'], ['system', 'System'], ['process', 'Process']] as [SortKey, string][]).map(([k, l]) => (
                  <th key={k} className="px-2 py-1.5 text-left font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort(k)}>
                    {l} <SortIcon k={k} />
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right font-medium">Base Vol</th>
                <th className="px-2 py-1.5 text-right font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('breaches')}>
                  Breaches <SortIcon k="breaches" />
                </th>
                <th className="px-2 py-1.5 text-right font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('failureRate')}>
                  Fail % <SortIcon k="failureRate" />
                </th>
                <th className="px-2 py-1.5 text-center font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('severity')}>
                  Severity <SortIcon k="severity" />
                </th>
                <th className="px-2 py-1.5 text-center font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('riskScore')}>
                  Risk <SortIcon k="riskScore" />
                </th>
                <th className="px-2 py-1.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => row.status === 'BREACHED' && openDrilldown('breach', row.id, row)}
                  className={cn(
                    'border-b border-border/50 transition-colors',
                    row.status === 'BREACHED' && 'bg-rag-red cursor-pointer hover:bg-destructive/20',
                    row.status === 'CLEAN' && 'hover:bg-accent/30',
                  )}
                >
                  <td className="px-2 py-1 font-mono">{row.date}</td>
                  <td className="px-2 py-1">{row.department}</td>
                  <td className="px-2 py-1">{row.system}</td>
                  <td className="px-2 py-1">{row.process}</td>
                  <td className="px-2 py-1 text-right font-mono">{row.baseVolume.toLocaleString()}</td>
                  <td className={cn('px-2 py-1 text-right font-mono', row.breaches > 0 && 'rag-red font-semibold')}>{row.breaches}</td>
                  <td className={cn('px-2 py-1 text-right font-mono', row.failureRate > 2 ? 'rag-red' : row.failureRate > 0 ? 'rag-amber' : 'rag-green')}>
                    {row.failureRate.toFixed(2)}%
                  </td>
                  <td className="px-2 py-1 text-center">
                    {row.status === 'BREACHED' && <span className={cn('text-[10px] font-semibold', severityColor(row.severity))}>{row.severity}</span>}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {row.riskScore > 0 && (
                      <span className={cn('font-mono text-[10px] font-bold', row.riskScore >= 70 ? 'rag-red' : row.riskScore >= 40 ? 'rag-amber' : 'text-muted-foreground')}>
                        {row.riskScore}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <span className={cn(
                      'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                      row.status === 'CLEAN' && 'bg-rag-green rag-green',
                      row.status === 'BREACHED' && 'bg-rag-red rag-red',
                    )}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 flex items-center justify-end gap-2 border-t border-border">
          <button onClick={() => setPage(0)} disabled={page === 0} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground disabled:opacity-30">First</button>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground disabled:opacity-30">Prev</button>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground disabled:opacity-30">Next</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground disabled:opacity-30">Last</button>
        </div>
      </div>
    </div>
  );
}

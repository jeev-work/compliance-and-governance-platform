import { useMemo, useState } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn, CHART_TOOLTIP } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { ChevronUp, ChevronDown, Inbox, Wrench, GitFork, ShieldAlert } from 'lucide-react';
import { RagState } from '@/lib/mockData';

type SortKey = 'timestamp' | 'lob' | 'system' | 'process' | 'failureRate' | 'breaches' | 'severity' | 'riskScore';

const RAG_BG: Record<RagState, string> = {
  GREEN: 'bg-rag-green rag-green',
  AMBER: 'bg-rag-amber rag-amber',
  RED: 'bg-rag-red rag-red',
  GREY: 'bg-rag-grey rag-grey',
  BLUE: 'bg-rag-blue rag-blue',
  UNCONFIGURED: 'rag-unconfigured',
};

export function SpocView() {
  const { filteredData, openDrilldown } = useFilters();
  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const inbox = useMemo(() => filteredData.filter(r =>
    r.status === 'BREACHED' && (r.resolutionStatus === 'Open' || r.resolutionStatus === 'Investigating' || r.stateFlags.includes('Unacknowledged'))
  ), [filteredData]);

  const breachBySystem = useMemo(() => {
    const m = new Map<string, { breaches: number; critical: number }>();
    filteredData.forEach(r => {
      const c = m.get(r.system) || { breaches: 0, critical: 0 };
      c.breaches += r.breaches; if (r.severity === 'Critical') c.critical++;
      m.set(r.system, c);
    });
    return Array.from(m.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.breaches - a.breaches);
  }, [filteredData]);

  const sorted = useMemo(() => [...filteredData].sort((a, b) => {
    const av = (a as any)[sortKey], bv = (b as any)[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [filteredData, sortKey, sortDir]);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const toggleSort = (k: SortKey) => { sortKey === k ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortKey(k), setSortDir('desc')); setPage(0); };
  const SortIcon = ({ k }: { k: SortKey }) => sortKey !== k ? null : sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />;
  const sev = (s: string) => s === 'Critical' ? 'rag-red' : s === 'High' ? 'rag-amber' : s === 'Medium' ? 'text-chart-5' : 'text-muted-foreground';

  return (
    <div className="space-y-3">
      {/* Action banner */}
      <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-2 flex items-center gap-2">
        <Inbox className="h-4 w-4 text-primary" />
        <span className="text-xs text-primary font-semibold">{inbox.length} alerts awaiting action</span>
        <span className="text-[10px] text-muted-foreground ml-2">Click any row to acknowledge / deploy resolution / fork dependency</span>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-2">
        <ChartCard title="Breaches by System">
          <BarChart data={breachBySystem} layout="vertical" onClick={(e: any) => e?.activeLabel && openDrilldown('system', e.activeLabel)}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
            <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215 15% 50%)' }} width={90} />
            <Tooltip {...CHART_TOOLTIP} />
            <Bar dataKey="breaches" cursor="pointer">
              {breachBySystem.map((d, i) => <Cell key={i} fill={d.critical > 0 ? 'hsl(0 72% 51%)' : 'hsl(38 92% 50%)'} />)}
            </Bar>
          </BarChart>
        </ChartCard>
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Actionable Alert Inbox (Top 8)</h3>
          <div className="space-y-1">
            {inbox.slice(0, 8).map(r => (
              <div key={r.id} onClick={() => openDrilldown('breach', r.id, r)}
                className="flex items-center gap-2 text-[10px] px-2 py-1 rounded bg-rag-red border border-rag-red cursor-pointer hover:ring-1 hover:ring-primary/50">
                <span className="font-mono font-semibold text-foreground">{r.id}</span>
                <span className="text-muted-foreground">{r.system}</span>
                <span className={cn('font-semibold', sev(r.severity))}>{r.severity}</span>
                {r.dependency && <GitFork className="h-3 w-3 text-chart-5" />}
                {r.executiveFlag && <ShieldAlert className="h-3 w-3 rag-red" />}
                <span className="ml-auto rag-red font-mono">{r.breaches} br</span>
                <Wrench className="h-3 w-3 text-primary" />
              </div>
            ))}
            {inbox.length === 0 && <div className="text-[10px] text-muted-foreground italic text-center py-4">All clear · no actionable alerts</div>}
          </div>
        </div>
      </div>

      {/* Exception Log */}
      <div className="bg-card border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exception Log</h3>
          <span className="text-[10px] text-muted-foreground font-mono">Page {page + 1}/{totalPages || 1} · {sorted.length.toLocaleString()} rows</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {([['timestamp', 'Time'], ['lob', 'LoB'], ['system', 'System'], ['process', 'Process']] as [SortKey, string][]).map(([k, l]) => (
                  <th key={k} className="px-2 py-1.5 text-left font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort(k)}>
                    {l} <SortIcon k={k} />
                  </th>
                ))}
                <th className="px-2 py-1.5 text-center">RAG</th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-foreground" onClick={() => toggleSort('breaches')}>Breaches <SortIcon k="breaches" /></th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-foreground" onClick={() => toggleSort('failureRate')}>Fail% <SortIcon k="failureRate" /></th>
                <th className="px-2 py-1.5 text-center cursor-pointer hover:text-foreground" onClick={() => toggleSort('severity')}>Sev <SortIcon k="severity" /></th>
                <th className="px-2 py-1.5 text-center cursor-pointer hover:text-foreground" onClick={() => toggleSort('riskScore')}>Risk <SortIcon k="riskScore" /></th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-center">Flags</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(row => (
                <tr key={row.id} onClick={() => row.status === 'BREACHED' && openDrilldown('breach', row.id, row)}
                  className={cn('border-b border-border/50 transition-colors',
                    row.status === 'BREACHED' && 'cursor-pointer hover:bg-accent/30',
                  )}>
                  <td className="px-2 py-1 font-mono text-[10px]">{new Date(row.timestamp).toLocaleString().slice(0, -3)}</td>
                  <td className="px-2 py-1">{row.lob}</td>
                  <td className="px-2 py-1">{row.system}</td>
                  <td className="px-2 py-1">{row.process}</td>
                  <td className="px-2 py-1 text-center">
                    <span className={cn('px-1 py-0.5 rounded text-[9px] font-bold', RAG_BG[row.ragState])}>{row.ragState.slice(0, 3)}</span>
                  </td>
                  <td className={cn('px-2 py-1 text-right font-mono', row.breaches > 0 && 'rag-red font-semibold')}>{row.breaches}</td>
                  <td className={cn('px-2 py-1 text-right font-mono', row.failureRate > 2 ? 'rag-red' : row.failureRate > 0 ? 'rag-amber' : 'rag-green')}>{row.failureRate.toFixed(2)}%</td>
                  <td className="px-2 py-1 text-center">
                    {row.status === 'BREACHED' && <span className={cn('text-[10px] font-semibold', sev(row.severity))}>{row.severity}</span>}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {row.riskScore > 0 && (
                      <span className={cn('font-mono text-[10px] font-bold',
                        row.riskScore >= 70 ? 'rag-red' : row.riskScore >= 40 ? 'rag-amber' : 'text-muted-foreground',
                      )}>{row.riskScore}</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-[10px]">{row.resolutionStatus}</td>
                  <td className="px-2 py-1 text-center text-[10px]">
                    {row.executiveFlag && <span title="Executive Flag">⚑</span>}
                    {row.dependency && <GitFork className="h-3 w-3 text-chart-5 inline" />}
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md p-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={140}>{children as any}</ResponsiveContainer>
    </div>
  );
}

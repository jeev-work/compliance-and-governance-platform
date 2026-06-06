import { useMemo, useState } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { FileWarning, CheckCircle2, Search, AlertOctagon, Clock, ArrowUpRight, FileDown, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { exportMasterLedger, exportMicroLedger } from '@/lib/exportLedger';

export function ComplianceView() {
  const { filteredData, openDrilldown, masterLedger, configSnapshots } = useFilters();
  const [query, setQuery] = useState('');

  const breachRows = useMemo(() => filteredData.filter(r => r.status === 'BREACHED'), [filteredData]);

  const metrics = useMemo(() => {
    const open = breachRows.filter(r => r.resolutionStatus !== 'Resolved' && r.resolutionStatus !== 'Clean').length;
    const resolved = breachRows.filter(r => r.resolutionStatus === 'Resolved').length;
    const escalated = breachRows.filter(r => r.resolutionStatus === 'Escalated to HOD').length;
    const investigating = breachRows.filter(r => r.resolutionStatus === 'Investigating').length;
    const verifying = breachRows.filter(r => r.resolutionStatus === 'Verifying').length;
    const avgEsc = breachRows.filter(r => r.timeToEscalateMin).reduce((s, r) => s + (r.timeToEscalateMin || 0), 0) / (breachRows.filter(r => r.timeToEscalateMin).length || 1);
    return { open, resolved, escalated, investigating, verifying, total: breachRows.length, avgEsc: Math.round(avgEsc) };
  }, [breachRows]);

  // Ledger query — filter by id / lob / system / hash
  const ledger = useMemo(() => {
    const q = query.trim().toLowerCase();
    const subset = breachRows.slice(0, 200);
    if (!q) return subset.slice(0, 25);
    return subset.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.lob.toLowerCase().includes(q) ||
      r.system.toLowerCase().includes(q) ||
      r.auditLedgerId.toLowerCase().includes(q),
    ).slice(0, 50);
  }, [breachRows, query]);

  const columns: { status: string; icon: any; color: string }[] = [
    { status: 'Investigating', icon: Search, color: 'amber' },
    { status: 'Verifying', icon: Clock, color: 'amber' },
    { status: 'Escalated to HOD', icon: AlertOctagon, color: 'red' },
    { status: 'Resolved', icon: CheckCircle2, color: 'green' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] text-muted-foreground italic mr-auto">
          Exports stamp every entry with the SLA config snapshot active at incident time — never the current config.
        </span>
        <button
          onClick={() => { exportMasterLedger(masterLedger, configSnapshots); toast.success('Master ledger exported · snapshot-stamped'); }}
          className="text-[10px] font-semibold px-2 py-1 rounded border bg-rag-amber border-rag-amber rag-amber hover:opacity-80 flex items-center gap-1"
        >
          <FileDown className="h-3 w-3" /> Export Master Ledger
        </button>
      </div>
      {/* KPI tiles */}
      <div className="grid grid-cols-6 gap-2">
        <KPI icon={FileWarning} label="Total Exceptions" value={metrics.total} />
        <KPI icon={Search} label="Investigating" value={metrics.investigating} variant="amber" />
        <KPI icon={Clock} label="Verifying" value={metrics.verifying} variant="amber" />
        <KPI icon={AlertOctagon} label="Escalated to HOD" value={metrics.escalated} variant="red" />
        <KPI icon={CheckCircle2} label="Resolved" value={metrics.resolved} variant="green" />
        <KPI icon={Clock} label="Avg Escalation" value={`${Math.round(metrics.avgEsc / 60)}h`} variant={metrics.avgEsc > 240 ? 'red' : 'green'} />
      </div>

      {metrics.escalated > 5 && (
        <div className="bg-rag-red border border-rag-red rounded-md px-3 py-2 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 rag-red shrink-0" />
          <span className="text-xs rag-red font-semibold">⚠ {metrics.escalated} items escalated to HOD — immediate attention required</span>
          <ArrowUpRight className="h-3 w-3 rag-red ml-auto" />
        </div>
      )}

      {/* Immutable Ledger query */}
      <div className="bg-card border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold">Immutable Audit Ledger Query</h3>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by KPI id, LoB, system, or ledger hash…"
            className="ml-2 flex-1 h-7 text-xs bg-secondary border border-border rounded px-2"
          />
          <span className="text-[10px] text-muted-foreground font-mono">{ledger.length} of {breachRows.length} records</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground">
                <th className="text-left px-2 py-1.5 font-medium">KPI</th>
                <th className="text-left px-2 py-1.5 font-medium">LoB</th>
                <th className="text-left px-2 py-1.5 font-medium">System</th>
                <th className="text-left px-2 py-1.5 font-medium">SLA Ver</th>
                <th className="text-left px-2 py-1.5 font-medium">Ledger Hash</th>
                <th className="text-left px-2 py-1.5 font-medium">Status</th>
                <th className="text-right px-2 py-1.5 font-medium">Export</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(r => (
                <tr key={r.id} onClick={() => openDrilldown('breach', r.id, r)} className="border-b border-border/50 hover:bg-accent/30 cursor-pointer">
                  <td className="px-2 py-1 font-mono">{r.id}</td>
                  <td className="px-2 py-1">{r.lob}</td>
                  <td className="px-2 py-1">{r.system}</td>
                  <td className="px-2 py-1 font-mono">{r.slaVersion}</td>
                  <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{r.auditLedgerId}</td>
                  <td className="px-2 py-1 text-[10px]">{r.resolutionStatus}</td>
                  <td className="px-2 py-1 text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { exportMicroLedger({ kind: 'kpi', name: r.id }, r.ledgerEntries, configSnapshots, r); toast.success(`Micro ledger exported · ${r.id}`); }}
                      className="text-[10px] text-primary hover:underline flex items-center gap-1 ml-auto">
                      <FileDown className="h-3 w-3" /> Export
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-4 gap-2 items-start">
        {columns.map(col => {
          const items = breachRows.filter(r => r.resolutionStatus === col.status);
          return (
            <div key={col.status} className="bg-card border border-border rounded-md">
              <div className="px-3 py-1.5 border-b border-border flex items-center gap-1.5">
                <col.icon className={cn('h-3.5 w-3.5', `rag-${col.color}`)} />
                <span className="text-xs font-semibold">{col.status}</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">{items.length}</span>
              </div>
              <div className="max-h-[360px] overflow-y-auto scrollbar-thin p-1.5 space-y-1">
                {items.slice(0, 30).map(row => (
                  <div key={row.id} onClick={() => openDrilldown('breach', row.id, row)}
                    className={cn(
                      'rounded border px-2 py-1.5 text-[10px] cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all',
                      col.color === 'red'   && 'border-rag-red bg-rag-red',
                      col.color === 'amber' && 'border-rag-amber bg-rag-amber',
                      col.color === 'green' && 'border-rag-green bg-rag-green',
                    )}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{row.system}</span>
                      <span className={cn('text-[9px] font-semibold px-1 rounded',
                        row.severity === 'Critical' ? 'bg-destructive/20 rag-red' : row.severity === 'High' ? 'bg-rag-amber rag-amber' : 'text-muted-foreground',
                      )}>{row.severity}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">{row.process} · {row.lob}</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={cn('font-mono', `rag-${col.color}`)}>{row.breaches} br</span>
                      {row.assignee && <span className="text-muted-foreground">{row.assignee.name}</span>}
                    </div>
                  </div>
                ))}
                {items.length > 30 && <div className="text-center text-[10px] text-muted-foreground py-1">+{items.length - 30} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, variant }: { icon: any; label: string; value: number | string; variant?: 'green' | 'amber' | 'red' }) {
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-2">
      <Icon className={cn('h-4 w-4 shrink-0',
        variant === 'green' && 'rag-green', variant === 'amber' && 'rag-amber', variant === 'red' && 'rag-red', !variant && 'text-primary',
      )} />
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={cn('text-lg font-semibold font-mono',
          variant === 'green' && 'rag-green', variant === 'amber' && 'rag-amber', variant === 'red' && 'rag-red', !variant && 'text-foreground',
        )}>{value}</div>
      </div>
    </div>
  );
}

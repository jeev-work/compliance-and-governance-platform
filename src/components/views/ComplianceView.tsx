import { useMemo } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { FileWarning, CheckCircle2, Search, AlertOctagon, Clock, ArrowUpRight } from 'lucide-react';

export function ComplianceView() {
  const { filteredData, openDrilldown } = useFilters();

  const breachRows = useMemo(() => filteredData.filter((r) => r.status === 'BREACHED'), [filteredData]);

  const metrics = useMemo(() => {
    const open = breachRows.filter((r) => r.resolutionStatus !== 'Resolved' && r.resolutionStatus !== 'Clean').length;
    const resolved = breachRows.filter((r) => r.resolutionStatus === 'Resolved').length;
    const escalated = breachRows.filter((r) => r.resolutionStatus === 'Escalated to HOD').length;
    const investigating = breachRows.filter((r) => r.resolutionStatus === 'Investigating').length;
    const avgEscTime = breachRows.filter(r => r.timeToEscalateMin).reduce((s, r) => s + (r.timeToEscalateMin || 0), 0) / (breachRows.filter(r => r.timeToEscalateMin).length || 1);
    const avgResTime = breachRows.filter(r => r.timeToResolveMin).reduce((s, r) => s + (r.timeToResolveMin || 0), 0) / (breachRows.filter(r => r.timeToResolveMin).length || 1);
    return { open, resolved, escalated, investigating, total: breachRows.length, avgEscTime: Math.round(avgEscTime), avgResTime: Math.round(avgResTime) };
  }, [breachRows]);

  const columns: { status: string; icon: React.ElementType; color: string }[] = [
    { status: 'Investigating', icon: Search, color: 'amber' },
    { status: 'Open', icon: FileWarning, color: 'amber' },
    { status: 'Escalated to HOD', icon: AlertOctagon, color: 'red' },
    { status: 'Resolved', icon: CheckCircle2, color: 'green' },
  ];

  return (
    <div className="space-y-3">
      {/* KPI Tiles */}
      <div className="grid grid-cols-6 gap-2">
        <KPITile icon={FileWarning} label="Total Exceptions" value={metrics.total} />
        <KPITile icon={Search} label="Investigating" value={metrics.investigating} variant="amber" />
        <KPITile icon={FileWarning} label="Open" value={metrics.open} variant="amber" />
        <KPITile icon={AlertOctagon} label="Escalated to HOD" value={metrics.escalated} variant="red" />
        <KPITile icon={CheckCircle2} label="Resolved" value={metrics.resolved} variant="green" />
        <KPITile icon={Clock} label="Avg Escalation Time" value={`${Math.round(metrics.avgEscTime / 60)}h`} variant={metrics.avgEscTime > 240 ? 'red' : 'green'} />
      </div>

      {/* Proactive alert */}
      {metrics.escalated > 5 && (
        <div className="bg-rag-red border border-rag-red/30 rounded-md px-3 py-2 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 rag-red shrink-0" />
          <span className="text-xs rag-red font-semibold">⚠ {metrics.escalated} items escalated to HOD — immediate attention required</span>
          <ArrowUpRight className="h-3 w-3 rag-red ml-auto" />
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-2 items-start">
        {columns.map((col) => {
          const items = breachRows.filter((r) => r.resolutionStatus === col.status);
          return (
            <div key={col.status} className="bg-card border border-border rounded-md">
              <div className="px-3 py-1.5 border-b border-border flex items-center gap-1.5">
                <col.icon className={cn('h-3.5 w-3.5', `rag-${col.color}`)} />
                <span className="text-xs font-semibold">{col.status}</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">{items.length}</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin p-1.5 space-y-1">
                {items.slice(0, 50).map((row) => (
                  <div
                    key={row.id}
                    onClick={() => openDrilldown('breach', row.id, row)}
                    className={cn(
                      'rounded border px-2 py-1.5 text-[10px] cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all',
                      col.color === 'red' && 'border-rag-red/30 bg-rag-red',
                      col.color === 'amber' && 'border-rag-amber/30 bg-rag-amber',
                      col.color === 'green' && 'border-rag-green/30 bg-rag-green',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{row.system}</span>
                      <span className={cn('text-[9px] font-semibold px-1 rounded',
                        row.severity === 'Critical' ? 'bg-destructive/20 rag-red' : row.severity === 'High' ? 'bg-rag-amber rag-amber' : 'text-muted-foreground'
                      )}>{row.severity}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">{row.process} · {row.department}</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={cn('font-mono', `rag-${col.color}`)}>{row.breaches} breaches</span>
                      {row.assignee && <span className="text-muted-foreground">{row.assignee.name}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                      <span className="font-mono">{row.date}</span>
                      {row.escalations.length > 0 && <span>↗ {row.escalations.length} escalations</span>}
                      {row.comments.length > 0 && <span>💬 {row.comments.length}</span>}
                    </div>
                    {row.resolvedBy && <div className="text-muted-foreground mt-0.5">Resolved by: {row.resolvedBy}</div>}
                  </div>
                ))}
                {items.length > 50 && (
                  <div className="text-center text-[10px] text-muted-foreground py-1">+{items.length - 50} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KPITile({ icon: Icon, label, value, variant }: {
  icon: React.ElementType; label: string; value: number | string; variant?: 'green' | 'amber' | 'red';
}) {
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-2">
      <Icon className={cn(
        'h-4 w-4 shrink-0',
        variant === 'green' && 'rag-green',
        variant === 'amber' && 'rag-amber',
        variant === 'red' && 'rag-red',
        !variant && 'text-primary',
      )} />
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={cn(
          'text-lg font-semibold font-mono',
          variant === 'green' && 'rag-green',
          variant === 'amber' && 'rag-amber',
          variant === 'red' && 'rag-red',
          !variant && 'text-foreground',
        )}>{value}</div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { FileWarning, CheckCircle2, Search, AlertOctagon } from 'lucide-react';

export function ComplianceView() {
  const { filteredData } = useFilters();

  const breachRows = useMemo(() => filteredData.filter((r) => r.status === 'Breach'), [filteredData]);

  const metrics = useMemo(() => {
    const open = breachRows.filter((r) => r.remediationStatus !== 'Resolved').length;
    const resolved = breachRows.filter((r) => r.remediationStatus === 'Resolved').length;
    const escalated = breachRows.filter((r) => r.remediationStatus === 'Escalated').length;
    const investigating = breachRows.filter((r) => r.remediationStatus === 'Investigating').length;
    return { open, resolved, escalated, investigating, total: breachRows.length };
  }, [breachRows]);

  const columns: { status: 'Investigating' | 'Escalated' | 'Resolved'; icon: React.ElementType; color: string }[] = [
    { status: 'Investigating', icon: Search, color: 'amber' },
    { status: 'Escalated', icon: AlertOctagon, color: 'red' },
    { status: 'Resolved', icon: CheckCircle2, color: 'green' },
  ];

  return (
    <div className="space-y-3">
      {/* KPI Tiles */}
      <div className="grid grid-cols-4 gap-2">
        <KPITile icon={FileWarning} label="Total Exceptions" value={metrics.total} />
        <KPITile icon={Search} label="Open / Investigating" value={metrics.open} variant="amber" />
        <KPITile icon={AlertOctagon} label="Escalated" value={metrics.escalated} variant="red" />
        <KPITile icon={CheckCircle2} label="Resolved" value={metrics.resolved} variant="green" />
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-3 gap-2 items-start">
        {columns.map((col) => {
          const items = breachRows.filter((r) => r.remediationStatus === col.status);
          return (
            <div key={col.status} className="bg-card border border-border rounded-md">
              <div className={cn(
                'px-3 py-1.5 border-b border-border flex items-center gap-1.5',
              )}>
                <col.icon className={cn('h-3.5 w-3.5', `rag-${col.color}`)} />
                <span className="text-xs font-semibold">{col.status}</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">{items.length}</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto scrollbar-thin p-1.5 space-y-1">
                {items.slice(0, 40).map((row) => (
                  <div key={row.id} className={cn(
                    'rounded border px-2 py-1.5 text-[10px]',
                    col.color === 'red' && 'border-rag-red/30 bg-rag-red',
                    col.color === 'amber' && 'border-rag-amber/30 bg-rag-amber',
                    col.color === 'green' && 'border-rag-green/30 bg-rag-green',
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{row.system}</span>
                      <span className="font-mono text-muted-foreground">{row.date}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">{row.process} → {row.checkpoint}</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={cn('font-mono', `rag-${col.color}`)}>{row.breaches} breaches ({row.failureRate}%)</span>
                      {row.assignee && <span className="text-muted-foreground">{row.assignee}</span>}
                    </div>
                    {row.resolvedAt && <div className="text-muted-foreground mt-0.5">Resolved: {row.resolvedAt}</div>}
                  </div>
                ))}
                {items.length > 40 && (
                  <div className="text-center text-[10px] text-muted-foreground py-1">+{items.length - 40} more</div>
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
  icon: React.ElementType; label: string; value: number; variant?: 'green' | 'amber' | 'red';
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

import { useFilters } from '@/lib/filterContext';
import { KPIRow } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { X, Clock, User, MessageSquare, ArrowUpRight, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export function DrilldownPanel() {
  const { drilldown, closeDrilldown, filteredData, openDrilldown } = useFilters();

  if (!drilldown.type) return null;

  if (drilldown.type === 'breach' && drilldown.row) {
    return <BreachDetail row={drilldown.row} onClose={closeDrilldown} />;
  }

  if (drilldown.type === 'system' || drilldown.type === 'process' || drilldown.type === 'department') {
    const filterKey = drilldown.type;
    const filterValue = drilldown.value!;
    const rows = filteredData.filter(r => r[filterKey] === filterValue);
    return <GroupDrilldown type={filterKey} value={filterValue} rows={rows} onClose={closeDrilldown} onSelectBreach={(row) => openDrilldown('breach', row.id, row)} />;
  }

  return null;
}

function BreachDetail({ row, onClose }: { row: KPIRow; onClose: () => void }) {
  const formatDuration = (mins: number | null) => {
    if (!mins) return '—';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg w-full max-w-3xl mx-4 mb-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <AlertTriangle className={cn('h-5 w-5', row.severity === 'Critical' ? 'rag-red' : row.severity === 'High' ? 'rag-amber' : 'text-muted-foreground')} />
            <div>
              <h2 className="text-sm font-semibold text-foreground">{row.id} — {row.system}</h2>
              <p className="text-[10px] text-muted-foreground">{row.process} · {row.department} · {row.date}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-border">
          <MiniStat label="Severity" value={row.severity} color={row.severity === 'Critical' ? 'red' : row.severity === 'High' ? 'amber' : 'green'} />
          <MiniStat label="Risk Score" value={String(row.riskScore)} color={row.riskScore >= 70 ? 'red' : row.riskScore >= 40 ? 'amber' : 'green'} />
          <MiniStat label="Breaches" value={row.breaches.toLocaleString()} color="red" />
          <MiniStat label="Failure Rate" value={`${row.failureRate}%`} color={row.failureRate > 1 ? 'red' : 'amber'} />
          <MiniStat label="Status" value={row.resolutionStatus} color={row.resolutionStatus === 'Resolved' ? 'green' : row.resolutionStatus === 'Escalated to HOD' ? 'red' : 'amber'} />
        </div>

        {/* Timeline Metrics */}
        <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <div>
              <div className="text-[9px] text-muted-foreground uppercase">Time to Detect</div>
              <div className="text-xs font-mono font-semibold">{formatDuration(row.timeToDetectMin)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-3.5 w-3.5 rag-amber" />
            <div>
              <div className="text-[9px] text-muted-foreground uppercase">Time to Escalate</div>
              <div className="text-xs font-mono font-semibold">{formatDuration(row.timeToEscalateMin)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 rag-green" />
            <div>
              <div className="text-[9px] text-muted-foreground uppercase">Time to Resolve</div>
              <div className="text-xs font-mono font-semibold">{formatDuration(row.timeToResolveMin)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-primary" />
            <div>
              <div className="text-[9px] text-muted-foreground uppercase">Assigned To</div>
              <div className="text-xs font-semibold">{row.assignee?.name || '—'}</div>
              {row.assignee && <div className="text-[9px] text-muted-foreground">{row.assignee.role}</div>}
            </div>
          </div>
        </div>

        {/* Escalation History */}
        {row.escalations.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
              <ArrowUpRight className="h-3 w-3" /> Escalation Trail ({row.escalations.length})
            </h3>
            <div className="space-y-1.5">
              {row.escalations.map((esc, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px] border-l-2 border-rag-amber/50 pl-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{esc.from}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold rag-amber">{esc.to}</span>
                    </div>
                    <div className="text-muted-foreground">{esc.reason}</div>
                  </div>
                  <span className="font-mono text-muted-foreground shrink-0">{new Date(esc.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        {row.comments.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Activity Log ({row.comments.length})
            </h3>
            <div className="space-y-2">
              {row.comments.map((comment, i) => (
                <div key={i} className="bg-accent/30 rounded px-2.5 py-2 text-[10px]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{comment.author}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{comment.role}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{new Date(comment.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-foreground/80">{comment.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolution */}
        {row.resolvedBy && (
          <div className="px-4 py-3 bg-rag-green rounded-b-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 rag-green" />
              <span className="text-xs font-semibold rag-green">Resolved by {row.resolvedBy}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Resolution time: {formatDuration(row.timeToResolveMin)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupDrilldown({ type, value, rows, onClose, onSelectBreach }: {
  type: string; value: string; rows: KPIRow[]; onClose: () => void; onSelectBreach: (row: KPIRow) => void;
}) {
  const breached = rows.filter(r => r.status === 'BREACHED');
  const totalBreaches = rows.reduce((s, r) => s + r.breaches, 0);
  const criticalCount = breached.filter(r => r.severity === 'Critical').length;
  const resolvedCount = breached.filter(r => r.resolutionStatus === 'Resolved').length;

  const breakdownData = useMemo(() => {
    const key = type === 'system' ? 'process' : type === 'process' ? 'system' : 'system';
    const map = new Map<string, number>();
    rows.forEach(r => { map.set(r[key], (map.get(r[key]) || 0) + r.breaches); });
    return Array.from(map.entries()).map(([name, breaches]) => ({ name, breaches })).sort((a, b) => b.breaches - a.breaches);
  }, [rows, type]);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg w-full max-w-3xl mx-4 mb-8 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">{value}</h2>
              <p className="text-[10px] text-muted-foreground capitalize">{type} · {rows.length.toLocaleString()} KPIs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border">
          <MiniStat label="Total Breaches" value={totalBreaches.toLocaleString()} color="red" />
          <MiniStat label="Critical" value={String(criticalCount)} color={criticalCount > 0 ? 'red' : 'green'} />
          <MiniStat label="Resolved" value={String(resolvedCount)} color="green" />
          <MiniStat label="Open" value={String(breached.length - resolvedCount)} color={breached.length - resolvedCount > 0 ? 'amber' : 'green'} />
        </div>

        {/* Breakdown Chart */}
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
            Breaches by {type === 'system' ? 'Process' : 'System'}
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={breakdownData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
              <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215 15% 50%)' }} width={100} />
              <Tooltip contentStyle={{ background: 'hsl(222 44% 8%)', border: '1px solid hsl(222 30% 16%)', fontSize: 11 }} />
              <Bar dataKey="breaches" radius={[0, 2, 2, 0]}>
                {breakdownData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? 'hsl(0 72% 51%)' : 'hsl(38 92% 50%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Breach list */}
        <div className="px-4 py-3">
          <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
            Breached KPIs ({breached.length})
          </h3>
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin space-y-1">
            {breached.slice(0, 50).map(row => (
              <div
                key={row.id}
                onClick={() => onSelectBreach(row)}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-rag-red border border-rag-red/30 text-[10px] cursor-pointer hover:ring-1 hover:ring-primary/50"
              >
                <span className="font-mono font-semibold text-foreground">{row.id}</span>
                <span className="text-muted-foreground">{row.date}</span>
                <span className={cn('font-semibold', row.severity === 'Critical' ? 'rag-red' : 'rag-amber')}>{row.severity}</span>
                <span className="font-mono rag-red">{row.breaches} breaches</span>
                <span className="ml-auto text-muted-foreground">{row.resolutionStatus}</span>
                {row.assignee && <span className="text-muted-foreground">→ {row.assignee.name}</span>}
              </div>
            ))}
            {breached.length > 50 && <div className="text-center text-[10px] text-muted-foreground py-1">+{breached.length - 50} more</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: 'red' | 'amber' | 'green' }) {
  return (
    <div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn('text-sm font-semibold font-mono', color === 'red' ? 'rag-red' : color === 'amber' ? 'rag-amber' : 'rag-green')}>{value}</div>
    </div>
  );
}

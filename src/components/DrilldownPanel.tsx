import { useFilters } from '@/lib/filterContext';
import { ChaseStep, KPIRow, RagState } from '@/lib/mockData';
import { ROLE_ACTIONS } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import {
  X, Clock, User, MessageSquare, ArrowUpRight, AlertTriangle, CheckCircle2, Shield,
  Flag, Wrench, GitFork, Send, FileDown, ShieldAlert,
} from 'lucide-react';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { toast } from 'sonner';

const RAG_BG: Record<RagState, string> = {
  GREEN: 'bg-rag-green rag-green',
  AMBER: 'bg-rag-amber rag-amber',
  RED: 'bg-rag-red rag-red',
  GREY: 'bg-rag-grey rag-grey',
  BLUE: 'bg-rag-blue rag-blue',
  UNCONFIGURED: 'rag-unconfigured',
};

export function DrilldownPanel() {
  const { drilldown, closeDrilldown, filteredData, openDrilldown } = useFilters();
  if (!drilldown.type) return null;

  if (drilldown.type === 'breach' && drilldown.row) {
    return <BreachDetail row={drilldown.row} onClose={closeDrilldown} />;
  }
  if (drilldown.type === 'system' || drilldown.type === 'process' || drilldown.type === 'lob') {
    const k = drilldown.type;
    const v = drilldown.value!;
    const rows = filteredData.filter(r => r[k] === v);
    return <GroupDrilldown type={k} value={v} rows={rows} onClose={closeDrilldown}
      onSelectBreach={(row) => openDrilldown('breach', row.id, row)} />;
  }
  return null;
}

function BreachDetail({ row, onClose }: { row: KPIRow; onClose: () => void }) {
  const { filters, mutateRow } = useFilters();
  const actions = ROLE_ACTIONS[filters.role];

  const fmt = (m: number | null) => !m ? '—' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;

  const onAcknowledge = () => {
    mutateRow(row.id, {
      resolutionStatus: 'Investigating',
      stateFlags: row.stateFlags.filter(f => f !== 'Unacknowledged').concat('Acknowledged'),
      chaseTimeline: [...row.chaseTimeline, { step: 'Acknowledged', timestamp: new Date().toISOString(), actor: 'You' }],
    });
    toast.success(`${row.id} acknowledged — chase timer halted`);
  };
  const onDeploy = () => {
    mutateRow(row.id, {
      resolutionStatus: 'Verifying',
      stateFlags: row.stateFlags.filter(f => f !== 'Unacknowledged').concat('Verifying'),
      chaseTimeline: [...row.chaseTimeline,
        { step: 'Resolved', timestamp: new Date().toISOString(), actor: 'You' },
        { step: 'Verifying', timestamp: new Date().toISOString(), actor: 'System' },
      ],
    });
    toast.success(`Deploy Resolution sent — system verifying telemetry return to GREEN`);
  };
  const onTagDep = () => {
    mutateRow(row.id, {
      dependency: { team: 'Network Ops', timestamp: new Date().toISOString(), linkedId: `SUB-${Math.floor(Math.random() * 99999)}`, status: 'open' },
      stateFlags: row.stateFlags.concat('Cross-Functional'),
    });
    toast.success(`Forked to Network Ops — primary SLA timer paused`);
  };
  const onExec = () => {
    mutateRow(row.id, {
      executiveFlag: true,
      ragState: 'RED',
      resolutionStatus: 'Escalated to HOD',
      stateFlags: row.stateFlags.concat('Escalated'),
    });
    toast.error(`EXECUTIVE FLAG raised — SLA timer nullified, Level 2 escalation`);
  };
  const onReassign = () => toast.success(`${row.id} reassigned within LoB`);
  const onEscalate = () => {
    mutateRow(row.id, { resolutionStatus: 'Escalated to HOD', stateFlags: row.stateFlags.concat('Escalated') });
    toast.success(`Escalated to HOD`);
  };
  const onExport = () => toast.success(`Regulatory audit exported · hash: ${row.auditLedgerId}`);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto">
      <div className={cn(
        'bg-card border rounded-lg w-full max-w-3xl mx-4 mb-8 shadow-2xl',
        row.executiveFlag ? 'border-rag-red exec-pulse' : 'border-border',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <AlertTriangle className={cn('h-5 w-5',
              row.severity === 'Critical' ? 'rag-red' : row.severity === 'High' ? 'rag-amber' : 'text-muted-foreground',
            )} />
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                {row.id} — {row.system}
                {row.executiveFlag && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rag-red rag-red border border-rag-red">
                    ⚑ EXECUTIVE FLAG
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {row.process} · LoB {row.lob} · {new Date(row.timestamp).toLocaleString()} · source: {row.source}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
        </div>

        {/* RAG strip + SLA Version */}
        <div className="px-4 py-2 border-b border-border flex items-center gap-3 text-[10px]">
          <span className={cn('px-2 py-0.5 rounded font-bold', RAG_BG[row.ragState])}>{row.ragState}</span>
          <span className="text-muted-foreground">SLA: <span className="font-mono text-foreground">{row.slaVersion}</span></span>
          <span className="text-muted-foreground">Ledger: <span className="font-mono text-foreground">{row.auditLedgerId}</span></span>
          {row.maintenanceWindow && (
            <span className="ml-auto rag-blue font-medium">⏸ {row.maintenanceWindow}</span>
          )}
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-border">
          <MiniStat label="Severity" value={row.severity} color={row.severity === 'Critical' ? 'red' : row.severity === 'High' ? 'amber' : 'green'} />
          <MiniStat label="Risk Score" value={String(row.riskScore)} color={row.riskScore >= 70 ? 'red' : row.riskScore >= 40 ? 'amber' : 'green'} />
          <MiniStat label="Breaches" value={row.breaches.toLocaleString()} color="red" />
          <MiniStat label="Failure Rate" value={`${row.failureRate}%`} color={row.failureRate > 1 ? 'red' : 'amber'} />
          <MiniStat label="Status" value={row.resolutionStatus} color={row.resolutionStatus === 'Resolved' ? 'green' : row.resolutionStatus === 'Escalated to HOD' ? 'red' : 'amber'} />
        </div>

        {/* Chase Mechanism timeline */}
        {row.chaseTimeline.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
              <Send className="h-3 w-3" /> Chase Mechanism Timeline
            </h3>
            <div className="flex items-center gap-1 flex-wrap">
              {(['Generated', 'Notified', 'Acknowledged', 'Resolved', 'Verifying', 'Closed'] as ChaseStep[]).map((step, idx, all) => {
                const hit = row.chaseTimeline.find(e => e.step === step);
                const isLast = idx === all.length - 1;
                return (
                  <div key={step} className="flex items-center gap-1">
                    <div className={cn(
                      'flex flex-col items-center min-w-[64px] px-1.5 py-1 rounded border text-[9px]',
                      hit ? 'border-primary/40 bg-primary/10' : 'border-border bg-secondary/40 text-muted-foreground',
                    )}>
                      <span className={cn('font-semibold', hit && 'text-primary')}>{step}</span>
                      {hit && <span className="font-mono text-[8px] text-muted-foreground">{new Date(hit.timestamp).toLocaleTimeString()}</span>}
                    </div>
                    {!isLast && <span className="text-muted-foreground">→</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dependency fork */}
        {row.dependency && (
          <div className="mx-4 my-3 px-3 py-2 rounded border border-chart-5/30 bg-chart-5/5">
            <div className="text-[10px] uppercase tracking-wider text-chart-5 font-semibold mb-1 flex items-center gap-1.5">
              <GitFork className="h-3 w-3" /> Cross-Functional Dependency
            </div>
            <div className="text-[11px]">
              <span className="font-semibold text-foreground">{row.dependency.team}</span>
              <span className="text-muted-foreground"> · sub-ticket </span>
              <span className="font-mono text-foreground">{row.dependency.linkedId}</span>
              <span className={cn('ml-2 text-[9px] px-1 py-0.5 rounded font-semibold',
                row.dependency.status === 'open' ? 'bg-rag-amber rag-amber' : 'bg-rag-green rag-green')}>
                {row.dependency.status.toUpperCase()}
              </span>
              <span className="text-muted-foreground ml-2 text-[9px]">primary timer paused</span>
            </div>
          </div>
        )}

        {/* Timeline metrics */}
        <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border">
          <TS icon={Clock} color="text-primary"  label="Time to Detect" value={fmt(row.timeToDetectMin)} />
          <TS icon={ArrowUpRight} color="rag-amber" label="Time to Escalate" value={fmt(row.timeToEscalateMin)} />
          <TS icon={CheckCircle2} color="rag-green" label="Time to Resolve" value={fmt(row.timeToResolveMin)} />
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-primary" />
            <div>
              <div className="text-[9px] text-muted-foreground uppercase">Assignee</div>
              <div className="text-xs font-semibold">{row.assignee?.name || '—'}</div>
              {row.assignee && <div className="text-[9px] text-muted-foreground">{row.assignee.role}</div>}
            </div>
          </div>
        </div>

        {/* Escalations */}
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
              {row.comments.map((c, i) => (
                <div key={i} className="bg-accent/30 rounded px-2.5 py-2 text-[10px]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{c.author}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{c.role}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{new Date(c.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-foreground/80">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role-gated actions */}
        <div className="px-4 py-3 border-t border-border bg-accent/10 flex items-center gap-2 flex-wrap rounded-b-lg">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Actions</span>
          {actions.includes('acknowledge') && (
            <ActionBtn icon={CheckCircle2} label="Acknowledge" onClick={onAcknowledge} />
          )}
          {actions.includes('deployResolution') && (
            <ActionBtn icon={Wrench} label="Deploy Resolution" onClick={onDeploy} variant="primary" />
          )}
          {actions.includes('tagDependency') && (
            <ActionBtn icon={GitFork} label="Tag Multi-Team Dependency" onClick={onTagDep} />
          )}
          {actions.includes('reassign') && <ActionBtn icon={User} label="Reassign" onClick={onReassign} />}
          {actions.includes('escalate') && <ActionBtn icon={ArrowUpRight} label="Escalate" onClick={onEscalate} variant="amber" />}
          {actions.includes('executiveFlag') && (
            <ActionBtn icon={Flag} label="Executive Flag" onClick={onExec} variant="danger" />
          )}
          {actions.includes('exportAudit') && (
            <ActionBtn icon={FileDown} label="Export Regulatory Audit" onClick={onExport} variant="primary" />
          )}
          {actions.length === 0 && (
            <span className="text-[10px] text-muted-foreground italic">Read-only role · no actions available</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, variant = 'default' }: {
  icon: any; label: string; onClick: () => void; variant?: 'default' | 'primary' | 'danger' | 'amber';
}) {
  return (
    <button onClick={onClick} className={cn(
      'flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded border transition-colors',
      variant === 'default' && 'bg-secondary border-border hover:bg-accent text-foreground',
      variant === 'primary' && 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/25',
      variant === 'danger'  && 'bg-rag-red border-rag-red rag-red hover:bg-destructive/25',
      variant === 'amber'   && 'bg-rag-amber border-rag-amber rag-amber',
    )}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function TS({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <div>
        <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
        <div className="text-xs font-mono font-semibold">{value}</div>
      </div>
    </div>
  );
}

function GroupDrilldown({ type, value, rows, onClose, onSelectBreach }: {
  type: 'system' | 'process' | 'lob'; value: string; rows: any[]; onClose: () => void; onSelectBreach: (row: KPIRow) => void;
}) {
  const breached = rows.filter(r => r.status === 'BREACHED');
  const totalBreaches = rows.reduce((s, r) => s + r.breaches, 0);
  const criticalCount = breached.filter(r => r.severity === 'Critical').length;
  const resolvedCount = breached.filter(r => r.resolutionStatus === 'Resolved').length;

  const breakdownData = useMemo(() => {
    const k = type === 'system' ? 'process' : 'system';
    const map = new Map<string, number>();
    rows.forEach(r => map.set(r[k], (map.get(r[k]) || 0) + r.breaches));
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
                {breakdownData.map((_, i) => <Cell key={i} fill={i === 0 ? 'hsl(0 72% 51%)' : 'hsl(38 92% 50%)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="px-4 py-3">
          <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
            Breached KPIs ({breached.length})
          </h3>
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin space-y-1">
            {breached.slice(0, 50).map(row => (
              <div key={row.id} onClick={() => onSelectBreach(row)}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-rag-red border border-rag-red/30 text-[10px] cursor-pointer hover:ring-1 hover:ring-primary/50">
                <span className="font-mono font-semibold text-foreground">{row.id}</span>
                <span className="text-muted-foreground">{row.date}</span>
                <span className={cn('font-semibold', row.severity === 'Critical' ? 'rag-red' : 'rag-amber')}>{row.severity}</span>
                <span className="font-mono rag-red">{row.breaches} breaches</span>
                {row.executiveFlag && <ShieldAlert className="h-3 w-3 rag-red" />}
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

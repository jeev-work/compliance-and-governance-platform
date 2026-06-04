import { useMemo, useState } from 'react';
import { useFilters } from '@/lib/filterContext';
import { SYSTEM_SPOC_MAP, KPIRow, RagState } from '@/lib/mockData';
import { cn, CHART_TOOLTIP } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  X, History, Activity, Phone, Mail, MessageSquare, User as UserIcon, GitFork, Flag,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Send, Lock,
} from 'lucide-react';
import { toast } from 'sonner';

const RAG_CLR: Record<RagState, string> = {
  GREEN: 'bg-rag-green rag-green border-rag-green',
  AMBER: 'bg-rag-amber rag-amber border-rag-amber',
  RED:   'bg-rag-red rag-red border-rag-red',
  GREY:  'bg-rag-grey rag-grey border-rag-grey',
  BLUE:  'bg-rag-blue rag-blue border-rag-blue',
  UNCONFIGURED: 'rag-unconfigured',
};

export function KpiHistoryPanel() {
  const { historyView, filters, setFilters, openDrilldown } = useFilters();
  if (!historyView) return null;

  const { pivot, rows } = historyView;
  const isAnalyst = filters.role === 'analyst';
  const spoc = SYSTEM_SPOC_MAP[pivot.system] ?? {
    name: pivot.assignee?.name ?? 'Unassigned', role: 'System SPOC',
    email: 'spoc@gov.demo', phone: '+1-555-0100', teams: '@spoc',
  };

  const clear = () => setFilters(f => ({ ...f, searchQuery: '' }));

  return (
    <div className="bg-card border border-primary/40 rounded-md mb-3 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-primary/5 rounded-t-md">
        <History className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground">
            Lifetime History · <span className="font-mono text-primary">{pivot.id}</span>
            <span className="text-muted-foreground font-normal"> · {pivot.system} → {pivot.process} · LoB {pivot.lob}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {rows.length.toLocaleString()} records on this API · {rows.filter(r => r.status === 'BREACHED').length} historical breaches
          </div>
        </div>
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono', RAG_CLR[pivot.ragState])}>
          {pivot.ragState}
        </span>
        <button onClick={clear} className="p-1 hover:bg-accent rounded" aria-label="Clear history view">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Performance strip (always shown) */}
      <PerformanceStrip rows={rows} />

      {/* SPOC contact card */}
      <SpocContactCard spoc={spoc} isAnalyst={isAnalyst} pivotId={pivot.id} />

      {/* Malfunction history — hidden for analyst */}
      {!isAnalyst && (
        <MalfunctionHistory rows={rows} openLatest={(r) => openDrilldown('breach', r.id, r)} />
      )}
    </div>
  );
}

function PerformanceStrip({ rows }: { rows: KPIRow[] }) {
  const stats = useMemo(() => {
    const totalVol = rows.reduce((s, r) => s + r.baseVolume, 0);
    const totalBr = rows.reduce((s, r) => s + r.breaches, 0);
    const sla = totalVol > 0 ? ((totalVol - totalBr) / totalVol) * 100 : 100;
    const breached = rows.filter(r => r.status === 'BREACHED');
    const ttd = breached.filter(r => r.timeToDetectMin).reduce((s, r) => s + (r.timeToDetectMin || 0), 0) / (breached.filter(r => r.timeToDetectMin).length || 1);
    const ttr = breached.filter(r => r.timeToResolveMin).reduce((s, r) => s + (r.timeToResolveMin || 0), 0) / (breached.filter(r => r.timeToResolveMin).length || 1);
    return { sla, totalBr, ttd: Math.round(ttd), ttr: Math.round(ttr), totalEvents: rows.length };
  }, [rows]);

  const trend = useMemo(() => rows.map(r => ({
    t: r.timestamp.slice(5, 10),
    fr: r.failureRate,
  })), [rows]);

  return (
    <div className="px-3 py-3 border-b border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
        <Activity className="h-3 w-3 text-primary" /> Performance · Lifetime
      </div>
      <div className="grid grid-cols-5 gap-2 mb-2">
        <Stat label="Aggregate SLA" value={`${stats.sla.toFixed(2)}%`} variant={stats.sla >= 99 ? 'green' : stats.sla >= 95 ? 'amber' : 'red'} />
        <Stat label="Total Events" value={stats.totalEvents.toLocaleString()} />
        <Stat label="Total Breaches" value={stats.totalBr.toLocaleString()} variant={stats.totalBr > 0 ? 'red' : 'green'} />
        <Stat label="Avg MTTD" value={stats.ttd ? `${stats.ttd}m` : '—'} />
        <Stat label="Avg MTTR" value={stats.ttr ? `${Math.floor(stats.ttr / 60)}h ${stats.ttr % 60}m` : '—'} />
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={trend}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="t" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
          <Tooltip {...CHART_TOOLTIP} />
          <Line type="monotone" dataKey="fr" stroke="hsl(var(--rag-red))" strokeWidth={1.4} dot={false} name="Failure %" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SpocContactCard({ spoc, isAnalyst, pivotId }: {
  spoc: { name: string; role: string; email: string; phone: string; teams: string };
  isAnalyst: boolean;
  pivotId: string;
}) {
  return (
    <div className="px-3 py-2 border-b border-border bg-accent/10">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
        <UserIcon className="h-3 w-3 text-primary" /> IT SPOC · for further details
      </div>
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <span className="font-semibold text-foreground">{spoc.name}</span>
        <span className="text-muted-foreground">{spoc.role}</span>
        <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {spoc.email}</span>
        <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {spoc.phone}</span>
        <span className="flex items-center gap-1 text-muted-foreground"><MessageSquare className="h-3 w-3" /> {spoc.teams}</span>
        {isAnalyst && (
          <button
            onClick={() => toast.success(`Request sent to ${spoc.name} for ${pivotId}`)}
            className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border bg-primary/15 border-primary/40 text-primary hover:bg-primary/25"
          >
            <Send className="h-3 w-3" /> Request more details
          </button>
        )}
      </div>
    </div>
  );
}

function MalfunctionHistory({ rows, openLatest }: { rows: KPIRow[]; openLatest: (r: KPIRow) => void }) {
  const breaches = useMemo(() =>
    [...rows].filter(r => r.status === 'BREACHED').sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  [rows]);
  const [expanded, setExpanded] = useState<string | null>(breaches[0]?.id ?? null);

  if (breaches.length === 0) {
    return (
      <div className="px-3 py-3 text-[11px] text-muted-foreground italic">
        No historical malfunctions recorded for this API. ✓ Clean lifetime.
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 rag-amber" /> Malfunction History &amp; Actions Taken ({breaches.length})
        </span>
        <button
          onClick={() => openLatest(breaches[0])}
          className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-primary/15 border-primary/40 text-primary hover:bg-primary/25"
        >
          Open latest incident →
        </button>
      </div>

      <div className="space-y-1.5 max-h-[360px] overflow-y-auto scrollbar-thin">
        {breaches.map(b => {
          const isOpen = expanded === b.id;
          return (
            <div key={b.id} className="border border-border rounded bg-secondary/30">
              <button
                onClick={() => setExpanded(isOpen ? null : b.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] hover:bg-accent/30 transition-colors"
              >
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="font-mono font-semibold text-foreground">{b.id}</span>
                <span className="text-muted-foreground font-mono">{new Date(b.timestamp).toLocaleString()}</span>
                <span className={cn('px-1 py-0.5 rounded font-bold text-[9px]', RAG_CLR[b.ragState])}>{b.ragState}</span>
                <span className={cn('font-semibold',
                  b.severity === 'Critical' ? 'rag-red' : b.severity === 'High' ? 'rag-amber' : 'text-muted-foreground')}>
                  {b.severity}
                </span>
                {b.executiveFlag && <Flag className="h-3 w-3 rag-red" />}
                {b.dependency && <GitFork className="h-3 w-3 text-chart-5" />}
                <span className="ml-auto text-muted-foreground">{b.resolutionStatus}</span>
                {b.assignee && <span className="text-muted-foreground">→ {b.assignee.name}</span>}
              </button>

              {isOpen && (
                <div className="px-3 py-2 border-t border-border/50 text-[10px] space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <Field label="Breaches" value={b.breaches.toLocaleString()} />
                    <Field label="Failure Rate" value={`${b.failureRate}%`} />
                    <Field label="MTTD" value={b.timeToDetectMin ? `${b.timeToDetectMin}m` : '—'} />
                    <Field label="MTTR" value={b.timeToResolveMin ? `${Math.floor(b.timeToResolveMin / 60)}h ${b.timeToResolveMin % 60}m` : '—'} />
                  </div>

                  {b.chaseTimeline.length > 0 && (
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider font-semibold text-[9px] mb-1">Actions Taken (Chase Timeline)</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {b.chaseTimeline.map((e, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-[9px]">
                              <span className="font-semibold text-primary">{e.step}</span>
                              <span className="text-muted-foreground ml-1">{new Date(e.timestamp).toLocaleTimeString()}</span>
                              <span className="text-muted-foreground ml-1">· {e.actor}</span>
                            </span>
                            {i < b.chaseTimeline.length - 1 && <span className="text-muted-foreground">→</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {b.dependency && (
                    <div className="px-2 py-1 rounded border border-chart-5/30 bg-chart-5/5">
                      <span className="text-chart-5 font-semibold">⑂ Multi-Team Dependency:</span>{' '}
                      <span className="text-foreground">{b.dependency.team}</span>{' '}
                      <span className="text-muted-foreground">· {b.dependency.linkedId} · {b.dependency.status}</span>
                    </div>
                  )}

                  {b.escalations.length > 0 && (
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider font-semibold text-[9px] mb-1">Escalations ({b.escalations.length})</div>
                      {b.escalations.map((e, i) => (
                        <div key={i} className="text-foreground/80">{e.from} → <span className="rag-amber font-semibold">{e.to}</span> · <span className="text-muted-foreground">{e.reason}</span></div>
                      ))}
                    </div>
                  )}

                  {b.ledgerEntries.length > 0 && (
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider font-semibold text-[9px] mb-1 flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> Immutable Ledger ({b.ledgerEntries.length})
                      </div>
                      <div className="space-y-0.5">
                        {b.ledgerEntries.map((l, i) => (
                          <div key={i} className="font-mono text-[9px] text-muted-foreground">
                            <span className="text-foreground">{new Date(l.timestamp).toLocaleString()}</span>
                            {' · '}<span className="text-primary">{l.action}</span>
                            {' · '}{l.actor}
                            {' · '}<span className="text-muted-foreground">{l.hash}</span>
                            {l.details && <span className="ml-1">· {l.details}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, variant }: { label: string; value: string; variant?: 'green' | 'amber' | 'red' }) {
  const color = variant === 'green' ? 'rag-green' : variant === 'amber' ? 'rag-amber' : variant === 'red' ? 'rag-red' : 'text-foreground';
  return (
    <div className="bg-card border border-border rounded px-2 py-1.5">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn('text-sm font-semibold font-mono', color)}>{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-mono text-foreground">{value}</div>
    </div>
  );
}

import { useFilters } from '@/lib/filterContext';
import { ChaseStep, KPIRow, RagState, LedgerEntry, getContactPhone } from '@/lib/mockData';
import { ROLE_ACTIONS } from '@/lib/rbac';
import { cn, CHART_TOOLTIP, escalationCountdown, fmtMinutes } from '@/lib/utils';
import {
  X, Clock, User, MessageSquare, ArrowUpRight, AlertTriangle, CheckCircle2, Shield,
  Flag, Wrench, GitFork, Send, FileDown, ShieldAlert, Lock, Timer, Phone,
} from 'lucide-react';
import { useMemo, useRef, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { toast } from 'sonner';

/** Inline contact phone badge — shown next to any displayed person name. */
function ContactPhone({ name }: { name: string | null | undefined }) {
  const phone = getContactPhone(name);
  if (!phone) return null;
  return (
    <a
      href={`tel:${phone.replace(/[^+\d]/g, '')}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-0.5 font-mono text-muted-foreground hover:text-primary"
      title={`Call ${name}`}
    >
      <Phone className="h-2.5 w-2.5" />{phone}
    </a>
  );
}


const DEPENDENCY_TEAMS = ['Network Ops', 'Infrastructure', 'Database Admin', 'Security Eng', 'Cloud Platform'];
const ASSIGNEE_POOL = [
  { name: 'J. Chen',     role: 'Sr. Engineer' },
  { name: 'M. Patel',    role: 'Compliance Lead' },
  { name: 'S. Kumar',    role: 'DevOps Manager' },
  { name: 'A. Williams', role: 'Risk Analyst' },
  { name: 'R. Thompson', role: 'IT Support Lead' },
  { name: 'K. Garcia',   role: 'Security Architect' },
  { name: 'L. Zhang',    role: 'VP Engineering' },
  { name: 'D. Okafor',   role: 'Head of Compliance' },
  { name: 'P. Novak',    role: 'CTO' },
];

function newLedgerEntry(action: string, actor: string, details?: string): LedgerEntry {
  const hex = 'abcdef0123456789';
  let h = '';
  for (let i = 0; i < 16; i++) h += hex[Math.floor(Math.random() * 16)];
  return { timestamp: new Date().toISOString(), actor, action, hash: `LDG-${h}`, details };
}

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
  if (drilldown.type === 'matrixCell' && drilldown.value) {
    const [sys, proc] = drilldown.value.split('||');
    const rows = filteredData.filter(r => r.system === sys && r.process === proc);
    return <MatrixCellDrilldown system={sys} process={proc} rows={rows} onClose={closeDrilldown}
      onSelect={(row) => openDrilldown('breach', row.id, row)} />;
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

function MatrixCellDrilldown({ system, process, rows, onClose, onSelect }: {
  system: string; process: string; rows: KPIRow[]; onClose: () => void; onSelect: (r: KPIRow) => void;
}) {
  const counts = rows.reduce((m, r) => { m[r.ragState] = (m[r.ragState] ?? 0) + 1; return m; }, {} as Record<RagState, number>);
  const sorted = [...rows].sort((a, b) => {
    const order: RagState[] = ['RED', 'AMBER', 'GREY', 'BLUE', 'UNCONFIGURED', 'GREEN'];
    return order.indexOf(a.ragState) - order.indexOf(b.ragState);
  });
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg w-full max-w-3xl mx-4 mb-8 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">{system} × {process}</h2>
              <p className="text-[10px] text-muted-foreground">{rows.length.toLocaleString()} KPIs · current status of every KPI in this cell</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-[10px] flex-wrap">
          {(['RED','AMBER','GREY','BLUE','GREEN','UNCONFIGURED'] as RagState[]).map(s => counts[s] ? (
            <span key={s} className={cn('px-1.5 py-0.5 rounded font-mono font-bold border', RAG_BG[s])}>
              {s}: {counts[s]}
            </span>
          ) : null)}
        </div>
        <div className="px-4 py-3 max-h-[480px] overflow-y-auto scrollbar-thin space-y-1">
          {sorted.map(r => {
            const c = escalationCountdown(r);
            const toneClass = c.tone === 'red' ? 'rag-red' : c.tone === 'amber' ? 'rag-amber' : c.tone === 'green' ? 'rag-green' : 'text-muted-foreground';
            return (
              <div key={r.id} onClick={() => onSelect(r)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded border text-[10px] cursor-pointer hover:ring-1 hover:ring-primary/50',
                  RAG_BG[r.ragState],
                  r.executiveFlag && 'exec-pulse',
                )}>
                <span className="font-mono font-semibold text-foreground">{r.id}</span>
                <span className="text-muted-foreground">{r.lob}</span>
                <span className={cn('font-bold font-mono px-1 rounded', RAG_BG[r.ragState])}>{r.ragState}</span>
                {r.status === 'BREACHED' && <span className="font-mono rag-red">{r.breaches} br</span>}
                {r.executiveFlag && <Flag className="h-3 w-3 rag-red" />}
                {r.dependency && <GitFork className="h-3 w-3 text-chart-5" />}
                <span className="ml-auto text-muted-foreground">{r.resolutionStatus}</span>
                {r.assignee && <span className="text-muted-foreground">→ {r.assignee.name} <ContactPhone name={r.assignee.name} /></span>}
                {r.status === 'BREACHED' && (
                  <span className={cn('flex items-center gap-1 font-semibold ml-1', toneClass)}>
                    <Timer className="h-2.5 w-2.5" /> {c.label}
                  </span>
                )}
              </div>
            );
          })}
          {sorted.length === 0 && <div className="text-[10px] text-muted-foreground italic text-center py-4">No KPIs in this intersection for the current filter scope.</div>}
        </div>
      </div>
    </div>
  );
}

function BreachDetail({ row, onClose }: { row: KPIRow; onClose: () => void }) {
  const { filters, mutateRow } = useFilters();
  const actions = ROLE_ACTIONS[filters.role];

  // Dependency toggle modal state
  const [depModal, setDepModal] = useState<null | { mode: 'enable' | 'disable'; team: string; reason: string; step: 'form' | 'confirm' }>(null);

  // Executive Flag + Reassign modal state
  const [execModal, setExecModal] = useState<null | { assignee: string; reason: string; step: 'form' | 'confirm' }>(null);

  // Tick every 30s so the countdown re-renders without a full data refresh
  const [, setNow] = useState(0);
  useEffect(() => { const t = setInterval(() => setNow(n => n + 1), 30000); return () => clearInterval(t); }, []);

  const countdown = escalationCountdown(row);

  // Time since the most recent state transition (chase event)
  const lastEvent = row.chaseTimeline[row.chaseTimeline.length - 1];
  const sinceLastMin = lastEvent
    ? Math.max(0, Math.floor((Date.now() - new Date(lastEvent.timestamp).getTime()) / 60000))
    : null;

  const appendLedger = (entry: LedgerEntry) => [...row.ledgerEntries, entry];

  const onAcknowledge = () => {
    mutateRow(row.id, {
      resolutionStatus: 'Investigating',
      stateFlags: row.stateFlags.filter(f => f !== 'Unacknowledged').concat('Acknowledged'),
      chaseTimeline: [...row.chaseTimeline, { step: 'Acknowledged', timestamp: new Date().toISOString(), actor: 'You' }],
      ledgerEntries: appendLedger(newLedgerEntry('Acknowledged', 'SPOC · You', 'Chase timer halted')),
    });
    toast.success(`${row.id} acknowledged — chase timer halted`);
  };
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (verifyTimer.current) clearTimeout(verifyTimer.current); }, []);

  const onDeploy = () => {
    const now = new Date().toISOString();
    mutateRow(row.id, {
      resolutionStatus: 'Verifying',
      stateFlags: row.stateFlags.filter(f => f !== 'Unacknowledged').concat('Verifying'),
      chaseTimeline: [...row.chaseTimeline,
        { step: 'Resolved', timestamp: now, actor: 'You' },
        { step: 'Verifying', timestamp: now, actor: 'System' },
      ],
      ledgerEntries: appendLedger(newLedgerEntry('Resolution Deployed', 'SPOC · You', 'Awaiting telemetry verification')),
    });
    toast.success(`Deploy Resolution sent — verifying telemetry (3s)…`);

    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    verifyTimer.current = setTimeout(() => {
      const closedAt = new Date().toISOString();
      mutateRow(row.id, {
        resolutionStatus: 'Resolved',
        status: 'CLEAN',
        ragState: 'GREEN',
        severity: 'Low',
        riskScore: 0,
        breaches: 0,
        failureRate: 0,
        stateFlags: row.stateFlags.filter(f => f !== 'Unacknowledged' && f !== 'Verifying' && f !== 'Escalated'),
        chaseTimeline: [...row.chaseTimeline,
          { step: 'Resolved', timestamp: now, actor: 'You' },
          { step: 'Verifying', timestamp: now, actor: 'System' },
          { step: 'Closed', timestamp: closedAt, actor: 'System' },
        ],
        ledgerEntries: [
          ...row.ledgerEntries,
          newLedgerEntry('Resolution Deployed', 'SPOC · You', 'Awaiting telemetry verification'),
          newLedgerEntry('Verified & Closed', 'System · Telemetry', 'RAG returned to GREEN'),
        ],
      });
      toast.success(`${row.id} verified & closed — RAG back to GREEN`);
    }, 3000);
  };

  const openEnableDep  = () => setDepModal({ mode: 'enable',  team: DEPENDENCY_TEAMS[0], reason: '', step: 'form' });
  const openDisableDep = () => setDepModal({ mode: 'disable', team: row.dependency?.team ?? '', reason: '', step: 'confirm' });

  const commitEnableDep = (team: string, reason: string) => {
    const ts = new Date().toISOString();
    mutateRow(row.id, {
      dependency: { team, timestamp: ts, linkedId: `SUB-${10000 + Math.floor(Math.random() * 89999)}`, status: 'open' },
      stateFlags: [...row.stateFlags.filter(f => f !== 'Cross-Functional'), 'Cross-Functional'],
      chaseTimeline: [...row.chaseTimeline, { step: 'Notified', timestamp: ts, actor: `Dependency → ${team}` }],
      ledgerEntries: appendLedger(newLedgerEntry('Multi-Team Dependency ENABLED', 'SPOC · You', `Notified ${team}${reason ? ` · ${reason}` : ''} · primary SLA timer paused`)),
    });
    setDepModal(null);
    toast.success(`Multi-team dependency ENABLED → ${team} notified · ledgered`);
  };
  const commitDisableDep = () => {
    const ts = new Date().toISOString();
    const prevTeam = row.dependency?.team ?? 'unknown';
    mutateRow(row.id, {
      dependency: null,
      stateFlags: row.stateFlags.filter(f => f !== 'Cross-Functional'),
      chaseTimeline: [...row.chaseTimeline, { step: 'Notified', timestamp: ts, actor: `Dependency cleared (${prevTeam})` }],
      ledgerEntries: appendLedger(newLedgerEntry('Multi-Team Dependency DISABLED', 'SPOC · You', `${prevTeam} de-notified · primary SLA timer resumed`)),
    });
    setDepModal(null);
    toast.success(`Multi-team dependency DISABLED · ledgered`);
  };

  const openExecModal = () => setExecModal({
    assignee: ASSIGNEE_POOL.find(a => a.name !== row.assignee?.name)?.name ?? ASSIGNEE_POOL[0].name,
    reason: '',
    step: 'form',
  });
  const commitExecFlag = (assigneeName: string, reason: string) => {
    const next = ASSIGNEE_POOL.find(a => a.name === assigneeName) ?? ASSIGNEE_POOL[0];
    const ts = new Date().toISOString();
    mutateRow(row.id, {
      executiveFlag: true,
      ragState: 'RED',
      resolutionStatus: 'Escalated to HOD',
      assignee: next,
      stateFlags: [...row.stateFlags.filter(f => f !== 'Escalated'), 'Escalated'],
      chaseTimeline: [...row.chaseTimeline, { step: 'Notified', timestamp: ts, actor: `Executive reassign → ${next.name}` }],
      ledgerEntries: [
        ...row.ledgerEntries,
        newLedgerEntry('EXECUTIVE FLAG raised', 'Executive · You', 'SLA timer nullified · Level 2 escalation'),
        newLedgerEntry('Reassigned by Executive', 'Executive · You', `→ ${next.name} (${next.role})${reason ? ` · ${reason}` : ''}`),
      ],
    });
    setExecModal(null);
    toast.error(`EXECUTIVE FLAG raised — reassigned to ${next.name}`);
  };
  const onReassign = () => {
    const pool = ['J. Chen', 'M. Patel', 'S. Kumar', 'A. Williams', 'R. Thompson', 'K. Garcia'].filter(n => n !== row.assignee?.name);
    const next = pool[Math.floor(Math.random() * pool.length)];
    mutateRow(row.id, {
      assignee: { name: next, role: 'Sr. Engineer' },
      chaseTimeline: [...row.chaseTimeline, { step: 'Notified', timestamp: new Date().toISOString(), actor: `Reassigned → ${next}` }],
      ledgerEntries: appendLedger(newLedgerEntry('Reassigned', 'LOB Manager · You', `→ ${next}`)),
    });
    toast.success(`${row.id} reassigned to ${next}`);
  };
  const onEscalate = () => {
    mutateRow(row.id, {
      resolutionStatus: 'Escalated to HOD',
      stateFlags: row.stateFlags.concat('Escalated'),
      ledgerEntries: appendLedger(newLedgerEntry('Escalated to HOD', 'LOB Manager · You')),
    });
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

        {/* Timeline metrics — escalation countdown is always live, never "—" for breaches */}
        <div className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-border">
          <TS icon={Clock} color="text-primary"  label="Time to Detect" value={fmtMinutes(row.timeToDetectMin)} />
          <TS
            icon={Timer}
            color={countdown.tone === 'red' ? 'rag-red' : countdown.tone === 'amber' ? 'rag-amber' : countdown.tone === 'green' ? 'rag-green' : 'text-muted-foreground'}
            label={countdown.overdue ? 'Escalate · OVERDUE' : 'Time to Escalate'}
            value={countdown.label}
          />
          <TS icon={CheckCircle2} color="rag-green" label="Time to Resolve" value={fmtMinutes(row.timeToResolveMin)} />
          <TS
            icon={Send}
            color="text-primary"
            label="Since Last Update"
            value={sinceLastMin == null ? '—' : fmtMinutes(sinceLastMin)}
          />
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

        {/* Immutable Ledger */}
        {row.ledgerEntries.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> Immutable Audit Ledger ({row.ledgerEntries.length})
            </h3>
            <div className="space-y-1 max-h-[180px] overflow-y-auto scrollbar-thin">
              {row.ledgerEntries.map((l, i) => (
                <div key={i} className="text-[10px] font-mono px-2 py-1 rounded bg-secondary/40 border border-border/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground">{new Date(l.timestamp).toLocaleString()}</span>
                    <span className="text-primary font-semibold">{l.action}</span>
                    <span className="text-muted-foreground">· {l.actor}</span>
                    <span className="ml-auto text-muted-foreground">{l.hash}</span>
                  </div>
                  {l.details && <div className="text-muted-foreground mt-0.5 font-sans">{l.details}</div>}
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
            row.dependency
              ? <ActionBtn icon={GitFork} label="Disable Multi-Team Dependency" onClick={openDisableDep} variant="amber" />
              : <ActionBtn icon={GitFork} label="Enable Multi-Team Dependency"  onClick={openEnableDep} />
          )}
          {actions.includes('reassign') && <ActionBtn icon={User} label="Reassign" onClick={onReassign} />}
          {actions.includes('escalate') && <ActionBtn icon={ArrowUpRight} label="Escalate" onClick={onEscalate} variant="amber" />}
          {actions.includes('executiveFlag') && (
            <ActionBtn icon={Flag} label={row.executiveFlag ? 'Reassign (Exec)' : 'Executive Flag'} onClick={openExecModal} variant="danger" />
          )}
          {actions.includes('exportAudit') && (
            <ActionBtn icon={FileDown} label="Export Regulatory Audit" onClick={onExport} variant="primary" />
          )}
          {actions.length === 0 && (
            <span className="text-[10px] text-muted-foreground italic">Read-only role · no actions available</span>
          )}
        </div>
      </div>

      {/* Multi-Team Dependency toggle modal */}
      {depModal && (
        <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDepModal(null)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <GitFork className="h-4 w-4 text-chart-5" />
                {depModal.mode === 'enable' ? 'Enable Multi-Team Dependency' : 'Disable Multi-Team Dependency'}
              </h3>
              <button onClick={() => setDepModal(null)} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
            </div>

            {depModal.mode === 'enable' && depModal.step === 'form' && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Notify Team</label>
                  <select
                    value={depModal.team}
                    onChange={(e) => setDepModal({ ...depModal, team: e.target.value })}
                    className="mt-1 w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                  >
                    {DEPENDENCY_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reason (optional)</label>
                  <input
                    value={depModal.reason}
                    onChange={(e) => setDepModal({ ...depModal, reason: e.target.value })}
                    placeholder="e.g. upstream firewall rule blocking traffic"
                    className="mt-1 w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button onClick={() => setDepModal(null)} className="text-[11px] px-3 py-1 rounded border bg-secondary border-border hover:bg-accent">Cancel</button>
                  <button
                    onClick={() => setDepModal({ ...depModal, step: 'confirm' })}
                    className="text-[11px] px-3 py-1 rounded border bg-primary/15 border-primary/40 text-primary font-semibold hover:bg-primary/25"
                  >Next →</button>
                </div>
              </div>
            )}

            {depModal.step === 'confirm' && (
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2 p-3 rounded border border-rag-amber bg-rag-amber">
                  <AlertTriangle className="h-4 w-4 rag-amber shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <div className="font-semibold text-foreground mb-1">Are you sure?</div>
                    {depModal.mode === 'enable' ? (
                      <div className="text-muted-foreground">
                        This will <span className="text-foreground font-semibold">notify {depModal.team}</span> and <span className="text-foreground font-semibold">pause the primary SLA timer</span>. This action will be written to the immutable audit ledger.
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        This will <span className="text-foreground font-semibold">de-notify {row.dependency?.team}</span> and <span className="text-foreground font-semibold">resume the primary SLA timer</span>. This action will be written to the immutable audit ledger.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => depModal.mode === 'enable' ? setDepModal({ ...depModal, step: 'form' }) : setDepModal(null)}
                    className="text-[11px] px-3 py-1 rounded border bg-secondary border-border hover:bg-accent"
                  >Cancel</button>
                  <button
                    onClick={() => depModal.mode === 'enable' ? commitEnableDep(depModal.team, depModal.reason) : commitDisableDep()}
                    className={cn(
                      'text-[11px] px-3 py-1 rounded border font-semibold flex items-center gap-1',
                      depModal.mode === 'enable'
                        ? 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/25'
                        : 'bg-rag-amber border-rag-amber rag-amber hover:opacity-80',
                    )}
                  >
                    <Lock className="h-3 w-3" /> Confirm &amp; Ledger
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Executive Flag + Reassign modal */}
      {execModal && (
        <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setExecModal(null)}>
          <div className="bg-card border border-rag-red rounded-lg w-full max-w-md shadow-2xl exec-pulse" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Flag className="h-4 w-4 rag-red" />
                {row.executiveFlag ? 'Reassign Flagged Ticket' : 'Raise Executive Flag & Reassign'}
              </h3>
              <button onClick={() => setExecModal(null)} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
            </div>

            {execModal.step === 'form' && (
              <div className="p-4 space-y-3">
                <div className="text-[10px] text-muted-foreground">
                  Current assignee: <span className="font-semibold text-foreground">{row.assignee?.name ?? 'Unassigned'}</span>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reassign To</label>
                  <select
                    value={execModal.assignee}
                    onChange={(e) => setExecModal({ ...execModal, assignee: e.target.value })}
                    className="mt-1 w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                  >
                    {ASSIGNEE_POOL.map(a => (
                      <option key={a.name} value={a.name}>{a.name} — {a.role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reason / Note (optional)</label>
                  <input
                    value={execModal.reason}
                    onChange={(e) => setExecModal({ ...execModal, reason: e.target.value })}
                    placeholder="e.g. direct line to CTO — needs hands-on owner"
                    className="mt-1 w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button onClick={() => setExecModal(null)} className="text-[11px] px-3 py-1 rounded border bg-secondary border-border hover:bg-accent">Cancel</button>
                  <button
                    onClick={() => setExecModal({ ...execModal, step: 'confirm' })}
                    className="text-[11px] px-3 py-1 rounded border bg-rag-red border-rag-red rag-red font-semibold hover:opacity-80"
                  >Next →</button>
                </div>
              </div>
            )}

            {execModal.step === 'confirm' && (
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2 p-3 rounded border border-rag-red bg-rag-red">
                  <AlertTriangle className="h-4 w-4 rag-red shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <div className="font-semibold text-foreground mb-1">Confirm Executive Action</div>
                    <div className="text-muted-foreground">
                      This will raise an <span className="text-foreground font-semibold">Executive Flag</span>, nullify the SLA timer, and reassign ownership to <span className="text-foreground font-semibold">{execModal.assignee}</span>. The action will be written to the immutable audit ledger.
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={() => setExecModal({ ...execModal, step: 'form' })} className="text-[11px] px-3 py-1 rounded border bg-secondary border-border hover:bg-accent">Back</button>
                  <button
                    onClick={() => commitExecFlag(execModal.assignee, execModal.reason)}
                    className="text-[11px] px-3 py-1 rounded border font-semibold flex items-center gap-1 bg-rag-red border-rag-red rag-red hover:opacity-80"
                  >
                    <Lock className="h-3 w-3" /> Confirm &amp; Ledger
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
              <Tooltip {...CHART_TOOLTIP} />
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

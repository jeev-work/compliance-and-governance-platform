import { useFilters } from '@/lib/filterContext';
import { ChaseStep, KPIRow, RagState, LedgerEntry, getContactPhone, ASSIGNEES, IMPACT_LABEL } from '@/lib/mockData';
import { exportMicroLedger, exportKpiRowsCsv } from '@/lib/exportLedger';
import { ROLE_ACTIONS } from '@/lib/rbac';
import { cn, CHART_TOOLTIP, escalationCountdown, fmtMinutes } from '@/lib/utils';
import {
  X, Clock, User, MessageSquare, ArrowUpRight, AlertTriangle, CheckCircle2, Shield,
  Flag, Wrench, GitFork, Send, Lock, Timer, Phone, ArrowLeft, Download, Activity, Search, Pin, Settings, Plug,
} from 'lucide-react';
import { useMemo, useRef, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { toast } from 'sonner';
import { CommentBoxWithMedia, AttachmentThumbs, CommentSubmission } from '@/components/CommentBoxWithMedia';
import { usePinned } from '@/components/PinnedKpiRail';
import { CONNECTION_LOST_MAP } from '@/lib/extraData';

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

function newLedgerEntry(action: string, actor: string, details?: string, attachments?: string[]): LedgerEntry {
  const hex = 'abcdef0123456789';
  let h = '';
  for (let i = 0; i < 16; i++) h += hex[Math.floor(Math.random() * 16)];
  return { timestamp: new Date().toISOString(), actor, action, hash: `LDG-${h}`, details, attachments };
}

/** "3m ago" / "2h ago" / "Mon 14:32" — friendly relative timestamp. */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleString();
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
  const { drilldown, closeDrilldown, filteredData, openDrilldown, drilldownStack, popDrilldown } = useFilters();
  if (!drilldown.type) return null;
  // Back always goes one step back — if stack is empty, it closes (instead of disappearing).
  const goBack = drilldownStack.length > 0 ? popDrilldown : closeDrilldown;
  const backLabel = drilldownStack.length > 0 ? 'Back to previous drilldown' : 'Close';

  if (drilldown.type === 'breach' && drilldown.row) {
    return <BreachDetail row={drilldown.row} onClose={closeDrilldown} onBack={goBack} backLabel={backLabel} />;
  }
  if (drilldown.type === 'matrixCell' && drilldown.value) {
    const [sys, proc] = drilldown.value.split('||');
    const rows = filteredData.filter(r => r.system === sys && r.process === proc);
    return <MatrixCellDrilldown system={sys} process={proc} rows={rows} onClose={closeDrilldown}
      onBack={goBack} backLabel={backLabel}
      onSelect={(row) => openDrilldown('breach', row.id, row)} />;
  }
  if (drilldown.type === 'system' || drilldown.type === 'process' || drilldown.type === 'lob') {
    const k = drilldown.type;
    const v = drilldown.value!;
    const rows = filteredData.filter(r => r[k] === v);
    return <GroupDrilldown type={k} value={v} rows={rows} onClose={closeDrilldown}
      onBack={goBack} backLabel={backLabel}
      onSelectBreach={(row) => openDrilldown('breach', row.id, row)} />;
  }
  return null;
}

function BackButton({ onBack, label = 'Back' }: { onBack: () => void; label?: string }) {
  return (
    <button
      onClick={onBack}
      className="p-1 hover:bg-accent rounded flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
      title={label}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back
    </button>
  );
}

/** Compact bottom-left footer Export button used by every drilldown modal. */
function FooterExport({ onClick, label = 'Export' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] font-semibold px-2.5 py-1 rounded border bg-primary/15 border-primary/40 text-primary hover:bg-primary/25 flex items-center gap-1"
      title="Export as CSV"
    >
      <Download className="h-3 w-3" /> {label}
    </button>
  );
}

/** Pin / unpin a KPI into the role's pinned rail at the top of the dashboard. */
function PinButton({ kpiId }: { kpiId: string }) {
  const { filters } = useFilters();
  const [pins, toggle] = usePinned(filters.role);
  const pinned = pins.includes(kpiId);
  return (
    <button
      onClick={() => { toggle(kpiId); toast.success(pinned ? 'Unpinned' : 'Pinned to your rail'); }}
      title={pinned ? 'Unpin from your rail' : 'Pin to your rail'}
      className={cn(
        'p-1.5 rounded border text-[10px] flex items-center gap-1',
        pinned ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-secondary border-border text-muted-foreground hover:text-foreground',
      )}
    >
      <Pin className={cn('h-3 w-3', pinned && 'fill-current')} />
    </button>
  );
}

function MatrixCellDrilldown({ system, process, rows, onClose, onBack, backLabel, onSelect }: {
  system: string; process: string; rows: KPIRow[]; onClose: () => void; onBack: () => void; backLabel?: string; onSelect: (r: KPIRow) => void;
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
            <BackButton onBack={onBack} label={backLabel} />
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
                {r.status === 'BREACHED' && <span className="font-mono rag-red">{r.breaches} breaches</span>}
                {r.executiveFlag && <Flag className="h-3 w-3 rag-red" />}
                {r.dependency && <GitFork className="h-3 w-3 text-chart-5" />}
                {r.dependency?.status === 'resolved' && !r.dependency.cascadeDismissed && r.resolutionStatus !== 'Resolved' && (
                  <span className="text-[9px] px-1 py-0.5 rounded font-semibold bg-rag-green rag-green border border-rag-green">↩ child resolved</span>
                )}
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
        <div className="px-4 py-2 border-t border-border bg-accent/10 rounded-b-lg flex items-center gap-2 justify-end">
          <FooterExport onClick={() => { exportKpiRowsCsv(rows, `cell-${system}-${process}`); toast.success(`Exported ${rows.length} rows`); }} />
        </div>
      </div>
    </div>
  );
}

function BreachDetail({ row, onClose, onBack, backLabel }: { row: KPIRow; onClose: () => void; onBack: () => void; backLabel?: string }) {
  const { filters, mutateRow, configSnapshots, registries } = useFilters();
  const actions = ROLE_ACTIONS[filters.role];

  // Dependency toggle modal state
  const [depModal, setDepModal] = useState<null | {
    mode: 'enable' | 'disable'; team: string; system: string; lob: string;
    comment: string; attachments: string[]; step: 'form' | 'confirm';
  }>(null);

  // Executive Flag + Reassign modal state
  const [execModal, setExecModal] = useState<null | { assignee: string; reason: string; step: 'form' | 'confirm' }>(null);

  // Standard Reassign modal state (non-executive) — now with search + filters
  const [reassignModal, setReassignModal] = useState<null | {
    assignee: string; reason: string;
    query: string; lobFilter: string; deptFilter: string; designationFilter: string;
  }>(null);

  // Resolve confirmation modal — captures a comment + media before closing.
  const [resolveModal, setResolveModal] = useState<null | {
    mode: 'standard' | 'cascade'; comment: string; attachments: string[];
  }>(null);

  // Tick every 30s so the countdown re-renders without a full data refresh
  const [, setNow] = useState(0);
  useEffect(() => { const t = setInterval(() => setNow(n => n + 1), 30000); return () => clearInterval(t); }, []);

  const countdown = escalationCountdown(row);
  const isClosed = row.resolutionStatus === 'Resolved' || row.status === 'CLEAN';

  // Time since the most recent state transition (chase event).
  // Hide for closed/clean rows (no longer meaningful); cap active rows at 72h+ so
  // a stale demo timestamp never reads "1651h 53m".
  const lastEvent = row.chaseTimeline[row.chaseTimeline.length - 1];
  const sinceLastRawMin = lastEvent
    ? Math.max(0, Math.floor((Date.now() - new Date(lastEvent.timestamp).getTime()) / 60000))
    : null;
  const sinceLastDisplay: string = isClosed
    ? '—'
    : sinceLastRawMin == null
      ? '—'
      : sinceLastRawMin >= 72 * 60
        ? '72h+'
        : fmtMinutes(sinceLastRawMin);

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

  /** Standard resolve flow — runs after the Resolve comment box is submitted. */
  const runDeploy = (note: string, attachments: string[]) => {
    const now = new Date().toISOString();
    mutateRow(row.id, {
      resolutionStatus: 'Verifying',
      stateFlags: row.stateFlags.filter(f => f !== 'Unacknowledged').concat('Verifying'),
      chaseTimeline: [...row.chaseTimeline,
        { step: 'Resolved', timestamp: now, actor: 'You' },
        { step: 'Verifying', timestamp: now, actor: 'System' },
      ],
      ledgerEntries: appendLedger(newLedgerEntry('Resolution Deployed', 'SPOC · You', note || 'Awaiting telemetry verification', attachments)),
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
          newLedgerEntry('Resolution Deployed', 'SPOC · You', note || 'Awaiting telemetry verification', attachments),
          newLedgerEntry('Ticket Closed', 'System · Telemetry', 'RAG returned to GREEN'),
        ],
      });
      toast.success(`${row.id} verified & closed — RAG back to GREEN`);
    }, 3000);
  };

  const openEnableDep  = () => setDepModal({
    mode: 'enable',
    team: DEPENDENCY_TEAMS[0],
    system: row.system,
    lob: row.lob,
    comment: '',
    attachments: [],
    step: 'form',
  });
  const openDisableDep = () => setDepModal({
    mode: 'disable',
    team: row.dependency?.team ?? '',
    system: row.system,
    lob: row.lob,
    comment: '',
    attachments: [],
    step: 'confirm',
  });

  const commitEnableDep = (d: { team: string; system: string; lob: string; comment: string; attachments: string[] }) => {
    const ts = new Date().toISOString();
    const routing = `${d.team} · ${d.system} · LoB ${d.lob}`;
    mutateRow(row.id, {
      dependency: { team: d.team, timestamp: ts, linkedId: `SUB-${10000 + Math.floor(Math.random() * 89999)}`, status: 'open', resolvedAt: null, resolvedBy: null, cascadeDismissed: false },
      stateFlags: [...row.stateFlags.filter(f => f !== 'Cross-Functional'), 'Cross-Functional'],
      chaseTimeline: [...row.chaseTimeline, { step: 'Notified', timestamp: ts, actor: `Dependency → ${d.team}` }],
      ledgerEntries: appendLedger(newLedgerEntry(
        'Multi-Team Dependency ENABLED', 'SPOC · You',
        `Routed to ${routing}${d.comment ? ` · ${d.comment}` : ''} · primary SLA timer paused`,
        d.attachments,
      )),
    });
    setDepModal(null);
    toast.success(`Multi-team dependency ENABLED → ${d.team} notified · ledgered`);
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
      executiveFlagSetAt: ts,
      ragState: 'RED',
      resolutionStatus: 'Escalated to HOD',
      assignee: next,
      stateFlags: [...row.stateFlags.filter(f => f !== 'Escalated'), 'Escalated'],
      chaseTimeline: [...row.chaseTimeline, { step: 'Notified', timestamp: ts, actor: `Executive reassign → ${next.name}` }],
      ledgerEntries: [
        ...row.ledgerEntries,
        newLedgerEntry('EXECUTIVE FLAG raised', 'Executive · You', 'SLA timer nullified · Level 2 escalation · auto-expires in 24h'),
        newLedgerEntry('Reassigned by Executive', 'Executive · You', `→ ${next.name} (${next.role})${reason ? ` · ${reason}` : ''}`),
      ],
    });
    setExecModal(null);
    toast.error(`EXECUTIVE FLAG raised — reassigned to ${next.name}`);
  };
  const openReassignModal = () => setReassignModal({
    assignee: ASSIGNEES.find(a => a.name !== row.assignee?.name)?.name ?? ASSIGNEES[0].name,
    reason: '',
    query: '',
    lobFilter: row.lob,
    deptFilter: row.system,
    designationFilter: '',
  });
  const commitReassign = (assigneeName: string, note: string) => {
    const next = ASSIGNEES.find(a => a.name === assigneeName) ?? ASSIGNEES[0];
    mutateRow(row.id, {
      assignee: { name: next.name, role: next.role },
      chaseTimeline: [...row.chaseTimeline, { step: 'Notified', timestamp: new Date().toISOString(), actor: `Reassigned → ${next.name}` }],
      ledgerEntries: appendLedger(newLedgerEntry('Reassigned', 'LOB Manager · You', `→ ${next.name} (${next.role})${note ? ` · ${note}` : ''}`)),
    });
    setReassignModal(null);
    toast.success(`${row.id} reassigned to ${next.name} · ${next.phone}`);
  };
  const onEscalate = () => {
    mutateRow(row.id, {
      resolutionStatus: 'Escalated to HOD',
      stateFlags: row.stateFlags.concat('Escalated'),
      ledgerEntries: appendLedger(newLedgerEntry('Escalated to HOD', 'LOB Manager · You')),
    });
    toast.success(`Escalated to HOD`);
  };
  const onExport = () => {
    exportMicroLedger({ kind: 'kpi', name: row.id }, row.ledgerEntries, configSnapshots, row);
    toast.success(`Audit exported · hash: ${row.auditLedgerId}`);
  };
  const onUnflag = () => {
    mutateRow(row.id, {
      executiveFlag: false,
      executiveFlagSetAt: null,
      ledgerEntries: appendLedger(newLedgerEntry('Executive Flag cleared', 'Executive · You', 'Manual un-flag · SLA timers resume')),
    });
    toast.success(`Executive Flag cleared on ${row.id}`);
  };

  // Cascade auto-suggest: child sub-ticket resolved → offer to verify & close parent.
  const showCascadeBanner = !!row.dependency
    && row.dependency.status === 'resolved'
    && !row.dependency.cascadeDismissed
    && row.resolutionStatus !== 'Resolved'
    && row.status !== 'CLEAN';

  /** Cascade close — runs after user submits resolve comment box (cascade mode). */
  const runCascadeClose = (note: string, attachments: string[]) => {
    if (!row.dependency) return;
    const dep = row.dependency;
    const ts = new Date().toISOString();
    mutateRow(row.id, {
      resolutionStatus: 'Verifying',
      stateFlags: row.stateFlags.filter(f => f !== 'Unacknowledged').concat('Verifying'),
      chaseTimeline: [...row.chaseTimeline,
        { step: 'Resolved', timestamp: ts, actor: 'You · cascade' },
        { step: 'Verifying', timestamp: ts, actor: 'System' },
      ],
      ledgerEntries: [
        ...row.ledgerEntries,
        newLedgerEntry('Parent closure suggested by cascade rule', 'SPOC · You',
          `Triggered by child resolution: ${dep.linkedId} (${dep.team})`),
        newLedgerEntry('Resolution Deployed', 'SPOC · You',
          note || 'Cascade close — awaiting telemetry verification', attachments),
      ],
    });
    toast.success(`Cascade close accepted — verifying telemetry (3s)…`);
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    verifyTimer.current = setTimeout(() => {
      mutateRow(row.id, {
        resolutionStatus: 'Resolved',
        status: 'CLEAN',
        ragState: 'GREEN',
        severity: 'Low',
        riskScore: 0,
        breaches: 0,
        failureRate: 0,
        stateFlags: row.stateFlags.filter(f => f !== 'Unacknowledged' && f !== 'Verifying' && f !== 'Escalated'),
        ledgerEntries: [
          ...row.ledgerEntries,
          newLedgerEntry('Parent closure suggested by cascade rule', 'SPOC · You',
            `Triggered by child resolution: ${dep.linkedId} (${dep.team})`),
          newLedgerEntry('Resolution Deployed', 'SPOC · You',
            note || 'Cascade close — awaiting telemetry verification', attachments),
          newLedgerEntry('Ticket Closed', 'System · Telemetry', 'Cascade closure verified — RAG returned to GREEN'),
        ],
      });
      toast.success(`${row.id} closed via cascade — RAG back to GREEN`);
    }, 3000);
  };

  const onCascadeDismiss = () => {
    if (!row.dependency) return;
    mutateRow(row.id, {
      dependency: { ...row.dependency, cascadeDismissed: true },
      ledgerEntries: appendLedger(newLedgerEntry('Cascade suggestion dismissed', 'SPOC · You',
        `Parent kept open despite child ${row.dependency.linkedId} resolution`)),
    });
    toast.message(`Cascade suggestion dismissed for ${row.id}`);
  };



  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto">
      <div className={cn(
        'bg-card border rounded-lg w-full max-w-3xl mx-4 mb-8 shadow-2xl',
        row.executiveFlag ? 'border-rag-red exec-pulse' : 'border-border',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <BackButton onBack={onBack} label={backLabel} />
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
          <div className="flex items-center gap-1">
            <PinButton kpiId={row.id} />
            <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* RAG strip + SLA Version + Severity = Impact × Urgency */}
        <div className="px-4 py-2 border-b border-border flex items-center gap-3 text-[10px] flex-wrap">
          <span className={cn('px-2 py-0.5 rounded font-bold', RAG_BG[row.ragState])}>{row.ragState}</span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded font-mono font-bold border',
              row.impactTier === 'T1' ? 'rag-red border-rag-red bg-rag-red'
              : row.impactTier === 'T2' ? 'rag-amber border-rag-amber bg-rag-amber'
              : row.impactTier === 'T3' ? 'text-chart-5 border-chart-5'
              : 'text-muted-foreground border-border',
            )}
            title={IMPACT_LABEL[row.impactTier]}
          >
            Impact {row.impactTier}
          </span>
          <span className="text-muted-foreground" title="Dynamic: how close this breach is to going critical right now">
            Urgency <span className="font-mono text-foreground">{row.urgencyScore}/4</span>
          </span>
          <span className="text-muted-foreground">Sev = Impact × Urgency = <span className="font-mono text-foreground">{row.severity}</span></span>
          <span className="text-muted-foreground">SLA: <span className="font-mono text-foreground">{row.slaVersion}</span></span>
          <span className="text-muted-foreground">Ledger: <span className="font-mono text-foreground">{row.auditLedgerId}</span></span>
          {row.maintenanceWindow && (
            <span className="ml-auto rag-blue font-medium">⏸ {row.maintenanceWindow}</span>
          )}
        </div>

        {/* Unconfigured / Connection-lost info card */}
        {(row.ragState === 'UNCONFIGURED' || row.ragState === 'GREY') && (() => {
          const lost = CONNECTION_LOST_MAP[row.id];
          const isUnc = row.ragState === 'UNCONFIGURED';
          return (
            <div className={cn(
              'mx-4 my-3 px-3 py-2.5 rounded border flex items-start gap-2',
              isUnc ? 'border-dashed border-rag-unconfigured rag-unconfigured' : 'border-rag-grey bg-rag-grey',
            )}>
              <Plug className={cn('h-4 w-4 shrink-0 mt-0.5', isUnc ? 'rag-unconfigured' : 'rag-grey')} />
              <div className="flex-1 text-[11px]">
                <div className="font-semibold text-foreground">
                  {isUnc ? 'KPI not yet configured — chase mechanism active' : 'Connection dead — routed to Platform Admin'}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {lost && <span>Connection lost <span className="text-foreground font-mono">{Math.floor((Date.now() - new Date(lost.lostAt).getTime()) / 60000)}m</span> ago · </span>}
                  {lost ? <span>Contact <span className="text-foreground font-semibold">{lost.contactPerson}</span> from <span className="text-foreground">{lost.contactOrg}</span> to restore the feed.</span>
                       : isUnc ? <span>Owner has been notified; escalation will fire after 24h without configuration.</span>
                       : <span>Telemetry will resume once the upstream connector recovers.</span>}
                </div>
              </div>
            </div>
          );
        })()}

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

        {/* Cascade auto-suggest banner — child resolved, prompt parent close */}
        {showCascadeBanner && row.dependency && (
          <div className="mx-4 my-3 px-3 py-2.5 rounded border border-rag-green bg-rag-green flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 rag-green shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px]">
              <div className="font-semibold text-foreground">
                Dependency <span className="font-mono">{row.dependency.linkedId}</span> resolved by {row.dependency.resolvedBy ?? row.dependency.team}
                {row.dependency.resolvedAt && (
                  <span className="text-muted-foreground font-normal"> · {new Date(row.dependency.resolvedAt).toLocaleString()}</span>
                )}
              </div>
              <div className="text-muted-foreground mt-0.5">
                The blocking child ticket is closed. Verify telemetry and close this parent KPI?
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onCascadeDismiss}
                className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >Dismiss</button>
              <button
                onClick={() => setResolveModal({ mode: 'cascade', comment: '', attachments: [] })}
                className="text-[11px] px-2.5 py-1 rounded border border-rag-green bg-rag-green rag-green font-semibold hover:opacity-80 flex items-center gap-1"
              >
                <CheckCircle2 className="h-3 w-3" /> Verify &amp; Close
              </button>
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
            color={isClosed ? 'text-muted-foreground' : countdown.tone === 'red' ? 'rag-red' : countdown.tone === 'amber' ? 'rag-amber' : countdown.tone === 'green' ? 'rag-green' : 'text-muted-foreground'}
            label={isClosed ? 'Time to Escalate' : countdown.overdue ? 'Escalate · OVERDUE' : 'Time to Escalate'}
            value={isClosed ? 'Not applicable' : countdown.label}
            caption={isClosed ? 'ticket resolved' : undefined}
          />
          <TS icon={CheckCircle2} color="rag-green" label="Time to Resolve" value={fmtMinutes(row.timeToResolveMin)} />
          <TS
            icon={Send}
            color="text-primary"
            label="Since Last Update"
            value={sinceLastDisplay}
            caption={isClosed ? 'ticket closed' : undefined}
          />
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-primary" />
            <div>
              <div className="text-[9px] text-muted-foreground uppercase">Assignee</div>
              <div className="text-xs font-semibold flex items-center gap-1.5">{row.assignee?.name || '—'} <ContactPhone name={row.assignee?.name} /></div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{esc.from}</span>
                      <ContactPhone name={esc.from} />
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold rag-amber">{esc.to}</span>
                      <ContactPhone name={esc.to} />
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
                      <ContactPhone name={c.author} />
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

        {/* Activity Log — human-friendly mirror of the immutable ledger */}
        {row.ledgerEntries.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
              <Activity className="h-3 w-3" /> Activity Log ({row.ledgerEntries.length})
              <span className="ml-auto text-[9px] text-muted-foreground italic font-normal normal-case tracking-normal">Same data as the ledger below — no export required.</span>
            </h3>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
              {[...row.ledgerEntries].reverse().map((l, i) => (
                <div key={i} className="text-[11px] px-2.5 py-1.5 rounded bg-accent/20 border border-border/40">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('inline-block h-1.5 w-1.5 rounded-full',
                      /Closed|Resolution Deployed|Verifying/i.test(l.action) ? 'bg-rag-green' :
                      /Escalated|EXECUTIVE|Reassigned/i.test(l.action) ? 'bg-rag-red' :
                      /Acknowledged|Dependency|cascade/i.test(l.action) ? 'bg-rag-amber' :
                      'bg-primary',
                    )} />
                    <span className="font-semibold text-foreground">{l.action}</span>
                    <span className="text-muted-foreground">· {l.actor}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{relTime(l.timestamp)}</span>
                  </div>
                  {l.details && <div className="text-muted-foreground mt-0.5 pl-3.5">{l.details}</div>}
                  <AttachmentThumbs urls={l.attachments} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Immutable Ledger (raw / WORM trail) */}
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
                  <AttachmentThumbs urls={l.attachments} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role-gated actions */}

        <div className="px-4 py-3 border-t border-border bg-accent/10 flex items-center gap-2 flex-wrap rounded-b-lg">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Actions</span>
          {actions.includes('acknowledge') && (
            <ActionBtn
              icon={CheckCircle2}
              label="Acknowledge"
              onClick={onAcknowledge}
              disabled={row.resolutionStatus !== 'Open' || row.stateFlags.includes('Acknowledged')}
              disabledLabel="Acknowledged"
            />
          )}
          {actions.includes('deployResolution') && (
            <ActionBtn
              icon={Wrench}
              label="Deploy Resolution"
              onClick={() => setResolveModal({ mode: 'standard', comment: '', attachments: [] })}
              variant="primary"
              disabled={row.status === 'CLEAN' || row.resolutionStatus === 'Verifying' || row.resolutionStatus === 'Resolved'}
              disabledLabel={row.resolutionStatus === 'Verifying' ? 'Verifying…' : 'Resolution Deployed'}
            />
          )}
          {actions.includes('tagDependency') && (
            row.dependency
              ? <ActionBtn
                  icon={GitFork}
                  label="Disable Multi-Team Dependency"
                  onClick={openDisableDep}
                  variant="amber"
                  disabled={row.resolutionStatus === 'Verifying' || row.resolutionStatus === 'Resolved'}
                  disabledLabel="Dependency Locked"
                />
              : <ActionBtn
                  icon={GitFork}
                  label="Enable Multi-Team Dependency"
                  onClick={openEnableDep}
                  disabled={row.resolutionStatus === 'Verifying' || row.resolutionStatus === 'Resolved'}
                  disabledLabel="Resolution In Progress"
                />
          )}
          {actions.includes('reassign') && <ActionBtn icon={User} label="Reassign" onClick={openReassignModal} />}
          {actions.includes('escalate') && <ActionBtn icon={ArrowUpRight} label="Escalate" onClick={onEscalate} variant="amber" />}
          {actions.includes('executiveFlag') && (
            <ActionBtn icon={Flag} label={row.executiveFlag ? 'Reassign (Exec)' : 'Executive Flag'} onClick={openExecModal} variant="danger" />
          )}
          {actions.includes('executiveFlag') && row.executiveFlag && (
            <ActionBtn icon={Flag} label="Un-flag (Exec)" onClick={onUnflag} variant="amber" />
          )}
          {filters.role === 'admin' && (
            <ActionBtn icon={Settings} label="Change Config" onClick={() => setConfigModal(true)} />
          )}
          {actions.length === 0 && filters.role !== 'admin' && (
            <span className="text-[10px] text-muted-foreground italic">No actions in this role · view-only context</span>
          )}
          <div className="ml-auto">
            <FooterExport onClick={onExport} />
          </div>
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
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Team</label>
                    <select
                      value={depModal.team}
                      onChange={(e) => setDepModal({ ...depModal, team: e.target.value })}
                      className="mt-1 w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                    >
                      {DEPENDENCY_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">System</label>
                    <select
                      value={depModal.system}
                      onChange={(e) => setDepModal({ ...depModal, system: e.target.value })}
                      className="mt-1 w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                    >
                      {registries.systems.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">LoB</label>
                    <select
                      value={depModal.lob}
                      onChange={(e) => setDepModal({ ...depModal, lob: e.target.value })}
                      className="mt-1 w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                    >
                      {registries.lobs.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Comment</label>
                  <div className="mt-1">
                    <CommentBoxWithMedia
                      placeholder="Add a note"
                      onChange={(s) => setDepModal({ ...depModal, comment: s.text, attachments: s.attachments })}
                    />
                  </div>
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
                    onClick={() => depModal.mode === 'enable' ? commitEnableDep(depModal) : commitDisableDep()}
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
                  Current assignee: <span className="font-semibold text-foreground">{row.assignee?.name ?? 'Unassigned'}</span> <ContactPhone name={row.assignee?.name} />
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

      {/* Standard Reassign modal — search box + LoB / Dept / Designation filters */}
      {reassignModal && (() => {
        const LOBS = ['B2B', 'B2C', 'Wheels'];
        // Synthesize lob/dept/designation for each assignee from their role.
        const enriched = ASSIGNEES.map((a, i) => {
          const parts = a.role.split('·').map(s => s.trim());
          const designation = parts[0] || a.role;
          const dept = parts[1] ? parts[1].replace(/\s*SPOC$/i, '').trim() : 'Cross-system';
          const lob = LOBS[i % LOBS.length];
          return { ...a, designation, dept, lob };
        });
        const q = reassignModal.query.trim().toLowerCase();
        const designationOptions = Array.from(new Set(enriched.map(e => e.designation))).sort();
        const filtered = enriched.filter(e => {
          if (e.name === row.assignee?.name) return false;
          if (reassignModal.lobFilter && e.lob !== reassignModal.lobFilter) return false;
          if (reassignModal.deptFilter && e.dept !== reassignModal.deptFilter) return false;
          if (reassignModal.designationFilter && e.designation !== reassignModal.designationFilter) return false;
          if (q) {
            const hay = `${e.name} ${e.role} ${e.dept} ${e.lob} ${e.designation}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        return (
          <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setReassignModal(null)}>
            <div className="bg-card border border-border rounded-lg w-full max-w-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Reassign Ticket
                </h3>
                <button onClick={() => setReassignModal(null)} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-[10px] text-muted-foreground">
                  Current assignee: <span className="font-semibold text-foreground">{row.assignee?.name ?? 'Unassigned'}</span> <ContactPhone name={row.assignee?.name} />
                </div>

                <div className="relative">
                  <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    value={reassignModal.query}
                    onChange={(e) => setReassignModal({ ...reassignModal, query: e.target.value })}
                    placeholder="Search by name, LoB, department, system, or designation…"
                    className="w-full h-8 text-xs bg-secondary border border-border rounded pl-7 pr-2 focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">LoB</label>
                    <select
                      value={reassignModal.lobFilter}
                      onChange={(e) => setReassignModal({ ...reassignModal, lobFilter: e.target.value })}
                      className="mt-1 w-full h-7 text-xs bg-secondary border border-border rounded px-2"
                    >
                      <option value="">All</option>
                      {LOBS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Department / System</label>
                    <select
                      value={reassignModal.deptFilter}
                      onChange={(e) => setReassignModal({ ...reassignModal, deptFilter: e.target.value })}
                      className="mt-1 w-full h-7 text-xs bg-secondary border border-border rounded px-2"
                    >
                      <option value="">All</option>
                      {Array.from(new Set(enriched.map(e => e.dept))).sort().map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Designation</label>
                    <select
                      value={reassignModal.designationFilter}
                      onChange={(e) => setReassignModal({ ...reassignModal, designationFilter: e.target.value })}
                      className="mt-1 w-full h-7 text-xs bg-secondary border border-border rounded px-2"
                    >
                      <option value="">All</option>
                      {designationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="max-h-[220px] overflow-y-auto scrollbar-thin border border-border/60 rounded">
                  {filtered.length === 0 && (
                    <div className="text-[10px] text-muted-foreground italic text-center py-4">No candidates match these filters.</div>
                  )}
                  {filtered.map(c => {
                    const active = reassignModal.assignee === c.name;
                    return (
                      <button
                        key={c.name}
                        onClick={() => setReassignModal({ ...reassignModal, assignee: c.name })}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 text-[11px] border-b border-border/40 hover:bg-accent/40',
                          active && 'bg-primary/10',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{c.name}</span>
                          <span className="text-[9px] font-mono px-1 rounded bg-secondary border border-border text-muted-foreground">{c.lob}</span>
                          <span className="text-[9px] font-mono px-1 rounded bg-secondary border border-border text-muted-foreground">{c.dept}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{c.phone}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{c.designation}</div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Handover note (optional)</label>
                  <input
                    value={reassignModal.reason}
                    onChange={(e) => setReassignModal({ ...reassignModal, reason: e.target.value })}
                    placeholder="e.g. context already shared on call — please continue triage"
                    className="mt-1 w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={() => setReassignModal(null)} className="text-[11px] px-3 py-1 rounded border bg-secondary border-border hover:bg-accent">Cancel</button>
                  <button
                    onClick={() => commitReassign(reassignModal.assignee, reassignModal.reason)}
                    className="text-[11px] px-3 py-1 rounded border bg-primary/15 border-primary/40 text-primary font-semibold hover:bg-primary/25 flex items-center gap-1"
                  >
                    <Send className="h-3 w-3" /> Confirm Reassignment
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Resolve confirmation modal — captures a comment + media before closing the ticket. */}
      {resolveModal && (
        <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setResolveModal(null)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 rag-green" />
                {resolveModal.mode === 'cascade' ? 'Verify & Close (cascade)' : 'Confirm Resolution'}
              </h3>
              <button onClick={() => setResolveModal(null)} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">What was resolved? *</label>
                <div className="mt-1">
                  <CommentBoxWithMedia
                    placeholder="Describe the fix, root cause, and any verification done"
                    required
                    rows={4}
                    onChange={(s: CommentSubmission) => setResolveModal({ ...resolveModal, comment: s.text, attachments: s.attachments })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => setResolveModal(null)} className="text-[11px] px-3 py-1 rounded border bg-secondary border-border hover:bg-accent">Cancel</button>
                <button
                  disabled={!resolveModal.comment.trim()}
                  onClick={() => {
                    const m = resolveModal;
                    setResolveModal(null);
                    if (m.mode === 'cascade') runCascadeClose(m.comment, m.attachments);
                    else runDeploy(m.comment, m.attachments);
                  }}
                  className={cn(
                    'text-[11px] px-3 py-1 rounded border font-semibold flex items-center gap-1',
                    resolveModal.comment.trim()
                      ? 'bg-rag-green border-rag-green rag-green hover:opacity-80'
                      : 'bg-secondary border-border text-muted-foreground opacity-50 cursor-not-allowed',
                  )}
                >
                  <CheckCircle2 className="h-3 w-3" /> Confirm Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, variant = 'default', disabled = false, disabledLabel }: {
  icon: any; label: string; onClick: () => void; variant?: 'default' | 'primary' | 'danger' | 'amber';
  disabled?: boolean; disabledLabel?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled && disabledLabel ? disabledLabel : undefined}
      className={cn(
      'flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded border transition-colors',
      variant === 'default' && 'bg-secondary border-border hover:bg-accent text-foreground',
      variant === 'primary' && 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/25',
      variant === 'danger'  && 'bg-rag-red border-rag-red rag-red hover:bg-destructive/25',
      variant === 'amber'   && 'bg-rag-amber border-rag-amber rag-amber',
      disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
    )}>
      <Icon className="h-3 w-3" /> {disabled && disabledLabel ? disabledLabel : label}
    </button>
  );
}

function TS({ icon: Icon, color, label, value, caption }: { icon: any; color: string; label: string; value: string; caption?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <div>
        <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
        <div className="text-xs font-mono font-semibold">{value}</div>
        {caption && <div className="text-[9px] text-muted-foreground italic">{caption}</div>}
      </div>
    </div>
  );
}

function GroupDrilldown({ type, value, rows, onClose, onBack, backLabel, onSelectBreach }: {
  type: 'system' | 'process' | 'lob'; value: string; rows: any[]; onClose: () => void; onBack: () => void; backLabel?: string; onSelectBreach: (row: KPIRow) => void;
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
            <BackButton onBack={onBack} label={backLabel} />
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
                {row.executiveFlag && <Flag className="h-3 w-3 rag-red" />}
                {row.dependency?.status === 'resolved' && !row.dependency.cascadeDismissed && row.resolutionStatus !== 'Resolved' && (
                  <span className="text-[9px] px-1 py-0.5 rounded font-semibold bg-rag-green rag-green border border-rag-green">↩ child resolved</span>
                )}
                <span className="ml-auto text-muted-foreground">{row.resolutionStatus}</span>
                {row.assignee && <span className="text-muted-foreground">→ {row.assignee.name} <ContactPhone name={row.assignee.name} /></span>}
              </div>
            ))}
            {breached.length > 50 && <div className="text-center text-[10px] text-muted-foreground py-1">+{breached.length - 50} more</div>}
          </div>
        </div>
        <div className="px-4 py-2 border-t border-border bg-accent/10 rounded-b-lg flex items-center gap-2 justify-end">
          <FooterExport onClick={() => { exportKpiRowsCsv(rows, `${type}-${value}`); toast.success(`Exported ${rows.length} rows`); }} />
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

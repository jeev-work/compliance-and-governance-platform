import { useMemo, useState } from 'react';
import { useFilters } from '@/lib/filterContext';
import { KPIRow, RagState } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import {
  Workflow, X, Settings, Activity, AlertTriangle, CheckCircle2, ClipboardCheck,
  ShieldCheck, Flag, Lock, Search, ChevronRight,
} from 'lucide-react';

const RAG_CLR: Record<RagState, string> = {
  GREEN: 'bg-rag-green rag-green border-rag-green',
  AMBER: 'bg-rag-amber rag-amber border-rag-amber',
  RED:   'bg-rag-red rag-red border-rag-red',
  GREY:  'bg-rag-grey rag-grey border-rag-grey',
  BLUE:  'bg-rag-blue rag-blue border-rag-blue',
  UNCONFIGURED: 'rag-unconfigured',
};

type Stage = {
  key: string;
  label: string;
  icon: any;
  rag: RagState;
  reached: boolean;
  timestamp?: string;
  actor?: string;
  detail?: string;
  hash?: string;
};

function buildStages(r: KPIRow): Stage[] {
  const chase = r.chaseTimeline;
  const ev = (step: string) => chase.find(c => c.step === step);
  const led = (action: RegExp) => r.ledgerEntries.find(l => action.test(l.action));

  const gen = ev('Generated');
  const notif = ev('Notified');
  const ack = ev('Acknowledged');
  const res = ev('Resolved');
  const ver = ev('Verifying');
  const closed = ev('Closed');

  const rcaLedger = led(/RCA|Resolution Deployed/i);
  const flagLedger = led(/EXECUTIVE/i);

  const stages: Stage[] = [
    {
      key: 'configured', label: 'Configured', icon: Settings, rag: 'BLUE',
      reached: true,
      timestamp: r.slaHistory[0]?.activeFrom,
      actor: r.slaHistory[0]?.changedBy ?? 'Platform Admin',
      detail: `SLA v${r.slaVersion} · target ${(r.targetSLA * 100).toFixed(2)}% · ${r.source}`,
    },
    {
      key: 'monitored', label: 'Monitored', icon: Activity, rag: 'GREEN',
      reached: true,
      timestamp: gen?.timestamp ?? r.timestamp,
      actor: 'System · Telemetry',
      detail: `Polling ${r.source} · baseline volume ${r.baseVolume.toLocaleString()}/window`,
    },
    {
      key: 'breached', label: 'Breach Detected', icon: AlertTriangle, rag: r.ragState === 'AMBER' ? 'AMBER' : 'RED',
      reached: r.status === 'BREACHED' || r.resolutionStatus !== 'Clean',
      timestamp: gen?.timestamp,
      actor: gen?.actor ?? 'System',
      detail: `RAG=${r.ragState} · sev=${r.severity} · failure ${r.failureRate.toFixed(2)}%`,
      hash: r.ledgerEntries[0]?.hash,
    },
    {
      key: 'notified', label: 'SPOC Notified', icon: Workflow, rag: 'AMBER',
      reached: !!notif,
      timestamp: notif?.timestamp,
      actor: notif?.actor ?? 'Notifier Bot',
      detail: r.assignee ? `→ ${r.assignee.name} · ${r.assignee.role}` : 'Awaiting routing',
    },
    {
      key: 'acknowledged', label: 'Acknowledged', icon: ClipboardCheck, rag: 'AMBER',
      reached: !!ack || r.resolutionStatus !== 'Open',
      timestamp: ack?.timestamp,
      actor: ack?.actor,
      detail: r.dependency ? `Chase timer halted · dependency fork → ${r.dependency.team}` : 'Chase timer halted',
    },
    {
      key: 'rca', label: 'RCA / Investigation', icon: Search, rag: 'AMBER',
      reached: r.resolutionStatus === 'Investigating' || !!res || !!ver,
      timestamp: rcaLedger?.timestamp,
      actor: rcaLedger?.actor,
      detail: r.comments[0]?.text?.slice(0, 120) ?? 'Root-cause analysis in progress',
    },
    {
      key: 'deployed', label: 'Resolution Deployed', icon: ShieldCheck, rag: 'BLUE',
      reached: !!res,
      timestamp: res?.timestamp,
      actor: res?.actor,
      detail: 'RCA submitted · awaiting telemetry verification',
      hash: led(/Resolution Deployed/i)?.hash,
    },
    {
      key: 'verifying', label: 'Verifying Fix', icon: Activity, rag: 'BLUE',
      reached: !!ver || r.resolutionStatus === 'Verifying' || r.resolutionStatus === 'Resolved',
      timestamp: ver?.timestamp,
      actor: 'System · Telemetry',
      detail: 'Validation hold · 3 polling cycles · auto-revert to GREEN on success',
    },
    {
      key: 'resolved', label: 'Resolved', icon: CheckCircle2, rag: 'GREEN',
      reached: r.resolutionStatus === 'Resolved',
      timestamp: closed?.timestamp ?? res?.timestamp,
      actor: r.resolvedBy ?? closed?.actor ?? 'SPOC',
      detail: r.timeToResolveMin ? `MTTR ${Math.floor(r.timeToResolveMin / 60)}h ${r.timeToResolveMin % 60}m` : 'Ticket closed',
    },
    {
      key: 'green', label: 'Back to GREEN', icon: CheckCircle2, rag: 'GREEN',
      reached: r.resolutionStatus === 'Resolved' && r.ragState === 'GREEN' && !r.executiveFlag,
      timestamp: closed?.timestamp,
      actor: 'System · Telemetry',
      detail: 'RAG returned to GREEN · ledger sealed',
      hash: led(/Ticket Closed/i)?.hash,
    },
  ];

  // Optional side-rails: executive flag
  if (r.executiveFlag) {
    stages.splice(stages.findIndex(s => s.key === 'acknowledged') + 1, 0, {
      key: 'execflag',
      label: 'Executive Flag',
      icon: Flag,
      rag: 'RED',
      reached: true,
      timestamp: r.executiveFlagSetAt ?? flagLedger?.timestamp,
      actor: flagLedger?.actor ?? 'Executive',
      detail: 'SLA timer nullified · Level 2 escalation · 24h auto-expiry',
      hash: flagLedger?.hash,
    });
  }
  return stages;
}

export function KpiLifecycleView({ onClose }: { onClose: () => void }) {
  const { allData } = useFilters();

  // Prefer a fully-lifecycled KPI for the default pick
  const defaultId = useMemo(() => {
    const candidate =
      allData.find(r => r.resolutionStatus === 'Resolved' && r.chaseTimeline.length >= 5 && r.ragState === 'GREEN' && !r.executiveFlag)
      ?? allData.find(r => r.resolutionStatus === 'Resolved')
      ?? allData[0];
    return candidate?.id ?? '';
  }, [allData]);

  const [kpiId, setKpiId] = useState<string>(defaultId);
  const [query, setQuery] = useState('');

  const row = useMemo(() => allData.find(r => r.id === kpiId) ?? allData.find(r => r.id === defaultId), [allData, kpiId, defaultId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allData.filter(r => r.id.toLowerCase().includes(q) || r.system.toLowerCase().includes(q) || r.process.toLowerCase().includes(q)).slice(0, 8);
  }, [allData, query]);

  if (!row) return <div className="text-xs text-muted-foreground p-4">No KPI data available.</div>;

  const stages = buildStages(row);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-card border border-primary/40 rounded-md shadow-lg">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-primary/5 rounded-t-md">
          <Workflow className="h-4 w-4 text-primary" />
          <div className="text-xs font-semibold text-foreground">
            KPI Lifecycle · <span className="font-mono text-primary">{row.id}</span>
            <span className="text-muted-foreground font-normal"> · {row.system} → {row.process} · LoB {row.lob}</span>
          </div>
          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono ml-2', RAG_CLR[row.ragState])}>{row.ragState}</span>
          <span className="text-[10px] font-mono text-muted-foreground ml-1">{row.resolutionStatus}</span>
          {row.executiveFlag && <Flag className="h-3.5 w-3.5 rag-red ml-1" />}
          <button onClick={onClose} className="ml-auto p-1 hover:bg-accent rounded" aria-label="Close lifecycle view">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* KPI picker */}
        <div className="px-3 py-2 border-b border-border flex items-center gap-2 relative">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pick another KPI — search by id, system, or process…"
            className="h-7 flex-1 text-xs bg-secondary border border-border rounded px-2 focus:outline-none focus:border-primary/50"
          />
          {matches.length > 0 && (
            <div className="absolute left-3 right-3 top-10 z-20 bg-popover border border-border rounded shadow-lg max-h-[260px] overflow-y-auto scrollbar-thin">
              {matches.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setKpiId(m.id); setQuery(''); }}
                  className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-accent flex items-center gap-2"
                >
                  <span className={cn('w-2 h-2 rounded-full', RAG_CLR[m.ragState])} />
                  <span className="font-mono font-semibold text-foreground">{m.id}</span>
                  <span className="text-muted-foreground">{m.system} · {m.process}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{m.resolutionStatus}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stage timeline */}
      <div className="bg-card border border-border rounded-md p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-primary" /> Lifecycle Timeline · {stages.length} stages
        </div>
        <div className="flex items-stretch gap-2 overflow-x-auto scrollbar-thin pb-2">
          {stages.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-stretch gap-2 shrink-0">
                <div className={cn(
                  'w-[200px] rounded-md border p-2 flex flex-col gap-1 transition-opacity',
                  s.reached ? RAG_CLR[s.rag] : 'border-border bg-secondary/30 opacity-50',
                )}>
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-semibold text-foreground">{s.label}</span>
                    <span className="ml-auto text-[8px] font-mono uppercase">{s.rag}</span>
                  </div>
                  {s.timestamp && (
                    <div className="text-[9px] font-mono text-muted-foreground">{new Date(s.timestamp).toLocaleString()}</div>
                  )}
                  {s.actor && (
                    <div className="text-[10px] text-foreground/90">{s.actor}</div>
                  )}
                  {s.detail && (
                    <div className="text-[10px] text-muted-foreground leading-snug">{s.detail}</div>
                  )}
                  {s.hash && (
                    <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1 mt-auto pt-1 border-t border-border/40">
                      <Lock className="h-2.5 w-2.5" /> {s.hash}
                    </div>
                  )}
                </div>
                {i < stages.length - 1 && (
                  <div className="flex items-center text-muted-foreground"><ChevronRight className="h-4 w-4" /></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Governing rules */}
      <div className="bg-card border border-border rounded-md p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-primary" /> Rules that govern this lifecycle
        </div>
        <ul className="space-y-1.5 text-[11px] text-foreground/90">
          <li className="flex gap-2">
            <span className="rag-green font-semibold shrink-0">·</span>
            <span><b>Auto-revert to GREEN</b> — when <code className="font-mono text-primary">resolutionStatus = Resolved</code>, the KPI's RAG flips to GREEN after the verification hold (3 polling cycles) and the next telemetry sample shows failure-rate below the active SLA threshold.</span>
          </li>
          <li className="flex gap-2">
            <span className="rag-amber font-semibold shrink-0">·</span>
            <span><b>Executive Flag block</b> — if <code className="font-mono text-primary">executiveFlag = true</code>, the KPI cannot return to GREEN until the flag is cleared or its 24h auto-expiry elapses, regardless of telemetry.</span>
          </li>
          <li className="flex gap-2">
            <span className="rag-blue font-semibold shrink-0">·</span>
            <span><b>Cool-down window</b> — a resolved KPI stays BLUE (Verifying) for the configured cool-down before being promoted to GREEN; this prevents flap-back from a stale buffer.</span>
          </li>
          <li className="flex gap-2">
            <span className="rag-red font-semibold shrink-0">·</span>
            <span><b>Dependency gate</b> — a parent ticket with an open cross-functional <code className="font-mono text-primary">dependency</code> cannot close. Once the child sub-ticket is resolved, the cascade banner offers one-click closure of the parent.</span>
          </li>
          <li className="flex gap-2">
            <span className="rag-grey font-semibold shrink-0">·</span>
            <span><b>Immutable ledger</b> — every stage transition writes a SHA-256-hashed ledger entry; the lifecycle cannot be re-played without leaving a WORM trail.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

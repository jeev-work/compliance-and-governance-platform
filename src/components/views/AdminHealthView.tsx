import { useMemo, useState } from 'react';
import { useFilters, AddKpiInput } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import {
  ServerCog, AlertOctagon, Database, FileWarning, Plus, Download,
  Building2, Layers, X, Info, Mail, Phone, AlertCircle, ArrowUpRight, Wrench, Upload, Copy,
} from 'lucide-react';
import { FILTER_OPTIONS, RAG_SHORT, Severity } from '@/lib/mockData';
import { EXTRA_GREY_ROWS, EXTRA_UNCONFIGURED_ROWS, CONNECTION_LOST_MAP, SNAPSHOT_META, LobMeta, SystemMeta, Tier, RegulatoryScope } from '@/lib/extraData';
import { toast } from 'sonner';

type AuthoringMode = null | 'kpi' | 'lob' | 'system';

const CONNECTOR_INCIDENTS: { title: string; detail: string; timeAgo: string; action: string; severity: 'high' | 'medium' | 'low' }[] = [
  { title: 'Schema drift detected', detail: 'payments_v2.metric_alerts — 3 new columns ignored by ingest mapper', timeAgo: '12m ago', action: 'Update mapper schema', severity: 'medium' },
  { title: 'Auth token rotated upstream', detail: 'AppDynamics service account — last successful poll 18m ago', timeAgo: '18m ago', action: 'Re-issue API token', severity: 'high' },
  { title: 'Rate limit (HTTP 429)', detail: 'Metrics API backing off · 6 retries scheduled', timeAgo: '4m ago', action: 'Throttle ingest interval', severity: 'medium' },
  { title: 'Webhook signature mismatch', detail: 'Incident provider — 14 events rejected as untrusted', timeAgo: '27m ago', action: 'Rotate shared secret', severity: 'high' },
  { title: 'Stale heartbeat', detail: 'ServiceNow connector idle 42m (threshold 15m)', timeAgo: '42m ago', action: 'Restart connector pod', severity: 'high' },
  { title: 'Connector outage cleared', detail: 'Payment Gateway · resumed after 6h grey-state window', timeAgo: '1h ago', action: 'Backfill missed window', severity: 'low' },
  { title: 'DNS resolution flapping', detail: 'metrics.internal — 18% intermittent NXDOMAIN', timeAgo: '8m ago', action: 'Check resolver overrides', severity: 'medium' },
];

function timeAgo(iso: string): string {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m ago` : `${Math.floor(h / 24)}d ago`;
}

export function AdminHealthView() {
  const {
    filteredData, allData, registries, addLob, addSystem, addKpi,
    configSnapshots, openDrilldown,
  } = useFilters();

  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [kpiQuery, setKpiQuery] = useState('');
  const [authoring, setAuthoring] = useState<AuthoringMode>(null);

  // Connector health by source
  const connectors = useMemo(() => FILTER_OPTIONS.SOURCES.map(src => {
    const rows = filteredData.filter(r => r.source === src);
    const grey = rows.filter(r => r.ragState === 'GREY').length;
    const total = rows.length;
    const greyPct = total > 0 ? (grey / total) * 100 : 0;
    const health: 'GREEN' | 'AMBER' | 'RED' = greyPct > 5 ? 'RED' : greyPct > 1 ? 'AMBER' : 'GREEN';
    return { source: src, total, grey, greyPct, health };
  }), [filteredData]);

  // Combine real grey + dummy "recently lost connection" rows
  const greyRows = useMemo(() => {
    const real = filteredData.filter(r => r.ragState === 'GREY').slice(0, 10);
    return [...EXTRA_GREY_ROWS, ...real];
  }, [filteredData]);

  const unconfiguredRows = useMemo(() => {
    const real = filteredData.filter(r => r.ragState === 'UNCONFIGURED').slice(0, 8);
    return [...EXTRA_UNCONFIGURED_ROWS, ...real];
  }, [filteredData]);

  const kpiPicks = useMemo(() => {
    const q = kpiQuery.trim().toLowerCase();
    const base = filteredData.slice(0, 400);
    if (!q) return base.slice(0, 60);
    return base.filter(r => r.id.toLowerCase().includes(q) || r.system.toLowerCase().includes(q) || r.process.toLowerCase().includes(q)).slice(0, 60);
  }, [filteredData, kpiQuery]);

  const selectedRow = useMemo(
    () => selectedKpi ? allData.find(r => r.id === selectedKpi) ?? null : kpiPicks[0] ?? null,
    [selectedKpi, allData, kpiPicks],
  );

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-3">
        <ServerCog className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Admin Configuration Console</span>
        <span className="text-[10px] text-muted-foreground">Connectors · per-KPI SLA history · authoring · escalation triage</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setAuthoring('kpi')}
            className="text-[10px] font-semibold px-2 py-1 rounded border bg-primary/15 border-primary/40 text-primary hover:bg-primary/25 flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add KPI
          </button>
          <button onClick={() => setAuthoring('lob')}
            className="text-[10px] font-semibold px-2 py-1 rounded border bg-secondary border-border hover:bg-accent flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Add LoB
          </button>
          <button onClick={() => setAuthoring('system')}
            className="text-[10px] font-semibold px-2 py-1 rounded border bg-secondary border-border hover:bg-accent flex items-center gap-1">
            <Layers className="h-3 w-3" /> Add Department
          </button>
        </div>
      </div>

      {/* Registries strip — LoB and System are now clickable to open a summary drilldown */}
      <div className="grid grid-cols-2 gap-2">
        <RegistryCard
          icon={Building2} label="LoBs" items={registries.lobs}
          meta={registries.lobMeta}
          onOpen={(name) => openDrilldown('lob', name)}
        />
        <RegistryCard
          icon={Layers} label="Systems / Departments" items={registries.systems}
          meta={registries.systemMeta}
          onOpen={(name) => openDrilldown('system', name)}
        />
      </div>

      {/* Connector incidents + Grey-state pipeline alerts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Database className="h-3 w-3" /> Connector Incidents
          </h3>
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto scrollbar-thin">
            {CONNECTOR_INCIDENTS.map((inc, i) => (
              <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded border border-border/60 bg-secondary/30">
                <span className={cn(
                  'mt-1 inline-block h-1.5 w-1.5 rounded-full shrink-0',
                  inc.severity === 'high'   && 'bg-rag-red',
                  inc.severity === 'medium' && 'bg-rag-amber',
                  inc.severity === 'low'    && 'bg-muted-foreground',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-foreground">{inc.title}</div>
                  <div className="text-[10px] text-muted-foreground">{inc.detail}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                    {inc.timeAgo} · Recommended: <span className="text-foreground/80">{inc.action}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertOctagon className="h-3 w-3" /> Grey-State Pipeline Alerts ({greyRows.length})
          </h3>
          <div className="space-y-1 max-h-[260px] overflow-y-auto scrollbar-thin">
            {greyRows.map(r => {
              const lost = CONNECTION_LOST_MAP[r.id];
              return (
                <div key={r.id} onClick={() => openDrilldown('breach', r.id, r)}
                  className="text-[10px] px-2 py-1.5 rounded bg-rag-grey border border-rag-grey cursor-pointer hover:ring-1 hover:ring-primary/50">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">{r.id}</span>
                    <span className="rag-grey font-semibold">{r.system}</span>
                    <span className="text-muted-foreground ml-auto">{r.source}</span>
                  </div>
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span>Connection dead{lost ? ` · lost ${timeAgo(lost.lostAt)}` : ''}</span>
                    {lost && <span className="text-[9px] italic">contact {lost.contactPerson} @ {lost.contactOrg}</span>}
                  </div>
                </div>
              );
            })}
            {greyRows.length === 0 && <div className="text-[10px] text-muted-foreground italic text-center py-4">All connectors healthy</div>}
          </div>
        </div>
      </div>

      {/* Unconfigured KPI lifecycle */}
      <div className="bg-card border border-border rounded-md p-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3 rag-unconfigured" /> Unconfigured KPIs — needs setup ({unconfiguredRows.length})
          <span className="ml-2 text-[9px] text-muted-foreground italic font-normal normal-case tracking-normal">Not a breach but impactful — chase mechanism active even with dead connections</span>
        </h3>
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-thin">
          {unconfiguredRows.map(r => {
            const lost = CONNECTION_LOST_MAP[r.id];
            const chaseCount = r.chaseTimeline.length;
            const escCount = r.escalations.length;
            return (
              <div key={r.id} className="px-2 py-2 rounded border rag-unconfigured">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-foreground text-[11px]">{r.id}</span>
                  <span className="text-[10px] text-muted-foreground">{r.system} · {r.process} · LoB {r.lob}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded font-semibold rag-unconfigured border">UNCONFIGURED</span>
                  {r.assignee && <span className="text-[10px] text-muted-foreground">Owner: <span className="text-foreground">{r.assignee.name}</span></span>}
                  <div className="ml-auto flex items-center gap-1.5">
                    <button onClick={() => openDrilldown('breach', r.id, r)} className="text-[10px] px-2 py-0.5 rounded border bg-secondary border-border hover:bg-accent">View Trail</button>
                    <button onClick={() => toast.success(`Configuration wizard opened for ${r.id}`)} className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-primary/15 border-primary/40 text-primary hover:bg-primary/25 flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> Add Configuration
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span>Chase events: <span className="text-foreground font-mono">{chaseCount}</span></span>
                  <span>Escalations: <span className="text-foreground font-mono">{escCount}</span></span>
                  {lost && <span className="rag-grey">Connection dead for <span className="font-mono">{timeAgo(lost.lostAt)}</span> — contact <span className="text-foreground">{lost.contactPerson}</span> from <span className="text-foreground">{lost.contactOrg}</span> to restore</span>}
                </div>
                {r.chaseTimeline.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    {r.chaseTimeline.slice(-4).map((c, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded border border-border/60 bg-secondary/40 text-muted-foreground font-mono">
                        {c.step} · {timeAgo(c.timestamp)}
                      </span>
                    ))}
                    <button
                      onClick={() => toast.success(`Escalation sent for ${r.id}`)}
                      className="ml-auto text-[10px] text-primary hover:underline flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3" /> Escalate now
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-KPI SLA Vault — left picker, right history + snapshot card */}
      <div className="bg-card border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <FileWarning className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Per-KPI SLA Version History & Configuration Snapshots</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">WORM-locked · evaluation uses rule active at incident time</span>
        </div>
        <div className="grid grid-cols-5 gap-0">
          <div className="col-span-2 border-r border-border max-h-[420px] flex flex-col">
            <input
              value={kpiQuery}
              onChange={e => setKpiQuery(e.target.value)}
              placeholder="Search KPI id / system / process…"
              className="m-2 h-7 text-xs bg-secondary border border-border rounded px-2"
            />
            <div className="overflow-y-auto scrollbar-thin flex-1">
              {kpiPicks.map(r => (
                <button key={r.id} onClick={() => setSelectedKpi(r.id)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-[10px] border-b border-border/40 hover:bg-accent/30 flex items-center gap-2',
                    selectedRow?.id === r.id && 'bg-primary/10',
                  )}>
                  <span className="font-mono font-semibold text-foreground">{r.id}</span>
                  <span className={cn('px-1 py-0.5 rounded font-bold font-mono text-[9px]',
                    r.ragState === 'RED' ? 'bg-rag-red rag-red' :
                    r.ragState === 'AMBER' ? 'bg-rag-amber rag-amber' :
                    r.ragState === 'GREY' ? 'bg-rag-grey rag-grey' :
                    r.ragState === 'BLUE' ? 'bg-rag-blue rag-blue' :
                    r.ragState === 'GREEN' ? 'bg-rag-green rag-green' : 'rag-unconfigured',
                  )}>{RAG_SHORT[r.ragState]}</span>
                  <span className="text-muted-foreground truncate">{r.system} · {r.process}</span>
                  <span className="ml-auto font-mono text-[9px] text-muted-foreground">{r.slaVersion}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-3 p-3">
            {selectedRow ? (
              <>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-mono font-semibold text-foreground text-xs">{selectedRow.id}</span>
                  <span className="text-[10px] text-muted-foreground">{selectedRow.system} · {selectedRow.process} · LoB {selectedRow.lob}</span>
                </div>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left px-2 py-1 font-medium">Version</th>
                      <th className="text-left px-2 py-1 font-medium">Active From</th>
                      <th className="text-left px-2 py-1 font-medium">Active Till</th>
                      <th className="text-left px-2 py-1 font-medium">Changed By</th>
                      <th className="text-right px-2 py-1 font-medium">Threshold</th>
                      <th className="text-left px-2 py-1 font-medium">Change Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRow.slaHistory.map((v, i) => {
                      const active = i === selectedRow.slaHistory.length - 1;
                      const next = selectedRow.slaHistory[i + 1];
                      const activeTill = next ? next.activeFrom.slice(0, 10) : '—';
                      return (
                        <tr key={v.version + i} className={cn('border-b border-border/40', active && 'bg-primary/5')}>
                          <td className="px-2 py-1 font-mono font-semibold text-foreground">
                            <span className="inline-flex items-center gap-1">
                              <VersionInfo version={v.version} />
                              {v.version}
                              {active && <span className="ml-1 text-[9px] rag-green">ACTIVE</span>}
                            </span>
                          </td>
                          <td className="px-2 py-1 font-mono text-muted-foreground">{v.activeFrom.slice(0, 10)}</td>
                          <td className="px-2 py-1 font-mono text-muted-foreground">{activeTill}</td>
                          <td className="px-2 py-1">{v.changedBy}</td>
                          <td className="px-2 py-1 text-right font-mono">{v.threshold}</td>
                          <td className="px-2 py-1 text-muted-foreground">{v.changeNote}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Active configuration snapshot card */}
                {(() => {
                  const active = selectedRow.slaHistory[selectedRow.slaHistory.length - 1];
                  const meta = SNAPSHOT_META[active?.version];
                  if (!active) return null;
                  return (
                    <div className="mt-3 p-3 rounded border border-primary/30 bg-primary/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Active Configuration Snapshot</span>
                        <span className="font-mono text-foreground text-[11px] ml-1">{active.version}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="text-muted-foreground">Deployed: <span className="text-foreground font-mono">{new Date(active.activeFrom).toLocaleString()}</span></div>
                        <div className="text-muted-foreground">Threshold: <span className="text-foreground font-mono">{active.threshold}</span></div>
                        <div className="text-muted-foreground">Actor: <span className="text-foreground">{active.changedBy}</span></div>
                        {meta && <div className="text-muted-foreground">Supersedes: <span className="font-mono">{meta.supersedes ?? '—'}</span></div>}
                        <div className="col-span-2 text-muted-foreground">Reason: <span className="text-foreground">{meta?.reason ?? active.changeNote}</span></div>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-[10px] text-muted-foreground italic text-center py-8">Select a KPI to view its lifetime SLA version history and active snapshot.</div>
            )}
          </div>
        </div>
      </div>

      {authoring && (
        <AuthoringModal
          mode={authoring}
          onClose={() => setAuthoring(null)}
          registries={registries}
          existingKpis={allData}
          onAddLob={(n, meta) => addLob(n, 'Admin · You', meta)}
          onAddSystem={(n, meta) => addSystem(n, 'Admin · You', meta)}
          onAddKpi={(input) => addKpi(input, 'Admin · You')}
        />
      )}
    </div>
  );
}

function VersionInfo({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  const meta = SNAPSHOT_META[version];
  if (!meta) return null;
  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-primary hover:text-primary/80"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <span className="absolute z-50 left-0 top-full mt-1 w-60 bg-popover border border-border rounded shadow-xl p-2 text-[10px] text-popover-foreground">
          <div className="font-semibold text-foreground mb-0.5">{version}</div>
          <div className="text-muted-foreground">Deployed: <span className="text-foreground font-mono">{new Date(meta.deployedAt).toLocaleString()}</span></div>
          <div className="text-muted-foreground">Actor: <span className="text-foreground">{meta.actor}</span></div>
          <div className="text-muted-foreground">Reason: <span className="text-foreground">{meta.reason}</span></div>
        </span>
      )}
    </span>
  );
}

function RegistryCard({ icon: Icon, label, items, meta, onOpen }: {
  icon: any; label: string; items: string[];
  meta: Record<string, LobMeta | SystemMeta>;
  onOpen: (name: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-md p-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label} ({items.length})
        <span className="ml-2 text-[9px] italic text-muted-foreground font-normal normal-case tracking-normal">Click name → summary drilldown</span>
      </h3>
      <div className="space-y-1 max-h-[140px] overflow-y-auto scrollbar-thin">
        {items.map(name => {
          const m = meta[name];
          return (
            <button
              key={name}
              onClick={() => onOpen(name)}
              className="w-full flex items-center gap-2 text-[10px] px-2 py-1 rounded bg-secondary/40 border border-border/40 hover:bg-accent/40 hover:ring-1 hover:ring-primary/50 transition-all text-left">
              <span className="font-semibold text-foreground">{name}</span>
              {m && 'tier' in m && <span className="text-[9px] font-mono px-1 rounded border border-border text-muted-foreground">{m.tier}</span>}
              {m?.owner && <span className="text-muted-foreground truncate">owner: {m.owner}</span>}
              <ArrowUpRight className="h-3 w-3 text-muted-foreground ml-auto" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============== Authoring Modal (Manual / Import JSON / Clone) ============== */

type AuthTab = 'manual' | 'import' | 'clone';

function AuthoringModal({ mode, onClose, registries, existingKpis, onAddLob, onAddSystem, onAddKpi }: {
  mode: 'kpi' | 'lob' | 'system';
  onClose: () => void;
  registries: { lobs: string[]; systems: string[]; processes: string[]; lobMeta: Record<string, LobMeta>; systemMeta: Record<string, SystemMeta> };
  existingKpis: any[];
  onAddLob: (n: string, meta?: Partial<LobMeta>) => void;
  onAddSystem: (n: string, meta?: Partial<SystemMeta>) => void;
  onAddKpi: (i: AddKpiInput) => void;
}) {
  const [tab, setTab] = useState<AuthTab>('manual');
  const [name, setName] = useState('');
  const [importReady, setImportReady] = useState<null | { name: string; payload: any }>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [cloneFrom, setCloneFrom] = useState<string>('');
  const [lobMeta, setLobMeta] = useState<Partial<LobMeta>>({ tier: 'T3', regulatoryScope: ['Internal'], linkedSystems: [], defaultSla: 'SLA_v1.3' });
  const [sysMeta, setSysMeta] = useState<Partial<SystemMeta>>({ tier: 'T3', linkedLobs: [], defaultSla: 'SLA_v1.3' });
  const [kpi, setKpi] = useState<AddKpiInput>({
    lob: registries.lobs[0] ?? '', system: registries.systems[0] ?? '',
    process: registries.processes[0] ?? '', source: FILTER_OPTIONS.SOURCES[0],
    targetSLA: 0.05, severity: 'Medium' as Severity,
    spoc: 'New SPOC', configFile: 'kpi-config.yaml',
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(t => {
      try {
        const payload = JSON.parse(t);
        const validated = mode === 'kpi'
          ? (payload.lob && payload.system && payload.process)
          : payload.name;
        if (!validated) throw new Error('Required fields missing');
        setImportReady({ name: payload.name ?? `${payload.system}/${payload.process}`, payload });
        setImportError(null);
        if (mode === 'kpi') setKpi({ ...kpi, ...payload });
        if (mode === 'lob') { setName(payload.name); setLobMeta({ ...lobMeta, ...payload }); }
        if (mode === 'system') { setName(payload.name); setSysMeta({ ...sysMeta, ...payload }); }
      } catch (err: any) {
        setImportError(err.message || 'Invalid JSON');
        setImportReady(null);
      }
    });
  };

  const cloneOptions = mode === 'kpi' ? existingKpis.slice(0, 50).map(r => ({ value: r.id, label: `${r.id} · ${r.system}/${r.process}` }))
    : mode === 'lob' ? registries.lobs.map(l => ({ value: l, label: l }))
    : registries.systems.map(s => ({ value: s, label: s }));

  const applyClone = (val: string) => {
    setCloneFrom(val);
    if (mode === 'kpi') {
      const src = existingKpis.find(r => r.id === val);
      if (src) setKpi({ lob: src.lob, system: src.system, process: src.process, source: src.source, targetSLA: src.targetSLA, severity: src.severity, spoc: src.assignee?.name ?? 'New SPOC', configFile: 'cloned-from-' + src.id + '.yaml' });
    } else if (mode === 'lob') {
      const src = registries.lobMeta[val];
      if (src) { setName(val + ' (copy)'); setLobMeta({ ...src }); }
    } else {
      const src = registries.systemMeta[val];
      if (src) { setName(val + ' (copy)'); setSysMeta({ ...src }); }
    }
  };

  const submit = () => {
    if (mode === 'lob') {
      if (!name.trim()) return toast.error('Name required');
      onAddLob(name.trim(), lobMeta);
      toast.success(`LoB "${name}" created · ledger started`);
    }
    if (mode === 'system') {
      if (!name.trim()) return toast.error('Name required');
      onAddSystem(name.trim(), sysMeta);
      toast.success(`Department "${name}" created · ledger started`);
    }
    if (mode === 'kpi') {
      if (!kpi.lob || !kpi.system || !kpi.process) return toast.error('LoB, System and Process are required');
      onAddKpi(kpi);
      toast.success(`KPI created · immutable ledger started`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            {mode === 'kpi' ? 'Add new KPI' : mode === 'lob' ? 'Add new LoB' : 'Add new Department / System'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-border">
          {(['manual', 'import', 'clone'] as AuthTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'text-[10px] font-semibold px-3 py-1.5 rounded-t border-b-2 -mb-px flex items-center gap-1',
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}>
              {t === 'manual' ? <Plus className="h-3 w-3" /> : t === 'import' ? <Upload className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {t === 'manual' ? 'Manual' : t === 'import' ? 'Import config (JSON)' : 'Clone from existing'}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3 overflow-y-auto scrollbar-thin">
          {tab === 'import' && (
            <div className="space-y-2">
              <div className="text-[10px] text-muted-foreground">
                Upload a <span className="font-mono">.json</span> file that matches the {mode === 'kpi' ? 'KPI' : mode === 'lob' ? 'LoB' : 'System'} schema. Once parsed and validated you'll see a "Ready to Import" badge below.
              </div>
              <input type="file" accept="application/json,.json" onChange={handleFile}
                className="text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border file:bg-primary/15 file:border-primary/40 file:text-primary file:cursor-pointer" />
              {importError && <div className="text-[10px] rag-red">✗ {importError}</div>}
              {importReady && (
                <div className="text-[10px] rag-green flex items-center gap-2 p-2 rounded border border-rag-green bg-rag-green">
                  <span className="font-semibold">✓ Ready to Import</span>
                  <span className="font-mono">{importReady.name}</span>
                </div>
              )}
            </div>
          )}

          {tab === 'clone' && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Clone from</label>
              <select value={cloneFrom} onChange={e => applyClone(e.target.value)}
                className="w-full h-8 text-xs bg-secondary border border-border rounded px-2">
                <option value="">— Select an existing {mode === 'kpi' ? 'KPI' : mode === 'lob' ? 'LoB' : 'System'} —</option>
                {cloneOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {cloneFrom && <div className="text-[10px] rag-green">✓ Loaded — edit fields below before saving</div>}
            </div>
          )}

          {/* Shared form fields */}
          {(mode === 'lob' || mode === 'system') && (
            <>
              <Field label={mode === 'lob' ? 'LoB name' : 'Department / System name'}>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                  placeholder={mode === 'lob' ? 'e.g. Mortgages' : 'e.g. Notifications Hub'} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Owner / Head">
                  <input value={(mode === 'lob' ? lobMeta.owner : sysMeta.owner) || ''}
                    onChange={e => mode === 'lob' ? setLobMeta({ ...lobMeta, owner: e.target.value }) : setSysMeta({ ...sysMeta, owner: e.target.value })}
                    className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
                </Field>
                <Field label="Email">
                  <input value={(mode === 'lob' ? lobMeta.ownerEmail : sysMeta.ownerEmail) || ''}
                    onChange={e => mode === 'lob' ? setLobMeta({ ...lobMeta, ownerEmail: e.target.value }) : setSysMeta({ ...sysMeta, ownerEmail: e.target.value })}
                    className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
                </Field>
                <Field label="Phone">
                  <input value={(mode === 'lob' ? lobMeta.ownerPhone : sysMeta.ownerPhone) || ''}
                    onChange={e => mode === 'lob' ? setLobMeta({ ...lobMeta, ownerPhone: e.target.value }) : setSysMeta({ ...sysMeta, ownerPhone: e.target.value })}
                    className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
                </Field>
                <Field label="Region">
                  <input value={(mode === 'lob' ? lobMeta.region : sysMeta.region) || ''}
                    onChange={e => mode === 'lob' ? setLobMeta({ ...lobMeta, region: e.target.value }) : setSysMeta({ ...sysMeta, region: e.target.value })}
                    placeholder="e.g. APAC + EMEA"
                    className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
                </Field>
                <Field label="Business criticality tier">
                  <select value={(mode === 'lob' ? lobMeta.tier : sysMeta.tier) || 'T3'}
                    onChange={e => mode === 'lob' ? setLobMeta({ ...lobMeta, tier: e.target.value as Tier }) : setSysMeta({ ...sysMeta, tier: e.target.value as Tier })}
                    className="w-full h-8 text-xs bg-secondary border border-border rounded px-2">
                    <option>T1</option><option>T2</option><option>T3</option><option>T4</option>
                  </select>
                </Field>
                <Field label="Default SLA template">
                  <select value={(mode === 'lob' ? lobMeta.defaultSla : sysMeta.defaultSla) || 'SLA_v1.3'}
                    onChange={e => mode === 'lob' ? setLobMeta({ ...lobMeta, defaultSla: e.target.value }) : setSysMeta({ ...sysMeta, defaultSla: e.target.value })}
                    className="w-full h-8 text-xs bg-secondary border border-border rounded px-2">
                    <option>SLA_v1.0</option><option>SLA_v1.1</option><option>SLA_v1.2</option><option>SLA_v1.3</option>
                  </select>
                </Field>
              </div>
              {mode === 'lob' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="HOD">
                      <input value={lobMeta.hod || ''} onChange={e => setLobMeta({ ...lobMeta, hod: e.target.value })} className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
                    </Field>
                    <Field label="Deputy">
                      <input value={lobMeta.deputy || ''} onChange={e => setLobMeta({ ...lobMeta, deputy: e.target.value })} className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
                    </Field>
                    <Field label="Parent LoB (optional)">
                      <select value={lobMeta.parentLob || ''} onChange={e => setLobMeta({ ...lobMeta, parentLob: e.target.value || null })} className="w-full h-8 text-xs bg-secondary border border-border rounded px-2">
                        <option value="">— None —</option>
                        {registries.lobs.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Cost Center">
                      <input value={lobMeta.costCenter || ''} onChange={e => setLobMeta({ ...lobMeta, costCenter: e.target.value })} placeholder="e.g. CC-B2C-01"
                        className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
                    </Field>
                  </div>
                  <Field label="Regulatory scope (multi-select)">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(['RBI', 'SEBI', 'IRDAI', 'Internal'] as RegulatoryScope[]).map(s => (
                        <label key={s} className="text-[10px] flex items-center gap-1">
                          <input type="checkbox"
                            checked={(lobMeta.regulatoryScope || []).includes(s)}
                            onChange={e => setLobMeta({ ...lobMeta, regulatoryScope: e.target.checked ? [...(lobMeta.regulatoryScope || []), s] : (lobMeta.regulatoryScope || []).filter(x => x !== s) })}
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </Field>
                </>
              )}
              <Field label={mode === 'lob' ? 'Linked systems' : 'Linked LoBs'}>
                <div className="flex items-center gap-2 flex-wrap">
                  {(mode === 'lob' ? registries.systems : registries.lobs).map(opt => {
                    const list = mode === 'lob' ? (lobMeta.linkedSystems || []) : (sysMeta.linkedLobs || []);
                    const checked = list.includes(opt);
                    return (
                      <label key={opt} className="text-[10px] flex items-center gap-1">
                        <input type="checkbox" checked={checked} onChange={e => {
                          const next = e.target.checked ? [...list, opt] : list.filter(x => x !== opt);
                          if (mode === 'lob') setLobMeta({ ...lobMeta, linkedSystems: next });
                          else setSysMeta({ ...sysMeta, linkedLobs: next });
                        }} />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </Field>
            </>
          )}

          {mode === 'kpi' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="LoB">
                  <select value={kpi.lob} onChange={e => setKpi({ ...kpi, lob: e.target.value })} className="w-full h-8 text-xs bg-secondary border border-border rounded px-2">
                    {registries.lobs.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Department / System">
                  <select value={kpi.system} onChange={e => setKpi({ ...kpi, system: e.target.value })} className="w-full h-8 text-xs bg-secondary border border-border rounded px-2">
                    {registries.systems.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Process">
                <input value={kpi.process} onChange={e => setKpi({ ...kpi, process: e.target.value })}
                  list="adm-proc-list" className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
                <datalist id="adm-proc-list">{registries.processes.map(p => <option key={p} value={p} />)}</datalist>
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Source">
                  <select value={kpi.source} onChange={e => setKpi({ ...kpi, source: e.target.value })} className="w-full h-8 text-xs bg-secondary border border-border rounded px-2">
                    {FILTER_OPTIONS.SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Target SLA">
                  <input type="number" step="0.01" value={kpi.targetSLA}
                    onChange={e => setKpi({ ...kpi, targetSLA: parseFloat(e.target.value) || 0 })}
                    className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
                </Field>
                <Field label="Severity">
                  <select value={kpi.severity} onChange={e => setKpi({ ...kpi, severity: e.target.value as Severity })} className="w-full h-8 text-xs bg-secondary border border-border rounded px-2">
                    {(['Critical', 'High', 'Medium', 'Low'] as Severity[]).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="SPOC owner">
                <input value={kpi.spoc} onChange={e => setKpi({ ...kpi, spoc: e.target.value })}
                  className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
              </Field>
              <Field label="Configuration file">
                <input value={kpi.configFile} onChange={e => setKpi({ ...kpi, configFile: e.target.value })}
                  placeholder="kpi-config.yaml"
                  className="w-full h-8 text-xs bg-secondary border border-border rounded px-2" />
              </Field>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="text-[11px] px-3 py-1 rounded border bg-secondary border-border hover:bg-accent">Cancel</button>
            <button
              onClick={submit}
              disabled={tab === 'import' && !importReady}
              className={cn(
                'text-[11px] px-3 py-1 rounded border font-semibold',
                tab === 'import' && !importReady ? 'opacity-50 cursor-not-allowed bg-secondary border-border'
                  : 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/25',
              )}>
              {tab === 'import' ? (importReady ? 'Import & Create' : 'Awaiting valid file…') : 'Create & Ledger'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

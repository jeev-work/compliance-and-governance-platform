import { useMemo, useState } from 'react';
import { useFilters, AddKpiInput } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import {
  ServerCog, AlertOctagon, Database, FileWarning, Wifi, WifiOff, Plus, Lock, Download,
  Building2, Layers, GitBranch, X,
} from 'lucide-react';
import { FILTER_OPTIONS, RAG_SHORT, Severity } from '@/lib/mockData';
import { exportMasterLedger, exportMicroLedger } from '@/lib/exportLedger';
import { toast } from 'sonner';

type AuthoringMode = null | 'kpi' | 'lob' | 'system';

export function AdminHealthView() {
  const {
    filteredData, allData, registries, addLob, addSystem, addKpi,
    masterLedger, lobLedgers, systemLedgers, configSnapshots,
  } = useFilters();

  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [kpiQuery, setKpiQuery] = useState('');
  const [authoring, setAuthoring] = useState<AuthoringMode>(null);

  // Connector health by source
  const connectors = useMemo(() => {
    return FILTER_OPTIONS.SOURCES.map(src => {
      const rows = filteredData.filter(r => r.source === src);
      const grey = rows.filter(r => r.ragState === 'GREY').length;
      const total = rows.length;
      const greyPct = total > 0 ? (grey / total) * 100 : 0;
      const health: 'GREEN' | 'AMBER' | 'RED' = greyPct > 5 ? 'RED' : greyPct > 1 ? 'AMBER' : 'GREEN';
      return { source: src, total, grey, greyPct, health };
    });
  }, [filteredData]);

  const greyRows = useMemo(() => filteredData.filter(r => r.ragState === 'GREY').slice(0, 20), [filteredData]);

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
        <span className="text-xs font-semibold">Admin Health Console</span>
        <span className="text-[10px] text-muted-foreground">Connectors · per-KPI SLA history · authoring · ledger export</span>
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
          <button onClick={() => { exportMasterLedger(masterLedger, configSnapshots); toast.success('Master ledger exported · snapshot-stamped'); }}
            className="text-[10px] font-semibold px-2 py-1 rounded border bg-rag-amber border-rag-amber rag-amber hover:opacity-80 flex items-center gap-1">
            <Download className="h-3 w-3" /> Export
          </button>
        </div>
      </div>

      {/* Registries strip */}
      <div className="grid grid-cols-3 gap-2">
        <RegistryCard
          icon={Building2} label="LoBs" items={registries.lobs}
          ledgers={lobLedgers}
          onExport={(name, entries) => { exportMicroLedger({ kind: 'lob', name }, entries, configSnapshots); toast.success(`LoB ledger exported · ${name}`); }}
        />
        <RegistryCard
          icon={Layers} label="Systems / Departments" items={registries.systems}
          ledgers={systemLedgers}
          onExport={(name, entries) => { exportMicroLedger({ kind: 'system', name }, entries, configSnapshots); toast.success(`System ledger exported · ${name}`); }}
        />
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" /> Config Snapshots ({configSnapshots.length})
          </h3>
          <div className="space-y-1 text-[10px]">
            {configSnapshots.map((s, i) => (
              <div key={s.id} className={cn('px-2 py-1 rounded border border-border/60 flex items-center gap-2',
                i === configSnapshots.length - 1 && 'bg-primary/5 border-primary/40')}>
                <span className="font-mono font-semibold text-foreground">{s.id}</span>
                <span className="text-muted-foreground">{s.capturedAt.slice(0, 10)}</span>
                <span className="text-muted-foreground truncate flex-1">{s.ragRules}</span>
                {i === configSnapshots.length - 1 && <span className="text-[9px] rag-green font-bold">ACTIVE</span>}
              </div>
            ))}
            <p className="text-[9px] text-muted-foreground italic mt-1">
              Exports replay each event against the snapshot active at incident time — never the current config.
            </p>
          </div>
        </div>
      </div>

      {/* Health row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Database className="h-3 w-3" /> Connector Health
          </h3>
          <div className="space-y-1.5">
            {connectors.map(c => (
              <div key={c.source} className={cn(
                'rounded border px-2 py-1.5 flex items-center gap-2',
                c.health === 'GREEN' && 'bg-rag-green border-rag-green',
                c.health === 'AMBER' && 'bg-rag-amber border-rag-amber',
                c.health === 'RED'   && 'bg-rag-red border-rag-red',
              )}>
                {c.health === 'GREEN' ? <Wifi className="h-3.5 w-3.5 rag-green" /> : <WifiOff className={cn('h-3.5 w-3.5', c.health === 'AMBER' ? 'rag-amber' : 'rag-red')} />}
                <div className="flex-1">
                  <div className="text-xs font-semibold">{c.source}</div>
                  <div className="text-[9px] text-muted-foreground">{c.total.toLocaleString()} KPIs · {c.grey} data-starved</div>
                </div>
                <div className={cn('text-[10px] font-mono font-bold',
                  c.health === 'GREEN' ? 'rag-green' : c.health === 'AMBER' ? 'rag-amber' : 'rag-red',
                )}>{c.health}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertOctagon className="h-3 w-3" /> Grey-State Pipeline Alerts
          </h3>
          <div className="space-y-1 max-h-[220px] overflow-y-auto scrollbar-thin">
            {greyRows.map(r => (
              <div key={r.id} className="text-[10px] px-2 py-1 rounded bg-rag-grey border border-rag-grey">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-foreground">{r.id}</span>
                  <span className="rag-grey font-semibold">{r.system}</span>
                  <span className="text-muted-foreground ml-auto">{r.source}</span>
                </div>
                <div className="text-muted-foreground">Connection dead · routed to Platform Admin</div>
              </div>
            ))}
            {greyRows.length === 0 && <div className="text-[10px] text-muted-foreground italic text-center py-4">All connectors healthy</div>}
          </div>
        </div>
      </div>

      {/* Per-KPI SLA Vault */}
      <div className="bg-card border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <FileWarning className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Per-KPI SLA Version History</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">WORM-locked · evaluation uses rule active at incident time</span>
        </div>
        <div className="grid grid-cols-5 gap-0">
          {/* picker */}
          <div className="col-span-2 border-r border-border max-h-[360px] flex flex-col">
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

          {/* history */}
          <div className="col-span-3 p-3">
            {selectedRow ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono font-semibold text-foreground text-xs">{selectedRow.id}</span>
                  <span className="text-[10px] text-muted-foreground">{selectedRow.system} · {selectedRow.process} · LoB {selectedRow.lob}</span>
                  <button
                    onClick={() => {
                      exportMicroLedger(
                        { kind: 'kpi', name: selectedRow.id },
                        selectedRow.ledgerEntries,
                        configSnapshots,
                        selectedRow,
                      );
                      toast.success(`Micro ledger exported · ${selectedRow.id}`);
                    }}
                    className="ml-auto text-[10px] font-semibold px-2 py-1 rounded border bg-primary/15 border-primary/40 text-primary hover:bg-primary/25 flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" /> Export
                  </button>
                </div>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left px-2 py-1 font-medium">Version</th>
                      <th className="text-left px-2 py-1 font-medium">Active From</th>
                      <th className="text-left px-2 py-1 font-medium">Changed By</th>
                      <th className="text-right px-2 py-1 font-medium">Threshold</th>
                      <th className="text-left px-2 py-1 font-medium">Change Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRow.slaHistory.map((v, i) => {
                      const active = i === selectedRow.slaHistory.length - 1;
                      return (
                        <tr key={v.version + i} className={cn('border-b border-border/40', active && 'bg-primary/5')}>
                          <td className="px-2 py-1 font-mono font-semibold text-foreground">
                            {v.version}{active && <span className="ml-2 text-[9px] rag-green">ACTIVE</span>}
                          </td>
                          <td className="px-2 py-1 font-mono text-muted-foreground">{v.activeFrom.slice(0, 10)}</td>
                          <td className="px-2 py-1">{v.changedBy}</td>
                          <td className="px-2 py-1 text-right font-mono">{v.threshold}</td>
                          <td className="px-2 py-1 text-muted-foreground">{v.changeNote}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="text-[10px] text-muted-foreground italic text-center py-8">Select a KPI to view its lifetime SLA version history.</div>
            )}
          </div>
        </div>
      </div>

      {/* Master ledger preview */}
      <div className="bg-card border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold">Master Ledger (latest {Math.min(masterLedger.length, 15)} entries)</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">{masterLedger.length} total · snapshot-stamped on export</span>
        </div>
        <div className="max-h-[200px] overflow-y-auto scrollbar-thin">
          {[...masterLedger].slice(-15).reverse().map((l, i) => (
            <div key={i} className="text-[10px] font-mono px-3 py-1 border-b border-border/30 flex items-center gap-2">
              <span className="text-foreground">{new Date(l.timestamp).toLocaleString()}</span>
              <span className="text-primary font-semibold">{l.action}</span>
              <span className="text-muted-foreground">· {l.actor}</span>
              <span className="ml-auto text-muted-foreground">{l.hash}</span>
            </div>
          ))}
        </div>
      </div>

      {authoring && (
        <AuthoringModal
          mode={authoring}
          onClose={() => setAuthoring(null)}
          registries={registries}
          onAddLob={(n) => addLob(n, 'Admin · You')}
          onAddSystem={(n) => addSystem(n, 'Admin · You')}
          onAddKpi={(input) => addKpi(input, 'Admin · You')}
        />
      )}
    </div>
  );
}

function RegistryCard({ icon: Icon, label, items, ledgers, onExport }: {
  icon: any; label: string; items: string[];
  ledgers: Record<string, any[]>;
  onExport: (name: string, entries: any[]) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-md p-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label} ({items.length})
      </h3>
      <div className="space-y-1 max-h-[140px] overflow-y-auto scrollbar-thin">
        {items.map(name => {
          const entries = ledgers[name] ?? [];
          return (
            <div key={name} className="flex items-center gap-2 text-[10px] px-2 py-1 rounded bg-secondary/40 border border-border/40">
              <span className="font-semibold text-foreground">{name}</span>
              <span className="text-muted-foreground ml-auto">{entries.length} ledger</span>
              <button onClick={() => onExport(name, entries)}
                className="text-primary hover:underline flex items-center gap-0.5">
                <Download className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuthoringModal({ mode, onClose, registries, onAddLob, onAddSystem, onAddKpi }: {
  mode: 'kpi' | 'lob' | 'system';
  onClose: () => void;
  registries: { lobs: string[]; systems: string[]; processes: string[] };
  onAddLob: (n: string) => void;
  onAddSystem: (n: string) => void;
  onAddKpi: (i: AddKpiInput) => void;
}) {
  const [name, setName] = useState('');
  const [kpi, setKpi] = useState<AddKpiInput>({
    lob: registries.lobs[0] ?? '', system: registries.systems[0] ?? '',
    process: registries.processes[0] ?? '', source: FILTER_OPTIONS.SOURCES[0],
    targetSLA: 0.05, severity: 'Medium' as Severity,
    spoc: 'New SPOC', configFile: 'kpi-config.yaml',
  });

  const submit = () => {
    if (mode === 'lob') { if (!name.trim()) return; onAddLob(name.trim()); toast.success(`LoB "${name}" created · ledger started`); }
    if (mode === 'system') { if (!name.trim()) return; onAddSystem(name.trim()); toast.success(`Department "${name}" created · ledger started`); }
    if (mode === 'kpi') {
      if (!kpi.lob || !kpi.system || !kpi.process) { toast.error('LoB, System and Process are required'); return; }
      onAddKpi(kpi); toast.success(`KPI created · independent immutable ledger started`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            {mode === 'kpi' ? 'Add new KPI' : mode === 'lob' ? 'Add new LoB' : 'Add new Department / System'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          {mode !== 'kpi' && (
            <Field label={mode === 'lob' ? 'LoB name' : 'Department / System name'}>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full h-8 text-xs bg-secondary border border-border rounded px-2"
                placeholder={mode === 'lob' ? 'e.g. Mortgages' : 'e.g. Notifications Hub'} />
            </Field>
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
                <datalist id="adm-proc-list">
                  {registries.processes.map(p => <option key={p} value={p} />)}
                </datalist>
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

          <div className="flex items-center gap-2 p-2 rounded border border-primary/30 bg-primary/5 text-[10px]">
            <Lock className="h-3 w-3 text-primary shrink-0" />
            <span className="text-muted-foreground">An independent immutable ledger will be created. The current config snapshot will be stamped onto the genesis entry.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="text-[11px] px-3 py-1 rounded border bg-secondary border-border hover:bg-accent">Cancel</button>
            <button onClick={submit} className="text-[11px] px-3 py-1 rounded border bg-primary/15 border-primary/40 text-primary font-semibold hover:bg-primary/25 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Create &amp; Ledger
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

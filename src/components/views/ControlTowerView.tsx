import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowDown, ArrowRight, BellRing, CheckCircle2, ChevronDown, ChevronUp, Clock3, Database, Gauge, Network, RotateCcw, ShieldCheck, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CONTROL_TOWER_AGENTS, randomPlatformHealth, SERVICE_PROCESSES, type ControlTowerAgent, type ControlTowerGroup } from '@/lib/controlTowerData';

const groups: { id: ControlTowerGroup; title: string; subtitle: string; count: string }[] = [
  { id: 'compliance', title: 'Compliance Agents', subtitle: 'Agent oversight & control execution', count: '20 AGENTS' },
  { id: 'platform', title: 'Platform Agents', subtitle: 'Core platform operations', count: '19 AGENTS' },
  { id: 'data-quality', title: 'Data Quality Agents', subtitle: 'Pipeline integrity & quality controls', count: '16 AGENTS' },
];

const bandClass = {
  GREEN: 'text-rag-green border-rag-green/40 bg-rag-green/10',
  AMBER: 'text-rag-amber border-rag-amber/40 bg-rag-amber/10',
  RED: 'text-rag-red border-rag-red/40 bg-rag-red/10',
} as const;

export function ControlTowerView({ onClose }: { onClose: () => void }) {
  const [platformHealth, setPlatformHealth] = useState(() => CONTROL_TOWER_AGENTS.filter(agent => agent.group === 'platform').map(agent => ({ id: agent.id, health: randomPlatformHealth() })));
  const [serviceHealth, setServiceHealth] = useState(() => SERVICE_PROCESSES.map(process => process.health));
  const [serviceSort, setServiceSort] = useState<'health' | 'name'>('health');
  const [recoveryExpanded, setRecoveryExpanded] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<ControlTowerAgent | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<ControlTowerGroup, boolean>>({ compliance: true, platform: true, 'data-quality': true });
  const [groupFilters, setGroupFilters] = useState<Record<ControlTowerGroup, { query: string; sourceType: string; band: string }>>({
    compliance: { query: '', sourceType: 'all', band: 'all' },
    platform: { query: '', sourceType: 'all', band: 'all' },
    'data-quality': { query: '', sourceType: 'all', band: 'all' },
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlatformHealth(CONTROL_TOWER_AGENTS.filter(agent => agent.group === 'platform').map(agent => ({ id: agent.id, health: randomPlatformHealth() })));
      setServiceHealth(SERVICE_PROCESSES.map((process, index) => index === 1 ? 96 : Math.max(91, Math.min(100, process.health + Math.round((Math.random() - 0.5) * 4)))));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const displayProcesses = useMemo(() => SERVICE_PROCESSES.map((process, index) => ({ ...process, health: serviceHealth[index] ?? process.health })).sort((a, b) => serviceSort === 'health' ? a.health - b.health : a.name.localeCompare(b.name)), [serviceHealth, serviceSort]);
  const platformAverage = Math.round(platformHealth.reduce((sum, item) => sum + item.health, 0) / Math.max(1, platformHealth.length));
  const redAgents = CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'RED');
  const amberAgents = CONTROL_TOWER_AGENTS.filter(agent => agent.band === 'AMBER');

  return (
    <section className="space-y-3" aria-label="Control Tower">
      <header className="flex flex-wrap items-start gap-3 border-b border-border pb-2">
        <div className="flex h-9 w-9 items-center justify-center border border-primary/30 bg-primary/10 text-primary"><Network className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-base font-semibold text-foreground">Control Tower — One Intuitive Dashboard</h1>
            <span className="border border-primary/30 px-1.5 py-0.5 font-mono text-[9px] text-primary">SCREEN 11</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Unified operational view · seeded trust scores and platform health are illustrative demo telemetry</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">Return to dashboard</Button>
      </header>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <SummaryMetric icon={Activity} label="Agent estate" value="55" detail="20 compliance · 19 platform · 16 data quality" />
        <SummaryMetric icon={Gauge} label="Platform process health" value={`${platformAverage}%`} detail="Randomized demo values · refresh every 30 seconds" />
        <SummaryMetric icon={AlertTriangle} label="RED trust alerts" value={String(redAgents.length)} detail="Agents requiring review" tone="rag-red" />
        <SummaryMetric icon={Workflow} label="Service processes" value="10" detail="Operations & service journeys" tone="rag-green" />
      </div>

      {(redAgents.length > 0 || amberAgents.length > 0) && (
        <section className="space-y-2" aria-label="Trust score alerts and watch zone">
          {redAgents.length > 0 && <div className="border border-rag-red/40 bg-rag-red/10 px-3 py-2" aria-label="Trust action alerts">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <AlertTriangle className="h-4 w-4 text-rag-red" />
            <h2 className="text-xs font-semibold text-rag-red">Stop and re-evaluate · {redAgents.length} agents</h2>
            <span className="text-[10px] text-muted-foreground">Review the seeded low-scoring agents</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {redAgents.map(agent => <Button key={agent.id} variant="outline" size="sm" onClick={() => setSelectedAgent(agent)} className="h-7 gap-2 border-rag-red/40 bg-card px-2 text-[10px]"><span className="font-mono text-rag-red">{agent.trustScore}</span>{agent.name}<ArrowRight className="h-3 w-3" /></Button>)}
          </div>
          </div>}
          {amberAgents.length > 0 && <div className="border border-rag-amber/40 bg-rag-amber/10 px-3 py-2" aria-label="Amber watch zone">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <AlertTriangle className="h-4 w-4 text-rag-amber" />
              <h2 className="text-xs font-semibold text-rag-amber">Amber watch zone · {amberAgents.length} agents</h2>
              <span className="text-[10px] text-muted-foreground">Monitor closely and review before trust declines</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {amberAgents.map(agent => <Button key={agent.id} variant="outline" size="sm" onClick={() => setSelectedAgent(agent)} className="h-7 gap-2 border-rag-amber/40 bg-card px-2 text-[10px]"><span className="font-mono text-rag-amber">{agent.trustScore}</span>{agent.name}<ArrowRight className="h-3 w-3" /></Button>)}
            </div>
          </div>}
        </section>
      )}

      <section aria-label="Agent trust registers" className="space-y-2">
        <div className="flex items-center gap-2 border-b border-border pb-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-semibold">Monitoring agents · trust scores</h2>
          <span className="ml-auto text-[9px] text-muted-foreground">Weighted illustrative score · GREEN ≥80 · AMBER 60–79 · RED &lt;60</span>
        </div>
        <div className="grid grid-cols-1 gap-2 2xl:grid-cols-3">
          {groups.map(group => {
            const filters = groupFilters[group.id];
            const agents = CONTROL_TOWER_AGENTS.filter(agent => {
              if (agent.group !== group.id) return false;
              if (filters.query && !agent.name.toLowerCase().includes(filters.query.trim().toLowerCase())) return false;
              if (filters.sourceType !== 'all' && agent.sourceType !== filters.sourceType) return false;
              if (filters.band !== 'all' && agent.band !== filters.band) return false;
              return true;
            });
            const isExpanded = expandedGroups[group.id];
            return (
              <section key={group.id} className="min-w-0 border border-border bg-card" aria-label={group.title}>
                <header className="border-b border-border bg-secondary/50">
                  <button type="button" className="flex w-full items-center gap-2 px-2.5 py-2 text-left" aria-expanded={isExpanded} aria-controls={`agent-register-${group.id}`} onClick={() => setExpandedGroups(current => ({ ...current, [group.id]: !current[group.id] }))}>
                    <div className="min-w-0 flex-1"><h3 className="text-[11px] font-semibold text-foreground">{group.title}</h3><p className="text-[9px] text-muted-foreground">{group.subtitle}</p></div>
                    <span className="font-mono text-[9px] text-muted-foreground">{agents.length}/{group.count}</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                </header>
                {isExpanded && <div id={`agent-register-${group.id}`}>
                  <div className="grid grid-cols-1 gap-1.5 border-b border-border px-2 py-2 sm:grid-cols-[minmax(0,1fr)_88px_88px]">
                    <Input aria-label={`Search ${group.title}`} placeholder="Filter agents…" value={filters.query} onChange={event => setGroupFilters(current => ({ ...current, [group.id]: { ...current[group.id], query: event.target.value } }))} className="h-7 min-w-0 text-[9px]" />
                    <Select value={filters.sourceType} onValueChange={sourceType => setGroupFilters(current => ({ ...current, [group.id]: { ...current[group.id], sourceType } }))}>
                      <SelectTrigger aria-label={`Filter ${group.title} by type`} className="h-7 text-[9px]"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all" className="text-xs">All types</SelectItem><SelectItem value="Agent" className="text-xs">Agent</SelectItem><SelectItem value="Platform" className="text-xs">Platform</SelectItem></SelectContent>
                    </Select>
                    <Select value={filters.band} onValueChange={band => setGroupFilters(current => ({ ...current, [group.id]: { ...current[group.id], band } }))}>
                      <SelectTrigger aria-label={`Filter ${group.title} by trust`} className="h-7 text-[9px]"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all" className="text-xs">All trust</SelectItem><SelectItem value="RED" className="text-xs">RED</SelectItem><SelectItem value="AMBER" className="text-xs">AMBER</SelectItem><SelectItem value="GREEN" className="text-xs">GREEN</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="max-h-[340px] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-[9px]">
                      <thead className="sticky top-0 bg-secondary/90 text-muted-foreground"><tr className="text-left"><th className="px-2 py-1.5 font-medium">Agent</th><th className="px-1 py-1.5 font-medium">Type</th><th className="px-2 py-1.5 text-right font-medium">Trust</th></tr></thead>
                      <tbody>{agents.map(agent => {
                        const health = platformHealth.find(item => item.id === agent.id)?.health;
                        return <tr key={agent.id} className="border-t border-border/60 hover:bg-accent/40">
                          <td className="px-2 py-1.5"><button onClick={() => setSelectedAgent(agent)} className="text-left font-medium text-foreground hover:text-primary">{agent.name}</button></td>
                          <td className="px-1 py-1.5 text-muted-foreground">{agent.sourceType}</td>
                          <td className="px-2 py-1.5 text-right"><span className={cn('inline-flex min-w-10 items-center justify-center gap-1 border px-1.5 py-0.5 font-mono font-semibold', bandClass[agent.band])}>{agent.trustScore}<span className="text-[7px]">{agent.band}</span></span>{health != null && <div className="mt-0.5 text-[8px] text-muted-foreground">Health {health}%</div>}</td>
                        </tr>;
                      })}</tbody>
                    </table>
                    {agents.length === 0 && <p className="px-2 py-4 text-center text-[9px] text-muted-foreground">No agents match these filters.</p>}
                  </div>
                  {group.id === 'platform' && <div className="flex items-center gap-1.5 border-t border-border px-2.5 py-1.5 text-[8px] text-muted-foreground"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rag-green" /> Health values refresh every 30 seconds · illustrative simulation</div>}
                </div>}
              </section>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border pt-2" aria-label="Top ten operations and service processes">
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <Workflow className="h-4 w-4 text-primary" /><h2 className="text-xs font-semibold">Critical Processes Health</h2>
          <span className="text-[9px] text-muted-foreground">Top 10 · Operations & Service</span>
          <Button variant="outline" size="sm" className="ml-auto h-7 gap-1.5 text-[9px]" onClick={() => setServiceSort(current => current === 'health' ? 'name' : 'health')}><ArrowDown className="h-3 w-3" />Sort: {serviceSort === 'health' ? 'Lowest health' : 'Process name'}</Button>
        </div>
        <div className="grid grid-cols-1 gap-x-5 gap-y-1.5 md:grid-cols-2 xl:grid-cols-5">
          {displayProcesses.map((process, index) => <div key={process.name} className={cn('grid grid-cols-[minmax(0,1fr)_42px] items-center gap-x-2 border-b border-border/60 py-1.5', process.name === 'Statement of account' && 'border-l-2 border-rag-amber pl-2')}>
            <div className="flex min-w-0 items-center gap-1.5"><span className="font-mono text-[8px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><span className="truncate text-[9px] text-foreground" title={process.name}>{process.name}</span></div>
            <span className={cn('text-right font-mono text-[9px]', process.health < 80 ? 'rag-amber' : 'rag-green')}>{process.health}%</span>
            <div className="col-span-2 mt-1 h-1 overflow-hidden bg-secondary"><div className={cn('h-full transition-[width] duration-500', process.health < 80 ? 'bg-rag-amber' : 'bg-rag-green')} style={{ width: `${process.health}%` }} /></div>
          </div>)}
        </div>
      </section>

      <section className="border-t border-border pt-2" aria-label="Fallback alerts and recovery">
        <button className="flex w-full items-center gap-2 py-1 text-left" onClick={() => setRecoveryExpanded(open => !open)} aria-expanded={recoveryExpanded}>
          <BellRing className="h-4 w-4 text-rag-amber" /><span className="text-xs font-semibold">Alerts on fallback invoked</span>
          <span className="border border-rag-amber/40 bg-rag-amber/10 px-1.5 py-0.5 font-mono text-[8px] text-rag-amber">1 ACTIVE SCENARIO</span>
          <span className="ml-auto text-muted-foreground">{recoveryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
        </button>
        {recoveryExpanded && <div className="mt-1 grid grid-cols-1 gap-2 lg:grid-cols-[1.1fr_1.2fr_1fr]">
          <div className="border border-rag-amber/40 bg-rag-amber/5 p-3">
            <div className="flex items-center gap-2 text-[9px] font-semibold text-rag-amber"><AlertTriangle className="h-3.5 w-3.5" />SERVICE RECOVERY · DEMO CASE</div>
            <h3 className="mt-1.5 text-sm font-semibold text-foreground">Statement of account</h3>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Customer request is delayed after a source processing failure. Contingency workflow invoked; service recovered from reconstructed data.</p>
              <div className="mt-2 flex flex-wrap gap-1.5"><span className="border border-border px-1.5 py-1 font-mono text-[8px] text-foreground">CASE · SOA-2026-0418</span><span className="border border-border px-1.5 py-1 font-mono text-[8px] text-foreground">IMPACT · CUSTOMER SERVICE</span></div>
              <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-[8px] text-muted-foreground"><Database className="h-3 w-3 text-primary" />Fallback data path: verified ledger + transaction deltas</div>
          </div>
          <div className="border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-[9px] font-semibold text-muted-foreground"><RotateCcw className="h-3.5 w-3.5 text-primary" />PROCESS CONTINGENCY DATA PROCESSING & RECONSTRUCTION</div>
            <div className="mt-2 space-y-2">
              <RecoveryStep number="01" title="Failure detected" detail="Primary statement processing stopped; source integrity check failed." state="done" />
              <RecoveryStep number="02" title="Contingency path invoked" detail="Last verified source and transaction deltas selected for reconstruction." state="done" />
              <RecoveryStep number="03" title="Data reconstructed & validated" detail="Reconciliation checks passed against the source ledger." state="done" />
              <RecoveryStep number="04" title="Service recovered" detail="Statement of account request fulfilled through the contingency path." state="recovered" />
            </div>
          </div>
          <div className="border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-[9px] font-semibold text-muted-foreground"><BellRing className="h-3.5 w-3.5 text-rag-red" />ALERTS TRIGGERED</div>
            <div className="mt-2 space-y-2">
              <AlertItem time="14:32:08" title="Operations control" detail="Contingency processing started" tone="rag-amber" />
              <AlertItem time="14:32:14" title="Service leadership" detail="Senior team notified: statement service disruption" tone="rag-red" />
              <AlertItem time="14:34:51" title="Recovery verification" detail="Reconstruction reconciled; service restored" tone="rag-green" />
            </div>
            <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2 text-[9px] font-medium text-rag-green"><CheckCircle2 className="h-3.5 w-3.5" />Recovered · awaiting routine monitoring</div>
          </div>
        </div>}
      </section>

      {selectedAgent && <div role="dialog" aria-modal="true" aria-label={`${selectedAgent.name} trust details`} className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4" onClick={() => setSelectedAgent(null)}>
        <section className="w-full max-w-sm border border-border bg-card p-4 shadow-xl" onClick={event => event.stopPropagation()}>
          <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[9px] uppercase text-muted-foreground">{groups.find(group => group.id === selectedAgent.group)?.title}</p><h2 className="mt-1 text-sm font-semibold text-foreground">{selectedAgent.name}</h2></div><Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setSelectedAgent(null)}>Close</Button></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><SummaryMetric icon={ShieldCheck} label="Weighted trust score" value={`${selectedAgent.trustScore} · ${selectedAgent.band}`} detail="Illustrative seeded demo score" tone={selectedAgent.band === 'RED' ? 'rag-red' : selectedAgent.band === 'AMBER' ? 'rag-amber' : 'rag-green'} />{selectedAgent.group === 'platform' && <SummaryMetric icon={Gauge} label="Current process health" value={`${platformHealth.find(item => item.id === selectedAgent.id)?.health ?? '—'}%`} detail="Refreshes every 30 seconds" />}</div>
          <p className="mt-3 border-l-2 border-primary pl-2 text-[10px] leading-4 text-muted-foreground">Trust scores and platform health in this dashboard are illustrative demo values, not live execution evidence.</p>
        </section>
      </div>}
    </section>
  );
}

function SummaryMetric({ icon: Icon, label, value, detail, tone = 'text-primary' }: { icon: typeof Activity; label: string; value: string; detail: string; tone?: string }) {
  return <div className="min-w-0 border border-border bg-card px-2.5 py-2"><div className="flex items-center gap-1.5 text-[9px] text-muted-foreground"><Icon className={cn('h-3.5 w-3.5', tone)} />{label}</div><div className={cn('mt-1 font-mono text-base font-semibold leading-5', tone === 'text-primary' ? 'text-foreground' : tone)}>{value}</div><div className="truncate text-[8px] text-muted-foreground">{detail}</div></div>;
}

function RecoveryStep({ number, title, detail, state }: { number: string; title: string; detail: string; state: 'done' | 'recovered' }) {
  return <div className="flex items-start gap-2"><div className={cn('flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[8px]', state === 'recovered' ? 'border-rag-green/40 bg-rag-green/10 text-rag-green' : 'border-primary/30 bg-primary/10 text-primary')}>{state === 'recovered' ? <CheckCircle2 className="h-3 w-3" /> : number}</div><div className="min-w-0 flex-1"><div className="text-[10px] font-medium text-foreground">{title}</div><p className="text-[8px] leading-3 text-muted-foreground">{detail}</p></div>{state === 'done' && <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />}</div>;
}

function AlertItem({ time, title, detail, tone }: { time: string; title: string; detail: string; tone: string }) {
  return <div className="flex items-start gap-2 border-b border-border/60 pb-1.5 last:border-0"><Clock3 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-medium text-foreground">{title}</span><span className="font-mono text-[8px] text-muted-foreground">{time}</span></div><p className={cn('text-[8px]', tone)}>{detail}</p></div></div>;
}
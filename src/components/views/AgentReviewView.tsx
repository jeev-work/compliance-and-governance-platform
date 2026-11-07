import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, ClipboardList, FileCheck2, Info, Search, ShieldCheck, X } from 'lucide-react';
import { useFilters } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { buildAgentReviewRows, evaluateAgentTrust, summarizeAgentReview, TRUST_EVALUATION_DIMENSIONS, type TrustDimensionKey } from '@/lib/agentReviewData';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type ReviewMode = 'monitoring' | 'compliance';

const formatNumber = (value: number) => value.toLocaleString();
const formatPercent = (value: number, total: number) => total ? `${((value / total) * 100).toFixed(1)}%` : '—';
const showTime = (value: number | null) => value == null ? '—' : value < 60 ? `${Math.round(value)}m` : `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
const bandTone = {
  GREEN: 'text-rag-green border-rag-green bg-rag-green',
  AMBER: 'text-rag-amber border-rag-amber bg-rag-amber',
  RED: 'text-rag-red border-rag-red bg-rag-red',
  UNSCORED: 'text-muted-foreground border-border bg-secondary',
} as const;

const dimensionNotes: Record<TrustDimensionKey, string> = {
  health: 'Agent uptime, latency, and runtime errors are not available in this demo.',
  performanceQuality: 'Resolved incident records ÷ related incident records. A platform-outcome proxy, not an agent quality measurement.',
  behaviorDrift: 'Agent decisions, tool-use patterns, and drift telemetry are not available in this demo.',
  accessToolControl: 'Agent tool-call and privilege audit records are not available in this demo.',
  complianceRisk: 'Average platform-state proxy: GREEN 100, AMBER 70, BLUE 85, GREY 25, RED or UNCONFIGURED 0.',
  governanceAuditability: 'KPI records with ledger evidence ÷ records in the agent’s data scope.',
};

function Metric({ icon: Icon, label, value, detail, tone = 'text-primary' }: { icon: typeof Activity; label: string; value: string; detail: string; tone?: string }) {
  return (
    <div className="border border-border bg-card px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Icon className={cn('h-3.5 w-3.5', tone)} />{label}</div>
      <div className="mt-1 text-lg leading-6 font-semibold font-mono text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground truncate">{detail}</div>
    </div>
  );
}

export function AgentReviewView({ mode, onClose }: { mode: ReviewMode; onClose: () => void }) {
  const { filteredData, openDrilldown } = useFilters();
  const [query, setQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const monitoring = mode === 'monitoring';

  const agentRows = useMemo(() => buildAgentReviewRows(filteredData), [filteredData]);
  const summary = useMemo(() => summarizeAgentReview(agentRows), [agentRows]);
  const evaluations = useMemo(() => new Map(agentRows.map(row => [row.agent.id, evaluateAgentTrust(row)])), [agentRows]);
  const searchedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? agentRows.filter(({ agent }) => `${agent.id} ${agent.name} ${agent.description}`.toLowerCase().includes(q)) : agentRows;
  }, [agentRows, query]);
  const selected = selectedAgentId == null ? null : agentRows.find(row => row.agent.id === selectedAgentId) ?? null;

  const portfolioRows = agentRows.find(row => row.agent.id === 1)?.records ?? [];
  const incidentRows = portfolioRows.filter(row => row.status === 'BREACHED' || row.chaseTimeline.length > 0 || row.ledgerEntries.some(entry => /Ticket Generated|Ticket Closed/i.test(entry.action)));
  const notifiedCount = incidentRows.filter(row => row.chaseTimeline.some(event => event.step === 'Notified')).length;
  const acknowledgedCount = incidentRows.filter(row => row.chaseTimeline.some(event => event.step === 'Acknowledged')).length;
  const traceableIncidentCount = incidentRows.filter(row => row.ledgerEntries.length > 0 || row.chaseTimeline.length > 0).length;
  const unconfiguredCount = portfolioRows.filter(row => row.ragState === 'UNCONFIGURED').length;
  const configuredCount = portfolioRows.filter(row => row.ragState !== 'UNCONFIGURED' && row.slaHistory.length > 0 && row.targetSLA > 0).length;
  const ledgerCoveredCount = portfolioRows.filter(row => row.ledgerEntries.length > 0).length;
  const resolvedRows = incidentRows.filter(row => row.resolutionStatus === 'Resolved' || row.resolutionStatus === 'Clean');
  const avgResolve = resolvedRows.filter(row => row.timeToResolveMin != null).length
    ? resolvedRows.reduce((sum, row) => sum + (row.timeToResolveMin ?? 0), 0) / resolvedRows.filter(row => row.timeToResolveMin != null).length
    : null;

  return (
    <section className="space-y-3" aria-label={monitoring ? 'Multi-agent monitoring performance' : 'Multi-agent compliance review'}>
      <header className="border-b border-border pb-2 flex items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {monitoring ? <Activity className="h-4 w-4 text-primary" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
            <h1>{monitoring ? 'Multi-Agent Monitoring Performance' : 'Multi-Agent Compliance Review'}</h1>
            <span className="text-[10px] font-mono text-muted-foreground">SCREEN {monitoring ? '09' : '10'}</span>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground max-w-4xl">
            {monitoring
              ? 'Operational review derived from the filtered KPI and incident records.'
              : 'Oversight review of configuration, incident traceability, and ledger evidence in the filtered records.'}
            {' '}Agent coverage is a platform-data proxy; this demo has no live agent run, latency, token, or policy-verdict telemetry.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto h-8 w-8 shrink-0" aria-label="Close agent review">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {monitoring ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-2">
          <Metric icon={Activity} label="KPI records in scope" value={formatNumber(portfolioRows.length)} detail="Filtered platform records" />
          <Metric icon={AlertTriangle} label="Active exceptions" value={formatNumber(summary.activeExceptions)} detail="Unique open / investigating tickets" tone="rag-red" />
          <Metric icon={CheckCircle2} label="Resolved incidents" value={formatNumber(resolvedRows.length)} detail="Historical incident records" tone="rag-green" />
          <Metric icon={ClipboardList} label="Notification coverage" value={formatPercent(notifiedCount, incidentRows.length)} detail={`${formatNumber(notifiedCount)} of ${formatNumber(incidentRows.length)} incident records`} tone="rag-amber" />
          <Metric icon={CheckCircle2} label="Acknowledgement coverage" value={formatPercent(acknowledgedCount, incidentRows.length)} detail={`${formatNumber(acknowledgedCount)} of ${formatNumber(incidentRows.length)} incident records`} tone="rag-green" />
          <Metric icon={Activity} label="Avg. resolution time" value={showTime(avgResolve)} detail={`${formatNumber(resolvedRows.filter(row => row.timeToResolveMin != null).length)} resolved records with timing`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-2">
          <Metric icon={Activity} label="KPI records in scope" value={formatNumber(portfolioRows.length)} detail="Filtered platform records" />
          <Metric icon={FileCheck2} label="Configuration coverage" value={formatPercent(configuredCount, portfolioRows.length)} detail={`${formatNumber(configuredCount)} with active SLA history`} />
          <Metric icon={ShieldCheck} label="Ledger coverage" value={formatPercent(ledgerCoveredCount, portfolioRows.length)} detail={`${formatNumber(ledgerCoveredCount)} with ledger entries`} tone="rag-green" />
          <Metric icon={ClipboardList} label="Traceable incidents" value={formatNumber(traceableIncidentCount)} detail={`${formatPercent(traceableIncidentCount, incidentRows.length)} of incident records`} />
          <Metric icon={AlertTriangle} label="Unconfigured controls" value={formatNumber(unconfiguredCount)} detail="No configuration attached" tone="rag-amber" />
          <Metric icon={ClipboardList} label="Ledger events" value={formatNumber(summary.ledgerEvents)} detail="Across KPI records in scope" />
          <Metric icon={AlertTriangle} label="Active exceptions" value={formatNumber(summary.activeExceptions)} detail={`${formatNumber(summary.resolvedIncidents)} resolved incident records`} tone="rag-red" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-border py-1.5 text-[10px] text-muted-foreground">
        <span><b className="text-foreground">{summary.observedAgents}</b> of {summary.modeledAgents} roles have a KPI/ledger proxy</span>
        <span><b className="text-foreground">{summary.notInstrumentedAgents}</b> not measurable from current records</span>
        <span><b className="text-foreground">{formatNumber(configuredCount)}</b> configured of {formatNumber(portfolioRows.length)} KPI records</span>
        <span className="ml-auto">Metrics follow the global filters above.</span>
      </div>

      <div className="grid grid-cols-1 gap-3 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 px-1 pb-1.5">
            <h2 className="text-xs font-semibold text-foreground">Agent register</h2>
            <span className="text-[10px] text-muted-foreground">{searchedRows.length} of 18</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Trust score weights and calculation">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-80 p-3 text-[10px]">
                <div className="font-semibold text-foreground">Weighted trust score</div>
                <div className="mt-1 space-y-1">
                  {TRUST_EVALUATION_DIMENSIONS.map(dimension => (
                    <div key={dimension.key} className="flex justify-between gap-6">
                      <span>{dimension.label}</span><span className="font-mono text-foreground">{dimension.weight}%</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 border-t border-border pt-2 leading-relaxed">Score is the weighted average of available evidence only. Coverage shows the share of total weight backed by data. GREEN ≥80, AMBER 60–79, RED &lt;60. Proxy scores are not live agent telemetry.</p>
              </PopoverContent>
            </Popover>
            <div className="relative ml-auto w-56 max-w-full">
              <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search agents" className="h-7 w-full border border-border bg-secondary pl-7 pr-2 text-[10px] text-foreground outline-none focus:border-primary" />
            </div>
          </div>
          <div className="border border-border bg-card overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1180px] text-[10px]">
              <thead className="bg-secondary/70 text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="sticky left-0 z-10 min-w-44 bg-secondary px-2 py-2 font-medium">Agent</th>
                  {TRUST_EVALUATION_DIMENSIONS.map(dimension => (
                    <th key={dimension.key} className="min-w-32 px-2 py-2 font-medium leading-tight">{dimension.label}</th>
                  ))}
                  <th className="min-w-28 px-2 py-2 font-medium">Trust score</th>
                </tr>
              </thead>
              <tbody>
                {searchedRows.map(row => {
                  const active = selectedAgentId === row.agent.id;
                  const evaluation = evaluations.get(row.agent.id);
                  return (
                    <tr key={row.agent.id} className={cn('border-b border-border/60 last:border-0', active && 'bg-accent/50')}>
                      <td className={cn('sticky left-0 z-[1] bg-card px-2 py-2 align-middle', active && 'bg-accent')}>
                        <button className="text-left font-semibold text-primary hover:underline" onClick={() => setSelectedAgentId(active ? null : row.agent.id)}>
                          <span className="font-mono text-muted-foreground mr-1.5">{String(row.agent.id).padStart(2, '0')}</span><span className="leading-tight">{row.agent.name}</span>
                        </button>
                      </td>
                      {TRUST_EVALUATION_DIMENSIONS.map(dimension => (
                        <td key={dimension.key} className="px-2 py-2 align-middle">
                          <EvaluationCell value={evaluation?.scores[dimension.key] ?? null} note={dimensionNotes[dimension.key]} />
                        </td>
                      ))}
                      <td className="px-2 py-2 align-middle">
                        <TrustScoreCell score={evaluation?.trustScore ?? null} coverage={evaluation?.evidenceCoverage ?? 0} band={evaluation?.band ?? 'UNSCORED'} signal={row.agent.signal} />
                      </td>
                    </tr>
                  );
                })}
                {searchedRows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No agents match this search.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="border border-border bg-card min-w-0">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            {monitoring ? <Activity className="h-3.5 w-3.5 text-primary" /> : <FileCheck2 className="h-3.5 w-3.5 text-primary" />}
            <h2 className="text-xs font-semibold">{selected ? `Agent ${String(selected.agent.id).padStart(2, '0')} · ${selected.agent.name}` : monitoring ? 'Operational review' : 'Evidence review'}</h2>
          </div>
          {selected ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                <div>
                  <div className="text-[9px] text-muted-foreground">Evidence-backed trust score</div>
                  <div className="mt-0.5"><TrustScoreCell score={evaluations.get(selected.agent.id)?.trustScore ?? null} coverage={evaluations.get(selected.agent.id)?.evidenceCoverage ?? 0} band={evaluations.get(selected.agent.id)?.band ?? 'UNSCORED'} signal={selected.agent.signal} /></div>
                </div>
                <span className="text-[9px] text-muted-foreground">{selected.agent.signal === 'proxy' ? 'Platform-data proxy' : 'Not instrumented'}</span>
              </div>
              <p className="text-[10px] leading-4 text-muted-foreground">{selected.agent.description}</p>
              <p className="text-[10px] leading-4 text-muted-foreground">{selected.agent.signalNote}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TRUST_EVALUATION_DIMENSIONS.map(dimension => (
                  <EvaluationCell key={dimension.key} value={evaluations.get(selected.agent.id)?.scores[dimension.key] ?? null} note={dimensionNotes[dimension.key]} label={dimension.label} />
                ))}
              </div>
              {selected.agent.signal === 'proxy' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Detail label="KPI records in scope" value={formatNumber(selected.records.length)} />
                    <Detail label="Active exceptions" value={formatNumber(selected.activeExceptions)} />
                    {monitoring ? <>
                      <Detail label="Resolved incidents" value={formatNumber(selected.resolvedIncidents)} />
                      <Detail label="Notification records" value={formatNumber(selected.notifiedRecords)} />
                    </> : <>
                      <Detail label="With ledger evidence" value={`${formatNumber(selected.recordsWithLedger)} · ${formatPercent(selected.recordsWithLedger, selected.records.length)}`} />
                      <Detail label="Ledger events" value={formatNumber(selected.ledgerEvents)} />
                      <Detail label="Configured records" value={`${formatNumber(selected.configuredRecords)} · ${formatPercent(selected.configuredRecords, selected.records.length)}`} />
                    </>}
                  </div>
                  <h3 className="pt-1 text-[10px] font-semibold text-foreground">Related KPI records</h3>
                  <div className="max-h-72 overflow-y-auto divide-y divide-border scrollbar-thin">
                    {selected.records.slice(0, 12).map(row => (
                      <button key={row.id} onClick={() => openDrilldown('breach', row.id, row)} className="flex w-full items-center gap-2 py-1.5 text-left hover:bg-accent/50">
                        <span className="font-mono text-primary">{row.id}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.system} · {row.process}</span>
                        <span className="text-muted-foreground">{row.resolutionStatus}</span>
                        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                    {selected.records.length === 0 && <div className="py-4 text-center text-[10px] text-muted-foreground">No records in the current filter scope.</div>}
                    {selected.records.length > 12 && <div className="py-1.5 text-center text-[9px] text-muted-foreground">Showing 12 of {formatNumber(selected.records.length)} records</div>}
                  </div>
                </>
              ) : <div className="border border-border border-dashed px-3 py-4 text-center text-[10px] text-muted-foreground">This agent is listed in the supplied operating model, but its activity cannot be measured from the records currently available.</div>}
            </div>
          ) : (
            <div className="p-3 space-y-3">
              <p className="text-[10px] leading-4 text-muted-foreground">{monitoring
                ? 'Review control coverage, exceptions, response flow, and resolution performance across the selected scope.'
                : 'Review configuration and event traceability without treating KPI records as proof of a live agent execution.'}</p>
              <div className="border-l-2 border-primary/50 pl-2 text-[10px] leading-4 text-muted-foreground">
                <span className="font-semibold text-foreground">Interpretation boundary</span><br />
                Proxy counts describe related KPI/case data only. Live agent uptime, latency, cost, model decisions, and policy compliance are not measured here.
              </div>
              <div className="space-y-1">
                <ReviewLine label="Configured KPI records" value={`${formatNumber(configuredCount)} / ${formatNumber(portfolioRows.length)}`} />
                <ReviewLine label="Incident records with notification" value={`${formatNumber(notifiedCount)} / ${formatNumber(incidentRows.length)}`} />
                <ReviewLine label="Incident records acknowledged" value={`${formatNumber(acknowledgedCount)} / ${formatNumber(incidentRows.length)}`} />
                <ReviewLine label="Unconfigured controls" value={formatNumber(unconfiguredCount)} />
                <ReviewLine label="Incident records resolved" value={`${formatNumber(resolvedRows.length)} / ${formatNumber(incidentRows.length)}`} />
                <ReviewLine label="Incident records with ledger" value={`${formatNumber(incidentRows.filter(row => row.ledgerEntries.length > 0).length)} / ${formatNumber(incidentRows.length)}`} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function EvaluationCell({ value, note, label }: { value: number | null; note: string; label?: string }) {
  const tone = value == null ? 'bg-secondary' : value >= 80 ? 'bg-rag-green' : value >= 60 ? 'bg-rag-amber' : 'bg-rag-red';
  return (
    <div className="min-w-0" title={`${label ? `${label}: ` : ''}${value == null ? 'Not instrumented. ' : `${Math.round(value)}% evidence proxy. `}${note}`}>
      {label && <div className="mb-1 text-[9px] leading-tight text-muted-foreground">{label}</div>}
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 min-w-8 flex-1 overflow-hidden bg-secondary">
          {value != null && <div className={cn('h-full', tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />}
        </div>
        <span className={cn('w-8 shrink-0 text-right font-mono text-[9px]', value == null ? 'text-muted-foreground' : value >= 80 ? 'rag-green' : value >= 60 ? 'rag-amber' : 'rag-red')}>
          {value == null ? '—' : `${Math.round(value)}%`}
        </span>
      </div>
      {value == null && <div className="mt-0.5 text-[8px] text-muted-foreground">No telemetry</div>}
    </div>
  );
}

function TrustScoreCell({ score, coverage, band, signal }: { score: number | null; coverage: number; band: 'GREEN' | 'AMBER' | 'RED' | 'UNSCORED'; signal: 'proxy' | 'not-instrumented' }) {
  return (
    <div className="min-w-24">
      {score == null ? (
        <span className="text-[9px] text-muted-foreground">{signal === 'not-instrumented' ? 'Not scored' : 'No evidence'}</span>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className={cn('inline-flex min-w-7 justify-center border px-1 py-0.5 font-mono text-[10px] font-semibold', bandTone[band])}>{score}</span>
            <span className={cn('text-[8px] font-semibold', band === 'GREEN' ? 'rag-green' : band === 'AMBER' ? 'rag-amber' : 'rag-red')}>{band}</span>
          </div>
          <div className="mt-1 text-[8px] text-muted-foreground">{coverage}% weight backed</div>
        </>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="border border-border/70 px-2 py-1.5 min-w-0"><div className="text-[9px] text-muted-foreground">{label}</div><div className="truncate text-xs font-mono text-foreground">{value}</div></div>;
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2 text-[10px]"><span className="text-muted-foreground">{label}</span><span className="font-mono text-foreground">{value}</span></div>;
}
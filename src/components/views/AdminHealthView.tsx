import { useMemo } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { ServerCog, AlertOctagon, Database, FileWarning, Wifi, WifiOff } from 'lucide-react';
import { FILTER_OPTIONS } from '@/lib/mockData';

export function AdminHealthView() {
  const { filteredData } = useFilters();

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

  // SLA vault versions (synthesized from existing rows)
  const vault = useMemo(() => {
    const versions = ['SLA_v1.0', 'SLA_v1.1', 'SLA_v1.2', 'SLA_v1.3'];
    return versions.map((v, i) => ({
      version: v,
      activeFrom: `2026-0${i + 1}-01`,
      changedBy: ['M. Patel', 'L. Zhang', 'D. Okafor', 'S. Kumar'][i],
      kpis: filteredData.filter(r => r.slaVersion === v).length,
      changeNote: ['Initial baseline', 'Tightened API latency 500→400ms', 'Added KYC failure debounce 3m', 'Festival peak contextual profile'][i],
    }));
  }, [filteredData]);

  const greyRows = useMemo(() => filteredData.filter(r => r.ragState === 'GREY').slice(0, 20), [filteredData]);

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-3">
        <ServerCog className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Admin Health Console</span>
        <span className="text-[10px] text-muted-foreground">Layer 1 connectors · Layer 3 SLA vault · Dead-letter queue</span>
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <span><span className="rag-grey font-mono font-bold">{greyRows.length}</span> <span className="text-muted-foreground">grey alerts</span></span>
          <span><span className="font-mono font-bold text-foreground">{vault.length}</span> <span className="text-muted-foreground">SLA versions</span></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Connector health */}
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
                  <div className="text-[9px] text-muted-foreground">{c.total.toLocaleString()} KPIs ingested · {c.grey} data-starved</div>
                </div>
                <div className={cn('text-[10px] font-mono font-bold',
                  c.health === 'GREEN' ? 'rag-green' : c.health === 'AMBER' ? 'rag-amber' : 'rag-red',
                )}>{c.health}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grey alert feed */}
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertOctagon className="h-3 w-3" /> Grey State Pipeline Alerts
          </h3>
          <div className="space-y-1 max-h-[260px] overflow-y-auto scrollbar-thin">
            {greyRows.map(r => (
              <div key={r.id} className="text-[10px] px-2 py-1 rounded bg-rag-grey border border-rag-grey">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-foreground">{r.id}</span>
                  <span className="rag-grey font-semibold">{r.system}</span>
                  <span className="text-muted-foreground ml-auto">{r.source}</span>
                </div>
                <div className="text-muted-foreground">Connection dead · dummy data injection failed · routed to Platform Admin (bypassed SPOC)</div>
              </div>
            ))}
            {greyRows.length === 0 && <div className="text-[10px] text-muted-foreground italic text-center py-4">No grey-state pipelines · all connectors healthy</div>}
          </div>
        </div>
      </div>

      {/* SLA Configuration Vault */}
      <div className="bg-card border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <FileWarning className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SLA Configuration Vault · Version History</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">WORM-locked · evaluations use rule active at incident time</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground">
              <th className="text-left px-3 py-1.5 font-medium">Version</th>
              <th className="text-left px-3 py-1.5 font-medium">Active From</th>
              <th className="text-left px-3 py-1.5 font-medium">Changed By</th>
              <th className="text-left px-3 py-1.5 font-medium">Change Note</th>
              <th className="text-right px-3 py-1.5 font-medium">KPIs Using</th>
            </tr>
          </thead>
          <tbody>
            {vault.map((v, i) => (
              <tr key={v.version} className={cn('border-b border-border/50', i === vault.length - 1 && 'bg-primary/5')}>
                <td className="px-3 py-1.5 font-mono font-semibold text-foreground">{v.version}{i === vault.length - 1 && <span className="ml-2 text-[9px] rag-green">ACTIVE</span>}</td>
                <td className="px-3 py-1.5 font-mono text-muted-foreground">{v.activeFrom}</td>
                <td className="px-3 py-1.5">{v.changedBy}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{v.changeNote}</td>
                <td className="px-3 py-1.5 text-right font-mono">{v.kpis.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

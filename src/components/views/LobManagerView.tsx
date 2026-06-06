import { useMemo } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn, escalationCountdown } from '@/lib/utils';
import { Users, AlertCircle, ArrowUpRight, GitFork, Clock, Flag } from 'lucide-react';
import { RagState, RAG_SHORT } from '@/lib/mockData';

const RAG_BG: Record<RagState, string> = {
  GREEN: 'bg-rag-green border-rag-green',
  AMBER: 'bg-rag-amber border-rag-amber',
  RED: 'bg-rag-red border-rag-red',
  GREY: 'bg-rag-grey border-rag-grey',
  BLUE: 'bg-rag-blue border-rag-blue',
  UNCONFIGURED: 'rag-unconfigured',
};

export function LobManagerView() {
  const { filteredData, filters, openDrilldown } = useFilters();

  const scopedLob = filters.lobs.length === 1 ? filters.lobs[0] : 'All LoBs';

  // Aggregate matrix: system × process worst-state grid
  const matrix = useMemo(() => {
    const systems = Array.from(new Set(filteredData.map(r => r.system)));
    const procs = Array.from(new Set(filteredData.map(r => r.process)));
    const order: RagState[] = ['GREEN', 'BLUE', 'UNCONFIGURED', 'AMBER', 'GREY', 'RED'];
    const cell = (sys: string, p: string): { worst: RagState; breaches: number; exec: number; count: number } | null => {
      const rows = filteredData.filter(r => r.system === sys && r.process === p);
      if (!rows.length) return null;
      let worst: RagState = 'GREEN';
      let breaches = 0; let exec = 0;
      rows.forEach(r => {
        if (order.indexOf(r.ragState) > order.indexOf(worst)) worst = r.ragState;
        breaches += r.breaches; if (r.executiveFlag) exec++;
      });
      return { worst, breaches, exec, count: rows.length };
    };
    return { systems, procs, cell };
  }, [filteredData]);

  // Escalation rail — all open red/amber sorted by oldest unacknowledged
  const rail = useMemo(() => filteredData
    .filter(r => r.status === 'BREACHED' && r.resolutionStatus !== 'Resolved')
    .sort((a, b) => (b.executiveFlag ? 1 : 0) - (a.executiveFlag ? 1 : 0))
    .slice(0, 30),
  [filteredData]);

  const unack = rail.filter(r => r.stateFlags.includes('Unacknowledged')).length;
  const escalated = rail.filter(r => r.resolutionStatus === 'Escalated to HOD').length;
  const forked = rail.filter(r => r.dependency).length;

  return (
    <div className="space-y-3">
      {/* Header strip */}
      <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-3">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">LoB Manager · {scopedLob}</span>
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <span><span className="rag-amber font-mono font-bold">{unack}</span> <span className="text-muted-foreground">unacknowledged</span></span>
          <span><span className="rag-red font-mono font-bold">{escalated}</span> <span className="text-muted-foreground">escalated</span></span>
          <span><span className="text-chart-5 font-mono font-bold">{forked}</span> <span className="text-muted-foreground">cross-functional</span></span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Aggregated matrix */}
        <div className="col-span-2 bg-card border border-border rounded-md p-3 overflow-auto">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Aggregated Matrix · System × Process</h3>
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="text-left py-1 pr-2 font-medium text-muted-foreground">System</th>
                {matrix.procs.map(p => <th key={p} className="px-1 py-1 font-medium text-muted-foreground text-center min-w-[80px]">{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.systems.map(s => (
                <tr key={s}>
                  <td className="py-1 pr-2 font-semibold text-foreground" onClick={() => openDrilldown('system', s)}>
                    <span className="cursor-pointer hover:text-primary">{s}</span>
                  </td>
                  {matrix.procs.map(p => {
                    const c = matrix.cell(s, p);
                    if (!c) return <td key={p} className="p-1"><div className="h-7 rounded border border-dashed border-border" /></td>;
                    const w: RagState = c.worst;
                    return (
                      <td key={p} className="p-1">
                        <div className={cn(
                          'rounded border px-1.5 py-1 text-center cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all',
                          RAG_BG[w],
                          c.exec > 0 && 'exec-pulse',
                        )}>
                          <div className={cn('font-bold font-mono text-[9px]',
                            w === 'RED' ? 'rag-red' : w === 'AMBER' ? 'rag-amber' :
                            w === 'GREY' ? 'rag-grey' : w === 'BLUE' ? 'rag-blue' : 'rag-green')}>
                            {w.slice(0, 3)}
                          </div>
                          <div className="text-muted-foreground text-[9px]">{c.breaches > 0 ? `${c.breaches} br` : '—'}</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Escalation rail */}
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ArrowUpRight className="h-3 w-3" /> Escalation Rail
          </h3>
          <div className="space-y-1 max-h-[420px] overflow-y-auto scrollbar-thin">
            {rail.map(r => {
              const c = escalationCountdown(r);
              const toneClass = c.tone === 'red' ? 'rag-red' : c.tone === 'amber' ? 'rag-amber' : c.tone === 'green' ? 'rag-green' : 'text-muted-foreground';
              return (
                <div key={r.id} onClick={() => openDrilldown('breach', r.id, r)}
                  className={cn(
                    'rounded border px-2 py-1.5 text-[10px] cursor-pointer hover:ring-1 hover:ring-primary/50',
                    r.resolutionStatus === 'Escalated to HOD' ? 'bg-rag-red border-rag-red' : 'bg-rag-amber border-rag-amber',
                    (r.executiveFlag || c.overdue) && 'exec-pulse',
                  )}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-foreground">{r.id}</span>
                    {r.executiveFlag && <Flag className="h-3 w-3 rag-red" />}
                    {r.dependency && <GitFork className="h-3 w-3 text-chart-5" />}
                    {r.stateFlags.includes('Unacknowledged') && <span title="Unacknowledged by SPOC"><AlertCircle className="h-3 w-3 rag-amber" /></span>}
                  </div>
                  <div className="text-muted-foreground mt-0.5">{r.system} · {r.process}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-muted-foreground">{r.lob} · {r.assignee?.name || 'unassigned'}</span>
                    <span className={cn('flex items-center gap-1 font-semibold', toneClass)}>
                      <Clock className="h-2.5 w-2.5" /> {c.label}
                    </span>
                  </div>
                </div>
              );
            })}
            {rail.length === 0 && <div className="text-[10px] text-muted-foreground italic text-center py-4">No active escalations</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

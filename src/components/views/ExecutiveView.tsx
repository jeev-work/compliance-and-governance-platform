import { useMemo } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn, CHART_TOOLTIP } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { Shield, AlertTriangle, CheckCircle, Activity, Clock, TrendingDown, Zap, Flag, Pause, MinusCircle } from 'lucide-react';
import { RagState } from '@/lib/mockData';

const RAG_HSL: Record<RagState, string> = {
  GREEN: 'hsl(142 71% 45%)',
  AMBER: 'hsl(38 92% 50%)',
  RED: 'hsl(0 72% 51%)',
  GREY: 'hsl(220 9% 55%)',
  BLUE: 'hsl(199 89% 58%)',
  UNCONFIGURED: 'hsl(265 20% 55%)',
};

export function ExecutiveView() {
  const { filteredData, openDrilldown } = useFilters();

  const ragDist = useMemo(() => {
    const counts: Record<RagState, number> = { GREEN: 0, AMBER: 0, RED: 0, GREY: 0, BLUE: 0, UNCONFIGURED: 0 };
    filteredData.forEach(r => { counts[r.ragState]++; });
    return (Object.entries(counts) as [RagState, number][])
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);
  }, [filteredData]);

  const metrics = useMemo(() => {
    const systems = new Set(filteredData.map(r => r.system));
    const totalVol = filteredData.reduce((s, r) => s + r.baseVolume, 0);
    const totalBr = filteredData.reduce((s, r) => s + r.breaches, 0);
    const healthPct = totalVol > 0 ? ((totalVol - totalBr) / totalVol) * 100 : 100;
    const br = filteredData.filter(r => r.status === 'BREACHED');
    const critical = br.filter(r => r.severity === 'Critical').length;
    const execFlagged = filteredData.filter(r => r.executiveFlag).length;
    const grey = filteredData.filter(r => r.ragState === 'GREY').length;
    const blue = filteredData.filter(r => r.ragState === 'BLUE').length;
    return {
      systems: systems.size,
      healthPct: Math.round(healthPct * 100) / 100,
      critical,
      execFlagged,
      grey, blue,
      totalBr,
    };
  }, [filteredData]);

  const lobBreaches = useMemo(() => {
    const m = new Map<string, { breaches: number; critical: number; rows: number }>();
    filteredData.forEach(r => {
      const c = m.get(r.lob) || { breaches: 0, critical: 0, rows: 0 };
      c.breaches += r.breaches;
      c.rows++;
      if (r.severity === 'Critical') c.critical++;
      m.set(r.lob, c);
    });
    return Array.from(m.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.breaches - a.breaches);
  }, [filteredData]);

  const trend = useMemo(() => {
    const byDate = new Map<string, { vol: number; br: number }>();
    filteredData.forEach(r => {
      const d = byDate.get(r.date) || { vol: 0, br: 0 };
      d.vol += r.baseVolume; d.br += r.breaches;
      byDate.set(r.date, d);
    });
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date: date.slice(5), failureRate: d.vol > 0 ? Math.round((d.br / d.vol) * 10000) / 100 : 0 }));
  }, [filteredData]);

  const systemGrid = useMemo(() => {
    const m = new Map<string, { worst: RagState; total: number; breaches: number; exec: number }>();
    filteredData.forEach(r => {
      const c = m.get(r.system) || { worst: 'GREEN' as RagState, total: 0, breaches: 0, exec: 0 };
      const order: RagState[] = ['GREEN', 'BLUE', 'UNCONFIGURED', 'AMBER', 'GREY', 'RED'];
      if (order.indexOf(r.ragState) > order.indexOf(c.worst)) c.worst = r.ragState;
      c.total++; c.breaches += r.breaches; if (r.executiveFlag) c.exec++;
      m.set(r.system, c);
    });
    return Array.from(m.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.breaches - a.breaches);
  }, [filteredData]);

  return (
    <div className="space-y-3">
      {/* Executive Flag banner */}
      {metrics.execFlagged > 0 && (
        <div className="bg-rag-red border border-rag-red rounded-md px-3 py-2 flex items-center gap-2 exec-pulse">
          <Flag className="h-4 w-4 rag-red shrink-0" />
          <span className="text-xs rag-red font-semibold">
            ⚑ {metrics.execFlagged} KPI{metrics.execFlagged > 1 ? 's' : ''} under Executive Flag — automated timers nullified
          </span>
        </div>
      )}

      {/* Row 1: Scorecards */}
      <div className="grid grid-cols-7 gap-2">
        <Scorecard icon={Shield} label="Systems" value={metrics.systems} />
        <Scorecard icon={Activity} label="Aggregate SLA" value={`${metrics.healthPct}%`} variant={metrics.healthPct >= 99 ? 'green' : metrics.healthPct >= 95 ? 'amber' : 'red'} />
        <Scorecard icon={AlertTriangle} label="Total Breaches" value={metrics.totalBr.toLocaleString()} variant={metrics.totalBr > 0 ? 'red' : 'green'} />
        <Scorecard icon={Zap} label="Critical" value={metrics.critical} variant={metrics.critical === 0 ? 'green' : 'red'} />
        <Scorecard icon={MinusCircle} label="Data Starved (Grey)" value={metrics.grey} variant={metrics.grey > 0 ? 'grey' : 'green'} />
        <Scorecard icon={Pause} label="Maintenance (Blue)" value={metrics.blue} variant="blue" />
        <Scorecard icon={Flag} label="Exec Flagged" value={metrics.execFlagged} variant={metrics.execFlagged > 0 ? 'red' : 'green'} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* 5-state RAG Donut */}
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">5-State Health Mix</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={ragDist} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {ragDist.map((d, i) => <Cell key={i} fill={RAG_HSL[d.name as RagState]} />)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-1 mt-2">
            {ragDist.map(d => (
              <div key={d.name} className="flex items-center gap-1 text-[9px]">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{
                    background: RAG_HSL[d.name as RagState],
                    border: d.name === 'UNCONFIGURED' ? '1px dashed hsl(var(--rag-unconfigured))' : undefined,
                  }}
                />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-mono ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Health Grid (5-state) */}
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">System Health</h3>
          <div className="space-y-1">
            {systemGrid.map(s => (
              <div key={s.name} onClick={() => openDrilldown('system', s.name)}
                className={cn(
                  'rounded px-2 py-1.5 text-[10px] border cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all',
                  s.worst === 'GREEN' && 'bg-rag-green border-rag-green',
                  s.worst === 'AMBER' && 'bg-rag-amber border-rag-amber',
                  s.worst === 'RED'   && 'bg-rag-red border-rag-red',
                  s.worst === 'GREY'  && 'bg-rag-grey border-rag-grey',
                  s.worst === 'BLUE'  && 'bg-rag-blue border-rag-blue',
                  s.worst === 'UNCONFIGURED' && 'rag-unconfigured',
                  s.exec > 0 && 'exec-pulse',
                )}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{s.name}</span>
                  <span className={cn('font-bold font-mono',
                    s.worst === 'RED' ? 'rag-red' : s.worst === 'AMBER' ? 'rag-amber' :
                    s.worst === 'GREY' ? 'rag-grey' : s.worst === 'BLUE' ? 'rag-blue' : 'rag-green',
                  )}>{s.worst}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                  <span>{s.breaches.toLocaleString()} breaches</span>
                  {s.exec > 0 && <span className="rag-red font-semibold">⚑ {s.exec}</span>}
                  <span className="ml-auto">{s.total} KPIs</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend + LoB bar */}
        <div className="space-y-2">
          <div className="bg-card border border-border rounded-md p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Failure Rate Trend</h3>
            <ResponsiveContainer width="100%" height={88}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'hsl(215 15% 50%)' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} unit="%" />
                <Tooltip {...CHART_TOOLTIP} />
                <Line type="monotone" dataKey="failureRate" stroke="hsl(0 72% 51%)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card border border-border rounded-md p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breaches by LoB</h3>
            <ResponsiveContainer width="100%" height={88}>
              <BarChart data={lobBreaches} layout="vertical" onClick={e => e?.activeLabel && openDrilldown('lob', e.activeLabel as string)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
                <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} width={50} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="breaches" cursor="pointer">
                  {lobBreaches.map((d, i) => {
                    const ratio = d.rows > 0 ? d.critical / d.rows : 0;
                    const fill = ratio > 0.02 ? 'hsl(0 72% 51%)' : (ratio > 0.005 || d.breaches > 0) ? 'hsl(38 92% 50%)' : 'hsl(142 71% 45%)';
                    return <Cell key={i} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scorecard({ icon: Icon, label, value, variant }: {
  icon: any; label: string; value: string | number; variant?: 'green' | 'amber' | 'red' | 'grey' | 'blue';
}) {
  const color =
    variant === 'green' ? 'rag-green' : variant === 'amber' ? 'rag-amber' :
    variant === 'red' ? 'rag-red' : variant === 'grey' ? 'rag-grey' :
    variant === 'blue' ? 'rag-blue' : 'text-foreground';
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-2">
      <Icon className={cn('h-4 w-4 shrink-0', variant ? color : 'text-primary')} />
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{label}</div>
        <div className={cn('text-lg font-semibold font-mono', color)}>{value}</div>
      </div>
    </div>
  );
}

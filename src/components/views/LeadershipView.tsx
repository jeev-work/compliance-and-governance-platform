import { useMemo } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { Shield, AlertTriangle, CheckCircle, Activity, Clock, TrendingUp, TrendingDown, Zap } from 'lucide-react';

export function LeadershipView() {
  const { filteredData, filters, openDrilldown } = useFilters();

  const metrics = useMemo(() => {
    const systems = new Set(filteredData.map((r) => r.system));
    const healthySystems = new Set<string>();
    const failingSystems = new Set<string>();

    systems.forEach((sys) => {
      const rows = filteredData.filter((r) => r.system === sys);
      const hasBreaches = rows.some((r) => r.status === 'BREACHED');
      if (hasBreaches) failingSystems.add(sys);
      else healthySystems.add(sys);
    });

    const totalVolume = filteredData.reduce((s, r) => s + r.baseVolume, 0);
    const totalBreaches = filteredData.reduce((s, r) => s + r.breaches, 0);
    const healthPct = totalVolume > 0 ? ((totalVolume - totalBreaches) / totalVolume) * 100 : 100;

    const breachedRows = filteredData.filter(r => r.status === 'BREACHED');
    const avgDetect = breachedRows.filter(r => r.timeToDetectMin).reduce((s, r) => s + (r.timeToDetectMin || 0), 0) / (breachedRows.filter(r => r.timeToDetectMin).length || 1);
    const avgResolve = breachedRows.filter(r => r.timeToResolveMin).reduce((s, r) => s + (r.timeToResolveMin || 0), 0) / (breachedRows.filter(r => r.timeToResolveMin).length || 1);
    const criticalCount = breachedRows.filter(r => r.severity === 'Critical').length;
    const resolvedPct = breachedRows.length > 0 ? (breachedRows.filter(r => r.resolutionStatus === 'Resolved').length / breachedRows.length) * 100 : 100;

    return {
      total: systems.size,
      healthy: healthySystems.size,
      failing: failingSystems.size,
      healthPct: Math.round(healthPct * 100) / 100,
      totalBreaches: totalBreaches,
      avgDetectMin: Math.round(avgDetect),
      avgResolveMin: Math.round(avgResolve),
      criticalCount,
      resolvedPct: Math.round(resolvedPct),
    };
  }, [filteredData]);

  const systemGrid = useMemo(() => {
    const systemMap = new Map<string, { breaches: number; total: number; critical: number; resolved: number; totalBreached: number }>();
    filteredData.forEach((r) => {
      const curr = systemMap.get(r.system) || { breaches: 0, total: 0, critical: 0, resolved: 0, totalBreached: 0 };
      curr.breaches += r.breaches;
      curr.total += r.baseVolume;
      if (r.status === 'BREACHED') {
        curr.totalBreached++;
        if (r.severity === 'Critical') curr.critical++;
        if (r.resolutionStatus === 'Resolved') curr.resolved++;
      }
      systemMap.set(r.system, curr);
    });
    return Array.from(systemMap.entries()).map(([name, data]) => ({
      name,
      failureRate: data.total > 0 ? (data.breaches / data.total) * 100 : 0,
      breaches: data.breaches,
      critical: data.critical,
      resolved: data.resolved,
      totalBreached: data.totalBreached,
    }));
  }, [filteredData]);

  const trendData = useMemo(() => {
    const byDate = new Map<string, { vol: number; breaches: number }>();
    filteredData.forEach((r) => {
      const d = byDate.get(r.date) || { vol: 0, breaches: 0 };
      d.vol += r.baseVolume;
      d.breaches += r.breaches;
      byDate.set(r.date, d);
    });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date: date.slice(5),
        failureRate: d.vol > 0 ? Math.round((d.breaches / d.vol) * 10000) / 100 : 0,
      }));
  }, [filteredData]);

  const deptBreaches = useMemo(() => {
    const map = new Map<string, { breaches: number; critical: number }>();
    filteredData.forEach(r => {
      const curr = map.get(r.department) || { breaches: 0, critical: 0 };
      curr.breaches += r.breaches;
      if (r.severity === 'Critical') curr.critical++;
      map.set(r.department, curr);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.breaches - a.breaches);
  }, [filteredData]);

  const severityDist = useMemo(() => {
    const map = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    filteredData.filter(r => r.status === 'BREACHED').forEach(r => { map[r.severity]++; });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [filteredData]);

  return (
    <div className="space-y-3">
      {/* Row 1: Key Scorecards */}
      <div className="grid grid-cols-6 gap-2">
        <Scorecard icon={Shield} label="Systems Monitored" value={metrics.total} />
        <Scorecard icon={CheckCircle} label="Healthy" value={metrics.healthy} variant="green" />
        <Scorecard icon={AlertTriangle} label="Attention Required" value={metrics.failing} variant="red" />
        <Scorecard icon={Activity} label="Aggregate SLA" value={`${metrics.healthPct}%`} variant={metrics.healthPct >= 99 ? 'green' : metrics.healthPct >= 95 ? 'amber' : 'red'} />
        <Scorecard icon={Clock} label="Avg Detection" value={`${metrics.avgDetectMin}m`} variant={metrics.avgDetectMin <= 15 ? 'green' : metrics.avgDetectMin <= 60 ? 'amber' : 'red'} />
        <Scorecard icon={Zap} label="Critical Issues" value={metrics.criticalCount} variant={metrics.criticalCount === 0 ? 'green' : 'red'} />
      </div>

      {/* Row 2: Proactive Alerts */}
      <div className="grid grid-cols-3 gap-2">
        <MetricTile label="Avg Resolution Time" value={metrics.avgResolveMin > 60 ? `${Math.round(metrics.avgResolveMin / 60)}h ${metrics.avgResolveMin % 60}m` : `${metrics.avgResolveMin}m`} sub={metrics.avgResolveMin > 120 ? 'Above target — needs attention' : 'Within acceptable range'} variant={metrics.avgResolveMin > 120 ? 'red' : 'green'} icon={metrics.avgResolveMin > 120 ? TrendingDown : TrendingUp} />
        <MetricTile label="Resolution Rate" value={`${metrics.resolvedPct}%`} sub={`${metrics.totalBreaches.toLocaleString()} total breaches in period`} variant={metrics.resolvedPct >= 80 ? 'green' : metrics.resolvedPct >= 50 ? 'amber' : 'red'} icon={metrics.resolvedPct >= 80 ? TrendingUp : TrendingDown} />
        <MetricTile label="Severity Distribution" value={`${severityDist[0]?.count || 0} Critical`} sub={`${severityDist[1]?.count || 0} High · ${severityDist[2]?.count || 0} Med · ${severityDist[3]?.count || 0} Low`} variant={severityDist[0]?.count > 0 ? 'red' : 'green'} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* System Health Grid */}
        <div className="col-span-1 bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">System Health Grid</h3>
          <div className="space-y-1">
            {systemGrid.map((sys) => {
              const variant = sys.breaches === 0 ? 'green' : sys.failureRate > 2 ? 'red' : 'amber';
              return (
                <div
                  key={sys.name}
                  onClick={() => openDrilldown('system', sys.name)}
                  className={cn(
                    'rounded px-2 py-1.5 text-[10px] border cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all',
                    variant === 'green' && 'bg-rag-green border-rag-green/30',
                    variant === 'amber' && 'bg-rag-amber border-rag-amber/30',
                    variant === 'red' && 'bg-rag-red border-rag-red/30',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('font-semibold', variant === 'green' ? 'rag-green' : variant === 'amber' ? 'rag-amber' : 'rag-red')}>{sys.name}</span>
                    <span className="text-muted-foreground">{sys.failureRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                    <span>{sys.totalBreached} breached</span>
                    {sys.critical > 0 && <span className="rag-red">⚠ {sys.critical} critical</span>}
                    <span className="ml-auto">{sys.resolved} resolved</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SLA Trendline */}
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Failure Rate Trend ({filters.dateRange}d)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'hsl(215 15% 50%)' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} unit="%" />
              <Tooltip contentStyle={{ background: 'hsl(222 44% 8%)', border: '1px solid hsl(222 30% 16%)', borderRadius: 4, fontSize: 11 }} />
              <Line type="monotone" dataKey="failureRate" stroke="hsl(0 72% 51%)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Dept Breaches */}
        <div className="bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breaches by Department</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptBreaches} layout="vertical" onClick={(e) => { if (e?.activeLabel) openDrilldown('department', e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
              <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215 15% 50%)' }} width={90} />
              <Tooltip contentStyle={{ background: 'hsl(222 44% 8%)', border: '1px solid hsl(222 30% 16%)', fontSize: 11 }} />
              <Bar dataKey="breaches" radius={[0, 2, 2, 0]} cursor="pointer">
                {deptBreaches.map((d, i) => (
                  <Cell key={i} fill={d.critical > 0 ? 'hsl(0 72% 51%)' : d.breaches > 0 ? 'hsl(38 92% 50%)' : 'hsl(142 71% 45%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Scorecard({ icon: Icon, label, value, variant }: {
  icon: React.ElementType; label: string; value: string | number; variant?: 'green' | 'amber' | 'red';
}) {
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-2">
      <Icon className={cn('h-4 w-4 shrink-0', variant === 'green' && 'rag-green', variant === 'amber' && 'rag-amber', variant === 'red' && 'rag-red', !variant && 'text-primary')} />
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={cn('text-lg font-semibold font-mono', variant === 'green' && 'rag-green', variant === 'amber' && 'rag-amber', variant === 'red' && 'rag-red', !variant && 'text-foreground')}>{value}</div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, sub, variant, icon: Icon }: {
  label: string; value: string; sub: string; variant: 'green' | 'amber' | 'red'; icon: React.ElementType;
}) {
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={cn('h-3.5 w-3.5', variant === 'green' ? 'rag-green' : variant === 'amber' ? 'rag-amber' : 'rag-red')} />
      </div>
      <div className={cn('text-lg font-semibold font-mono', variant === 'green' ? 'rag-green' : variant === 'amber' ? 'rag-amber' : 'rag-red')}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

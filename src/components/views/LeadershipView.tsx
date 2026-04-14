import { useMemo } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Shield, AlertTriangle, CheckCircle, Activity } from 'lucide-react';

export function LeadershipView() {
  const { filteredData, filters } = useFilters();

  const metrics = useMemo(() => {
    const systems = new Set(filteredData.map((r) => r.system));
    const healthySystems = new Set<string>();
    const failingSystems = new Set<string>();

    systems.forEach((sys) => {
      const rows = filteredData.filter((r) => r.system === sys);
      const hasBreaches = rows.some((r) => r.status === 'Breach');
      if (hasBreaches) failingSystems.add(sys);
      else healthySystems.add(sys);
    });

    const totalVolume = filteredData.reduce((s, r) => s + r.baseVolume, 0);
    const totalBreaches = filteredData.reduce((s, r) => s + r.breaches, 0);
    const healthPct = totalVolume > 0 ? ((totalVolume - totalBreaches) / totalVolume) * 100 : 100;

    return {
      total: systems.size,
      healthy: healthySystems.size,
      failing: failingSystems.size,
      healthPct: Math.round(healthPct * 100) / 100,
    };
  }, [filteredData]);

  const systemGrid = useMemo(() => {
    const systemMap = new Map<string, { breaches: number; total: number }>();
    filteredData.forEach((r) => {
      const curr = systemMap.get(r.system) || { breaches: 0, total: 0 };
      curr.breaches += r.breaches;
      curr.total += r.baseVolume;
      systemMap.set(r.system, curr);
    });
    return Array.from(systemMap.entries()).map(([name, data]) => ({
      name,
      failureRate: data.total > 0 ? (data.breaches / data.total) * 100 : 0,
      breaches: data.breaches,
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

  return (
    <div className="space-y-3">
      {/* Scorecards */}
      <div className="grid grid-cols-4 gap-2">
        <Scorecard icon={Shield} label="Systems Monitored" value={metrics.total} />
        <Scorecard icon={CheckCircle} label="Healthy" value={metrics.healthy} variant="green" />
        <Scorecard icon={AlertTriangle} label="Attention Required" value={metrics.failing} variant="red" />
        <Scorecard icon={Activity} label="Aggregate Health" value={`${metrics.healthPct}%`} variant={metrics.healthPct >= 99 ? 'green' : metrics.healthPct >= 95 ? 'amber' : 'red'} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* System Health Grid */}
        <div className="col-span-2 bg-card border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">System Health Grid</h3>
          <div className="grid grid-cols-5 gap-1.5">
            {systemGrid.map((sys) => {
              const variant = sys.breaches === 0 ? 'green' : sys.failureRate > 2 ? 'red' : 'amber';
              return (
                <div
                  key={sys.name}
                  className={cn(
                    'rounded px-2 py-1.5 text-[10px] border',
                    variant === 'green' && 'bg-rag-green border-rag-green/30',
                    variant === 'amber' && 'bg-rag-amber border-rag-amber/30',
                    variant === 'red' && 'bg-rag-red border-rag-red/30',
                  )}
                >
                  <div className={cn(
                    'font-semibold truncate',
                    variant === 'green' && 'rag-green',
                    variant === 'amber' && 'rag-amber',
                    variant === 'red' && 'rag-red',
                  )}>{sys.name}</div>
                  <div className="text-muted-foreground">{sys.failureRate.toFixed(2)}% fail</div>
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
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} unit="%" />
              <Tooltip
                contentStyle={{ background: 'hsl(222 44% 8%)', border: '1px solid hsl(222 30% 16%)', borderRadius: 4, fontSize: 11 }}
                labelStyle={{ color: 'hsl(210 20% 90%)' }}
              />
              <Line type="monotone" dataKey="failureRate" stroke="hsl(0 72% 51%)" strokeWidth={1.5} dot={false} />
            </LineChart>
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
      <Icon className={cn(
        'h-4 w-4 shrink-0',
        variant === 'green' && 'rag-green',
        variant === 'amber' && 'rag-amber',
        variant === 'red' && 'rag-red',
        !variant && 'text-primary',
      )} />
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={cn(
          'text-lg font-semibold font-mono',
          variant === 'green' && 'rag-green',
          variant === 'amber' && 'rag-amber',
          variant === 'red' && 'rag-red',
          !variant && 'text-foreground',
        )}>{value}</div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { useFilters } from '@/lib/filterContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend, Cell } from 'recharts';
import { TrendingUp, BarChart3, Calendar, Phone, Mail } from 'lucide-react';
import { CHART_TOOLTIP } from '@/lib/utils';
import { SYSTEM_SPOC_MAP } from '@/lib/mockData';

const LOB_COLORS: Record<string, string> = {
  B2B: 'hsl(210 100% 56%)',
  B2C: 'hsl(142 71% 45%)',
  Wheels: 'hsl(280 65% 60%)',
};

export function AnalystView() {
  const { filteredData } = useFilters();

  // SLA% month-over-month by LoB
  const monthly = useMemo(() => {
    const map = new Map<string, Record<string, { vol: number; br: number }>>();
    filteredData.forEach(r => {
      const month = r.date.slice(0, 7);
      const cur = map.get(month) || {};
      const slot = cur[r.lob] || { vol: 0, br: 0 };
      slot.vol += r.baseVolume; slot.br += r.breaches;
      cur[r.lob] = slot;
      map.set(month, cur);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, lobs]) => {
      const row: any = { month };
      Object.entries(lobs).forEach(([lob, d]) => {
        row[lob] = d.vol > 0 ? Math.round(((d.vol - d.br) / d.vol) * 10000) / 100 : 100;
      });
      return row;
    });
  }, [filteredData]);

  const breachBySystem = useMemo(() => {
    const m = new Map<string, number>();
    filteredData.forEach(r => m.set(r.system, (m.get(r.system) || 0) + r.breaches));
    return Array.from(m.entries()).map(([name, breaches]) => ({ name, breaches })).sort((a, b) => b.breaches - a.breaches);
  }, [filteredData]);

  const lobs = Array.from(new Set(filteredData.map(r => r.lob)));

  const totalVol = filteredData.reduce((s, r) => s + r.baseVolume, 0);
  const totalBr = filteredData.reduce((s, r) => s + r.breaches, 0);
  const aggregateSla = totalVol > 0 ? ((totalVol - totalBr) / totalVol) * 100 : 100;

  return (
    <div className="space-y-3">
      <div className="bg-secondary/30 border border-border rounded-md px-3 py-2 text-[10px] text-muted-foreground italic">
        Read-only historical analysis · no live alerts · no PII · aggregated metrics for capacity planning
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={TrendingUp} label="Aggregate SLA%" value={`${aggregateSla.toFixed(2)}%`} />
        <Stat icon={BarChart3} label="Total Records" value={filteredData.length.toLocaleString()} />
        <Stat icon={Calendar} label="Months Covered" value={String(monthly.length)} />
      </div>

      <div className="bg-card border border-border rounded-md p-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">SLA% Month-over-Month by LoB</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
            <YAxis tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} unit="%" domain={['dataMin - 1', 100]} />
            <Tooltip {...CHART_TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {lobs.map(lob => (
              <Line key={lob} type="monotone" dataKey={lob} stroke={LOB_COLORS[lob] || 'hsl(0 72% 51%)'} strokeWidth={1.8} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-md p-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Aggregate Breaches by System</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={breachBySystem}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 16%)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
            <YAxis tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }} />
            <Tooltip {...CHART_TOOLTIP} />
            <Bar dataKey="breaches">
              {breachBySystem.map((_, i) => <Cell key={i} fill={i < 2 ? 'hsl(0 72% 51%)' : 'hsl(38 92% 50%)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* SPOC contact directory — Analyst can request details but cannot see malfunction history */}
      <div className="bg-card border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System SPOC Directory</h3>
          <span className="text-[10px] text-muted-foreground ml-2 italic">For incident-level details, contact the relevant System SPOC. Analyst role does not have access to malfunction history.</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground">
              <th className="text-left px-3 py-1.5 font-medium">System</th>
              <th className="text-left px-3 py-1.5 font-medium">SPOC</th>
              <th className="text-left px-3 py-1.5 font-medium">Role</th>
              <th className="text-left px-3 py-1.5 font-medium">Email</th>
              <th className="text-left px-3 py-1.5 font-medium">Phone</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(SYSTEM_SPOC_MAP).map(([sys, s]) => (
              <tr key={sys} className="border-b border-border/50 hover:bg-accent/20">
                <td className="px-3 py-1.5 font-semibold text-foreground">{sys}</td>
                <td className="px-3 py-1.5">{s.name}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{s.role}</td>
                <td className="px-3 py-1.5 font-mono text-[10px] flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{s.email}</td>
                <td className="px-3 py-1.5 font-mono text-[10px]"><span className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{s.phone}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-lg font-semibold font-mono text-foreground">{value}</div>
      </div>
    </div>
  );
}

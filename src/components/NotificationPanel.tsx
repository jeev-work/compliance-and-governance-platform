import { useMemo, useState } from 'react';
import { useFilters } from '@/lib/filterContext';
import { cn, escalationCountdown } from '@/lib/utils';
import { KPIRow, getContactPhone } from '@/lib/mockData';
import {
  Bell, ChevronDown, ChevronUp, AlertTriangle, Flag, GitFork,
  ShieldAlert, Activity, ClipboardCheck, Database, CheckCircle2,
} from 'lucide-react';

type NotifTone = 'red' | 'amber' | 'blue' | 'grey' | 'green';

type Notif = {
  id: string;
  icon: any;
  tone: NotifTone;
  reason: string;
  row: KPIRow;
};

const TONE: Record<NotifTone, string> = {
  red:   'border-rag-red bg-rag-red rag-red',
  amber: 'border-rag-amber bg-rag-amber rag-amber',
  blue:  'border-rag-blue bg-rag-blue rag-blue',
  grey:  'border-rag-grey bg-rag-grey rag-grey',
  green: 'border-rag-green bg-rag-green rag-green',
};

const ROLE_META: Record<string, { title: string; subtitle: string }> = {
  executive:  { title: 'Executive Notifications',     subtitle: 'New RED breaches, escalations & flagged tickets' },
  lobManager: { title: 'LoB Manager Notifications',   subtitle: 'Unacknowledged, overdue & cross-functional items in scope' },
  spoc:       { title: 'IT SPOC Notifications',       subtitle: 'Tickets needing acknowledgement or resolution' },
  compliance: { title: 'Compliance Notifications',    subtitle: 'Ledger sign-offs pending & data-integrity (GREY) events' },
  
  admin:      { title: 'Admin Notifications',         subtitle: 'Connector outages, verification-pending & recent ledger writes' },
};

function fmtAgo(iso: string): string {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationPanel() {
  const { filters, filteredData, openDrilldown } = useFilters();
  const [open, setOpen] = useState(true);

  const meta = ROLE_META[filters.role] ?? ROLE_META.executive;

  const notifs: Notif[] = useMemo(() => {
    const list: Notif[] = [];
    const cutoff24h = Date.now() - 24 * 3600 * 1000;

    switch (filters.role) {
      case 'executive': {
        filteredData.forEach(r => {
          if (r.executiveFlag) {
            list.push({ id: `flag-${r.id}`, icon: Flag, tone: 'red', reason: 'Executive flag raised', row: r });
          } else if (r.resolutionStatus === 'Escalated to HOD') {
            list.push({ id: `esc-${r.id}`, icon: ShieldAlert, tone: 'red', reason: 'Escalated to HOD', row: r });
          } else if (r.ragState === 'RED' && new Date(r.timestamp).getTime() > cutoff24h) {
            list.push({ id: `red-${r.id}`, icon: AlertTriangle, tone: 'red', reason: 'New RED breach (24h)', row: r });
          }
        });
        break;
      }
      case 'lobManager': {
        filteredData.forEach(r => {
          if (r.status !== 'BREACHED') return;
          const c = escalationCountdown(r);
          if (r.stateFlags.includes('Unacknowledged')) {
            list.push({ id: `unack-${r.id}`, icon: AlertTriangle, tone: 'amber', reason: 'Unacknowledged by SPOC', row: r });
          } else if (c.overdue) {
            list.push({ id: `od-${r.id}`, icon: ShieldAlert, tone: 'red', reason: `Overdue · ${c.label}`, row: r });
          } else if (r.dependency && r.dependency.status === 'open') {
            list.push({ id: `dep-${r.id}`, icon: GitFork, tone: 'blue', reason: `Cross-functional → ${r.dependency.team}`, row: r });
          }
        });
        break;
      }
      case 'spoc': {
        filteredData.forEach(r => {
          if (r.status !== 'BREACHED') return;
          const c = escalationCountdown(r);
          if (r.stateFlags.includes('Unacknowledged')) {
            list.push({ id: `unack-${r.id}`, icon: AlertTriangle, tone: c.overdue ? 'red' : 'amber', reason: `Awaiting acknowledgement · ${c.label}`, row: r });
          } else if (r.resolutionStatus === 'Investigating') {
            list.push({ id: `inv-${r.id}`, icon: Activity, tone: c.tone === 'red' ? 'red' : 'amber', reason: `Investigating · ${c.label}`, row: r });
          }
        });
        break;
      }
      case 'compliance': {
        filteredData.forEach(r => {
          if (r.resolutionStatus === 'Resolved' && r.status === 'CLEAN') {
            list.push({ id: `rev-${r.id}`, icon: ClipboardCheck, tone: 'green', reason: 'Resolved · awaiting ledger sign-off', row: r });
          } else if (r.ragState === 'GREY') {
            list.push({ id: `grey-${r.id}`, icon: Database, tone: 'grey', reason: 'Data integrity · GREY state', row: r });
          }
        });
        break;
      }
      case 'admin': {
        filteredData.forEach(r => {
          if (r.ragState === 'GREY') {
            list.push({ id: `out-${r.id}`, icon: Database, tone: 'grey', reason: 'Connector outage', row: r });
          } else if (r.resolutionStatus === 'Verifying') {
            list.push({ id: `ver-${r.id}`, icon: CheckCircle2, tone: 'blue', reason: 'Telemetry verification pending', row: r });
          }
        });
        break;
      }
    }

    // Cascade-ready: child sub-ticket resolved, parent still open, not dismissed.
    // Surfaced for every role — auditors care, SPOCs need to act, execs notice closure velocity.
    filteredData.forEach(r => {
      if (
        r.dependency
        && r.dependency.status === 'resolved'
        && !r.dependency.cascadeDismissed
        && r.resolutionStatus !== 'Resolved'
        && r.status !== 'CLEAN'
      ) {
        list.push({
          id: `cascade-${r.id}`,
          icon: CheckCircle2,
          tone: 'green',
          reason: `Cascade ready · child ${r.dependency.linkedId} resolved by ${r.dependency.team}`,
          row: r,
        });
      }
    });

    // Sort: red > amber > blue/grey > green; newest first within tone.
    const toneRank: Record<NotifTone, number> = { red: 0, amber: 1, blue: 2, grey: 3, green: 4 };
    list.sort((a, b) => {
      const t = toneRank[a.tone] - toneRank[b.tone];
      if (t !== 0) return t;
      return b.row.timestamp.localeCompare(a.row.timestamp);
    });
    return list.slice(0, 40);
  }, [filters.role, filteredData]);

  const topCount = notifs.length;

  // Severity bucket counts across the filtered set
  const sevBuckets = useMemo(() => {
    const b = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    filteredData.forEach(r => { if (r.status === 'BREACHED') b[r.severity]++; });
    return b;
  }, [filteredData]);

  return (
    <div className="bg-card border border-border rounded-md mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/30 rounded-t-md"
      >
        <Bell className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">{meta.title}</span>
        <span className="text-[10px] text-muted-foreground">· {meta.subtitle}</span>
        <span className="ml-3 flex items-center gap-1 text-[9px] font-mono">
          <span className="px-1.5 py-0.5 rounded bg-rag-red rag-red font-bold border border-rag-red">CRIT {sevBuckets.Critical}</span>
          <span className="px-1.5 py-0.5 rounded bg-rag-amber rag-amber font-bold border border-rag-amber">HIGH {sevBuckets.High}</span>
          <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground">MED {sevBuckets.Medium}</span>
          <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground">LOW {sevBuckets.Low}</span>
        </span>
        <span className={cn(
          'ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
          topCount === 0 ? 'border-border text-muted-foreground' : 'border-primary/40 bg-primary/15 text-primary',
        )}>{topCount}</span>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-2 pb-2 max-h-[200px] overflow-y-auto scrollbar-thin space-y-1">
          {notifs.length === 0 && (
            <div className="text-[10px] text-muted-foreground italic text-center py-4">All clear — no notifications for this role.</div>
          )}
          {notifs.map(n => {
            const Icon = n.icon;
            const phone = n.row.assignee ? getContactPhone(n.row.assignee.name) : null;
            return (
              <div
                key={n.id}
                onClick={() => openDrilldown('breach', n.row.id, n.row)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded border text-[10px] cursor-pointer hover:ring-1 hover:ring-primary/50',
                  TONE[n.tone],
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="font-mono font-semibold text-foreground">{n.row.id}</span>
                <span className="text-muted-foreground">{n.row.system} · {n.row.process}</span>
                <span className="text-foreground">{n.reason}</span>
                {n.row.assignee && (
                  <span className="text-muted-foreground ml-1">→ {n.row.assignee.name}{phone && <span className="font-mono"> · {phone}</span>}</span>
                )}
                <span className="ml-auto text-muted-foreground font-mono">{fmtAgo(n.row.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

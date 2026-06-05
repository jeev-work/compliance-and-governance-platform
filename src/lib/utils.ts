import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shared Recharts tooltip style — uses semantic popover tokens for readability on dark surfaces. */
export const CHART_TOOLTIP = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    color: 'hsl(var(--popover-foreground))',
    fontSize: 11,
    boxShadow: '0 4px 12px hsl(0 0% 0% / 0.4)',
  } as React.CSSProperties,
  labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 } as React.CSSProperties,
  itemStyle: { color: 'hsl(var(--foreground))' } as React.CSSProperties,
};

/** SLA escalation budget by severity (minutes from alert generation). */
export const ESCALATE_BUDGET_MIN: Record<string, number> = {
  Critical: 30, High: 60, Medium: 120, Low: 240,
};

export function fmtMinutes(m: number | null | undefined): string {
  if (m == null) return '—';
  const abs = Math.abs(m);
  const s = abs < 60 ? `${abs}m` : `${Math.floor(abs / 60)}h ${abs % 60}m`;
  return m < 0 ? `-${s}` : s;
}

/**
 * Escalation countdown — always returns *something* (never "—") for breached rows,
 * so the "fix as soon as possible" intent is always visible.
 *
 *  - Resolved → shows actual time taken (gen → resolve)
 *  - Escalated → shows actual time taken to escalate
 *  - Paused (open dependency) → "⏸ paused" with budget snapshot
 *  - Otherwise → live countdown vs severity budget; negative = OVERDUE / auto-escalate
 */
export function escalationCountdown(row: {
  timestamp: string;
  status: 'BREACHED' | 'CLEAN';
  resolutionStatus: string;
  severity: string;
  timeToEscalateMin: number | null;
  timeToResolveMin: number | null;
  dependency: { status: 'open' | 'resolved' } | null;
}): { label: string; tone: 'green' | 'amber' | 'red' | 'muted'; overdue: boolean } {
  if (row.status === 'CLEAN') {
    return { label: 'within SLA', tone: 'green', overdue: false };
  }
  if (row.resolutionStatus === 'Resolved' && row.timeToResolveMin != null) {
    return { label: `resolved in ${fmtMinutes(row.timeToResolveMin)}`, tone: 'green', overdue: false };
  }
  if (row.resolutionStatus === 'Escalated to HOD' && row.timeToEscalateMin != null) {
    return { label: `escalated @ ${fmtMinutes(row.timeToEscalateMin)}`, tone: 'red', overdue: false };
  }
  const budget = ESCALATE_BUDGET_MIN[row.severity] ?? 120;
  const elapsedMin = Math.floor((Date.now() - new Date(row.timestamp).getTime()) / 60000);
  const remaining = budget - elapsedMin;

  if (row.dependency && row.dependency.status === 'open') {
    return { label: `⏸ paused · ${fmtMinutes(Math.max(remaining, 0))} left`, tone: 'muted', overdue: false };
  }
  if (remaining < 0) {
    return { label: `OVERDUE · ${fmtMinutes(remaining)}`, tone: 'red', overdue: true };
  }
  if (remaining < budget * 0.25) {
    return { label: `${fmtMinutes(remaining)} left`, tone: 'red', overdue: false };
  }
  if (remaining < budget * 0.5) {
    return { label: `${fmtMinutes(remaining)} left`, tone: 'amber', overdue: false };
  }
  return { label: `${fmtMinutes(remaining)} left`, tone: 'green', overdue: false };
}

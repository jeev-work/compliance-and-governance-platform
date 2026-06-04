// Governance KPI mock data — 5-state RAG, LoB, full incident lifecycle.
// Models the patterns described in Solution Blueprint §2 and Conceptual Design §3.3/§4.1.

export const LOBS = ['B2B', 'B2C', 'Wheels'] as const;
export type LoB = typeof LOBS[number];

const SYSTEMS = ['Core Banking', 'Payment Gateway', 'CRM', 'Document Cloud', 'Data Warehouse', 'Auth Engine'] as const;
const PROCESSES = ['KYC Verification', 'API Uptime', 'Ledger Sync', 'AML Screening', 'Ticket Routing', 'DB Backup'] as const;
const SOURCES = ['AppDynamics', 'Datadog', 'Splunk', 'New Relic'] as const;

const ASSIGNEES = [
  { name: 'J. Chen', role: 'Sr. Engineer' },
  { name: 'M. Patel', role: 'Compliance Lead' },
  { name: 'S. Kumar', role: 'DevOps Manager' },
  { name: 'A. Williams', role: 'Risk Analyst' },
  { name: 'R. Thompson', role: 'IT Support Lead' },
  { name: 'K. Garcia', role: 'Security Architect' },
  { name: 'L. Zhang', role: 'VP Engineering' },
  { name: 'D. Okafor', role: 'Head of Compliance' },
  { name: 'P. Novak', role: 'CTO' },
  { name: 'E. Santos', role: 'Audit Manager' },
];

const CAUSES = [
  'timeout in upstream service', 'database connection pool exhaustion',
  'certificate expiry', 'API rate limiting', 'memory leak in worker process',
  'misconfigured firewall rule', 'stale cache invalidation', 'disk I/O saturation',
];

const DEPENDENCY_TEAMS = ['Network Ops', 'Infrastructure', 'Database Admin', 'Security Eng', 'Cloud Platform'];

/** Five-state governance status per Blueprint §1 Layer 3 */
export type RagState = 'GREEN' | 'AMBER' | 'RED' | 'GREY' | 'BLUE' | 'UNCONFIGURED';

/** Operational state flags exposed in the universal filter ribbon */
export type StateFlag =
  | 'Acknowledged' | 'Unacknowledged' | 'Escalated'
  | 'Cross-Functional' | 'Verifying' | 'Unconfigured';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type ChaseStep =
  | 'Generated' | 'Notified' | 'Acknowledged' | 'Resolved' | 'Verifying' | 'Closed';

export type EscalationEntry = { from: string; to: string; timestamp: string; reason: string };
export type CommentEntry = { author: string; role: string; timestamp: string; text: string };
export type ChaseEvent = { step: ChaseStep; timestamp: string; actor: string };
export type DependencyFork = { team: string; timestamp: string; linkedId: string; status: 'open' | 'resolved' };
export type LedgerEntry = { timestamp: string; actor: string; action: string; hash: string; details?: string };

export type KPIRow = {
  id: string;
  date: string;            // ISO date
  timestamp: string;       // ISO timestamp (hourly granularity for date picker)
  lob: LoB;
  system: string;
  process: string;
  source: string;          // monitoring source — used by Admin Health Console
  baseVolume: number;
  breaches: number;
  failureRate: number;
  targetSLA: number;
  slaVersion: string;      // SLA Configuration Vault version (Blueprint §1 Layer 3)
  ragState: RagState;
  status: 'BREACHED' | 'CLEAN';
  resolutionStatus: 'Clean' | 'Investigating' | 'Open' | 'Escalated to HOD' | 'Resolved' | 'Verifying';
  stateFlags: StateFlag[];
  assignee: { name: string; role: string } | null;
  escalations: EscalationEntry[];
  comments: CommentEntry[];
  chaseTimeline: ChaseEvent[];
  dependency: DependencyFork | null;
  executiveFlag: boolean;       // Solution Blueprint §2 Exception 4
  auditLedgerId: string;        // hashed-looking immutable ledger ref
  maintenanceWindow: string | null;
  timeToDetectMin: number | null;
  timeToEscalateMin: number | null;
  timeToResolveMin: number | null;
  resolvedBy: string | null;
  severity: Severity;
  riskScore: number;
  ledgerEntries: LedgerEntry[];
};

/** System → primary SPOC contact map (used by Analyst & History views) */
export const SYSTEM_SPOC_MAP: Record<string, { name: string; role: string; email: string; phone: string; teams: string }> = {
  'Core Banking':    { name: 'J. Chen',     role: 'Sr. Engineer · Core Banking SPOC', email: 'j.chen@gov.demo',     phone: '+1-555-0142', teams: '@jchen' },
  'Payment Gateway': { name: 'S. Kumar',    role: 'DevOps Manager · Payments SPOC',   email: 's.kumar@gov.demo',    phone: '+1-555-0188', teams: '@skumar' },
  'CRM':             { name: 'R. Thompson', role: 'IT Support Lead · CRM SPOC',       email: 'r.thompson@gov.demo', phone: '+1-555-0211', teams: '@rthompson' },
  'Document Cloud':  { name: 'K. Garcia',   role: 'Security Architect · DocCloud SPOC', email: 'k.garcia@gov.demo', phone: '+1-555-0247', teams: '@kgarcia' },
  'Data Warehouse':  { name: 'A. Williams', role: 'Risk Analyst · DWH SPOC',          email: 'a.williams@gov.demo', phone: '+1-555-0266', teams: '@awilliams' },
  'Auth Engine':     { name: 'M. Patel',    role: 'Compliance Lead · Auth SPOC',      email: 'm.patel@gov.demo',    phone: '+1-555-0299', teams: '@mpatel' },
};

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function pick<T>(rand: () => number, arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]; }

function fakeHash(rand: () => number, prefix = 'LDG') {
  let h = '';
  const chars = 'abcdef0123456789';
  for (let i = 0; i < 16; i++) h += chars[Math.floor(rand() * chars.length)];
  return `${prefix}-${h}`;
}

function makeChaseTimeline(rand: () => number, baseTs: Date, resolution: KPIRow['resolutionStatus'], dependency: boolean): ChaseEvent[] {
  const steps: ChaseStep[] = ['Generated', 'Notified'];
  if (resolution !== 'Open') steps.push('Acknowledged');
  if (resolution === 'Resolved') steps.push('Resolved', 'Verifying', 'Closed');
  else if (resolution === 'Verifying') steps.push('Resolved', 'Verifying');
  else if (resolution === 'Escalated to HOD') steps.push('Acknowledged');

  let t = baseTs.getTime();
  const events: ChaseEvent[] = [];
  steps.forEach((step, i) => {
    t += Math.floor(rand() * 30 + 5) * 60 * 1000;
    const actor = i === 0 ? 'System' : i === 1 ? 'Notifier Bot' : ASSIGNEES[Math.floor(rand() * ASSIGNEES.length)].name;
    events.push({ step, timestamp: new Date(t).toISOString(), actor: dependency && step === 'Acknowledged' ? `${actor} (+dependency fork)` : actor });
  });
  return events;
}

function pickRagState(rand: () => number): RagState {
  const r = rand();
  if (r < 0.78) return 'GREEN';
  if (r < 0.87) return 'AMBER';
  if (r < 0.93) return 'RED';
  if (r < 0.95) return 'GREY';
  if (r < 0.99) return 'BLUE';
  return 'UNCONFIGURED';
}

export function generateMockData(count = 30000): KPIRow[] {
  const rand = seeded(42);
  const rows: KPIRow[] = [];
  const baseDate = new Date(2026, 4, 14); // May 14, 2026

  // Pre-seed a Grey connector outage cluster (Blueprint §2 Exception 1)
  const greyOutageStart = new Date(baseDate.getTime() - 2 * 86400000);
  const greyOutageSystem = 'Payment Gateway';

  // Pre-seed a Blue maintenance window (Blueprint §2 / Layer 3 Blue state)
  const maintenanceWindowLabel = 'Core Banking quarterly patch — Sat 02:00–06:00';

  for (let i = 0; i < count; i++) {
    const hoursAgo = Math.floor(rand() * 90 * 24);
    const ts = new Date(baseDate.getTime() - hoursAgo * 3600000);
    const date = ts.toISOString().split('T')[0];
    const system = pick(rand, SYSTEMS);
    const process = pick(rand, PROCESSES);
    const source = pick(rand, SOURCES);
    const lob = pick(rand, LOBS);

    let ragState = pickRagState(rand);

    // Cluster the Grey outage on a specific system + window
    const inOutageWindow = Math.abs(ts.getTime() - greyOutageStart.getTime()) < 6 * 3600000;
    if (system === greyOutageSystem && inOutageWindow && rand() < 0.45) ragState = 'GREY';

    // Cluster Blue maintenance on Core Banking on Saturdays 02:00–06:00 UTC
    const isMaintWindow =
      system === 'Core Banking' && ts.getUTCDay() === 6 && ts.getUTCHours() >= 2 && ts.getUTCHours() < 6;
    if (isMaintWindow) ragState = 'BLUE';

    const baseVolume = Math.floor(rand() * 500000) + 1000;
    let breaches = 0;
    if (ragState === 'AMBER') breaches = Math.floor(rand() * 50) + 1;
    else if (ragState === 'RED') breaches = Math.floor(rand() * 1500) + 50;
    const failureRate = breaches === 0 ? 0 : parseFloat(((breaches / baseVolume) * 100).toFixed(4));
    const status: KPIRow['status'] = ragState === 'RED' || ragState === 'AMBER' ? 'BREACHED' : 'CLEAN';

    let severity: Severity = 'Low';
    if (ragState === 'RED') severity = failureRate > 1 ? 'Critical' : failureRate > 0.5 ? 'High' : 'Medium';
    else if (ragState === 'AMBER') severity = 'Medium';

    const riskScore = ragState === 'RED' ? Math.min(100, Math.round(40 + failureRate * 20))
                    : ragState === 'AMBER' ? Math.round(20 + failureRate * 10)
                    : ragState === 'GREY' ? 60 : 0;

    let resolutionStatus: KPIRow['resolutionStatus'] = 'Clean';
    let assignee: KPIRow['assignee'] = null;
    let escalations: EscalationEntry[] = [];
    let comments: CommentEntry[] = [];
    let dependency: DependencyFork | null = null;
    let executiveFlag = false;
    let timeToDetectMin: number | null = null;
    let timeToEscalateMin: number | null = null;
    let timeToResolveMin: number | null = null;
    let resolvedBy: string | null = null;

    const stateFlags: StateFlag[] = [];

    if (status === 'BREACHED') {
      const r = rand();
      resolutionStatus = r < 0.35 ? 'Resolved' : r < 0.55 ? 'Verifying' : r < 0.75 ? 'Investigating' : r < 0.9 ? 'Escalated to HOD' : 'Open';
      assignee = pick(rand, ASSIGNEES);
      timeToDetectMin = Math.floor(rand() * 120) + 1;

      if (resolutionStatus === 'Resolved' || resolutionStatus === 'Verifying') {
        timeToResolveMin = Math.floor(rand() * 2880) + 30;
        resolvedBy = pick(rand, ASSIGNEES).name;
      }
      if (resolutionStatus === 'Escalated to HOD') timeToEscalateMin = Math.floor(rand() * 480) + 15;

      // Acknowledged vs Unacknowledged
      stateFlags.push(resolutionStatus === 'Open' ? 'Unacknowledged' : 'Acknowledged');
      if (resolutionStatus === 'Escalated to HOD') stateFlags.push('Escalated');
      if (resolutionStatus === 'Verifying') stateFlags.push('Verifying');

      // ~2% of Red get cross-functional dependency forks
      if (ragState === 'RED' && rand() < 0.18) {
        dependency = {
          team: pick(rand, DEPENDENCY_TEAMS),
          timestamp: new Date(ts.getTime() + 45 * 60000).toISOString(),
          linkedId: `SUB-${10000 + Math.floor(rand() * 20000)}`,
          status: rand() < 0.5 ? 'open' : 'resolved',
        };
        stateFlags.push('Cross-Functional');
      }

      // ~0.5% of Red get Executive Flag stamp
      if (ragState === 'RED' && rand() < 0.05) {
        executiveFlag = true;
        stateFlags.push('Escalated');
      }

      // Escalations
      const numEsc = resolutionStatus === 'Escalated to HOD' ? Math.floor(rand() * 3) + 2 : Math.floor(rand() * 2);
      for (let e = 0; e < numEsc; e++) {
        const from = pick(rand, ASSIGNEES), to = pick(rand, ASSIGNEES);
        escalations.push({
          from: from.name, to: to.name,
          timestamp: new Date(ts.getTime() + (e + 1) * 30 * 60000).toISOString(),
          reason: pick(rand, ['SLA threshold exceeded', 'No response from assignee', 'Critical system impact', 'Regulatory deadline approaching']),
        });
      }

      // Comments
      const numCm = Math.floor(rand() * 4) + 1;
      for (let c = 0; c < numCm; c++) {
        const a = pick(rand, ASSIGNEES);
        comments.push({
          author: a.name, role: a.role,
          timestamp: new Date(ts.getTime() + c * 45 * 60000).toISOString(),
          text: `Initial triage completed. Root cause appears to be ${pick(rand, CAUSES)}.`,
        });
      }
    } else if (ragState === 'UNCONFIGURED') {
      stateFlags.push('Unconfigured');
    }

    const slaVersion = `SLA_v1.${Math.floor(rand() * 4)}`;
    const chaseTimeline = status === 'BREACHED'
      ? makeChaseTimeline(rand, ts, resolutionStatus, !!dependency)
      : [];

    rows.push({
      id: `KPI-${10000 + i}`,
      date,
      timestamp: ts.toISOString(),
      lob,
      system,
      process,
      source,
      baseVolume,
      breaches,
      failureRate,
      targetSLA: 0.05,
      slaVersion,
      ragState,
      status,
      resolutionStatus,
      stateFlags,
      assignee,
      escalations,
      comments,
      chaseTimeline,
      dependency,
      executiveFlag,
      auditLedgerId: fakeHash(rand),
      maintenanceWindow: ragState === 'BLUE' ? maintenanceWindowLabel : null,
      timeToDetectMin,
      timeToEscalateMin,
      timeToResolveMin,
      resolvedBy,
      severity,
      riskScore,
    });
  }

  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export const FILTER_OPTIONS = {
  LOBS: [...LOBS],
  SYSTEMS: [...SYSTEMS],
  PROCESSES: [...PROCESSES],
  SOURCES: [...SOURCES],
  RAG_STATES: ['GREEN', 'AMBER', 'RED', 'GREY', 'BLUE', 'UNCONFIGURED'] as RagState[],
  SEVERITIES: ['Critical', 'High', 'Medium', 'Low'] as Severity[],
  STATE_FLAGS: ['Acknowledged', 'Unacknowledged', 'Escalated', 'Cross-Functional', 'Verifying', 'Unconfigured'] as StateFlag[],
};

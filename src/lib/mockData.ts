// Governance KPI mock data — 5-state RAG, LoB, full incident lifecycle.
// Models the patterns described in Solution Blueprint §2 and Conceptual Design §3.3/§4.1.

export const LOBS = ['B2B', 'B2C', 'Wheels'] as const;
export type LoB = typeof LOBS[number];

const SYSTEMS = ['Core Banking', 'Payment Gateway', 'CRM', 'Document Cloud', 'Data Warehouse', 'Auth Engine'] as const;
const PROCESSES = ['KYC Verification', 'API Uptime', 'Ledger Sync', 'AML Screening', 'Ticket Routing', 'DB Backup'] as const;
const SOURCES = ['AppDynamics', 'Datadog', 'Splunk', 'New Relic'] as const;

export const ASSIGNEES = [
  { name: 'J. Chen',     role: 'Sr. Engineer',        phone: '+1-555-0142' },
  { name: 'M. Patel',    role: 'Compliance Lead',     phone: '+1-555-0299' },
  { name: 'S. Kumar',    role: 'DevOps Manager',      phone: '+1-555-0188' },
  { name: 'A. Williams', role: 'Risk Analyst',        phone: '+1-555-0266' },
  { name: 'R. Thompson', role: 'IT Support Lead',     phone: '+1-555-0211' },
  { name: 'K. Garcia',   role: 'Security Architect',  phone: '+1-555-0247' },
  { name: 'L. Zhang',    role: 'VP Engineering',      phone: '+1-555-0312' },
  { name: 'D. Okafor',   role: 'Head of Compliance',  phone: '+1-555-0334' },
  { name: 'P. Novak',    role: 'CTO',                 phone: '+1-555-0356' },
  { name: 'E. Santos',   role: 'Audit Manager',       phone: '+1-555-0378' },
];

/** Lookup phone number for any person displayed in the UI (assignees + SPOCs). */
export function getContactPhone(name: string | null | undefined): string | null {
  if (!name) return null;
  const clean = name.replace(/\s*\(.*?\)\s*$/, '').trim();
  const a = ASSIGNEES.find(x => x.name === clean);
  if (a) return a.phone;
  const s = Object.values(SYSTEM_SPOC_MAP).find(x => x.name === clean);
  return s?.phone ?? null;
}

const CAUSES = [
  'timeout in upstream service', 'database connection pool exhaustion',
  'certificate expiry', 'API rate limiting', 'memory leak in worker process',
  'misconfigured firewall rule', 'stale cache invalidation', 'disk I/O saturation',
];

const DEPENDENCY_TEAMS = ['Network Ops', 'Infrastructure', 'Database Admin', 'Security Eng', 'Cloud Platform'];

/** Five-state governance status per Blueprint §1 Layer 3 */
export type RagState = 'GREEN' | 'AMBER' | 'RED' | 'GREY' | 'BLUE' | 'UNCONFIGURED';

/** Short 3-letter labels — GRE collision between GREEN/GREY fixed: GRN vs GRY. */
export const RAG_SHORT: Record<RagState, string> = {
  GREEN: 'GRN',
  AMBER: 'AMB',
  RED:   'RED',
  GREY:  'GRY',
  BLUE:  'BLU',
  UNCONFIGURED: 'UNC',
};

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
export type DependencyFork = {
  team: string;
  timestamp: string;
  linkedId: string;
  status: 'open' | 'resolved';
  resolvedAt: string | null;        // ts when child sub-ticket closed
  resolvedBy: string | null;        // on-call actor on the child team
  cascadeDismissed: boolean;        // SPOC explicitly dismissed the auto-suggest banner
};
export type LedgerEntry = { timestamp: string; actor: string; action: string; hash: string; details?: string };

/** Per-KPI SLA version history — each KPI carries its own threshold trail. */
export type SlaVersionRecord = {
  version: string;
  activeFrom: string;
  changedBy: string;
  threshold: number;     // e.g. 0.05 = 5% failure-rate ceiling
  changeNote: string;
};


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
  slaVersion: string;      // SLA Configuration Vault version (Blueprint §1 Layer 3) — pointer to active record
  slaHistory: SlaVersionRecord[];  // per-KPI version trail, oldest → newest, last = currently active
  configSnapshotId: string;        // snapshot id (== slaVersion) active when this row was evaluated
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
  executiveFlagSetAt: string | null;  // ISO timestamp; auto-expires after 24h
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

function makeLedgerFromChase(
  rand: () => number,
  chase: ChaseEvent[],
  ragState: RagState,
  severity: Severity,
  assigneeName: string,
  dependency: boolean,
  executiveFlag: boolean,
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  chase.forEach((ev) => {
    const base = { timestamp: ev.timestamp, hash: fakeHash(rand, 'LDG') };
    switch (ev.step) {
      case 'Generated':
        entries.push({ ...base, actor: 'System', action: 'Ticket Generated', details: `RAG=${ragState} · sev=${severity}` });
        break;
      case 'Notified':
        if (/Dependency/i.test(ev.actor)) {
          entries.push({ ...base, actor: 'SPOC · System', action: 'Multi-Team Dependency ENABLED', details: ev.actor });
        } else if (/Executive reassign/i.test(ev.actor)) {
          entries.push({ ...base, actor: 'Executive', action: 'EXECUTIVE FLAG raised', details: 'SLA timer nullified · Level 2 escalation' });
          entries.push({ ...base, hash: fakeHash(rand, 'LDG'), actor: 'Executive', action: 'Reassigned by Executive', details: ev.actor.replace(/^Executive reassign → /, '→ ') });
        } else {
          entries.push({ ...base, actor: 'Notifier Bot', action: 'Notified', details: `SPOC=${assigneeName}` });
        }
        break;
      case 'Acknowledged':
        entries.push({ ...base, actor: `SPOC · ${ev.actor.replace(/ \(.*\)$/, '')}`, action: 'Acknowledged', details: dependency ? 'Chase timer halted · dependency fork open' : 'Chase timer halted' });
        break;
      case 'Resolved':
        entries.push({ ...base, actor: `SPOC · ${ev.actor}`, action: 'Resolution Deployed', details: 'RCA submitted · awaiting telemetry' });
        break;
      case 'Verifying':
        entries.push({ ...base, actor: 'System · Telemetry', action: 'Verifying Fix', details: 'Validation hold (3 polling cycles)' });
        break;
      case 'Closed':
        entries.push({ ...base, actor: 'System · Telemetry', action: 'Ticket Closed', details: 'RAG returned to GREEN' });
        break;
    }
  });
  if (executiveFlag && !entries.some(e => e.action.includes('EXECUTIVE'))) {
    entries.splice(1, 0, { timestamp: chase[0]?.timestamp ?? new Date().toISOString(), actor: 'Executive', action: 'EXECUTIVE FLAG raised', hash: fakeHash(rand, 'LDG'), details: 'SLA timer nullified · Level 2 escalation' });
  }
  return entries;
}

/** Per-system color bias so the System Health card looks realistically mixed instead of all-RED. */
const SYSTEM_BIAS: Record<string, { green: number; amber: number; red: number; grey: number; blue: number }> = {
  'Core Banking':    { green: 0.94, amber: 0.04, red: 0.005, grey: 0.005, blue: 0.008 },
  'Payment Gateway': { green: 0.90, amber: 0.06, red: 0.02,  grey: 0.015, blue: 0.003 },
  'CRM':             { green: 0.95, amber: 0.04, red: 0.005, grey: 0.003, blue: 0.000 },
  'Document Cloud':  { green: 0.84, amber: 0.12, red: 0.03,  grey: 0.005, blue: 0.003 },
  'Data Warehouse':  { green: 0.74, amber: 0.15, red: 0.09,  grey: 0.010, blue: 0.005 },
  'Auth Engine':     { green: 0.96, amber: 0.03, red: 0.005, grey: 0.003, blue: 0.000 },
};

/** Per-LoB stress multiplier on amber/red. Keeps B2C healthy, B2B mixed, Wheels the hot zone. */
const LOB_BIAS: Record<string, number> = { B2C: 0.35, B2B: 1.0, Wheels: 2.4 };

/** Per-process realistic daily volume bands (min, max). */
const PROCESS_VOLUME: Record<string, [number, number]> = {
  'KYC Verification': [5000, 25000],
  'API Uptime':       [50000, 200000],
  'Ledger Sync':      [2000, 8000],
  'AML Screening':    [8000, 40000],
  'Ticket Routing':   [1000, 5000],
  'DB Backup':        [100, 800],
};

function pickRagState(rand: () => number, system?: string, lob?: string): RagState {
  const b = (system && SYSTEM_BIAS[system]) || { green: 0.88, amber: 0.07, red: 0.03, grey: 0.01, blue: 0.008 };
  const m = (lob && LOB_BIAS[lob]) ?? 1;
  const amber = Math.min(0.45, b.amber * m);
  const red   = Math.min(0.35, b.red   * m);
  const grey  = b.grey;
  const blue  = b.blue;
  const unc   = 0.003;
  const green = Math.max(0, 1 - amber - red - grey - blue - unc);
  const r = rand();
  let acc = green;        if (r < acc) return 'GREEN';
  acc += amber;           if (r < acc) return 'AMBER';
  acc += red;             if (r < acc) return 'RED';
  acc += grey;            if (r < acc) return 'GREY';
  acc += blue;            if (r < acc) return 'BLUE';
  return 'UNCONFIGURED';
}

/** SLA escalation budget by severity (minutes). Mirrors utils.ESCALATE_BUDGET_MIN. */
const SEV_BUDGET_MIN: Record<string, number> = { Critical: 30, High: 60, Medium: 120, Low: 240 };

export function generateMockData(count = 30000): KPIRow[] {
  const rand = seeded(42);
  const rows: KPIRow[] = [];
  const baseDate = new Date(); // anchor to "now" so countdowns are realistic

  // Pre-seed a Grey connector outage cluster (Blueprint §2 Exception 1)
  const greyOutageStart = new Date(baseDate.getTime() - 2 * 86400000);
  const greyOutageSystem = 'Payment Gateway';

  // Pre-seed a Blue maintenance window (Blueprint §2 / Layer 3 Blue state)
  const maintenanceWindowLabel = 'Core Banking quarterly patch — Sat 02:00–06:00';

  for (let i = 0; i < count; i++) {
    const hoursAgo = Math.floor(rand() * 90 * 24);
    let ts = new Date(baseDate.getTime() - hoursAgo * 3600000);
    const date = ts.toISOString().split('T')[0];
    const system = pick(rand, SYSTEMS);
    const process = pick(rand, PROCESSES);
    const source = pick(rand, SOURCES);
    const lob = pick(rand, LOBS);

    let ragState = pickRagState(rand, system, lob);

    // Cluster the Grey outage on a specific system + window
    const inOutageWindow = Math.abs(ts.getTime() - greyOutageStart.getTime()) < 6 * 3600000;
    if (system === greyOutageSystem && inOutageWindow && rand() < 0.45) ragState = 'GREY';

    // Cluster Blue maintenance on Core Banking on Saturdays 02:00–06:00 UTC
    const isMaintWindow =
      system === 'Core Banking' && ts.getUTCDay() === 6 && ts.getUTCHours() >= 2 && ts.getUTCHours() < 6;
    if (isMaintWindow) ragState = 'BLUE';

    const volBand = PROCESS_VOLUME[process] ?? [1000, 10000];
    const baseVolume = Math.floor(rand() * (volBand[1] - volBand[0])) + volBand[0];
    let breaches = 0;
    if (ragState === 'AMBER') breaches = Math.floor(rand() * 20) + 1;       // 1–20 breaches
    else if (ragState === 'RED') breaches = Math.floor(rand() * 75) + 5;    // 5–80 breaches
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
      // Age-aware lifecycle:
      //   - Any breach older than 8h is force-closed (Resolved) — no stale "Investigating from 3 weeks ago".
      //   - Fresh breaches (< 8h) get a realistic open distribution.
      const ageHrs = (baseDate.getTime() - ts.getTime()) / 3600000;
      const r = rand();
      if (ageHrs > 8) {
        resolutionStatus = 'Resolved';
      } else {
        resolutionStatus = r < 0.30 ? 'Resolved'
                         : r < 0.55 ? 'Verifying'
                         : r < 0.78 ? 'Investigating'
                         : r < 0.92 ? 'Escalated to HOD'
                                    : 'Open';
      }
      assignee = pick(rand, ASSIGNEES);
      timeToDetectMin = Math.floor(rand() * 120) + 1;

      // Clamp open/unresolved breaches to within the SLA budget window so countdowns
      // show realistic numbers ("23m left", "OVERDUE · -12m") instead of "-13h 35m".
      const isOpen = resolutionStatus === 'Open' || resolutionStatus === 'Investigating'
        || resolutionStatus === 'Escalated to HOD' || resolutionStatus === 'Verifying';
      let budgetForRow = 120;
      if (isOpen) {
        const provisionalSev: Severity = ragState === 'RED'
          ? (failureRate > 1 ? 'Critical' : failureRate > 0.5 ? 'High' : 'Medium')
          : 'Medium';
        budgetForRow = SEV_BUDGET_MIN[provisionalSev] ?? 120;
        // Most rows still in budget; a minority overdue by a small amount.
        const ageMin = Math.floor(rand() * budgetForRow * 1.4);
        ts = new Date(baseDate.getTime() - ageMin * 60000);
      }

      if (resolutionStatus === 'Verifying') {
        // Verifying just deployed — keep "Time to Resolve" within one SLA budget.
        timeToResolveMin = Math.floor(rand() * budgetForRow) + 5;
        resolvedBy = pick(rand, ASSIGNEES).name;
      } else if (resolutionStatus === 'Resolved') {
        timeToResolveMin = Math.floor(rand() * 240) + 15;     // 15m–4h, realistic
        resolvedBy = pick(rand, ASSIGNEES).name;
      }
      if (resolutionStatus === 'Escalated to HOD') timeToEscalateMin = Math.floor(rand() * 60) + 15;

      // Acknowledged vs Unacknowledged
      stateFlags.push(resolutionStatus === 'Open' ? 'Unacknowledged' : 'Acknowledged');
      if (resolutionStatus === 'Escalated to HOD') stateFlags.push('Escalated');
      if (resolutionStatus === 'Verifying') stateFlags.push('Verifying');

      // ~2% of Red get cross-functional dependency forks
      if (ragState === 'RED' && rand() < 0.18) {
        const depTeam = pick(rand, DEPENDENCY_TEAMS);
        const depTs = new Date(ts.getTime() + 45 * 60000);
        const childResolved = rand() < 0.5;
        dependency = {
          team: depTeam,
          timestamp: depTs.toISOString(),
          linkedId: `SUB-${10000 + Math.floor(rand() * 20000)}`,
          status: childResolved ? 'resolved' : 'open',
          resolvedAt: childResolved
            ? new Date(depTs.getTime() + Math.floor(rand() * 3 + 1) * 3600 * 1000).toISOString()
            : null,
          resolvedBy: childResolved ? `${depTeam} on-call` : null,
          cascadeDismissed: false,
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

    const versionIdx = Math.floor(rand() * 4);
    const slaVersion = `SLA_v1.${versionIdx}`;
    // Build per-KPI lifetime SLA history — every prior version this KPI ran under.
    const slaHistory: SlaVersionRecord[] = [];
    const notes = ['Initial baseline', 'Tightened API latency 500→400ms', 'Added debounce 3m', 'Festival peak contextual profile'];
    const owners = ['M. Patel', 'L. Zhang', 'D. Okafor', 'S. Kumar'];
    for (let v = 0; v <= versionIdx; v++) {
      slaHistory.push({
        version: `SLA_v1.${v}`,
        activeFrom: `2026-0${v + 1}-01T00:00:00.000Z`,
        changedBy: owners[v % owners.length],
        threshold: parseFloat((0.08 - v * 0.01).toFixed(3)),
        changeNote: notes[v] ?? `Refinement v1.${v}`,
      });
    }
    // For non-Resolved/non-Clean breaches, anchor the chase timeline to "fresh"
    // (last event within the last 7h) so the drilldown's "Since Last Update"
    // never reads as days/weeks. Resolved rows keep their historical anchor.
    const isActiveBreach = status === 'BREACHED'
      && resolutionStatus !== 'Resolved';
    const chaseAnchor = isActiveBreach
      ? new Date(baseDate.getTime() - Math.floor(rand() * (7 * 60 - 5) + 5) * 60000)
      : ts;
    const chaseTimeline = status === 'BREACHED'
      ? makeChaseTimeline(rand, chaseAnchor, resolutionStatus, !!dependency)
      : [];

    // Executive Flag set-at: spread across the last 24h so auto-expiry is visible in demo
    const executiveFlagSetAt = executiveFlag
      ? new Date(baseDate.getTime() - Math.floor(rand() * 24 * 60) * 60000).toISOString()
      : null;

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
      slaHistory,
      configSnapshotId: slaVersion,
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
      executiveFlagSetAt,
      auditLedgerId: fakeHash(rand),
      maintenanceWindow: ragState === 'BLUE' ? maintenanceWindowLabel : null,
      timeToDetectMin,
      timeToEscalateMin,
      timeToResolveMin,
      resolvedBy,
      severity,
      riskScore,
      ledgerEntries: makeLedgerFromChase(rand, chaseTimeline, ragState, severity, assignee?.name ?? 'Unassigned', !!dependency, !!executiveFlag),
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

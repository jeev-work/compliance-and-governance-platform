// Robust mock data generator for 30,000 KPI rows with full audit trail

const DEPARTMENTS = ['Operations', 'Tech', 'Finance', 'Compliance', 'HR', 'Customer Service'];
const SYSTEMS = ['Core Banking', 'Payment Gateway', 'CRM', 'Document Cloud', 'Data Warehouse', 'Auth Engine'];
const PROCESSES = ['KYC Verification', 'API Uptime', 'Ledger Sync', 'AML Screening', 'Ticket Routing', 'DB Backup'];
const ASSIGNEES = [
  { name: 'J. Chen', role: 'Sr. Engineer', dept: 'Tech' },
  { name: 'M. Patel', role: 'Compliance Lead', dept: 'Compliance' },
  { name: 'S. Kumar', role: 'DevOps Manager', dept: 'Operations' },
  { name: 'A. Williams', role: 'Risk Analyst', dept: 'Finance' },
  { name: 'R. Thompson', role: 'IT Support Lead', dept: 'Tech' },
  { name: 'K. Garcia', role: 'Security Architect', dept: 'Tech' },
  { name: 'L. Zhang', role: 'VP Engineering', dept: 'Tech' },
  { name: 'D. Okafor', role: 'Head of Compliance', dept: 'Compliance' },
  { name: 'P. Novak', role: 'CTO', dept: 'Tech' },
  { name: 'E. Santos', role: 'Audit Manager', dept: 'Finance' },
];

const RESOLUTION_STATUSES = ['Investigating', 'Open', 'Escalated to HOD', 'Resolved'] as const;

const COMMENT_TEMPLATES = [
  'Initial triage completed. Root cause appears to be {cause}.',
  'Monitoring ongoing. No further escalation needed at this time.',
  'Escalated to {person} for review. High priority.',
  'Patch deployed in staging. Awaiting production rollout.',
  'Confirmed resolution. Post-mortem scheduled for next sprint.',
  'SLA breach confirmed. Initiating remediation protocol.',
  'Vendor notified. ETA for fix: {hours}h.',
  'Rollback initiated. Investigating regression in {system}.',
  'Duplicate of KPI-{id}. Linking incidents.',
  'Security review completed. No data exposure confirmed.',
];

const CAUSES = ['timeout in upstream service', 'database connection pool exhaustion', 'certificate expiry', 'API rate limiting', 'memory leak in worker process', 'misconfigured firewall rule', 'stale cache invalidation', 'disk I/O saturation'];

export type EscalationEntry = {
  from: string;
  to: string;
  timestamp: string;
  reason: string;
};

export type CommentEntry = {
  author: string;
  role: string;
  timestamp: string;
  text: string;
};

export type KPIRow = {
  id: string;
  date: string;
  department: string;
  system: string;
  process: string;
  baseVolume: number;
  breaches: number;
  failureRate: number;
  targetSLA: number;
  status: 'BREACHED' | 'CLEAN';
  resolutionStatus: 'Clean' | 'Investigating' | 'Open' | 'Escalated to HOD' | 'Resolved';
  assignee: typeof ASSIGNEES[number] | null;
  escalations: EscalationEntry[];
  comments: CommentEntry[];
  timeToDetectMin: number | null;
  timeToEscalateMin: number | null;
  timeToResolveMin: number | null;
  resolvedBy: string | null;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  riskScore: number;
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateComment(rand: () => number, dateBase: Date, system: string, id: number): CommentEntry {
  const assignee = ASSIGNEES[Math.floor(rand() * ASSIGNEES.length)];
  let text = COMMENT_TEMPLATES[Math.floor(rand() * COMMENT_TEMPLATES.length)];
  text = text.replace('{cause}', CAUSES[Math.floor(rand() * CAUSES.length)]);
  text = text.replace('{person}', ASSIGNEES[Math.floor(rand() * ASSIGNEES.length)].name);
  text = text.replace('{hours}', String(Math.floor(rand() * 48) + 1));
  text = text.replace('{system}', system);
  text = text.replace('{id}', String(10000 + Math.floor(rand() * 20000)));

  const offset = Math.floor(rand() * 72) * 60 * 60 * 1000;
  const ts = new Date(dateBase.getTime() + offset);

  return { author: assignee.name, role: assignee.role, timestamp: ts.toISOString(), text };
}

function generateEscalations(rand: () => number, dateBase: Date, count: number): EscalationEntry[] {
  const entries: EscalationEntry[] = [];
  const reasons = ['SLA threshold exceeded', 'No response from assignee', 'Critical system impact', 'Regulatory deadline approaching', 'Multiple related incidents detected'];
  let currentTime = dateBase.getTime();

  for (let i = 0; i < count; i++) {
    const from = ASSIGNEES[Math.floor(rand() * ASSIGNEES.length)];
    const to = ASSIGNEES[Math.floor(rand() * ASSIGNEES.length)];
    currentTime += Math.floor(rand() * 24 * 60) * 60 * 1000;
    entries.push({
      from: from.name,
      to: to.name,
      timestamp: new Date(currentTime).toISOString(),
      reason: reasons[Math.floor(rand() * reasons.length)],
    });
  }
  return entries;
}

export function generateMockData(count = 30000): KPIRow[] {
  const rand = seededRandom(42);
  const rows: KPIRow[] = [];
  const baseDate = new Date(2026, 3, 14); // April 14, 2026

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rand() * 90);
    const date = new Date(baseDate.getTime() - daysAgo * 86400000);
    const baseVolume = Math.floor(rand() * 500000) + 1000;
    const breaches = rand() > 0.2 ? 0 : Math.floor(rand() * 1500) + 1;
    const failureRate = breaches === 0 ? 0 : parseFloat(((breaches / baseVolume) * 100).toFixed(4));
    const status: KPIRow['status'] = breaches > 0 ? 'BREACHED' : 'CLEAN';
    const system = SYSTEMS[Math.floor(rand() * SYSTEMS.length)];

    let resolutionStatus: KPIRow['resolutionStatus'] = 'Clean';
    let assignee: KPIRow['assignee'] = null;
    let escalations: EscalationEntry[] = [];
    let comments: CommentEntry[] = [];
    let timeToDetectMin: number | null = null;
    let timeToEscalateMin: number | null = null;
    let timeToResolveMin: number | null = null;
    let resolvedBy: string | null = null;
    let severity: KPIRow['severity'] = 'Low';
    let riskScore = 0;

    if (breaches > 0) {
      resolutionStatus = RESOLUTION_STATUSES[Math.floor(rand() * 4)];
      assignee = ASSIGNEES[Math.floor(rand() * ASSIGNEES.length)];
      timeToDetectMin = Math.floor(rand() * 120) + 1;

      // Severity based on failure rate
      if (failureRate > 1) severity = 'Critical';
      else if (failureRate > 0.5) severity = 'High';
      else if (failureRate > 0.1) severity = 'Medium';
      else severity = 'Low';

      // Risk score (0-100)
      riskScore = Math.min(100, Math.round(failureRate * 20 + breaches * 0.05 + (severity === 'Critical' ? 40 : severity === 'High' ? 25 : severity === 'Medium' ? 10 : 0)));

      // Escalations
      const numEscalations = resolutionStatus === 'Escalated to HOD' ? Math.floor(rand() * 3) + 2 : resolutionStatus === 'Resolved' ? Math.floor(rand() * 2) + 1 : Math.floor(rand() * 2);
      escalations = generateEscalations(rand, date, numEscalations);
      if (numEscalations > 0) {
        timeToEscalateMin = Math.floor(rand() * 480) + 15;
      }

      // Comments
      const numComments = Math.floor(rand() * 5) + 1;
      for (let c = 0; c < numComments; c++) {
        comments.push(generateComment(rand, date, system, i));
      }
      comments.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      if (resolutionStatus === 'Resolved') {
        timeToResolveMin = Math.floor(rand() * 2880) + 30; // 30min to 48h
        resolvedBy = ASSIGNEES[Math.floor(rand() * ASSIGNEES.length)].name;
      }
    }

    rows.push({
      id: `KPI-${10000 + i}`,
      date: date.toISOString().split('T')[0],
      department: DEPARTMENTS[Math.floor(rand() * DEPARTMENTS.length)],
      system,
      process: PROCESSES[Math.floor(rand() * PROCESSES.length)],
      baseVolume,
      breaches,
      failureRate,
      targetSLA: 0.05,
      status,
      resolutionStatus,
      assignee,
      escalations,
      comments,
      timeToDetectMin,
      timeToEscalateMin,
      timeToResolveMin,
      resolvedBy,
      severity,
      riskScore,
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export const FILTER_OPTIONS = { DEPARTMENTS, SYSTEMS, PROCESSES };

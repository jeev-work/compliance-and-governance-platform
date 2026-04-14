// Robust mock data generator for 500+ KPI rows

const VERTICALS = ['Retail Banking', 'Wealth Management', 'Insurance', 'Capital Markets', 'Corporate Banking', 'Digital Payments'];
const SYSTEMS = ['CoreBanking v4', 'PaymentGateway', 'FraudEngine', 'CRM Platform', 'DataWarehouse', 'API Gateway', 'Identity Service', 'Reporting Engine', 'Mobile Backend', 'Cloud Infra'];
const PROCESSES = ['KYC Verification', 'Transaction Processing', 'Data Backup', 'Access Control', 'Incident Response', 'Change Management', 'Patch Compliance', 'SLA Monitoring', 'Audit Logging', 'Disaster Recovery'];
const CHECKPOINTS = ['Pre-validation', 'Execution', 'Post-validation', 'Reconciliation', 'Sign-off'];
const STATUSES = ['Compliant', 'Breach', 'Warning'] as const;

export type KPIRow = {
  id: number;
  date: string;
  vertical: string;
  system: string;
  process: string;
  checkpoint: string;
  baseVolume: number;
  breaches: number;
  failureRate: number;
  status: 'Compliant' | 'Breach' | 'Warning';
  resolvedAt: string | null;
  remediationStatus: 'Investigating' | 'Escalated' | 'Resolved' | null;
  assignee: string | null;
};

const ASSIGNEES = ['J. Chen', 'M. Patel', 'S. Kumar', 'A. Williams', 'R. Thompson', 'K. Garcia'];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function generateMockData(count = 600): KPIRow[] {
  const rand = seededRandom(42);
  const rows: KPIRow[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rand() * 90);
    const date = new Date(now - daysAgo * 86400000);
    const baseVolume = Math.floor(rand() * 5000) + 100;
    const breachChance = rand();
    let breaches = 0;
    let status: KPIRow['status'] = 'Compliant';

    if (breachChance > 0.75) {
      breaches = Math.floor(rand() * Math.min(baseVolume * 0.15, 200)) + 1;
      status = 'Breach';
    } else if (breachChance > 0.6) {
      breaches = Math.floor(rand() * 5) + 1;
      status = 'Warning';
    }

    const failureRate = baseVolume > 0 ? (breaches / baseVolume) * 100 : 0;

    let remediationStatus: KPIRow['remediationStatus'] = null;
    let resolvedAt: string | null = null;
    let assignee: string | null = null;

    if (status === 'Breach') {
      const r = rand();
      if (r > 0.6) {
        remediationStatus = 'Resolved';
        resolvedAt = new Date(date.getTime() + Math.floor(rand() * 5) * 86400000).toISOString().split('T')[0];
      } else if (r > 0.3) {
        remediationStatus = 'Escalated';
      } else {
        remediationStatus = 'Investigating';
      }
      assignee = ASSIGNEES[Math.floor(rand() * ASSIGNEES.length)];
    }

    rows.push({
      id: i + 1,
      date: date.toISOString().split('T')[0],
      vertical: VERTICALS[Math.floor(rand() * VERTICALS.length)],
      system: SYSTEMS[Math.floor(rand() * SYSTEMS.length)],
      process: PROCESSES[Math.floor(rand() * PROCESSES.length)],
      checkpoint: CHECKPOINTS[Math.floor(rand() * CHECKPOINTS.length)],
      baseVolume,
      breaches,
      failureRate: Math.round(failureRate * 100) / 100,
      status,
      resolvedAt,
      remediationStatus,
      assignee,
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export const FILTER_OPTIONS = { VERTICALS, SYSTEMS, PROCESSES };

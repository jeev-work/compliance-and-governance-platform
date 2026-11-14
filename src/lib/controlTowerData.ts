import { trustBandForScore } from '@/lib/trustScore';

export type ControlTowerGroup = 'service' | 'compliance' | 'platform' | 'data-quality';

export type ControlTowerAgent = {
  id: string;
  name: string;
  group: ControlTowerGroup;
  sourceType: 'Agent' | 'Platform';
  trustScore: number;
  band: 'GREEN' | 'AMBER' | 'RED';
};

const complianceNames = [
  'Tool Call & Privilege Monitoring Agent',
  'Continuous Monitoring Agent',
  'Change Intelligence Agent',
  'Evidence Agent',
  'Compliance Rule Agent',
  'Case Orchestration Agent',
  'Notification & Escalation Agent',
  'Agent Health Agent',
  'AI Pre-Production Assurance Agent',
  'Low-Risk Remediation Agent',
  'Investigation Agent',
  'Impact Analysis Agent',
  'Behaviour & Drift Agent',
  'Independent Challenge Agent',
  'Threat & Anomaly Agent',
  'Remediation & Rollback Agent',
  'Predictive Risk Agent',
  'Systemic Risk / Digital Twin Agent',
  'Network & Dependency Health Agent',
  'Anomaly & Dynamic Baseline Agent',
];

const platformNames = [
  'Continuous Monitoring Agent',
  'Change Intelligence Agent',
  'Evidence Agent',
  'Compliance Rule Agent',
  'Case Orchestration Agent',
  'Notification & Escalation Agent',
  'Investigation Agent',
  'Impact Analysis Agent',
  'Remediation & Rollback Agent',
  'Predictive Risk Agent',
  'Platform Onboarding Agent',
  'AI Agent Onboarding Governance Agent',
  'Internal Platform Monitoring Agent',
  'External Journey Monitoring Agent',
  'Network & Dependency Health Agent',
  'Storage Health & Capacity Agent',
  'Anomaly & Dynamic Baseline Agent',
  'Change Correlation Agent',
  'Breach Prediction Agent',
];

export const serviceAgentNames = [
  'Decision and exception control',
  'Relationship selection',
  'Repeat and reopen',
  'SLA recovery',
  'Entitlement decision',
  'Status and closure',
  'Authentication',
  'Authentication evidence',
  'Feedback and closure assurance',
  'Missing evidence',
  'Intent, type and subtype',
  'Case intake',
  'Channel normalization',
  'General fulfilment',
  'Change approval and recovery',
  'PwD fairness exception',
  'Consent and privacy',
  'Address update',
  'Mobile and email update',
  'KYC servicing',
  'Name and DOB correction',
  'Nominee and relationship',
  'Accessible service',
  'Propagation assurance',
  'Eligibility and recovery',
  'Contract copy',
  'Interest / tax certificate',
  'List of Documents / retention',
  'NOC',
  'Repayment schedule',
  'Statement of Account',
  'Secure delivery',
  'Output integrity',
  'Closure decision and exception',
  'Fraud-loss closure',
  'Matured and write-off closure',
  'Cancel and rebook',
  'Foreclosure quote',
  'Payment validation',
  'Knockoff and reversal',
  'Manual foreclosure',
  'Part payment',
  'Settlement closure',
  'Eligibility, approval and recovery',
  'Approval validation',
  'Reparation / compensation',
  'Refund recovery',
  'Unidentified payment',
  'Charge waiver',
  'EMI card',
  'Excess money',
  'Receipt posting',
  'Refund calculation',
  'Refund execution',
  'Resolution decision and exception',
  'Data privacy grievance',
  'GRO',
  'Internal Ombudsman',
  'PNO',
  'Investigation',
  'Complaint intake',
  'RBI CMS / CPGRAMS / NCH',
  'Social media complaint',
  'CRCR / RCA / CAPA',
  'CAPA',
  'Channel/content decision and exception',
  'Content compliance',
  'Proactive service',
  'Campaign lifecycle',
  'Pre-release test',
  'Template rendering',
  'Template whitelisting',
  'Language and accessible content',
  'Autonomous resolution',
  'Response assurance',
  'Agent-assisted resolution',
  'DMS decision and exception',
  'DMS L2 and escalations',
  'Restructuring',
  'Death claim insurance',
  'Mandate curing',
  'Mandate document check',
  'Pre-banking counselling',
  'PBC eligibility',
  'Campaign allocation',
  'Counselling outcome',
  'Moratorium servicing',
  'Branch decision and exception',
  'Cash and AML control',
  'Cash/cheque/DD receipt',
  'Cash reconciliation',
  'Walk-in resolution',
  'Document acceptance',
  'Token and queue',
  'Correction decision and recovery',
  'Delayed correction compensation',
  'Enquiry dispute',
  'Loan detail/status correction',
  'Account verification',
  'Bureau case intake',
  'CIC correction submission',
  'Control decision and recovery',
  'Dummy LAN governance',
  'Learning and prevention',
  'SOP-to-agent governance',
  'Outcome QA',
  'Performance and capacity',
  'Outcome and effort',
  'Daily app/web journey audit',
  'Journey probe',
  'Cross-system service reconciliation',
  'SLA and statutory clock',
];

export const dataQualityNames = [
  'Accuracy & Anomaly Agent',
  'Column-Level Data Quality Agent',
  'Data Drift and Anomaly Agent',
  'Data Remediation Agent',
  'Independent Data Validation Agent',
  'Ingestion & Schema Agent',
  'Lineage Agent',
  'Pipeline Discovery and Onboarding Agent',
  'Pipeline Remediation Agent',
  'Pipeline Root-Cause Agent',
  'Real-Time Pipeline Execution Agent',
  'Reconciliation Agent',
  'Data Integrity Agent',
  'Schema and Data Contract Agent',
  'Standardisation Agent',
  'Streaming Flow and Latency Agent',
];

const weightedTrustScore = (index: number, groupOffset: number) => {
  const dimensions = [
    { weight: 10, score: 52 + ((index * 13 + groupOffset) % 49) },
    { weight: 15, score: 50 + ((index * 7 + groupOffset * 2) % 51) },
    { weight: 20, score: 48 + ((index * 11 + groupOffset * 3) % 53) },
    { weight: 15, score: 55 + ((index * 17 + groupOffset) % 46) },
    { weight: 30, score: 50 + ((index * 19 + groupOffset * 2) % 51) },
    { weight: 10, score: 54 + ((index * 23 + groupOffset * 3) % 47) },
  ];
  return Math.round(dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / 100);
};

const redAgentIds = new Set(['compliance-1', 'platform-1']);
const amberAgentScores: Record<string, number> = {
  'service-2': 94,
  'service-14': 93,
  'service-31': 92,
  'service-54': 90,
  'compliance-2': 90,
  'compliance-3': 91,
  'platform-2': 92,
  'platform-3': 93,
  'data-quality-1': 94,
  'data-quality-2': 90,
};

const toRows = (names: string[], group: ControlTowerGroup, sourceType: 'Agent' | 'Platform', offset: number) =>
  names.map((name, index): ControlTowerAgent => {
    const id = `${group}-${index + 1}`;
    const trustScore = redAgentIds.has(id)
      ? 54 + index * 2
      : amberAgentScores[id] ?? Math.max(95, weightedTrustScore(index, offset));
    return {
      id,
      name,
      group,
      sourceType,
      trustScore,
      band: trustBandForScore(trustScore),
    };
  });

/** All scores are seeded demo indicators, not live agent execution evidence. */
export const CONTROL_TOWER_AGENTS: ControlTowerAgent[] = [
  ...toRows(serviceAgentNames, 'service', 'Agent', 41),
  ...toRows(complianceNames, 'compliance', 'Agent', 5),
  ...toRows(platformNames, 'platform', 'Platform', 17),
  ...toRows(dataQualityNames, 'data-quality', 'Agent', 29),
];

export function randomPlatformHealth(random: () => number = Math.random): number {
  return 85 + Math.floor(Math.min(0.999999, Math.max(0, random())) * 15);
}

export const SERVICE_PROCESSES = [
  { name: 'Charge clarification', owner: 'Operations', health: 98 },
  { name: 'Statement of account', owner: 'Service', health: 72 },
  { name: 'Refund of excess payment', owner: 'Operations', health: 96 },
  { name: 'EMI clearance status', owner: 'Service', health: 94 },
  { name: 'Adhoc Payment', owner: 'Operations', health: 97 },
  { name: 'Demog change request', owner: 'Service', health: 95 },
  { name: 'Mandate status check', owner: 'Service', health: 99 },
  { name: 'EMI card services', owner: 'Operations', health: 93 },
  { name: 'Communication address update', owner: 'Service', health: 97 },
  { name: 'KYC update', owner: 'Operations', health: 96 },
];
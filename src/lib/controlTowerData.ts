export type ControlTowerGroup = 'compliance' | 'platform' | 'data-quality';

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

const toRows = (names: string[], group: ControlTowerGroup, sourceType: 'Agent' | 'Platform', offset: number) =>
  names.map((name, index): ControlTowerAgent => {
    const trustScore = [0, 1, 2, 3].includes(index) ? 52 + index * 2 : weightedTrustScore(index, offset);
    return {
      id: `${group}-${index + 1}`,
      name,
      group,
      sourceType,
      trustScore,
      band: trustScore >= 80 ? 'GREEN' : trustScore >= 60 ? 'AMBER' : 'RED',
    };
  });

/** All scores are seeded demo indicators, not live agent execution evidence. */
export const CONTROL_TOWER_AGENTS: ControlTowerAgent[] = [
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
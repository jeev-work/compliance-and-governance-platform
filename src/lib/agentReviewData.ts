import type { KPIRow } from '@/lib/mockData';

export type AgentSignal = 'proxy' | 'not-instrumented';

export type AgentDefinition = {
  id: number;
  name: string;
  description: string;
  signal: AgentSignal;
  signalNote: string;
  includes: (row: KPIRow) => boolean;
};

const hasLedgerAction = (row: KPIRow, pattern: RegExp) => row.ledgerEntries.some(entry => pattern.test(entry.action));
const hasChaseStep = (row: KPIRow, step: string) => row.chaseTimeline.some(event => event.step === step);
const incidentRecord = (row: KPIRow) => row.status === 'BREACHED' || row.chaseTimeline.length > 0 || hasLedgerAction(row, /Ticket Generated|Ticket Closed/i);
const unavailable = (note: string): Pick<AgentDefinition, 'signal' | 'signalNote' | 'includes'> => ({
  signal: 'not-instrumented',
  signalNote: note,
  includes: () => false,
});

/** Canonical role catalogue from the supplied agent table; included fields are platform-data proxies, not agent-run telemetry. */
export const AGENT_CATALOG: AgentDefinition[] = [
  { id: 1, name: 'Continuous Monitoring Agent', description: 'Continuously monitors platform controls, transactions, events, APIs and configured thresholds', signal: 'proxy', signalNote: 'KPI state and breach records', includes: () => true },
  { id: 2, name: 'Change Intelligence Agent', description: 'Watches application releases, configuration changes, APIs, business-rule changes and infrastructure changes', signal: 'proxy', signalNote: 'Per-KPI SLA history and configuration-change ledger entries', includes: row => row.slaHistory.length > 1 || hasLedgerAction(row, /Config Switched|Config File Added/i) },
  { id: 3, name: 'Evidence Agent', description: 'Automatically collects, packages and links compliance evidence to each control result or case', signal: 'proxy', signalNote: 'KPI ledger and chase evidence availability', includes: row => row.ledgerEntries.length > 0 || row.chaseTimeline.length > 0 },
  { id: 4, name: 'Compliance Rule Agent', description: 'Converts approved control logic into executable monitoring/test rules and identifies rule gaps', signal: 'proxy', signalNote: 'Configured KPI thresholds and SLA version records', includes: row => row.slaHistory.length > 0 && row.targetSLA > 0 },
  { id: 5, name: 'Case Orchestration Agent', description: 'Creates cases, assigns owners, coordinates actions and maintains the case timeline', signal: 'proxy', signalNote: 'Incident, assignment, and chase-timeline records', includes: incidentRecord },
  { id: 6, name: 'Notification & Escalation Agent', description: 'Sends alerts, reminders and SLA-based escalations to Compliance, IT and Business', signal: 'proxy', signalNote: 'Notification chase events and escalation records', includes: row => hasChaseStep(row, 'Notified') || row.escalations.length > 0 },
  { id: 7, name: 'Agent Health Agent', description: 'Monitors AI Agent availability, errors, latency, quality, guardrails and runtime health', ...unavailable('No agent runtime availability, latency, or error feed exists in the current demo data.') },
  { id: 8, name: 'AI Pre-Production Assurance Agent', description: 'Tests new AI Agents before production against approved security, compliance, tool and behavioral requirements', ...unavailable('Pre-production test results are not represented in the current KPI records.') },
  { id: 9, name: 'Low-Risk Remediation Agent', description: 'Performs approved reversible low-risk fixes and verifies the result', signal: 'proxy', signalNote: 'Resolution-deployment and verification ledger events', includes: row => hasLedgerAction(row, /Resolution Deployed|Verifying Fix|Ticket Closed/i) || row.resolutionStatus === 'Verifying' || row.resolutionStatus === 'Resolved' },
  { id: 10, name: 'Investigation Agent', description: 'Correlates evidence and develops likely root-cause hypotheses', signal: 'proxy', signalNote: 'Investigation comments and in-progress cases', includes: row => row.comments.length > 0 || row.resolutionStatus === 'Investigating' },
  { id: 11, name: 'Impact Analysis Agent', description: 'Estimates affected customers, transactions, products, journeys, platforms and periods', signal: 'proxy', signalNote: 'KPI impact tier, volume, LoB, and system dimensions', includes: () => true },
  { id: 12, name: 'Tool Call & Privilege Monitoring Agent', description: 'Supervises what other Agents are accessing, calling and changing', ...unavailable('Tool-call and privilege audit records are not represented in this demo data.') },
  { id: 13, name: 'Behaviour & Drift Agent', description: 'Detects unusual Agent behavior, decision patterns, tool usage and performance drift', ...unavailable('Agent decision, tool-use, and drift telemetry is not represented in this demo data.') },
  { id: 14, name: 'Independent Challenge Agent', description: "Independently challenges another Agent's conclusion, evidence and remediation", ...unavailable('Independent challenge outcomes are not represented in this demo data.') },
  { id: 15, name: 'Threat & Anomaly Agent', description: 'Identifies suspicious behavior, prompt attacks, abnormal access and cross-agent threats', signal: 'proxy', signalNote: 'RED/GREY KPI states are risk-state proxies only, not threat detections', includes: row => row.ragState === 'RED' || row.ragState === 'GREY' },
  { id: 16, name: 'Remediation & Rollback Agent', description: 'Executes approved low/medium-risk playbooks and automatically rolls back unsuccessful changes', signal: 'proxy', signalNote: 'Resolution, verification, and closure evidence', includes: row => row.resolutionStatus === 'Verifying' || row.resolutionStatus === 'Resolved' || hasLedgerAction(row, /Resolution Deployed|Ticket Closed/i) },
  { id: 17, name: 'Predictive Risk Agent', description: 'Predicts control or Agent failures before a breach occurs', signal: 'proxy', signalNote: 'Current AMBER/RED risk-state proxy only; no predictive model output is available', includes: row => row.ragState === 'AMBER' || row.ragState === 'RED' || row.riskScore >= 40 },
  { id: 18, name: 'Systemic Risk / Digital Twin Agent', description: 'Detects cross-platform and cross-Agent risks using the enterprise compliance digital twin', ...unavailable('Cross-platform dependency graph and digital-twin findings are not represented in this demo data.') },
];

export type AgentReviewRow = {
  agent: AgentDefinition;
  records: KPIRow[];
  incidentCount: number;
  activeExceptions: number;
  resolvedIncidents: number;
  ledgerEvents: number;
  recordsWithLedger: number;
  configuredRecords: number;
  notifiedRecords: number;
};

export const TRUST_EVALUATION_DIMENSIONS = [
  { key: 'health', label: 'Agent health', weight: 10 },
  { key: 'performanceQuality', label: 'Performance quality', weight: 15 },
  { key: 'behaviorDrift', label: 'Behavior & drift', weight: 20 },
  { key: 'accessToolControl', label: 'Access & tool control', weight: 15 },
  { key: 'complianceRisk', label: 'Compliance & risk', weight: 30 },
  { key: 'governanceAuditability', label: 'Governance & auditability', weight: 10 },
] as const;

export type TrustDimensionKey = typeof TRUST_EVALUATION_DIMENSIONS[number]['key'];
export type TrustBand = 'GREEN' | 'AMBER' | 'RED' | 'UNSCORED';

export type AgentTrustEvaluation = {
  scores: Record<TrustDimensionKey, number | null>;
  trustScore: number | null;
  evidenceCoverage: number;
  band: TrustBand;
};

export type AgentReviewSortKey = 'agent' | TrustDimensionKey | 'trustScore';
export type SortDirection = 'asc' | 'desc';

/** Deterministic simulated telemetry supports demo scoring; it is not a live runtime feed. */
export const AGENT_DEMO_TELEMETRY: Record<number, Record<TrustDimensionKey, number>> = {
  1: { health: 96, performanceQuality: 90, behaviorDrift: 88, accessToolControl: 93, complianceRisk: 94, governanceAuditability: 97 },
  2: { health: 91, performanceQuality: 88, behaviorDrift: 85, accessToolControl: 90, complianceRisk: 90, governanceAuditability: 92 },
  3: { health: 95, performanceQuality: 91, behaviorDrift: 90, accessToolControl: 85, complianceRisk: 92, governanceAuditability: 95 },
  4: { health: 86, performanceQuality: 84, behaviorDrift: 82, accessToolControl: 88, complianceRisk: 85, governanceAuditability: 90 },
  5: { health: 88, performanceQuality: 82, behaviorDrift: 84, accessToolControl: 80, complianceRisk: 86, governanceAuditability: 88 },
  6: { health: 82, performanceQuality: 78, behaviorDrift: 80, accessToolControl: 83, complianceRisk: 79, governanceAuditability: 85 },
  7: { health: 38, performanceQuality: 45, behaviorDrift: 40, accessToolControl: 42, complianceRisk: 55, governanceAuditability: 50 },
  8: { health: 92, performanceQuality: 90, behaviorDrift: 86, accessToolControl: 89, complianceRisk: 91, governanceAuditability: 94 },
  9: { health: 84, performanceQuality: 86, behaviorDrift: 81, accessToolControl: 78, complianceRisk: 82, governanceAuditability: 85 },
  10: { health: 80, performanceQuality: 77, behaviorDrift: 75, accessToolControl: 82, complianceRisk: 78, governanceAuditability: 80 },
  11: { health: 89, performanceQuality: 92, behaviorDrift: 88, accessToolControl: 90, complianceRisk: 91, governanceAuditability: 87 },
  12: { health: 35, performanceQuality: 40, behaviorDrift: 45, accessToolControl: 38, complianceRisk: 42, governanceAuditability: 50 },
  13: { health: 42, performanceQuality: 48, behaviorDrift: 35, accessToolControl: 50, complianceRisk: 46, governanceAuditability: 52 },
  14: { health: 78, performanceQuality: 74, behaviorDrift: 77, accessToolControl: 79, complianceRisk: 75, governanceAuditability: 82 },
  15: { health: 81, performanceQuality: 76, behaviorDrift: 79, accessToolControl: 72, complianceRisk: 74, governanceAuditability: 80 },
  16: { health: 86, performanceQuality: 80, behaviorDrift: 82, accessToolControl: 84, complianceRisk: 82, governanceAuditability: 85 },
  17: { health: 73, performanceQuality: 70, behaviorDrift: 75, accessToolControl: 77, complianceRisk: 69, governanceAuditability: 76 },
  18: { health: 80, performanceQuality: 82, behaviorDrift: 78, accessToolControl: 80, complianceRisk: 77, governanceAuditability: 84 },
};

/** Scores use the seeded demo telemetry across all dimensions; they do not imply live agent execution. */
export function evaluateAgentTrust(row: AgentReviewRow): AgentTrustEvaluation {
  const scores: Record<TrustDimensionKey, number | null> = AGENT_DEMO_TELEMETRY[row.agent.id] ?? {
    health: null,
    performanceQuality: null,
    behaviorDrift: null,
    accessToolControl: null,
    complianceRisk: null,
    governanceAuditability: null,
  };

  const scoredDimensions = TRUST_EVALUATION_DIMENSIONS.filter(({ key }) => scores[key] != null);
  const evidenceCoverage = scoredDimensions.reduce((total, dimension) => total + dimension.weight, 0);
  const trustScore = evidenceCoverage > 0
    ? Math.round(scoredDimensions.reduce((total, dimension) => total + (scores[dimension.key] ?? 0) * dimension.weight, 0) / evidenceCoverage)
    : null;

  return {
    scores,
    trustScore,
    evidenceCoverage,
    band: trustScore == null ? 'UNSCORED' : trustScore >= 80 ? 'GREEN' : trustScore >= 60 ? 'AMBER' : 'RED',
  };
}

export function buildAgentReviewRows(data: KPIRow[]): AgentReviewRow[] {
  return AGENT_CATALOG.map(agent => {
    const records = agent.signal === 'proxy' ? data.filter(agent.includes) : [];
    const incidents = records.filter(incidentRecord);
    return {
      agent,
      records,
      incidentCount: incidents.length,
      activeExceptions: incidents.filter(row => row.resolutionStatus !== 'Resolved' && row.resolutionStatus !== 'Clean').length,
      resolvedIncidents: incidents.filter(row => row.resolutionStatus === 'Resolved' || row.resolutionStatus === 'Clean').length,
      ledgerEvents: records.reduce((total, row) => total + row.ledgerEntries.length, 0),
      recordsWithLedger: records.filter(row => row.ledgerEntries.length > 0).length,
      configuredRecords: records.filter(row => row.ragState !== 'UNCONFIGURED' && row.slaHistory.length > 0 && row.targetSLA > 0).length,
      notifiedRecords: records.filter(row => hasChaseStep(row, 'Notified')).length,
    };
  });
}

export function rankAgentReviewRows(rows: AgentReviewRow[]): AgentReviewRow[] {
  return [...rows].sort((a, b) => {
    const evaluationA = evaluateAgentTrust(a);
    const evaluationB = evaluateAgentTrust(b);
    const bandPriority = { RED: 0, AMBER: 1, GREEN: 2, UNSCORED: 3 };
    const bandDifference = bandPriority[evaluationA.band] - bandPriority[evaluationB.band];
    if (bandDifference !== 0) return bandDifference;

    const scoreA = evaluationA.trustScore;
    const scoreB = evaluationB.trustScore;
    if (scoreA == null && scoreB == null) return a.agent.id - b.agent.id;
    if (scoreA == null) return 1;
    if (scoreB == null) return -1;
    return scoreB - scoreA || a.agent.id - b.agent.id;
  });
}

/** Sorts an agent register column while keeping unscored values at the bottom. */
export function sortAgentReviewRows(rows: AgentReviewRow[], key: AgentReviewSortKey, direction: SortDirection): AgentReviewRow[] {
  return [...rows].sort((a, b) => {
    const evaluationA = evaluateAgentTrust(a);
    const evaluationB = evaluateAgentTrust(b);
    const valueA = key === 'agent' ? a.agent.name : key === 'trustScore' ? evaluationA.trustScore : evaluationA.scores[key];
    const valueB = key === 'agent' ? b.agent.name : key === 'trustScore' ? evaluationB.trustScore : evaluationB.scores[key];

    if (valueA == null && valueB == null) return a.agent.id - b.agent.id;
    if (valueA == null) return 1;
    if (valueB == null) return -1;

    const comparison = typeof valueA === 'string' && typeof valueB === 'string'
      ? valueA.localeCompare(valueB)
      : Number(valueA) - Number(valueB);
    if (comparison !== 0) return direction === 'asc' ? comparison : -comparison;
    return a.agent.id - b.agent.id;
  });
}

export function summarizeAgentReview(rows: AgentReviewRow[]) {
  const observed = rows.filter(row => row.agent.signal === 'proxy');
  // Agent work scopes overlap by design; portfolio-level totals must count a KPI once.
  const portfolio = rows.find(row => row.agent.id === 1)?.records ?? [];
  const incidents = portfolio.filter(incidentRecord);
  return {
    modeledAgents: AGENT_CATALOG.length,
    observedAgents: observed.length,
    notInstrumentedAgents: AGENT_CATALOG.length - observed.length,
    activeExceptions: incidents.filter(row => row.resolutionStatus !== 'Resolved' && row.resolutionStatus !== 'Clean').length,
    incidentRecords: incidents.length,
    resolvedIncidents: incidents.filter(row => row.resolutionStatus === 'Resolved' || row.resolutionStatus === 'Clean').length,
    ledgerEvents: portfolio.reduce((sum, row) => sum + row.ledgerEntries.length, 0),
    configuredRecords: portfolio.filter(row => row.ragState !== 'UNCONFIGURED' && row.slaHistory.length > 0 && row.targetSLA > 0).length,
  };
}
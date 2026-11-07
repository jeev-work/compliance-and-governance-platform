import { describe, expect, it } from 'vitest';
import type { KPIRow } from '@/lib/mockData';
import { buildAgentReviewRows, evaluateAgentTrust, rankAgentReviewRows, summarizeAgentReview, TRUST_EVALUATION_DIMENSIONS } from '@/lib/agentReviewData';

function makeRow(overrides: Partial<KPIRow> = {}): KPIRow {
  return {
    id: 'KPI-101', date: '2026-11-06', timestamp: '2026-11-06T12:00:00.000Z',
    lob: 'B2B', system: 'Core Banking', process: 'API Uptime', source: 'Datadog',
    baseVolume: 1000, breaches: 12, failureRate: 1.2, targetSLA: 0.05,
    slaVersion: 'SLA_v1.0', slaHistory: [{ version: 'SLA_v1.0', activeFrom: '2026-11-01T00:00:00.000Z', changedBy: 'Admin', threshold: 0.05, changeNote: 'Initial' }],
    configSnapshotId: 'SLA_v1.0', ragState: 'RED', status: 'BREACHED', resolutionStatus: 'Open',
    stateFlags: ['Unacknowledged'], assignee: { name: 'J. Chen', role: 'Engineer' },
    escalations: [], comments: [], chaseTimeline: [
      { step: 'Generated', timestamp: '2026-11-06T11:00:00.000Z', actor: 'System' },
      { step: 'Notified', timestamp: '2026-11-06T11:01:00.000Z', actor: 'Notifier Bot' },
    ],
    dependency: null, executiveFlag: false, executiveFlagSetAt: null,
    auditLedgerId: 'LDG-1', maintenanceWindow: null,
    timeToDetectMin: 1, timeToEscalateMin: null, timeToResolveMin: null, resolvedBy: null,
    severity: 'High', impactTier: 'T1', urgencyScore: 2, riskScore: 70,
    ledgerEntries: [
      { timestamp: '2026-11-06T11:00:00.000Z', actor: 'System', action: 'Ticket Generated', hash: 'LDG-a' },
      { timestamp: '2026-11-06T11:01:00.000Z', actor: 'Notifier Bot', action: 'Notified', hash: 'LDG-b' },
    ],
    ...overrides,
  };
}

describe('agent review aggregation', () => {
  it('counts notification and ledger proxies for in-scope KPI records', () => {
    const row = makeRow();
    const rows = buildAgentReviewRows([row]);

    expect(rows.find(item => item.agent.id === 1)?.records.length).toBe(1);
    expect(rows.find(item => item.agent.id === 6)?.notifiedRecords).toBe(1);
    expect(rows.find(item => item.agent.id === 3)?.ledgerEvents).toBe(2);
  });

  it('does not report active exceptions for a resolved historical ticket', () => {
    const resolved = makeRow({ status: 'CLEAN', resolutionStatus: 'Resolved', ragState: 'GREEN', breaches: 0 });
    const rows = buildAgentReviewRows([resolved]);
    const summary = summarizeAgentReview(rows);

    expect(summary.incidentRecords).toBe(1);
    expect(summary.activeExceptions).toBe(0);
    expect(summary.resolvedIncidents).toBe(1);
  });

  it('marks agents without runtime evidence as not instrumented', () => {
    const rows = buildAgentReviewRows([makeRow()]);
    const healthAgent = rows.find(item => item.agent.id === 7);
    const summary = summarizeAgentReview(rows);

    expect(healthAgent?.agent.signal).toBe('not-instrumented');
    expect(healthAgent?.records).toHaveLength(0);
    expect(summary.notInstrumentedAgents).toBe(6);
  });

  it('counts unique portfolio incidents once in the review summary', () => {
    const row = makeRow();
    const summary = summarizeAgentReview(buildAgentReviewRows([row]));

    expect(summary.incidentRecords).toBe(1);
    expect(summary.activeExceptions).toBe(1);
    expect(summary.ledgerEvents).toBe(2);
  });

  it('excludes unconfigured controls from configuration coverage', () => {
    const unconfigured = makeRow({ ragState: 'UNCONFIGURED', status: 'CLEAN', resolutionStatus: 'Clean' });
    const summary = summarizeAgentReview(buildAgentReviewRows([unconfigured]));

    expect(summary.configuredRecords).toBe(0);
  });

  it('uses seeded demo telemetry across all weighted trust dimensions', () => {
    expect(TRUST_EVALUATION_DIMENSIONS.reduce((total, item) => total + item.weight, 0)).toBe(100);

    const row = buildAgentReviewRows([makeRow()]).find(item => item.agent.id === 1);
    if (!row) throw new Error('Continuous Monitoring Agent row was not built');
    const evaluation = evaluateAgentTrust(row);

    expect(evaluation.evidenceCoverage).toBe(100);
    expect(evaluation.scores.performanceQuality).toBe(90);
    expect(evaluation.scores.complianceRisk).toBe(94);
    expect(evaluation.scores.governanceAuditability).toBe(97);
    expect(evaluation.scores.health).toBe(96);
    expect(evaluation.scores.behaviorDrift).toBe(88);
    expect(evaluation.scores.accessToolControl).toBe(93);
    expect(evaluation.trustScore).toBe(93);
    expect(evaluation.band).toBe('GREEN');
  });

  it('seeds exactly three red trust scores across all 18 agents', () => {
    const rows = buildAgentReviewRows([]);
    const redRows = rows.filter(row => evaluateAgentTrust(row).band === 'RED');

    expect(rows).toHaveLength(18);
    expect(redRows.map(row => row.agent.id).sort((a, b) => a - b)).toEqual([7, 12, 13]);
  });

  it('ranks scored agents by descending trust score and keeps ties stable', () => {
    const ranked = rankAgentReviewRows(buildAgentReviewRows([]));
    const scores = ranked.map(row => evaluateAgentTrust(row).trustScore ?? -1);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(ranked.slice(-3).map(row => row.agent.id)).toEqual([13, 12, 7]);
  });
});
import { describe, expect, it } from 'vitest';
import type { KPIRow } from '@/lib/mockData';
import { buildAgentReviewRows, summarizeAgentReview } from '@/lib/agentReviewData';

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
});
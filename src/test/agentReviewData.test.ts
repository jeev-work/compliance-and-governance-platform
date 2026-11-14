import { describe, expect, it } from 'vitest';
import type { KPIRow } from '@/lib/mockData';
import { buildAgentReviewRows, evaluateAgentTrust, rankAgentReviewRows, sortAgentReviewRows, summarizeAgentReview, TRUST_EVALUATION_DIMENSIONS, type AgentReviewSortKey } from '@/lib/agentReviewData';
import { trustBandForScore } from '@/lib/trustScore';

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
    expect(evaluation.scores.performanceQuality).toBe(96);
    expect(evaluation.scores.complianceRisk).toBe(96);
    expect(evaluation.scores.governanceAuditability).toBe(97);
    expect(evaluation.scores.health).toBe(97);
    expect(evaluation.scores.behaviorDrift).toBe(95);
    expect(evaluation.scores.accessToolControl).toBe(98);
    expect(evaluation.trustScore).toBe(96);
    expect(evaluation.band).toBe('GREEN');
  });

  it('seeds exactly three red trust scores across all 18 agents', () => {
    const rows = buildAgentReviewRows([]);
    const redRows = rows.filter(row => evaluateAgentTrust(row).band === 'RED');

    expect(rows).toHaveLength(18);
    expect(rows.every(row => evaluateAgentTrust(row).trustScore != null && evaluateAgentTrust(row).evidenceCoverage === 100)).toBe(true);
    expect(redRows.map(row => row.agent.id).sort((a, b) => a - b)).toEqual([7, 12, 13]);
    expect(rows.filter(row => evaluateAgentTrust(row).band === 'AMBER')).toHaveLength(6);
    expect(rows.filter(row => evaluateAgentTrust(row).band === 'GREEN')).toHaveLength(9);
  });

  it('applies the shared trust-band boundaries exactly', () => {
    expect(trustBandForScore(89)).toBe('RED');
    expect(trustBandForScore(90)).toBe('AMBER');
    expect(trustBandForScore(94)).toBe('AMBER');
    expect(trustBandForScore(95)).toBe('GREEN');
  });

  it('shows RED agents first, then sorts each trust band by descending score', () => {
    const ranked = rankAgentReviewRows(buildAgentReviewRows([]));
    const evaluations = ranked.map(row => evaluateAgentTrust(row));
    const bands = evaluations.map(evaluation => evaluation.band);
    const bandPriority = { RED: 0, AMBER: 1, GREEN: 2, UNSCORED: 3 };

    expect(bands.slice(0, 3)).toEqual(['RED', 'RED', 'RED']);
    expect(ranked.slice(0, 3).map(row => row.agent.id)).toEqual([7, 13, 12]);
    expect(bands).toEqual([...bands].sort((a, b) => bandPriority[a] - bandPriority[b]));
    for (let index = 1; index < evaluations.length; index += 1) {
      if (evaluations[index]?.band === evaluations[index - 1]?.band) {
        expect(evaluations[index - 1]?.trustScore).toBeGreaterThanOrEqual(evaluations[index]?.trustScore ?? -1);
      }
    }
  });

  it('supports ascending and descending sorting for every agent register column', () => {
    const rows = buildAgentReviewRows([]);
    const sortKeys: AgentReviewSortKey[] = ['agent', ...TRUST_EVALUATION_DIMENSIONS.map(dimension => dimension.key), 'trustScore'];
    const valueFor = (key: AgentReviewSortKey, row: ReturnType<typeof buildAgentReviewRows>[number]) => {
      const evaluation = evaluateAgentTrust(row);
      return key === 'agent' ? row.agent.name : key === 'trustScore' ? evaluation.trustScore : evaluation.scores[key];
    };

    for (const key of sortKeys) {
      const ascending = sortAgentReviewRows(rows, key, 'asc');
      const descending = sortAgentReviewRows(rows, key, 'desc');
      expect(ascending).toHaveLength(18);
      expect(descending).toHaveLength(18);
      for (let index = 1; index < ascending.length; index += 1) {
        const previousRow = ascending[index - 1];
        const currentRow = ascending[index];
        const descendingPreviousRow = descending[index - 1];
        const descendingCurrentRow = descending[index];
        if (!previousRow || !currentRow || !descendingPreviousRow || !descendingCurrentRow) {
          throw new Error('Expected sorted agent rows at each index');
        }
        const previous = valueFor(key, previousRow);
        const current = valueFor(key, currentRow);
        expect(typeof previous === 'string' && typeof current === 'string'
          ? previous.localeCompare(current) <= 0
          : Number(previous) <= Number(current)).toBe(true);

        const descendingPrevious = valueFor(key, descendingPreviousRow);
        const descendingCurrent = valueFor(key, descendingCurrentRow);
        expect(typeof descendingPrevious === 'string' && typeof descendingCurrent === 'string'
          ? descendingPrevious.localeCompare(descendingCurrent) >= 0
          : Number(descendingPrevious) >= Number(descendingCurrent)).toBe(true);
      }
    }
  });
});
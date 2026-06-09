// Augmenting data layered on top of the immutable mockData generator.
// Side-maps + dummy rows added without touching the main generation logic.

import type { KPIRow, LedgerEntry, ChaseEvent, SlaVersionRecord, RagState } from './mockData';

/** Deterministic per-row hourly breach distribution (length 24).
 *  Total roughly matches row.breaches; peak hour biased per system to give
 *  the macro heatmap a believable "5-7pm spike" / "early-morning crash" texture.
 */
const SYSTEM_PEAK: Record<string, number[]> = {
  'Payment Gateway': [18, 17, 19, 12, 16], // evening peak
  'Core Banking':    [9, 10, 8, 14, 15],
  'CRM':             [11, 12, 14, 10, 13],
  'Document Cloud':  [21, 22, 2, 3, 4],    // night/early-morning
  'Data Warehouse':  [3, 4, 5, 2, 6],      // overnight ETL
  'Auth Engine':     [9, 18, 8, 19, 7],
};

function rngFromId(id: string): () => number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 0xffffffff; };
}

export function hourlyBreachesFor(row: Pick<KPIRow, 'id' | 'system' | 'breaches'>): number[] {
  const rng = rngFromId(row.id);
  const peaks = SYSTEM_PEAK[row.system] ?? [10, 11, 14, 15, 16];
  const buckets = new Array(24).fill(0) as number[];
  const total = Math.max(row.breaches, row.system === 'Payment Gateway' ? 4 : 1);
  for (let i = 0; i < total; i++) {
    // 70% land in peak hours, 30% spread uniformly
    const inPeak = rng() < 0.7;
    const h = inPeak ? peaks[Math.floor(rng() * peaks.length)] : Math.floor(rng() * 24);
    buckets[h] = (buckets[h] ?? 0) + 1;
  }
  return buckets;
}

/** Aggregate hourly breaches for a set of rows. */
export function aggregateHourly(rows: Pick<KPIRow, 'id' | 'system' | 'breaches'>[]): number[] {
  const out = new Array(24).fill(0) as number[];
  rows.forEach(r => {
    const b = hourlyBreachesFor(r);
    for (let i = 0; i < 24; i++) out[i] += b[i];
  });
  return out;
}

/** Find the top-3 peak hour windows (contiguous up to 3h). Returns label + count. */
export function peakWindows(hourly: number[], top = 3): { label: string; count: number }[] {
  const ranked = hourly.map((c, h) => ({ h, c })).sort((a, b) => b.c - a.c).slice(0, top);
  return ranked
    .filter(r => r.c > 0)
    .map(r => ({ label: `${String(r.h).padStart(2, '0')}:00–${String((r.h + 1) % 24).padStart(2, '0')}:00`, count: r.c }));
}

/* ---------------- Rich LoB & System metadata ---------------- */

export type Tier = 'T1' | 'T2' | 'T3' | 'T4';
export type RegulatoryScope = 'RBI' | 'SEBI' | 'IRDAI' | 'Internal';

export type LobMeta = {
  owner: string;
  ownerEmail: string;
  ownerPhone: string;
  hod: string;
  deputy: string;
  region: string;
  tier: Tier;
  parentLob: string | null;
  costCenter: string;
  regulatoryScope: RegulatoryScope[];
  linkedSystems: string[];
  defaultSla: string;
};

export type SystemMeta = {
  owner: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerOrg: string;
  region: string;
  tier: Tier;
  linkedLobs: string[];
  defaultSla: string;
};

export const LOB_META: Record<string, LobMeta> = {
  B2B: { owner: 'L. Zhang', ownerEmail: 'l.zhang@gov.demo', ownerPhone: '+1-555-0312',
    hod: 'P. Novak', deputy: 'D. Okafor', region: 'APAC + EMEA', tier: 'T2',
    parentLob: null, costCenter: 'CC-B2B-01', regulatoryScope: ['RBI', 'Internal'],
    linkedSystems: ['Core Banking', 'Payment Gateway', 'Auth Engine'], defaultSla: 'SLA_v1.3' },
  B2C: { owner: 'D. Okafor', ownerEmail: 'd.okafor@gov.demo', ownerPhone: '+1-555-0334',
    hod: 'P. Novak', deputy: 'L. Zhang', region: 'Global', tier: 'T1',
    parentLob: null, costCenter: 'CC-B2C-01', regulatoryScope: ['RBI', 'SEBI', 'Internal'],
    linkedSystems: ['Core Banking', 'Payment Gateway', 'CRM', 'Auth Engine'], defaultSla: 'SLA_v1.3' },
  Wheels: { owner: 'E. Santos', ownerEmail: 'e.santos@gov.demo', ownerPhone: '+1-555-0378',
    hod: 'D. Okafor', deputy: 'A. Williams', region: 'AMER', tier: 'T2',
    parentLob: 'B2B', costCenter: 'CC-WHEELS-04', regulatoryScope: ['IRDAI', 'Internal'],
    linkedSystems: ['CRM', 'Document Cloud', 'Data Warehouse'], defaultSla: 'SLA_v1.2' },
};

export const SYSTEM_META: Record<string, SystemMeta> = {
  'Core Banking':    { owner: 'J. Chen', ownerEmail: 'j.chen@gov.demo', ownerPhone: '+1-555-0142', ownerOrg: 'FinCore Ltd', region: 'APAC', tier: 'T1', linkedLobs: ['B2B','B2C'], defaultSla: 'SLA_v1.3' },
  'Payment Gateway': { owner: 'S. Kumar', ownerEmail: 's.kumar@gov.demo', ownerPhone: '+1-555-0188', ownerOrg: 'PaySwitch Inc', region: 'Global', tier: 'T1', linkedLobs: ['B2B','B2C'], defaultSla: 'SLA_v1.3' },
  'CRM':             { owner: 'R. Thompson', ownerEmail: 'r.thompson@gov.demo', ownerPhone: '+1-555-0211', ownerOrg: 'SalesPath Co', region: 'EMEA', tier: 'T3', linkedLobs: ['B2C','Wheels'], defaultSla: 'SLA_v1.2' },
  'Document Cloud':  { owner: 'K. Garcia', ownerEmail: 'k.garcia@gov.demo', ownerPhone: '+1-555-0247', ownerOrg: 'DocVault SaaS', region: 'AMER', tier: 'T3', linkedLobs: ['Wheels'], defaultSla: 'SLA_v1.1' },
  'Data Warehouse':  { owner: 'A. Williams', ownerEmail: 'a.williams@gov.demo', ownerPhone: '+1-555-0266', ownerOrg: 'In-House', region: 'AMER', tier: 'T4', linkedLobs: ['B2B','Wheels'], defaultSla: 'SLA_v1.1' },
  'Auth Engine':     { owner: 'M. Patel', ownerEmail: 'm.patel@gov.demo', ownerPhone: '+1-555-0299', ownerOrg: 'In-House', region: 'Global', tier: 'T1', linkedLobs: ['B2B','B2C'], defaultSla: 'SLA_v1.3' },
};

/* ---------------- Versioned config files ---------------- */
export type ConfigFile = { id: string; label: string; description: string; activeRange: string };
export const CONFIG_FILES: ConfigFile[] = [
  { id: 'default-2026', label: 'Default 2026', description: 'Standard operating thresholds', activeRange: '2026-01-01 → present' },
  { id: 'festival-v2',  label: 'Festival Season v2', description: 'Diwali / Black Friday peak profile · loosened thresholds', activeRange: 'Oct–Dec yearly' },
  { id: 'winter-2024',  label: 'Winter 2024',  description: 'Cold-weather low-volume profile', activeRange: '2024-12-15 → 2025-02-15' },
  { id: 'tax-season',   label: 'Tax Season',   description: 'High-volume filing window', activeRange: 'Mar–Apr yearly' },
];

/* ---------------- Snapshot meta for ⓘ popover ---------------- */
export type SnapshotMeta = { deployedAt: string; actor: string; reason: string; supersedes: string | null; replacedBy: string | null };
export const SNAPSHOT_META: Record<string, SnapshotMeta> = {
  'SLA_v1.0': { deployedAt: '2026-01-01T00:00:00Z', actor: 'M. Patel', reason: 'Initial baseline thresholds (platform launch)', supersedes: null, replacedBy: 'SLA_v1.1' },
  'SLA_v1.1': { deployedAt: '2026-02-01T00:00:00Z', actor: 'L. Zhang', reason: 'Tightened API latency 500ms → 400ms after Q1 incident', supersedes: 'SLA_v1.0', replacedBy: 'SLA_v1.2' },
  'SLA_v1.2': { deployedAt: '2026-03-01T00:00:00Z', actor: 'D. Okafor', reason: 'Added KYC failure debounce 3m to suppress flapping', supersedes: 'SLA_v1.1', replacedBy: 'SLA_v1.3' },
  'SLA_v1.3': { deployedAt: '2026-04-01T00:00:00Z', actor: 'S. Kumar', reason: 'Festival peak contextual profile activated', supersedes: 'SLA_v1.2', replacedBy: null },
};

/* ---------------- Dummy rows: recently-lost-connection + unconfigured ---------------- */

function ledgerStub(action: string, actor: string, details: string, minutesAgo: number): LedgerEntry {
  return { timestamp: new Date(Date.now() - minutesAgo * 60000).toISOString(), actor, action, hash: 'LDG-' + Math.random().toString(16).slice(2, 18), details };
}

function chaseStub(events: { step: ChaseEvent['step']; actor: string; minutesAgo: number }[]): ChaseEvent[] {
  return events.map(e => ({ step: e.step, actor: e.actor, timestamp: new Date(Date.now() - e.minutesAgo * 60000).toISOString() }));
}

function baseSla(): SlaVersionRecord[] {
  return [{ version: 'SLA_v1.3', activeFrom: '2026-04-01T00:00:00.000Z', changedBy: 'S. Kumar', threshold: 0.05, changeNote: 'Festival peak contextual profile' }];
}

function row(id: string, partial: Partial<KPIRow>): KPIRow {
  const now = new Date().toISOString();
  return {
    id, date: now.slice(0, 10), timestamp: now,
    lob: 'B2B' as any, system: 'Core Banking', process: 'API Uptime', source: 'AppDynamics',
    baseVolume: 0, breaches: 0, failureRate: 0, targetSLA: 0.05,
    slaVersion: 'SLA_v1.3', slaHistory: baseSla(), configSnapshotId: 'SLA_v1.3',
    ragState: 'GREY' as RagState, status: 'CLEAN', resolutionStatus: 'Clean',
    stateFlags: [], assignee: null, escalations: [], comments: [],
    chaseTimeline: [], dependency: null,
    executiveFlag: false, executiveFlagSetAt: null,
    auditLedgerId: 'LDG-' + Math.random().toString(16).slice(2, 18),
    maintenanceWindow: null, timeToDetectMin: null, timeToEscalateMin: null, timeToResolveMin: null,
    resolvedBy: null, severity: 'Medium', impactTier: 'T2', urgencyScore: 2, riskScore: 0,
    ledgerEntries: [],
    ...partial,
  };
}

/** Recently-lost-connection grey rows. `connectionLostAt` carried via dedicated map below. */
export const EXTRA_GREY_ROWS: KPIRow[] = [
  row('KPI-90201', { lob: 'B2C' as any, system: 'Payment Gateway', process: 'API Uptime', source: 'Datadog', ragState: 'GREY', stateFlags: ['Unacknowledged'],
    assignee: { name: 'S. Kumar', role: 'DevOps Manager' },
    ledgerEntries: [ledgerStub('Connector heartbeat missed', 'System', 'No telemetry for 14 minutes', 14)] }),
  row('KPI-90202', { lob: 'B2B' as any, system: 'Core Banking', process: 'Ledger Sync', source: 'AppDynamics', ragState: 'GREY',
    assignee: { name: 'J. Chen', role: 'Sr. Engineer' },
    ledgerEntries: [ledgerStub('Connector heartbeat missed', 'System', 'Stale 47m — escalating to platform admin', 47)] }),
  row('KPI-90203', { lob: 'Wheels' as any, system: 'CRM', process: 'Ticket Routing', source: 'New Relic', ragState: 'GREY',
    assignee: { name: 'R. Thompson', role: 'IT Support Lead' },
    ledgerEntries: [ledgerStub('Connector outage', 'System', 'DNS resolution flapping upstream', 8)] }),
  row('KPI-90204', { lob: 'Wheels' as any, system: 'Document Cloud', process: 'DB Backup', source: 'Splunk', ragState: 'GREY',
    assignee: { name: 'K. Garcia', role: 'Security Architect' },
    ledgerEntries: [ledgerStub('Connector outage', 'System', 'TLS handshake failure x12', 3)] }),
  row('KPI-90205', { lob: 'B2B' as any, system: 'Data Warehouse', process: 'AML Screening', source: 'Splunk', ragState: 'GREY',
    assignee: { name: 'A. Williams', role: 'Risk Analyst' },
    ledgerEntries: [ledgerStub('Connector heartbeat missed', 'System', 'Backfill required after recovery', 95)] }),
  row('KPI-90206', { lob: 'B2C' as any, system: 'Auth Engine', process: 'KYC Verification', source: 'Datadog', ragState: 'GREY',
    assignee: { name: 'M. Patel', role: 'Compliance Lead' },
    ledgerEntries: [ledgerStub('Auth token rotated upstream', 'System', 'Service account credentials expired', 22)] }),
];

/** Unconfigured KPIs awaiting setup, with active chase/escalation trails. */
export const EXTRA_UNCONFIGURED_ROWS: KPIRow[] = [
  row('KPI-99001', { lob: 'B2C' as any, system: 'Payment Gateway', process: 'API Uptime', source: 'Datadog',
    ragState: 'UNCONFIGURED', stateFlags: ['Unconfigured'],
    assignee: { name: 'S. Kumar', role: 'DevOps Manager' },
    chaseTimeline: chaseStub([
      { step: 'Generated', actor: 'System', minutesAgo: 180 },
      { step: 'Notified', actor: 'Notifier Bot → S. Kumar', minutesAgo: 175 },
      { step: 'Notified', actor: 'Reminder · S. Kumar', minutesAgo: 60 },
    ]),
    escalations: [{ from: 'System', to: 'S. Kumar', timestamp: new Date(Date.now() - 175 * 60000).toISOString(), reason: 'KPI created without thresholds' }],
    ledgerEntries: [
      ledgerStub('KPI Created (unconfigured)', 'Admin · You', 'Awaiting threshold definition', 180),
      ledgerStub('Chase nudge sent', 'Notifier Bot', 'No response from owner after 2h', 60),
    ] }),
  row('KPI-99002', { lob: 'B2B' as any, system: 'Document Cloud', process: 'DB Backup', source: 'Splunk',
    ragState: 'UNCONFIGURED', stateFlags: ['Unconfigured'],
    assignee: { name: 'K. Garcia', role: 'Security Architect' },
    chaseTimeline: chaseStub([
      { step: 'Generated', actor: 'System', minutesAgo: 60 * 26 },
      { step: 'Notified', actor: 'Notifier Bot → K. Garcia', minutesAgo: 60 * 26 - 5 },
    ]),
    escalations: [],
    ledgerEntries: [ledgerStub('KPI Created (unconfigured)', 'Admin · You', 'Owner contacted via Teams', 60 * 26)] }),
  row('KPI-99003', { lob: 'Wheels' as any, system: 'CRM', process: 'Ticket Routing', source: 'New Relic',
    ragState: 'UNCONFIGURED', stateFlags: ['Unconfigured'],
    assignee: { name: 'R. Thompson', role: 'IT Support Lead' },
    chaseTimeline: chaseStub([
      { step: 'Generated', actor: 'System', minutesAgo: 60 * 50 },
      { step: 'Notified', actor: 'Notifier Bot → R. Thompson', minutesAgo: 60 * 50 - 3 },
      { step: 'Notified', actor: 'Escalated → IT Director', minutesAgo: 60 * 6 },
    ]),
    escalations: [{ from: 'R. Thompson', to: 'IT Director', timestamp: new Date(Date.now() - 60 * 6 * 60000).toISOString(), reason: '48h SLA missed for configuration' }],
    ledgerEntries: [
      ledgerStub('KPI Created (unconfigured)', 'Admin · You', '', 60 * 50),
      ledgerStub('Escalated', 'Notifier Bot', '→ IT Director', 60 * 6),
    ] }),
  row('KPI-99004', { lob: 'B2C' as any, system: 'Auth Engine', process: 'KYC Verification', source: 'AppDynamics',
    ragState: 'UNCONFIGURED', stateFlags: ['Unconfigured'],
    assignee: { name: 'M. Patel', role: 'Compliance Lead' },
    chaseTimeline: chaseStub([
      { step: 'Generated', actor: 'System', minutesAgo: 60 * 4 },
      { step: 'Notified', actor: 'Notifier Bot → M. Patel', minutesAgo: 60 * 4 - 2 },
    ]),
    escalations: [],
    ledgerEntries: [ledgerStub('KPI Created (unconfigured)', 'Admin · You', '', 60 * 4)] }),
  row('KPI-99005', { lob: 'B2B' as any, system: 'Data Warehouse', process: 'AML Screening', source: 'Splunk',
    ragState: 'UNCONFIGURED', stateFlags: ['Unconfigured'],
    assignee: { name: 'A. Williams', role: 'Risk Analyst' },
    chaseTimeline: chaseStub([
      { step: 'Generated', actor: 'System', minutesAgo: 60 * 12 },
      { step: 'Notified', actor: 'Notifier Bot → A. Williams', minutesAgo: 60 * 12 - 5 },
    ]),
    escalations: [],
    ledgerEntries: [ledgerStub('KPI Created (unconfigured)', 'Admin · You', '', 60 * 12)] }),
];

/** Per-id metadata for "connection lost X ago" + "contact X@Y" hints. */
export const CONNECTION_LOST_MAP: Record<string, { lostAt: string; contactOrg: string; contactPerson: string }> = {
  'KPI-90201': { lostAt: new Date(Date.now() - 14 * 60000).toISOString(),  contactOrg: 'PaySwitch Inc',  contactPerson: 'S. Kumar' },
  'KPI-90202': { lostAt: new Date(Date.now() - 47 * 60000).toISOString(),  contactOrg: 'FinCore Ltd',    contactPerson: 'J. Chen' },
  'KPI-90203': { lostAt: new Date(Date.now() - 8 * 60000).toISOString(),   contactOrg: 'SalesPath Co',   contactPerson: 'R. Thompson' },
  'KPI-90204': { lostAt: new Date(Date.now() - 3 * 60000).toISOString(),   contactOrg: 'DocVault SaaS',  contactPerson: 'K. Garcia' },
  'KPI-90205': { lostAt: new Date(Date.now() - 95 * 60000).toISOString(),  contactOrg: 'In-House DWH',   contactPerson: 'A. Williams' },
  'KPI-90206': { lostAt: new Date(Date.now() - 22 * 60000).toISOString(),  contactOrg: 'In-House Auth',  contactPerson: 'M. Patel' },
};

/** Dummy escalations for LoB Manager rail (used when filteredData has none). */
export type EscalationTrailItem = {
  id: string; kpiId: string; fromActor: string; toActor: string; timestamp: string; reason: string;
  status: 'Open' | 'Acknowledged' | 'Resolved'; lob: string; system: string;
};
export const DUMMY_ESCALATION_TRAILS: EscalationTrailItem[] = [
  { id: 'E-2001', kpiId: 'KPI-13420', fromActor: 'S. Kumar', toActor: 'L. Zhang', timestamp: new Date(Date.now() - 12 * 60000).toISOString(), reason: 'Payment Gateway latency breach · 3rd recurrence this week', status: 'Open', lob: 'B2C', system: 'Payment Gateway' },
  { id: 'E-2002', kpiId: 'KPI-11982', fromActor: 'J. Chen', toActor: 'D. Okafor', timestamp: new Date(Date.now() - 38 * 60000).toISOString(), reason: 'Ledger sync drift detected', status: 'Acknowledged', lob: 'B2B', system: 'Core Banking' },
  { id: 'E-2003', kpiId: 'KPI-14005', fromActor: 'R. Thompson', toActor: 'L. Zhang', timestamp: new Date(Date.now() - 75 * 60000).toISOString(), reason: 'CRM routing backlog > 500 tickets', status: 'Open', lob: 'Wheels', system: 'CRM' },
  { id: 'E-2004', kpiId: 'KPI-13110', fromActor: 'A. Williams', toActor: 'P. Novak', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), reason: 'DWH ETL failed — compliance deadline at risk', status: 'Acknowledged', lob: 'B2B', system: 'Data Warehouse' },
  { id: 'E-2005', kpiId: 'KPI-10455', fromActor: 'K. Garcia', toActor: 'D. Okafor', timestamp: new Date(Date.now() - 180 * 60000).toISOString(), reason: 'Doc Cloud TLS cert nearing expiry', status: 'Resolved', lob: 'Wheels', system: 'Document Cloud' },
  { id: 'E-2006', kpiId: 'KPI-12877', fromActor: 'M. Patel', toActor: 'D. Okafor', timestamp: new Date(Date.now() - 240 * 60000).toISOString(), reason: 'Auth Engine throttling B2C signups', status: 'Open', lob: 'B2C', system: 'Auth Engine' },
  { id: 'E-2007', kpiId: 'KPI-15001', fromActor: 'S. Kumar', toActor: 'L. Zhang', timestamp: new Date(Date.now() - 320 * 60000).toISOString(), reason: 'Payment Gateway 5pm spike — needs capacity review', status: 'Acknowledged', lob: 'B2C', system: 'Payment Gateway' },
  { id: 'E-2008', kpiId: 'KPI-14122', fromActor: 'J. Chen', toActor: 'P. Novak', timestamp: new Date(Date.now() - 410 * 60000).toISOString(), reason: 'Core Banking weekend maintenance overran window', status: 'Resolved', lob: 'B2B', system: 'Core Banking' },
];

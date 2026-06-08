import type { KPIRow, LedgerEntry } from './mockData';
import type { ConfigSnapshot } from './filterContext';

function download(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Stamp every ledger entry with the config snapshot active when the source event occurred. */
function stamp(entries: LedgerEntry[], snapshots: ConfigSnapshot[]) {
  return entries.map(e => {
    const snap = [...snapshots].reverse().find(s => s.capturedAt <= e.timestamp) ?? snapshots[0];
    return {
      ...e,
      configSnapshotId: snap?.id ?? null,
      configRules: snap?.ragRules ?? null,
    };
  });
}

export function exportMasterLedger(master: LedgerEntry[], snapshots: ConfigSnapshot[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    integrityNote:
      'Each ledger row references the configSnapshot active at the moment the event was recorded. ' +
      'RAG/breach counts in historical rows reflect thresholds in effect at that time — NOT the current configuration.',
    configSnapshots: snapshots,
    masterLedger: stamp(master, snapshots),
  };
  download(`master-ledger-${Date.now()}.json`, JSON.stringify(payload, null, 2));
}

/* -------- CSV helpers -------- */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

export function exportMicroLedger(
  scope: { kind: 'kpi' | 'lob' | 'system'; name: string },
  entries: LedgerEntry[],
  snapshots: ConfigSnapshot[],
  context?: Partial<KPIRow>,
) {
  const stamped = stamp(entries, snapshots);
  const header = [
    'timestamp', 'actor', 'action', 'details', 'hash',
    'scope_kind', 'scope_name',
    'kpi_id', 'lob', 'system', 'process',
    'config_snapshot_id_at_event', 'config_rules_at_event',
    'current_sla_version', 'current_rag', 'current_resolution_status',
  ];
  const rows: string[] = [csvRow(header)];
  if (stamped.length === 0) {
    rows.push(csvRow([
      '', '', '(no ledger entries)', '', '',
      scope.kind, scope.name,
      context?.id ?? '', context?.lob ?? '', context?.system ?? '', context?.process ?? '',
      '', '',
      context?.slaVersion ?? '', context?.ragState ?? '', context?.resolutionStatus ?? '',
    ]));
  } else {
    for (const e of stamped) {
      rows.push(csvRow([
        e.timestamp, e.actor, e.action, e.details ?? '', e.hash,
        scope.kind, scope.name,
        context?.id ?? '', context?.lob ?? '', context?.system ?? '', context?.process ?? '',
        e.configSnapshotId ?? '', e.configRules ?? '',
        context?.slaVersion ?? '', context?.ragState ?? '', context?.resolutionStatus ?? '',
      ]));
    }
  }
  const csv = rows.join('\r\n') + '\r\n';
  const file = `micro-ledger-${scope.kind}-${scope.name.replace(/[^a-z0-9]+/gi, '_')}-${Date.now()}.csv`;
  download(file, csv, 'text/csv;charset=utf-8');
}

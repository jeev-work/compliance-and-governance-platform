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

export function exportMicroLedger(
  scope: { kind: 'kpi' | 'lob' | 'system'; name: string },
  entries: LedgerEntry[],
  snapshots: ConfigSnapshot[],
  context?: Partial<KPIRow>,
) {
  const payload = {
    exportedAt: new Date().toISOString(),
    scope,
    integrityNote:
      'Snapshot-bound export — thresholds inlined per entry. Replays use the snapshot active at incident time, ' +
      'so this file is safe to share with regulators without risk of mis-evaluation under newer SLA rules.',
    contextSummary: context ? {
      currentSlaVersion: context.slaVersion ?? null,
      currentSlaHistory: context.slaHistory ?? null,
      currentRag: context.ragState ?? null,
    } : null,
    configSnapshots: snapshots,
    ledger: stamp(entries, snapshots),
  };
  const file = `micro-ledger-${scope.kind}-${scope.name.replace(/[^a-z0-9]+/gi, '_')}-${Date.now()}.json`;
  download(file, JSON.stringify(payload, null, 2));
}

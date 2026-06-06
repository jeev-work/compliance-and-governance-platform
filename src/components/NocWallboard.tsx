import { useEffect } from 'react';
import { useFilters } from '@/lib/filterContext';
import { AlertTriangle, Radio, Volume2, X, Siren } from 'lucide-react';

export function NocWallboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { allData } = useFilters();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const redRows = allData.filter(r => r.ragState === 'RED');
  const systemsAffected = new Set(redRows.map(r => r.system)).size;

  return (
    <div className="fixed inset-0 z-[100] bg-rag-red/95 backdrop-blur-sm flex flex-col">
      <div className="absolute inset-0 exec-pulse pointer-events-none" />

      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 h-8 w-8 rounded-md bg-background/20 hover:bg-background/40 flex items-center justify-center text-foreground transition"
        aria-label="Close wallboard"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex-1 flex flex-col items-center justify-center px-8 gap-8 text-foreground">
        <div className="flex items-center gap-4">
          <Siren className="h-12 w-12 rag-red animate-pulse" />
          <h1 className="text-5xl font-black tracking-tight rag-red drop-shadow-[0_0_20px_hsl(0_72%_51%/0.8)]">
            CRITICAL — SLA BREACH DETECTED
          </h1>
          <Siren className="h-12 w-12 rag-red animate-pulse" />
        </div>

        <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
          <Tile label="RED KPIs" value={redRows.length.toLocaleString()} />
          <Tile label="Systems Affected" value={systemsAffected} />
        </div>

        <div className="w-full max-w-3xl bg-background/30 border-2 border-foreground/40 rounded-md px-6 py-3 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 rag-amber" />
          <span className="text-base font-semibold uppercase tracking-wider">
            OOB SMS Dispatched — Fallback Group Notified
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Volume2 className="h-5 w-5 animate-pulse" />
          <span className="font-mono uppercase tracking-wider">Un-mutable siren active</span>
        </div>

        <div className="w-full max-w-3xl border-t-2 border-foreground/30 pt-4 grid grid-cols-3 gap-3 font-mono text-xs">
          <NetRow label="Corporate IP" ok={false} />
          <NetRow label="GSM Modem" ok={true} />
          <NetRow label="Heartbeat" ok={false} detail="→ 503" />
        </div>

        <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] uppercase tracking-[0.3em] text-foreground/60">
          NOC Wallboard · Blackout Protocol Active · Press Esc to dismiss
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-background/40 border-2 border-foreground/40 rounded-md py-6 text-center">
      <div className="text-6xl font-black font-mono rag-red drop-shadow-[0_0_15px_hsl(0_72%_51%/0.6)]">{value}</div>
      <div className="text-xs uppercase tracking-[0.2em] mt-2 text-foreground/80">{label}</div>
    </div>
  );
}

function NetRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 bg-background/20 px-3 py-2 rounded">
      <Radio className={`h-4 w-4 ${ok ? 'rag-green' : 'rag-red'}`} />
      <span className="flex-1">{label}</span>
      <span className={`font-bold ${ok ? 'rag-green' : 'rag-red'}`}>{ok ? '✓' : '✗'}</span>
      {detail && <span className="text-foreground/70">{detail}</span>}
    </div>
  );
}

export type TrustBand = 'GREEN' | 'AMBER' | 'RED';

export function trustBandForScore(score: number): TrustBand {
  if (score >= 95) return 'GREEN';
  if (score >= 90) return 'AMBER';
  return 'RED';
}
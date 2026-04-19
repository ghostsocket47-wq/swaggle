import type { Player, Result, Subject, Year } from '../data/schema';

// IGC/IHO recognition bonuses (subject-matched: IHO→history, IGC→geo).
export const IHO_ATTENDED_BONUS = 15;
export const IHO_ELIGIBLE_BONUS = 25;
export const IGC_ATTENDED_BONUS = 15;
export const IGC_ELIGIBLE_BONUS = 25;

// Flat point values — no percentage multipliers. Explicit per-rank table,
// with a big premium on #1 and meaningful weight for NSF finals.
const POINTS = {
  IAC: {
    national: { 1: 250, 2: 160, 3: 120, 4: 95, 5: 80, 6: 70, 7: 60, 8: 52, 9: 45, 10: 40 },
    regional: { 1: 50, 2: 30, 3: 18 },
  },
  NSF: {
    national: { 1: 225, 2: 145, 3: 110, 4: 88, 5: 75, 6: 65, 7: 55, 8: 48, 9: 42, 10: 38 },
    regional: { 1: 40, 2: 25, 3: 15 },
  },
} as const;

// Playoff boost at nationals — ADDITIVE to placement points.
const PLAYOFF_BOOST = {
  finalist: 20, // made Finals (top 10 at IAC / top 10 at NSF)
  semifinalist: 15, // made Semis (11-24)
  quarterfinalist: 8, // made Quarters (25-48)
} as const;

// Fixed semi/quarter placement buckets — used when placement > 10.
function nationalPointsForBucket(circuit: 'IAC' | 'NSF', placement: number): number {
  if (placement <= 10) return 0; // handled by explicit table
  if (placement <= 24) {
    // Smooth decline from #11 down to #24 so just-missing top-10 is
    // rewarded closer to #10 (no hard cliff).
    const top = circuit === 'IAC' ? 38 : 35; // roughly #11
    const bot = circuit === 'IAC' ? 22 : 20; // roughly #24
    const t = (placement - 11) / (24 - 11);
    return Math.round(top - (top - bot) * t);
  }
  if (placement <= 48) return circuit === 'IAC' ? 18 : 16; // quarterfinalist
  return circuit === 'IAC' ? 10 : 9; // made nationals
}

export function resultPoints(r: Result): number {
  const table = POINTS[r.circuit];
  if (r.level === 'regional') {
    if (r.placement > 3) return 0; // only top-3 regionals score
    return (table.regional as Record<number, number>)[r.placement] || 0;
  }
  // National: explicit top-10 or bucket, plus playoff boost
  let base =
    (table.national as Record<number, number>)[r.placement] ||
    nationalPointsForBucket(r.circuit, r.placement);
  if (r.playoff) base += PLAYOFF_BOOST[r.playoff];
  return base;
}

export interface ScoreBreakdown {
  by2026: number;
  by2025: number;
  by2024: number;
  weighted: number;
  bonus: number;
  total: number;
  contributingResults: Result[];
}

// 2025 and 2026 weighted equally. 2024 dropped.
const YEAR_WEIGHTS: Record<Year, number> = { 2026: 0.5, 2025: 0.5, 2024: 0.0 };

export function scorePlayer(player: Player, subject: Subject): ScoreBreakdown {
  const contributingResults = player.results.filter((r) => r.subject === subject);
  const byYear: Record<Year, number> = { 2024: 0, 2025: 0, 2026: 0 };
  for (const r of contributingResults) {
    byYear[r.year] += resultPoints(r);
  }
  const weighted = YEAR_WEIGHTS[2026] * byYear[2026] + YEAR_WEIGHTS[2025] * byYear[2025];

  let bonus = 0;
  if (subject === 'history') {
    if (player.qualifications.ihoAttended) bonus += IHO_ATTENDED_BONUS;
    if (player.qualifications.ihoEligible) bonus += IHO_ELIGIBLE_BONUS;
  } else {
    if (player.qualifications.igcAttended) bonus += IGC_ATTENDED_BONUS;
    if (player.qualifications.igcEligible) bonus += IGC_ELIGIBLE_BONUS;
  }

  return {
    by2026: byYear[2026],
    by2025: byYear[2025],
    by2024: byYear[2024],
    weighted,
    bonus,
    total: weighted + bonus,
    contributingResults,
  };
}

export interface RankedRow {
  player: Player;
  score: ScoreBreakdown;
  rank: number;
  stateRank?: number;
  stateSize?: number;
}

function tiebreakKey(
  p: Player,
  b: ScoreBreakdown,
  subject: Subject,
): [number, number, number, number, number, number, number, number, string] {
  const yr2026 = -b.by2026;
  let bestIacNat = 999;
  let bestNsfNat = 999;
  let iacNatTop10 = 0;
  let nsfNatTop10 = 0;
  let iacRegionalWins = 0;
  for (const r of p.results) {
    if (r.subject !== subject) continue;
    if (r.circuit === 'IAC' && r.level === 'national') {
      if (r.placement < bestIacNat) bestIacNat = r.placement;
      if (r.placement <= 10) iacNatTop10++;
    }
    if (r.circuit === 'NSF' && r.level === 'national') {
      if (r.placement < bestNsfNat) bestNsfNat = r.placement;
      if (r.placement <= 10) nsfNatTop10++;
    }
    if (r.circuit === 'IAC' && r.level === 'regional' && r.placement === 1) {
      iacRegionalWins++;
    }
  }
  const q = p.qualifications;
  const qualCount = +q.ihoAttended + +q.ihoEligible + +q.igcAttended + +q.igcEligible;
  return [yr2026, bestIacNat, -iacNatTop10, bestNsfNat, -nsfNatTop10, -iacRegionalWins, 0, -qualCount, p.name.toLowerCase()];
}

export function rankPlayers(players: Player[], subject: Subject): RankedRow[] {
  const eligible = players.filter((p) => {
    const q = p.qualifications;
    if (subject === 'history') {
      return p.madeHistoryNationals2026 || q.ihoAttended || q.ihoEligible;
    }
    return p.madeGeoNationals2026 || q.igcAttended || q.igcEligible;
  });
  const scored = eligible.map((p) => ({ player: p, score: scorePlayer(p, subject) }));
  scored.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    const ka = tiebreakKey(a.player, a.score, subject);
    const kb = tiebreakKey(b.player, b.score, subject);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
  const withGlobalRank: RankedRow[] = scored.map((s, i) => ({ ...s, rank: i + 1 }));
  // Compute state-ranks (each state's ranking reflects the same global order).
  const stateCount = new Map<string, number>();
  for (const r of withGlobalRank) {
    const st = r.player.state;
    if (!st) continue;
    stateCount.set(st, (stateCount.get(st) || 0) + 1);
  }
  const stateCursor = new Map<string, number>();
  for (const r of withGlobalRank) {
    const st = r.player.state;
    if (!st) continue;
    const n = (stateCursor.get(st) || 0) + 1;
    stateCursor.set(st, n);
    r.stateRank = n;
    r.stateSize = stateCount.get(st);
  }
  return withGlobalRank;
}

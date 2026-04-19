import type { Player, Result } from '../src/data/schema';
import { slugify } from '../src/lib/filters';

export function playerSlug(name: string, state?: string): string {
  return slugify(`${name}${state ? '-' + state : ''}`);
}

// Merge a list of raw player records keyed by slug, unioning results.
export function mergePlayers(lists: Player[][]): Player[] {
  const byId = new Map<string, Player>();
  for (const list of lists) {
    for (const p of list) {
      const existing = byId.get(p.id);
      if (!existing) {
        byId.set(p.id, {
          ...p,
          results: [...p.results],
          qualifications: { ...p.qualifications },
        });
      } else {
        existing.madeHistoryNationals2026 ||= p.madeHistoryNationals2026;
        existing.madeGeoNationals2026 ||= p.madeGeoNationals2026;
        existing.qualifications.ihoAttended ||= p.qualifications.ihoAttended;
        existing.qualifications.ihoEligible ||= p.qualifications.ihoEligible;
        existing.qualifications.igcAttended ||= p.qualifications.igcAttended;
        existing.qualifications.igcEligible ||= p.qualifications.igcEligible;
        existing.state ??= p.state;
        existing.school ??= p.school;
        existing.chapter ??= p.chapter;
        existing.results.push(...p.results);
      }
    }
  }
  // Dedupe identical results
  for (const p of byId.values()) {
    const seen = new Set<string>();
    p.results = p.results.filter((r) => {
      const k = `${r.year}|${r.circuit}|${r.subject}|${r.level}|${r.event}|${r.placement}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return [...byId.values()];
}

// back-compute grade for a given year, assuming 8th grade in 2026
export function gradeForYear(year: 2024 | 2025 | 2026): 6 | 7 | 8 {
  return (year - 2018) as 6 | 7 | 8;
}

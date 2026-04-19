import { readFileSync, writeFileSync } from 'node:fs';
import type { Dataset, Player } from '../src/data/schema';
import { playerSlug } from './normalize';
import { fetchIHO } from './sources/iho';
import { fetchIGC } from './sources/igc';
import { fetchIACNational } from './sources/iac-national';

async function main() {
  const d = JSON.parse(readFileSync('src/data/results.json', 'utf8')) as Dataset;

  // 1) Who was at IHO 2025 (attended)
  const iho = await fetchIHO();
  const ihoSlugs = new Set<string>();
  for (const a of iho.attendees) {
    ihoSlugs.add(playerSlug(`${a.firstName} ${a.lastName}`));
    ihoSlugs.add(playerSlug(`${a.firstName} ${a.lastName}`, a.affiliation));
  }

  // 2) Who was at IGC 2024 (attended)
  const igc = await fetchIGC();
  const igcSlugs = new Set<string>();
  for (const a of igc.attendees) {
    igcSlugs.add(playerSlug(`${a.firstName} ${a.lastName}`));
    igcSlugs.add(playerSlug(`${a.firstName} ${a.lastName}`, a.state));
  }

  // 3) IAC nationals "qualifies for X" column → eligible flags
  const iac = await fetchIACNational();
  const ihoEligibleSlugs = new Set<string>();
  const igcEligibleSlugs = new Set<string>();
  for (const r of iac.rows) {
    const s1 = playerSlug(`${r.firstName} ${r.lastName}`);
    const s2 = playerSlug(`${r.firstName} ${r.lastName}`, r.state);
    if (r.qualifiedToIHO) {
      ihoEligibleSlugs.add(s1);
      ihoEligibleSlugs.add(s2);
    }
    if (r.qualifiedToIGC) {
      igcEligibleSlugs.add(s1);
      igcEligibleSlugs.add(s2);
    }
  }

  // Apply to each player in the dataset
  let n = 0;
  for (const p of d.players as Player[]) {
    const slugA = playerSlug(p.name);
    const slugB = playerSlug(p.name, p.state);
    const q = p.qualifications as any;
    // Migrate legacy flags → new fields
    const legacyIho = q.iho === true;
    const legacyIgc = q.igc === true;
    p.qualifications = {
      ihoAttended: ihoSlugs.has(slugA) || ihoSlugs.has(slugB) || legacyIho,
      ihoEligible: ihoEligibleSlugs.has(slugA) || ihoEligibleSlugs.has(slugB),
      igcAttended: igcSlugs.has(slugA) || igcSlugs.has(slugB) || legacyIgc,
      igcEligible: igcEligibleSlugs.has(slugA) || igcEligibleSlugs.has(slugB),
    };
    n++;
  }

  // Recompute eligibility filter
  const before = d.players.length;
  d.players = d.players.filter((p) => {
    const q = p.qualifications;
    return (
      p.madeHistoryNationals2026 ||
      p.madeGeoNationals2026 ||
      q.ihoAttended ||
      q.ihoEligible ||
      q.igcAttended ||
      q.igcEligible
    );
  });

  const sums = {
    ihoA: d.players.filter((p) => p.qualifications.ihoAttended).length,
    ihoE: d.players.filter((p) => p.qualifications.ihoEligible).length,
    igcA: d.players.filter((p) => p.qualifications.igcAttended).length,
    igcE: d.players.filter((p) => p.qualifications.igcEligible).length,
  };
  console.log('processed:', n, 'players →', d.players.length, 'after filter (was', before, ')');
  console.log('  ihoAttended:', sums.ihoA);
  console.log('  ihoEligible:', sums.ihoE);
  console.log('  igcAttended:', sums.igcA);
  console.log('  igcEligible:', sums.igcE);

  writeFileSync('src/data/results.json', JSON.stringify(d, null, 2));
  console.log('wrote src/data/results.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

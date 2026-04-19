/**
 * Swaggle scraper orchestrator.
 *
 * Pulls from:
 *  - IAC EMS National Championship results (Google Sheets, per event + year)
 *  - IAC EMS Regional results (Google Sheets, per-regional History + Geo Bee tabs)
 *  - IHO 2025 Paris competing student list (Google Sheet)
 *  - IGC 2024 Vienna student participation list (PDF)
 *  - NSF Geography Bee national finals + regional placements (HTML tables)
 *
 * Output: src/data/results.json.
 *
 * Philosophy: all caching is file-based (scraper/out/cache). Re-running is cheap.
 * Merges manual-overrides.json LAST so curated data can patch gaps.
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Dataset, Player, Result, SourceRef } from '../src/data/schema';
import { mergePlayers, playerSlug } from './normalize';
import { fetchIACNational, toResult as iacNatResult } from './sources/iac-national';
import { fetchIACRegional, toResult as iacRegResult } from './sources/iac-regional';
import { fetchIHO } from './sources/iho';
import { fetchIGC } from './sources/igc';
import { fetchNSF, toResult as nsfResult } from './sources/nsf';

const OUT_FILE = path.resolve('src/data/results.json');
const OVERRIDES_FILE = path.resolve('scraper/manual-overrides.json');

async function loadOverrides(): Promise<{ players: Player[]; sources: SourceRef[] }> {
  if (!existsSync(OVERRIDES_FILE)) return { players: [], sources: [] };
  const raw = await readFile(OVERRIDES_FILE, 'utf8');
  const parsed = JSON.parse(raw) as { players?: Player[]; sources?: SourceRef[] };
  return { players: parsed.players ?? [], sources: parsed.sources ?? [] };
}

function ensureIdentity(fn: string, ln: string, state?: string) {
  const name = `${fn} ${ln}`.trim();
  return { id: playerSlug(name, state), name };
}

async function main() {
  console.log('Swaggle scraper ▶ starting (full run)');
  const sources: SourceRef[] = [];
  const playerLists: Player[][] = [];

  // --- IAC National (all years)
  console.log('▶ IAC EMS National championships');
  const iacNat = await fetchIACNational();
  sources.push(...iacNat.sources);
  console.log(`  ${iacNat.rows.length} IAC national rows`);
  // Only 8th graders in 2026 (= 7th in 2025, 6th in 2024) are ranked.
  const isEightGradeClass = (grade: number | undefined, year: number) =>
    grade === (year === 2026 ? 8 : year === 2025 ? 7 : year === 2024 ? 6 : -1);
  const iacNatPlayers: Player[] = iacNat.rows
    .filter((r) => isEightGradeClass(r.grade, r.year))
    .map((r) => {
      const { id, name } = ensureIdentity(r.firstName, r.lastName, r.state);
      return {
        id,
        name,
        state: r.state,
        school: r.school,
        madeHistoryNationals2026:
          r.subject === 'history' && r.year === 2026 && r.grade === 8,
        madeGeoNationals2026: r.subject === 'geo' && r.year === 2026 && r.grade === 8,
        qualifications: { ihoAttended: false, ihoEligible: r.qualifiedToIHO, igcAttended: false, igcEligible: r.qualifiedToIGC },
        results: [iacNatResult(r)],
      };
    });
  playerLists.push(iacNatPlayers);

  // --- IAC Regionals (2024-2025 + 2025-2026)
  console.log('▶ IAC EMS Regionals (this can take a bit)');
  const iacReg = await fetchIACRegional();
  sources.push(...iacReg.sources);
  console.log(`  ${iacReg.rows.length} IAC regional rows`);
  const iacRegPlayers: Player[] = iacReg.rows
    .filter((r) => isEightGradeClass(r.grade, r.year))
    .map((r) => {
      const { id, name } = ensureIdentity(r.firstName, r.lastName, r.state);
      const madeHistoryNats =
        r.year === 2026 &&
        r.subject === 'history' &&
        r.grade === 8 &&
        r.qualifiedToNationals;
      const madeGeoNats =
        r.year === 2026 &&
        r.subject === 'geo' &&
        r.grade === 8 &&
        r.qualifiedToNationals;
      return {
        id,
        name,
        state: r.state,
        school: r.school,
        madeHistoryNationals2026: madeHistoryNats,
        madeGeoNationals2026: madeGeoNats,
        qualifications: { ihoAttended: false, ihoEligible: false, igcAttended: false, igcEligible: false },
        results: [iacRegResult(r)],
      };
    });
  playerLists.push(iacRegPlayers);

  // --- IHO roster (2025)
  console.log('▶ IHO 2025 roster');
  const iho = await fetchIHO();
  sources.push(...iho.sources);
  console.log(`  ${iho.attendees.length} IHO attendees`);
  const ihoSlugs = new Set<string>();
  iho.attendees.forEach((a) => {
    const slug = playerSlug(`${a.firstName} ${a.lastName}`, a.affiliation);
    ihoSlugs.add(slug);
    // Also add without state for looser matching
    ihoSlugs.add(playerSlug(`${a.firstName} ${a.lastName}`));
  });

  // --- IGC roster (2024)
  console.log('▶ IGC 2024 roster');
  const igc = await fetchIGC();
  sources.push(...igc.sources);
  console.log(`  ${igc.attendees.length} IGC attendees`);
  const igcSlugs = new Set<string>();
  igc.attendees.forEach((a) => {
    igcSlugs.add(playerSlug(`${a.firstName} ${a.lastName}`, a.state));
    igcSlugs.add(playerSlug(`${a.firstName} ${a.lastName}`));
  });

  // --- NSF (both national + regional)
  console.log('▶ NSF Geography Bee');
  const nsf = await fetchNSF();
  sources.push(...nsf.sources);
  console.log(`  ${nsf.rows.length} NSF rows`);
  const nsfPlayers: Player[] = nsf.rows.map((r) => {
    const { id, name } = ensureIdentity(r.firstName, r.lastName, r.chapter);
    return {
      id,
      name,
      state: r.chapter,
      chapter: r.chapter,
      madeHistoryNationals2026: false,
      madeGeoNationals2026: r.level === 'national' && r.year === 2026,
      qualifications: { ihoAttended: false, ihoEligible: false, igcAttended: false, igcEligible: false },
      results: [nsfResult(r)],
    };
  });
  playerLists.push(nsfPlayers);

  // --- Manual overrides (last — authoritative)
  const overrides = await loadOverrides();
  sources.push(...overrides.sources);
  playerLists.push(overrides.players);
  console.log(`▶ Manual overrides: ${overrides.players.length} players`);

  // --- Merge
  const merged = mergePlayers(playerLists);

  // --- Apply qualification boosts (match by slug w/ and w/o state)
  for (const p of merged) {
    const slugWith = playerSlug(p.name, p.state);
    const slugPlain = playerSlug(p.name);
    if (igcSlugs.has(slugWith) || igcSlugs.has(slugPlain)) p.qualifications.igcAttended = true;
    if (ihoSlugs.has(slugWith) || ihoSlugs.has(slugPlain)) p.qualifications.ihoAttended = true;
    // Having made 2026 IAC nationals qualifies for the next Olympiad/Champs.
    if (p.madeHistoryNationals2026) p.qualifications.ihoEligible = true;
    if (p.madeGeoNationals2026) p.qualifications.igcEligible = true;
  }

  // --- Summary
  const histCount = merged.filter((p) => p.madeHistoryNationals2026).length;
  const geoCount = merged.filter((p) => p.madeGeoNationals2026).length;
  const igcCount = merged.filter((p) => p.qualifications.igcAttended || p.qualifications.igcEligible).length;
  const ihoCount = merged.filter((p) => p.qualifications.ihoAttended || p.qualifications.ihoEligible).length;
  console.log('----');
  console.log(`  history 2026 nationals qualifiers: ${histCount}`);
  console.log(`  geo 2026 nationals qualifiers:     ${geoCount}`);
  console.log(`  IGC-qualified:                     ${igcCount}`);
  console.log(`  IHO-qualified:                     ${ihoCount}`);
  console.log(`  total players in dataset:          ${merged.length}`);

  const dataset: Dataset = {
    players: merged,
    lastUpdated: new Date().toISOString(),
    sources,
  };

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(dataset, null, 2));
  console.log(`▶ wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

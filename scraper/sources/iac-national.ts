import * as cheerio from 'cheerio';
import { fetchCached } from '../fetch';
import { fetchSheet } from './gsheet';
import type { Result, SourceRef } from '../../src/data/schema';

// Index page for IAC EMS national championship results.
const NAT_RESULTS_URL =
  'https://www.iacompetitions.com/elementary-middle-school-national-championship-results/';

// Map event names on the page to our (subject, circuit, event label).
const EVENT_MAP: Record<
  string,
  { subject: 'history' | 'geo'; eventShort: string } | null
> = {
  'National History Bee': { subject: 'history', eventShort: 'IAC National History Bee' },
  'National Geography Bee': { subject: 'geo', eventShort: 'IAC National Geography Bee' },
  'US History Bee': { subject: 'history', eventShort: 'IAC US History Bee' },
  'US Geography Championships': { subject: 'geo', eventShort: 'IAC US Geography Championships' },
  'US Geography Bee': { subject: 'geo', eventShort: 'IAC US Geography Bee' },
};

export interface IACNationalRow {
  firstName: string;
  lastName: string;
  school?: string;
  state?: string;
  grade?: number;
  placement: number;
  year: number;
  subject: 'history' | 'geo';
  event: string;
  qualifiedToIHO: boolean;
  qualifiedToIGC: boolean;
}

function cleanName(s: string) {
  return s.trim().replace(/\s+/g, ' ');
}

function gid0Fallback(_id: string, _count: number): boolean {
  return false;
}

function parseNationalSheet(
  rows: string[][],
  year: number,
  subject: 'history' | 'geo',
  event: string,
): IACNationalRow[] {
  // Find the header row with "First Name" / "Last Name" / "Standing"
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const lower = rows[i].map((c) => c.toLowerCase());
    if (lower.includes('first name') && lower.includes('last name')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];
  const header = rows[headerIdx].map((c) => c.trim().toLowerCase());
  const col = (k: string) => header.findIndex((h) => h === k || h.startsWith(k));
  const rankC = col('final rank') >= 0 ? col('final rank') : col('placement');
  const fnC = col('first name');
  const lnC = col('last name');
  const schoolC = col('school');
  const stateC = col('state');
  const gradeC = col('grade');
  const standC = col('standing');
  const iacIHOc = header.findIndex((h) => /history olympiad/.test(h));
  const iacIGCc = header.findIndex((h) => /geography championships/.test(h));

  const out: IACNationalRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[fnC] || !r[lnC]) continue;
    const fn = cleanName(r[fnC]);
    const ln = cleanName(r[lnC]);
    if (!fn || !ln || fn.toUpperCase() === fn && fn.length > 3 && !/[a-z]/.test(fn)) {
      // Section banners like "EIGHTH GRADE" — skip
      continue;
    }
    let placement = 999;
    if (rankC >= 0 && r[rankC]) {
      const n = parseInt(r[rankC], 10);
      if (isFinite(n)) placement = n;
    }
    // Standing column also sometimes has "Champion", "Second Place" etc.
    const standing = (standC >= 0 ? r[standC] : '') || '';
    if (placement === 999 && standing) {
      const m: Record<string, number> = {
        champion: 1,
        'second place': 2,
        'third place': 3,
        'fourth place': 4,
        'fifth place': 5,
        'sixth place': 6,
        'seventh place': 7,
        'eighth place': 8,
        'eighth place ': 8,
        'eight place': 8,
        'ninth place': 9,
        'tenth place': 10,
      };
      const k = standing.toLowerCase().trim();
      if (m[k]) placement = m[k];
      else if (/semifinalist/i.test(standing)) placement = 15;
      else if (/quarterfinalist/i.test(standing)) placement = 35;
      else if (/finalist/i.test(standing)) placement = 10;
    }
    out.push({
      firstName: fn,
      lastName: ln,
      school: r[schoolC]?.trim(),
      state: r[stateC]?.trim(),
      grade: gradeC >= 0 ? parseInt(r[gradeC], 10) || undefined : undefined,
      placement,
      year,
      subject,
      event,
      qualifiedToIHO: iacIHOc >= 0 ? /qualif/i.test(r[iacIHOc] || '') : false,
      qualifiedToIGC: iacIGCc >= 0 ? /qualif/i.test(r[iacIGCc] || '') : false,
    });
  }
  return out;
}

export async function fetchIACNational(): Promise<{
  rows: IACNationalRow[];
  sources: SourceRef[];
}> {
  const sources: SourceRef[] = [];
  const out: IACNationalRow[] = [];
  try {
    const html = await fetchCached(NAT_RESULTS_URL);
    sources.push({ url: NAT_RESULTS_URL, fetched: new Date().toISOString() });
    const $ = cheerio.load(html);

    // Collect Google sheet links with context: (year, event)
    const jobs: {
      id: string;
      year: number;
      subject: 'history' | 'geo';
      event: string;
    }[] = [];
    const seen = new Set<string>();

    $('a[href*="docs.google.com/spreadsheets"]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const m = href.match(/spreadsheets\/d\/([^/]+)/);
      if (!m) return;
      const id = m[1];
      // determine year from preceding h2
      const section = $(a).closest('table').prevAll('h2').first().text().trim();
      const yearMatch = section.match(/(20\d\d)/);
      if (!yearMatch) return;
      const year = parseInt(yearMatch[1], 10);
      // determine event from the row's event cell (col 1 or 2 of tr)
      const tr = $(a).closest('tr');
      const cells = tr
        .find('td')
        .map((_, c) => $(c).text().trim())
        .get();
      const eventCell = cells.find((c) => Object.keys(EVENT_MAP).some((k) => c.includes(k))) || '';
      const match = Object.keys(EVENT_MAP).find((k) => eventCell.includes(k));
      if (!match) return;
      const meta = EVENT_MAP[match]!;
      const key = `${id}|${year}|${meta.eventShort}`;
      if (seen.has(key)) return;
      seen.add(key);
      jobs.push({ id, year, subject: meta.subject, event: `${meta.eventShort} ${year}` });
    });

    // Fetch each sheet's htmlview to discover all grade tabs (gids), then
    // fetch each grade's tab as CSV. This gets us 7th, 8th, 6th grade data.
    for (const job of jobs) {
      try {
        const html = await fetchCached(
          `https://docs.google.com/spreadsheets/d/${job.id}/htmlview`,
        );
        // Map "<Nth>" → gid by looking at the href near each tab label.
        const gidMap = new Map<string, string>();
        const gidMatches = [...html.matchAll(/gid=(\d+)/g)].map((m) => m[1]);
        const uniqGids = [...new Set(gidMatches)];
        // Find labels near each gid
        for (const gid of uniqGids) {
          const pat = new RegExp(`gid=${gid}[^\"']{0,10}[\"']?[^>]{0,200}>([^<]{3,30})<`);
          const m = html.match(pat);
          if (m) gidMap.set(gid, m[1].trim());
          else gidMap.set(gid, '');
        }
        // Or use looser text-proximity
        for (const gid of uniqGids) {
          const label = gidMap.get(gid) || '';
          if (label) continue;
          // Find proximity to a grade keyword
          const idx = html.indexOf(`gid=${gid}`);
          if (idx < 0) continue;
          const win = html.slice(Math.max(0, idx - 400), idx + 400);
          const m = win.match(/(8th|7th|6th|5th|4th|3rd)\s*Grade/i);
          if (m) gidMap.set(gid, m[0]);
        }
        // Only fetch tabs we care about (8th + 7th + 6th grade proper results)
        const wanted = [...gidMap.entries()].filter(
          ([, label]) =>
            /^(8th|7th|6th)\s*Grade$/i.test(label) ||
            (uniqGids.length > 0 && label === '' && gid0Fallback(job.id, gidMap.size)),
        );
        const gidsToFetch = wanted.length > 0 ? wanted.map(([g]) => g) : ['0'];
        for (const gid of gidsToFetch) {
          try {
            const rows = await fetchSheet({ id: job.id, gid });
            const parsed = parseNationalSheet(rows, job.year, job.subject, job.event);
            out.push(...parsed);
          } catch (e2) {
            sources.push({
              url: `sheet:${job.id}#${gid}`,
              fetched: new Date().toISOString(),
              notes: `parse tab failed: ${(e2 as Error).message}`,
            });
          }
        }
      } catch (err) {
        sources.push({
          url: `sheet:${job.id}`,
          fetched: new Date().toISOString(),
          notes: `parse failed: ${(err as Error).message}`,
        });
      }
    }
  } catch (err) {
    sources.push({
      url: NAT_RESULTS_URL,
      fetched: new Date().toISOString(),
      notes: `fetch failed: ${(err as Error).message}`,
    });
  }
  return { rows: out, sources };
}

export function toResult(row: IACNationalRow): Result {
  return {
    year: (row.year >= 2024 && row.year <= 2026 ? row.year : 2026) as 2024 | 2025 | 2026,
    grade: (row.grade && row.grade >= 6 && row.grade <= 8 ? row.grade : 8) as 6 | 7 | 8,
    circuit: 'IAC',
    subject: row.subject,
    level: 'national',
    event: row.event,
    placement: row.placement,
    qualifiedToNationals: true,
  };
}

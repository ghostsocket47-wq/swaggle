import * as cheerio from 'cheerio';
import { fetchCached } from '../fetch';
import { fetchSheet } from './gsheet';
import type { Result, SourceRef } from '../../src/data/schema';

const REG_RESULTS_URL =
  'https://www.iacompetitions.com/elementary-middle-school-regional-results/';

export interface IACRegionalRow {
  firstName: string;
  lastName: string;
  school?: string;
  state?: string;
  grade?: number;
  placement: number;
  year: 2024 | 2025 | 2026;
  subject: 'history' | 'geo';
  event: string;
  qualifiedToNationals: boolean;
}

function cleanName(s: string) {
  return s.trim().replace(/\s+/g, ' ');
}

// Regional CSVs have grade sections ("EIGHTH GRADE", "SEVENTH GRADE", ...).
// Each section starts after a banner row and ends at the next banner or empty run.
function parseRegionalSheet(
  rows: string[][],
  year: 2024 | 2025 | 2026,
  subject: 'history' | 'geo',
  event: string,
): IACRegionalRow[] {
  // locate header
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
  const fnC = col('first name');
  const lnC = col('last name');
  const gradeC = col('grade');
  const schoolC = col('school');
  const locationC = col('location');
  const standingC = col('standing');
  const natC = header.findIndex((h) => /^nationals\??$/.test(h));
  // Ordered position counter within each section (some sheets don't have explicit rank)
  const out: IACRegionalRow[] = [];
  const sectionOrder = new Map<number, number>();
  let currentSection: number | null = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const firstCellUpper = (r[0] || '').toUpperCase().trim();
    // Section banner detection (grade-level)
    const gradeBanner: Record<string, number> = {
      VARSITY: 10,
      'JUNIOR VARSITY': 9,
      'EIGHTH GRADE': 8,
      '8TH GRADE': 8,
      'SEVENTH GRADE': 7,
      '7TH GRADE': 7,
      'SIXTH GRADE': 6,
      '6TH GRADE': 6,
      'FIFTH GRADE': 5,
      '5TH GRADE': 5,
      'FOURTH GRADE': 4,
      '4TH GRADE': 4,
      'ELEMENTARY SCHOOL': 4,
    };
    const matchedBanner = Object.keys(gradeBanner).find((k) => firstCellUpper === k);
    if (matchedBanner) {
      currentSection = gradeBanner[matchedBanner];
      sectionOrder.set(currentSection, 0);
      continue;
    }

    const fn = cleanName(r[fnC] || '');
    const ln = cleanName(r[lnC] || '');
    if (!fn || !ln) continue;
    if (/GRADE|VARSITY|DIVISION|ELEMENTARY/.test(firstCellUpper)) continue;

    const gradeVal = gradeC >= 0 ? parseInt(r[gradeC], 10) : undefined;
    const grade = gradeVal && gradeVal >= 3 && gradeVal <= 12 ? gradeVal : currentSection ?? undefined;

    // placement: ONLY from explicit standing text. No row-order inference —
    // the CSV rows being in score order was an unsafe assumption that
    // inflated random kids to "1st".
    const standing = (standingC >= 0 ? r[standingC] : '') || '';
    let placement = 999;
    const m: Record<string, number> = {
      champion: 1,
      'second place': 2,
      'third place': 3,
      'fourth place': 4,
      'fifth place': 5,
      'sixth place': 6,
    };
    const k = standing.toLowerCase().trim();
    if (m[k]) placement = m[k];
    else if (/finalist/i.test(standing)) placement = 8;
    else if (/semifinalist/i.test(standing)) placement = 15;
    else if (/quarterfinalist/i.test(standing)) placement = 25;

    const qualText = natC >= 0 ? r[natC] || '' : '';
    // IAC EMS format: top-3 placements AND finalists always qualify for nationals.
    const qualifiedToNationals =
      /qualif/i.test(qualText) || placement <= 3 || /finalist/i.test(standing);

    // If they qualified but have no explicit placement, they made nationals
    // but we don't know exact rank — use "qualifier" bucket (placement = 50).
    if (placement === 999 && qualifiedToNationals) {
      placement = 50;
    }
    // Track section order purely for diagnostics / not used for placement.
    if (currentSection !== null) {
      sectionOrder.set(currentSection, (sectionOrder.get(currentSection) || 0) + 1);
    }
    // Skip rows that neither have a standing nor qualified — keeps noise out.
    if (placement === 999) continue;

    out.push({
      firstName: fn,
      lastName: ln,
      school: schoolC >= 0 ? r[schoolC]?.trim() : undefined,
      state: locationC >= 0 ? r[locationC]?.trim() : undefined,
      grade,
      placement,
      year,
      subject,
      event,
      qualifiedToNationals,
    });
  }
  return out;
}

interface SheetJob {
  id: string;
  gid: string;
  year: 2024 | 2025 | 2026;
  subject: 'history' | 'geo';
  event: string;
}

export async function fetchIACRegional(limit = Infinity): Promise<{
  rows: IACRegionalRow[];
  sources: SourceRef[];
}> {
  const sources: SourceRef[] = [];
  const out: IACRegionalRow[] = [];

  let html: string;
  try {
    html = await fetchCached(REG_RESULTS_URL);
    sources.push({ url: REG_RESULTS_URL, fetched: new Date().toISOString() });
  } catch (err) {
    sources.push({
      url: REG_RESULTS_URL,
      fetched: new Date().toISOString(),
      notes: `fetch failed: ${(err as Error).message}`,
    });
    return { rows: out, sources };
  }
  const $ = cheerio.load(html);

  // Collect all History/Geo tab links under 2024-2025 and 2025-2026 sections.
  const jobs: SheetJob[] = [];
  $('a[href*="docs.google.com/spreadsheets"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const linkText = $(a).text().trim();
    const m = href.match(/spreadsheets\/d\/([^/]+)/);
    if (!m) return;
    const id = m[1];
    const gidMatch = href.match(/gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '';
    if (!gid) return; // only tab-specific
    const section = $(a).closest('table').prevAll('h2').first().text().trim();
    const yearMatch = section.match(/(20\d\d)-(20\d\d)/);
    if (!yearMatch) return;
    // Second year is the "current" school year.
    const year = parseInt(yearMatch[2], 10);
    if (year !== 2025 && year !== 2026) return;
    const tr = $(a).closest('tr');
    const cells = tr
      .find('td')
      .map((_, c) => $(c).text().trim())
      .get();
    const eventName = cells[0] || 'Regional';
    let subject: 'history' | 'geo' | null = null;
    if (/History Bee/i.test(linkText)) subject = 'history';
    else if (/Geography Bee|Geography/i.test(linkText)) subject = 'geo';
    if (!subject) return;
    jobs.push({
      id,
      gid,
      year: year as 2025 | 2026,
      subject,
      event: `IAC ${eventName} ${subject === 'history' ? 'History Bee' : 'Geography Bee'} Regional ${year}`,
    });
  });

  const limited = jobs.slice(0, limit);
  let i = 0;
  for (const job of limited) {
    i++;
    try {
      const rows = await fetchSheet({ id: job.id, gid: job.gid });
      const parsed = parseRegionalSheet(rows, job.year, job.subject, job.event);
      out.push(...parsed);
      if (i % 20 === 0) {
        console.log(`    IAC regional: ${i}/${limited.length} sheets (${out.length} rows so far)`);
      }
    } catch (err) {
      sources.push({
        url: `sheet:${job.id}#${job.gid}`,
        fetched: new Date().toISOString(),
        notes: `parse failed: ${(err as Error).message}`,
      });
    }
  }
  console.log(`    IAC regional: done (${i} sheets, ${out.length} rows)`);
  return { rows: out, sources };
}

export function toResult(row: IACRegionalRow): Result {
  return {
    year: row.year,
    grade: (row.grade && row.grade >= 6 && row.grade <= 8 ? row.grade : 8) as 6 | 7 | 8,
    circuit: 'IAC',
    subject: row.subject,
    level: 'regional',
    event: row.event,
    placement: row.placement,
    qualifiedToNationals: row.qualifiedToNationals,
  };
}

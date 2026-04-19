import * as cheerio from 'cheerio';
import { fetchCached } from '../fetch';
import type { Result, SourceRef } from '../../src/data/schema';

const NSF_FINALS = 'https://northsouth.org/public/USContests/Finals/geography';
const NSF_REGIONALS = 'https://www.northsouth.org/regional-contests/regional-placements/';

export interface NSFRow {
  firstName: string;
  lastName: string;
  chapter?: string;
  state?: string;
  grade?: number;
  placement: number;
  year: 2024 | 2025 | 2026;
  level: 'regional' | 'national';
  event: string;
}

const ELITE_CHAPTERS = /silicon valley|bay area|san francisco|boston|online/i;
const STRONG_CHAPTERS =
  /new jersey|nj|edison|princeton|dallas|plano|houston|atlanta|georgia|seattle|chicago|long island|nyc|washington|dc|maryland|los angeles|irvine/i;

export function regionTier(chapter?: string): 'elite' | 'strong' | 'standard' {
  if (!chapter) return 'standard';
  if (ELITE_CHAPTERS.test(chapter)) return 'elite';
  if (STRONG_CHAPTERS.test(chapter)) return 'strong';
  return 'standard';
}

function parseFinalsPage(html: string): NSFRow[] {
  const $ = cheerio.load(html);
  const out: NSFRow[] = [];
  // NSF finals page renders tables per year/contest.
  $('table').each((_, tbl) => {
    const caption = $(tbl).prev('h2, h3, h4, p').text().trim();
    const yearMatch = caption.match(/(20\d\d)/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
    const isGeo = /geograph/i.test(caption);
    if (!isGeo) return;
    if (year < 2024 || year > 2026) return;
    // Find header row
    const headerRow = $(tbl).find('tr').first();
    const headers = headerRow.find('th, td').map((_, c) => $(c).text().trim().toLowerCase()).get();
    const rankC = headers.findIndex((h) => /rank|place/.test(h));
    const nameC = headers.findIndex((h) => /name/.test(h));
    const gradeC = headers.findIndex((h) => /grade/.test(h));
    const chapterC = headers.findIndex((h) => /chapter|center|region/.test(h));
    if (nameC < 0) return;
    $(tbl).find('tr').slice(1).each((_, tr) => {
      const cells = $(tr).find('td').map((_, c) => $(c).text().trim()).get();
      if (!cells[nameC]) return;
      const name = cells[nameC];
      const [fn, ...rest] = name.split(/\s+/);
      const ln = rest.join(' ');
      if (!ln) return;
      const placement = rankC >= 0 ? parseInt(cells[rankC], 10) : 999;
      out.push({
        firstName: fn,
        lastName: ln,
        grade: gradeC >= 0 ? parseInt(cells[gradeC], 10) || undefined : undefined,
        chapter: chapterC >= 0 ? cells[chapterC] : undefined,
        placement: isFinite(placement) ? placement : 999,
        year: year as 2024 | 2025 | 2026,
        level: 'national',
        event: `NSF Senior Geography Bee National ${year}`,
      });
    });
  });
  return out;
}

function parseRegionalPage(html: string): NSFRow[] {
  const $ = cheerio.load(html);
  const out: NSFRow[] = [];
  // This page has large tables; extract Senior Geography rows with a year.
  $('table').each((_, tbl) => {
    const caption = $(tbl).prev('h2, h3, h4, p').text().trim() + ' ' + $(tbl).find('caption').text();
    const yearMatch = caption.match(/(20\d\d)/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
    if (year !== 2024 && year !== 2025 && year !== 2026) return;
    const isGeo = /geograph/i.test(caption);
    if (!isGeo) return;
    const headerRow = $(tbl).find('tr').first();
    const headers = headerRow.find('th, td').map((_, c) => $(c).text().trim().toLowerCase()).get();
    const nameC = headers.findIndex((h) => /name/.test(h));
    const rankC = headers.findIndex((h) => /rank|place|position/.test(h));
    const gradeC = headers.findIndex((h) => /grade/.test(h));
    const chapterC = headers.findIndex((h) => /chapter|center/.test(h));
    if (nameC < 0) return;
    $(tbl).find('tr').slice(1).each((_, tr) => {
      const cells = $(tr).find('td').map((_, c) => $(c).text().trim()).get();
      if (!cells[nameC]) return;
      const name = cells[nameC];
      const [fn, ...rest] = name.split(/\s+/);
      const ln = rest.join(' ');
      if (!ln) return;
      const placement = rankC >= 0 ? parseInt(cells[rankC], 10) : 999;
      out.push({
        firstName: fn,
        lastName: ln,
        grade: gradeC >= 0 ? parseInt(cells[gradeC], 10) || undefined : undefined,
        chapter: chapterC >= 0 ? cells[chapterC] : undefined,
        placement: isFinite(placement) ? placement : 999,
        year: year as 2024 | 2025 | 2026,
        level: 'regional',
        event: `NSF Geography Regional ${cells[chapterC] || ''} ${year}`.replace(/\s+/g, ' ').trim(),
      });
    });
  });
  return out;
}

export async function fetchNSF(): Promise<{ rows: NSFRow[]; sources: SourceRef[] }> {
  const sources: SourceRef[] = [];
  const out: NSFRow[] = [];
  for (const [url, parser] of [
    [NSF_FINALS, parseFinalsPage],
    [NSF_REGIONALS, parseRegionalPage],
  ] as const) {
    try {
      const html = await fetchCached(url);
      sources.push({ url, fetched: new Date().toISOString() });
      const parsed = parser(html);
      out.push(...parsed);
    } catch (err) {
      sources.push({
        url,
        fetched: new Date().toISOString(),
        notes: `fetch failed: ${(err as Error).message}`,
      });
    }
  }
  return { rows: out, sources };
}

export function toResult(row: NSFRow): Result {
  return {
    year: row.year,
    grade: (row.grade && row.grade >= 6 && row.grade <= 8 ? row.grade : 8) as 6 | 7 | 8,
    circuit: 'NSF',
    subject: 'geo',
    level: row.level,
    event: row.event,
    regionTier: regionTier(row.chapter),
    placement: row.placement,
    qualifiedToNationals: row.level === 'national' || row.placement <= 5,
  };
}

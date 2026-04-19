import { fetchSheet } from './gsheet';
import type { SourceRef } from '../../src/data/schema';

// Official 2025 IHO competing student list — hosted on Google Sheets.
const IHO_2025_SHEET_ID = '1BfI5LCQgpUTPhT14sFfmUb7j_v0sbyvyHX30LyaWSQk';
const IHO_2025_GID = '152330999';

export interface IHOAttendee {
  firstName: string;
  lastName: string;
  division: string;
  affiliation?: string;
  year: number;
}

export async function fetchIHO(): Promise<{
  attendees: IHOAttendee[];
  sources: SourceRef[];
}> {
  const sources: SourceRef[] = [];
  const out: IHOAttendee[] = [];
  try {
    const rows = await fetchSheet({ id: IHO_2025_SHEET_ID, gid: IHO_2025_GID });
    sources.push({
      url: `https://docs.google.com/spreadsheets/d/${IHO_2025_SHEET_ID}/edit?gid=${IHO_2025_GID}`,
      fetched: new Date().toISOString(),
      notes: '2025 IHO Paris — official competing student list',
    });
    // Find header row
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const lower = rows[i].map((c) => c.toLowerCase());
      if (lower.includes('first name') && lower.includes('last name')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) return { attendees: out, sources };
    const header = rows[headerIdx].map((c) => c.trim().toLowerCase());
    const fnC = header.indexOf('first name');
    const lnC = header.indexOf('last name');
    const divC = header.indexOf('division');
    const affC = header.findIndex((c) => /affili/.test(c));
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const fn = (r[fnC] || '').trim();
      const ln = (r[lnC] || '').trim();
      if (!fn || !ln) continue;
      out.push({
        firstName: fn,
        lastName: ln,
        division: r[divC] || '',
        affiliation: affC >= 0 ? r[affC] : undefined,
        year: 2025,
      });
    }
  } catch (err) {
    sources.push({
      url: `sheet:${IHO_2025_SHEET_ID}`,
      fetched: new Date().toISOString(),
      notes: `fetch failed: ${(err as Error).message}`,
    });
  }
  return { attendees: out, sources };
}

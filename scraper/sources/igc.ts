import { PDFParse } from 'pdf-parse';
import { fetchBinaryCached } from '../fetch';
import type { SourceRef } from '../../src/data/schema';

// Most recent IGC event for which a participant list exists.
const IGC_2024_PDF =
  'https://geochampionships.com/wp-content/uploads/2024/08/2024-International-Geography-Championships-Student-Participation-List.pdf';

export interface IGCAttendee {
  firstName: string;
  lastName: string;
  school?: string;
  state?: string;
  division: string;
  year: number;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
}

export async function fetchIGC(): Promise<{
  attendees: IGCAttendee[];
  sources: SourceRef[];
}> {
  const sources: SourceRef[] = [];
  const out: IGCAttendee[] = [];
  try {
    const buf = await fetchBinaryCached(IGC_2024_PDF);
    sources.push({
      url: IGC_2024_PDF,
      fetched: new Date().toISOString(),
      notes: '2024 IGC Vienna — official student participation list',
    });
    const parser = new PDFParse({ data: buf });
    const { text } = await parser.getText();
    const lines = text.split('\n');
    let currentDivision = '';
    for (const line of lines) {
      const l = line.trim();
      // Division header: e.g. "High School Division – 88 Students ..."
      const divHdr = l.match(/^(High School|Middle School|Intermediate|Elementary School)\s+Division\s*[–-]/i);
      if (divHdr) {
        currentDivision = divHdr[1];
        continue;
      }
      // Numbered entry: e.g. "25. Daniel Mun, Woodinville High School, WA"
      const m = l.match(/^\d+\.\s*(.+)$/);
      if (!m || !currentDivision) continue;
      const parts = m[1].split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length < 1) continue;
      const { firstName, lastName } = splitName(parts[0]);
      const last = parts[parts.length - 1];
      // Parenthesized "(playing for X)" — strip for state
      const stateRaw = last.replace(/\s*\(.*?\)\s*$/, '').trim();
      out.push({
        firstName,
        lastName,
        school: parts.length >= 2 ? parts[1] : undefined,
        state: parts.length >= 3 ? stateRaw : undefined,
        division: currentDivision,
        year: 2024,
      });
    }
  } catch (err) {
    sources.push({
      url: IGC_2024_PDF,
      fetched: new Date().toISOString(),
      notes: `fetch/parse failed: ${(err as Error).message}`,
    });
  }
  return { attendees: out, sources };
}

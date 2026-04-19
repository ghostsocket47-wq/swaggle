import { fetchCached } from '../fetch';

export interface SheetRef {
  id: string;
  gid?: string | null;
}

export function sheetExportUrl(ref: SheetRef): string {
  const gidPart = ref.gid ? `&gid=${ref.gid}` : '';
  return `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=csv${gidPart}`;
}

// Very forgiving CSV parser (handles quoted cells with commas + newlines).
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  let field = '';
  let row: string[] = [];
  let quoted = false;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      quoted = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function fetchSheet(ref: SheetRef): Promise<string[][]> {
  const url = sheetExportUrl(ref);
  const text = await fetchCached(url);
  return parseCSV(text);
}

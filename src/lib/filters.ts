import type { RankedRow } from './scoring';

export function searchRows(rows: RankedRow[], query: string): RankedRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(({ player }) =>
    [player.name, player.state, player.school, player.chapter]
      .filter(Boolean)
      .some((s) => (s as string).toLowerCase().includes(q)),
  );
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

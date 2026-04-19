import type { Result } from '../data/schema';

function Placement({ p, qualified }: { p: number; qualified: boolean }) {
  if (p === 1)
    return (
      <span className="chip bg-blue-500 text-canvas font-semibold">1st</span>
    );
  if (p <= 3) return <span className="chip-blue">#{p}</span>;
  if (p <= 10) return <span className="chip-blue">#{p}</span>;
  if (qualified) return <span className="chip-muted">#{p} · qual</span>;
  return <span className="chip-muted">#{p}</span>;
}

export default function ResultsTimeline({ results }: { results: Result[] }) {
  const byYear = [2026, 2025].map((y) => ({
    year: y,
    rows: results.filter((r) => r.year === y).sort((a, b) => a.placement - b.placement),
  }));
  return (
    <div className="space-y-4">
      {byYear.map(({ year, rows }) => (
        <div key={year} className="card p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display text-lg font-semibold text-ink">{year}</h3>
            <span className="text-xs text-muted">
              Grade {year === 2026 ? 8 : 7}
            </span>
          </div>
          {rows.length === 0 ? (
            <div className="text-sm text-muted italic">No recorded results</div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Placement p={r.placement} qualified={r.qualifiedToNationals} />
                  <span
                    className={`chip ${
                      r.circuit === 'IAC'
                        ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                        : 'bg-white/5 text-ink border border-white/10'
                    }`}
                  >
                    {r.circuit}
                  </span>
                  <span className="chip-muted">
                    {r.subject === 'history' ? 'History' : 'Geo'}
                  </span>
                  <span className="chip-muted">
                    {r.level === 'national' ? 'National' : 'Regional'}
                  </span>
                  {r.playoff && (
                    <span className="chip-blue">
                      {r.playoff === 'finalist'
                        ? 'Finalist +40'
                        : r.playoff === 'semifinalist'
                        ? 'Semifinalist +22'
                        : 'Quarterfinalist +10'}
                    </span>
                  )}
                  {r.regionTier && r.regionTier !== 'standard' && (
                    <span className="chip-blue">{r.regionTier}</span>
                  )}
                  <span className="text-muted flex-1 truncate">{r.event}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

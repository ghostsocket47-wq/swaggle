import { Link } from 'react-router-dom';
import type { RankedRow } from '../lib/scoring';

interface Props {
  rows: RankedRow[];
}

export default function LeaderboardTable({ rows }: Props) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
          <tr>
            <th className="px-4 py-3 w-14">#</th>
            <th className="px-4 py-3">Player</th>
            <th className="px-3 py-3 text-center">State</th>
            <th className="px-3 py-3 text-center">State #</th>
            <th className="px-4 py-3 text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ rank, player, score, stateRank }) => {
            const isTop = rank === 1;
            return (
              <tr
                key={player.id}
                className="border-b border-border/50 hover:bg-white/[0.03] transition-colors"
              >
                <td className="px-4 py-3 align-middle">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded text-xs font-semibold tabular-nums ${
                      isTop
                        ? 'bg-blue-500 text-canvas'
                        : rank <= 3
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'text-muted'
                    }`}
                  >
                    {rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/player/${player.id}`}
                    className="font-medium text-ink hover:text-blue-300 transition-colors"
                  >
                    {player.name}
                  </Link>
                  <div className="text-xs text-muted">
                    {[player.school, player.chapter].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td className="px-3 py-3 text-center text-muted">{player.state}</td>
                <td className="px-3 py-3 text-center text-muted tabular-nums">
                  {stateRank ?? '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-display text-base font-bold text-blue-300">
                  {score.total.toFixed(1).replace(/\.0$/, '')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

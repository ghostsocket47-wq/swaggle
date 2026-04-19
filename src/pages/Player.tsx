import { Link, useParams } from 'react-router-dom';
import dataset from '../data/results.json';
import type { Dataset } from '../data/schema';
import { rankPlayers, scorePlayer } from '../lib/scoring';

const data = dataset as unknown as Dataset;

export default function PlayerPage() {
  const { id } = useParams();
  const player = data.players.find((p) => p.id === id);
  if (!player) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Player not found</h1>
        <Link to="/" className="text-blue-300 hover:underline mt-2 inline-block">
          Back
        </Link>
      </div>
    );
  }

  const historyRank = rankPlayers(data.players, 'history').find((r) => r.player.id === player.id);
  const histScore = scorePlayer(player, 'history');
  const pts = histScore.total.toFixed(1).replace(/\.0$/, '');

  return (
    <div className="py-8">
      <Link to="/history" className="text-sm text-muted hover:text-blue-300">
        Back to leaderboard
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="font-display text-4xl font-bold text-ink">{player.name}</h1>
        <div className="mt-1 text-muted text-sm">
          {[player.school, player.chapter, player.state].filter(Boolean).join(' · ')}
        </div>
      </header>

      {historyRank && (
        <section className="card p-8 max-w-xl">
          <div className="text-xs uppercase tracking-widest text-blue-300 font-semibold mb-3">
            National History Bee Ranking
          </div>
          <p className="text-lg text-ink leading-relaxed">
            <span className="font-semibold">{player.name}</span> is ranked{' '}
            <span className="font-display font-bold text-3xl text-blue-300">
              #{historyRank.rank}
            </span>{' '}
            among 8th graders in the nation with{' '}
            <span className="font-display font-bold text-3xl text-blue-300">
              {pts}
            </span>{' '}
            points.
          </p>
        </section>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import dataset from '../data/results.json';
import type { Dataset } from '../data/schema';
import { rankPlayers } from '../lib/scoring';
import { searchRows } from '../lib/filters';
import LeaderboardTable from '../components/LeaderboardTable';
import LeaderboardControls from '../components/LeaderboardControls';

const data = dataset as unknown as Dataset;

export default function HistoryLeaderboard() {
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const allRows = useMemo(() => rankPlayers(data.players, 'history'), []);
  const rows = useMemo(() => allRows.slice(0, 300), [allRows]);
  const stateList = useMemo(
    () => [...new Set(allRows.map((r) => r.player.state).filter(Boolean))].sort() as string[],
    [allRows],
  );
  const filtered = useMemo(() => {
    let out = rows;
    if (state) out = out.filter((r) => r.player.state === state);
    return searchRows(out, q);
  }, [rows, q, state]);

  return (
    <div className="py-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            National History Bee Ranking — 8th Graders
          </h1>
          <p className="text-sm text-muted mt-1">
            Top <span className="text-blue-300 font-semibold">300 in the nation</span>
          </p>
        </div>
        <LeaderboardControls
          query={q}
          onQuery={setQ}
          state={state}
          onState={setState}
          states={stateList}
        />
      </header>
      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          No players match {q ? `"${q}"` : `state ${state}`}
        </div>
      ) : (
        <LeaderboardTable rows={filtered} />
      )}
    </div>
  );
}

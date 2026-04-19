interface Props {
  query: string;
  onQuery: (q: string) => void;
  state: string;
  onState: (s: string) => void;
  states: string[];
}

export default function LeaderboardControls({
  query,
  onQuery,
  state,
  onState,
  states,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={state}
        onChange={(e) => onState(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-panel text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
      >
        <option value="">All states</option>
        {states.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search name, school, state"
        className="px-3 py-2 rounded-lg border border-border bg-panel text-sm text-ink placeholder:text-muted w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
      />
    </div>
  );
}

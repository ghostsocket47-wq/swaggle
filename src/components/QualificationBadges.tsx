import type { Player } from '../data/schema';

export default function QualificationBadges({ p }: { p: Player }) {
  const q = p.qualifications;
  return (
    <div className="flex flex-wrap gap-1.5">
      {q.ihoAttended && <span className="chip-blue">IHO 2025 Attended</span>}
      {q.ihoEligible && <span className="chip-blue">IHO 2027 Qualified</span>}
      {p.madeHistoryNationals2026 && (
        <span className="chip-muted">IAC History Nationals 2026</span>
      )}
    </div>
  );
}

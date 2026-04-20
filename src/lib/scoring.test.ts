import { describe, it, expect } from 'vitest';
import {
  resultPoints,
  scorePlayer,
  rankPlayers,
  IHO_ATTENDED_BONUS,
  IHO_ELIGIBLE_BONUS,
  IGC_ATTENDED_BONUS,
  IGC_ELIGIBLE_BONUS,
} from './scoring';
import type { Player, Result } from '../data/schema';

const mk = (r: Partial<Result>): Result => ({
  year: 2026,
  grade: 8,
  circuit: 'IAC',
  subject: 'history',
  level: 'national',
  event: 'test',
  placement: 1,
  qualifiedToNationals: true,
  ...r,
});

describe('resultPoints — fixed point table', () => {
  it('IAC national 1st = 500 (huge premium for #1)', () => {
    expect(resultPoints(mk({ circuit: 'IAC', level: 'national', placement: 1 }))).toBe(500);
  });
  it('NSF national 1st = 450', () => {
    expect(resultPoints(mk({ circuit: 'NSF', level: 'national', placement: 1 }))).toBe(450);
  });
  it('#1 has much bigger gap vs top 3', () => {
    const p1 = resultPoints(mk({ circuit: 'IAC', level: 'national', placement: 1 }));
    const p3 = resultPoints(mk({ circuit: 'IAC', level: 'national', placement: 3 }));
    expect(p1 - p3).toBeGreaterThanOrEqual(200);
  });
  it('national performance >> regional performance', () => {
    const nat10 = resultPoints(mk({ circuit: 'IAC', level: 'national', placement: 10 }));
    const reg1 = resultPoints(mk({ circuit: 'IAC', level: 'regional', placement: 1 }));
    expect(nat10).toBeGreaterThan(reg1); // even 10th at nationals > regional champ
  });
  it('IAC regional top-3 scores; 4+ scores 0', () => {
    expect(resultPoints(mk({ circuit: 'IAC', level: 'regional', placement: 1 }))).toBe(50);
    expect(resultPoints(mk({ circuit: 'IAC', level: 'regional', placement: 3 }))).toBe(18);
    expect(resultPoints(mk({ circuit: 'IAC', level: 'regional', placement: 4 }))).toBe(0);
  });
  it('Playoff boost stacks on top of placement — finalist is massive', () => {
    const r = mk({ circuit: 'IAC', level: 'national', placement: 5, playoff: 'finalist' });
    expect(resultPoints(r)).toBe(180 + 80);
  });
  it('Semifinalist + Quarterfinalist boosts are substantial', () => {
    const semi = resultPoints(
      mk({ circuit: 'IAC', level: 'national', placement: 15, playoff: 'semifinalist' }),
    );
    const quarter = resultPoints(
      mk({ circuit: 'IAC', level: 'national', placement: 35, playoff: 'quarterfinalist' }),
    );
    expect(semi).toBeGreaterThanOrEqual(100); // ~75 placement + 50 boost
    expect(quarter).toBeGreaterThanOrEqual(70); // 45 + 30
  });
});

describe('scorePlayer — no superscoring, both bonuses apply', () => {
  const player: Player = {
    id: 'test',
    name: 'Test Kid',
    madeHistoryNationals2026: true,
    madeGeoNationals2026: false,
    qualifications: { ihoAttended: true, ihoEligible: true, igcAttended: true, igcEligible: true },
    results: [
      mk({ year: 2026, circuit: 'IAC', level: 'national', placement: 3 }),
      mk({ year: 2026, circuit: 'IAC', level: 'regional', placement: 1 }),
      mk({ year: 2026, circuit: 'IAC', level: 'regional', placement: 5 }),
      mk({ year: 2025, circuit: 'IAC', level: 'national', placement: 10, grade: 7 }),
    ],
  };

  it('sums ALL regional results in a year (no best-of)', () => {
    const b = scorePlayer(player, 'history');
    const reg1 = resultPoints(mk({ circuit: 'IAC', level: 'regional', placement: 1 }));
    const reg5 = resultPoints(mk({ circuit: 'IAC', level: 'regional', placement: 5 }));
    const nat3 = resultPoints(mk({ circuit: 'IAC', level: 'national', placement: 3 }));
    expect(b.by2026).toBeCloseTo(nat3 + reg1 + reg5);
  });

  it('applies 50/50 year weights (2024 dropped)', () => {
    const b = scorePlayer(player, 'history');
    expect(b.weighted).toBeCloseTo(0.5 * b.by2026 + 0.5 * b.by2025);
  });

  it('IHO bonuses apply on history only', () => {
    const b = scorePlayer(player, 'history');
    expect(b.bonus).toBe(IHO_ATTENDED_BONUS + IHO_ELIGIBLE_BONUS);
  });

  it('IGC bonuses apply on geo only', () => {
    const b = scorePlayer(player, 'geo');
    expect(b.bonus).toBe(IGC_ATTENDED_BONUS + IGC_ELIGIBLE_BONUS);
  });
});

describe('rankPlayers — IHO-qualified included in history, IGC in geo', () => {
  it('IHO-qualified appears on history even without nationals qual', () => {
    const p: Player = {
      id: 'iho-only',
      name: 'IHO Only',
      madeHistoryNationals2026: false,
      madeGeoNationals2026: false,
      qualifications: { ihoAttended: true, ihoEligible: false, igcAttended: false, igcEligible: false },
      results: [],
    };
    const rows = rankPlayers([p], 'history');
    expect(rows.length).toBe(1);
  });
  it('IGC-qualified appears on geo even without nationals qual', () => {
    const p: Player = {
      id: 'igc-only',
      name: 'IGC Only',
      madeHistoryNationals2026: false,
      madeGeoNationals2026: false,
      qualifications: { ihoAttended: false, ihoEligible: false, igcAttended: true, igcEligible: false },
      results: [],
    };
    const rows = rankPlayers([p], 'geo');
    expect(rows.length).toBe(1);
  });
  it('non-qualified player is excluded', () => {
    const p: Player = {
      id: 'neither',
      name: 'No Quals',
      madeHistoryNationals2026: false,
      madeGeoNationals2026: false,
      qualifications: { ihoAttended: false, ihoEligible: false, igcAttended: false, igcEligible: false },
      results: [],
    };
    expect(rankPlayers([p], 'history').length).toBe(0);
    expect(rankPlayers([p], 'geo').length).toBe(0);
  });
});

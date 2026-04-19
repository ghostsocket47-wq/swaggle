export type Grade = 6 | 7 | 8;
export type Year = 2024 | 2025 | 2026;
export type Circuit = 'IAC' | 'NSF';
export type Subject = 'history' | 'geo';
export type Level = 'regional' | 'national';
export type RegionTier = 'elite' | 'strong' | 'standard';
// Playoff round reached at a national event (IAC EMS Nationals structure).
// "finalist" = made Finals, "semifinalist" = made Semis but not Finals,
// "quarterfinalist" = made Quarters but not Semis.
export type PlayoffRound = 'finalist' | 'semifinalist' | 'quarterfinalist';

export interface Result {
  year: Year;
  grade: Grade;
  circuit: Circuit;
  subject: Subject;
  level: Level;
  event: string;
  regionTier?: RegionTier;
  placement: number; // 1 = 1st
  fieldSize?: number;
  qualifiedToNationals: boolean;
  // At national events, the playoff round a player reached. Awards a flat
  // "made it to X" boost on top of the placement-based score.
  playoff?: PlayoffRound;
}

export interface Player {
  id: string;
  name: string;
  state?: string;
  chapter?: string;
  school?: string;
  madeHistoryNationals2026: boolean;
  madeGeoNationals2026: boolean;
  qualifications: {
    // `attended` = was on the roster at the past event (IHO Paris 2025 / IGC Vienna 2024)
    // `eligible` = qualified via 2025 IAC Nationals for the NEXT event (IHO 2027 / IGC 2026)
    ihoAttended: boolean;
    ihoEligible: boolean;
    igcAttended: boolean;
    igcEligible: boolean;
  };
  results: Result[];
}

export interface SourceRef {
  url: string;
  fetched: string;
  notes?: string;
}

export interface Dataset {
  players: Player[];
  lastUpdated: string;
  sources: SourceRef[];
}

// Modelo aditivo: cada predicción puede sumar puntos de 3 criterios
// independientes (no son mutuamente excluyentes como en el esquema viejo
// basado en una única categoría por predicción).
export type ScoringRuleKey = 'correct_outcome' | 'home_goals' | 'away_goals';

function calcOutcome(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

export function calcPoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  pointsMap: Record<ScoringRuleKey, number>,
): number {
  let points = 0;
  if (calcOutcome(predHome, predAway) === calcOutcome(realHome, realAway)) {
    points += pointsMap.correct_outcome;
  }
  if (predHome === realHome) points += pointsMap.home_goals;
  if (predAway === realAway) points += pointsMap.away_goals;
  return points;
}

export type NpsSummary = {
  score: number | null;
  average: number | null;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
};

export function calculateAttendanceRate(completed: number, missed: number): number | null {
  const denominator = Math.max(0, completed) + Math.max(0, missed);
  if (denominator === 0) return null;
  return Math.round((Math.max(0, completed) / denominator) * 100);
}

export function calculateNpsSummary(scores: number[]): NpsSummary {
  const valid = scores.filter((score) => Number.isFinite(score) && score >= 0 && score <= 10);
  if (!valid.length) {
    return { score: null, average: null, responses: 0, promoters: 0, passives: 0, detractors: 0 };
  }

  const promoters = valid.filter((score) => score >= 9).length;
  const detractors = valid.filter((score) => score <= 6).length;
  const passives = valid.length - promoters - detractors;
  const score = Math.round(((promoters - detractors) / valid.length) * 100);
  const average = Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;

  return { score, average, responses: valid.length, promoters, passives, detractors };
}

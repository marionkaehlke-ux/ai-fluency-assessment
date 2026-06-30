/** Returns the half-year cycle ID for the given date, e.g. "2026-H1" or "2026-H2". */
export function getCurrentCycle(date = new Date()): string {
  const year = date.getUTCFullYear();
  const half = date.getUTCMonth() < 6 ? 'H1' : 'H2';
  return `${year}-${half}`;
}

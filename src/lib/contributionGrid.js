import { addDaysToKey, toDateKey } from './dateKeys.js';

/**
 * @param {string} key YYYY-MM-DD
 * @param {number} weekStartsOn 0 = Sunday … 6 = Saturday
 * @returns {string}
 */
export function startOfWeekDateKey(key, weekStartsOn = 0) {
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  dt.setDate(dt.getDate() - diff);
  return toDateKey(dt);
}

/**
 * Map RTDB day summary to heat level (GitHub-like buckets).
 *
 * @param {{ totalCount?: number, completedCount?: number, allDone?: boolean } | null | undefined} summary
 * @returns {number} 0 = empty/no tasks, 1–4 = partial tiers, 5 = fully complete day
 */
export function contributionLevel(summary) {
  if (!summary) {
    return 0;
  }
  const total = summary.totalCount ?? 0;
  if (total === 0) {
    return 0;
  }
  const done = summary.completedCount ?? 0;
  if (summary.allDone || done === total) {
    return 5;
  }
  // Zero tasks checked but day had work planned → no green (not "lowest tier").
  // Otherwise 0/total = 0% wrongly matched r <= 0.25 and showed faint green.
  if (done === 0) {
    return 0;
  }
  const r = done / total;
  if (r <= 0.25) {
    return 1;
  }
  if (r <= 0.5) {
    return 2;
  }
  if (r <= 0.75) {
    return 3;
  }
  return 4;
}

/**
 * @typedef {object} ContributionCell
 * @property {string} dateKey
 * @property {number} level
 * @property {boolean} isFuture Dates after `endKey` (muted, no press).
 */

/**
 * @typedef {ContributionCell[]} ContributionColumn
 */

/**
 * Columns = calendar weeks (oldest → newest left to right); each column is 7 days.
 * Rows follow `weekStartsOn` order (default Sunday first).
 *
 * @param {object} opts
 * @param {string} opts.endKey
 * @param {number} opts.numWeeks
 * @param {number} [opts.weekStartsOn]
 * @param {Record<string, { totalCount?: number, completedCount?: number, allDone?: boolean }>} [opts.summaries]
 * @returns {{ weeks: ContributionColumn[], weekStartsOn: number }}
 */
export function buildWeekColumns({ endKey, numWeeks, weekStartsOn = 0, summaries = {} }) {
  const sundayOfWeekContainingEnd = startOfWeekDateKey(endKey, weekStartsOn);
  const gridStart = addDaysToKey(sundayOfWeekContainingEnd, -(numWeeks - 1) * 7);

  /** @type {ContributionColumn[]} */
  const weeks = [];

  for (let w = 0; w < numWeeks; w++) {
    /** @type {ContributionCell[]} */
    const col = [];
    for (let r = 0; r < 7; r++) {
      const dateKey = addDaysToKey(gridStart, w * 7 + r);
      const isFuture = dateKey > endKey;
      const raw = summaries[dateKey];
      const level = isFuture ? 0 : contributionLevel(raw);

      col.push({
        dateKey,
        level,
        isFuture,
      });
    }
    weeks.push(col);
  }

  return { weeks, weekStartsOn };
}

/**
 * Abbreviations for weekdays in column order matching `weekStartsOn` rows (row 0 = first weekday).
 *
 * @param {number} weekStartsOn 0 = Sunday …
 * @returns {string[]}
 */
export function weekdayRowLabels(weekStartsOn = 0) {
  const base = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const doubled = [...base, ...base];
  return doubled.slice(weekStartsOn, weekStartsOn + 7);
}

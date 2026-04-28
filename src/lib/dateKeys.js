/**
 * @param {Date} d
 * @returns {string}
 */
export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} key YYYY-MM-DD
 * @param {number} offsetDays
 * @returns {string}
 */
export function addDaysToKey(key, offsetDays) {
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10));
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offsetDays);
  return toDateKey(date);
}

/**
 * @param {number} n number of days including today, backward
 * @returns {string[]}
 */
export function lastNDaysFromToday(n) {
  return lastNDaysFromKey(toDateKey(new Date()), n);
}

/**
 * @param {string} startKey
 * @param {number} n
 * @returns {string[]}
 */
export function lastNDaysFromKey(startKey, n) {
  const out = [];
  let cur = startKey;
  for (let i = 0; i < n; i++) {
    out.push(cur);
    cur = addDaysToKey(cur, -1);
  }
  return out;
}

/**
 * Last n calendar days ending at `endKey`, oldest first (for charts and CSV).
 * @param {string} endKey
 * @param {number} n
 * @returns {string[]}
 */
export function lastNDayKeysChronological(endKey, n) {
  return lastNDaysFromKey(endKey, n).slice().reverse();
}

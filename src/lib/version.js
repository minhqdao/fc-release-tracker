/**
 * Minimal version comparison for the version schemes used by the compilers:
 * AOCC "5.0.0", nvfortran "25.7", ifx "2025.2".
 */

function parseVersion(v) {
  return String(v)
    .split(/[.\-+]/)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/**
 * True if `candidate` is strictly newer than `current`.
 * A null/undefined `current` (first observed version) always counts as newer.
 * @param {string} candidate
 * @param {string|null|undefined} current
 * @returns {boolean}
 */
export function isNewer(candidate, current) {
  if (current == null) return true;
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x > y;
    return String(x) > String(y);
  }
  return false;
}

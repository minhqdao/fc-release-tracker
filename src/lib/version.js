/**
 * Minimal version comparison for the version schemes used by the compilers:
 * AOCC "5.0.0", nvfortran "25.7", ifx "2025.2". The single ordering
 * primitive is compareVersions(); both isNewer (index.js) and maxVersion
 * (lib/http.js) are built on it.
 */

function parseVersion(v) {
  return String(v)
    .split(/[.\-+]/)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/**
 * Three-way comparison: -1 if a < b, 1 if a > b, 0 if equal. Versions split
 * on dots, dashes, and plus signs; purely numeric segments compare
 * numerically, anything else lexicographically as a string; missing
 * segments count as 0. Intended for dotted numeric version schemes —
 * callers pre-filter their candidates to those shapes, so non-numeric
 * segments are a defensive fallback rather than a supported input.
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}
 */
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] ?? 0;
    const q = y[i] ?? 0;
    if (p === q) continue;
    if (typeof p === "number" && typeof q === "number") {
      return p < q ? -1 : 1;
    }
    return String(p) < String(q) ? -1 : 1;
  }
  return 0;
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
  return compareVersions(candidate, current) > 0;
}

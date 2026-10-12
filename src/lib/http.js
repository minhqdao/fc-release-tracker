/**
 * Shared helpers for fetching and parsing compiler release pages.
 *
 * Intentionally dependency-free: uses Node's built-in fetch.
 */

import { compareVersions } from "./version.js";

const USER_AGENT = "Mozilla/5.0";

// GitHub's API allows only 60 anonymous requests per hour per IP, which shared
// runner IPs exhaust immediately. Authenticate GitHub hosts only, so the
// workflow token is never sent to third-party sources.
const GITHUB_HOSTS = new Set(["github.com", "api.github.com"]);

/**
 * Authorization header for GitHub hosts when GITHUB_TOKEN is set, else {}.
 * @param {string} url
 * @returns {Record<string, string>}
 */
export function authHeaders(url) {
  const token = process.env.GITHUB_TOKEN;
  if (!token || !GITHUB_HOSTS.has(new URL(url).hostname)) return {};
  return { Authorization: `Bearer ${token}` };
}

export const FETCH_TIMEOUT_MS = 30_000;

/**
 * Fetch a URL with the shared UA/timeout policy and return the Response
 * once status is known to be ok.
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchOk(url) {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, ...authHeaders(url) },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res;
}

/**
 * Fetch a URL and return its body as text.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchText(url) {
  return (await fetchOk(url)).text();
}

/**
 * Fetch a URL and return its raw bytes (e.g. gzip-compressed apt indexes).
 * @param {string} url
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchBytes(url) {
  return (await fetchOk(url)).arrayBuffer();
}

/**
 * Pick the greatest version from a list of candidate strings, ordered by
 * lib/version.js. Candidates must be dotted numeric versions — every caller
 * regex-filters its inputs before calling. Deterministic on any input:
 * numerically equal spellings ("16.1" vs "16.1.0") tie-break
 * lexicographically toward the more specific one, and non-numeric segments
 * compare as strings instead of collapsing to NaN.
 * @param {string[]} candidates
 * @returns {string}
 */
export function maxVersion(candidates) {
  const seen = [...new Set(candidates)];
  if (seen.length === 0) {
    throw new Error("no version candidates found");
  }
  seen.sort((a, b) => {
    const order = compareVersions(b, a); // descending
    if (order !== 0) return order;
    // Numerically equal but differently spelled ("16.1" vs "16.1.0"): pick
    // deterministically so the result never depends on input order.
    return a < b ? 1 : a > b ? -1 : 0;
  });
  return seen[0];
}

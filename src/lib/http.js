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

/** Pause before the one retry of a transient failure. */
export const RETRY_DELAY_MS = 1_000;

/**
 * Statuses worth a second attempt. Deliberately no 429: a rate limit does not
 * clear in a second, and waiting out `Retry-After` can mean minutes — that is
 * a failure to report, not to paper over.
 */
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);

/**
 * Socket-level failures worth a second attempt. A stalled connection is
 * treated as transient too (30s spent, but the run has budget for a second
 * attempt); a wrong hostname is not.
 */
const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientNetworkError(err) {
  // AbortSignal.timeout rejects with a TimeoutError DOMException; undici
  // reports socket failures as a TypeError carrying `cause.code`.
  return err?.name === "TimeoutError" || TRANSIENT_CODES.has(err?.cause?.code);
}

/**
 * Fetch a URL with the shared UA/timeout policy and return the Response
 * once status is known to be ok. Transient failures (5xx, reset/stalled
 * connections) get exactly one retry after RETRY_DELAY_MS; anything else —
 * 4xx, a second consecutive transient failure — throws immediately.
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchOk(url) {
  for (let attempt = 0; ; attempt++) {
    let retryable = false;
    let err;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT, ...authHeaders(url) },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.ok) return res;
      // Nobody reads an error body; cancel it so the socket is not parked
      // until the process exits.
      await res.body?.cancel().catch(() => {});
      retryable = TRANSIENT_STATUSES.has(res.status);
      err = new Error(`fetch failed: ${res.status} ${res.statusText} (${url})`);
    } catch (cause) {
      retryable = isTransientNetworkError(cause);
      err = cause;
    }
    if (!retryable || attempt > 0) throw err;
    await sleep(RETRY_DELAY_MS);
  }
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

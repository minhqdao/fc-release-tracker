/**
 * Shared helpers for fetching and parsing compiler release pages.
 *
 * Intentionally dependency-free: uses Node's built-in fetch.
 */

const USER_AGENT = "Mozilla/5.0";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * Fetch a URL with the shared UA/timeout policy and return the Response
 * once status is known to be ok.
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchOk(url) {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
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
 * Pick the greatest version from a list of candidate strings.
 * Falls back to numeric comparison of dotted numbers so that CalVer
 * schemes ("2026.1.1") compare correctly alongside semver-like ones.
 * @param {string[]} candidates
 * @returns {string}
 */
export function maxVersion(candidates) {
  const seen = new Set(candidates);
  const parsed = [...seen].map((v) => ({
    v,
    parts: v.split(/[.-]/).map(Number),
  }));
  parsed.sort((a, b) => {
    const len = Math.max(a.parts.length, b.parts.length);
    for (let i = 0; i < len; i++) {
      const d = (b.parts[i] ?? 0) - (a.parts[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  });
  if (parsed.length === 0) {
    throw new Error("no version candidates found");
  }
  return parsed[0].v;
}

/**
 * Generic fallback: highest dotted version (>= 2 components) in the text.
 * @param {string} body - raw page content
 * @returns {string} latest version, e.g. "5.2.0"
 */
export function extractLatestVersion(body) {
  const candidates = [...body.matchAll(/\b(\d+\.\d+(?:\.\d+)*)\b/g)].map(
    (m) => m[1],
  );
  return maxVersion(candidates);
}

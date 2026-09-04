/**
 * Shared helpers for fetching and parsing compiler release pages.
 *
 * Intentionally dependency-free for now: use Node's built-in fetch.
 * TODO: add caching, retries, and a proper User-Agent header.
 */

/**
 * Fetch a URL and return its body as text.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchText(url) {
  // TODO: implement (timeout, retry, User-Agent, error handling).
  throw new Error(`fetchText not implemented (url: ${url})`);
}

/**
 * Extract the latest release version string from page text/markup.
 * @param {string} body - raw page content
 * @returns {string} latest version, e.g. "5.0.0"
 */
export function extractLatestVersion(body) {
  // TODO: implement per-compiler parsing.
  throw new Error("extractLatestVersion not implemented");
}

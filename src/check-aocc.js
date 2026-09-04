/**
 * AOCC (AMD Optimizing C/C++ and Fortran Compilers) release checker.
 *
 * Source of truth: https://developer.amd.com/amd-aocc/
 * AOCC releases are published as downloadable tarballs on the AMD developer
 * page; there is no public API, so this likely needs HTML scraping.
 */

import { fetchText, extractLatestVersion } from "./lib/http.js";

export const AOCC_PAGE_URL = "https://developer.amd.com/amd-aocc/";

/**
 * @returns {Promise<{ compiler: "aocc", latestVersion: string, url: string }>}
 */
export async function checkAOCC() {
  // TODO: fetch AOCC_PAGE_URL and parse the latest version (e.g. "5.0.0").
  const body = await fetchText(AOCC_PAGE_URL);
  const latestVersion = extractLatestVersion(body);
  return { compiler: "aocc", latestVersion, url: AOCC_PAGE_URL };
}

// Allow running standalone: npm run check:aocc
if (import.meta.url === `file://${process.argv[1]}`) {
  checkAOCC()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

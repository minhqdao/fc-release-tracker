/**
 * Intel ifx (Intel Fortran Compiler) release checker.
 *
 * Source of truth: Intel oneAPI releases. The ifx compiler ships inside the
 * oneAPI HPC Toolkit; release versions are listed on Intel's documentation
 * pages (e.g. https://www.intel.com/content/www/us/en/developer/articles/tool/release-notes-ifx.html)
 * TODO: confirm the most reliable page to scrape.
 */

import { fetchText, extractLatestVersion } from "./lib/http.js";

export const IFX_PAGE_URL =
  "https://www.intel.com/content/www/us/en/developer/articles/tool/release-notes-ifx.html";

/**
 * @returns {Promise<{ compiler: "ifx", latestVersion: string, url: string }>}
 */
export async function checkIfx() {
  // TODO: fetch the ifx release notes and parse the latest version
  // (e.g. "2025.2").
  const body = await fetchText(IFX_PAGE_URL);
  const latestVersion = extractLatestVersion(body);
  return { compiler: "ifx", latestVersion, url: IFX_PAGE_URL };
}

// Allow running standalone: node src/check-ifx.js
if (import.meta.url === `file://${process.argv[1]}`) {
  checkIfx()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

/**
 * NVIDIA nvfortran (HPC SDK) release checker.
 *
 * Source of truth: https://developer.nvidia.com/hpc-sdk releases, or the
 * NVIDIA HPC SDK release notes / downloads page.
 * TODO: confirm the most reliable page or feed to scrape (release notes
 * changelog is a good candidate).
 */

import { fetchText, extractLatestVersion } from "./lib/http.js";

export const NVPFORTRAN_PAGE_URL =
  "https://developer.nvidia.com/hpc-sdk-downloads";

/**
 * @returns {Promise<{ compiler: "nvfortran", latestVersion: string, url: string }>}
 */
export async function checkNvfortran() {
  // TODO: fetch the HPC SDK page and parse the latest version
  // (e.g. "25.7" or "25.7.0").
  const body = await fetchText(NVPFORTRAN_PAGE_URL);
  const latestVersion = extractLatestVersion(body);
  return { compiler: "nvfortran", latestVersion, url: NVPFORTRAN_PAGE_URL };
}

// Allow running standalone: npm run check:nvfortran
if (import.meta.url === `file://${process.argv[1]}`) {
  checkNvfortran()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

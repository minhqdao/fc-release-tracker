/**
 * NVIDIA nvfortran (HPC SDK) release checker.
 *
 * Source of truth: the Sphinx docs of the latest NVIDIA HPC SDK, whose page
 * title carries the version (https://docs.nvidia.com/hpc-sdk/release-notes/).
 */

import { fetchText } from "./lib/http.js";

export const NVFORTRAN_PAGE_URL =
  "https://docs.nvidia.com/hpc-sdk/release-notes/index.html";

/**
 * @returns {Promise<{ compiler: "nvfortran", latestVersion: string, url: string }>}
 */
export async function checkNvfortran() {
  // The Sphinx page title is always "<...> — HPC SDK Release Notes <ver> documentation"
  // and points at the docs of the newest SDK, which ships nvfortran.
  const body = await fetchText(NVFORTRAN_PAGE_URL);
  const match = body.match(
    /HPC SDK Release Notes\s+(\d+\.\d+(?:\.\d+)?)\s+documentation/i,
  );
  if (!match) {
    throw new Error(`no HPC SDK release marker found on ${NVFORTRAN_PAGE_URL}`);
  }
  const latestVersion = match[1];
  return { compiler: "nvfortran", latestVersion, url: NVFORTRAN_PAGE_URL };
}

// Allow running standalone: node src/check-nvfortran.js
if (import.meta.url === `file://${process.argv[1]}`) {
  checkNvfortran()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

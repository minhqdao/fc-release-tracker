/**
 * NVIDIA nvfortran (HPC SDK) release checker.
 *
 * Source of truth: the Sphinx docs of the latest NVIDIA HPC SDK, whose page
 * title carries the version (https://docs.nvidia.com/hpc-sdk/release-notes/).
 */

import { fetchText } from "./lib/http.js";
import { runStandalone } from "./lib/standalone.js";

export const NVFORTRAN_PAGE_URL =
  "https://docs.nvidia.com/hpc-sdk/release-notes/index.html";

/**
 * Extract the HPC SDK version from the release-notes page HTML.
 * @param {string} body
 * @returns {string} latest version, e.g. "26.5"
 */
export function parseNvfortran(body) {
  // The Sphinx page title is always "<...> — HPC SDK Release Notes <ver> documentation"
  // and points at the docs of the newest SDK, which ships nvfortran.
  const match = body.match(
    /HPC SDK Release Notes\s+(\d+\.\d+(?:\.\d+)?)\s+documentation/i,
  );
  if (!match) {
    throw new Error(`no HPC SDK release marker found on ${NVFORTRAN_PAGE_URL}`);
  }
  return match[1];
}

/**
 * @returns {Promise<{ compiler: "nvfortran", latestVersion: string, url: string }>}
 */
export async function checkNvfortran() {
  const latestVersion = parseNvfortran(await fetchText(NVFORTRAN_PAGE_URL));
  return { compiler: "nvfortran", latestVersion, url: NVFORTRAN_PAGE_URL };
}

// Allow running standalone: node src/check-nvfortran.js
runStandalone(import.meta.url, checkNvfortran);

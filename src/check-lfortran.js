/**
 * LFortran release checker.
 *
 * Source of truth: the conda-forge `lfortran` package via Anaconda.org's
 * public API — the same (and per setup-fortran's comments, the only
 * current) binary distribution channel used on Linux, macOS, and Windows:
 * https://api.anaconda.org/package/conda-forge/lfortran
 * Versions are plain `0.x.y` dotted numbers shared across all platforms.
 */

import { fetchText, maxVersion } from "./lib/http.js";
import { runStandalone } from "./lib/standalone.js";

export const LFORTRAN_CONDA_URL =
  "https://api.anaconda.org/package/conda-forge/lfortran";

// Human-facing source link (the API URL above is what we actually read).
export const LFORTRAN_PAGE_URL = "https://anaconda.org/conda-forge/lfortran";

/**
 * Extract the latest dotted version from the Anaconda.org JSON body.
 * @param {string} body
 * @returns {string} latest version, e.g. "0.65.0"
 */
export function parseLFortran(body) {
  const data = JSON.parse(body);
  const candidates = (data.versions ?? []).filter((v) =>
    /^\d+\.\d+(\.\d+)?$/.test(v),
  );
  if (candidates.length === 0) {
    throw new Error(`no lfortran versions found at ${LFORTRAN_CONDA_URL}`);
  }
  return maxVersion(candidates);
}

/**
 * @returns {Promise<{ compiler: "lfortran", latestVersion: string, url: string }>}
 */
export async function checkLFortran() {
  const latestVersion = parseLFortran(await fetchText(LFORTRAN_CONDA_URL));
  return { compiler: "lfortran", latestVersion, url: LFORTRAN_PAGE_URL };
}

// Allow running standalone: node src/check-lfortran.js
runStandalone(import.meta.url, checkLFortran);

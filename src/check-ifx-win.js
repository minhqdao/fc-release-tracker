/**
 * Intel ifx (Intel Fortran Compiler) - Windows channel.
 *
 * Source of truth: the conda-forge `ifx_win-64` package via Anaconda.org's
 * public API. Intel's Windows installer/download centre releases ifx
 * noticeably later than the Linux APT channel (and does not expose a simple
 * version index of its own), while conda-forge repackages the same Intel
 * Windows compiler with the identical upstream version number. Tracking
 * this channel separately keeps the Windows availability timeline visible
 * even when the version number matches the Linux release.
 *
 * `ifx-linux` (in check-ifx-linux.js) continues to track the earliest/most
 * granular Linux APT channel.
 */

import { fetchText, maxVersion } from "./lib/http.js";
import { runStandalone } from "./lib/standalone.js";

export const IFX_WIN_CONDA_URL =
  "https://api.anaconda.org/package/conda-forge/ifx_win-64";

// Human-facing source link (the API URL above is what we actually read).
export const IFX_WIN_PAGE_URL = "https://anaconda.org/conda-forge/ifx_win-64";

/**
 * Extract the latest dotted version from the Anaconda.org JSON body.
 * @param {string} body
 * @returns {string} latest version, e.g. "2026.1.1"
 */
export function parseIfxWin(body) {
  const data = JSON.parse(body);
  const candidates = (data.versions ?? []).filter((v) =>
    /^\d{4}\.\d+(?:\.\d+)?$/.test(v),
  );
  if (candidates.length === 0) {
    throw new Error(`no ifx_win-64 versions found at ${IFX_WIN_CONDA_URL}`);
  }
  return maxVersion(candidates);
}

/**
 * @returns {Promise<{ compiler: "ifx-win", latestVersion: string, url: string }>}
 */
export async function checkIfxWin() {
  const latestVersion = parseIfxWin(await fetchText(IFX_WIN_CONDA_URL));
  return { compiler: "ifx-win", latestVersion, url: IFX_WIN_PAGE_URL };
}

// Allow running standalone: node src/check-ifx-win.js
runStandalone(import.meta.url, checkIfxWin);
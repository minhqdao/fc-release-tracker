/**
 * GFortran (GCC) release checker — Homebrew channel (macOS).
 *
 * Source of truth: Homebrew's official formula JSON API for the `gcc`
 * formula: https://formulae.brew.sh/api/formula/gcc.json → versions.stable.
 * This is the exact version `brew install gcc` (and freshly bottled
 * `brew install gcc@<major>`) resolves to; it lags upstream GCC while
 * Brew maintains/publishes the bottle.
 */

import { fetchText } from "./lib/http.js";
import { runStandalone } from "./lib/standalone.js";

export const GFORTRAN_BREW_URL = "https://formulae.brew.sh/api/formula/gcc.json";

// Human-facing source link (the JSON API above is what we actually read).
export const GFORTRAN_BREW_PAGE_URL = "https://formulae.brew.sh/formula/gcc";

/**
 * Extract the stable gcc version from the formula JSON body.
 * @param {string} body
 * @returns {string} latest version, e.g. "16.2.0"
 */
export function parseGFortranBrew(body) {
  const data = JSON.parse(body);
  const latestVersion = data.versions?.stable;
  if (typeof latestVersion !== "string" || !/^\d+\.\d+(\.\d+)?$/.test(latestVersion)) {
    throw new Error(
      `unexpected brew gcc stable version in ${GFORTRAN_BREW_URL}: ${String(latestVersion)}`,
    );
  }
  return latestVersion;
}

/**
 * @returns {Promise<{ compiler: "gfortran-brew", latestVersion: string, url: string }>}
 */
export async function checkGFortranBrew() {
  const latestVersion = parseGFortranBrew(await fetchText(GFORTRAN_BREW_URL));
  return { compiler: "gfortran-brew", latestVersion, url: GFORTRAN_BREW_PAGE_URL };
}

// Allow running standalone: node src/check-gfortran-brew.js
runStandalone(import.meta.url, checkGFortranBrew);

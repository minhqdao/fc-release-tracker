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

export const GFORTRAN_BREW_URL = "https://formulae.brew.sh/api/formula/gcc.json";

/**
 * @returns {Promise<{ compiler: "gfortran-brew", latestVersion: string, url: string }>}
 */
export async function checkGFortranBrew() {
  const data = JSON.parse(await fetchText(GFORTRAN_BREW_URL));
  const latestVersion = data.versions?.stable;
  if (typeof latestVersion !== "string" || !/^\d+\.\d+(\.\d+)?$/.test(latestVersion)) {
    throw new Error(
      `unexpected brew gcc stable version in ${GFORTRAN_BREW_URL}: ${String(latestVersion)}`,
    );
  }
  return { compiler: "gfortran-brew", latestVersion, url: GFORTRAN_BREW_URL };
}

// Allow running standalone: node src/check-gfortran-brew.js
if (import.meta.url === `file://${process.argv[1]}`) {
  checkGFortranBrew()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

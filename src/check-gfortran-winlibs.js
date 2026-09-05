/**
 * GFortran (GCC) release checker — winlibs channel (Windows).
 *
 * Source of truth: GitHub Releases API for brechtsanders/winlibs_mingw —
 * the exact releases setup-fortran's Windows installer pins. Release titles
 * start with "GCC <version> (POSIX threads)..."; the tag_name carries the
 * coupled gcc+mingw+w64+revision string, so we parse the title (fallback:
 * tag prefix). Winlibs publishes on its own schedule, typically lagging
 * upstream GCC by weeks.
 */

import { fetchText } from "./lib/http.js";

export const GFORTRAN_WINLIBS_URL =
  "https://api.github.com/repos/brechtsanders/winlibs_mingw/releases/latest";

/**
 * Extract the GCC version from the release JSON body (title, fallback: tag).
 * @param {string} body
 * @returns {string} latest version, e.g. "16.2.0"
 */
export function parseGFortranWinlibs(body) {
  const data = JSON.parse(body);
  const latestVersion =
    /^GCC (\d+\.\d+(?:\.\d+)?)/.exec(String(data.name))?.[1] ??
    /^(\d+\.\d+\.\d+)/.exec(String(data.tag_name))?.[1];
  if (!latestVersion) {
    throw new Error(`no GCC version found in winlibs release at ${GFORTRAN_WINLIBS_URL}`);
  }
  return latestVersion;
}

/**
 * @returns {Promise<{ compiler: "gfortran-winlibs", latestVersion: string, url: string }>}
 */
export async function checkGFortranWinlibs() {
  const latestVersion = parseGFortranWinlibs(await fetchText(GFORTRAN_WINLIBS_URL));
  return { compiler: "gfortran-winlibs", latestVersion, url: GFORTRAN_WINLIBS_URL };
}

// Allow running standalone: node src/check-gfortran-winlibs.js
if (import.meta.url === `file://${process.argv[1]}`) {
  checkGFortranWinlibs()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

/**
 * GFortran (GCC) release checker — apt/PPA channel (Ubuntu).
 *
 * Source of truth: the `Packages.gz` index of the ubuntu-toolchain-r/test
 * PPA (noble) — the very file apt itself consumes when setup-fortran adds
 * the PPA for versions Ubuntu's own archive lacks.
 *
 * This channel reports the NEWEST INSTALLABLE MAJOR (e.g. "16"), not a
 * full version string: apt snapshot builds predate any official release,
 * so their Version field looks like "16-20260315-1ubuntu1~24~ppa1"
 * (date-based, churns on every rebuild), and the action's apt path keys
 * off majors only (`gfortran-<N>` + needsPpa routing). A new package
 * stanza is exactly the actionable event; patch bumps need no edits and
 * their version strings would only generate noise.
 */

import { gunzipSync } from "node:zlib";

import { fetchBytes } from "./lib/http.js";

export const GFORTRAN_APT_INDEX_URL =
  "https://ppa.launchpadcontent.net/ubuntu-toolchain-r/test/ubuntu/dists/noble/main/binary-amd64/Packages.gz";

/**
 * @returns {Promise<{ compiler: "gfortran-apt", latestVersion: string, url: string }>}
 */
export async function checkGFortranApt() {
  const raw = await fetchBytes(GFORTRAN_APT_INDEX_URL);
  const text = gunzipSync(new Uint8Array(raw)).toString("utf8");
  const majors = new Set(
    [...text.matchAll(/^Package: gfortran-(\d+)$/gm)].map((m) => Number(m[1])),
  );
  if (majors.size === 0) {
    throw new Error(`no gfortran-* packages found in ${GFORTRAN_APT_INDEX_URL}`);
  }
  const latestVersion = String(Math.max(...majors));
  return { compiler: "gfortran-apt", latestVersion, url: GFORTRAN_APT_INDEX_URL };
}

// Allow running standalone: node src/check-gfortran-apt.js
if (import.meta.url === `file://${process.argv[1]}`) {
  checkGFortranApt()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

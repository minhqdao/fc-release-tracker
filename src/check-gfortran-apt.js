/**
 * GFortran (GCC) release checker — apt/PPA channel (Ubuntu).
 *
 * Source of truth: the `Packages.gz` index of the ubuntu-toolchain-r/test
 * PPA (noble) — the very file apt itself consumes when setup-fortran adds
 * the PPA for versions Ubuntu's own archive lacks.
 *
 * Tracks the NEWEST MAJOR in the archive. While that major only exists as
 * snapshot builds — whose date-based versions ("16-20260315-1ubuntu1~24~ppa1")
 * churn on every rebuild and carry no minor/patch — we report the bare
 * major ("16"); as soon as a release-format "16.x.y" version appears, it is
 * reported and compared in full like every other channel. Transitions
 * ("16" → "16.1.0" → "16.1.1" → "17") each notify exactly once through
 * lib/version.js ordering. Older majors still present in the archive (e.g.
 * a stable 15.2.0 next to a snapshot 16) are deliberately not reported.
 */

import { gunzipSync } from "node:zlib";

import { fetchBytes, maxVersion } from "./lib/http.js";

export const GFORTRAN_APT_INDEX_URL =
  "https://ppa.launchpadcontent.net/ubuntu-toolchain-r/test/ubuntu/dists/noble/main/binary-amd64/Packages.gz";

/**
 * @returns {Promise<{ compiler: "gfortran-apt", latestVersion: string, url: string }>}
 */
export async function checkGFortranApt() {
  const raw = await fetchBytes(GFORTRAN_APT_INDEX_URL);
  const text = gunzipSync(new Uint8Array(raw)).toString("utf8");
  let maxMajor = 0;
  /** @type {string[]} */
  const releaseVersionsOfMax = [];
  for (const stanza of text.split(/\n\s*\n/)) {
    const match = /^Package: gfortran-(\d+)$/m.exec(stanza);
    if (!match) continue;
    const major = Number(match[1]);
    const version = stanza.match(/^Version: (\d+\.\d+\.\d+)/m)?.[1];
    if (major > maxMajor) {
      maxMajor = major;
      releaseVersionsOfMax.length = 0;
      if (version) releaseVersionsOfMax.push(version);
    } else if (major === maxMajor && version) {
      releaseVersionsOfMax.push(version);
    }
  }
  if (maxMajor === 0) {
    throw new Error(`no gfortran-* packages found in ${GFORTRAN_APT_INDEX_URL}`);
  }
  const latestVersion =
    releaseVersionsOfMax.length > 0
      ? maxVersion(releaseVersionsOfMax)
      : String(maxMajor);
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

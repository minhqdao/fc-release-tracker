/**
 * Intel ifx (Intel Fortran Compiler) release checker.
 *
 * Source of truth: Intel's own oneAPI APT repository index — the same
 * channel `apt install intel-oneapi-compiler-fortran` consumes. The
 * unversioned `intel-oneapi-compiler-fortran` stanzas carry the full
 * upstream version in their Version field (e.g. "2026.1.1-325", where
 * "-325" is the Debian revision), so this tracks actually downloadable
 * compiler releases at patch granularity.
 *
 * Why not PyPI: the `intel-fortran-rt` package there holds only small
 * runtime libraries and is versioned ahead of the compiler itself (e.g.
 * PyPI showed 2026.1.2 while Intel's installers were still 2026.1.1),
 * which defeats the purpose of this tracker.
 * Note on naming: the repo also ships version-suffixed metapackages such
 * as `intel-oneapi-compiler-fortran-2026.1`, but those exist only at
 * major.minor granularity — patch updates never appear in their names,
 * so we must read the Version fields of the unversioned package instead.
 */

import { gunzipSync } from "node:zlib";

import { fetchBytes, maxVersion } from "./lib/http.js";
import { runStandalone } from "./lib/standalone.js";

export const IFX_APT_INDEX_URL =
  "https://apt.repos.intel.com/oneapi/dists/all/main/binary-amd64/Packages.gz";

// Human-facing source link (the Packages.gz index above is what we read).
export const IFX_PAGE_URL =
  "https://www.intel.com/content/www/us/en/developer/tools/oneapi/fortran-compiler-download.html";

/**
 * Extract the compiler version from a decompressed APT Packages index.
 * @param {string} text
 * @returns {string} latest version, e.g. "2026.1.1"
 */
export function parseIfx(text) {
  const candidates = text
    .split(/\n\s*\n/)
    .filter((stanza) =>
      /^Package: intel-oneapi-compiler-fortran$/m.test(stanza),
    )
    .map(
      (stanza) =>
        stanza.match(/^Version: (\d{4}\.\d+(?:\.\d+)?)/m)?.[1],
    )
    .filter((v) => v !== undefined);
  if (candidates.length === 0) {
    throw new Error(
      `no intel-oneapi-compiler-fortran packages found in ${IFX_APT_INDEX_URL}`,
    );
  }
  return maxVersion(candidates);
}

/**
 * @returns {Promise<{ compiler: "ifx", latestVersion: string, url: string }>}
 */
export async function checkIfx() {
  const raw = await fetchBytes(IFX_APT_INDEX_URL);
  const text = gunzipSync(new Uint8Array(raw)).toString("utf8");
  const latestVersion = parseIfx(text);
  return { compiler: "ifx", latestVersion, url: IFX_PAGE_URL };
}

// Allow running standalone: node src/check-ifx.js
runStandalone(import.meta.url, checkIfx);

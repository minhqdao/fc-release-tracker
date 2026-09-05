/**
 * Arm Fortran Compiler (armflang) release checker.
 *
 * Source of truth: Arm's apt repository index (binary-arm64 only — the
 * toolchain is not published for amd64), the same channel through which
 * setup-fortran installs it. The compiler ships as the
 * "arm-toolchain-for-linux" package whose Version field carries the
 * upstream version (e.g. "22.1-54~noble", where "-54~noble" is the apt
 * revision), so we take the dotted prefix.
 */

import { fetchText, maxVersion } from "./lib/http.js";

export const ARMFLANG_PACKAGES_URL =
  "https://developer.arm.com/packages/arm-toolchains/ubuntu/dists/noble/main/binary-arm64/Packages";

/**
 * Extract the latest arm-toolchain-for-linux version from a Packages index.
 * @param {string} text
 * @returns {string} latest version, e.g. "22.1"
 */
export function parseArmflang(text) {
  const candidates = text
    .split(/\n\s*\n/)
    .filter((stanza) => /^Package: arm-toolchain-for-linux$/m.test(stanza))
    .map((stanza) => stanza.match(/^Version: (\d+\.\d+(?:\.\d+)?)/m)?.[1])
    .filter((v) => v !== undefined);
  if (candidates.length === 0) {
    throw new Error(
      `no arm-toolchain-for-linux packages found in ${ARMFLANG_PACKAGES_URL}`,
    );
  }
  return maxVersion(candidates);
}

/**
 * @returns {Promise<{ compiler: "armflang", latestVersion: string, url: string }>}
 */
export async function checkArmflang() {
  const latestVersion = parseArmflang(await fetchText(ARMFLANG_PACKAGES_URL));
  return { compiler: "armflang", latestVersion, url: ARMFLANG_PACKAGES_URL };
}

// Allow running standalone: node src/check-armflang.js
if (import.meta.url === `file://${process.argv[1]}`) {
  checkArmflang()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

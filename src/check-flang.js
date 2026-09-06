/**
 * LLVM Flang (flang) release checker.
 *
 * Source of truth: the latest stable GitHub Release of llvm/llvm-project.
 * Unlike gfortran's distro-packaged channels, all flang distribution
 * channels used by setup-fortran (apt.llvm.org, official GitHub release
 * installers/assets, Homebrew) mirror this single upstream release train,
 * so one entry suffices.
 *
 * The reported version is the full `major.minor.patch` from the
 * `llvmorg-<major>.<minor>.<patch>` tag (e.g. "23.1.0"), keeping the same
 * parse-and-compare granularity as every other channel; a new major is
 * still the event requiring action in setup-fortran's tables, while
 * point releases provide precise history and catch asset-drift early.
 */

import { fetchText } from "./lib/http.js";
import { runStandalone } from "./lib/standalone.js";

export const FLANG_GITHUB_URL =
  "https://api.github.com/repos/llvm/llvm-project/releases/latest";

// Human-facing source link (the API URL above is what we actually read).
export const FLANG_RELEASES_URL =
  "https://github.com/llvm/llvm-project/releases/latest";

/**
 * Extract the latest LLVM version from the /releases/latest JSON body.
 * @param {string} body
 * @returns {string} latest version, e.g. "23.1.0"
 */
export function parseFlang(body) {
  const data = JSON.parse(body);
  const latestVersion = /^llvmorg-(\d+\.\d+\.\d+)(?:-[A-Za-z0-9.~+-]+)?$/.exec(
    String(data.tag_name),
  )?.[1];
  if (!latestVersion) {
    throw new Error(
      `unexpected LLVM release tag in ${FLANG_GITHUB_URL}: ${String(data.tag_name)}`,
    );
  }
  return latestVersion;
}

/**
 * @returns {Promise<{ compiler: "flang", latestVersion: string, url: string }>}
 */
export async function checkFlang() {
  const latestVersion = parseFlang(await fetchText(FLANG_GITHUB_URL));
  return { compiler: "flang", latestVersion, url: FLANG_RELEASES_URL };
}

// Allow running standalone: node src/check-flang.js
runStandalone(import.meta.url, checkFlang);

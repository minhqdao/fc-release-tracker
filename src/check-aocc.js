/**
 * AOCC (AMD Optimizing C/C++ and Fortran Compilers) release checker.
 *
 * Source of truth: https://developer.amd.com/amd-aocc/
 * AOCC releases are announced with downloadable tarballs named
 * "aocc-compiler-<version>.tar". AMD's public identity for a release is
 * always major.minor (e.g. "5.2"); the trailing ".0" in the tarball name is
 * noise, so we strip it and fail loudly if a real patch number ever appears.
 */

import { fetchText, maxVersion } from "./lib/http.js";
import { runStandalone } from "./lib/standalone.js";

export const AOCC_PAGE_URL = "https://developer.amd.com/amd-aocc/";

/**
 * Extract the latest AOCC version from the page HTML.
 * @param {string} body
 * @returns {string} latest version, e.g. "5.2"
 */
export function parseAOCC(body) {
  const candidates = [
    ...body.matchAll(/aocc[-_ ]compiler[-_ ](\d+\.\d+(?:\.\d+)?)/gi),
  ].map((m) => m[1]);
  if (candidates.length === 0) {
    throw new Error(`no AOCC release marker found on ${AOCC_PAGE_URL}`);
  }
  const latest = maxVersion(candidates);
  const [major, minor, patch] = latest.split(".");
  if (patch && patch !== "0") {
    throw new Error(
      `unexpected AOCC patch release "${latest}" — AOCC is major.minor only, review parsing`,
    );
  }
  return `${major}.${minor}`;
}

/**
 * @returns {Promise<{ compiler: "aocc", latestVersion: string, url: string }>}
 */
export async function checkAOCC() {
  const latestVersion = parseAOCC(await fetchText(AOCC_PAGE_URL));
  return { compiler: "aocc", latestVersion, url: AOCC_PAGE_URL };
}

// Allow running standalone: node src/check-aocc.js
runStandalone(import.meta.url, checkAOCC);

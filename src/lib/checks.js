/**
 * Central registry of compiler checks, shared by the daily check runner
 * (index.js) and the `latest` CLI.
 */

import { checkAOCC } from "../check-aocc.js";
import { checkArmflang } from "../check-armflang.js";
import { checkIfx } from "../check-ifx.js";
import { checkLFortran } from "../check-lfortran.js";
import { checkNvfortran } from "../check-nvfortran.js";

/** @type {Readonly<Record<string, () => Promise<{ compiler: string, latestVersion: string, url: string }>>>} */
export const CHECKS = Object.freeze({
  aocc: checkAOCC,
  armflang: checkArmflang,
  ifx: checkIfx,
  lfortran: checkLFortran,
  nvfortran: checkNvfortran,
});

/**
 * Run every registered checker in parallel. This is THE implementation both
 * CLI entry points (index.js, latest.js) use, so failure/concurrency
 * semantics exist exactly once.
 * @returns {Promise<{ results: Array<{ compiler: string, latestVersion: string, url: string }>, failures: Array<{ name: string, reason: unknown }> }>}
 */
export async function runAllChecks() {
  const names = Object.keys(CHECKS);
  const settled = await Promise.allSettled(
    names.map((name) => CHECKS[name]()),
  );
  const results = [];
  const failures = [];
  for (const [i, r] of settled.entries()) {
    if (r.status === "fulfilled") results.push(r.value);
    else failures.push({ name: names[i], reason: r.reason });
  }
  return { results, failures };
}

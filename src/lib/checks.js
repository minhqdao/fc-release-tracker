/**
 * Central registry of compiler checks, shared by the daily check runner
 * (index.js) and the `latest` CLI.
 */

import { checkAOCC } from "../check-aocc.js";
import { checkNvfortran } from "../check-nvfortran.js";
import { checkIfx } from "../check-ifx.js";

/** @type {Readonly<Record<string, () => Promise<{ compiler: string, latestVersion: string, url: string }>>>} */
export const CHECKS = Object.freeze({
  aocc: checkAOCC,
  nvfortran: checkNvfortran,
  ifx: checkIfx,
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

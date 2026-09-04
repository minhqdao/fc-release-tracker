/**
 * Entry point: runs all compiler checks, diffs against the last-seen
 * versions in data/state.json, opens/comments on a GitHub tracking issue
 * for any new releases, then persists the updated state.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { checkAOCC } from "./check-aocc.js";
import { checkNvfortran } from "./check-nvfortran.js";
import { checkIfx } from "./check-ifx.js";
import { isNewer } from "./lib/version.js";
import { notifyNewReleases } from "./lib/github.js";

const CHECKS = [checkAOCC, checkNvfortran, checkIfx];

const STATE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "state.json",
);

const DEFAULT_STATE = { aocc: null, nvfortran: null, ifx: null };

/** Load last-seen versions; fall back to defaults if the file is missing. */
export async function loadState() {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === "ENOENT") return { ...DEFAULT_STATE };
    throw err;
  }
}

/** Persist last-seen versions to disk. */
export async function saveState(state) {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

export async function main() {
  const state = await loadState();

  const results = await Promise.allSettled(CHECKS.map((check) => check()));
  const failures = results.filter((r) => r.status === "rejected");
  const checks = results.flatMap((r) =>
    r.status === "fulfilled" ? [r.value] : [],
  );

  const newReleases = checks
    .filter((r) => isNewer(r.latestVersion, state[r.compiler]))
    .map((r) => ({ ...r, previousVersion: state[r.compiler] }));

  if (newReleases.length > 0) {
    // Only persist state if the notification succeeded, so a failed issue
    // post is retried on the next run instead of silently swallowed.
    await notifyNewReleases(newReleases);
  }

  const nextState = { ...state };
  for (const r of checks) nextState[r.compiler] = r.latestVersion;
  await saveState(nextState);

  if (failures.length > 0) {
    for (const f of failures) console.error("check failed:", f.reason);
    // Non-zero exit marks the workflow run red so parser breakage is visible.
    process.exitCode = 1;
  }
}

main();

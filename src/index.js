/**
 * Entry point: runs all compiler checks, diffs against the last-seen
 * versions in data/state.json, notifies per-source GitHub tracking issues
 * (releases and failures get separate threads), then persists the state of
 * successfully delivered detections.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { runAllChecks } from "./lib/checks.js";
import { isNewer } from "./lib/version.js";
import { notifyCompilerEvents } from "./lib/github.js";

const STATE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "state.json",
);

const DEFAULT_STATE = {
  aocc: null,
  armflang: null,
  flang: null,
  "gfortran-apt": null,
  "gfortran-brew": null,
  "gfortran-winlibs": null,
  ifx: null,
  lfortran: null,
  nvfortran: null,
};

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

  const { results: checks, failures } = await runAllChecks();

  const newReleases = checks
    .filter((r) => isNewer(r.latestVersion, state[r.compiler]))
    .map((r) => ({
      kind: "release",
      compiler: r.compiler,
      previousVersion: state[r.compiler],
      latestVersion: r.latestVersion,
      url: r.url,
    }));

  // Every failed check becomes an event on its own compiler's issue, too —
  // breakage is reported per source, not just as a red workflow run.
  const events = [
    ...newReleases,
    ...failures.map((f) => ({ kind: "error", compiler: f.name, error: f.reason })),
  ];

  const { delivered, problems } = await notifyCompilerEvents(events);

  // Persist a detected release only once its notification landed, so a
  // failed post is retried on the next run instead of silently swallowed.
  const newReleaseKeys = new Set(newReleases.map((r) => r.compiler));
  const nextState = { ...state };
  for (const r of checks) {
    if (!newReleaseKeys.has(r.compiler) || delivered.has(r.compiler)) {
      nextState[r.compiler] = r.latestVersion;
    }
  }
  await saveState(nextState);

  for (const f of failures) console.error(`${f.name} check failed:`, f.reason);
  // Non-zero exit marks the workflow run red so parser breakage is visible
  // (and notification failures too, even though they already got an issue).
  if (failures.length > 0 || problems.length > 0) process.exitCode = 1;
}

main();

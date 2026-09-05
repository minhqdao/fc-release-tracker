/**
 * Last-seen version state, persisted in-repo at data/state.json so the
 * daily run can diff against the previous run across git history.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CHECKS } from "./checks.js";

// Two levels up: this module lives in src/lib/, the state file in <root>/data.
export const STATE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "state.json",
);

/**
 * Last-seen-version slots, one per registered check, derived from the CHECKS
 * registry: adding compiler #10 only means adding a checker file and a
 * registry entry (plus a README row) — never touching this module.
 */
export const DEFAULT_STATE = Object.freeze(
  Object.fromEntries(Object.keys(CHECKS).map((key) => [key, null])),
);

/** Load last-seen versions; fall back to defaults if the file is missing. */
export async function loadState(statePath = STATE_PATH) {
  try {
    const raw = await readFile(statePath, "utf8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === "ENOENT") return { ...DEFAULT_STATE };
    throw err;
  }
}

/** Persist last-seen versions to disk. */
export async function saveState(state, statePath = STATE_PATH) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2) + "\n");
}

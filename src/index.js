/**
 * Entry point: runs all compiler checks, diffs against the last-seen
 * versions in data/state.json, publishes every genuinely new version as a
 * GitHub Release (watchers with the "Releases" subscription get them) and
 * files check failures as capped, auto-closing tracking issues, then
 * persists the state of successfully delivered releases.
 */

import { runAllChecks } from "./lib/checks.js";
import { isNewer } from "./lib/version.js";
import { loadState, saveState } from "./lib/state.js";
import { publishReleases, reportFailures } from "./lib/github.js";

export async function main() {
  const state = await loadState();

  const { results: checks, failures } = await runAllChecks();

  const newReleases = checks
    .filter((r) => isNewer(r.latestVersion, state[r.compiler]))
    .map((r) => ({
      compiler: r.compiler,
      previousVersion: state[r.compiler],
      latestVersion: r.latestVersion,
      url: r.url,
    }));

  const [{ delivered, problems: releaseProblems }, { problems: failureProblems }] =
    await Promise.all([
      publishReleases(newReleases),
      reportFailures(failures.map((f) => ({ compiler: f.name, error: f.reason }))),
    ]);
  const problems = [...releaseProblems, ...failureProblems];

  // Persist a detected release only once its publication landed (or was
  // already published), so a failed post is retried on the next run instead
  // of silently swallowed. Publication is idempotent, so retries can never
  // duplicate.
  const pendingReleaseKeys = new Set(newReleases.map((r) => r.compiler));
  const nextState = { ...state };
  for (const r of checks) {
    if (!pendingReleaseKeys.has(r.compiler) || delivered.has(r.compiler)) {
      nextState[r.compiler] = r.latestVersion;
    }
  }
  await saveState(nextState);

  for (const f of failures) console.error(`${f.name} check failed:`, f.reason);
  // Non-zero exit marks the workflow run red so parser breakage is visible
  // (and release/failure notification problems too, even though failures
  // already got issues and releases are retried idempotently).
  if (failures.length > 0 || problems.length > 0) process.exitCode = 1;
}

main();

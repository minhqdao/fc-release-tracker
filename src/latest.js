/**
 * CLI: print the latest version of a compiler (or all compilers) and
 * nothing else, e.g. `latest ifx` -> "2026.1.1". Reuses the same checks as
 * the daily runner, without touching state or GitHub.
 */

import { CHECKS } from "./lib/checks.js";

const selected = process.argv.slice(2);

if (selected.length === 0) {
  const results = await Promise.allSettled(
    Object.values(CHECKS).map((check) => check()),
  );
  for (const [i, result] of results.entries()) {
    const name = Object.keys(CHECKS)[i];
    if (result.status === "fulfilled") {
      console.log(`${name} ${result.value.latestVersion}`);
    } else {
      console.error(`${name}: ${result.reason}`);
      process.exitCode = 1;
    }
  }
} else {
  for (const name of selected) {
    const check = CHECKS[name];
    if (!check) {
      const known = Object.keys(CHECKS).join(", ");
      console.error(`unknown compiler "${name}" (known: ${known})`);
      process.exitCode = 1;
      continue;
    }
    try {
      const { latestVersion } = await check();
      console.log(latestVersion);
    } catch (err) {
      console.error(`${name}: ${err}`);
      process.exitCode = 1;
    }
  }
}

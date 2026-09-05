/**
 * CLI: print the latest version of a compiler (or all compilers) and
 * nothing else, e.g. `latest ifx` -> "2026.1.1". Reuses the same checks as
 * the scheduled runner, without touching state or GitHub.
 */

import { CHECKS, runAllChecks } from "./lib/checks.js";

const selected = process.argv.slice(2);

if (selected.length === 0) {
  const { results, failures } = await runAllChecks();
  for (const r of results) {
    console.log(`${r.compiler} ${r.latestVersion}`);
  }
  for (const f of failures) {
    console.error(`${f.name}: ${f.reason}`);
    process.exitCode = 1;
  }
} else {
  // Fire all requested checks concurrently, then report in the order the
  // compilers were requested.
  const pending = selected.map((name) => {
    const check = CHECKS[name];
    return { name, check, result: check ? check() : undefined };
  });

  for (const { name, check, result } of pending) {
    if (!check) {
      const known = Object.keys(CHECKS).join(", ");
      console.error(`unknown compiler "${name}" (known: ${known})`);
      process.exitCode = 1;
      continue;
    }
    try {
      const { latestVersion } = await result;
      console.log(latestVersion);
    } catch (err) {
      console.error(`${name}: ${err}`);
      process.exitCode = 1;
    }
  }
}

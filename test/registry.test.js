import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { CHECKS } from "../src/lib/checks.js";
import { DEFAULT_STATE } from "../src/lib/state.js";

const SRC_DIR = fileURLToPath(new URL("../src/", import.meta.url));

describe("CHECKS registry", () => {
  it("lists compilers alphabetically (maintenance convention)", () => {
    const keys = Object.keys(CHECKS);
    assert.deepEqual(keys, [...keys].sort());
  });

  it("derives DEFAULT_STATE: one frozen null last-seen slot per check", () => {
    assert.ok(Object.isFrozen(DEFAULT_STATE));
    assert.deepEqual(
      DEFAULT_STATE,
      Object.fromEntries(Object.keys(CHECKS).map((key) => [key, null])),
    );
  });

  // The registry key and the `compiler` field each checker reports are two
  // independent literals; if they drift apart, index.js looks state up under
  // the reported name and publishes the same "new" release again.
  for (const key of Object.keys(CHECKS)) {
    it(`${key}: check-${key}.js exists and reports compiler "${key}"`, async () => {
      const source = await readFile(`${SRC_DIR}check-${key}.js`, "utf8");
      const reported = [...source.matchAll(/compiler: "([^"]+)"/g)].map(
        (m) => m[1],
      );
      assert.ok(reported.length > 0, "no compiler literal in source");
      assert.ok(
        reported.every((name) => name === key),
        `registry key is "${key}" but source reports: ${[...new Set(reported)].join(", ")}`,
      );
    });
  }
});

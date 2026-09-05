import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CHECKS } from "../src/lib/checks.js";
import { DEFAULT_STATE, loadState, saveState } from "../src/lib/state.js";

/** Run `fn` with a fresh throwaway directory, cleaned up afterwards. */
async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "fc-release-tracker-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("DEFAULT_STATE", () => {
  it("covers exactly the registered checks", () => {
    assert.deepEqual(
      Object.keys(DEFAULT_STATE).sort(),
      Object.keys(CHECKS).sort(),
    );
  });
});

describe("loadState", () => {
  it("returns defaults when the state file is missing", async () => {
    await withTempDir(async (dir) => {
      const state = await loadState(join(dir, "state.json"));
      assert.deepEqual(state, { ...DEFAULT_STATE });
    });
  });

  it("merges stored versions over the defaults, keeping unknown keys", async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "state.json");
      await writeFile(file, JSON.stringify({ aocc: "5.2", retired: "1.0" }));
      const state = await loadState(file);
      assert.equal(state.aocc, "5.2");
      assert.equal(state.retired, "1.0");
      assert.equal(state.ifx, null);
    });
  });

  it("rejects malformed state instead of silently resetting", async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "state.json");
      await writeFile(file, "{oops");
      await assert.rejects(loadState(file), SyntaxError);
    });
  });
});

describe("saveState", () => {
  it("round-trips through loadState in the documented format", async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "state.json");
      const state = { ...DEFAULT_STATE, aocc: "5.2", lfortran: "0.65.0" };
      await saveState(state, file);
      assert.equal(
        await readFile(file, "utf8"),
        JSON.stringify(state, null, 2) + "\n",
      );
      assert.deepEqual(await loadState(file), state);
    });
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

  it("rejects an empty file instead of silently resetting", async () => {
    // e.g. a run interrupted mid-write
    await withTempDir(async (dir) => {
      const file = join(dir, "state.json");
      await writeFile(file, "");
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

  it("creates missing parent directories", async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "nested", "deeper", "state.json");
      await saveState({ ...DEFAULT_STATE, ifx: "2026.1.2" }, file);
      assert.equal((await loadState(file)).ifx, "2026.1.2");
    });
  });

  it("overwrites an existing file", async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "state.json");
      await saveState({ ...DEFAULT_STATE, aocc: "4.1" }, file);
      await saveState({ ...DEFAULT_STATE, aocc: "5.2" }, file);
      assert.equal((await loadState(file)).aocc, "5.2");
    });
  });
});

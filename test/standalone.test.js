import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runStandalone } from "../src/lib/standalone.js";

describe("runStandalone", () => {
  it("is a no-op when the module is imported rather than executed", () => {
    let calls = 0;
    const check = async () => {
      calls += 1;
      return {};
    };
    runStandalone("file:///somewhere/check-x.js", check);
    assert.equal(calls, 0);
  });

  it("prints the check result as JSON when executed directly", async () => {
    const result = { compiler: "x", latestVersion: "1.0", url: "https://x" };
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));
    const script = process.argv[1];
    process.argv[1] = "/somewhere/check-x.js";
    try {
      await runStandalone("file:///somewhere/check-x.js", async () => result);
    } finally {
      process.argv[1] = script;
      console.log = originalLog;
    }
    assert.equal(logs.length, 1);
    assert.equal(logs[0], JSON.stringify(result, null, 2));
  });

  it("flags the process as failed when the check rejects", async () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(" "));
    const script = process.argv[1];
    const initialExitCode = process.exitCode;
    process.argv[1] = "/somewhere/check-x.js";
    let exitCodeAfterRun;
    try {
      await runStandalone("file:///somewhere/check-x.js", async () => {
        throw new Error("boom");
      });
      exitCodeAfterRun = process.exitCode;
    } finally {
      process.argv[1] = script;
      console.error = originalError;
      process.exitCode = initialExitCode;
    }
    assert.match(errors[0], /boom/);
    assert.equal(exitCodeAfterRun, 1);
  });
});

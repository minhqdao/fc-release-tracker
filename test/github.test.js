import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_FAILURE_ISSUES,
  failureIssueTitle,
  releaseTag,
  renderFailureBody,
  renderReleaseBody,
} from "../src/lib/github.js";

// renderFailureBody/renderReleaseBody embed a workflow-run link when the
// Actions env is present — pin it so assertions hold identically locally
// and inside GitHub Actions CI.
const ENV_KEYS = ["GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"];
let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("naming", () => {
  it("builds release tags as <compiler>/<version>", () => {
    assert.equal(releaseTag("flang", "23.1.0"), "flang/23.1.0");
  });

  it("builds failure issue titles with the shared prefix", () => {
    assert.equal(failureIssueTitle("ifx"), "Error during check: ifx");
  });

  it("caps open failure issues at a positive count", () => {
    assert.ok(Number.isInteger(MAX_FAILURE_ISSUES) && MAX_FAILURE_ISSUES > 0);
  });
});

describe("renderReleaseBody", () => {
  const event = {
    compiler: "ifx",
    previousVersion: "2026.1.1",
    latestVersion: "2026.1.2",
    url: "https://pypi.org/pypi/intel-fortran-rt/json",
  };

  it("names the compiler, both versions, and the source", () => {
    const body = renderReleaseBody(event);
    assert.match(body, /`ifx`/);
    assert.match(body, /previous: `2026\.1\.1`/);
    assert.match(body, /\*\*`2026\.1\.2`\*\*/);
    assert.match(body, /https:\/\/pypi\.org\/pypi\/intel-fortran-rt\/json/);
  });

  it("says when no previous version was recorded", () => {
    assert.match(
      renderReleaseBody({ ...event, previousVersion: null }),
      /not recorded/,
    );
  });

  it("omits the workflow-run link outside Actions", () => {
    assert.equal(renderReleaseBody(event).includes("Workflow run:"), false);
  });

  it("links the workflow run inside Actions", () => {
    process.env.GITHUB_SERVER_URL = "https://github.com";
    process.env.GITHUB_REPOSITORY = "minhqdao/fc-release-tracker";
    process.env.GITHUB_RUN_ID = "12345";
    assert.match(
      renderReleaseBody(event),
      /Workflow run: https:\/\/github\.com\/minhqdao\/fc-release-tracker\/actions\/runs\/12345/,
    );
  });
});

describe("renderFailureBody", () => {
  it("fences the error stack and names the source", () => {
    const body = renderFailureBody({
      compiler: "aocc",
      error: new Error("no AOCC release marker found"),
      url: "https://developer.amd.com/amd-aocc/",
    });
    assert.match(body, /`aocc`/);
    assert.match(body, /```\nError: no AOCC release marker found/);
    assert.match(body, /Source: https:\/\/developer\.amd\.com\/amd-aocc\//);
  });

  it("accepts plain-string errors and missing URLs", () => {
    const body = renderFailureBody({
      compiler: "nvfortran",
      error: "fetch failed: 404",
    });
    assert.match(body, /fetch failed: 404/);
    assert.match(body, /Source: see checker/);
  });
});

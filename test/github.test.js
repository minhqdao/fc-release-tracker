import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MAX_FAILURE_ISSUES,
  failureIssueTitle,
  releaseTag,
  renderFailureBody,
  renderReleaseBody,
  reportFailures,
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

describe("reportFailures", () => {
  const ENV_KEYS = [
    "GITHUB_TOKEN",
    "GITHUB_REPOSITORY",
    "GITHUB_SERVER_URL",
    "GITHUB_STEP_SUMMARY",
  ];

  /** Stub the GitHub REST API and record every call. */
  function mockGitHubApi(issueList, calls) {
    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      calls.push({ url: String(url), opts });
      if (String(url).includes("/issues?state=open")) {
        return { ok: true, json: async () => issueList };
      }
      return { ok: true, json: async () => ({ number: 99 }) };
    };
    return () => {
      global.fetch = originalFetch;
    };
  }

  /** Run one event through reportFailures with stubbed API and env. */
  async function runWithMocks(issueList, summaryPath, event) {
    const calls = [];
    const restoreFetch = mockGitHubApi(issueList, calls);
    const saved = Object.fromEntries(
      ENV_KEYS.map((k) => [k, process.env[k]]),
    );
    Object.assign(process.env, {
      GITHUB_TOKEN: "t",
      GITHUB_REPOSITORY: "o/r",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_STEP_SUMMARY: summaryPath,
    });
    try {
      const result = await reportFailures([event]);
      return { result, calls };
    } finally {
      restoreFetch();
      for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  }

  it("creates the issue and links it once when under the cap", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fc-github-test-"));
    try {
      const { result, calls } = await runWithMocks(
        [],
        join(dir, "summary.md"),
        { compiler: "aocc", error: "boom" },
      );
      assert.equal(result.problems.length, 0);
      assert.ok(calls.some((c) => /\/issues$/.test(c.url)));

      const summary = await readFile(join(dir, "summary.md"), "utf8");
      const lines = summary.split("\n").filter((l) => l.startsWith("- `"));
      assert.equal(lines.length, 1);
      assert.match(lines[0], /`aocc`: check failed — tracked in \[#99\]/);
      assert.ok(calls[0].opts.signal instanceof AbortSignal);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes exactly one summary line per event when the cap blocks a new issue", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fc-github-test-"));
    try {
      const { result, calls } = await runWithMocks(
        Array.from({ length: MAX_FAILURE_ISSUES }, (_, i) => ({
          number: i + 1,
          title: `Error during check: source${i}`,
        })),
        join(dir, "summary.md"),
        { compiler: "newsrc", error: "boom" },
      );
      assert.equal(result.problems.length, 0);

      const summary = await readFile(join(dir, "summary.md"), "utf8");
      const lines = summary.split("\n").filter((l) => l.startsWith("- `"));
      assert.equal(lines.length, 1);
      assert.match(
        lines[0],
        /`newsrc`: check failed \(failure-issue cap 5 reached\)/,
      );
      // no new issue may be created once the cap is reached
      assert.equal(
        calls.some((c) => c.opts?.method === "POST" && /\/issues$/.test(c.url)),
        false,
      );
      assert.ok(calls[0].opts.signal instanceof AbortSignal);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MAX_FAILURE_ISSUES,
  failureIssueBody,
  failureIssueTitle,
  failureSignature,
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
    // clarifies the auto-generated "Source code" archive, which GitHub
    // provides on every release and which cannot be disabled
    assert.match(body, /\*\*Note:\*\* No compiler binaries/);
    assert.match(body, /"Source code" archive is just this tracker/);
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
    const body = renderReleaseBody(event);
    assert.match(
      body,
      /Workflow run: https:\/\/github\.com\/minhqdao\/fc-release-tracker\/actions\/runs\/12345/,
    );
    // the note sits below the workflow-run line
    assert.ok(
      body.indexOf("Workflow run:") < body.indexOf("**Note:**"),
      "note should come after the workflow-run line",
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

  it("normalizes the signature by stripping the workflow-run link", () => {
    const event = { compiler: "ifx", error: new Error("boom") };
    process.env.GITHUB_SERVER_URL = "https://github.com";
    process.env.GITHUB_REPOSITORY = "o/r";
    process.env.GITHUB_RUN_ID = "42";
    const signature = failureSignature(event);
    assert.doesNotMatch(signature, /Workflow run:/);
    assert.match(signature, /Error: boom/);
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
  function mockGitHubApi({ issues = [], commentsByNumber = {} } = {}, calls) {
    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      const u = String(url);
      calls.push({ url: u, opts });
      if (u.includes("/issues?state=open")) {
        return { ok: true, json: async () => issues };
      }
      const commentsMatch = /\/issues\/(\d+)\/comments/.exec(u);
      if (commentsMatch && (!opts?.method || opts.method === "GET")) {
        return {
          ok: true,
          json: async () => commentsByNumber[commentsMatch[1]] ?? [],
        };
      }
      if (opts?.method === "POST" && /\/issues\/\d+\/comments$/.test(u)) {
        return { ok: true, json: async () => ({}) };
      }
      if (opts?.method === "PATCH" && /\/issues\/\d+$/.test(u)) {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ number: 99 }) };
    };
    return () => {
      global.fetch = originalFetch;
    };
  }

  /** Run events through reportFailures with stubbed API and env. */
  async function runWithMocks(stubs, summaryPath, events) {
    const calls = [];
    const restoreFetch = mockGitHubApi(stubs, calls);
    const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    Object.assign(process.env, {
      GITHUB_TOKEN: "t",
      GITHUB_REPOSITORY: "o/r",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_STEP_SUMMARY: summaryPath,
    });
    try {
      const result = await reportFailures(events);
      return { result, calls };
    } finally {
      restoreFetch();
      for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  }

  /** Summary lines of one named `## <header>` section. */
  function sectionLines(summary, header) {
    const start = summary.indexOf(`## ${header}`);
    if (start === -1) return [];
    const rest = summary.slice(start + `## ${header}`.length);
    const end = rest.indexOf("\n## ");
    return (end === -1 ? rest : rest.slice(0, end))
      .split("\n")
      .filter((l) => l.startsWith("- `"));
  }

  it("creates the issue and links it once when under the cap", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fc-github-test-"));
    try {
      const { result, calls } = await runWithMocks(
        { issues: [] },
        join(dir, "summary.md"),
        [{ compiler: "aocc", error: "boom" }],
      );
      assert.equal(result.problems.length, 0);
      assert.ok(
        calls.some(
          (c) => /\/issues$/.test(c.url) && c.opts?.method === "POST",
        ),
      );

      const summary = await readFile(join(dir, "summary.md"), "utf8");
      const lines = sectionLines(summary, "Check failures");
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
        {
          issues: Array.from({ length: MAX_FAILURE_ISSUES }, (_, i) => ({
            number: i + 1,
            title: `Error during check: source${i}`,
            body: "stale thread",
          })),
        },
        join(dir, "summary.md"),
        [{ compiler: "newsrc", error: "boom" }],
      );
      assert.equal(result.problems.length, 0);

      const summary = await readFile(join(dir, "summary.md"), "utf8");
      const lines = sectionLines(summary, "Check failures");
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

  it("closes recovered threads with a recovery comment, comment first", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fc-github-test-"));
    try {
      const { result, calls } = await runWithMocks(
        {
          issues: [
            { number: 7, title: "Error during check: stale", body: "intro" },
          ],
        },
        join(dir, "summary.md"),
        [], // nothing failed this run: the stale thread has recovered
      );
      assert.equal(result.problems.length, 0);

      const commentIdx = calls.findIndex(
        (c) =>
          c.opts?.method === "POST" && /\/issues\/7\/comments$/.test(c.url),
      );
      const closeIdx = calls.findIndex(
        (c) => c.opts?.method === "PATCH" && /\/issues\/7$/.test(c.url),
      );
      assert.ok(commentIdx !== -1, "recovery comment posted");
      assert.ok(closeIdx !== -1, "issue closed");
      assert.ok(commentIdx < closeIdx, "comment before close");
      assert.deepEqual(JSON.parse(calls[closeIdx].opts.body), {
        state: "closed",
      });

      const summary = await readFile(join(dir, "summary.md"), "utf8");
      const recovered = sectionLines(summary, "Recovered sources");
      assert.equal(recovered.length, 1);
      assert.match(recovered[0], /`stale`: recovered — closed \[#7\]/);
      assert.equal(sectionLines(summary, "Check failures").length, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips the repeat comment when the error matches the thread's last reported error", async () => {
    const event = {
      compiler: "aocc",
      error: new Error("no AOCC release marker found"),
    };
    const dir = await mkdtemp(join(tmpdir(), "fc-github-test-"));
    try {
      const { result, calls } = await runWithMocks(
        {
          issues: [
            { number: 3, title: "Error during check: aocc", body: "intro" },
          ],
          commentsByNumber: {
            3: [
              {
                // stored by a previous run with a different run link —
                // the link must not defeat the comparison
                body:
                  failureSignature(event) +
                  "\n\nWorkflow run: https://github.com/o/r/actions/runs/42",
              },
            ],
          },
        },
        join(dir, "summary.md"),
        [event],
      );
      assert.equal(result.problems.length, 0);
      assert.equal(
        calls.some(
          (c) => c.opts?.method === "POST" && /\/comments$/.test(c.url),
        ),
        false,
      );

      const summary = await readFile(join(dir, "summary.md"), "utf8");
      const lines = sectionLines(summary, "Check failures");
      assert.equal(lines.length, 1);
      assert.match(lines[0], /`aocc`: check failed \(same error as last time\)/);
      assert.match(lines[0], /tracked in \[#3\]/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("comments again when the error differs from the last reported one", async () => {
    const event = { compiler: "aocc", error: new Error("brand new breakage") };
    const dir = await mkdtemp(join(tmpdir(), "fc-github-test-"));
    try {
      const { result, calls } = await runWithMocks(
        {
          issues: [
            { number: 3, title: "Error during check: aocc", body: "intro" },
          ],
          commentsByNumber: {
            3: [
              {
                body:
                  failureSignature({
                    compiler: "aocc",
                    error: new Error("old breakage"),
                  }) +
                  "\n\nWorkflow run: https://github.com/o/r/actions/runs/42",
              },
            ],
          },
        },
        join(dir, "summary.md"),
        [event],
      );
      assert.equal(result.problems.length, 0);
      assert.equal(
        calls.filter(
          (c) => c.opts?.method === "POST" && /\/comments$/.test(c.url),
        ).length,
        1,
      );

      const summary = await readFile(join(dir, "summary.md"), "utf8");
      const lines = sectionLines(summary, "Check failures");
      assert.match(lines[0], /`aocc`: check failed — tracked in \[#3\]/);
      assert.doesNotMatch(lines[0], /same error/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("dedups against the issue body when the thread has no comments yet", async () => {
    const event = {
      compiler: "ifx",
      error: new Error("unexpected intel-fortran-rt version"),
    };
    const dir = await mkdtemp(join(tmpdir(), "fc-github-test-"));
    try {
      const { result, calls } = await runWithMocks(
        {
          issues: [
            {
              number: 5,
              title: "Error during check: ifx",
              body:
                failureIssueBody(event) +
                "\n\nWorkflow run: https://github.com/o/r/actions/runs/41",
            },
          ],
          commentsByNumber: { 5: [] },
        },
        join(dir, "summary.md"),
        [event],
      );
      assert.equal(result.problems.length, 0);
      assert.equal(
        calls.some(
          (c) => c.opts?.method === "POST" && /\/comments$/.test(c.url),
        ),
        false,
      );

      const summary = await readFile(join(dir, "summary.md"), "utf8");
      const lines = sectionLines(summary, "Check failures");
      assert.match(lines[0], /same error as last time/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

/**
 * GitHub notifications with two channels, so watchers can subscribe
 * selectively:
 *
 *   Releases — every newly detected compiler version is published as a
 *   first-class GitHub Release, tagged "<compiler>/<version>". Publishing is
 *   idempotent (the tag name is the (compiler, version) identity): a release
 *   that already exists counts as delivered, so a partial failure retried on
 *   the next run never duplicates and never sticks.
 *
 *   Issues — check failures get per-source tracking threads
 *   ("Error during check: <source>", created as needed), capped at
 *   MAX_FAILURE_ISSUES open issues. A thread only receives a comment when
 *   the error differs from the last one it reported, and it closes
 *   automatically (with a recovery comment) on the first run where the
 *   source's check succeeds again. Issues are the bug channel: if you watch
 *   this repo's issues, everything you see means a checker needs fixing.
 *
 * Identified by exact issue title / tag name (no labels — this repo's issue
 * list is ours). Uses the REST API directly (no deps).
 *
 * Required env when running in GitHub Actions (set by the workflow):
 *   GITHUB_TOKEN       - the workflow's github.token
 *   GITHUB_REPOSITORY  - "owner/name" (set automatically by Actions)
 *   GITHUB_SHA         - commit the new release tags are anchored to
 *
 * Without those (local runs) events are only printed.
 */

import { execFileSync } from "node:child_process";

import { FETCH_TIMEOUT_MS } from "./http.js";

const API_ROOT = "https://api.github.com";

/** Upper bound on simultaneously open per-source check-failure issues. */
export const MAX_FAILURE_ISSUES = 5;
const FAILURE_PREFIX = "Error during check: ";

const JSON_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export const releaseTag = (compiler, version) => `${compiler}/${version}`;
export const failureIssueTitle = (compiler) => `${FAILURE_PREFIX}${compiler}`;

const FAILURE_INTRO =
  "Tracking issue for check failures of the `{compiler}` compiler source, maintained by the daily check. While this issue is open the source is broken (page moved, parser drifted, ...); fix the checker — the daily check closes this issue automatically once the source recovers.";

function runLink() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return "";
  return `\n\nWorkflow run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
}

/** Render a check failure as Markdown (issue body/comment). */
export function renderFailureBody(event) {
  return [
    `The daily check for \`${event.compiler}\` failed.`,
    "",
    "```",
    String(event.error?.stack ?? event.error),
    "```",
    `Source: ${event.url ?? "see checker"}`,
  ].join("\n") + runLink();
}

/** Render the release notes body for a new compiler release. */
export function renderReleaseBody(event) {
  return [
    `A new release was detected for \`${event.compiler}\`.`,
    "",
    `- previous: \`${event.previousVersion ?? "not recorded"}\``,
    `- new: **\`${event.latestVersion}\`**`,
    `- source: ${event.url}`,
  ].join("\n") + runLink();
}

/** Error carrying the HTTP status so callers can branch on 404/422. */
class GitHubApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      ...JSON_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    // Same timeout policy as the checker page fetches: a hung connection
    // must not stall the workflow until the job-level limit.
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    throw new GitHubApiError(
      `GitHub API ${method} ${path} failed: ${res.status} ${await res.text()}`,
      res.status,
    );
  }
  return res.json();
}

function isStatus(err, status) {
  return err instanceof GitHubApiError && err.status === status;
}

/** Commit the new release tags anchor to. */
function headSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

async function hasRelease(repo, token, tag) {
  try {
    return await api(`/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
      token,
    });
  } catch (err) {
    if (isStatus(err, 404)) return null;
    throw err;
  }
}

async function appendSummary(header, lines) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path || lines.length === 0) return;
  const fs = await import("node:fs/promises");
  await fs.appendFile(path, `${header}\n\n${lines.join("\n")}\n`);
}

/**
 * Publish every new release event as a GitHub Release (idempotent, see the
 * module comment). Returns compilers whose release is delivered (created or
 * already present) so the caller can persist their state; delivery failures
 * land in `problems` and retry untouched on the next run.
 *
 * @param {{ compiler: string, previousVersion: string|null, latestVersion: string, url: string }[]} events
 * @returns {Promise<{ delivered: Set<string>, problems: { compiler: string, err: unknown }[] }>}
 */
export async function publishReleases(events) {
  const delivered = new Set();
  const problems = [];
  if (events.length === 0) return { delivered, problems };

  const summaryLines = [];
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log(
      "GITHUB_TOKEN/GITHUB_REPOSITORY not set — printing releases locally.\n",
    );
    for (const event of events) {
      console.log(`--- release ${event.compiler} ${event.latestVersion} ---`);
      console.log(renderReleaseBody(event), "\n");
      delivered.add(event.compiler);
    }
    return { delivered, problems };
  }

  for (const event of events) {
    const tag = releaseTag(event.compiler, event.latestVersion);
    try {
      let release = await hasRelease(repo, token, tag);
      if (release) {
        console.log(`Release ${tag} already published — treated as delivered`);
      } else {
        // Anchor the tag on HEAD unless a (partially retried) earlier attempt
        // already placed it; a retry keeps the existing ref either way.
        const sha = headSha();
        try {
          await api(`/repos/${repo}/git/ref/tags/${encodeURIComponent(tag)}`, {
            token,
          });
          console.log(`Tag ${tag} already exists — reusing its anchor`);
        } catch (err) {
          if (!isStatus(err, 404)) throw err;
          await api(`/repos/${repo}/git/refs`, {
            token,
            method: "POST",
            body: { ref: `refs/tags/${tag}`, sha },
          });
        }
        try {
          release = await api(`/repos/${repo}/releases`, {
            token,
            method: "POST",
            body: {
              tag_name: tag,
              name: `${event.compiler} ${event.latestVersion}`,
              body: renderReleaseBody(event),
            },
          });
          console.log(`Published release ${tag} (#${release.html_url})`);
        } catch (err) {
          if (!isStatus(err, 422)) throw err;
          release = await hasRelease(repo, token, tag);
          if (!release) throw err;
          console.log(`Release ${tag} raced in — treated as delivered`);
        }
      }
      delivered.add(event.compiler);
      summaryLines.push(
        `- [\`${event.compiler}\` **${event.latestVersion}**](${release.html_url}) (was \`${event.previousVersion ?? "unknown"}\`)`,
      );
    } catch (err) {
      problems.push({ compiler: event.compiler, err });
      console.error(`release publication failed for ${event.compiler}:`, err);
    }
  }

  await appendSummary("## New releases", summaryLines);
  return { delivered, problems };
}

const FIRST_FAILURE_SEPARATOR = "\n\nFirst failure:\n\n";

/** The workflow-run link renderFailureBody appends; differs between runs. */
function stripRunLink(body) {
  return body.replace(/\n\nWorkflow run: \S+$/, "");
}

/**
 * Normalized error text used for repeat-comment dedup: the rendered failure
 * body without its workflow-run link (that link differs between runs and
 * would otherwise defeat byte-identical comparison).
 */
export function failureSignature(event) {
  return stripRunLink(renderFailureBody(event));
}

/** Render the body of a new failure-tracking issue. */
export function failureIssueBody(event) {
  return (
    FAILURE_INTRO.replaceAll("{compiler}", `\`${event.compiler}\``) +
    `${FIRST_FAILURE_SEPARATOR}${renderFailureBody(event)}`
  );
}

/** Render the comment posted when a failed source's check succeeds again. */
export function renderRecoveryBody(compiler) {
  return (
    `The daily check for \`${compiler}\` succeeded again — closing this ` +
    "issue as recovered. Reopen it if the source breaks anew." +
    runLink()
  );
}

/**
 * The error text a failure thread last reported: its last comment, or — for
 * a thread with no repeat comments yet — the first failure in the issue
 * body. Normalized the same way as failureSignature.
 */
async function lastReportedError(repo, token, issue) {
  const comments = await api(
    `/repos/${repo}/issues/${issue.number}/comments?per_page=100`,
    { token },
  );
  if (comments.length > 0) {
    return stripRunLink(comments[comments.length - 1].body);
  }
  const [, firstFailure] = String(issue.body ?? "").split(
    FIRST_FAILURE_SEPARATOR,
  );
  return firstFailure === undefined ? "" : stripRunLink(firstFailure);
}

/**
 * File every check failure on its per-source tracking issue, creating issues
 * up to MAX_FAILURE_ISSUES, and close the threads of sources whose check
 * succeeded again. Repeat failures comment only when the error differs from
 * the thread's last reported error. Failures beyond the cap (and existing
 * threads, whatever their number) only show up in the step summary; the run
 * goes red either way via `failures` in index.js.
 *
 * @param {{ compiler: string, error: unknown }[]} events
 * @returns {Promise<{ problems: { compiler: string, err: unknown }[] }>}
 */
export async function reportFailures(events) {
  const problems = [];
  const summaryLines = [];
  const recoveryLines = [];

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    if (events.length === 0) return { problems };
    console.log(
      "GITHUB_TOKEN/GITHUB_REPOSITORY not set — printing failures locally.\n",
    );
    for (const event of events) {
      console.log(`--- failure ${event.compiler} ---`);
      console.log(renderFailureBody(event), "\n");
    }
    return { problems };
  }

  // Always listed, even for an empty failure set: a thread whose source is
  // absent from this run's failures has recovered and must be closed.
  const openIssues = await api(
    `/repos/${repo}/issues?state=open&per_page=100`,
    { token },
  );
  const byTitle = new Map(openIssues.map((issue) => [issue.title, issue]));
  let failureThreads = [...byTitle.keys()].filter((title) =>
    title.startsWith(FAILURE_PREFIX),
  ).length;

  const failedToday = new Set(events.map((event) => event.compiler));

  for (const event of events) {
    const title = failureIssueTitle(event.compiler);
    try {
      const existing = byTitle.get(title);
      let note = "";
      if (existing) {
        const lastError = await lastReportedError(repo, token, existing);
        if (lastError === failureSignature(event)) {
          console.log(
            `Skipping repeat comment on #${existing.number} (${title}): same error as last time`,
          );
          note = " (same error as last time)";
        } else {
          await api(`/repos/${repo}/issues/${existing.number}/comments`, {
            token,
            method: "POST",
            body: { body: renderFailureBody(event) },
          });
          console.log(`Commented on #${existing.number} (${title})`);
        }
      } else if (failureThreads >= MAX_FAILURE_ISSUES) {
        console.log(
          `Skipped failure issue for ${event.compiler}: cap of ${MAX_FAILURE_ISSUES} open failure issues reached — reported in summary only`,
        );
        note = ` (failure-issue cap ${MAX_FAILURE_ISSUES} reached)`;
      } else {
        const created = await api(`/repos/${repo}/issues`, {
          token,
          method: "POST",
          body: {
            title,
            body: failureIssueBody(event),
          },
        });
        byTitle.set(title, created);
        failureThreads += 1;
        console.log(`Created issue #${created.number} (${title})`);
      }
      summaryLines.push(
        `- \`${event.compiler}\`: check failed${note}${existingUrlNote(byTitle.get(title)?.number)}`,
      );
    } catch (err) {
      problems.push({ compiler: event.compiler, err });
      console.error(`failure notification failed for ${event.compiler}:`, err);
    }
  }

  // Recovery sweep: a thread whose source is absent from this run's failures
  // means the source's check succeeded again — comment and close it so
  // recovered sources free cap slots instead of accumulating.
  for (const [title, issue] of byTitle) {
    if (!title.startsWith(FAILURE_PREFIX)) continue;
    const compiler = title.slice(FAILURE_PREFIX.length);
    if (failedToday.has(compiler)) continue;
    try {
      await api(`/repos/${repo}/issues/${issue.number}/comments`, {
        token,
        method: "POST",
        body: { body: renderRecoveryBody(compiler) },
      });
      await api(`/repos/${repo}/issues/${issue.number}`, {
        token,
        method: "PATCH",
        body: { state: "closed" },
      });
      const url = issueUrl(issue.number);
      recoveryLines.push(
        `- \`${compiler}\`: recovered — closed ${
          url ? `[#${issue.number}](${url})` : `#${issue.number}`
        }`,
      );
      console.log(`Closed recovered failure issue #${issue.number} (${title})`);
    } catch (err) {
      problems.push({ compiler, err });
      console.error(`failure-issue close failed for ${compiler}:`, err);
    }
  }

  await appendSummary("## Check failures", summaryLines);
  await appendSummary("## Recovered sources", recoveryLines);
  return { problems };
}

function issueUrl(number) {
  const server = process.env.GITHUB_SERVER_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!number || !server || !repo) return null;
  return `${server}/${repo}/issues/${number}`;
}

function existingUrlNote(number) {
  const url = issueUrl(number);
  return url ? ` — tracked in [#${number}](${url})` : "";
}

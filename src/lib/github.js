/**
 * GitHub notifications: per compiler source a new-release tracking issue (a
 * "feature" to implement downstream, closed when done — max 9) plus, for
 * check failures (a "bug" to fix, closed when the checker is repaired),
 * per-source threads capped at MAX_FAILURE_ISSUES open issues to keep
 * breakage storms bounded. Both kinds receive repeated events as comments.
 *
 * Identified by exact title ("New Release: <source>" / "Error during
 * check: <source>"; no labels — this repo's issue list is ours).
 * Uses the REST API directly (no deps).
 *
 * Required env when running in GitHub Actions (set by the workflow):
 *   GITHUB_TOKEN       - the workflow's github.token
 *   GITHUB_REPOSITORY  - "owner/name" (set automatically by Actions)
 *
 * Without those (local runs) events are only printed.
 */

const API_ROOT = "https://api.github.com";

/** Upper bound on simultaneously open per-source check-failure issues. */
export const MAX_FAILURE_ISSUES = 5;
const RELEASE_PREFIX = "New Release: ";
const FAILURE_PREFIX = "Error during check: ";

const JSON_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export const issueTitle = (kind, compiler) =>
  kind === "release"
    ? `${RELEASE_PREFIX}${compiler}`
    : `${FAILURE_PREFIX}${compiler}`;

const ISSUE_INTRO = {
  release:
    "Tracking issue for new releases of the `{compiler}` compiler source, maintained by the daily check. Comment when a newer version appears; close once setup-fortran (or whatever consumes it) is updated.",
  error:
    "Tracking issue for check failures of the `{compiler}` compiler source, maintained by the daily check. While this issue is open the source is broken (page moved, parser drifted, ...); fix the checker and close.",
};

function runLink() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return "";
  return `\n\nWorkflow run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
}

/** Render one event (release detection or check failure) as Markdown. */
export function renderEventBody(event) {
  if (event.kind === "release") {
    return [
      `A new release was detected for \`${event.compiler}\`.`,
      "",
      `- previous: \`${event.previousVersion ?? "not recorded"}\``,
      `- latest: **\`${event.latestVersion}\`**`,
      `- source: ${event.url}`,
    ].join("\n");
  }
  return [
    `The daily check for \`${event.compiler}\` failed.`,
    "",
    "```",
    String(event.error?.stack ?? event.error),
    "```",
    `Source: ${event.url ?? "see checker"}`,
  ].join("\n") + runLink();
}

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      ...JSON_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    throw new Error(
      `GitHub API ${method} ${path} failed: ${res.status} ${await res.text()}`,
    );
  }
  return res.json();
}

/** Map issue title -> number for all open issues (one request). */
async function fetchOpenIssues(repo, token) {
  const data = await api(`/repos/${repo}/issues?state=open&per_page=100`, {
    token,
  });
  return new Map(data.map((issue) => [issue.title, issue.number]));
}

/**
 * Post every event to the issue of its (kind, compiler) thread, creating it
 * on first touch. Release events delivered successfully are returned in
 * `delivered` so the caller can persist their new state; a failed post
 * leaves the release undelivered and retried on the next run. `problems`
 * lists notification errors that must mark the run as failed.
 *
 * New release threads are unlimited (one per source). A failing source is
 * always reported, but once MAX_FAILURE_ISSUES failure threads are open,
 * further failing sources only appear in the step summary and the run's
 * exit code — no new issues are created (existing threads still get
 * comments).
 *
 * @param {{ kind: "release" | "error", compiler: string }[]} events
 * @returns {Promise<{ delivered: Set<string>, problems: { compiler: string, err: unknown }[] }>}
 */
export async function notifyCompilerEvents(events) {
  const delivered = new Set();
  const problems = [];
  if (events.length === 0) return { delivered, problems };

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const summaryLines = [];

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log(
      "GITHUB_TOKEN/GITHUB_REPOSITORY not set — printing events locally.\n",
    );
    for (const event of events) {
      console.log(`--- ${event.compiler} (${event.kind}) ---`);
      console.log(renderEventBody(event), "\n");
      if (event.kind === "release") delivered.add(event.compiler);
    }
    return { delivered, problems };
  }

  const openIssues = await fetchOpenIssues(repo, token);
  let failureThreads = [...openIssues.keys()].filter((title) =>
    title.startsWith(FAILURE_PREFIX),
  ).length;
  for (const event of events) {
    const title = issueTitle(event.kind, event.compiler);
    const body = renderEventBody(event);
    try {
      const existing = openIssues.get(title);
      if (existing) {
        await api(`/repos/${repo}/issues/${existing}/comments`, {
          token,
          method: "POST",
          body: { body },
        });
        console.log(`Commented on #${existing} (${title})`);
      } else if (
        event.kind === "error" &&
        failureThreads >= MAX_FAILURE_ISSUES
      ) {
        console.log(
          `Skipped failure issue for ${event.compiler}: cap of ${MAX_FAILURE_ISSUES} open failure issues reached — reported in summary only`,
        );
        summaryLines.push(
          `- \`${event.compiler}\`: check failed (failure-issue cap ${MAX_FAILURE_ISSUES} reached)`,
        );
      } else {
        const intro = ISSUE_INTRO[event.kind].replaceAll(
          "{compiler}",
          `\`${event.compiler}\``,
        );
        const created = await api(`/repos/${repo}/issues`, {
          token,
          method: "POST",
          body: {
            title,
            body: `${intro}\n\nFirst event:\n\n${body}`,
          },
        });
        openIssues.set(title, created.number);
        if (event.kind === "error") failureThreads += 1;
        console.log(`Created issue #${created.number} (${title})`);
      }
      if (event.kind === "release") delivered.add(event.compiler);
      summaryLines.push(
        `- \`${event.compiler}\`: ${event.kind === "release" ? `new release **${event.latestVersion}**` : "check failed"}`,
      );
    } catch (err) {
      problems.push({ compiler: event.compiler, err });
      console.error(`notification failed for ${event.compiler}:`, err);
    }
  }

  if (summaryPath && summaryLines.length > 0) {
    const fs = await import("node:fs/promises");
    await fs.appendFile(
      summaryPath,
      `## Compiler events\n\n${summaryLines.join("\n")}\n`,
    );
  }
  return { delivered, problems };
}

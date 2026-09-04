/**
 * GitHub notifications: open or comment on a single tracking issue listing
 * newly detected compiler releases. Uses the REST API directly (no deps).
 *
 * Required env when running in GitHub Actions (set by the workflow):
 *   GITHUB_TOKEN       - the workflow's github.token
 *   GITHUB_REPOSITORY  - "owner/name" (set automatically by Actions)
 *
 * Without those (local runs) the notification is only printed.
 */

const API_ROOT = "https://api.github.com";
const ISSUE_TITLE = "Fortran compiler release updates [fc-update-notifier]";

const JSON_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

/** Render the new releases as a Markdown table. */
export function renderMarkdown(newReleases) {
  return [
    "| Compiler | Previous | Latest | Source |",
    "| --- | --- | --- | --- |",
    ...newReleases.map(
      (r) =>
        `| ${r.compiler} | ${r.previousVersion ?? "—"} | **${r.latestVersion}** | ${r.url} |`,
    ),
  ].join("\n");
}

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
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

/** Find the open tracking issue, or null if it doesn't exist yet. */
async function findTrackingIssue(repo, token) {
  const query = `repo:${repo} is:issue is:open in:title "${ISSUE_TITLE}"`;
  const data = await api(`/search/issues?q=${encodeURIComponent(query)}`, {
    token,
  });
  return data.items[0] ?? null;
}

/**
 * Open the tracking issue (first notification) or add a comment to it.
 * Also appends to $GITHUB_STEP_SUMMARY when available.
 * @param {{ compiler: string, previousVersion?: string, latestVersion: string, url: string }[]} newReleases
 */
export async function notifyNewReleases(newReleases) {
  const table = renderMarkdown(newReleases);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const fs = await import("node:fs/promises");
    await fs.appendFile(summaryPath, `## New compiler releases\n\n${table}\n`);
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log(
      "GITHUB_TOKEN/GITHUB_REPOSITORY not set — skipping issue creation.\n",
    );
    console.log(table);
    return;
  }

  const issue = await findTrackingIssue(repo, token);
  if (issue) {
    await api(`/repos/${repo}/issues/${issue.number}/comments`, {
      token,
      method: "POST",
      body: { body: `New compiler release(s) detected:\n\n${table}` },
    });
    console.log(`Commented on tracking issue #${issue.number}`);
  } else {
    const created = await api(`/repos/${repo}/issues`, {
      token,
      method: "POST",
      body: {
        title: ISSUE_TITLE,
        body: `This issue tracks new Fortran compiler releases detected by the daily check.\n\nNew release(s) detected:\n\n${table}`,
        labels: ["release-notification"],
      },
    });
    console.log(`Created tracking issue #${created.number}`);
  }
}

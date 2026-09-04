# fc-update-notifier

Checks daily whether new releases of
Fortran compilers have been published on their respective distribution
channels:

| Compiler | Checked Source |
| --- | --- |
| aocc | https://developer.amd.com/amd-aocc/ |
| nvfortran | https://developer.nvidia.com/hpc-sdk-downloads |
| ifx | ifx release notes (see `src/check-ifx.js`) |

The checks run on a schedule via a GitHub Actions workflow
[`.github/workflows/check.yml`](.github/workflows/check.yml). The last-seen version of each compiler
is stored in [`data/state.json`](data/state.json). When a check detects a
version newer than the stored one, a new issue is created.

## Usage

Requires Node.js >= 20 (uses the built-in `fetch`).

```sh
npm run check              # check for new releases
npm run latest             # print latest versions, e.g. "ifx 2026.1.1"
npm run latest -- ifx      # print only the version: "2026.1.1"
```

## Implementation Notes

- Each vendor page has no public JSON API, so the checkers will likely scrape
  HTML; page markup may change without notice, so keep parsers lenient and
  fail loudly when a version can't be found.
- ifx versions follow a `YYYY.N` scheme (e.g. `2025.2`); AOCC and nvfortran
  use conventional semver-like versions.
- Notifications: the workflow's `github.token` is passed as `GITHUB_TOKEN`
  and used to create/comment on a single tracking issue (found by title
  search, labeled `release-notification`), so one issue accumulates the
  history instead of one issue per release.
- After the check, the workflow commits an updated `data/state.json` back to
  the repo (skipped when nothing changed). State is only persisted after a
  successful notification, so a failed issue post is retried on the next run.

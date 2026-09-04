# fc-update-notifier

Checks daily whether new releases of
Fortran compilers have been published on their respective distribution
channels:

| Compiler | Checked Source |
| --- | --- |
| aocc | https://developer.amd.com/amd-aocc/ |
| armflang | https://developer.arm.com/packages/arm-toolchains/ubuntu/dists/noble/main/binary-arm64/Packages |
| ifx | https://pypi.org/pypi/intel-fortran-rt/json |
| nvfortran | https://docs.nvidia.com/hpc-sdk/release-notes/ |

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

# fc-release-tracker

Tracks new Fortran compiler (FC) versions as they become available. The [installation sources](#sources) are monitored via a scheduled job in GitHub Actions, and a GitHub Release is published for each newly detected compiler version.

**Activate Watch → Custom → Releases to get notified of new compiler versions.**

## Usage

Requires Node.js 20 or later.

Fetch the latest compiler versions from all sources:

```sh
npm run latest
```

Fetch the latest version of a specific compiler:

```sh
npm run latest -- lfortran
```

Check for new releases and update local state:
```sh
npm run check
```

## Development

Run the test suite:

```sh
npm test
```

## Sources

| Compiler | Checked Source |
| --- | --- |
| aocc | https://developer.amd.com/amd-aocc/ |
| armflang | https://developer.arm.com/packages/arm-toolchains/ubuntu/dists/noble/main/binary-arm64/Packages |
| flang | https://api.github.com/repos/llvm/llvm-project/releases/latest |
| gfortran (apt) | https://ppa.launchpadcontent.net/ubuntu-toolchain-r/test/ubuntu/dists/noble/main/binary-amd64/Packages.gz |
| gfortran (brew) | https://formulae.brew.sh/api/formula/gcc.json |
| gfortran (winlibs) | https://api.github.com/repos/brechtsanders/winlibs_mingw/releases/latest |
| ifx | https://pypi.org/pypi/intel-fortran-rt/json |
| lfortran | https://api.anaconda.org/package/conda-forge/lfortran |
| nvfortran | https://docs.nvidia.com/hpc-sdk/release-notes/ |

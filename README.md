# fc-release-tracker

Tracks new Fortran compiler (FC) versions as they become available. All [sources](#sources) are monitored via a scheduled job in GitHub Actions, and a GitHub Release is published for each newly detected compiler version.

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
| armflang | https://developer.arm.com/tools-and-software/arm-fortran-compiler |
| flang | https://github.com/llvm/llvm-project/releases/latest |
| gfortran (apt) | https://launchpad.net/~ubuntu-toolchain-r/+archive/ubuntu/test |
| gfortran (brew) | https://formulae.brew.sh/formula/gcc |
| gfortran (winlibs) | https://github.com/brechtsanders/winlibs_mingw/releases/latest |
| ifx | https://pypi.org/project/intel-fortran-rt/ |
| lfortran | https://anaconda.org/conda-forge/lfortran |
| nvfortran | https://docs.nvidia.com/hpc-sdk/release-notes/index.html |

# fc-release-tracker

Get notified when new Fortran compiler versions are released.

The project monitors all [sources](#sources) via a scheduled GitHub Actions job and publishes a GitHub Release for each newly detected compiler version.

Activate **Watch → Custom → Releases** to get notified.

## Usage

Requires Node.js 20 or later.

Use `latest` to see the latest compiler versions available from all tracked sources:

```sh
npm run latest
```

To fetch the latest version of a specific compiler:

```sh
npm run latest -- lfortran
```

The `check` command is run automatically by GitHub Actions to detect new releases and update the local state.


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
| ifx | https://www.intel.com/content/www/us/en/developer/tools/oneapi/fortran-compiler-download.html |
| lfortran | https://anaconda.org/conda-forge/lfortran |
| nvfortran | https://docs.nvidia.com/hpc-sdk/release-notes/index.html |

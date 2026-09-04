# fc-release-tracker

Checks for new Fortran compiler (FC) releases daily.

**Watch this repository to get notified when a new release is detected.**

All [sources](#sources) are checked via GitHub Actions. When a new compiler version is detected, an issue is created, notifying repository watchers.

## Usage

Requires Node.js 20 or later.

List all versions:

```sh
npm run latest
```

List latest version of a specific compiler:

```sh
npm run latest -- lfortran
```

Check for new releases and update local state:
```sh
npm run check
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

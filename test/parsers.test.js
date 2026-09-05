import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseAOCC } from "../src/check-aocc.js";
import { parseArmflang } from "../src/check-armflang.js";
import { parseFlang } from "../src/check-flang.js";
import { parseGFortranApt } from "../src/check-gfortran-apt.js";
import { parseGFortranBrew } from "../src/check-gfortran-brew.js";
import { parseGFortranWinlibs } from "../src/check-gfortran-winlibs.js";
import { parseIfx } from "../src/check-ifx.js";
import { parseLFortran } from "../src/check-lfortran.js";
import { parseNvfortran } from "../src/check-nvfortran.js";

describe("parseAOCC", () => {
  it("extracts the latest tarball version and strips the trailing .0", () => {
    const body = `
      <h2>AMD AOCC 5.2</h2>
      <a href="...">aocc-compiler-5.2.0.tar</a>
      <a href="...">aocc-compiler-4.1.0.tar</a>
    `;
    assert.equal(parseAOCC(body), "5.2");
  });

  it("accepts underscore and space separators", () => {
    assert.equal(parseAOCC("aocc_compiler-4.1.0.tar"), "4.1");
    assert.equal(parseAOCC("AOCC Compiler 3.2.0"), "3.2");
  });

  it("throws on an unexpected real patch release", () => {
    assert.throws(() => parseAOCC("aocc-compiler-5.2.1.tar"), /patch release/);
  });

  it("throws when no release marker is present", () => {
    assert.throws(
      () => parseAOCC("<html>nothing here</html>"),
      /no AOCC release marker/,
    );
  });
});

describe("parseArmflang", () => {
  const packages = `Package: arm-compiler-for-linux
Version: 22.1-1
Description: metapackage, not the toolchain

Package: arm-toolchain-for-linux
Version: 21.0-3~noble
Description: older toolchain

Package: arm-toolchain-for-linux
Version: 22.1-54~noble
Description: current toolchain
`;

  it("picks the newest toolchain version, ignoring the apt revision", () => {
    assert.equal(parseArmflang(packages), "22.1");
  });

  it("keeps full three-part versions when present", () => {
    const text = packages.replace("22.1-54~noble", "22.1.2-1~noble");
    assert.equal(parseArmflang(text), "22.1.2");
  });

  it("throws when no toolchain package is present", () => {
    assert.throws(
      () => parseArmflang("Package: gcc-15\nVersion: 15.2.0-1\n"),
      /no arm-toolchain-for-linux/,
    );
  });
});

describe("parseFlang", () => {
  it("extracts major.minor.patch from the llvmorg tag", () => {
    assert.equal(
      parseFlang(JSON.stringify({ tag_name: "llvmorg-23.1.0" })),
      "23.1.0",
    );
  });

  it("ignores release-candidate suffixes", () => {
    assert.equal(
      parseFlang(JSON.stringify({ tag_name: "llvmorg-23.1.0-rc4" })),
      "23.1.0",
    );
  });

  it("throws on unexpected tag shapes", () => {
    assert.throws(
      () => parseFlang(JSON.stringify({ tag_name: "llvmorg-23" })),
      /unexpected LLVM release tag/,
    );
  });
});

describe("parseGFortranApt", () => {
  // gfortran-15 carries a real release version while the newest major (16)
  // only exists as date-based snapshot builds — the report must be "16".
  const snapshotOnly = `Package: gfortran-14
Version: 14.1.0-1ubuntu1~24.04
Description: GNU Fortran 14

Package: gfortran-15
Version: 15.2.0-1ubuntu1~24.04

Package: gfortran-16
Version: 16-20260315-1ubuntu1~24~ppa1
`;

  it("reports the bare major while the newest major has only snapshot builds", () => {
    assert.equal(parseGFortranApt(snapshotOnly), "16");
  });

  it("reports the full version once a release-format version appears for the newest major", () => {
    const withRelease = snapshotOnly.replace(
      "Version: 16-20260315-1ubuntu1~24~ppa1",
      "Version: 16.1.0-1ubuntu1~24.04",
    );
    assert.equal(parseGFortranApt(withRelease), "16.1.0");
  });

  it("throws when no gfortran packages are present", () => {
    assert.throws(
      () => parseGFortranApt("Package: gcc-15\nVersion: 15.2.0-1\n"),
      /no gfortran-\* packages/,
    );
  });
});

describe("parseGFortranBrew", () => {
  it("reads versions.stable", () => {
    assert.equal(
      parseGFortranBrew(JSON.stringify({ versions: { stable: "16.2.0" } })),
      "16.2.0",
    );
    assert.equal(
      parseGFortranBrew(JSON.stringify({ versions: { stable: "16.2" } })),
      "16.2",
    );
  });

  it("throws on unexpected stable values", () => {
    assert.throws(
      () =>
        parseGFortranBrew(JSON.stringify({ versions: { stable: "HEAD-abc1234" } })),
      /unexpected brew gcc stable version/,
    );
    assert.throws(
      () => parseGFortranBrew(JSON.stringify({ versions: {} })),
      /unexpected brew gcc stable version/,
    );
  });
});

describe("parseGFortranWinlibs", () => {
  it("parses the GCC version from the release title", () => {
    const body = JSON.stringify({
      name: "GCC 16.2.0 (POSIX threads) + MinGW-w64 14.0.0 UCRT (release 1)",
      tag_name: "16.2.0posix-14.0.0-ucrt-r1",
    });
    assert.equal(parseGFortranWinlibs(body), "16.2.0");
  });

  it("falls back to the tag prefix when the title has no GCC version", () => {
    const body = JSON.stringify({
      name: "Windows release",
      tag_name: "16.2.0posix-14.0.0-ucrt-r1",
    });
    assert.equal(parseGFortranWinlibs(body), "16.2.0");
  });

  it("throws when neither title nor tag carries a version", () => {
    assert.throws(
      () => parseGFortranWinlibs(JSON.stringify({ name: "?", tag_name: "r1" })),
      /no GCC version found/,
    );
  });
});

describe("parseIfx", () => {
  it("reads info.version", () => {
    assert.equal(
      parseIfx(JSON.stringify({ info: { version: "2026.1.1" } })),
      "2026.1.1",
    );
  });

  it("throws on unexpected version formats", () => {
    assert.throws(
      () => parseIfx(JSON.stringify({ info: { version: "next" } })),
      /unexpected intel-fortran-rt version/,
    );
  });
});

describe("parseLFortran", () => {
  it("picks the greatest dotted version, ignoring non-release tags", () => {
    const body = JSON.stringify({
      versions: ["0.9", "0.64.1", "0.65.0", "1.0.0rc1"],
    });
    assert.equal(parseLFortran(body), "0.65.0");
  });

  it("throws when no dotted versions exist", () => {
    assert.throws(
      () => parseLFortran(JSON.stringify({ versions: ["1.0.0rc1"] })),
      /no lfortran versions/,
    );
  });
});

describe("parseNvfortran", () => {
  it("reads the version from the docs page title", () => {
    const body =
      "<title>Archive — HPC SDK Release Notes 26.5 documentation</title>";
    assert.equal(parseNvfortran(body), "26.5");
  });

  it("matches the title case-insensitively", () => {
    assert.equal(
      parseNvfortran("<title>hpc sdk release notes 25.7 documentation</title>"),
      "25.7",
    );
  });

  it("throws when the title has no version marker", () => {
    assert.throws(
      () => parseNvfortran("<title>HPC SDK documentation</title>"),
      /no HPC SDK release marker/,
    );
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isNewer } from "../src/lib/version.js";

describe("isNewer", () => {
  it("counts a first observed version (null current) as newer", () => {
    assert.equal(isNewer("5.2", null), true);
    assert.equal(isNewer("5.2", undefined), true);
  });

  it("rejects equal versions", () => {
    assert.equal(isNewer("5.2", "5.2"), false);
    assert.equal(isNewer("2026.1.1", "2026.1.1"), false);
    // missing components count as zero, so "5.2.0" == "5.2"
    assert.equal(isNewer("5.2.0", "5.2"), false);
    assert.equal(isNewer("5.2", "5.2.0"), false);
  });

  it("compares components numerically, not lexicographically", () => {
    assert.equal(isNewer("25.10", "25.7"), true);
    assert.equal(isNewer("25.7", "25.10"), false);
    assert.equal(isNewer("2026.1.1", "2026.1.0"), true);
    assert.equal(isNewer("2026.1.0", "2026.1.1"), false);
  });

  it("treats shorter versions as padded with zeros", () => {
    assert.equal(isNewer("16.1.0", "16"), true);
    assert.equal(isNewer("16", "16.1.0"), false);
  });

  it("detects downgrades as not newer", () => {
    assert.equal(isNewer("0.64.1", "0.65.0"), false);
    assert.equal(isNewer("15.2.0", "16"), false);
  });

  it("follows the gfortran-apt snapshot→release lifecycle exactly once", () => {
    // bare major reported while the newest major only has snapshot builds,
    // then full versions once a release-format version appears
    // (see check-gfortran-apt.js)
    const transitions = [
      ["15.2.0", "16"],
      ["16", "16.1.0"],
      ["16.1.0", "16.1.1"],
    ];
    for (const [current, candidate] of transitions) {
      assert.equal(isNewer(candidate, current), true, `${current} -> ${candidate}`);
    }
  });

  it("falls back to string comparison for non-numeric parts", () => {
    assert.equal(isNewer("5.2.beta", "5.2.0"), true);
    assert.equal(isNewer("5.2.0", "5.2.beta"), false);
  });
});

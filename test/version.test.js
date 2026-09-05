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
    assert.equal(isNewer("5.2.0.0", "5.2"), false);
    assert.equal(isNewer("5.2", "5.2.0.0"), false);
  });

  it("compares components numerically, not lexicographically", () => {
    assert.equal(isNewer("25.10", "25.7"), true);
    assert.equal(isNewer("25.7", "25.10"), false);
    assert.equal(isNewer("2026.1.10", "2026.1.9"), true);
    assert.equal(isNewer("2026.1.9", "2026.1.10"), false);
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

  it("splits on dash and plus separators, not just dots", () => {
    assert.equal(isNewer("1.2-3", "1.2"), true);
    assert.equal(isNewer("1.2", "1.2-3"), false);
    assert.equal(isNewer("1.2+3", "1.2"), true);
    assert.equal(isNewer("1.2", "1.2+3"), false);
  });

  it("falls back to string comparison for non-numeric parts", () => {
    assert.equal(isNewer("5.2.beta", "5.2.0"), true);
    assert.equal(isNewer("5.2.0", "5.2.beta"), false);
  });
});

// Every channel's real version train: each step must fire exactly once, and
// replaying any version against a same-or-newer state must never fire again.
// (A repeated notification or a missed one is the worst failure this module
// can cause, since it directly gates release publication.)
describe("isNewer against real version trains", () => {
  const trains = {
    aocc: ["4.1", "5.0", "5.2"],
    flang: ["22.1.8", "23.1.0"],
    ifx: ["2025.2", "2026.0.0", "2026.1.1", "2026.1.2"],
    // 0.9 < 0.65 only holds with numeric (not lexicographic) segments
    lfortran: ["0.9", "0.65.0"],
    nvfortran: ["25.7", "26.5"],
    "gfortran-apt": ["15.2.0", "16", "16.1.0", "16.1.1", "17"],
  };

  for (const [compiler, versions] of Object.entries(trains)) {
    it(`notifies exactly once per ${compiler} transition`, () => {
      for (let i = 1; i < versions.length; i++) {
        assert.equal(
          isNewer(versions[i], versions[i - 1]),
          true,
          `${versions[i - 1]} -> ${versions[i]}`,
        );
      }
      for (let i = 0; i < versions.length; i++) {
        for (let j = 0; j <= i; j++) {
          assert.equal(
            isNewer(versions[j], versions[i]),
            false,
            `${versions[j]} vs current ${versions[i]}`,
          );
        }
      }
    });
  }
});

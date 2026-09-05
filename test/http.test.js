import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { fetchText, maxVersion } from "../src/lib/http.js";

describe("maxVersion", () => {
  it("picks the greatest version", () => {
    assert.equal(maxVersion(["1.2.3", "1.20.0", "1.3.0"]), "1.20.0");
    assert.equal(maxVersion(["0.64.1", "0.65.0", "0.9"]), "0.65.0");
  });

  it("compares CalVer schemes alongside semver-like ones", () => {
    assert.equal(maxVersion(["2025.2", "2026.1.1"]), "2026.1.1");
    assert.equal(maxVersion(["2026.1.1", "2026.1.0"]), "2026.1.1");
  });

  it("ignores duplicate candidates", () => {
    assert.equal(maxVersion(["16.2.0", "16.2.0"]), "16.2.0");
  });

  it("throws when there are no candidates", () => {
    assert.throws(() => maxVersion([]), /no version candidates found/);
  });
});

describe("fetchText", () => {
  /** Run `fn` against a throwaway local HTTP server with the given handler. */
  async function withServer(handler, fn) {
    const server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      return await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it("returns the body of a 200 response", async () => {
    await withServer(
      (req, res) => res.end("16.2.0"),
      async (url) => {
        assert.equal(await fetchText(url), "16.2.0");
      },
    );
  });

  it("throws on error statuses, including the status code", async () => {
    await withServer(
      (req, res) => res.writeHead(404).end("nope"),
      async (url) => {
        await assert.rejects(fetchText(url), /fetch failed: 404/);
      },
    );
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { gunzipSync, gzipSync } from "node:zlib";

import { fetchBytes, fetchText, maxVersion } from "../src/lib/http.js";

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

  it("handles a single candidate", () => {
    assert.equal(maxVersion(["1.0.0"]), "1.0.0");
  });

  it("is order-independent", () => {
    assert.equal(maxVersion(["1.20.0", "1.2.3", "1.3.0"]), "1.20.0");
    assert.equal(maxVersion(["0.65.0", "0.9", "0.64.1"]), "0.65.0");
  });

  it("tie-breaks numerically equal spellings deterministically", () => {
    // e.g. apt revisions can produce both "22.1" and "22.1.0" spellings
    assert.equal(maxVersion(["22.1", "22.1.0"]), "22.1.0");
    assert.equal(maxVersion(["22.1.0", "22.1"]), "22.1.0");
    assert.equal(maxVersion(["16", "16.1", "16.1.0"]), "16.1.0");
  });

  it("treats dashes and plus signs like dots, same as isNewer", () => {
    assert.equal(maxVersion(["1.2.3", "1.2-3"]), "1.2.3");
    assert.equal(maxVersion(["1.2+3", "1.2.3"]), "1.2.3");
  });

  it("orders non-numeric segments as strings, deterministically", () => {
    assert.equal(maxVersion(["1.0.0-rc1", "1.0.0-rc2"]), "1.0.0-rc2");
    assert.equal(maxVersion(["1.0.0-rc2", "1.0.0-rc1"]), "1.0.0-rc2");
  });

  it("throws when there are no candidates", () => {
    assert.throws(() => maxVersion([]), /no version candidates found/);
  });
});

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

describe("fetchText", () => {
  it("returns the body of a 200 response", async () => {
    await withServer(
      (req, res) => res.end("16.2.0"),
      async (url) => {
        assert.equal(await fetchText(url), "16.2.0");
      },
    );
  });

  it("sends the shared user-agent (some sources reject default fetch UAs)", async () => {
    let userAgent = "";
    await withServer(
      (req, res) => {
        userAgent = req.headers["user-agent"];
        res.end("ok");
      },
      async (url) => {
        await fetchText(url);
      },
    );
    assert.equal(userAgent, "Mozilla/5.0");
  });

  it("follows redirects", async () => {
    await withServer(
      (req, res) => {
        if (req.url === "/redirect") res.writeHead(302, { location: "/final" }).end();
        else res.end("landed");
      },
      async (url) => {
        assert.equal(await fetchText(`${url}/redirect`), "landed");
      },
    );
  });

  it("throws on client errors, including the status code", async () => {
    await withServer(
      (req, res) => res.writeHead(404).end("nope"),
      async (url) => {
        await assert.rejects(fetchText(url), /fetch failed: 404/);
      },
    );
  });

  it("throws on server errors", async () => {
    await withServer(
      (req, res) => res.writeHead(500).end(),
      async (url) => {
        await assert.rejects(fetchText(url), /fetch failed: 500/);
      },
    );
  });
});

describe("fetchBytes", () => {
  it("returns raw bytes the caller can decompress (apt checker pattern)", async () => {
    const payload = gzipSync(
      Buffer.from("Package: gfortran-16\nVersion: 16.1.0-1\n"),
    );
    await withServer(
      (req, res) => res.end(payload),
      async (url) => {
        const raw = await fetchBytes(url);
        assert.equal(
          gunzipSync(new Uint8Array(raw)).toString("utf8"),
          "Package: gfortran-16\nVersion: 16.1.0-1\n",
        );
      },
    );
  });
});

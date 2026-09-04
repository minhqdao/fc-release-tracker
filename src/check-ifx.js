/**
 * Intel ifx (Intel Fortran Compiler) release checker.
 *
 * Source of truth: the `intel-fortran-rt` package Intel publishes to PyPI —
 * the Fortran runtime is versioned in lockstep with the compiler itself
 * (e.g. 2026.1.1), giving a small, structured JSON API instead of scraping
 * Intel's marketing CMS.
 * Cross-checks performed while choosing this channel:
 *   - Intel's apt repo names packages `intel-fortran-compiler-<version>` but
 *     only at major.minor granularity — patch updates never appear there.
 *   - PyPI `intel-cmplr-lib-rt` carries the same version (lib+compiler ship
 *     together); `intel-fortran-rt` is the closest to the compiler itself.
 */

import { fetchText } from "./lib/http.js";

export const IFX_PYPI_URL = "https://pypi.org/pypi/intel-fortran-rt/json";

/**
 * @returns {Promise<{ compiler: "ifx", latestVersion: string, url: string }>}
 */
export async function checkIfx() {
  const data = JSON.parse(await fetchText(IFX_PYPI_URL));
  const latestVersion = data.info?.version;
  if (!/^\d{4}\.\d/.test(latestVersion ?? "")) {
    throw new Error(`unexpected intel-fortran-rt version in ${IFX_PYPI_URL}`);
  }
  return { compiler: "ifx", latestVersion, url: IFX_PYPI_URL };
}

// Allow running standalone: node src/check-ifx.js
if (import.meta.url === `file://${process.argv[1]}`) {
  checkIfx()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

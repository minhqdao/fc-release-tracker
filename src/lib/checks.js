/**
 * Central registry of compiler checks, shared by the daily check runner
 * (index.js) and the `latest` CLI.
 */

import { checkAOCC } from "../check-aocc.js";
import { checkNvfortran } from "../check-nvfortran.js";
import { checkIfx } from "../check-ifx.js";

/** @type {Readonly<Record<string, () => Promise<{ compiler: string, latestVersion: string, url: string }>>>} */
export const CHECKS = Object.freeze({
  aocc: checkAOCC,
  nvfortran: checkNvfortran,
  ifx: checkIfx,
});

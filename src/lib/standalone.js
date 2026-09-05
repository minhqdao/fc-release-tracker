/**
 * Shared tail for the per-compiler checkers: when a check module is executed
 * directly (node src/check-<name>.js), run its check and print the result as
 * JSON. The entry-module comparison needs the caller's import.meta.url, so
 * the caller passes its own.
 */

export function runStandalone(moduleUrl, check) {
  if (moduleUrl !== `file://${process.argv[1]}`) return;
  return check()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

// scripts/isMainModule.ts
//
// ESM has no `require.main === module`. This compares the module's own URL
// against the file node was invoked with, so a script can auto-run as a CLI
// while staying side-effect-free when imported (by another script or a test).

import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    // realpath so an entry reached through a symlink still matches.
    return moduleUrl === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

// Guards the docs' one-flavour-per-guide rule: React and Wagmi belong in the
// React SDK guide only. Every other guide is framework-neutral TypeScript, so a
// reader on the API-only or TypeScript SDK track is never shown a hook they
// would have to unpick. Run via `yarn lint`.
import fs from "node:fs";
import path from "node:path";

import { REFERENCE_EXAMPLES } from "../lib/reference-examples.ts";

// Identifier-level markers only: an `npm install wagmi` line in prose is a
// pointer to the React track, not framework-coupled example code.
const REACT_MARKERS = /\bfrom\s+"(?:react|wagmi)"|\buse[A-Z]\w*\s*\(/;

// Comments legitimately name the hooks they replace ("Wagmi's usePublicClient()
// returns exactly this client"), so only executable code is matched. Comment
// bodies are blanked rather than removed to keep line numbers accurate.
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (comment, prefix) => prefix + " ".repeat(comment.length - prefix.length),
    );
}

// The one guide whose subject is React.
const REACT_GUIDE = "advanced-orders-react";
const REACT_CONTENT_FILE = "advanced-orders-react.md";

// Deliberate exceptions, keyed by "<example key>::<file name>" and justified by
// the surrounding prose. The canonical Liquidity Hub flow stays framework-
// neutral; its optional second tab demonstrates the production React adapter.
const ALLOWED = new Map([
  [
    "liquidity-hub:submit-swap::react-example.tsx",
    "Optional React presentation adapter beside the canonical TypeScript flow.",
  ],
]);

const failures = [];

for (const [key, example] of Object.entries(REFERENCE_EXAMPLES)) {
  if (key.startsWith(`${REACT_GUIDE}:`)) continue;

  for (const file of example.files) {
    const exceptionKey = `${key}::${file.name}`;
    if (ALLOWED.has(exceptionKey)) continue;

    const match = stripComments(file.code).match(REACT_MARKERS);
    if (match) {
      failures.push(
        `lib/reference-examples.ts  ${key} -> ${file.name}: ${match[0]}`,
      );
    }
  }
}

const contentDirectory = path.join(import.meta.dirname, "..", "content");
for (const fileName of fs.readdirSync(contentDirectory).sort()) {
  if (!fileName.endsWith(".md") || fileName === REACT_CONTENT_FILE) continue;

  const lines = stripComments(
    fs.readFileSync(path.join(contentDirectory, fileName), "utf8"),
  ).split("\n");
  let inFence = false;

  lines.forEach((line, index) => {
    if (line.startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (!inFence) return;

    const match = line.match(REACT_MARKERS);
    if (match) {
      failures.push(`content/${fileName}:${index + 1}: ${match[0]}`);
    }
  });
}

if (failures.length > 0) {
  console.error(
    `\nFramework-neutral check failed - React or Wagmi found outside the ${REACT_GUIDE} guide:\n`,
  );
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    "\nRewrite the example so its wallet dependencies arrive as parameters,",
  );
  console.error(
    "or add a justified entry to ALLOWED in scripts/check-framework-neutral.mjs.\n",
  );
  process.exit(1);
}

console.log(
  `Framework-neutral check passed (${ALLOWED.size} documented exceptions).`,
);

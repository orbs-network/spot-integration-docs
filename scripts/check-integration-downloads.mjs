import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import sources from "../lib/generated-integration-sources.json" with { type: "json" };
const structuralErrors = new Set([2300, 2304, 2393, 2440, 2448, 2451, 2454, 2552, 2305]);
// Optional source-contract check: SPOT_UI_SOURCE=../spot-ui node scripts/check-integration-downloads.mjs
// The default check remains portable; source mode also checks SDK arguments,
// properties, and exports against the selected checkout rather than stale dist.
const sdkRoot = process.env.SPOT_UI_SOURCE ? path.resolve(process.env.SPOT_UI_SOURCE) : undefined;
const sdkPaths = sdkRoot ? Object.fromEntries([
  ["@orbs-network/spot-ui", "spot-ui", "index.ts"],
  ["@orbs-network/spot-ui/internal", "spot-ui", "internal.ts"],
  ["@orbs-network/spot-react", "spot-react", "index.ts"],
  ["@orbs-network/spot-react/internal", "spot-react", "internal.ts"],
].map(([name, pkg, entry]) => {
  const filename = path.join(sdkRoot, "packages", pkg, "src", entry);
  assert(fs.existsSync(filename), `SPOT_UI_SOURCE is missing ${filename}`);
  return [name, [filename]];
})) : undefined;

function isMissingHostModule(diagnostic) {
  if (diagnostic.code !== 2307) return false;
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const moduleName = message.match(/^Cannot find module '([^']+)'/)?.[1];
  // Host wallet/UI adapters are intentionally external. SDK imports must resolve.
  return moduleName !== undefined && !/^@orbs-network\/spot-(?:ui|react)(?:\/|$)/.test(moduleName);
}

// Swap's contextual examples are not part of its generated download. Validate
// SDK names documented in prose and fences without requiring snippet-only host
// locals to compile as a standalone application. API-only guides have no client.
function checkDocumentedSdkSource() {
  const probes = [
    'import type { SpotClient as DocumentedSpotClient } from "@orbs-network/spot-ui";',
    'declare const client: DocumentedSpotClient;',
  ];
  const origins = new Map();
  const seen = new Set();
  const sdkPackages = new Set(['@orbs-network/spot-ui', '@orbs-network/spot-react']);
  let importIndex = 0;
  const addProbe = (key, code, origin) => {
    if (seen.has(key)) return;
    seen.add(key);
    probes.push(code);
    origins.set(probes.length - 1, origin);
  };
  for (const guide of ['swap', 'swap-shared', 'advanced-orders-shared', 'advanced-orders-sdk', 'advanced-orders-react']) {
    const relative = `content/${guide}.md`;
    const markdown = fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
    const originAt = offset => `${relative}:${markdown.slice(0, offset).split('\n').length}`;
    const addMembers = (code, offset) => {
      for (const member of code.matchAll(/\bclient\.([A-Za-z_$][\w$]*)\b/g)) {
        addProbe(`client:${member[1]}`, `client.${member[1]};`, originAt(offset + member.index));
      }
    };
    const prose = markdown.replace(/^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm, (fence, language, code, offset) => {
      if (/^(?:tsx?|typescript|jsx?|javascript)(?:\s|$)/.test(language)) {
        const codeOffset = offset + fence.indexOf('\n') + 1;
        addMembers(code, codeOffset);
        const source = ts.createSourceFile(`${guide}.tsx`, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        for (const statement of source.statements) {
          if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
              !sdkPackages.has(statement.moduleSpecifier.text)) continue;
          const bindings = statement.importClause?.namedBindings;
          if (!bindings || !ts.isNamedImports(bindings)) continue;
          for (const binding of bindings.elements) {
            const imported = (binding.propertyName ?? binding.name).text;
            const pkg = statement.moduleSpecifier.text;
            addProbe(`${pkg}:${imported}`, `import type { ${imported} as DocumentedImport${importIndex++} } from ${JSON.stringify(pkg)};`,
              originAt(codeOffset + binding.getStart(source)));
          }
        }
      }
      return fence.replace(/[^\n]/g, ' ');
    });
    for (const inline of prose.matchAll(/`([^`\n]+)`/g)) addMembers(inline[1], inline.index + 1);
  }
  const filename = path.resolve('.integration-check-documented-sdk.ts');
  const options = { noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, skipLibCheck: true, strict: true,
    baseUrl: sdkRoot, paths: sdkPaths, resolveJsonModule: true, esModuleInterop: true };
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile;
  host.getSourceFile = (name, version, onError, fresh) => name === filename
    ? ts.createSourceFile(name, probes.join('\n'), version, true)
    : original(name, version, onError, fresh);
  const program = ts.createProgram([filename], options, host);
  const source = program.getSourceFile(filename);
  for (const diagnostic of [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]) {
    const line = diagnostic.start === undefined ? undefined : source.getLineAndCharacterOfPosition(diagnostic.start).line;
    console.error(`${origins.get(line) ?? filename}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
    process.exitCode = 1;
  }
}

if (sdkRoot) checkDocumentedSdkSource();

for (const [id, code] of Object.entries(sources)) {
  const filename = path.resolve(`.integration-check-${id}.${id === 'advanced-orders-react' ? 'tsx' : 'ts'}`);
  const options = { noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, skipLibCheck: true, strict: true,
    ...(sdkRoot ? { baseUrl: sdkRoot, paths: sdkPaths, resolveJsonModule: true, esModuleInterop: true } : {}) };
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile;
  host.getSourceFile = (name, version, onError, fresh) => name === filename ? ts.createSourceFile(name, code, version, true) : original(name, version, onError, fresh);
  const program = ts.createProgram([filename], options, host);
  // Check only the integration module's semantic diagnostics in source mode;
  // unrelated SDK implementation/dependency diagnostics belong to its own build.
  const semanticDiagnostics = sdkRoot
    ? program.getSemanticDiagnostics(program.getSourceFile(filename)).filter(d => !isMissingHostModule(d))
    : program.getSemanticDiagnostics().filter(d => structuralErrors.has(d.code));
  const diagnostics = [...program.getSyntacticDiagnostics(), ...semanticDiagnostics];
  if (diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: x => x, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' }));
    process.exitCode = 1;
  }
  assert(!/^```/m.test(code), `${id} contains Markdown fences`);
  assert(!/from ["']\.\/(?:config|order-types|build-order|sign-order|types)["']/.test(code), `${id} retains an included-module import`);
}
if (!process.exitCode) console.log(sdkRoot
  ? `All ${Object.keys(sources).length} downloads and documented SDK imports/client members pass source-contract checks against ${sdkRoot}. External host adapters still require validation in the consuming application.`
  : `All ${Object.keys(sources).length} downloads pass syntax, binding, and included-import checks. Host/package dependency checks require the consuming application.`);

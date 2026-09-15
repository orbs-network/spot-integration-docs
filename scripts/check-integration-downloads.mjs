import assert from "node:assert/strict";
import path from "node:path";
import ts from "typescript";
import sources from "../lib/generated-integration-sources.json" with { type: "json" };
const structuralErrors = new Set([2300, 2304, 2393, 2440, 2448, 2451, 2454, 2552, 2305]);
for (const [id, code] of Object.entries(sources)) {
  const filename = path.resolve(`.integration-check-${id}.${id === 'advanced-orders-react' ? 'tsx' : 'ts'}`);
  const options = { noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, skipLibCheck: true, strict: true };
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile;
  host.getSourceFile = (name, version, onError, fresh) => name === filename ? ts.createSourceFile(name, code, version, true) : original(name, version, onError, fresh);
  const program = ts.createProgram([filename], options, host);
  const diagnostics = [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics().filter(d => structuralErrors.has(d.code))];
  if (diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: x => x, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' }));
    process.exitCode = 1;
  }
  assert(!/^```/m.test(code), `${id} contains Markdown fences`);
  assert(!/from ["']\.\/(?:config|order-types|build-order|sign-order|types)["']/.test(code), `${id} retains an included-module import`);
}
if (!process.exitCode) console.log('All five downloads pass syntax, binding, and included-import checks. Host/package dependency checks require the consuming application.');

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { loadGuides } from "../lib/guides.ts";
import { REFERENCE_EXAMPLES } from "../lib/reference-examples.ts";

// Build-time only: keep the TypeScript compiler out of the browser download.

function snippets(guide) {
  return guide.steps.flatMap(step => [...step.content.matchAll(/^```(tsx?|typescript|javascript|js)(?:\s+title="([^"]+)")?\s*\n([\s\S]*?)^```\s*$/gm)]
    .map((m, index) => ({ name: m[2] ?? `${step.id}-${index}.ts`, code: m[3] })));
}
function filesFor(guide) {
  if (guide.id === 'advanced-orders-react') return snippets(guide);
  if (guide.id === 'advanced-orders-sdk') {
    const blocks = snippets(guide);
    return [{ name: 'advanced-orders-sdk.ts', code: blocks.map(file => file.code).join('\n\n') }];
  }
  const files = guide.steps.flatMap(step => {
    const example = REFERENCE_EXAMPLES[`${guide.id}:${step.id}`];
    return (example?.files ?? []).filter(f => ['typescript', 'ts'].includes(f.language) && !f.kind);
  });
  if (guide.id === 'liquidity-hub') files.push(...snippets(guide).filter(file => file.name.startsWith('fetch-quote-')));
  if (guide.id === 'liquidity-hub-direct') files.push({ name: 'fetch-quote.ts', code: REFERENCE_EXAMPLES['liquidity-hub-direct:fetch-quote'].files[0].code });
  const unique = new Map();
  for (const file of files) {
    if (unique.has(file.name) && unique.get(file.name).code !== file.code) {
      throw new Error(`Conflicting canonical source: ${guide.id}/${file.name}`);
    }
    unique.set(file.name, file);
  }
  return [...unique.values()];
}

// Merge only canonical source modules. Resolve included imports through the
// compiler's symbol table, rename colliding bindings, and preserve host imports.
function bundle(files, isReact) {
  const root = '/integration/';
  const sources = new Map(files.map(file => [root + file.name, file.code]));
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, noLib: true };
  const host = ts.createCompilerHost(options);
  host.fileExists = name => sources.has(name);
  host.readFile = name => sources.get(name);
  host.directoryExists = name => name === '/integration' || name === '/';
  host.getSourceFile = (name, version) => sources.has(name) ? ts.createSourceFile(name, sources.get(name), version, true) : undefined;
  const program = ts.createProgram([...sources.keys()], options, host);
  const checker = program.getTypeChecker();
  const names = new Map();
  const usedNames = new Set();
  const external = new Map();
  const imports = [];
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  function reserve(symbol, preferred) {
    if (!symbol || names.has(symbol)) return;
    let name = preferred;
    let index = 2;
    while (usedNames.has(name)) name = `${preferred}${index++}`;
    usedNames.add(name); names.set(symbol, name);
  }
  const all = [...sources.keys()].map(name => program.getSourceFile(name));
  const isIncludedImport = node => {
    const specifier = node.moduleSpecifier.text;
    if (!specifier.startsWith('.')) return false;
    const base = path.posix.resolve(path.posix.dirname(node.getSourceFile().fileName), specifier);
    return [base, base + '.ts', base + '.tsx'].some(name => sources.has(name));
  };
  for (const source of all) {
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement)) {
        if (isIncludedImport(statement)) continue;
        const clause = statement.importClause;
        if (!clause) { imports.push(printer.printNode(ts.EmitHint.Unspecified, statement, source)); continue; }
        const bindings = [];
        if (clause.name) bindings.push({ node: clause.name, imported: 'default', type: clause.isTypeOnly });
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bindings.push({ node: clause.namedBindings.name, imported: '*', type: clause.isTypeOnly });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const binding of clause.namedBindings.elements) bindings.push({ node: binding.name, imported: (binding.propertyName ?? binding.name).text, type: clause.isTypeOnly || binding.isTypeOnly });
        }
        for (const binding of bindings) {
          const key = `${statement.moduleSpecifier.text}:${binding.imported}:${binding.type}`;
          const symbol = checker.getSymbolAtLocation(binding.node);
          if (external.has(key)) { names.set(symbol, external.get(key)); continue; }
          reserve(symbol, binding.node.text);
          const name = names.get(symbol);
          external.set(key, name);
          const specifier = JSON.stringify(statement.moduleSpecifier.text);
          const prefix = binding.type ? 'import type' : 'import';
          imports.push(binding.imported === '*' ? `${prefix} * as ${name} from ${specifier};`
            : binding.imported === 'default' ? `${prefix} ${name} from ${specifier};`
            : `${prefix} { ${binding.imported}${name === binding.imported ? '' : ` as ${name}`} } from ${specifier};`);
        }
      } else {
        const declarations = ts.isVariableStatement(statement) ? statement.declarationList.declarations : [statement];
        for (const declaration of declarations) if (declaration.name && ts.isIdentifier(declaration.name)) reserve(checker.getSymbolAtLocation(declaration.name), declaration.name.text);
      }
    }
  }
  function resolvedName(node) {
    let symbol = checker.getSymbolAtLocation(node);
    if (names.has(symbol)) return names.get(symbol);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return names.get(symbol);
  }
  const body = [];
  for (const source of all) {
    const result = ts.transform(source, [context => {
      const visit = node => {
        if (ts.isImportDeclaration(node)) return undefined;
        if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === 'use client') return undefined;
        if (ts.isShorthandPropertyAssignment(node)) {
          const symbol = checker.getShorthandAssignmentValueSymbol(node);
          const name = names.get(symbol) ?? (symbol && symbol.flags & ts.SymbolFlags.Alias ? names.get(checker.getAliasedSymbol(symbol)) : undefined);
          if (name && name !== node.name.text) return ts.factory.createPropertyAssignment(node.name.text, ts.factory.createIdentifier(name));
        }
        if (ts.isIdentifier(node)) {
          const name = resolvedName(node);
          if (name && name !== node.text) return ts.factory.createIdentifier(name);
        }
        return ts.visitEachChild(node, visit, context);
      };
      return node => ts.visitNode(node, visit);
    }]);
    body.push(`// Source: ${path.posix.basename(source.fileName)}\n${printer.printFile(result.transformed[0])}`);
    result.dispose();
  }
  return [(isReact ? '"use client";\n' : ''), ...imports, '', ...body].join('\n');
}
const output = {};
for (const guide of loadGuides().filter(g => !g.id.endsWith('-shared'))) {
  output[guide.id] = bundle(filesFor(guide), guide.id === 'advanced-orders-react');
}
const filename = path.join(import.meta.dirname, '../lib/generated-integration-sources.json');
const serialized = JSON.stringify(output, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8') !== serialized) throw new Error('Integration sources are stale. Run yarn generate:integrations.');
} else fs.writeFileSync(filename, serialized);
console.log('Integration source modules generated and local imports resolved.');

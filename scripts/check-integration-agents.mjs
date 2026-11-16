import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

import * as guideModule from '../lib/guides.ts';
import { REFERENCE_EXAMPLES } from '../lib/reference-examples.ts';
import * as partnerModule from '../features/partner-documentation/partner-documentation.ts';
import * as promptModule from '../features/integration-agent/integration-agent.ts';
import * as siteModule from '../lib/site.ts';
import {
  buildIntegrationAgentPrompt,
  buildIntegrationInstructionsUrl,
  getIntegrationAgentReferencePaths,
} from '../features/integration-agent/integration-agent.ts';
import { createIntegrationAgentHref } from '../features/integration-agent/agent-links.ts';

const { loadGuides, loadGuideMarkdown } = guideModule;
const { fetchPartnerDocumentationConfig } = partnerModule;
const guides = loadGuides();
const origin = 'https://integration-docs.example';
const siteUrl = new URL(`${origin}/preview?unrelated=private-value#old-step`);
const routes = new Set(guides.map(guide => `${guide.route}.md`));
const expectedSkillPaths = {
  'swap-shared': ['spot-ui/dist/integration-skills/spot-swap-integration/SKILL.md'],
  swap: ['spot-ui/dist/integration-skills/spot-swap-integration/SKILL.md'],
  'advanced-orders-shared': [
    'spot-react/dist/integration-skills/spot-advanced-orders-react-integration/SKILL.md',
    'spot-ui/dist/integration-skills/spot-advanced-orders-integration/SKILL.md',
  ],
  'advanced-orders-sdk': ['spot-ui/dist/integration-skills/spot-advanced-orders-integration/SKILL.md'],
  'advanced-orders-react': ['spot-react/dist/integration-skills/spot-advanced-orders-react-integration/SKILL.md'],
};

// Use the public configuration validator with a canonical response fixture;
// the test makes no requests to the service or either coding-agent product.
const configResponse = JSON.parse(REFERENCE_EXAMPLES['advanced-orders-direct:fetch-config'].files[1].code);
configResponse.partner = 'Thena';
configResponse.domain.chainId = 56;
configResponse.order.witness.chainid = 56;
const originalFetch = globalThis.fetch;
let partnerConfig;
try {
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get('partner'), 'thena');
    assert.equal(url.searchParams.get('chain'), '56');
    return Response.json(configResponse);
  };
  partnerConfig = await fetchPartnerDocumentationConfig({ partner: 'thena', chainId: 56 });
} finally {
  globalThis.fetch = originalFetch;
}
const originalContext = JSON.stringify(partnerConfig);
const prompts = new Map();

for (const guide of guides) {
  const prompt = buildIntegrationAgentPrompt({ guide, siteUrl, partnerConfig });
  const references = [...prompt.matchAll(/^- (https?:\/\/\S+)$/gm)].map(match => new URL(match[1]));
  assert(references.length, `${guide.id}: missing complete Markdown references`);
  assert(references.some(url => url.pathname === `${guide.route}.md`), `${guide.id}: missing its canonical Markdown guide`);
  for (const reference of references) {
    assert.equal(reference.origin, origin, `${guide.id}: references must use the configured public origin`);
    assert(routes.has(reference.pathname), `${guide.id}: unknown documentation route ${reference.pathname}`);
    assert.equal(reference.search, '', `${guide.id}: unrelated base query leaked into reference`);
    assert.equal(reference.hash, '', `${guide.id}: reference must cover the whole guide`);
  }
  assert(!/\/Users\/|\bfile:\/\/|https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])/.test(prompt), `${guide.id}: local source path or origin leaked into prompt`);
  assert(!prompt.includes('private-value'), `${guide.id}: unrelated query leaked into prompt`);
  if (guide.product === 'perps') {
    assert(!prompt.includes(partnerConfig.partner), `${guide.id}: Spot partner context leaked into Perps`);
    assert(!prompt.includes('chainId 56'), `${guide.id}: Spot chain context leaked into Perps`);
  } else {
    assert(prompt.includes(JSON.stringify(partnerConfig.requestedPartner)), `${guide.id}: selected Spot partner missing`);
    assert(prompt.includes(`chainId ${partnerConfig.chainId}`), `${guide.id}: selected Spot chain missing`);
    const partnerOnly = buildIntegrationAgentPrompt({ guide, siteUrl, partnerConfig: { partner: 'thena', requestedPartner: 'thena' } });
    assert(partnerOnly.includes('"thena"'), `${guide.id}: partner-only context missing`);
    assert(!partnerOnly.includes('chainId undefined'), `${guide.id}: unknown chain must remain unresolved`);
  }
  if (guide.id === 'advanced-orders-direct' || guide.product === 'perps') {
    assert(!prompt.includes('dist/integration-skill'), `${guide.id}: API-only path must not load an SDK skill`);
    assert(!prompt.includes('node_modules/@orbs-network'), `${guide.id}: API-only path must not require an SDK package`);
  } else {
    for (const skillPath of expectedSkillPaths[guide.id]) {
      assert(prompt.includes(`node_modules/@orbs-network/${skillPath}`), `${guide.id}: missing version-matched skill ${skillPath}`);
    }
    assert(prompt.includes('manifest.json.sdkVersion'), `${guide.id}: missing package-version verification`);
    assert(!prompt.includes('dist/integration-skill/'), `${guide.id}: obsolete bundled skill path`);
    assert(!prompt.includes('spot-react/dist/integration-skills/spot-swap-integration'), `${guide.id}: swap skill belongs to the core dependency`);
  }
  if (guide.id === 'advanced-orders-react') {
    assert(prompt.includes('@orbs-network/spot-react'), 'React path must use the React package');
    assert(prompt.includes('AdvancedOrdersProvider'), 'React path must configure its provider');
  }
  if (guide.id === 'swap' || guide.id === 'swap-shared' || guide.id === 'advanced-orders-sdk') {
    assert(prompt.includes('@orbs-network/spot-ui'), `${guide.id}: missing core SDK guidance`);
  }
  prompts.set(guide.id, prompt);
}
assert.equal(new Set(prompts.values()).size, guides.length, 'Every registered integration needs its own task prompt');
assert.equal(JSON.stringify(partnerConfig), originalContext, 'Prompt generation must preserve validated configuration');
assert.equal(siteUrl.toString(), `${origin}/preview?unrelated=private-value#old-step`, 'Prompt generation must preserve the supplied URL');
assert.throws(() => buildIntegrationAgentPrompt({ guide: guides[0], siteUrl: 'file:///tmp/docs' }), /HTTP or HTTPS/);
assert.throws(() => buildIntegrationInstructionsUrl({ guide: guides[0], siteUrl: 'file:///tmp/docs' }), /HTTP or HTTPS/);

// Local previews must link to the running app, including its port. Public
// requests still use the configured origin rather than an arbitrary host.
for (const localOrigin of [
  'http://localhost:3001',
  'https://preview.localhost:3443',
  'http://127.0.0.1:3001',
  'http://[::1]:3001',
  'http://0.0.0.0:3001',
]) {
  const location = new URL(`${localOrigin}/advanced-orders/shared?unrelated=private-value#product-overview`);
  const originalLocation = location.toString();
  const resolved = siteModule.getDocumentationSiteUrl(location);
  assert.equal(resolved.origin, localOrigin, 'Local documentation must preserve the current protocol, host, and port');
  assert.equal(resolved.pathname, '/', 'Local documentation origin must not retain the current page path');
  assert.equal(resolved.search, '', 'Local documentation origin must not retain unrelated query parameters');
  assert.equal(resolved.hash, '', 'Local documentation origin must not retain the current step');
  assert.equal(location.toString(), originalLocation, 'Documentation origin resolution must not mutate the supplied location');
}
for (const remoteLocation of [
  'https://untrusted-request-origin.example/advanced-orders/shared',
  'http://localhost.evil.example:3001/advanced-orders/shared',
  'ftp://localhost:3001/advanced-orders/shared',
]) {
  assert.equal(siteModule.getDocumentationSiteUrl(remoteLocation).origin, siteModule.getSiteUrl().origin, 'Nonlocal or non-HTTP locations must use the configured public origin');
}
assert.equal(siteModule.getDocumentationSiteUrl().origin, siteModule.getSiteUrl().origin, 'Server rendering must default to the configured public origin');

// Execute the real server modules with their real dependency exports. Transpile
// only to resolve Next's @/ imports without starting a server or making requests.
function loadServerModule(relativePath, dependencies) {
  const filename = new URL(`../${relativePath}`, import.meta.url);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports, URL, Request, Response,
    require: (specifier) => {
      assert(Object.hasOwn(dependencies, specifier), `Missing test dependency ${specifier}`);
      return dependencies[specifier];
    },
  }, { filename: filename.pathname });
  return exports;
}
const dependencies = {
  '@/lib/guides': guideModule,
  '@/features/integration-agent/integration-agent': promptModule,
  '@/features/partner-documentation/partner-documentation': partnerModule,
  '@/lib/reference-examples': { REFERENCE_EXAMPLES },
  '@/lib/site': siteModule,
};
dependencies['@/lib/markdown-response'] = loadServerModule('lib/markdown-response.ts', dependencies);
dependencies['@/lib/agent-markdown'] = loadServerModule('lib/agent-markdown.ts', dependencies);
const instructionsModule = loadServerModule('lib/integration-instructions.ts', dependencies);
dependencies['@/lib/integration-instructions'] = instructionsModule;
const { buildIntegrationInstructions, createIntegrationInstructionsResponse } = instructionsModule;
const expectedReferences = {
  'swap-shared': ['/swap/shared', '/swap'],
  swap: ['/swap/shared', '/swap'],
  'advanced-orders-shared': ['/advanced-orders/shared', '/advanced-orders/react', '/advanced-orders/typescript', '/advanced-orders/direct'],
  'advanced-orders-sdk': ['/advanced-orders/shared', '/advanced-orders/typescript'],
  'advanced-orders-react': ['/advanced-orders/shared', '/advanced-orders/react'],
  'advanced-orders-direct': ['/advanced-orders/shared', '/advanced-orders/direct'],
  'perps-api': ['/perps/api'],
};
const embeddedReferences = {
  ...expectedReferences,
  'advanced-orders-shared': ['/advanced-orders/shared'],
};
const withoutLinkDestinations = markdown => markdown.replace(/\]\([^\n)]*\)/g, ']()');
function fencedCodeBlocks(markdown) {
  const blocks = [];
  let current;
  let fence;
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (!fence && marker) {
      fence = marker[1];
      current = [line];
    } else if (fence) {
      current.push(line);
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) {
        blocks.push(current.join('\n'));
        fence = undefined;
      }
    }
  }
  return blocks;
}
const withoutFencedCode = markdown => fencedCodeBlocks(markdown).reduce((result, block) => result.replace(block, ''), markdown);
const headings = markdown => [...withoutFencedCode(markdown).matchAll(/^(#{1,6})[ \t]+(.+)$/gm)].map(match => ({ level: match[1].length, title: match[2] }));
const normalizeGuide = markdown => withoutLinkDestinations(markdown)
  .replace(/^Source: https?:\/\/\S+\n/gm, '')
  .replace(/^#{1,6}[ \t]+/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
function assertStandaloneMarkdown(markdown, label) {
  assert.equal(headings(markdown).filter(heading => heading.level === 1).length, 1, `${label}: expected one document title`);
  assert(!/\]\((?:\/(?!\/)|\.{1,2}\/|#)/.test(withoutFencedCode(markdown)), `${label}: standalone document contains relative prose links`);
}
function assertCompleteGuide(document, guide, label) {
  const canonical = loadGuideMarkdown(guide.id);
  assert(normalizeGuide(document).includes(normalizeGuide(canonical)), `${label}: truncated or changed canonical guide ${guide.id}`);
  const title = headings(canonical).find(heading => heading.level === 1)?.title;
  assert.equal(headings(document).filter(heading => heading.title === title).length, 1, `${label}: guide title must appear once: ${guide.id}`);
  for (const block of fencedCodeBlocks(canonical)) {
    assert(document.includes(block), `${label}: canonical fenced code was changed: ${guide.id}`);
  }
}
const markdownFixture = [
  '# Sample guide',
  '',
  '[Root](/swap) [Sibling](../other.md) [Step](#setup) [CDN](//cdn.example/reference.md)',
  '[reference]: ./detail.md',
  '',
  '```markdown',
  '# Code title',
  '[Code link](/unchanged)',
  '```',
  '',
  '~~~~text',
  '# Another code title',
  '[Another code link](./unchanged)',
  '~~~~',
  '',
  '###### Deep heading',
].join('\n');
const formattedFixture = dependencies['@/lib/agent-markdown'].formatAgentMarkdown(markdownFixture, new URL(`${origin}/guides/source.md`), 1);
assert(formattedFixture.startsWith('## Sample guide\n'), 'Embedded guide title must be demoted below the document title');
for (const href of [`${origin}/swap`, `${origin}/other.md`, `${origin}/guides/source.md#setup`, 'https://cdn.example/reference.md', `${origin}/guides/detail.md`]) {
  assert(formattedFixture.includes(href), `Standalone Markdown must resolve ${href}`);
}
for (const block of fencedCodeBlocks(markdownFixture)) assert(formattedFixture.includes(block), 'Link and heading formatting must preserve fenced code exactly');
assert(formattedFixture.endsWith('###### Deep heading'), 'Heading demotion must not produce invalid heading levels');
const instructionUrls = new Set();
const instructionDocuments = new Set();

globalThis.fetch = async () => { throw new Error('Instruction documents must not make external requests'); };
try {
  for (const guide of guides) {
    const url = new URL(buildIntegrationInstructionsUrl({ guide, siteUrl, partnerConfig }));
    assert.equal(url.origin, origin, `${guide.id}: instruction link must use the configured public origin`);
    assert.equal(url.pathname, `${guide.route}/llms.txt`);
    assert.equal(url.hash, '', `${guide.id}: instruction link must cover the whole integration`);
    assert(!url.toString().includes('private-value'), `${guide.id}: base URL query leaked into instruction link`);
    if (guide.product === 'perps') {
      assert.equal(url.search, '', 'Perps instruction links must not include Spot query parameters');
    } else {
      assert.equal(url.searchParams.get('partner'), partnerConfig.requestedPartner);
      assert.equal(url.searchParams.get('chainId'), String(partnerConfig.chainId));
      assert.deepEqual([...url.searchParams.keys()].sort(), ['chainId', 'partner']);
      const partnerOnly = new URL(buildIntegrationInstructionsUrl({ guide, siteUrl, partnerConfig: { partner: 'Quick Swap' } }));
      assert.equal(partnerOnly.searchParams.get('partner'), 'Quick Swap');
      assert.equal(partnerOnly.searchParams.has('chainId'), false);
    }
    instructionUrls.add(url.toString());

    assert.deepEqual([...getIntegrationAgentReferencePaths(guide.id)], expectedReferences[guide.id], `${guide.id}: wrong linked integration reference scope`);
    assert.deepEqual([...getIntegrationAgentReferencePaths(guide.id, 'embedded')], embeddedReferences[guide.id], `${guide.id}: wrong embedded integration reference scope`);
    const document = buildIntegrationInstructions({ guide, siteUrl, partnerConfig });
    instructionDocuments.add(document);
    const embeddedPrompt = buildIntegrationAgentPrompt({ guide, siteUrl, partnerConfig }, 'embedded');
    assert(document.includes(embeddedPrompt), `${guide.id}: missing implementation task`);
    assert(/included below/i.test(embeddedPrompt), `${guide.id}: implementation task must identify its included reference material`);
    assert(!embeddedPrompt.includes('Read the complete Markdown references first:'), `${guide.id}: task must not request a second fetch of included guides`);
    assert(!document.includes('private-value'), `${guide.id}: unrelated URL query leaked into instructions`);
    assertStandaloneMarkdown(document, guide.id);
    const sources = [...document.matchAll(/^Source: (https?:\/\/\S+)$/gm)].map(match => match[1]);
    assert.deepEqual(sources, embeddedReferences[guide.id].map(route => `${origin}${route}.md`), `${guide.id}: incomplete or unrelated embedded references`);
    for (const route of embeddedReferences[guide.id]) {
      const reference = guides.find(candidate => candidate.route === route);
      assertCompleteGuide(document, reference, guide.id);
      for (const [key, example] of Object.entries(REFERENCE_EXAMPLES)) {
        if (!key.startsWith(`${reference.id}:`)) continue;
        for (const file of example.files) {
          assert(document.includes(file.name), `${guide.id}: missing reference filename ${file.name}`);
          assert(document.includes(file.code), `${guide.id}: missing or changed complete reference file ${file.name}`);
          if (file.curl) assert(document.includes(file.curl), `${guide.id}: missing reference cURL ${file.name}`);
        }
      }
    }
    if (guide.id === 'advanced-orders-shared') {
      assert(Buffer.byteLength(document) < 40_000, 'Advanced Orders selector must not embed all implementation guides');
      const links = [...withoutFencedCode(document).matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(match => new URL(match[1]));
      for (const path of ['/advanced-orders/react', '/advanced-orders/typescript', '/advanced-orders/direct']) {
        const handoff = links.find(link => link.pathname === `${path}/llms.txt`);
        assert(handoff, `Advanced Orders selector is missing ${path} instructions`);
        assert.equal(handoff.origin, origin);
        assert.equal(handoff.searchParams.get('partner'), partnerConfig.requestedPartner, 'Selected partner must survive method selection');
        assert.equal(handoff.searchParams.get('chainId'), String(partnerConfig.chainId), 'Selected chain must survive method selection');
      }
    }

    // Exercise both deployed route spellings against the same requested scope.
    const segments = guide.route.slice(1).split('/');
    const directory = segments.length === 1 ? 'app/[product]' : 'app/[product]/[integration]';
    const canonicalRoute = loadServerModule(`${directory}/llms.txt/route.ts`, dependencies);
    const aliasRoute = loadServerModule(`${directory}/llm.txt/route.ts`, { '../llms.txt/route': canonicalRoute });
    const params = { product: segments[0], ...(segments.length === 2 ? { integration: segments[1] } : {}) };
    const requestUrl = `https://untrusted-request-origin.example${url.pathname}${url.search}`;
    const response = await canonicalRoute.GET(new Request(requestUrl), { params: Promise.resolve(params) });
    const alias = await aliasRoute.GET(new Request(requestUrl.replace('/llms.txt', '/llm.txt')), { params: Promise.resolve(params) });
    assert.equal(response.status, 200, `${guide.id}: instruction route failed`);
    assert.equal(alias.status, 200, `${guide.id}: llm.txt alias failed`);
    assert.match(response.headers.get('content-type'), /^text\/plain; charset=utf-8$/);
    const text = await response.text();
    assert.equal(await alias.text(), text, `${guide.id}: route spellings returned different instructions`);
    assert(text.includes(new URL(`${guide.route}.md`, siteModule.getSiteUrl()).toString()), `${guide.id}: response must use trusted site origin`);
    assert(!text.includes('untrusted-request-origin.example'), `${guide.id}: request origin leaked into document links`);
    if (guide.product !== 'perps') {
      assert(text.includes(`Selected Spot context: partner ${JSON.stringify(partnerConfig.requestedPartner)}, chainId ${partnerConfig.chainId}`), `${guide.id}: shared-link scope was lost by the server route`);
    }

    const localOrigin = 'http://localhost:3001';
    const localSiteUrl = siteModule.getDocumentationSiteUrl(`${localOrigin}${guide.route}?unrelated=private-value#old-step`);
    const localUrl = new URL(buildIntegrationInstructionsUrl({ guide, siteUrl: localSiteUrl, partnerConfig }));
    assert.equal(localUrl.origin, localOrigin, `${guide.id}: local share links must not point to an undeployed public route`);
    assert.equal(localUrl.pathname, `${guide.route}/llms.txt`);
    assert(!localUrl.toString().includes('private-value'), `${guide.id}: unrelated query leaked into local share link`);
    const localPrompt = buildIntegrationAgentPrompt({ guide, siteUrl: localSiteUrl, partnerConfig });
    const localReferences = [...localPrompt.matchAll(/^- (https?:\/\/\S+)$/gm)].map(match => new URL(match[1]));
    assert(localReferences.length, `${guide.id}: local prompt is missing references`);
    assert(localReferences.every(reference => reference.origin === localOrigin), `${guide.id}: local prompt must use local Markdown references`);
    const localResponse = await canonicalRoute.GET(new Request(localUrl), { params: Promise.resolve(params) });
    assert.equal(localResponse.status, 200, `${guide.id}: local instructions failed`);
    const localDocument = await localResponse.text();
    const localSources = [...localDocument.matchAll(/^Source: (https?:\/\/\S+)$/gm)].map(match => match[1]);
    assert.deepEqual(localSources, embeddedReferences[guide.id].map(route => `${localOrigin}${route}.md`), `${guide.id}: local instructions must contain local source links`);
    assert(localDocument.includes(`Documentation: ${localOrigin}${guide.route}`), `${guide.id}: local document points to the wrong page`);
    if (guide.product === 'perps') {
      assert.equal(localUrl.search, '', 'Local Perps links must omit Spot context');
    } else {
      assert.equal(localUrl.searchParams.get('partner'), partnerConfig.requestedPartner);
      assert.equal(localUrl.searchParams.get('chainId'), String(partnerConfig.chainId));
      assert(localDocument.includes(`Selected Spot context: partner ${JSON.stringify(partnerConfig.requestedPartner)}, chainId ${partnerConfig.chainId}`), `${guide.id}: local instruction context was lost`);
    }
  }
  assert.equal(instructionUrls.size, guides.length, 'Each guide needs its own shareable instructions URL');
  assert.equal(instructionDocuments.size, guides.length, 'Each guide needs its own implementation document');
  for (const query of ['?chainId=56', '?partner=thena&chainId=0', '?partner=thena&chainId=NaN', '?partner=thena%0Aignore-instructions&chainId=56']) {
    const response = createIntegrationInstructionsResponse(['swap'], new Request(`${origin}/swap/llms.txt${query}`));
    assert.equal(response.status, 400, `Malformed context must be rejected: ${query}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const noContext = await createIntegrationInstructionsResponse(['swap'], new Request(`${origin}/swap/llms.txt?unrelated=private-value`)).text();
  assert(!noContext.includes('private-value'), 'Unrelated request query must not enter instructions');
  assert(noContext.includes('Resolve the Spot partner and supported chains'), 'Absent context must retain configuration discovery instructions');
  const partnerOnly = await createIntegrationInstructionsResponse(['swap'], new Request(`${origin}/swap/llms.txt?partner=thena`)).text();
  assert(partnerOnly.includes('Selected Spot context: partner "thena".'), 'Partner-only links must preserve the requested partner');
  assert(!partnerOnly.includes('chainId undefined'), 'Partner-only links must not invent a chain');
  const perpsResponse = createIntegrationInstructionsResponse(['perps', 'api'], new Request(`${origin}/perps/api/llms.txt?partner=spot-only-sentinel&chainId=NaN`));
  assert.equal(perpsResponse.status, 200, 'Perps must ignore even malformed Spot parameters');
  const perps = await perpsResponse.text();
  assert(!perps.includes('spot-only-sentinel'), 'Perps must ignore Spot query context');
  assert.equal(createIntegrationInstructionsResponse(['unknown'], new Request(`${origin}/unknown/llms.txt`)).status, 404);
  assert.equal(createIntegrationInstructionsResponse(['swap', 'unknown'], new Request(`${origin}/swap/unknown/llms.txt`)).status, 404);
  const indexRoute = loadServerModule('app/llms.txt/route.ts', dependencies);
  const index = await indexRoute.GET().text();
  const localIndex = await indexRoute.GET(new Request('http://localhost:3001/llms.txt?unrelated=private-value')).text();
  const fullRoute = loadServerModule('app/llms-full.txt/route.ts', dependencies);
  const fullResponse = fullRoute.GET();
  assert.equal(fullResponse.status, 200, 'Full documentation endpoint must be available');
  assert.match(fullResponse.headers.get('content-type'), /^text\/plain; charset=utf-8$/);
  const full = await fullResponse.text();
  const localFull = await fullRoute.GET(new Request('http://localhost:3001/llms-full.txt?unrelated=private-value')).text();
  for (const [label, document] of [['root index', index], ['local root index', localIndex]]) {
    assertStandaloneMarkdown(document, label);
    assert(Buffer.byteLength(document) < 8_000, `${label}: discovery must stay compact`);
    assert(/^> .+/m.test(document), `${label}: missing quoted project summary`);
    assert.deepEqual(headings(document).filter(heading => heading.level === 2).map(heading => heading.title), ['Integration instructions', 'Documentation'], `${label}: expected the two discovery lists`);
    assert.equal(fencedCodeBlocks(document).length, 0, `${label}: code belongs in the linked full reference`);
    assert(!/^Source: /m.test(document), `${label}: canonical guides must not be pasted into the index`);
    assert(!document.includes('/swap/shared/llms.txt'), `${label}: duplicate Swap instruction handoff must not be listed`);
    assert.equal([...document.matchAll(/\]\(https?:\/\/[^\s)]+\/swap\/llms\.txt\)/g)].length, 1, `${label}: expected one canonical Swap instruction handoff`);
    for (const section of document.split(/^## .+$/m).slice(1)) {
      for (const line of section.split('\n').filter(Boolean)) {
        assert(/^- \[[^\]]+\]\(https?:\/\/[^\s)]+\)(?:: .*)?$/.test(line), `${label}: H2 sections must contain only file links`);
      }
    }
  }
  for (const [label, document] of [['full documentation', full], ['local full documentation', localFull]]) assertStandaloneMarkdown(document, label);
  assert(index.includes(new URL('/llms-full.txt', siteModule.getSiteUrl()).toString()), 'Root index must link to full documentation');
  assert(localIndex.includes('http://localhost:3001/llms-full.txt'), 'Local root index must link to local full documentation');
  const fullSources = [...full.matchAll(/^Source: (https?:\/\/\S+)$/gm)].map(match => match[1]);
  assert.deepEqual(fullSources, guides.map(guide => new URL(`${guide.route}.md`, siteModule.getSiteUrl()).toString()), 'Full reference must contain each canonical guide once');
  const localFullSources = [...localFull.matchAll(/^Source: (https?:\/\/\S+)$/gm)].map(match => match[1]);
  assert.deepEqual(localFullSources, guides.map(guide => `http://localhost:3001${guide.route}.md`), 'Local full reference must preserve local source links');
  for (const guide of guides) {
    if (guide.id !== 'swap-shared') {
      assert(index.includes(new URL(`${guide.route}/llms.txt`, siteModule.getSiteUrl()).toString()), `${guide.id}: missing discovery link in root llms.txt`);
      assert(localIndex.includes(`http://localhost:3001${guide.route}/llms.txt`), `${guide.id}: local root index must link to local instruction documents`);
    }
    assert(index.includes(new URL(`${guide.route}.md`, siteModule.getSiteUrl()).toString()), `${guide.id}: missing canonical Markdown link`);
    assert(localIndex.includes(`http://localhost:3001${guide.route}.md`), `${guide.id}: local root index must link to local Markdown guides`);
    assertCompleteGuide(full, guide, 'full documentation');
    assertCompleteGuide(localFull, guide, 'local full documentation');
  }
  assert(!localIndex.includes('private-value'), 'Local root index must omit unrelated request query parameters');
  assert(!localFull.includes('private-value'), 'Local full documentation must omit unrelated request query parameters');
} finally {
  globalThis.fetch = originalFetch;
}

// Encoding must preserve user-editable text exactly, including characters that
// otherwise become query separators, fragments, or spaces. Launches draft only.
const reservedPrompt = 'Implement swaps & advanced orders?\nAmount = "1+2"; route #review, 100% ready.\nשלום / café / 🚀';
for (const agent of ['codex', 'claude']) {
  for (const prompt of [reservedPrompt, ...prompts.values()]) {
    const href = new URL(createIntegrationAgentHref(agent, prompt));
    if (agent === 'codex') {
      assert.equal(href.protocol, 'codex:', 'Codex must open the installed app');
      assert.equal(href.hostname, 'new', 'Codex must open a new draft');
      assert.equal(href.pathname, '');
    } else {
      assert.equal(href.origin, 'https://claude.ai', 'Claude must open its official web app');
      assert.equal(href.pathname, '/new', 'Claude must open a new draft');
    }
    const parameter = agent === 'claude' ? 'q' : 'prompt';
    assert.equal(href.searchParams.get(parameter), prompt, `${agent}: launch URL must preserve the full prompt`);
    assert.equal(href.hash, '', `${agent}: prompt text must not become a URL fragment`);
    assert.deepEqual([...href.searchParams.keys()], [parameter], `${agent}: launch must only prefill a draft, without submission flags`);
  }
}
console.log(`Integration agent checks passed: compact root index, complete standalone full reference, ${guides.length} integration handoffs, scoped method selection, local/public URLs and aliases, preserved examples, and Codex/Claude launch encoding.`);

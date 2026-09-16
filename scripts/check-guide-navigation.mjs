import assert from 'node:assert/strict';
import { GUIDE_SOURCES, loadGuides } from '../lib/guides.ts';
import { REFERENCE_EXAMPLES } from '../lib/reference-examples.ts';

const guides = loadGuides();
const byRoute = new Map(guides.map(guide => [guide.route, guide]));
let linkCount = 0;

for (const guide of guides) {
  const ids = new Set(guide.steps.map(step => step.id));
  assert.equal(ids.size, guide.steps.length, `${guide.id}: duplicate step IDs`);
  for (const [alias, target] of Object.entries(guide.hashAliases)) {
    assert(ids.has(target), `${guide.id}: #${alias} redirects to missing #${target}`);
    assert(!ids.has(alias), `${guide.id}: alias shadows the real step #${alias}`);
  }
  const source = GUIDE_SOURCES.find(source => source.id === guide.id);
  for (const id of source.stepOrder) {
    assert(ids.has(id), `${guide.id}: stepOrder contains missing #${id}`);
  }
  if (source.stepOrder.length) {
    assert.equal(new Set(source.stepOrder).size, guide.steps.length,
      `${guide.id}: explicit stepOrder must include every step exactly once`);
  }

  const markdown = [guide.intro, guide.introReference, ...guide.steps.map(step => step.content)]
    .join('\n').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  for (const match of markdown.matchAll(/\]\((\/[^\s)]+|#[^\s)]+)\)/g)) {
    const url = new URL(match[1], `https://docs.example${guide.route}`);
    const target = byRoute.get(url.pathname);
    assert(target, `${guide.id}: unknown guide link ${match[1]}`);
    if (url.hash) {
      const hash = decodeURIComponent(url.hash.slice(1));
      const id = target.hashAliases[hash] ?? hash;
      assert(target.steps.some(step => step.id === id),
        `${guide.id}: link ${match[1]} does not reach a navigable step`);
    }
    linkCount++;
  }
}

for (const key of Object.keys(REFERENCE_EXAMPLES)) {
  const [guideId, stepId] = key.split(':');
  assert(guides.find(guide => guide.id === guideId)?.steps.some(step => step.id === stepId),
    `Interactive example ${key} is no longer attached to a step`);
}

console.log(`Guide navigation passed: ${guides.length} guides, ${linkCount} internal links, aliases, and interactive examples.`);

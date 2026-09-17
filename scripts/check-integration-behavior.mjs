import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { REFERENCE_EXAMPLES } from '../lib/reference-examples.ts';
import { personalizeReferenceExample } from '../features/partner-documentation/partner-documentation.ts';
import sources from '../lib/generated-integration-sources.json' with { type: 'json' };

function load(code, context = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, URLSearchParams, AbortController, setTimeout, clearTimeout, ...context });
  return exports;
}
const hash = `0x${'1'.repeat(64)}`;
const account = `0x${'2'.repeat(40)}`;
const signature = `0x${'3'.repeat(130)}`;
const quote = { inAmount: '100', inToken: account, timestamp: Date.now(), sessionId: 'test', eip712: { domain: {}, types: {}, primaryType: 'Order', message: {} } };
for (const mode of ['submission', 'polling', 'reverted', 'submission-error']) {
  const timers = new Set();
  let receiptWaits = 0;
  let pollRequests = 0;
  const publicClient = {
    readContract: async () => 100n,
    getTransactionReceipt: () => { throw new Error('Immediate receipt lookup must not be used'); },
    waitForTransactionReceipt: async () => { receiptWaits++; return { status: mode === 'reverted' ? 'reverted' : 'success' }; },
  };
  const exports = load(REFERENCE_EXAMPLES['liquidity-hub-direct:submit-swap'].files[0].code, {
    window: { ethereum: {} },
    require: id => id === 'viem/chains' ? { polygon: { id: 137 } } : {
      createPublicClient: () => publicClient, createWalletClient: () => ({ signTypedData: async () => signature }),
      custom: () => ({}), http: () => ({}), erc20Abi: [],
    },
    setTimeout: callback => { const timer = setTimeout(() => { timers.delete(timer); callback(); }, 1); timers.add(timer); return timer; },
    clearTimeout: timer => { timers.delete(timer); clearTimeout(timer); },
    fetch: async url => {
      if (url.includes('/status/')) { pollRequests++; return { ok: true, json: async () => ({ txHash: hash }) }; }
      return { ok: mode !== 'submission-error', json: async () => mode === 'submission-error' ? { error: 'Submission rejected' } : mode === 'polling' ? {} : { txHash: hash } };
    },
  });
  const result = exports.submitLiquidityHubSwap(quote, account, async () => quote);
  if (mode === 'reverted') await assert.rejects(result, /reverted/);
  else if (mode === 'submission-error') await assert.rejects(result, /Submission rejected/);
  else assert.equal((await result).status, 'success');
  assert.equal(receiptWaits, mode === 'submission-error' ? 0 : 1);
  assert.equal(pollRequests, mode === 'polling' ? 1 : 0);
  assert.equal(timers.size, 0, 'Polling timer must be cleared');
}
const config = JSON.parse(REFERENCE_EXAMPLES['advanced-orders-direct:fetch-config'].files[1].code);
const apiClientContext = { window: { ethereum: {} }, require: () => ({ parseAbi: () => [], custom: provider => provider, createPublicClient: () => ({}), createWalletClient: () => ({}) }) };
const outputToken = `0x${'4'.repeat(40)}`;
const wrappedToken = `0x${'5'.repeat(40)}`;
const input = { totalInputAmount: '999999999', srcAmountPerFill: '333333333', totalTrades: 3, dstMinAmountPerFill: '0', triggerLower: '0', triggerUpper: '0', deadlineMillis: Date.now() + 3600000, fillDelayMillis: 60000, freshnessSeconds: 30, slippageBps: 50, inputToken: { address: account }, dstToken: outputToken };
const invalidInputs = [
  [{ totalInputAmount: '1000000000' }, /Total input/], // Rounding remainder cannot be signed as an extra chunk.
  [{ totalInputAmount: '999999998' }, /Total input/],
  [{ srcAmountPerFill: '0' }, /Total input/],
  [{ totalInputAmount: '0' }, /Total input/],
  [{ totalTrades: 1 }, /Total input/],
  [{ totalTrades: 0 }, /totalTrades/],
  [{ totalTrades: 1.5 }, /totalTrades/],
  [{ totalTrades: Number.MAX_SAFE_INTEGER + 1 }, /totalTrades/],
  [{ totalInputAmount: '1e9' }, /integer string/],
  [{ srcAmountPerFill: '-1' }, /integer string/],
  [{ dstMinAmountPerFill: '1.5' }, /integer string/],
  [{ totalInputAmount: (1n << 256n).toString() }, /uint256/],
  [{ freshnessSeconds: 60 }, /Freshness/], // Regression: freshness = epoch.
  [{ freshnessSeconds: 61 }, /Freshness/],
  [{ freshnessSeconds: undefined }, /Freshness/], // Default 60 is invalid for a 60-second epoch.
  [{ freshnessSeconds: 0 }, /Freshness/],
  [{ freshnessSeconds: -1 }, /freshnessSeconds/],
  [{ freshnessSeconds: 0.5 }, /freshnessSeconds/],
  [{ fillDelayMillis: 0 }, /TWAP epoch/],
  [{ fillDelayMillis: 1000, freshnessSeconds: 1 }, /TWAP epoch/],
  [{ fillDelayMillis: 1500 }, /whole seconds/],
  [{ fillDelayMillis: -1000 }, /whole seconds/],
  [{ fillDelayMillis: 0x100000000 * 1000 }, /epoch/],
  [{ deadlineMillis: Date.now() + 1000 }, /Deadline/],
  [{ deadlineMillis: Date.now() - 1000 }, /Deadline/],
  [{ deadlineMillis: NaN }, /Deadline/],
  [{ slippageBps: 5001 }, /slippageBps/],
  [{ slippageBps: -1 }, /slippageBps/],
  [{ triggerLower: '1' }, /triggers/],
  [{ dstToken: account }, /tokens must differ/],
];
const badConfigs = [null, {}];
for (const [path, value] of [
  [['domain', 'chainId'], 56],
  [['order', 'witness', 'chainid'], 56],
  [['domain', 'verifyingContract'], undefined],
  [['domain', 'verifyingContract'], '0x1234'],
  [['order', 'spender'], outputToken],
  [['types'], {}],
  [['types', 'Order'], [{ name: 'input', type: 123 }]],
  [['primaryType'], 'WrongType'],
  [['domain', 'name'], ''],
  [['order', 'witness', 'exchange', 'share'], 10001],
  [['order', 'witness', 'exchange', 'data'], '0x1'],
  ...[
    ['domain', 'verifyingContract'], ['order', 'spender'],
    ['order', 'witness', 'reactor'], ['order', 'witness', 'executor'],
    ['order', 'witness', 'exchange', 'adapter'],
  ].map(path => [path, `0x${'0'.repeat(40)}`]),
]) {
  const invalid = structuredClone(config);
  const parent = path.slice(0, -1).reduce((object, key) => object[key], invalid);
  parent[path.at(-1)] = value;
  badConfigs.push(invalid);
}
// Exercise both the copyable file and the combined download; neither may omit guards.
for (const code of [
  REFERENCE_EXAMPLES['advanced-orders-direct:create-order'].files[0].code,
  sources['advanced-orders-direct'],
]) {
  let walletCalls = 0;
  let fetchCalls = 0;
  let responseConfig = config;
  let signedMessage;
  const wallet = {
    readContract: async () => { walletCalls++; return (1n << 256n) - 1n; },
    writeContract: async () => { walletCalls++; return hash; },
    waitForTransactionReceipt: async () => ({ status: 'success' }),
    signTypedData: async args => { walletCalls++; signedMessage = args.message; return signature; },
  };
  // Expose the private builder only in this test harness.
  const api = load(`${code}\nexport { buildOrderFromDerivedValues };`, {
    window: { ethereum: {} },
    require: () => ({ parseAbi: () => [], custom: provider => provider, createPublicClient: () => wallet, createWalletClient: () => wallet }),
    fetch: async (url, options) => {
      fetchCalls++;
      if (url.includes('/config?')) return { ok: true, json: async () => responseConfig };
      const body = JSON.parse(options.body);
      assert.equal(JSON.stringify(body.order), JSON.stringify(signedMessage));
      assert.equal(body.signature, signature);
      return { ok: true, json: async () => ({ success: true, signedOrder: { order: body.order } }) };
    },
  });
  const build = (overrides = {}, permitData = config) => api.buildOrderFromDerivedValues({ permitData, inputTokenAddress: account, orderInput: { ...input, ...overrides } });
  const before = JSON.stringify(config);
  const built = build();
  assert.equal(built.order.permitted.amount, '999999999');
  assert.equal(built.order.witness.input.maxAmount, '999999999');
  assert.equal(built.order.witness.epoch, 60);
  assert.equal(built.order.witness.freshness, 30);
  assert.equal(built.order.nonce, built.order.witness.nonce);
  assert.equal(JSON.stringify(config), before, 'Validation/building must preserve the trusted template');
  assert.equal(build({ freshnessSeconds: 59 }).order.witness.freshness, 59);
  assert.equal(build({ fillDelayMillis: 120000, freshnessSeconds: undefined }).order.witness.freshness, 60);
  const single = build({ totalTrades: 1, srcAmountPerFill: input.totalInputAmount, fillDelayMillis: 0, freshnessSeconds: undefined });
  assert.equal(single.order.witness.epoch, 0);
  assert.equal(single.order.witness.freshness, 60);
  const hugeChunk = (1n << 100n).toString();
  assert.equal(build({ srcAmountPerFill: hugeChunk, totalInputAmount: (BigInt(hugeChunk) * 3n).toString() }).order.witness.input.amount, hugeChunk);
  const native = api.buildOrderFromDerivedValues({ permitData: config, inputTokenAddress: wrappedToken, orderInput: { ...input, sourceIsNative: true } });
  assert.equal(native.order.permitted.token, wrappedToken);
  assert.equal(native.order.witness.input.token, wrappedToken);
  for (const [overrides, error] of invalidInputs) {
    assert.throws(() => build(overrides), error);
    // Use native input so an accidental pre-validation wrap is observable too.
    await assert.rejects(api.submitOrdersSinkOrder({ orderInput: { ...input, ...overrides, sourceIsNative: true }, wTokenAddress: account }), error);
    assert.equal(walletCalls, 0, 'Invalid inputs must fail before wallet reads, writes, or signing');
  }
  for (const invalid of badConfigs) {
    assert.throws(() => build({}, invalid));
    responseConfig = invalid;
    await assert.rejects(api.fetchDefaultPermitData('external', 137));
    await assert.rejects(api.submitOrdersSinkOrder({ orderInput: input, wTokenAddress: wrappedToken }));
    assert.equal(walletCalls, 0, 'Invalid configuration must fail before wallet operations');
  }
  responseConfig = config;
  const noReferral = structuredClone(config);
  noReferral.order.witness.exchange.ref = `0x${'0'.repeat(40)}`;
  build({}, noReferral); // Optional referral can be zero.
  fetchCalls = 0;
  const created = await api.submitOrdersSinkOrder({ orderInput: input, wTokenAddress: wrappedToken });
  assert.equal(fetchCalls, 2, 'One configuration fetch and one submission');
  assert.equal(created.order.witness.freshness, 30);
  assert.equal(walletCalls, 2, 'Valid ERC-20 flow reads allowance and signs once');
}
const historyUrls = [];
const history = { orders: [], page: 2, limit: 20, total: 25, totalPages: 2 };
const historyApi = load(sources['advanced-orders-direct'], {
  ...apiClientContext,
  fetch: async url => {
    historyUrls.push(new URL(url));
    return { ok: true, json: async () => history };
  },
});
assert.equal(await historyApi.fetchOrders({ account, chainId: 56, exchange: 'thena' }), history);
assert.equal(historyUrls.length, 1);
assert.equal(historyUrls[0].pathname, '/orders');
assert.deepEqual(Object.fromEntries(historyUrls[0].searchParams), {
  swapper: account,
  chainId: '56',
  exchange: 'thena',
});
for (const exchange of [undefined, '', '   ']) {
  await assert.rejects(historyApi.fetchOrders({ account, chainId: 56, exchange }), /Exchange partner ID is required/);
}
assert.equal(historyUrls.length, 1, 'Missing exchange must fail before a history request');
// The interactive Request tab and its cURL must use the same wire contract,
// including after the documentation applies the selected partner.
const historyExample = REFERENCE_EXAMPLES['advanced-orders-direct:fetch-order-sink-orders'];
for (const partner of ['external', 'ginco']) {
  const personalized = personalizeReferenceExample('advanced-orders-direct', historyExample, {
    partner, requestedPartner: partner,
  });
  const request = personalized.files.find(file => file.kind === 'request');
  const urls = [];
  const requestApi = load(request.code, {
    fetch: async url => {
      urls.push(new URL(url));
      return { ok: true, json: async () => history };
    },
  });
  assert.equal(await requestApi.fetchOrderHistory(), history);
  assert.equal(urls.length, 1);
  assert.deepEqual(Object.fromEntries(urls[0].searchParams), {
    swapper: '0x5555555555555555555555555555555555555555', chainId: '137', exchange: partner,
  });
  assert(request.curl.includes(`'exchange=${partner}'`));
  assert(!request.curl.includes('partner='));
}
console.log('Swap receipt, polling cleanup, configuration rejection, chunk totals, TWAP freshness/schedule, and exchange-scoped history checks passed.');

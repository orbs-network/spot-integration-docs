import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { REFERENCE_EXAMPLES } from '../lib/reference-examples.ts';
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
const config = { domain: { chainId: 137, verifyingContract: account }, order: { spender: account, witness: { chainid: 137, exchange: { adapter: account }, reactor: account, executor: account } } };
const api = load(sources['advanced-orders-direct'], { require: () => ({ parseAbi: () => [] }), fetch: async () => ({ ok: true, json: async () => config }) });
const input = { totalInputAmount: '999999999', srcAmountPerFill: '333333333', totalTrades: 3, dstMinAmountPerFill: '0', triggerLower: '0', triggerUpper: '0', deadlineMillis: Date.now() + 60000, fillDelayMillis: 10000, slippageBps: 50, inputToken: { address: account }, dstToken: account };
api.validateOrderInput(input);
for (const change of [{ totalInputAmount: '1000000000' }, { srcAmountPerFill: '0' }, { totalTrades: 0 }, { fillDelayMillis: 0 }, { slippageBps: 0.5 }, { triggerLower: '1' }]) assert.throws(() => api.validateOrderInput({ ...input, ...change }));
await assert.rejects(api.buildOrderFromDerivedValues({ account, chainId: 137, wTokenAddress: account, orderInput: { ...input, deadlineMillis: Date.now() + 1000 } }), /Deadline/);
const built = await api.buildOrderFromDerivedValues({ account, chainId: 137, wTokenAddress: account, orderInput: input });
assert.equal(built.order.permitted.amount, '999999999');
assert.equal(built.order.witness.epoch, 10);
await assert.rejects(api.fetchDefaultPermitData('external', 1), /mismatched chain/);
let historyUrl;
const history = { orders: [], page: 2, limit: 20, total: 25, totalPages: 2 };
const historyApi = load(sources['advanced-orders-direct'], {
  require: () => ({ parseAbi: () => [] }),
  fetch: async url => {
    if (url.includes('/config?')) return { ok: true, json: async () => config };
    historyUrl = new URL(url);
    return { ok: true, json: async () => history };
  },
});
assert.equal(await historyApi.fetchOrders({ account, chainId: 137, page: 2, limit: 20 }), history);
assert.equal(historyUrl.searchParams.get('page'), '2');
assert.equal(historyUrl.searchParams.get('limit'), '20');
assert.equal(historyUrl.searchParams.get('swapper'), account);
assert.equal(historyUrl.searchParams.get('exchange'), account);
await assert.rejects(historyApi.fetchOrders({ account, chainId: 137, page: 0 }), /one-based/);
console.log('Swap receipt, polling cleanup, TWAP validation, schedule, config-chain, and pagination checks passed.');

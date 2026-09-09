import type { Language } from "prism-react-renderer";

export interface ReferenceFile {
  code: string;
  curl?: string;
  kind?: "request" | "response";
  language: Language;
  method?: "GET" | "POST";
  name: string;
}

export interface ReferenceExample {
  files: readonly ReferenceFile[];
  format?: "request-response";
  help: string;
  includePartnerContextFile?: boolean;
  label: string;
  purpose: string;
  title: string;
}

// Generated from efficientfrontier's developer-tool formatter functions and
// sample data. The Liquidity Hub SDK references track the public package API
// and the repository examples in packages/liquidity-hub-ui/examples/react.
const LIQUIDITY_HUB_QUOTE_REQUEST_CODE = `import type { Address } from "viem";

import type { LiquidityHubQuote } from "./types";

// The connected wallet arrives as an argument. Read it from whatever the host
// already uses - viem's getAddresses(), an EIP-1193 provider, or wagmi's
// useAccount() in a React host - and pass it in.
export async function fetchLiquidityHubQuote(account: Address): Promise<LiquidityHubQuote> {
  // Native currency is not supported as input. Use the wrapped ERC-20 token
  // address as inToken and wrap the required funds before submission.
  const response = await fetch(
    "https://hub.orbs.network/quote?chainId=137",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inToken: "0x1111111111111111111111111111111111111111",
        outToken: "0x6666666666666666666666666666666666666666",
        inAmount: "1000000000000000000",
        outAmount: "2480000000",
        user: account,
        slippage: 0.5,
        qs: "%3FinputCurrency%3D0x1111%26outputCurrency%3D0x6666",
        // Use the partner identifier supplied by Orbs; otherwise use "unknown".
        partner: "unknown",
      }),
    },
  );

  const quote = (await response.json()) as LiquidityHubQuote;

  if (!response.ok) {
    throw new Error(
      \`Liquidity Hub quote request failed (\${response.status})\`,
    );
  }

  return quote;
}`;

const LIQUIDITY_HUB_QUOTE_REQUEST_CURL = `curl --request POST \\
  --url 'https://hub.orbs.network/quote?chainId=137' \\
  --header 'Accept: application/json' \\
  --header 'Content-Type: application/json' \\
  --data '{
    "inToken": "0x1111111111111111111111111111111111111111",
    "outToken": "0x6666666666666666666666666666666666666666",
    "inAmount": "1000000000000000000",
    "outAmount": "2480000000",
    "user": "0x5555555555555555555555555555555555555555",
    "slippage": 0.5,
    "qs": "%3FinputCurrency%3D0x1111%26outputCurrency%3D0x6666",
    "partner": "unknown"
  }'`;

const LIQUIDITY_HUB_SDK_QUOTE_REQUEST_CODE = `import { createClient, type Quote } from "@orbs-network/liquidity-hub-sdk";

const chainId = 137;
// Use the partner identifier supplied by Orbs; otherwise use "unknown".
const partner = "unknown";
const liquidityHubClient = createClient({ chainId, partner });

export async function fetchLiquidityHubQuote(
  account: \`0x\${string}\`,
  dexMinAmountOut: string,
): Promise<Quote> {
  return liquidityHubClient.getQuote({
    fromToken: "0x1111111111111111111111111111111111111111",
    toToken: "0x6666666666666666666666666666666666666666",
    inAmount: "1000000000000000000",
    dexMinAmountOut,
    account,
    slippage: 0.5,
  });
}`;

const LIQUIDITY_HUB_QUOTE_TYPES_CODE = `export interface Eip712Field {
  name: string;
  type: string;
}

export interface Eip712Domain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: \`0x\${string}\`;
  salt?: \`0x\${string}\`;
}

export interface QuotePermitData {
  domain: Eip712Domain;
  types: Record<string, Eip712Field[]>;
  values: Record<string, unknown>;
  primaryType?: string;
}

export interface QuoteEip712 {
  domain: Eip712Domain;
  types: Record<string, Eip712Field[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

// Matches Quote from @orbs-network/liquidity-hub-sdk.
export interface LiquidityHubQuote {
  inToken: string;
  outToken: string;
  inAmount: string;
  outAmount: string;
  user: \`0x\${string}\`;
  slippage: number;
  qs: string;
  partner: string;
  exchange: string;
  sessionId: string;
  serializedOrder: string;
  permitData: QuotePermitData;
  eip712: QuoteEip712;
  minAmountOut: string;
  error?: string;
  gasAmountOut?: string;
  referencePrice?: string;
  userMinOutAmountWithGas: string;
  outAmountWsMinusGas: string;
  outAmountWS: string;
  timestamp: number;
}`;

const LIQUIDITY_HUB_SUBMIT_SWAP_CODE = `import { createPublicClient, createWalletClient, custom, erc20Abi, http, type Address, type Hash, type TransactionReceipt } from "viem";
import { polygon } from "viem/chains";
import type { LiquidityHubQuote } from "./types";

// Use the Viem chain connected in the host wallet; Polygon is only an example.
const chain = polygon;
const chainId = chain.id;
const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const publicClient = createPublicClient({ chain, transport: http() });
const walletProvider = (window as unknown as { ethereum: Parameters<typeof custom>[0] }).ethereum;
const walletClient = createWalletClient({ chain, transport: custom(walletProvider) });

export async function submitLiquidityHubSwap(quote: LiquidityHubQuote, account: Address, refetchQuote: () => Promise<LiquidityHubQuote>): Promise<TransactionReceipt> {
  // quote.inToken must be an ERC-20 address. Wrap native funds before this flow.
  const requiredAllowance = BigInt(quote.inAmount);
  const allowance = await publicClient.readContract({
    address: quote.inToken as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, permit2Address],
  });

  if (allowance < requiredAllowance) {
    const approvalHash = await walletClient.writeContract({
      account,
      address: quote.inToken as Address,
      abi: erc20Abi,
      functionName: "approve",
      args: [permit2Address, requiredAllowance],
      chain: walletClient.chain,
    });
    const approvalReceipt = await publicClient.waitForTransactionReceipt({
      hash: approvalHash,
    });

    if (approvalReceipt.status !== "success") {
      throw new Error("Permit2 approval reverted");
    }
  }

  // Approval may take long enough for prices and available liquidity to move.
  // Refresh quotes older than 60 seconds immediately before signing.
  const freshQuote = isQuoteFresh(quote) ? quote : await refetchQuote();

  const signature = await walletClient.signTypedData({
    account,
    domain: freshQuote.eip712.domain,
    types: freshQuote.eip712.types,
    primaryType: freshQuote.eip712.primaryType,
    message: freshQuote.eip712.message,
  });

  const submission = submitSignedQuote(freshQuote, signature);
  const polledHash = pollForTransactionHash({
    account,
    chainId,
    sessionId: freshQuote.sessionId,
  });
  const submittedHash = submission.then((txHash) => txHash ?? polledHash);

  try {
    const txHash = await Promise.race([submittedHash, polledHash]);
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      throw new Error("Liquidity Hub transaction reverted");
    }

    return receipt;
  } catch (error) {
    throw error;
  }
}

async function pollForTransactionHash({
  account,
  chainId,
  sessionId,
}: {
  account: \`0x\${string}\`;
  chainId: number;
  sessionId: string;
}): Promise<\`0x\${string}\`> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    const response = await fetch(
      \`https://hub.orbs.network/swap/status/\${sessionId}?chainId=\${chainId}\`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ user: account }),
      },
    );
    const status = await response.json();

    if (!response.ok || status.error) {
      throw new Error(
        status.error || \`Status request failed (\${response.status})\`,
      );
    }
    if (status.txHash) return status.txHash;
  }

  throw new Error("Timed out waiting for the transaction hash");
}

async function submitSignedQuote(
  quote: LiquidityHubQuote,
  signature: Hash,
): Promise<Hash | undefined> {
  const response = await fetch(
    \`https://hub.orbs.network/swap-async?chainId=\${chainId}\`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ...quote, signature }),
    },
  );
  const result = (await response.json()) as { error?: string; txHash?: Hash };

  if (!response.ok || result.error) {
    throw new Error(
      result.error || \`Swap request failed (\${response.status})\`,
    );
  }

  return result.txHash;
}

function isQuoteFresh(quote: LiquidityHubQuote): boolean {
  const age = Date.now() - quote.timestamp;
  return Number.isFinite(quote.timestamp) && age >= 0 && age < 60_000;
}`;

const LIQUIDITY_HUB_SDK_QUOTE_RESPONSE_CODE = `{
  "inToken": "0x1111111111111111111111111111111111111111",
  "outToken": "0x6666666666666666666666666666666666666666",
  "inAmount": "1000000000000000000",
  "outAmount": "2495000000",
  "user": "0x5555555555555555555555555555555555555555",
  "slippage": 0.5,
  "qs": "%3FinputCurrency%3D0x1111%26outputCurrency%3D0x6666%26swapType%3D1",
  "partner": "unknown",
  "exchange": "lh",
  "sessionId": "example-session_137",
  "serializedOrder": "0x1234",
  "permitData": {
    "domain": {
      "name": "Permit2",
      "chainId": 137,
      "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
    },
    "types": {
      "PermitWitnessTransferFrom": [
        {
          "name": "permitted",
          "type": "TokenPermissions"
        },
        {
          "name": "spender",
          "type": "address"
        },
        {
          "name": "nonce",
          "type": "uint256"
        },
        {
          "name": "deadline",
          "type": "uint256"
        },
        {
          "name": "witness",
          "type": "ExclusiveDutchOrder"
        }
      ],
      "TokenPermissions": [
        {
          "name": "token",
          "type": "address"
        },
        {
          "name": "amount",
          "type": "uint256"
        }
      ],
      "ExclusiveDutchOrder": [
        {
          "name": "info",
          "type": "OrderInfo"
        },
        {
          "name": "decayStartTime",
          "type": "uint256"
        },
        {
          "name": "decayEndTime",
          "type": "uint256"
        },
        {
          "name": "exclusiveFiller",
          "type": "address"
        },
        {
          "name": "exclusivityOverrideBps",
          "type": "uint256"
        },
        {
          "name": "inputToken",
          "type": "address"
        },
        {
          "name": "inputStartAmount",
          "type": "uint256"
        },
        {
          "name": "inputEndAmount",
          "type": "uint256"
        },
        {
          "name": "outputs",
          "type": "DutchOutput[]"
        }
      ],
      "OrderInfo": [
        {
          "name": "reactor",
          "type": "address"
        },
        {
          "name": "swapper",
          "type": "address"
        },
        {
          "name": "nonce",
          "type": "uint256"
        },
        {
          "name": "deadline",
          "type": "uint256"
        },
        {
          "name": "additionalValidationContract",
          "type": "address"
        },
        {
          "name": "additionalValidationData",
          "type": "bytes"
        }
      ],
      "DutchOutput": [
        {
          "name": "token",
          "type": "address"
        },
        {
          "name": "startAmount",
          "type": "uint256"
        },
        {
          "name": "endAmount",
          "type": "uint256"
        },
        {
          "name": "recipient",
          "type": "address"
        }
      ]
    },
    "values": {
      "permitted": {
        "token": "0x1111111111111111111111111111111111111111",
        "amount": {
          "type": "BigNumber",
          "hex": "0x0de0b6b3a7640000"
        }
      },
      "spender": "0x2222222222222222222222222222222222222222",
      "nonce": {
        "type": "BigNumber",
        "hex": "0x2a"
      },
      "deadline": 1788220800,
      "witness": {
        "info": {
          "reactor": "0x2222222222222222222222222222222222222222",
          "swapper": "0x5555555555555555555555555555555555555555",
          "nonce": {
            "type": "BigNumber",
            "hex": "0x2a"
          },
          "deadline": 1788220800,
          "additionalValidationContract": "0x7777777777777777777777777777777777777777",
          "additionalValidationData": "0x"
        },
        "decayStartTime": 1788217200,
        "decayEndTime": 1788217260,
        "exclusiveFiller": "0x3333333333333333333333333333333333333333",
        "exclusivityOverrideBps": {
          "type": "BigNumber",
          "hex": "0x00"
        },
        "inputToken": "0x1111111111111111111111111111111111111111",
        "inputStartAmount": {
          "type": "BigNumber",
          "hex": "0x0de0b6b3a7640000"
        },
        "inputEndAmount": {
          "type": "BigNumber",
          "hex": "0x0de0b6b3a7640000"
        },
        "outputs": [
          {
            "token": "0x6666666666666666666666666666666666666666",
            "startAmount": {
              "type": "BigNumber",
              "hex": "0x0f4240"
            },
            "endAmount": {
              "type": "BigNumber",
              "hex": "0x0f4240"
            },
            "recipient": "0x4444444444444444444444444444444444444444"
          },
          {
            "token": "0x6666666666666666666666666666666666666666",
            "startAmount": {
              "type": "BigNumber",
              "hex": "0x94b6adc0"
            },
            "endAmount": {
              "type": "BigNumber",
              "hex": "0x93f85348"
            },
            "recipient": "0x5555555555555555555555555555555555555555"
          }
        ]
      }
    }
  },
  "eip712": {
    "domain": {
      "name": "Permit2",
      "chainId": 137,
      "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
    },
    "types": {
      "PermitWitnessTransferFrom": [
        {
          "name": "permitted",
          "type": "TokenPermissions"
        },
        {
          "name": "spender",
          "type": "address"
        },
        {
          "name": "nonce",
          "type": "uint256"
        },
        {
          "name": "deadline",
          "type": "uint256"
        },
        {
          "name": "witness",
          "type": "ExclusiveDutchOrder"
        }
      ],
      "TokenPermissions": [
        {
          "name": "token",
          "type": "address"
        },
        {
          "name": "amount",
          "type": "uint256"
        }
      ],
      "ExclusiveDutchOrder": [
        {
          "name": "info",
          "type": "OrderInfo"
        },
        {
          "name": "decayStartTime",
          "type": "uint256"
        },
        {
          "name": "decayEndTime",
          "type": "uint256"
        },
        {
          "name": "exclusiveFiller",
          "type": "address"
        },
        {
          "name": "exclusivityOverrideBps",
          "type": "uint256"
        },
        {
          "name": "inputToken",
          "type": "address"
        },
        {
          "name": "inputStartAmount",
          "type": "uint256"
        },
        {
          "name": "inputEndAmount",
          "type": "uint256"
        },
        {
          "name": "outputs",
          "type": "DutchOutput[]"
        }
      ],
      "OrderInfo": [
        {
          "name": "reactor",
          "type": "address"
        },
        {
          "name": "swapper",
          "type": "address"
        },
        {
          "name": "nonce",
          "type": "uint256"
        },
        {
          "name": "deadline",
          "type": "uint256"
        },
        {
          "name": "additionalValidationContract",
          "type": "address"
        },
        {
          "name": "additionalValidationData",
          "type": "bytes"
        }
      ],
      "DutchOutput": [
        {
          "name": "token",
          "type": "address"
        },
        {
          "name": "startAmount",
          "type": "uint256"
        },
        {
          "name": "endAmount",
          "type": "uint256"
        },
        {
          "name": "recipient",
          "type": "address"
        }
      ]
    },
    "primaryType": "PermitWitnessTransferFrom",
    "message": {
      "permitted": {
        "token": "0x1111111111111111111111111111111111111111",
        "amount": "1000000000000000000"
      },
      "spender": "0x2222222222222222222222222222222222222222",
      "nonce": "1788217200123",
      "deadline": 1788220800,
      "witness": {
        "info": {
          "reactor": "0x2222222222222222222222222222222222222222",
          "swapper": "0x5555555555555555555555555555555555555555",
          "nonce": "1788217200123",
          "deadline": 1788220800,
          "additionalValidationContract": "0x7777777777777777777777777777777777777777",
          "additionalValidationData": "0x"
        },
        "decayStartTime": 1788217200,
        "decayEndTime": 1788217260,
        "exclusiveFiller": "0x3333333333333333333333333333333333333333",
        "exclusivityOverrideBps": "0",
        "inputToken": "0x1111111111111111111111111111111111111111",
        "inputStartAmount": "1000000000000000000",
        "inputEndAmount": "1000000000000000000",
        "outputs": [
          {
            "token": "0x6666666666666666666666666666666666666666",
            "startAmount": "1000000",
            "endAmount": "1000000",
            "recipient": "0x4444444444444444444444444444444444444444"
          },
          {
            "token": "0x6666666666666666666666666666666666666666",
            "startAmount": "2495000000",
            "endAmount": "2482525000",
            "recipient": "0x5555555555555555555555555555555555555555"
          }
        ]
      }
    }
  },
  "outAmountWS": "2495000000",
  "outAmountWsMinusGas": "2494000000",
  "minAmountOut": "2482525000",
  "amountOutUI": "-1",
  "inTokenUsd": 2500,
  "outTokenUsd": 1,
  "gasAmountOut": "1000000",
  "referencePrice": "2495000000",
  "userMinOutAmountWithGas": "2482525000",
  "timestamp": 1788217200000
}`;

const LIQUIDITY_HUB_SDK_FULL_FLOW_CODE = `import { createClient, isFreshQuote, isNativeAddress, permit2Address, type Quote } from "@orbs-network/liquidity-hub-sdk";
import { createPublicClient, createWalletClient, custom, erc20Abi, http, parseAbi, type Address, type Hash, type Hex, type PublicClient, type TransactionReceipt, type WalletClient } from "viem";
import { polygon } from "viem/chains";

// Use the partner identifier supplied by Orbs; otherwise use "unknown".
const partner = "unknown";
// Use the active Viem chain from the connected wallet; Polygon is only an example.
const chain = polygon;
const liquidityHubClient = createClient({ chainId: chain.id, partner });
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

export interface ExecuteLiquidityHubSwapParams {
  // Quote previously selected by the host against its DEX route.
  selectedQuote: Quote;
  // Host-selected token before native input is replaced with its wrapped token.
  inputTokenAddress: Address;
  account: Address;
  // Reuses the host's current quote inputs when the selected quote is stale.
  refetchQuote: () => Promise<Quote>;
  // Optional host DEX target and calldata forwarded as dexTx by the SDK.
  dexRouterData?: { data?: Hex; to?: Address };
}

export async function executeLiquidityHubSwap({
  selectedQuote,
  inputTokenAddress,
  account,
  refetchQuote,
  dexRouterData,
}: ExecuteLiquidityHubSwapParams): Promise<TransactionReceipt> {
  const walletProvider = (
    window as unknown as { ethereum: Parameters<typeof custom>[0] }
  ).ethereum;
  const publicClient = createPublicClient({ chain, transport: http() });
  const walletClient = createWalletClient({
    chain,
    transport: custom(walletProvider),
  });

  if (isNativeAddress(inputTokenAddress)) {
    await wrapNativeInput({
      account,
      amount: BigInt(selectedQuote.inAmount),
      publicClient,
      token: selectedQuote.inToken as Address,
      walletClient,
    });
  }

  await approvePermit2IfNeeded({
    account,
    amount: BigInt(selectedQuote.inAmount),
    publicClient,
    token: selectedQuote.inToken as Address,
    walletClient,
  });

  // Refresh after 60 seconds because market prices and available liquidity may
  // have moved enough that the old quote is no longer safely executable.
  const quote = isFreshQuote(selectedQuote, 60)
    ? selectedQuote
    : await refetchQuote();

  const signature = await walletClient.signTypedData({
    ...quote.eip712,
    account,
  });

  const txHash = await liquidityHubClient.swap(quote, signature, dexRouterData);
  const receipt = await waitForSuccessfulReceipt(publicClient, txHash as Hash);

  return receipt;
}

interface PrepareInputParams {
  account: Address;
  amount: bigint;
  publicClient: PublicClient;
  token: Address;
  walletClient: WalletClient;
}

async function wrapNativeInput({
  account,
  amount,
  publicClient,
  token,
  walletClient,
}: PrepareInputParams): Promise<void> {
  const hash = await walletClient.writeContract({
    account,
    address: token,
    abi: wrappedNativeAbi,
    functionName: "deposit",
    value: amount,
    chain: walletClient.chain,
  });
  await waitForSuccessfulReceipt(publicClient, hash);
}

async function approvePermit2IfNeeded({
  account,
  amount,
  publicClient,
  token,
  walletClient,
}: PrepareInputParams): Promise<void> {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, permit2Address as Address],
  });
  if (allowance >= amount) return;

  const hash = await walletClient.writeContract({
    account,
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [permit2Address as Address, amount],
    chain: walletClient.chain,
  });
  await waitForSuccessfulReceipt(publicClient, hash);
}

async function waitForSuccessfulReceipt(
  publicClient: PublicClient,
  hash: Hash,
): Promise<TransactionReceipt> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted");
  }
  return receipt;
}

/*
Key values

- liquidityHubClient: SDK client bound to the active chain and partner.
- publicClient: created when execution starts; reads allowances and confirms
  transaction receipts for the active chain.
- walletClient: created when execution starts from the connected provider; sends
  wrap/approval transactions and signs the quote.
- selectedQuote: Liquidity Hub quote chosen during route selection.
- inputTokenAddress: token originally selected by the user. It may be a native
  token placeholder even though selectedQuote.inToken is its wrapped ERC-20.
- account: connected wallet that requested and signs the quote.
- refetchQuote: callback from the host quote layer. It is called only when the
  selected quote is stale and already knows the current tokens, amount, account,
  slippage, and DEX minimum output.
- 60-second freshness: limits exposure to price and liquidity changes between
  quote selection and signing. A stale quote is refreshed before it is signed.
- dexRouterData: optional host DEX transaction target and calldata in the shape
  { to?: Address; data?: Hex }. The SDK forwards it as dexTx with the swap
  request. Leave it undefined when there is no DEX router transaction to attach.
- receipt: successful on-chain transaction receipt returned to the caller. Read
  receipt.transactionHash when the host only needs the confirmed hash.
*/`;

const ORDER_HISTORY_REQUEST_CODE = `export async function fetchOrderHistory() {
  const search = new URLSearchParams({
    swapper: "0x5555555555555555555555555555555555555555",
    chainId: "137",
    exchange: "0x8888888888888888888888888888888888888888",
  });

  const response = await fetch(
    "https://order-sink-v2.orbs.network/orders?" + search,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch order history");
  }

  return response.json();
}`;

const ORDER_HISTORY_REQUEST_CURL = `curl --get 'https://order-sink-v2.orbs.network/orders' \\
  --header 'Accept: application/json' \\
  --data-urlencode 'swapper=0x5555555555555555555555555555555555555555' \\
  --data-urlencode 'chainId=137' \\
  --data-urlencode 'exchange=0x8888888888888888888888888888888888888888'`;

const REFERENCE_EXAMPLES_BASE = {
  "liquidity-hub-direct:fetch-quote": {
    format: "request-response",
    includePartnerContextFile: false,
    files: [
      {
        code: LIQUIDITY_HUB_QUOTE_REQUEST_CODE,
        curl: LIQUIDITY_HUB_QUOTE_REQUEST_CURL,
        kind: "request",
        language: "typescript",
        method: "POST",
        name: "quote-request.json",
      },
      {
        code: LIQUIDITY_HUB_SDK_QUOTE_RESPONSE_CODE,
        language: "json",
        kind: "response",
        name: "quote-response.json",
      },
    ],
    help: "The Request tab is the raw POST /quote contract. The Response tab shows the complete wallet-bound quote, including wallet-ready eip712, legacy permitData, pricing metadata, and timestamp.",
    label: "Direct API Request / Response",
    purpose: "Request a wallet-bound Liquidity Hub candidate over HTTP and preserve its execution payload.",
    title: "Fetch Quote",
  },
  "liquidity-hub-direct:submit-swap": {
    includePartnerContextFile: false,
    files: [
      {
        code: LIQUIDITY_HUB_SUBMIT_SWAP_CODE,
        language: "typescript",
        name: "submit-swap.ts",
      },
      {
        code: LIQUIDITY_HUB_QUOTE_TYPES_CODE,
        language: "typescript",
        name: "types.ts",
      },
    ],
    help: "Submit Swap checks and approves the ERC-20 input token for Permit2 when needed, refreshes a quote older than 60 seconds through the supplied callback, then signs, submits, polls, and confirms it. The separate Fetch Quote section shows where the quote comes from; types.ts declares its shape.",
    label: "Direct API Submit Swap",
    purpose: "Approve the ERC-20 input when needed, then sign, submit, poll, and confirm the executable quote.",
    title: "Submit Swap",
  },
  "advanced-orders-direct:create-order": {
    "files": [
      {
        "code": "import { erc20Abi, parseAbi } from \"viem\";\n\nimport { fetchDefaultPermitData } from \"./build-order\";\nimport { signOrder } from \"./sign-order\";\nimport type { Address, CreateOrderResponse, OrderInput, OrderResponse, PermitOrder, Signature, SignedOrder, WalletContext } from \"./order-types\";\n\nconst ORDERS_SINK_URL = \"https://order-sink-v2.orbs.network\";\n// Use your DEX partner ID if Orbs provided one; otherwise use \"unknown\".\nconst partner = \"unknown\";\nconst wrappedNativeAbi = parseAbi([\"function deposit() payable\"]);\n\nexport async function submitOrdersSinkOrder({\n  orderInput,\n  wallet,\n  wTokenAddress,\n}: {\n  // Derived swap data owned by the host's form and state layer.\n  orderInput: OrderInput;\n  // Account and viem clients supplied by the host; see order-types.ts.\n  wallet: WalletContext;\n  // Wrapped native token for the active chain, supplied by the host.\n  wTokenAddress: Address;\n}): Promise<OrderResponse> {\n  const { account, chainId, publicClient, walletClient } = wallet;\n\n  // 1. Fetch the trusted default template for this partner and active chain.\n  const permitData = await fetchDefaultPermitData(partner, chainId);\n\n  // 2. Prepare the complete source amount before asking for a signature.\n  // Allowance belongs to RePermit, not to order.spender (the reactor).\n  const spender = permitData.domain.verifyingContract;\n  const requiredAmount = BigInt(orderInput.totalInputAmount);\n  let inputTokenAddress = orderInput.inputToken.address;\n\n  if (orderInput.sourceIsNative) {\n    // Wrap the complete amount, then use WToken everywhere in the signed order.\n    const wrapHash = await walletClient.writeContract({\n      address: wTokenAddress,\n      abi: wrappedNativeAbi,\n      functionName: \"deposit\",\n      value: requiredAmount,\n      account,\n      chain: walletClient.chain,\n    });\n    const wrapReceipt = await publicClient.waitForTransactionReceipt({ hash: wrapHash });\n    if (wrapReceipt.status !== \"success\") throw new Error(\"Native token wrap reverted\");\n    inputTokenAddress = wTokenAddress;\n  }\n\n  const allowance = await publicClient.readContract({\n    address: inputTokenAddress,\n    abi: erc20Abi,\n    functionName: \"allowance\",\n    args: [account, spender],\n  });\n\n  if (allowance < requiredAmount) {\n    // This direct-integration reference grants only the complete order amount.\n    // A maximum allowance must be an explicit host security decision.\n    const approveHash = await walletClient.writeContract({\n      address: inputTokenAddress,\n      abi: erc20Abi,\n      functionName: \"approve\",\n      args: [spender, requiredAmount],\n      account,\n      chain: walletClient.chain,\n    });\n    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });\n    if (approveReceipt.status !== \"success\") throw new Error(\"Token approval reverted\");\n  }\n\n  // 3. signOrder re-fetches the default template, builds the order from the\n  // values passed in, and signs without accepting permit data from the caller.\n  const { order, signature } = await signOrder({\n    account,\n    chainId,\n    orderInput,\n    walletClient,\n    wTokenAddress,\n  });\n  return submitOrder(order, signature);\n}\n\nasync function submitOrder(\n  order: PermitOrder,\n  signature: Signature,\n): Promise<OrderResponse> {\n  const body: SignedOrder = { signature, order, status: \"pending\" };\n  const response = await fetch(ORDERS_SINK_URL + \"/orders/new\", {\n    method: \"POST\",\n    headers: {\n      Accept: \"application/json\",\n      \"Content-Type\": \"application/json\",\n    },\n    body: JSON.stringify(body),\n  });\n  const result = (await response.json().catch(() => ({}))) as CreateOrderResponse;\n\n  if (!response.ok || !result.success) {\n    const message = \"message\" in result ? result.message : undefined;\n    throw new Error(message ?? response.statusText ?? \"Order creation failed\");\n  }\n\n  return result.signedOrder;\n}\n\n/*\nCreate order flow\n\n1. Fetch the default permit template for the partner and active chain.\n2. Check allowance, wrap native input when needed, and approve RePermit when\n   allowance does not cover the complete order amount.\n3. Call signOrder() with the account, chain, derived values, and wallet client.\n   It fetches the default permit data, builds the order, and signs it.\n4. Submit the exact signed order and require HTTP and API success, then keep the returned signedOrder\n   for progress, history, fills, and cancellation.\n\nA React host wraps submitOrdersSinkOrder in a hook and supplies wallet from\nuseConnection()/usePublicClient()/useWalletClient(); the flow itself stays\nframework-neutral.\n*/",
        "language": "typescript",
        "name": "create-order-flow.ts"
      },
      {
        "code": "import type { WalletClient } from \"viem\";\n\nimport { buildOrderFromDerivedValues } from \"./build-order\";\nimport type { Address, OrderInput, PermitOrder, Signature } from \"./order-types\";\n\nexport async function signOrder({\n  account,\n  chainId,\n  orderInput,\n  walletClient,\n  wTokenAddress,\n}: {\n  account: Address;\n  chainId: number;\n  orderInput: OrderInput;\n  walletClient: WalletClient;\n  wTokenAddress: Address;\n}): Promise<{ order: PermitOrder; signature: Signature }> {\n  const { order, permitData } = await buildOrderFromDerivedValues({\n    account,\n    chainId,\n    orderInput,\n    wTokenAddress,\n  });\n  const signTypedDataArgs = {\n    account,\n    domain: permitData.domain,\n    message: order,\n    primaryType: permitData.primaryType,\n    types: permitData.types,\n  } as const;\n\n  // Keep the complete EIP-712 hex signature returned by the wallet.\n  const signature = await walletClient.signTypedData(signTypedDataArgs);\n\n  // Preserve the exact object that was signed for POST /orders/new.\n  return { signature, order };\n}",
        "language": "typescript",
        "name": "sign-order.ts"
      },
      {
        "code": "import type { Address, OrderInput, PermitData, PermitOrder } from \"./order-types\";\n\nconst ORDERS_SINK_URL = \"https://order-sink-v2.orbs.network\";\n// Use your DEX partner ID if Orbs provided one; otherwise use \"unknown\".\nconst partner = \"unknown\";\n\nexport async function buildOrderFromDerivedValues({\n  account,\n  chainId,\n  orderInput,\n  wTokenAddress,\n}: {\n  account: Address;\n  chainId: number;\n  // Derived swap data owned by the host's form and state layer.\n  orderInput: OrderInput;\n  // Wrapped native token for the active chain, supplied by the host.\n  wTokenAddress: Address;\n}): Promise<{ order: PermitOrder; permitData: PermitData }> {\n  const permitData = await fetchDefaultPermitData(partner, chainId);\n  const currentTimeMillis = Date.now();\n  const nonce = currentTimeMillis.toString();\n  const start = Math.floor(currentTimeMillis / 1_000).toString();\n  const deadline = Math.round(orderInput.deadlineMillis / 1_000).toString();\n  const epoch = orderInput.totalTrades <= 1\n    ? 0\n    : Math.round(orderInput.fillDelayMillis / 1_000);\n  const inputTokenAddress = orderInput.sourceIsNative\n    ? wTokenAddress\n    : orderInput.inputToken.address;\n  const order = {\n    permitted: {\n      token: inputTokenAddress,\n      amount: orderInput.totalInputAmount,\n    },\n    spender: permitData.order.spender,\n    nonce,\n    deadline,\n    witness: {\n      reactor: permitData.order.witness.reactor,\n      executor: permitData.order.witness.executor,\n      exchange: {\n        adapter: permitData.order.witness.exchange.adapter,\n        ref: permitData.order.witness.exchange.ref,\n        share: permitData.order.witness.exchange.share,\n        data: permitData.order.witness.exchange.data,\n      },\n      swapper: account,\n      nonce,\n      start,\n      deadline,\n      chainid: chainId,\n      exclusivity: permitData.order.witness.exclusivity,\n      epoch,\n      slippage: orderInput.slippageBps,\n      freshness: orderInput.freshnessSeconds ?? 60,\n      input: {\n        token: inputTokenAddress,\n        amount: orderInput.srcAmountPerFill,\n        maxAmount: orderInput.totalInputAmount,\n      },\n      output: {\n        token: orderInput.dstToken,\n        limit: orderInput.dstMinAmountPerFill,\n        triggerLower: orderInput.triggerLower,\n        triggerUpper: orderInput.triggerUpper,\n        recipient: account,\n      },\n    },\n  } satisfies PermitOrder;\n\n  return { order, permitData };\n}\n\nexport async function fetchDefaultPermitData(\n  partnerId: string,\n  chainId: number,\n): Promise<PermitData> {\n  const query = new URLSearchParams({\n    partner: partnerId,\n    chain: String(chainId),\n  });\n  const response = await fetch(ORDERS_SINK_URL + \"/config?\" + query, {\n    headers: { Accept: \"application/json\" },\n  });\n  if (!response.ok) {\n    throw new Error(\"Failed to fetch default permit data (\" + response.status + \")\");\n  }\n\n  return (await response.json()) as PermitData;\n}",
        "language": "typescript",
        "name": "build-order.ts"
      },
      {
        "code": "import type { PublicClient, WalletClient } from \"viem\";\n\n// Ethereum-compatible addresses and hex values used by viem.\nexport type Address = `0x${string}`;\nexport type Hex = `0x${string}`;\n\n// Complete 65-byte EIP-712 signature returned by the wallet. Keep it intact;\n// POST /orders/new accepts the regular hex signature, not separate v/r/s fields.\nexport type Signature = Hex;\n\n// Everything the order flows need from the host's wallet layer. These are viem\n// types, so any host can supply them: wagmi's usePublicClient() and\n// useWalletClient().data return exactly these clients.\nexport type WalletContext = {\n  account: Address;\n  chainId: number;\n  publicClient: PublicClient;\n  walletClient: WalletClient;\n};\n\n// Derived swap data owned by the host DEX's form and state layer.\nexport type OrderInput = {\n  inputToken: {\n    address: Address;\n  };\n  dstToken: Address;\n  sourceIsNative: boolean;\n  totalInputAmount: string;\n  srcAmountPerFill: string;\n  dstMinAmountPerFill: string;\n  deadlineMillis: number;\n  fillDelayMillis: number;\n  totalTrades: number;\n  slippageBps: number;\n  // Omit to use the protocol's normal 60-second freshness window.\n  freshnessSeconds?: number;\n  triggerLower: string;\n  triggerUpper: string;\n};\n\n// The exact EIP-712 message signed by the wallet and submitted to Orders Sink.\n// Numeric uint values are strings when they can exceed JavaScript's safe range.\nexport type PermitOrder = {\n  // Permit scope: the ERC-20 token and total amount authorized by this signature.\n  permitted: {\n    // Use an ERC-20 address. Native input is unsupported, so use WToken instead.\n    token: Address;\n    // Maximum total amount the permit may transfer, in token base units.\n    amount: string;\n  };\n  // Signed reactor spender returned by GET /config. ERC-20 allowance instead\n  // targets domain.verifyingContract (RePermit).\n  spender: Address;\n  // Fresh nonce generated once for both the permit and its witness.\n  nonce: string;\n  // Permit expiry as Unix seconds. Expired orders cannot execute.\n  deadline: string;\n  // Strategy-specific data covered by the same wallet signature.\n  witness: {\n    // Protocol reactor returned by GET /config.\n    reactor: Address;\n    // Protocol executor returned by GET /config.\n    executor: Address;\n    // Exchange integration selected by the trusted partner configuration.\n    exchange: {\n      // Adapter used to execute the swap.\n      adapter: Address;\n      // Optional referral address.\n      ref: Address;\n      // Server-configured uint32 fee/referral share; preserve it unchanged.\n      share: number;\n      // Optional adapter-specific calldata; use 0x when empty.\n      data: Hex;\n    };\n    // Wallet that owns the input tokens and signs the typed data.\n    swapper: Address;\n    // Same value as the top-level permit nonce.\n    nonce: string;\n    // Earliest Unix-second timestamp at which execution may begin.\n    start: string;\n    // Latest Unix-second timestamp at which the order may execute.\n    deadline: string;\n    // Must match the connected wallet and EIP-712 domain chain IDs.\n    chainid: number;\n    // Protocol exclusivity setting returned by GET /config unless customized.\n    exclusivity: number;\n    // Minimum interval between eligible fills, in seconds.\n    epoch: number;\n    // Allowed execution slippage in basis points (100 = 1%).\n    slippage: number;\n    // Maximum quote/price age accepted by the strategy, in seconds.\n    freshness: number;\n    // Per-fill input constraints.\n    input: {\n      // Must match permitted.token; use WToken when the UI selected native input.\n      token: Address;\n      // Desired input per fill, in token base units.\n      amount: string;\n      // Maximum input available across fills, in token base units.\n      maxAmount: string;\n    };\n    // Per-fill output constraints.\n    output: {\n      // ERC-20 token the strategy should receive.\n      token: Address;\n      // Minimum output accepted per fill, in output-token base units.\n      limit: string;\n      // Lower trigger boundary. Use \"0\" when the strategy does not use it.\n      triggerLower: string;\n      // Upper trigger boundary. Use \"0\" when the strategy does not use it.\n      triggerUpper: string;\n      // Address that receives output tokens; commonly the connected wallet.\n      recipient: Address;\n    };\n  };\n};\n\n// One field declaration in the EIP-712 type map returned by GET /config.\nexport type TypedDataField = {\n  name: string;\n  type: string;\n};\n\n// Trusted protocol configuration used as the base for the local order.\nexport type PermitData = {\n  // EIP-712 domain; never silently replace these values with user input.\n  domain: {\n    name: string;\n    version: string;\n    chainId: number;\n    // RePermit contract and ERC-20 approval spender.\n    verifyingContract: Address;\n  };\n  // Base order containing protocol contract and exchange fields.\n  order: PermitOrder;\n  // Root EIP-712 type used when requesting the wallet signature.\n  primaryType: \"RePermitWitnessTransferFrom\";\n  // Full EIP-712 type definitions supplied by the service.\n  types: Record<string, TypedDataField[]>;\n  // Partner identifier applied by Orders Sink, when present.\n  partner?: string;\n};\n\n// Exact request body sent to POST /orders/new after signing.\nexport type SignedOrder = {\n  signature: Signature;\n  // This must be the same object used as signTypedData's message.\n  order: PermitOrder;\n  // New orders always enter the service as pending.\n  status: \"pending\";\n};\n\n// Service-managed execution details returned with an order.\nexport type OrderMetadata = {\n  // Execution chunks already processed by the strategy.\n  chunks?: unknown[];\n  // Total number of fills expected by the strategy.\n  expectedChunks: number;\n  // ISO timestamp of the last price evaluation.\n  lastPriceCheck: string;\n  // ISO timestamp at which another fill may become eligible.\n  nextEligibleTime: string;\n  // Service status such as pending, completed, or cancelled.\n  status: string;\n  // Human-readable strategy summary for display.\n  description: string;\n  // Display-only USD price; never use it for execution math.\n  displayOnlyInputTokenPriceUSD: string;\n  // On-chain digest passed to cancel(bytes32[] digests).\n  repermitDigest: Hex;\n};\n\n// Raw order shape returned by Orders Sink.\nexport type OrderResponse = {\n  // Orders Sink identifier for this signed order.\n  hash: Hex;\n  metadata: OrderMetadata;\n  // The message originally signed and submitted.\n  order: PermitOrder;\n  signature: Signature;\n  // ISO creation timestamp assigned by the service.\n  timestamp: string;\n};\n\n// The create endpoint returns either the created order or an API error.\nexport type CreateOrderResponse =\n  | {\n      success: true;\n      signedOrder: OrderResponse;\n    }\n  | {\n      success: false;\n      message?: string;\n      code?: string | number;\n    };\n\n// Filters required by the order-history endpoint.\nexport type FetchOrdersQuery = {\n  // Wallet whose orders should be returned.\n  swapper: Address;\n  // Network on which those orders execute.\n  chainId: number;\n  // Exchange adapter from the partner's GET /config response.\n  exchange: Address;\n};\n\n// Response body returned by the order-history endpoint.\nexport type FetchOrdersResponse = {\n  orders: OrderResponse[];\n  page: number;\n  limit: number;\n  total: number;\n  totalPages: number;\n};",
        "language": "typescript",
        "name": "order-types.ts"
      }
    ],
    "help": "The main flow calls useSignOrder() without arguments. The supporting tabs fetch the default permit data, build the order from current DEX-derived values, and preserve the signed order for submission.",
    "label": "Optional Wagmi v3 Reference",
    "purpose": "Create, fund, sign, and submit one order from live host inputs.",
    "title": "Create an Order End-to-End"
  },
  "advanced-orders-direct:fetch-order-sink-orders": {
    format: "request-response",
    includePartnerContextFile: false,
    "files": [
      {
        "code": "import type { FetchOrdersResponse, PermitData } from \"./order-types\";\n\n// Keep the Orders Sink origin fixed instead of accepting a user-provided host.\nconst ORDERS_SINK_URL = \"https://order-sink-v2.orbs.network\";\n// Use your DEX partner ID if Orbs provided one; otherwise use \"unknown\".\nconst partner = \"unknown\";\n\nexport const fetchOrders = async () => {\n  // 1. Fetch trusted config for the same partner and chain as the history query.\n  // The exchange adapter identifies which integration's orders to return.\n  const configQuery = new URLSearchParams({\n    partner,\n    chain: \"137\",\n  });\n  const permitDataRequest = await fetch(\n    `${ORDERS_SINK_URL}/config?${configQuery}`,\n    { headers: { Accept: \"application/json\" } },\n  );\n  if (!permitDataRequest.ok) {\n    throw new Error(`Failed to fetch RePermit data (${permitDataRequest.status})`);\n  }\n  const permitDataResponse = (await permitDataRequest.json()) as PermitData;\n\n  // 2. Request orders for one wallet, chain, and configured adapter.\n  // swapper is the wallet that signed/owns the orders, not necessarily a token\n  // recipient used by a custom integration.\n  const search = new URLSearchParams({\n    swapper: \"0x5555555555555555555555555555555555555555\",\n    chainId: \"137\",\n    exchange: permitDataResponse.order.witness.exchange.adapter,\n  });\n  const response = await fetch(`https://order-sink-v2.orbs.network/orders?${search}`, {\n    method: \"GET\",\n    headers: { Accept: \"application/json\" },\n  });\n  if (!response.ok) {\n    throw new Error(`Failed to fetch orders (${response.status})`);\n  }\n\n  const result = (await response.json()) as FetchOrdersResponse;\n  return result.orders;\n};",
        "language": "typescript",
        "name": "fetch-orders.ts"
      },
      {
        "code": "import type { PublicClient, WalletClient } from \"viem\";\n\n// Ethereum-compatible addresses and hex values used by viem.\nexport type Address = `0x${string}`;\nexport type Hex = `0x${string}`;\n\n// Complete 65-byte EIP-712 signature returned by the wallet. Keep it intact;\n// POST /orders/new accepts the regular hex signature, not separate v/r/s fields.\nexport type Signature = Hex;\n\n// Everything the order flows need from the host's wallet layer. These are viem\n// types, so any host can supply them: wagmi's usePublicClient() and\n// useWalletClient().data return exactly these clients.\nexport type WalletContext = {\n  account: Address;\n  chainId: number;\n  publicClient: PublicClient;\n  walletClient: WalletClient;\n};\n\n// Derived swap data owned by the host DEX's form and state layer.\nexport type OrderInput = {\n  inputToken: {\n    address: Address;\n  };\n  dstToken: Address;\n  sourceIsNative: boolean;\n  totalInputAmount: string;\n  srcAmountPerFill: string;\n  dstMinAmountPerFill: string;\n  deadlineMillis: number;\n  fillDelayMillis: number;\n  totalTrades: number;\n  slippageBps: number;\n  // Omit to use the protocol's normal 60-second freshness window.\n  freshnessSeconds?: number;\n  triggerLower: string;\n  triggerUpper: string;\n};\n\n// The exact EIP-712 message signed by the wallet and submitted to Orders Sink.\n// Numeric uint values are strings when they can exceed JavaScript's safe range.\nexport type PermitOrder = {\n  // Permit scope: the ERC-20 token and total amount authorized by this signature.\n  permitted: {\n    // Use an ERC-20 address. Native input is unsupported, so use WToken instead.\n    token: Address;\n    // Maximum total amount the permit may transfer, in token base units.\n    amount: string;\n  };\n  // Signed reactor spender returned by GET /config. ERC-20 allowance instead\n  // targets domain.verifyingContract (RePermit).\n  spender: Address;\n  // Fresh nonce generated once for both the permit and its witness.\n  nonce: string;\n  // Permit expiry as Unix seconds. Expired orders cannot execute.\n  deadline: string;\n  // Strategy-specific data covered by the same wallet signature.\n  witness: {\n    // Protocol reactor returned by GET /config.\n    reactor: Address;\n    // Protocol executor returned by GET /config.\n    executor: Address;\n    // Exchange integration selected by the trusted partner configuration.\n    exchange: {\n      // Adapter used to execute the swap.\n      adapter: Address;\n      // Optional referral address.\n      ref: Address;\n      // Server-configured uint32 fee/referral share; preserve it unchanged.\n      share: number;\n      // Optional adapter-specific calldata; use 0x when empty.\n      data: Hex;\n    };\n    // Wallet that owns the input tokens and signs the typed data.\n    swapper: Address;\n    // Same value as the top-level permit nonce.\n    nonce: string;\n    // Earliest Unix-second timestamp at which execution may begin.\n    start: string;\n    // Latest Unix-second timestamp at which the order may execute.\n    deadline: string;\n    // Must match the connected wallet and EIP-712 domain chain IDs.\n    chainid: number;\n    // Protocol exclusivity setting returned by GET /config unless customized.\n    exclusivity: number;\n    // Minimum interval between eligible fills, in seconds.\n    epoch: number;\n    // Allowed execution slippage in basis points (100 = 1%).\n    slippage: number;\n    // Maximum quote/price age accepted by the strategy, in seconds.\n    freshness: number;\n    // Per-fill input constraints.\n    input: {\n      // Must match permitted.token; use WToken when the UI selected native input.\n      token: Address;\n      // Desired input per fill, in token base units.\n      amount: string;\n      // Maximum input available across fills, in token base units.\n      maxAmount: string;\n    };\n    // Per-fill output constraints.\n    output: {\n      // ERC-20 token the strategy should receive.\n      token: Address;\n      // Minimum output accepted per fill, in output-token base units.\n      limit: string;\n      // Lower trigger boundary. Use \"0\" when the strategy does not use it.\n      triggerLower: string;\n      // Upper trigger boundary. Use \"0\" when the strategy does not use it.\n      triggerUpper: string;\n      // Address that receives output tokens; commonly the connected wallet.\n      recipient: Address;\n    };\n  };\n};\n\n// One field declaration in the EIP-712 type map returned by GET /config.\nexport type TypedDataField = {\n  name: string;\n  type: string;\n};\n\n// Trusted protocol configuration used as the base for the local order.\nexport type PermitData = {\n  // EIP-712 domain; never silently replace these values with user input.\n  domain: {\n    name: string;\n    version: string;\n    chainId: number;\n    // RePermit contract and ERC-20 approval spender.\n    verifyingContract: Address;\n  };\n  // Base order containing protocol contract and exchange fields.\n  order: PermitOrder;\n  // Root EIP-712 type used when requesting the wallet signature.\n  primaryType: \"RePermitWitnessTransferFrom\";\n  // Full EIP-712 type definitions supplied by the service.\n  types: Record<string, TypedDataField[]>;\n  // Partner identifier applied by Orders Sink, when present.\n  partner?: string;\n};\n\n// Exact request body sent to POST /orders/new after signing.\nexport type SignedOrder = {\n  signature: Signature;\n  // This must be the same object used as signTypedData's message.\n  order: PermitOrder;\n  // New orders always enter the service as pending.\n  status: \"pending\";\n};\n\n// Service-managed execution details returned with an order.\nexport type OrderMetadata = {\n  // Execution chunks already processed by the strategy.\n  chunks?: unknown[];\n  // Total number of fills expected by the strategy.\n  expectedChunks: number;\n  // ISO timestamp of the last price evaluation.\n  lastPriceCheck: string;\n  // ISO timestamp at which another fill may become eligible.\n  nextEligibleTime: string;\n  // Service status such as pending, completed, or cancelled.\n  status: string;\n  // Human-readable strategy summary for display.\n  description: string;\n  // Display-only USD price; never use it for execution math.\n  displayOnlyInputTokenPriceUSD: string;\n  // On-chain digest passed to cancel(bytes32[] digests).\n  repermitDigest: Hex;\n};\n\n// Raw order shape returned by Orders Sink.\nexport type OrderResponse = {\n  // Orders Sink identifier for this signed order.\n  hash: Hex;\n  metadata: OrderMetadata;\n  // The message originally signed and submitted.\n  order: PermitOrder;\n  signature: Signature;\n  // ISO creation timestamp assigned by the service.\n  timestamp: string;\n};\n\n// The create endpoint returns either the created order or an API error.\nexport type CreateOrderResponse =\n  | {\n      success: true;\n      signedOrder: OrderResponse;\n    }\n  | {\n      success: false;\n      message?: string;\n      code?: string | number;\n    };\n\n// Filters required by the order-history endpoint.\nexport type FetchOrdersQuery = {\n  // Wallet whose orders should be returned.\n  swapper: Address;\n  // Network on which those orders execute.\n  chainId: number;\n  // Exchange adapter from the partner's GET /config response.\n  exchange: Address;\n};\n\n// Response body returned by the order-history endpoint.\nexport type FetchOrdersResponse = {\n  orders: OrderResponse[];\n  page: number;\n  limit: number;\n  total: number;\n  totalPages: number;\n};",
        "language": "typescript",
        "name": "order-types.ts"
      },
      {
        "code": ORDER_HISTORY_REQUEST_CODE,
        "curl": ORDER_HISTORY_REQUEST_CURL,
        "kind": "request",
        "language": "typescript",
        "method": "GET",
        "name": "request.json"
      },
      {
        "code": "{\n  \"orders\": [\n    {\n      \"hash\": \"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\n      \"metadata\": {\n        \"chunks\": [],\n        \"expectedChunks\": 10,\n        \"lastPriceCheck\": \"2026-08-23T09:00:00.000Z\",\n        \"nextEligibleTime\": \"2026-08-23T10:00:00.000Z\",\n        \"status\": \"pending\",\n        \"description\": \"TWAP market order\",\n        \"displayOnlyInputTokenPriceUSD\": \"2500000000000000000000\",\n        \"repermitDigest\": \"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\"\n      },\n      \"order\": {\n        \"permitted\": {\n          \"token\": \"0x1111111111111111111111111111111111111111\",\n          \"amount\": \"1000000000000000000\"\n        },\n        \"spender\": \"0x2222222222222222222222222222222222222222\",\n        \"nonce\": \"1788217200123\",\n        \"deadline\": \"1788220800\",\n        \"witness\": {\n          \"reactor\": \"0x3333333333333333333333333333333333333333\",\n          \"executor\": \"0x4444444444444444444444444444444444444444\",\n          \"exchange\": {\n            \"adapter\": \"0x8888888888888888888888888888888888888888\",\n            \"ref\": \"0x9999999999999999999999999999999999999999\",\n            \"share\": 0,\n            \"data\": \"0x\"\n          },\n          \"swapper\": \"0x5555555555555555555555555555555555555555\",\n          \"nonce\": \"1788217200123\",\n          \"start\": \"1788217200\",\n          \"deadline\": \"1788220800\",\n          \"chainid\": 137,\n          \"exclusivity\": 0,\n          \"epoch\": 300,\n          \"slippage\": 100,\n          \"freshness\": 60,\n          \"input\": {\n            \"token\": \"0x1111111111111111111111111111111111111111\",\n            \"amount\": \"100000000000000000\",\n            \"maxAmount\": \"1000000000000000000\"\n          },\n          \"output\": {\n            \"token\": \"0x6666666666666666666666666666666666666666\",\n            \"limit\": \"250000000\",\n            \"triggerLower\": \"0\",\n            \"triggerUpper\": \"0\",\n            \"recipient\": \"0x5555555555555555555555555555555555555555\"\n          }\n        }\n      },\n      \"signature\": \"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc1b\",\n      \"timestamp\": \"2026-08-23T09:00:00.000Z\"\n    }\n  ],\n  \"page\": 1,\n  \"limit\": 50,\n  \"total\": 1,\n  \"totalPages\": 1\n}",
        "kind": "response",
        "language": "json",
        "name": "response.json"
      }
    ],
    "help": "Fetch orders for the connected wallet and chain. The exchange address comes from the trusted base configuration.",
    "label": "Interactive HTTP Reference",
    "purpose": "Load order history for the connected owner and configured adapter.",
    "title": "Fetch Order History"
  },
  "advanced-orders-direct:cancel-order-sink-orders": {
    includePartnerContextFile: false,
    "files": [
      {
        "code": "import { parseAbi } from \"viem\";\nimport type { Hash } from \"viem\";\n\nimport type { OrderResponse, PermitData, WalletContext } from \"./order-types\";\n\nconst ORDERS_SINK_URL = \"https://order-sink-v2.orbs.network\";\n// Use your DEX partner ID if Orbs provided one; otherwise use \"unknown\".\nconst partner = \"unknown\";\n// RePermit accepts one or more order digests, hence the bytes32[] argument.\nconst cancelAbi = parseAbi([\"function cancel(bytes32[] digests)\"]);\n\n// Pass the complete selected history item to access its RePermit digest.\nexport async function cancelOrdersSinkOrder(\n  order: OrderResponse,\n  { account, chainId, publicClient, walletClient }: WalletContext,\n): Promise<Hash> {\n  // 1. Resolve the trusted RePermit contract for the wallet's active chain.\n  // Never accept this contract address from editable UI input.\n  const permitDataResponse = await fetchRePermitData(chainId);\n\n  // 2. Call cancel with an array containing the selected order's digest.\n  const hash = await walletClient.writeContract({\n    address: permitDataResponse.domain.verifyingContract,\n    abi: cancelAbi,\n    functionName: \"cancel\",\n    args: [[order.metadata.repermitDigest]],\n    account,\n    chain: walletClient.chain,\n  });\n\n  // 3. Wait for confirmation, then refresh the service-owned order status\n  // from whatever data layer the host uses for history.\n  const receipt = await publicClient.waitForTransactionReceipt({ hash });\n  if (receipt.status !== \"success\") throw new Error(\"Order cancellation reverted\");\n  return hash;\n}\n\nasync function fetchRePermitData(chainId: number): Promise<PermitData> {\n  const query = new URLSearchParams({ partner, chain: String(chainId) });\n  const response = await fetch(\n    ORDERS_SINK_URL + \"/config?\" + query,\n    { headers: { Accept: \"application/json\" } },\n  );\n  if (!response.ok) {\n    throw new Error(\"Failed to fetch RePermit data (\" + response.status + \")\");\n  }\n\n  return (await response.json()) as PermitData;\n}",
        "language": "typescript",
        "name": "cancel-order.ts"
      },
      {
        "code": "import type { PublicClient, WalletClient } from \"viem\";\n\n// Ethereum-compatible addresses and hex values used by viem.\nexport type Address = `0x${string}`;\nexport type Hex = `0x${string}`;\n\n// Complete 65-byte EIP-712 signature returned by the wallet. Keep it intact;\n// POST /orders/new accepts the regular hex signature, not separate v/r/s fields.\nexport type Signature = Hex;\n\n// Everything the order flows need from the host's wallet layer. These are viem\n// types, so any host can supply them: wagmi's usePublicClient() and\n// useWalletClient().data return exactly these clients.\nexport type WalletContext = {\n  account: Address;\n  chainId: number;\n  publicClient: PublicClient;\n  walletClient: WalletClient;\n};\n\n// Derived swap data owned by the host DEX's form and state layer.\nexport type OrderInput = {\n  inputToken: {\n    address: Address;\n  };\n  dstToken: Address;\n  sourceIsNative: boolean;\n  totalInputAmount: string;\n  srcAmountPerFill: string;\n  dstMinAmountPerFill: string;\n  deadlineMillis: number;\n  fillDelayMillis: number;\n  totalTrades: number;\n  slippageBps: number;\n  // Omit to use the protocol's normal 60-second freshness window.\n  freshnessSeconds?: number;\n  triggerLower: string;\n  triggerUpper: string;\n};\n\n// The exact EIP-712 message signed by the wallet and submitted to Orders Sink.\n// Numeric uint values are strings when they can exceed JavaScript's safe range.\nexport type PermitOrder = {\n  // Permit scope: the ERC-20 token and total amount authorized by this signature.\n  permitted: {\n    // Use an ERC-20 address. Native input is unsupported, so use WToken instead.\n    token: Address;\n    // Maximum total amount the permit may transfer, in token base units.\n    amount: string;\n  };\n  // Signed reactor spender returned by GET /config. ERC-20 allowance instead\n  // targets domain.verifyingContract (RePermit).\n  spender: Address;\n  // Fresh nonce generated once for both the permit and its witness.\n  nonce: string;\n  // Permit expiry as Unix seconds. Expired orders cannot execute.\n  deadline: string;\n  // Strategy-specific data covered by the same wallet signature.\n  witness: {\n    // Protocol reactor returned by GET /config.\n    reactor: Address;\n    // Protocol executor returned by GET /config.\n    executor: Address;\n    // Exchange integration selected by the trusted partner configuration.\n    exchange: {\n      // Adapter used to execute the swap.\n      adapter: Address;\n      // Optional referral address.\n      ref: Address;\n      // Server-configured uint32 fee/referral share; preserve it unchanged.\n      share: number;\n      // Optional adapter-specific calldata; use 0x when empty.\n      data: Hex;\n    };\n    // Wallet that owns the input tokens and signs the typed data.\n    swapper: Address;\n    // Same value as the top-level permit nonce.\n    nonce: string;\n    // Earliest Unix-second timestamp at which execution may begin.\n    start: string;\n    // Latest Unix-second timestamp at which the order may execute.\n    deadline: string;\n    // Must match the connected wallet and EIP-712 domain chain IDs.\n    chainid: number;\n    // Protocol exclusivity setting returned by GET /config unless customized.\n    exclusivity: number;\n    // Minimum interval between eligible fills, in seconds.\n    epoch: number;\n    // Allowed execution slippage in basis points (100 = 1%).\n    slippage: number;\n    // Maximum quote/price age accepted by the strategy, in seconds.\n    freshness: number;\n    // Per-fill input constraints.\n    input: {\n      // Must match permitted.token; use WToken when the UI selected native input.\n      token: Address;\n      // Desired input per fill, in token base units.\n      amount: string;\n      // Maximum input available across fills, in token base units.\n      maxAmount: string;\n    };\n    // Per-fill output constraints.\n    output: {\n      // ERC-20 token the strategy should receive.\n      token: Address;\n      // Minimum output accepted per fill, in output-token base units.\n      limit: string;\n      // Lower trigger boundary. Use \"0\" when the strategy does not use it.\n      triggerLower: string;\n      // Upper trigger boundary. Use \"0\" when the strategy does not use it.\n      triggerUpper: string;\n      // Address that receives output tokens; commonly the connected wallet.\n      recipient: Address;\n    };\n  };\n};\n\n// One field declaration in the EIP-712 type map returned by GET /config.\nexport type TypedDataField = {\n  name: string;\n  type: string;\n};\n\n// Trusted protocol configuration used as the base for the local order.\nexport type PermitData = {\n  // EIP-712 domain; never silently replace these values with user input.\n  domain: {\n    name: string;\n    version: string;\n    chainId: number;\n    // RePermit contract and ERC-20 approval spender.\n    verifyingContract: Address;\n  };\n  // Base order containing protocol contract and exchange fields.\n  order: PermitOrder;\n  // Root EIP-712 type used when requesting the wallet signature.\n  primaryType: \"RePermitWitnessTransferFrom\";\n  // Full EIP-712 type definitions supplied by the service.\n  types: Record<string, TypedDataField[]>;\n  // Partner identifier applied by Orders Sink, when present.\n  partner?: string;\n};\n\n// Exact request body sent to POST /orders/new after signing.\nexport type SignedOrder = {\n  signature: Signature;\n  // This must be the same object used as signTypedData's message.\n  order: PermitOrder;\n  // New orders always enter the service as pending.\n  status: \"pending\";\n};\n\n// Service-managed execution details returned with an order.\nexport type OrderMetadata = {\n  // Execution chunks already processed by the strategy.\n  chunks?: unknown[];\n  // Total number of fills expected by the strategy.\n  expectedChunks: number;\n  // ISO timestamp of the last price evaluation.\n  lastPriceCheck: string;\n  // ISO timestamp at which another fill may become eligible.\n  nextEligibleTime: string;\n  // Service status such as pending, completed, or cancelled.\n  status: string;\n  // Human-readable strategy summary for display.\n  description: string;\n  // Display-only USD price; never use it for execution math.\n  displayOnlyInputTokenPriceUSD: string;\n  // On-chain digest passed to cancel(bytes32[] digests).\n  repermitDigest: Hex;\n};\n\n// Raw order shape returned by Orders Sink.\nexport type OrderResponse = {\n  // Orders Sink identifier for this signed order.\n  hash: Hex;\n  metadata: OrderMetadata;\n  // The message originally signed and submitted.\n  order: PermitOrder;\n  signature: Signature;\n  // ISO creation timestamp assigned by the service.\n  timestamp: string;\n};\n\n// The create endpoint returns either the created order or an API error.\nexport type CreateOrderResponse =\n  | {\n      success: true;\n      signedOrder: OrderResponse;\n    }\n  | {\n      success: false;\n      message?: string;\n      code?: string | number;\n    };\n\n// Filters required by the order-history endpoint.\nexport type FetchOrdersQuery = {\n  // Wallet whose orders should be returned.\n  swapper: Address;\n  // Network on which those orders execute.\n  chainId: number;\n  // Exchange adapter from the partner's GET /config response.\n  exchange: Address;\n};\n\n// Response body returned by the order-history endpoint.\nexport type FetchOrdersResponse = {\n  orders: OrderResponse[];\n  page: number;\n  limit: number;\n  total: number;\n  totalPages: number;\n};",
        "language": "typescript",
        "name": "order-types.ts"
      }
    ],
    "help": "Cancel a RePermit order on-chain using order.metadata.repermitDigest, then wait for the transaction receipt.",
    "label": "Optional Wagmi v3 Reference",
    "purpose": "Verify ownership and chain, submit the on-chain digest cancellation, then refresh history.",
    "title": "Cancel Order Example"
  },
} as const satisfies Record<string, ReferenceExample>;

export const REFERENCE_EXAMPLES = {
  ...REFERENCE_EXAMPLES_BASE,
  "liquidity-hub:fetch-quote": {
    format: "request-response",
    includePartnerContextFile: false,
    files: [
      {
        code: LIQUIDITY_HUB_SDK_QUOTE_REQUEST_CODE,
        kind: "request",
        language: "typescript",
        method: "POST",
        name: "Request",
      },
      {
        code: LIQUIDITY_HUB_SDK_QUOTE_RESPONSE_CODE,
        kind: "response",
        language: "json",
        name: "Response",
      },
    ],
    help: "The Request tab uses the active-chain client and calls getQuote() with QuoteArgs. The Response tab shows the complete wallet-bound quote, including wallet-ready eip712, legacy permitData, pricing metadata, and the SDK timestamp.",
    label: "SDK Request / Response",
    purpose: "Fetch and validate a wallet-bound Liquidity Hub candidate without blocking the host DEX quote.",
    title: "Fetch Quote",
  },
  "liquidity-hub:submit-swap": {
    includePartnerContextFile: false,
    files: [
      {
        code: LIQUIDITY_HUB_SDK_FULL_FLOW_CODE,
        language: "typescript",
        name: "submit-swap.ts",
      },
    ],
    help: "The TypeScript reference contains the complete execution flow: prepare funds, refresh and sign the quote, submit it, and return the successful transaction receipt.",
    label: "SDK Submit Swap",
    purpose: "Prepare, sign, submit, and confirm the selected Liquidity Hub route.",
    title: "Submit Swap",
  },
} as const satisfies Record<string, ReferenceExample>;

export type ReferenceExampleKey = keyof typeof REFERENCE_EXAMPLES;

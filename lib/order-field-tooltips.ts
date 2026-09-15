const FIELD_HELP: Readonly<Record<string, string>> = {
  permitted: "Token and maximum total amount authorized by the wallet signature.",
  "permitted.token": "ERC-20 source-token address. For native input, this is the wrapped-token address.",
  "permitted.amount": "Total source amount authorized across all fills, as an integer string in source-token base units.",
  spender: "Order spender supplied by the configuration. ERC-20 approval uses domain.verifyingContract (RePermit) instead.",
  nonce: "Unique identifier for this order's permit. The witness uses the same nonce.",
  deadline: "Permit expiry as a Unix timestamp in seconds, converted from deadlineMillis.",
  witness: "Order execution details included in the EIP-712 signature.",
  "witness.reactor": "Reactor contract from the fetched configuration that executes the order.",
  "witness.executor": "Executor address supplied by the fetched configuration.",
  "witness.exchange": "Exchange routing and fee settings copied from the partner configuration.",
  "witness.exchange.adapter": "Exchange adapter contract from the partner configuration.",
  "witness.exchange.ref": "Referral address from the partner configuration. Preserve the returned value.",
  "witness.exchange.share": "Protocol fee-share value from the partner configuration. Preserve it unchanged.",
  "witness.exchange.data": "Encoded exchange-specific data from the configuration. Preserve it unchanged.",
  "witness.swapper": "Wallet that owns and signs the order.",
  "witness.nonce": "The same unique nonce used by the outer permit.",
  "witness.start": "Earliest execution time as a Unix timestamp in seconds.",
  "witness.deadline": "Order expiry in Unix seconds. Matches the outer permit deadline.",
  "witness.chainid": "Network ID for the order. Must match the wallet network and signing domain.",
  "witness.exclusivity": "Execution exclusivity setting supplied by the configuration. Preserve it unchanged.",
  "witness.epoch": "Interval between TWAP fills in seconds. Zero for a single trade.",
  "witness.slippage": "Slippage tolerance in basis points: 50 means 0.5%, and 100 means 1%.",
  "witness.freshness": "Maximum execution price-data age in seconds. Defaults to 60.",
  "witness.input": "Source-token amounts for each fill and the complete order.",
  "witness.input.token": "Resolved source-token address, using the wrapped token for native input.",
  "witness.input.amount": "Source amount spent in one fill, in source-token base units.",
  "witness.input.maxAmount": "Maximum total source amount across all fills, in source-token base units.",
  "witness.output": "Destination token, per-fill conditions, and recipient.",
  "witness.output.token": "ERC-20 destination token the user receives.",
  "witness.output.limit": "Minimum destination amount for one fill, in destination-token base units. Zero means no fixed limit.",
  "witness.output.triggerLower": "Stop-loss trigger output amount per fill, in destination-token base units. Zero disables this trigger.",
  "witness.output.triggerUpper": "Take-profit trigger output amount per fill, in destination-token base units. Zero disables this trigger.",
  "witness.output.recipient": "Wallet receiving the output tokens; this example uses the order owner.",
};

/** Match only keys inside this example's order literal, including shorthand keys. */
export function getOrderFieldTooltips(code: string): Map<number, { key: string; description: string }> {
  const result = new Map<number, { key: string; description: string }>();
  const parents: string[] = [];
  let insideOrder = false;
  code.split("\n").forEach((line, index) => {
    if (line.trim() === "const order = {") {
      insideOrder = true;
      return;
    }
    if (!insideOrder) return;
    if (line.includes("satisfies PermitOrder")) {
      insideOrder = false;
      return;
    }
    if (/^\s*},?\s*$/.test(line)) {
      parents.pop();
      return;
    }
    const match = line.match(/^\s*([a-zA-Z]+)\s*[:,]/);
    if (!match) return;
    const key = match[1];
    const description = FIELD_HELP[[...parents, key].join(".")];
    if (description) result.set(index, { key, description });
    if (line.trimEnd().endsWith("{")) parents.push(key);
  });
  return result;
}

const CONFIG_HELP: Readonly<Record<string, string>> = {
  domain: "EIP-712 signing domain returned by the service. Pass it unchanged to the wallet.",
  "domain.chainId": "Network ID for this configuration. Use the same network for the wallet and order.",
  "domain.name": "Protocol name used in the EIP-712 domain. Preserve the returned name.",
  "domain.version": "Protocol signing version. Preserve this value when signing.",
  "domain.verifyingContract": "RePermit contract that verifies the signature. ERC-20 allowance is granted to this address.",
  order: "Base order template. Preserve protocol settings and populate the user's tokens, amounts, nonce, and timing before signing.",
  partner: "Partner name resolved by the service for this configuration.",
  primaryType: "Root EIP-712 type to sign. Pass this together with domain, types, and the populated order.",
  types: "EIP-712 struct definitions. Preserve every field's name, type, and ordering exactly as returned.",
};

/** Response examples use pretty-printed JSON; indentation identifies each key's path. */
export function getConfigFieldTooltips(code: string): Map<number, { key: string; description: string }> {
  const result = new Map<number, { key: string; description: string }>();
  const parents: { key: string; indent: number }[] = [];
  code.split("\n").forEach((line, index) => {
    const match = line.match(/^(\s*)"([^"]+)"\s*:\s*(.*)$/);
    if (!match) return;
    const [, whitespace, key, value] = match;
    const indent = whitespace.length;
    while (parents.length && parents[parents.length - 1].indent >= indent) parents.pop();
    const path = [...parents.map((parent) => parent.key), key].join(".");
    let description: string | undefined = CONFIG_HELP[path];
    if (path.startsWith("order.")) {
      description = FIELD_HELP[path.slice("order.".length)];
      if (description) description += " This is a template; populate user-specific fields before signing.";
    }
    if (path === "types" || path.startsWith("types.")) description = undefined;
    if (description) result.set(index, { key: `"${key}"`, description });
    if (value === "{" || value === "[") parents.push({ key, indent });
  });
  return result;
}

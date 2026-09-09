import type { GuideId } from "@/lib/guides";
import type {
  ReferenceExample,
  ReferenceFile,
} from "@/lib/reference-examples";

const ORDERS_SINK_CONFIG_URL =
  "https://order-sink-v2.orbs.network/config";
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const CHAIN_ID_PATTERN = /^[1-9][0-9]*$/;
const HEX_PATTERN = /^0x(?:[0-9a-fA-F]{2})*$/;
const PARTNER_PATTERN = /^[a-zA-Z0-9._ -]+$/;
const PARTNER_SEPARATOR_PATTERN = /[\s._-]+/g;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const PARTNER_ENUM_BY_ID: Readonly<Record<string, string>> = {
  agent: "Partners.Agent",
  arbidex: "Partners.Arbidex",
  blackhole: "Partners.Blackhole",
  chronos: "Partners.Chronos",
  dragon: "Partners.Dragon",
  ef: "Partners.EfficientFrontier",
  efficientfrontier: "Partners.EfficientFrontier",
  ginco: "Partners.Ginco",
  ht: "Partners.HtDigital",
  htdigital: "Partners.HtDigital",
  katana: "Partners.Katana",
  kodiak: "Partners.Kodiak",
  lynex: "Partners.Lynex",
  nami: "Partners.Nami",
  newera: "Partners.Newera",
  omni: "Partners.Omni",
  pancake: "Partners.Pancake",
  pangolin: "Partners.Pangolin",
  quick: "Partners.Quick",
  quickswap: "Partners.Quick",
  ramses: "Partners.Ramses",
  ring: "Partners.Ring",
  shadow: "Partners.Shadow",
  spark: "Partners.Spark",
  spooky: "Partners.Spooky",
  sushiswap: "Partners.Sushiswap",
  swapx: "Partners.Swapx",
  teafi: "Partners.Teafi",
  thena: "Partners.Thena",
  unknown: "Partners.Unknown",
  utila: "Partners.Utila",
  yowie: "Partners.Yowie",
};

const DIRECT_API_PLACEHOLDERS = {
  adapter: "0x8888888888888888888888888888888888888888",
  executor: "0x4444444444444444444444444444444444444444",
  reactor: "0x3333333333333333333333333333333333333333",
  ref: "0x9999999999999999999999999999999999999999",
  rePermit: "0x7777777777777777777777777777777777777777",
  spender: "0x2222222222222222222222222222222222222222",
} as const;

export interface PartnerDocumentationRequest {
  chainId: number;
  partner: string;
}

export interface PartnerDocumentationConfig {
  addresses: {
    adapter: string;
    executor: string;
    reactor: string;
    ref: string;
    rePermit: string;
    spender: string;
  };
  chainId: number;
  exchange: {
    data: string;
    share: number;
  };
  partner: string;
  requestedPartner: string;
}

export type PartnerDocumentationQuery =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "valid"; request: PartnerDocumentationRequest };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Partner configuration is missing ${field}`);
  }
  return value;
}

function requireAddress(
  value: unknown,
  field: string,
  allowZero = false,
): string {
  if (
    typeof value !== "string" ||
    !ADDRESS_PATTERN.test(value) ||
    (!allowZero && value.toLowerCase() === ZERO_ADDRESS)
  ) {
    throw new Error(`Partner configuration has an invalid ${field} address`);
  }
  return value;
}

function requireChainId(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`Partner configuration has an invalid ${field}`);
  }
  return Number(value);
}

function requirePartner(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 80 ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new Error("Partner configuration has an invalid partner name");
  }
  return value.trim();
}

function normalizePartner(value: string): string {
  return value.toLowerCase().replace(PARTNER_SEPARATOR_PATTERN, "");
}

function requireShare(value: unknown): number {
  if (
    !Number.isInteger(value) ||
    Number(value) < 0 ||
    Number(value) > 4_294_967_295
  ) {
    throw new Error("Partner configuration has an invalid exchange share");
  }
  return Number(value);
}

function requireHex(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length > 4_098 ||
    !HEX_PATTERN.test(value)
  ) {
    throw new Error(`Partner configuration has invalid ${field}`);
  }
  return value;
}

export function parsePartnerDocumentationQuery(
  partnerValue: string | null,
  chainIdValue: string | null,
): PartnerDocumentationQuery {
  if (partnerValue === null && chainIdValue === null) return { kind: "none" };
  if (partnerValue === null || chainIdValue === null) return { kind: "invalid" };

  const partner = partnerValue.trim();
  if (
    !partner ||
    partner.length > 80 ||
    !PARTNER_PATTERN.test(partner) ||
    !CHAIN_ID_PATTERN.test(chainIdValue)
  ) {
    return { kind: "invalid" };
  }

  const chainId = Number(chainIdValue);
  if (!Number.isSafeInteger(chainId)) return { kind: "invalid" };
  return { kind: "valid", request: { chainId, partner } };
}

export async function fetchPartnerDocumentationConfig(
  request: PartnerDocumentationRequest,
  signal?: AbortSignal,
): Promise<PartnerDocumentationConfig> {
  const query = new URLSearchParams({
    chain: String(request.chainId),
    partner: request.partner,
  });
  const response = await fetch(`${ORDERS_SINK_CONFIG_URL}?${query}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Partner configuration request failed (${response.status})`);
  }

  const body: unknown = await response.json();
  const root = requireRecord(body, "response body");
  const domain = requireRecord(root.domain, "domain");
  const order = requireRecord(root.order, "order");
  const witness = requireRecord(order.witness, "order.witness");
  const exchange = requireRecord(witness.exchange, "order.witness.exchange");
  const domainChainId = requireChainId(domain.chainId, "domain.chainId");
  const witnessChainId = requireChainId(witness.chainid, "order.witness.chainid");
  const resolvedPartner = requirePartner(root.partner);

  if (
    domainChainId !== request.chainId ||
    witnessChainId !== request.chainId
  ) {
    throw new Error("Partner configuration does not match the requested chain");
  }

  if (normalizePartner(resolvedPartner) !== normalizePartner(request.partner)) {
    throw new Error(
      `Orders Sink resolved ${resolvedPartner} instead of ${request.partner}`,
    );
  }

  return {
    addresses: {
      adapter: requireAddress(exchange.adapter, "exchange adapter"),
      executor: requireAddress(witness.executor, "executor"),
      reactor: requireAddress(witness.reactor, "reactor"),
      ref: requireAddress(exchange.ref, "exchange referral", true),
      rePermit: requireAddress(domain.verifyingContract, "RePermit"),
      spender: requireAddress(order.spender, "spender"),
    },
    chainId: domainChainId,
    exchange: {
      data: requireHex(exchange.data, "exchange data"),
      share: requireShare(exchange.share),
    },
    partner: resolvedPartner,
    requestedPartner: request.partner,
  };
}

function replaceAll(code: string, replacements: ReadonlyMap<string, string>): string {
  let result = code;
  for (const [from, to] of replacements) result = result.replaceAll(from, to);
  return result;
}

export function personalizeDocumentationMarkdown(
  markdown: string,
  config: PartnerDocumentationConfig,
): string {
  const partnerDeclaration = `const partner = ${JSON.stringify(config.requestedPartner)};`;
  const partnerJson = `"partner": ${JSON.stringify(config.requestedPartner)}`;
  const partnerEnum =
    PARTNER_ENUM_BY_ID[normalizePartner(config.requestedPartner)] ??
    PARTNER_ENUM_BY_ID[normalizePartner(config.partner)];
  return replaceAll(
    markdown,
    new Map([
      [
        'const partner = "unknown"; // Replace with the partner name supplied by Orbs.',
        partnerDeclaration,
      ],
      ['const partner = "unknown";', partnerDeclaration],
      ...(partnerEnum
        ? [["const partner = Partners.Unknown;", `const partner = ${partnerEnum};`] as const]
        : []),
      ['"partner": "unknown"', partnerJson],
      ["example-session_137", `example-session_${config.chainId}`],
    ]),
  );
}

function createPartnerContextFile(
  guideId: GuideId,
  config: PartnerDocumentationConfig,
): ReferenceFile {
  const context = {
    chainId: config.chainId,
    partner: config.requestedPartner,
    partnerName: config.partner,
    ...(guideId === "advanced-orders-direct"
      ? {
          ordersSink: {
            addresses: config.addresses,
            exchange: config.exchange,
          },
        }
      : {}),
  };

  return {
    code: JSON.stringify(context, null, 2),
    language: "json",
    name: "partner-context.json",
  };
}

export function personalizeReferenceExample(
  guideId: GuideId,
  example: ReferenceExample,
  config: PartnerDocumentationConfig,
): ReferenceExample {
  const partnerEnum =
    PARTNER_ENUM_BY_ID[normalizePartner(config.requestedPartner)] ??
    PARTNER_ENUM_BY_ID[normalizePartner(config.partner)];
  const commonReplacements = new Map<string, string>([
    ["const chainId = 137;", `const chainId = ${config.chainId};`],
    ["chain: \"137\"", `chain: \"${config.chainId}\"`],
    ["chainId: \"137\"", `chainId: \"${config.chainId}\"`],
    ["\"chain\": 137", `\"chain\": ${config.chainId}`],
    ["\"chainId\": 137", `\"chainId\": ${config.chainId}`],
    ["\"chainid\": 137", `\"chainid\": ${config.chainId}`],
    ["chainId=137", `chainId=${config.chainId}`],
    ["example-session_137", `example-session_${config.chainId}`],
  ]);

  if (guideId === "advanced-orders-direct") {
    commonReplacements.set(
      DIRECT_API_PLACEHOLDERS.adapter,
      config.addresses.adapter,
    );
    commonReplacements.set(
      DIRECT_API_PLACEHOLDERS.executor,
      config.addresses.executor,
    );
    commonReplacements.set(
      DIRECT_API_PLACEHOLDERS.reactor,
      config.addresses.reactor,
    );
    commonReplacements.set(DIRECT_API_PLACEHOLDERS.ref, config.addresses.ref);
    commonReplacements.set(
      DIRECT_API_PLACEHOLDERS.rePermit,
      config.addresses.rePermit,
    );
    commonReplacements.set(
      DIRECT_API_PLACEHOLDERS.spender,
      config.addresses.spender,
    );
    commonReplacements.set(
      "\"share\": 0",
      `\"share\": ${config.exchange.share}`,
    );
    commonReplacements.set(
      "\"data\": \"0x\"",
      `\"data\": \"${config.exchange.data}\"`,
    );
  }

  const files = example.files.map((file) => {
    const partner =
      file.kind === "response" ? config.partner : config.requestedPartner;
    const fileReplacements = new Map(commonReplacements);
    fileReplacements.set(
      "const partner = \"unknown\";",
      `const partner = ${JSON.stringify(partner)};`,
    );
    fileReplacements.set(
      'LIQUIDITY_HUB_PARTNER = "unknown"',
      `LIQUIDITY_HUB_PARTNER = ${JSON.stringify(partner)}`,
    );
    if (partnerEnum) {
      fileReplacements.set(
        "const partner = Partners.Unknown;",
        `const partner = ${partnerEnum};`,
      );
    }
    fileReplacements.set(
      "partner: \"unknown\"",
      `partner: ${JSON.stringify(partner)}`,
    );
    fileReplacements.set(
      "\"partner\": \"unknown\"",
      `\"partner\": ${JSON.stringify(partner)}`,
    );
    return {
      ...file,
      code: replaceAll(file.code, fileReplacements),
      ...(file.curl
        ? { curl: replaceAll(file.curl, fileReplacements) }
        : {}),
    };
  });

  return {
    ...example,
    files:
      example.includePartnerContextFile === false
        ? files
        : [...files, createPartnerContextFile(guideId, config)],
  };
}

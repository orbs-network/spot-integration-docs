import type { GuideId } from "@/lib/guides";
import type { ReferenceExampleKey } from "@/lib/reference-examples";

const REFERENCE_KEYS = {
  "liquidity-hub-direct:fetch-quote": true,
  "liquidity-hub-direct:submit-swap": true,
  "advanced-orders-direct:cancel-order-sink-orders": true,
  "advanced-orders-direct:create-order": true,
  "advanced-orders-direct:fetch-order-sink-orders": true,
  "liquidity-hub:fetch-quote": true,
  "liquidity-hub:submit-swap": true,
} as const satisfies Record<ReferenceExampleKey, true>;

export function hasReferenceExample(guideId: GuideId, stepId: string): boolean {
  return Object.hasOwn(REFERENCE_KEYS, `${guideId}:${stepId}`);
}

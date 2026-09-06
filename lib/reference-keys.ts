import type { GuideId } from "@/lib/guides";
import type { ReferenceExampleKey } from "@/lib/reference-examples";

const REFERENCE_KEYS = {
  "advanced-orders-direct:cancel-order-sink-orders": true,
  "advanced-orders-direct:create-order": true,
  "advanced-orders-direct:fetch-order-sink-orders": true,
  "advanced-orders-direct:fetch-partner-config": true,
  "advanced-orders-react:advanced-orders-provider": true,
  "liquidity-hub:execute-the-full-flow": true,
  "liquidity-hub:request-quotes": true,
} as const satisfies Record<ReferenceExampleKey, true>;

export function hasReferenceExample(guideId: GuideId, stepId: string): boolean {
  return Object.hasOwn(REFERENCE_KEYS, `${guideId}:${stepId}`);
}

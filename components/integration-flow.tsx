import { ArrowRight } from "lucide-react";

import type { GuideProductId } from "@/lib/guides";

interface FlowStep {
  owner: string;
  title: string;
  detail: string;
}

const FLOWS: Record<GuideProductId, {
  title: string;
  note: string;
  steps: readonly FlowStep[];
}> = {
  "liquidity-hub": {
    title: "How a swap completes",
    note: "Wrap and approve only when needed. Show success after the swap receipt confirms—not after signing or receiving a transaction hash.",
    steps: [
      { owner: "Your app", title: "Get a quote", detail: "Choose tokens and amount. Request a current quote." },
      { owner: "Your app", title: "Select the route", detail: "Compare protected output if you also use a DEX router." },
      { owner: "Wallet", title: "Prepare & sign", detail: "Wrap or approve if needed. Refresh a stale quote, then sign." },
      { owner: "Liquidity Hub", title: "Submit the swap", detail: "Send the signed quote and obtain its transaction hash." },
      { owner: "Your app · RPC", title: "Confirm success", detail: "Wait for a successful receipt, then refresh balances." },
    ],
  },
  "advanced-orders": {
    title: "How an order progresses",
    note: "Submission creates an order; fills can happen later. Cancelling the remaining trades requires a wallet transaction.",
    steps: [
      { owner: "Your app", title: "Define the order", detail: "Set tokens, amount, and time or price conditions." },
      { owner: "Wallet", title: "Prepare & sign", detail: "Wrap or approve if needed, then sign the order." },
      { owner: "Order Sink", title: "Accept the order", detail: "Submit the signed order and retain its identifier." },
      { owner: "Your app · Solvers", title: "Track execution", detail: "Show fills as the order’s conditions are met." },
      { owner: "On-chain", title: "Fill or cancel", detail: "Finish the trades, or cancel what remains while open." },
    ],
  },
};

export function IntegrationFlow({ product }: { product: GuideProductId }) {
  const flow = FLOWS[product];

  return (
    <figure className="integration-flow" aria-label={flow.title}>
      <figcaption>{flow.title}</figcaption>
      <ol className="integration-flow-steps" role="list">
        {flow.steps.map((step, index) => (
          <li className="integration-flow-step" key={step.title}>
            <span className="integration-flow-owner">{step.owner}</span>
            <strong>{step.title}</strong>
            <p>{step.detail}</p>
            {index < flow.steps.length - 1 ? (
              <ArrowRight aria-hidden="true" className="integration-flow-arrow" size={18} />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="integration-flow-note">{flow.note}</p>
    </figure>
  );
}

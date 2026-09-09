"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";

import {
  fetchPartnerDocumentationConfig,
  parsePartnerDocumentationQuery,
  type PartnerDocumentationConfig,
  type PartnerDocumentationRequest,
} from "@/features/partner-documentation/partner-documentation";
import {
  normalizePartnerDocumentationLocation,
  partnerDocumentationSearchParams,
} from "@/features/partner-documentation/query-state";

export type PartnerDocumentationState =
  | { kind: "none" }
  | { kind: "loading"; request: PartnerDocumentationRequest }
  | {
      config: PartnerDocumentationConfig;
      kind: "ready";
      request: PartnerDocumentationRequest;
    };

type SettledRequest =
  | {
      config: PartnerDocumentationConfig;
      key: string;
      kind: "ready";
    }
  | { key: string; kind: "error" };

function getRequestKey(partner: string, chainId: number): string {
  return `${partner}:${chainId}`;
}

export function usePartnerDocumentation(): PartnerDocumentationState {
  const [{ chainId, partner }, setPartnerQuery] = useQueryStates(
    partnerDocumentationSearchParams,
    { history: "replace", shallow: true },
  );
  const query = useMemo(
    () => parsePartnerDocumentationQuery(partner, chainId),
    [chainId, partner],
  );
  const [settledRequest, setSettledRequest] = useState<SettledRequest>();
  const requestPartner = query.kind === "valid" ? query.request.partner : null;
  const requestChainId = query.kind === "valid" ? query.request.chainId : null;
  const requestKey =
    requestPartner && requestChainId
      ? getRequestKey(requestPartner, requestChainId)
      : "";

  useEffect(() => {
    const normalizedHref = normalizePartnerDocumentationLocation(
      window.location.href,
    );
    if (!normalizedHref) return;

    window.history.replaceState(window.history.state, "", normalizedHref);
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: window.history.state }),
    );
  }, []);

  useEffect(() => {
    if (query.kind === "invalid") void setPartnerQuery(null);
  }, [query.kind, setPartnerQuery]);

  useEffect(() => {
    if (!requestPartner || !requestChainId) return;

    const controller = new AbortController();
    let active = true;
    const request = { chainId: requestChainId, partner: requestPartner };

    void fetchPartnerDocumentationConfig(request, controller.signal).then(
      (config) => {
        if (active) setSettledRequest({ config, key: requestKey, kind: "ready" });
      },
      () => {
        if (!active || controller.signal.aborted) return;
        setSettledRequest({ key: requestKey, kind: "error" });
        void setPartnerQuery(null);
      },
    );

    return () => {
      active = false;
      controller.abort();
    };
  }, [requestChainId, requestKey, requestPartner, setPartnerQuery]);

  if (query.kind !== "valid") return { kind: "none" };
  if (!settledRequest || settledRequest.key !== requestKey) {
    return { kind: "loading", request: query.request };
  }
  if (settledRequest.kind === "error") return { kind: "none" };
  return {
    config: settledRequest.config,
    kind: "ready",
    request: query.request,
  };
}

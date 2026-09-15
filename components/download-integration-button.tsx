"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import type { Guide } from "@/lib/guides";
import type { PartnerDocumentationConfig } from "@/features/partner-documentation/partner-documentation";

export function DownloadIntegrationButton({guide, partnerConfig}: {guide: Guide; partnerConfig?: PartnerDocumentationConfig}) {
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  if (guide.id.endsWith("-shared")) return null;
  const download = async () => {
    setStatus("loading");
    try {
      const [{buildIntegrationTypeScript}, response] = await Promise.all([
        import("@/lib/integration-download"),
        fetch(`/${guide.product}/shared.md`),
      ]);
      if (!response.ok) throw new Error("Shared reference unavailable");
      const sourceText = await buildIntegrationTypeScript(guide, await response.text(), window.location.href, partnerConfig);
      const url = URL.createObjectURL(new Blob([sourceText], {type: "text/plain;charset=utf-8"}));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${guide.id}-integration.${guide.id === "advanced-orders-react" ? "tsx" : "ts"}`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("idle");
    } catch { setStatus("failed"); }
  };
  return <button aria-label={status === "loading" ? "Preparing integration download" : status === "failed" ? "Download failed, retry integration download" : "Download integration"} title="Download the full integration as a TypeScript source reference" className="page-action-primary integration-download" type="button" disabled={status === "loading"} onClick={() => void download()}>
    <Download aria-hidden="true" size={14} />
    <span>{status === "loading" ? "Preparing file…" : status === "failed" ? "Retry integration download" : "Download integration"}</span>
  </button>;
}

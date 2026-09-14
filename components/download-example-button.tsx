"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { downloadExample, type DownloadFile } from "@/lib/example-download";

export function DownloadExampleButton({ files, name = "example" }: {
  files: readonly DownloadFile[];
  name?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      className="code-action download-example"
      type="button"
      aria-label={failed ? "Download failed, retry example download" : "Download example"}
      title={files.length > 1 ? "Download all example files and setup README as a ZIP" : "Download example file"}
      onClick={() => {
        try { downloadExample(files, name); setFailed(false); }
        catch { setFailed(true); }
      }}
    >
      <Download aria-hidden="true" size={14} />
      <span>{failed ? "Retry download" : "Download example"}</span>
    </button>
  );
}

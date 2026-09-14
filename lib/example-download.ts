export interface DownloadFile {
  name: string;
  code: string;
  language: string;
  curl?: string;
}

const extensions: Record<string, string> = {
  typescript: "ts", javascript: "js", bash: "sh", shell: "sh", sh: "sh",
  tsx: "tsx", jsx: "jsx", json: "json", ts: "ts", js: "js", css: "css",
  html: "html", python: "py", solidity: "sol", yaml: "yaml",
};

export function downloadFilename(file: DownloadFile): string {
  const name = file.name.replace(/\\/g, "/").split("/")
    .filter(part => part && part !== "." && part !== "..")
    .map(part => part.replace(/[^a-zA-Z0-9._-]/g, "-"))
    .join("/") || "example";
  return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${extensions[file.language] ?? "txt"}`;
}

export function exampleReadme(files: readonly DownloadFile[], sourceUrl: string): string {
  const dependencies = new Set<string>();
  const localImports = new Set<string>();
  for (const file of files) {
    for (const match of file.code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier.startsWith(".") || specifier.startsWith("@/")) localImports.add(specifier);
      else if (!specifier.startsWith("node:")) dependencies.add(specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]);
    }
  }
  return `# Integration example\n\nSource: ${sourceUrl}\n\nThis download contains the displayed example, including any applied partner configuration. It is an integration reference, not a standalone application. Request/response fixtures are illustrative; obtain fresh live data before signing.\n\n## Files\n\n${files.map(file => `- ${downloadFilename(file)}`).join("\n")}\n\n## Setup\n\n1. Follow the source guide's installation instructions and use your application's existing package manager and compatible package versions.\n2. Keep the files and relative paths together. Integrate them into your application's TypeScript/JavaScript environment as appropriate.\n3. Replace sample account, chain, RPC, token addresses/decimals, amounts, and wrapped-native token with values from your wallet and host configuration. Use the Orbs-supplied partner, or the guide's external default.\n4. Supply the host wallet, balance, quote/price sources, state, and callbacks referenced by the example. Never embed private keys in frontend code.\n5. Follow the guide's end-to-end acceptance run, including receipt confirmation and failure recovery.\n\n## Dependencies referenced by the code\n\n${dependencies.size ? [...dependencies].sort().map(name => `- ${name}`).join("\n") : "No package imports detected. Check the source guide for runtime and tooling requirements."}\n\n## Local and host imports to resolve\n\n${localImports.size ? [...localImports].sort().map(name => `- ${name}`).join("\n") : "No local imports detected."}\n\nSome imports may refer to your host application or another example in the guide. Resolve any missing modules before running; this archive includes only this example panel.\n`;
}

// ZIP store method: examples are small text files, so no compression dependency
// is needed. UTF-8 names and CRC-32 permit extraction by standard ZIP tools.
export function createExampleZip(files: readonly { name: string; code: string }[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const locals: Uint8Array<ArrayBuffer>[] = [];
  const directory: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.code);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30 + name.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x800, true);
    view.setUint16(12, 33, true); // 1980-01-01
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x800, true);
    cv.setUint16(14, 33, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    offset += local.length;
  }
  const directorySize = directory.reduce((size, entry) => size + entry.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);
  const result = new Uint8Array(offset + directorySize + end.length);
  let cursor = 0;
  for (const part of [...locals, ...directory, end]) { result.set(part, cursor); cursor += part.length; }
  return result;
}

export function downloadExample(files: readonly DownloadFile[], name: string): void {
  if (!files.length) return;
  const entries = files.map(file => ({name: downloadFilename(file), code: file.code}));
  const multiple = entries.length > 1;
  if (multiple) {
    for (const file of files) if (file.curl) entries.push({ name: `${downloadFilename(file)}.curl.sh`, code: file.curl });
    entries.push({name: "README.md", code: exampleReadme(files, window.location.href)});
  }
  const blob = multiple
    ? new Blob([createExampleZip(entries)], {type: "application/zip"})
    : new Blob([entries[0].code], {type: "text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = multiple ? `${name.replace(/[^a-z0-9_-]/gi, "-")}.zip` : entries[0].name.split("/").at(-1)!;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

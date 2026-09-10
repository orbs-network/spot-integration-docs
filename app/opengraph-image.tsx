import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const alt = "Orbs Spot Integration Guides";
export const contentType = "image/png";
export const size = {
  height: 630,
  width: 1200,
};

export default async function OpenGraphImage(): Promise<ImageResponse> {
  const [regular, bold] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/montserrat-regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/montserrat-extrabold.ttf")),
  ]);
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background:
          "radial-gradient(circle at 82% 18%, rgba(122,137,233,0.22), transparent 26%), #0a0a0a",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Montserrat",
        height: "100%",
        justifyContent: "space-between",
        padding: "72px 80px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          color: "#7a89e9",
          display: "flex",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            alignItems: "center",
            border: "2px solid rgba(122,137,233,0.6)",
            borderRadius: 16,
            display: "flex",
            height: 48,
            justifyContent: "center",
            marginRight: 18,
            width: 48,
          }}
        >
          <span
            style={{
              border: "3px solid #7a89e9",
              display: "flex",
              height: 16,
              transform: "rotate(45deg)",
              width: 16,
            }}
          />
        </span>
        Orbs Spot Docs
      </div>

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 960 }}>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: "-0.045em",
            lineHeight: 1.04,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            color: "#a3a3a3",
            display: "flex",
            fontSize: 28,
            lineHeight: 1.45,
            marginTop: 24,
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>

      <div
        style={{
          alignItems: "center",
          borderTop: "1px solid rgba(255,255,255,0.14)",
          color: "#d4d4d4",
          display: "flex",
          fontSize: 20,
          justifyContent: "space-between",
          paddingTop: 28,
        }}
      >
        <span style={{ color: "#2cedfc" }}>Swap</span>
        <span style={{ color: "#7a89e9" }}>Advanced Orders</span>
        <span>API · TypeScript SDK · React</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Montserrat", data: regular, weight: 400, style: "normal" },
        { name: "Montserrat", data: bold, weight: 800, style: "normal" },
      ],
    },
  );
}

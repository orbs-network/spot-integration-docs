import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const alt = "Orbs Spot Integration Guides";
export const contentType = "image/png";
export const size = {
  height: 630,
  width: 1200,
};

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background:
          "radial-gradient(circle at 82% 18%, rgba(255,55,199,0.22), transparent 26%), #0a0a0a",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
        height: "100%",
        justifyContent: "space-between",
        padding: "72px 80px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          color: "#ff37c7",
          display: "flex",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            alignItems: "center",
            border: "2px solid rgba(255,55,199,0.6)",
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
              border: "3px solid #ff37c7",
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
            fontWeight: 700,
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
        <span>Liquidity Hub</span>
        <span>Advanced Orders</span>
        <span>Direct API · React SDK</span>
      </div>
    </div>,
    size,
  );
}

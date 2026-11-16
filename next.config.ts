import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  async redirects() {
    return [
      {
        destination: "/swap",
        permanent: true,
        source: "/developers/liquidity-hub",
      },
      { source: "/liquidity-hub", destination: "/swap", permanent: true },
      { source: "/liquidity-hub/shared", destination: "/swap/shared", permanent: true },
      { source: "/liquidity-hub/direct", destination: "/swap", permanent: true },
      { source: "/liquidity-hub.md", destination: "/swap.md", permanent: true },
      { source: "/liquidity-hub/shared.md", destination: "/swap/shared.md", permanent: true },
      { source: "/liquidity-hub/direct.md", destination: "/swap.md", permanent: true },
      {
        destination: "/advanced-orders/direct",
        permanent: true,
        source: "/developers/orders-sink",
      },
      {
        destination: "/advanced-orders/direct",
        permanent: true,
        source: "/developers/orders-sink/direct",
      },
      {
        destination: "/advanced-orders/react",
        permanent: true,
        source: "/developers/orders-sink/react",
      },
    ];
  },
};

export default nextConfig;

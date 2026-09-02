import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  async redirects() {
    return [
      {
        destination: "/liquidity-hub",
        permanent: true,
        source: "/developers/liquidity-hub",
      },
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

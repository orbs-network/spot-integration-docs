"use client";

import { usePathname } from "next/navigation";

export function ProductBackground() {
  const pathname = usePathname();
  const product = pathname.startsWith("/liquidity-hub")
    ? "liquidity-hub"
    : pathname.startsWith("/advanced-orders")
      ? "advanced-orders"
      : "overview";

  return (
    <div aria-hidden="true" className="product-background" data-active-product={product}>
      <div className="product-background-layer" data-product="liquidity-hub" />
      <div className="product-background-layer" data-product="advanced-orders" />
    </div>
  );
}

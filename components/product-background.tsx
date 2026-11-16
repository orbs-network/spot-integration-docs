"use client";

import { usePathname } from "next/navigation";

export function ProductBackground() {
  const pathname = usePathname();
  const product = pathname.startsWith("/swap")
    ? "swap"
    : pathname.startsWith("/advanced-orders")
      ? "advanced-orders"
      : pathname.startsWith("/perps")
        ? "perps"
        : "overview";

  return (
    <div aria-hidden="true" className="product-background" data-active-product={product}>
      <div className="product-background-layer" data-product="swap" />
      <div className="product-background-layer" data-product="advanced-orders" />
      <div className="product-background-layer" data-product="perps" />
    </div>
  );
}

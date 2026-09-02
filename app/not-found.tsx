import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="not-found">
      <p className="eyebrow">404</p>
      <h1>Guide Not Found</h1>
      <p>The requested integration guide does not exist.</p>
      <Link className="button-link" href="/liquidity-hub">
        Open Liquidity Hub Guide
      </Link>
    </main>
  );
}

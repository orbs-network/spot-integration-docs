import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="app-header">
      <Link
        aria-label="Orbs Spot"
        className="app-logo-link"
        href="/"
      >
        <Image
          alt="Orbs Swap"
          height="40"
          priority
          src="/orbs-logo.svg"
          width="160"
        />
      </Link>
      <ThemeToggle />
    </header>
  );
}

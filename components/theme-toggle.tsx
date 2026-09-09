"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "orbs-docs-theme";

type Theme = "dark" | "light";

function getCurrentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => {
      meta.content = theme === "light" ? "#f7f7f8" : "#09090b";
    });
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const syncTheme = () => setTheme(getCurrentTheme());
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const nextTheme =
        event.newValue === "light" || event.newValue === "dark"
          ? event.newValue
          : "dark";
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };

    syncTheme();
    window.addEventListener("storage", syncStoredTheme);
    return () => {
      window.removeEventListener("storage", syncStoredTheme);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = getCurrentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {}
    setTheme(nextTheme);
  };

  return (
    <button
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="theme-toggle"
      onClick={toggleTheme}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      type="button"
    >
      <Sun aria-hidden="true" className="theme-icon-to-light" size={17} />
      <Moon aria-hidden="true" className="theme-icon-to-dark" size={17} />
    </button>
  );
}

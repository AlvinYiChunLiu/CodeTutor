"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7.5 6.5h17A3.5 3.5 0 0 1 28 10v11a3.5 3.5 0 0 1-3.5 3.5H15l-6.5 4v-4h-1A3.5 3.5 0 0 1 4 21V10a3.5 3.5 0 0 1 3.5-3.5Z" />
      <path d="m13 12-3 3 3 3m6-6 3 3-3 3m-1-7-2 8" />
    </svg>
  );
}

export default function SiteHeader({ badge }: { badge?: string }) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("codetutor-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const useDark = savedTheme ? savedTheme === "dark" : prefersDark;
    document.documentElement.dataset.theme = useDark ? "dark" : "light";
    setDark(useDark);
  }, []);

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
    window.localStorage.setItem("codetutor-theme", nextDark ? "dark" : "light");
  }

  return (
    <header className="app-header">
      <Link className="app-brand" href="/" aria-label="CodeTutor home">
        <span className="app-brand-mark"><BrandMark /></span>
        <span>codetutor<span className="brand-period">.</span></span>
      </Link>
      <nav className="app-nav" aria-label="Main navigation">
        <Link href="/" className={pathname === "/" ? "nav-active" : ""}>Main</Link>
        <Link href="/lesson" className={pathname === "/lesson" ? "nav-active" : ""}>Explore a lesson</Link>
        <Link href="/generate" className={pathname === "/generate" ? "nav-active" : ""}>Generate Code</Link>
        <Link href="/past-videos" className={pathname === "/past-videos" ? "nav-active" : ""}>Past videos</Link>
      </nav>
      <div className="header-actions">
        {badge && <span className="header-badge">{badge}</span>}
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} aria-pressed={dark}>
          <span className="theme-toggle-icon" aria-hidden="true">{dark ? "☼" : "☾"}</span>
          <span className="theme-toggle-label">{dark ? "Light" : "Dark"}</span>
        </button>
      </div>
    </header>
  );
}

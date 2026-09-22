"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { exportAllUserData } from "@/lib/client-plan";

const links = [
  { href: "/", label: "Home" },
  { href: "/plan/sambhav", label: "My plan" },
  { href: "/progress", label: "Progress" },
  { href: "/import", label: "Trainer tools" },
];

export function AppShell({ children, active = "" }: { children: React.ReactNode; active?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("formwork-theme") as "light" | "dark" | null;
    const initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("formwork-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleExportBackup = () => {
    const data = exportAllUserData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `formwork-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">F</span>
          <span className="brand-name">Formwork</span>
        </Link>

        <div className="eyebrow" style={{ padding: "0 10px 10px" }}>
          Training group
        </div>

        <nav className="nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${active === link.href ? "active" : ""}`}
            >
              <span>{link.label}</span>
              {link.href === "/import" && <span className="nav-context">Trainer</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="gym-mode-toggle"
              onClick={toggleTheme}
              title="Toggle High-Contrast Gym Mode"
            >
              <span>Gym Mode</span>
              <strong>{theme === "dark" ? "ON (Dark)" : "OFF (Light)"}</strong>
            </button>
            <button
              type="button"
              className="link-btn-subtle"
              style={{ marginTop: 8, fontSize: 11, display: "block" }}
              onClick={handleExportBackup}
            >
              Export JSON backup ↓
            </button>
          </div>

          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Signed in as
          </div>
          <div className="profile-mini">
            <span className="avatar">SJ</span>
            <div>
              <div className="profile-name">Sambhav Jain</div>
              <div className="profile-role">Group member</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">{children}</div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile Navigation">
        <Link href="/" className={active === "/" ? "active" : ""}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Home</span>
        </Link>
        <Link href="/plan/sambhav" className={active.startsWith("/plan") ? "active" : ""}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="20" height="14" x="2" y="5" rx="2"/>
            <line x1="2" x2="22" y1="10" y2="10"/>
          </svg>
          <span>Workout</span>
        </Link>
        <Link href="/progress" className={active === "/progress" ? "active" : ""}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
            <polyline points="16 7 22 7 22 13"/>
          </svg>
          <span>Progress</span>
        </Link>
        <Link href="/import" className={active === "/import" ? "active" : ""}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" x2="12" y1="3" y2="15"/>
          </svg>
          <span>Import</span>
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="mobile-theme-btn"
          title="Toggle Gym Mode"
          aria-label="Toggle Gym Mode"
        >
          {theme === "dark" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
          )}
          <span>{theme === "dark" ? "Light" : "Gym"}</span>
        </button>
      </nav>
    </div>
  );
}


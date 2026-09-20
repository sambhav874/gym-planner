import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/plan/sambhav", label: "My plan" },
  { href: "/progress", label: "Progress" },
  { href: "/import", label: "Trainer tools" },
];

export function AppShell({ children, active = "" }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark">F</span><span className="brand-name">Formwork</span></Link>
        <div className="eyebrow" style={{ padding: "0 10px 10px" }}>Training group</div>
        <nav className="nav">
          {links.map((link) => <Link key={link.href} href={link.href} className={`nav-link ${active === link.href ? "active" : ""}`}><span>{link.label}</span>{link.href === "/import" && <span className="nav-context">Trainer</span>}</Link>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Signed in as</div>
          <div className="profile-mini"><span className="avatar">SJ</span><div><div className="profile-name">Sambhav Jain</div><div className="profile-role">Group member</div></div></div>
        </div>
      </aside>
      <main className="main"><div className="main-inner">{children}</div></main>
      <nav className="mobile-nav">
        {links.slice(0, 3).map((link) => <Link key={link.href} href={link.href} className={active === link.href ? "active" : ""}><span>{link.label}</span></Link>)}
        <Link href="/import" className={active === "/import" ? "active" : ""}><span>Import</span></Link>
      </nav>
    </div>
  );
}

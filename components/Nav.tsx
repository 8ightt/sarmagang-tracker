"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Club" },
  { href: "/players", label: "Players" },
  { href: "/matches", label: "Matches" },
  { href: "/records", label: "Records" },
  { href: "/analysis", label: "Analysis" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <a key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}

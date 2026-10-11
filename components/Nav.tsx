"use client";

import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; also?: string }[] = [
  { href: "/", label: "Club" },
  { href: "/players", label: "Players" },
  { href: "/seasons", label: "Seasons", also: "/matches" },
  { href: "/records", label: "Records" },
  { href: "/analysis", label: "Analysis" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href) || (l.also ? path.startsWith(l.also) : false);
        return (
          <a key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}

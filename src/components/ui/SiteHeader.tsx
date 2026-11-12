"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun } from "lucide-react";

const links = [
  { href: "/projects", label: "Projects" },
  { href: "/agent", label: "Agent" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/operations", label: "Operations" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-full bg-sun text-ink">
            <Sun className="size-4" aria-hidden />
          </span>
          SunShare
        </Link>
        <nav aria-label="Main" className="-mx-2 flex items-center text-sm sm:mx-0 sm:gap-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-full px-2.5 transition-colors sm:px-3 ${
                  active
                    ? "bg-green-soft font-medium text-green-dark"
                    : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

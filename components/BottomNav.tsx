"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/acasa", label: "Acasă", icon: "🏠" },
  { href: "/oferte", label: "Oferte", icon: "📋" },
  { href: "/catalog", label: "Catalog", icon: "📦" },
  { href: "/clienti", label: "Clienți", icon: "👥" },
  { href: "/mai-mult", label: "Mai mult", icon: "⋯" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 mx-auto flex max-w-[480px] border-t border-line bg-white">
      {TABS.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
            style={{ color: active ? "var(--color-navy)" : "var(--color-muted)" }}
          >
            <span className="text-lg">{t.icon}</span>
            <span style={{ fontWeight: active ? 700 : 400 }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

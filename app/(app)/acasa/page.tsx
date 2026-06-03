"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AcasaPage() {
  const [stats, setStats] = useState({ offers: 0, products: 0, clients: 0 });

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const [o, p, c] = await Promise.all([
        sb.from("offers").select("id", { count: "exact", head: true }),
        sb.from("products").select("id", { count: "exact", head: true }),
        sb.from("beneficiaries").select("id", { count: "exact", head: true }),
      ]);
      setStats({ offers: o.count ?? 0, products: p.count ?? 0, clients: c.count ?? 0 });
    })();
  }, []);

  return (
    <div>
      <header className="bg-navy px-5 pb-5 pt-6 text-white">
        <div className="text-sm opacity-80">SCV Aqua Premium Instal</div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Bună ziua 👋
        </h1>
      </header>

      <div className="grid grid-cols-3 gap-3 p-4">
        <Stat n={stats.offers} l="Oferte" />
        <Stat n={stats.products} l="Articole" />
        <Stat n={stats.clients} l="Clienți" />
      </div>

      <div className="px-4 text-sm text-muted">
        Bine ai venit în AquaOffer. Mergi la <b>Oferte</b> ca să faci o ofertă nouă,
        sau la <b>Catalog</b> și <b>Clienți</b> ca să-ți vezi datele.
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3 text-center">
      <div className="text-2xl font-bold text-navy">{n}</div>
      <div className="text-xs text-muted">{l}</div>
    </div>
  );
}

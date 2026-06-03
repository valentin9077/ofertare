"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const DOMAINS = [
  ["A", "Sanitare apă"], ["B", "Canal. menajeră"], ["C", "Canal. pluvială"],
  ["D", "Obiecte sanitare"], ["E", "Armături"], ["F", "Izolații"],
  ["G", "Hidranți"], ["H", "Dotări PSI"], ["I", "Probe"], ["J", "Gospodărie apă"],
  ["K", "Radiatoare"], ["L", "Aparate termice"], ["M", "Ventilare"],
  ["N", "Echipamente"], ["Z", "Diverse"],
];

type Product = { id: string; name: string; domain: string; unit: string; price_no_vat: number | null };

export default function CatalogPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [domain, setDomain] = useState("A");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase()
        .from("products")
        .select("id,name,domain,unit,price_no_vat")
        .order("name");
      setItems((data as Product[]) ?? []);
    })();
  }, []);

  const filtered = items.filter(
    (i) => i.domain === domain && (!q || i.name.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div>
      <header className="bg-navy px-5 pb-4 pt-6 text-white">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">Catalog</h1>
        <div className="text-sm opacity-80">{items.length} articole de manoperă</div>
      </header>

      <div className="p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔎 Caută articol…"
          className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none focus:border-blue"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto px-3 pb-2">
        {DOMAINS.map(([code, label]) => (
          <button
            key={code}
            onClick={() => setDomain(code)}
            className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs"
            style={{
              background: domain === code ? "var(--color-navy)" : "white",
              color: domain === code ? "white" : "var(--color-ink)",
              borderColor: "var(--color-line)",
            }}
          >
            {code}. {label}
          </button>
        ))}
      </div>

      <div className="space-y-2 p-3">
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">Niciun articol aici.</div>
        )}
        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-xl border border-line bg-white p-3"
          >
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted">{p.unit}</div>
            </div>
            <div className="font-bold text-navy">
              {p.price_no_vat != null ? fmt(p.price_no_vat) + " RON" : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

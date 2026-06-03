"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bootstrap } from "@/lib/bootstrap";

type Offer = {
  id: string;
  number: string | null;
  date: string;
  status: string;
  beneficiaries: { name: string } | null;
};

const STATUS: Record<string, string> = {
  draft: "Ciornă",
  sent: "Trimisă",
  accepted: "Acceptată",
  rejected: "Respinsă",
};

export default function OfertePage() {
  const [list, setList] = useState<Offer[]>([]);

  async function load() {
    const { data } = await supabase()
      .from("offers")
      .select("id,number,date,status,beneficiaries(name)")
      .order("created_at", { ascending: false });
    setList((data as unknown as Offer[]) ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function newOffer() {
    const companyId = await bootstrap();
    const n = String(list.length + 1).padStart(3, "0");
    await supabase().from("offers").insert({
      company_id: companyId,
      number: `2026/${n}`,
      status: "draft",
    });
    load();
  }

  return (
    <div>
      <header className="flex items-center justify-between bg-navy px-5 pb-4 pt-6 text-white">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">Oferte</h1>
        <button
          onClick={newOffer}
          className="rounded-full bg-amber px-3 py-1.5 text-sm font-semibold text-navy"
        >
          + Ofertă nouă
        </button>
      </header>

      <div className="space-y-2 p-3">
        {list.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">
            Nicio ofertă încă. Apasă <b>+ Ofertă nouă</b>.
          </div>
        )}
        {list.map((o) => (
          <div key={o.id} className="rounded-xl border border-line bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-blue">
                {o.number ?? "fără nr"}
              </span>
              <span className="text-xs text-muted">{STATUS[o.status] ?? o.status}</span>
            </div>
            <div className="mt-1 font-semibold">
              {o.beneficiaries?.name ?? "Beneficiar necompletat"}
            </div>
            <div className="text-xs text-muted">{o.date}</div>
          </div>
        ))}
      </div>

      <p className="px-4 text-center text-xs text-muted">
        Constructorul de ofertă (import listă + potrivire prețuri + PDF) se adaugă în pasul următor.
      </p>
    </div>
  );
}

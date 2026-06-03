"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const MODULES = [
  "Proiecte", "Garanții", "Cheltuieli", "Pontaj", "Salarii",
  "Profit", "Facturi", "Fiscal", "AI Assistant", "Setări",
];

export default function MaiMultPage() {
  const router = useRouter();

  async function logout() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  return (
    <div>
      <header className="bg-navy px-5 pb-4 pt-6 text-white">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">Mai mult</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 p-3">
        {MODULES.map((m) => (
          <div
            key={m}
            className="rounded-2xl border border-line bg-white p-4 text-center text-sm font-semibold text-navy"
          >
            {m}
            <div className="mt-1 text-[10px] font-normal text-muted">în curând</div>
          </div>
        ))}
      </div>

      <div className="p-4">
        <button
          onClick={logout}
          className="w-full rounded-xl border border-navy py-3 font-semibold text-navy"
        >
          🚪 Ieși din cont
        </button>
      </div>
    </div>
  );
}

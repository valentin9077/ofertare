"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bootstrap } from "@/lib/bootstrap";

type Ben = { id: string; name: string; cui: string | null; address: string | null; phone: string | null };

export default function ClientiPage() {
  const [list, setList] = useState<Ben[]>([]);
  const [open, setOpen] = useState(false);
  const [cui, setCui] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [regCom, setRegCom] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const { data } = await supabase()
      .from("beneficiaries")
      .select("id,name,cui,address,phone")
      .order("name");
    setList((data as Ben[]) ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function lookupAnaf() {
    setMsg("");
    const c = cui.replace(/\D/g, "");
    if (!c) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/anaf?cui=${c}`);
      const j = await r.json();
      if (r.ok) {
        setName(j.name || "");
        setAddress(j.address || "");
        setRegCom(j.regCom || "");
        setPhone(j.phone || "");
      } else setMsg(j.error || "Nu am găsit firma.");
    } catch {
      setMsg("Eroare la căutare.");
    }
    setLoading(false);
  }

  async function save() {
    if (!name) {
      setMsg("Pune un nume.");
      return;
    }
    const companyId = await bootstrap();
    await supabase().from("beneficiaries").insert({
      company_id: companyId,
      name,
      cui,
      reg_com: regCom,
      address,
      phone,
    });
    setOpen(false);
    setCui(""); setName(""); setAddress(""); setRegCom(""); setPhone(""); setMsg("");
    load();
  }

  return (
    <div>
      <header className="flex items-center justify-between bg-navy px-5 pb-4 pt-6 text-white">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">Clienți</h1>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-amber px-3 py-1.5 text-sm font-semibold text-navy"
        >
          + Adaugă
        </button>
      </header>

      <div className="space-y-2 p-3">
        {list.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">Niciun client încă.</div>
        )}
        {list.map((b) => (
          <div key={b.id} className="rounded-xl border border-line bg-white p-3">
            <div className="font-semibold">{b.name}</div>
            <div className="text-xs text-muted">
              {b.cui ? "CUI " + b.cui + " · " : ""}
              {b.address}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[480px] rounded-t-3xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Client nou</h3>
              <button onClick={() => setOpen(false)} className="text-muted">
                ✕
              </button>
            </div>

            <label className="label">CUI (completare automată ANAF)</label>
            <div className="mb-3 mt-1 flex gap-2">
              <input
                value={cui}
                onChange={(e) => setCui(e.target.value)}
                placeholder="ex: RO3511905"
                className="flex-1 rounded-xl border border-line px-3 py-2.5 outline-none focus:border-blue"
              />
              <button
                onClick={lookupAnaf}
                disabled={loading}
                className="rounded-xl bg-blue px-4 font-semibold text-white disabled:opacity-60"
              >
                {loading ? "…" : "Caută"}
              </button>
            </div>

            <Field label="Denumire" value={name} set={setName} />
            <Field label="Reg. Com." value={regCom} set={setRegCom} />
            <Field label="Adresă" value={address} set={setAddress} />
            <Field label="Telefon" value={phone} set={setPhone} />

            {msg && <div className="mb-2 text-sm text-amber-700">{msg}</div>}

            <button
              onClick={save}
              className="mt-2 w-full rounded-xl bg-navy py-3 font-semibold text-white"
            >
              Salvează client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-blue"
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { bootstrap } from "@/lib/bootstrap";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession();
      if (data.session) router.replace("/acasa");
    })();
  }, [router]);

  async function submit() {
    setMsg("");
    if (!email || pass.length < 6) {
      setMsg("Pune email și o parolă de minim 6 caractere.");
      return;
    }
    setBusy(true);
    const sb = supabase();
    const res =
      mode === "signup"
        ? await sb.auth.signUp({ email, password: pass })
        : await sb.auth.signInWithPassword({ email, password: pass });
    setBusy(false);
    if (res.error) {
      setMsg(translate(res.error.message));
      return;
    }
    if (mode === "signup" && !res.data.session) {
      setMsg("Cont creat! Verifică emailul, apoi intră.");
      setMode("signin");
      return;
    }
    await bootstrap();
    router.replace("/acasa");
  }

  return (
    <main
      className="shell flex items-center justify-center px-5"
      style={{ background: "linear-gradient(160deg,#0a1f3d,#1e5bb8)" }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="text-center text-4xl">💧</div>
        <h1 className="text-center font-[family-name:var(--font-display)] text-2xl font-semibold text-navy">
          AquaOffer
        </h1>
        <p className="mb-5 text-center text-sm text-muted">
          {mode === "signin"
            ? "Intră în cont ca să-ți vezi ofertele pe orice dispozitiv."
            : "Creează un cont nou (email + parolă, min. 6 caractere)."}
        </p>

        <label className="label">Email</label>
        <input
          className="mb-3 mt-1 w-full rounded-xl border border-line px-3 py-3 text-base outline-none focus:border-blue"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemplu.ro"
        />
        <label className="label">Parolă</label>
        <input
          className="mb-2 mt-1 w-full rounded-xl border border-line px-3 py-3 text-base outline-none focus:border-blue"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="parola ta"
        />
        {msg && <div className="mb-2 text-center text-sm text-amber-700">{msg}</div>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-xl bg-navy py-3 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Se procesează…" : mode === "signin" ? "Intră în cont" : "Creează cont"}
        </button>
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMsg("");
          }}
          className="mt-2 w-full rounded-xl border border-navy py-3 font-semibold text-navy"
        >
          {mode === "signin" ? "Nu am cont — creează unul" : "Am deja cont — intră"}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          Datele tale sunt private, protejate cu parolă.
        </p>
      </div>
    </main>
  );
}

function translate(m: string) {
  const s = (m || "").toLowerCase();
  if (s.includes("invalid login")) return "Email sau parolă greșite.";
  if (s.includes("already")) return "Există deja un cont cu acest email. Intră în cont.";
  if (s.includes("password")) return "Parola trebuie să aibă minim 6 caractere.";
  return "A apărut o problemă. Mai încearcă o dată.";
}

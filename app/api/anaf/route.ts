import { NextRequest, NextResponse } from "next/server";

// Proxy server-side către ANAF (browserul nu poate apela direct din cauza CORS).
export async function GET(req: NextRequest) {
  const cui = (req.nextUrl.searchParams.get("cui") || "").replace(/\D/g, "");
  if (!cui) return NextResponse.json({ error: "CUI lipsă" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  try {
    const r = await fetch(
      "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v9/ws/tva",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ cui: Number(cui), data: today }]),
      }
    );
    const j = await r.json();
    const found = j?.found?.[0];
    if (!found) return NextResponse.json({ error: "Firma nu a fost găsită" }, { status: 404 });

    const g = found.date_generale || {};
    return NextResponse.json({
      name: g.denumire || "",
      address: g.adresa || "",
      regCom: g.nrRegCom || "",
      phone: g.telefon || "",
    });
  } catch {
    return NextResponse.json({ error: "ANAF indisponibil momentan" }, { status: 502 });
  }
}

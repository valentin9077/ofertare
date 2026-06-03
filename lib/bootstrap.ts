import { supabase } from "@/lib/supabase";

// Date de pornire pentru catalog (manoperă). Prețurile reale se pot edita oricând.
const SEED_PRODUCTS: [string, string, string, string, number][] = [
  // code, name, domain, unit, price
  ["PPR-D63", "Țeavă PP-R De63", "A", "ml", 54.6],
  ["PPR-D50", "Țeavă PP-R De50", "A", "ml", 46.8],
  ["PPR-D40", "Țeavă PP-R De40", "A", "ml", 39],
  ["PPR-D32", "Țeavă PP-R De32", "A", "ml", 33.15],
  ["PPR-D25", "Țeavă PP-R De25", "A", "ml", 29.25],
  ["PPR-D20", "Țeavă PP-R De20", "A", "ml", 25.35],
  ["OL-DN25", "Conductă OL zincat Dn25", "A", "ml", 58.5],
  ["OL-DN32", "Conductă OL zincat Dn32", "A", "ml", 66.3],
  ["PVC-50", "Canalizare PVC DN50", "B", "ml", 18],
  ["PVC-75", "Canalizare PVC DN75", "B", "ml", 21],
  ["PVC-110", "Canalizare PVC-KG DN110", "B", "ml", 24],
  ["PVC-160", "Canalizare PVC-KG DN160", "C", "ml", 32],
  ["PVC-200", "Canalizare PVC-KG DN200", "C", "ml", 42],
  ["MNT-LAV", "Montaj lavoar complet", "D", "buc", 350],
  ["MNT-WC", "Montaj WC complet", "D", "buc", 420],
  ["MNT-SPL", "Montaj spălător complet", "D", "buc", 380],
  ["MNT-CDS", "Montaj cadă baie complet", "D", "buc", 520],
  ["MNT-DUS", "Montaj duș complet", "D", "buc", 480],
  ["ROB-12", 'Robinet sferic 1/2"', "E", "buc", 25],
  ["ROB-34", 'Robinet sferic 3/4"', "E", "buc", 35],
  ["IZO-19", "Izolație Armaflex 19mm", "F", "ml", 12],
  ["HID-OL", "Hidrant interior OL sudat", "G", "ml", 85],
  ["HID-CPL", "Hidrant complet cu cutie", "G", "buc", 850],
  ["PSI-DOT", "Dotare mijloace tehnice PSI", "H", "ans", 3555],
  ["PROB-PRS", "Probă presiune și funcționare", "I", "ans", 850],
  ["GOSP-APA", "Gospodărie apă pompare", "J", "ans", 8500],
  ["RAD-MNT", "Montaj radiator complet", "K", "buc", 220],
  ["DST-5C", "Distribuitor 5 circuite", "L", "buc", 530],
  ["DST-6C", "Distribuitor 6 circuite", "L", "buc", 590],
  ["DST-8C", "Distribuitor 8 circuite", "L", "buc", 710],
  ["PEX-D20", "Țeavă PEX-a 20mm", "L", "ml", 6.5],
  ["PEX-D25", "Țeavă PEX-a 25mm", "L", "ml", 9.5],
  ["PEX-D32", "Țeavă PEX-a 32mm", "L", "ml", 18.5],
  ["VENT-CPL", "Instalație ventilare complet", "M", "ans", 2800],
  ["ECH-CPL", "Echipamente diverse montaj", "N", "ans", 1500],
];

const SEED_BENEFICIARIES: [string, string, string][] = [
  ["ROM SERVICE CONSTRUCT SRL", "RO3511905", "Cantina UTCB"],
  ["CONSTRUCT GRUP SRL", "RO12345678", "Bloc Bolintin-Vale"],
];

// Se asigură că utilizatorul are firmă + profil; pune datele de pornire o singură dată.
export async function bootstrap(): Promise<string | null> {
  const sb = supabase();
  const { data: u } = await sb.auth.getUser();
  const user = u.user;
  if (!user) return null;

  const { data: prof } = await sb
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  let companyId = prof?.company_id as string | undefined;

  if (!companyId) {
    const { data: comp, error: ce } = await sb
      .from("companies")
      .insert({})
      .select("id")
      .single();
    if (ce || !comp) return null;
    companyId = comp.id as string;
    await sb.from("profiles").upsert({ id: user.id, company_id: companyId, role: "owner" });
  }

  // Seed catalog dacă e gol
  const { count } = await sb
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (!count) {
    await sb.from("products").insert(
      SEED_PRODUCTS.map(([code, name, domain, unit, price]) => ({
        company_id: companyId,
        code,
        name,
        domain,
        unit,
        price_no_vat: price,
        keywords: name.toLowerCase(),
      }))
    );
    await sb.from("beneficiaries").insert(
      SEED_BENEFICIARIES.map(([name, cui, address]) => ({
        company_id: companyId,
        name,
        cui,
        address,
      }))
    );
  }

  return companyId;
}

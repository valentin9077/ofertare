/* Miez comun: potrivire cantități ↔ catalog de prețuri + calcule. Rulează în browser și în node. */
(function (root) {
  const strip = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[øØ∅⌀]/g, "d").replace(/[“”„"']/g, "").replace(/\s+/g, " ").trim();

  const KINDS = [
    ["pipe", /\b(teava|teavi|conducta|conducte|tub|tuburi|tubulatura|racord flexibil)\b/],
    ["cot", /\bcot(uri)?\b|\bcurba\b/], ["teu", /\bteu\b|\bteuri\b|ramificatie/], ["reductie", /reductie|reductii/],
    ["robinet", /robinet|ventil de|\bvana\b|\bvane\b|filtru/], ["clapeta", /clapet/], ["radiator", /radiator|convector|registru/],
    ["sifon", /sifon|rigola|gura de scurgere|piesa de curatire|piese de curatire/],
    ["obiect", /lavoar|vas wc|wc |pisoar|dus|cada|chiuveta|bideu|baterie/],
    ["hidrant", /hidrant|stingator|pichet/], ["izolatie", /izolat|armaflex|k-flex|kflex|elastomer/],
    ["suport", /bratara|colier|suport|consola|cleme/], ["pompa", /pompa|hidrofor|electropompa/],
    ["vas", /vas de expansiune|vas expansiune|rezervor|boiler|hidrofor/], ["proba", /proba|probe|spalare|dezinfect/],
    ["centrala", /centrala|cazan|schimbator/], ["ventilatie", /ventilat|grila|anemostat|difuzor|tubulatura|clima|split|ventiloconvector|hota/],
  ];
  const MATS = [
    ["ppr", /\bpp-?r\b|polipropilen|polifuziune/], ["pex", /\bpe-?x\w*|reticulat/], ["zinc", /zincat|zinc/],
    ["otel", /\botel\b|oțel/], ["pehd", /pehd|pe ?100|pe-?ht|polietilen/], ["pvc", /\bpvc\b|pvc-kg/], ["pp", /\bpp\b(?!-?r)/],
    ["cupru", /cupru/], ["fonta", /fonta/], ["inox", /inox/], ["alu", /aluminiu|multistrat|pex-?al/],
  ];
  const DIA = [/\bde ?(\d{2,3})\b/g, /\bdn ?(\d{2,3})\b/g, /\bd ?\.? ?(\d{2,3})\b/g, /\b(\d{2,3}) ?mm\b/g, /\bpn ?\d+\s*x\s*(\d{2,3})\b/g];
  const FR = { '1/2': 15, '3/4': 20, '1': 25, '1 1/4': 32, '1 1/2': 40, '2': 50, '2 1/2': 65, '3': 80, '4': 100 };

  function diameters(s) {
    const out = new Set();
    for (const re of DIA) { re.lastIndex = 0; let m; while ((m = re.exec(s))) out.add(+m[1]); }
    const f = s.matchAll(/(\d(?: \d\/\d)?|\d\/\d)\s?(?:"|inch|tol)/g);
    for (const m of f) { const k = m[1]; if (FR[k]) out.add(FR[k]); }
    return out;
  }
  function umFamily(u) {
    u = strip(u).replace(/\./g, "");
    if (/^(m|ml|metri|m liniar)$/.test(u)) return "m";
    if (/^(mp|m2)$/.test(u)) return "mp"; if (/^(mc|m3)$/.test(u)) return "mc"; if (u === "kg") return "kg";
    if (/^(buc|ans|ansamblu|sistem|grup|set|kit|cmp|complet|punct|kw|probe|proba)$/.test(u)) return "buc";
    return u || "buc";
  }
  function feats(den, um) {
    const s = strip(den);
    let kinds = new Set(KINDS.filter(k => k[1].test(s)).map(k => k[0]));
    if (kinds.has("izolatie") || kinds.has("clapeta") || kinds.has("ventilatie")) kinds = new Set([...kinds].filter(k => !["pipe", "robinet", "cot", "teu"].includes(k)));
    const mats = new Set(MATS.filter(m => m[1].test(s)).map(m => m[0]));
    const words = new Set(s.replace(/[^a-z0-9 ]/g, " ").split(" ").filter(w => w.length > 3));
    return { s, kinds, mats, dia: diameters(s), words, fam: umFamily(um) };
  }
  const inter = (a, b) => [...a].filter(x => b.has(x));

  /** Scor 0 = respins. >=5 potrivire sigură, 3..5 sugestie. */
  function score(fi, fc) {
    if (fi.fam !== fc.fam) return 0;
    const k = inter(fi.kinds, fc.kinds); if (!k.length) return 0;
    let sc = 2 + k.length * 0.5;
    if (fi.mats.size && fc.mats.size) { if (!inter(fi.mats, fc.mats).length) return 0; sc += 1.5; }
    else if (fi.mats.size || fc.mats.size) sc -= 0.5;
    if (fi.dia.size && fc.dia.size) { if (!inter(fi.dia, fc.dia).length) return 0; sc += 2; }
    else if (fi.kinds.has("pipe") && (fi.dia.size || fc.dia.size)) return 0;
    const ov = inter(fi.words, fc.words).length; sc += Math.min(ov, 4) * 0.35;
    return sc;
  }

  function keyOf(den) { return strip(den).replace(/[^a-z0-9]+/g, " ").trim(); }
  function prepCatalog(cat) { return cat.map(c => Object.assign({}, c, { key: c.learned ? keyOf(c.den) : "", f: feats(c.den + " " + (c.desc || ""), c.um) })); }

  function matchItem(item, pcat) {
    const fi = feats(item.den, item.um); let best = null, bs = 0;
    const sk = strip(item.den).replace(/[^a-z0-9]+/g, " ").trim();
    for (const c of pcat) if (c.key && c.key === sk && c.f.fam === fi.fam) return { id: c.id, score: 99, sure: true, exact: true };
    for (const c of pcat) { const s = score(fi, c.f); if (s > bs) { bs = s; best = c; } }
    if (best && bs >= 3.2) {
      const dimd = [...fi.kinds].some(k => ["pipe", "cot", "teu", "reductie", "robinet"].includes(k));
      const sure = bs >= 5.5 && (!dimd || (fi.dia.size && best.f.dia.size));
      return { id: best.id, score: bs, sure };
    }
    return null;
  }

  const r2 = x => Math.round((+x + Number.EPSILON) * 100) / 100;
  function total(it, adaos) { return r2((+it.cant || 0) * r2((+it.pret || 0) * (1 + (adaos || 0) / 100))); }

  function chapters(items, adaos) {
    const m = new Map();
    for (const it of items) {
      const k = it.cap || "FĂRĂ CAPITOL";
      const c = m.get(k) || { cap: k, total: 0, n: 0, fara: 0 };
      c.n++; if (!(it.pret > 0)) c.fara++; c.total += total(it, adaos); m.set(k, c);
    }
    return [...m.values()].map(c => (c.total = r2(c.total), c));
  }

  /** Verificare „nu intru în faliment”: cost estimat vs. ofertă. */
  function risc(o) {
    const ore = o.muncitori * o.zile * o.oreZi, manopera = ore * o.costOra;
    const cost = manopera + (o.deplasare || 0) + (o.materiale || 0);
    const profit = o.oferta - cost;
    return { ore, manopera: r2(manopera), cost: r2(cost), profit: r2(profit), marja: o.oferta ? profit / o.oferta : 0 };
  }


  /* Capitolele „ale tale” (din ofertele tale anterioare) */
  const CAPS = [
    ["Hidranți", /hidrant|stingator|pichet|stingere|sprinkl/],
    ["Instalații ventiloconvectoare", /ventiloconvector|ventilo-?convector|caseta (de )?(perete|tavan|pardoseala)|\bcasete\b/],
    ["Climatizare", /clima|split|multisplit|\bvrf\b|agent frigorific|cupru|unitate (interioara|exterioara)/],
    ["Ventilație", /ventilat|tubulatura|grila|anemostat|clapeta|difuzor|recuperator|\bhota\b|atenuator/],
    ["Cameră tehnică (centrală, panouri solare, pompe)", /centrala termica|panou(ri)? solar|boiler|hidrofor|grup(uri)? (de )?pompare|\bpompa|vas (de )?expansiune|distribuitor|colector|cazan|schimbator|rezervor|separator|bazin|statie|dedurizator|lampa uv|apometru|electrovana|pachet sistem solar/],
    ["Pluviale", /pluvial|burlan|jgheab/],
    ["Instalații termice", /calorifer|radiator|incalzire|pe-?x|pardoseala|convector|agent termic|termostat/],
    ["Instalații sanitare", /sanitar|lavoar|\bwc\b|pisoar|\bdus\b|cada|chiuveta|bideu|apa (rece|calda|potabila)|\bppr\b|pehd|canalizare|menajer|pvc-kg/],
  ];
  function autoCap(den, sheetCap) {
    const s = strip(den);
    for (const [name, re] of CAPS) if (re.test(s)) return name;
    return /sanitar/i.test(strip(sheetCap)) ? "Instalații sanitare" : "Instalații termice";
  }
  /** Număr de aparate (orientativ) pentru „OFERTA INCLUDE” și comparația pe aparat. */
  function counts(items) {
    const sum = (re, ex) => items.reduce((a, it) => { const s = strip(it.den); return a + (re.test(s) && !(ex && ex.test(s)) && umFamily(it.um) === "buc" ? +it.cant || 0 : 0); }, 0);
    const EX = /robinet|sifon|racord|flexibil|bateri|rezervor|bride|set |suport|conso|valv|vana|electric|filtru|pompa|izolat/;
    return {
      calorifere: sum(/radiator|calorifer/, EX),
      obiecte: sum(/lavoar|vas wc|\bwc\b|pisoar|cada|chiuveta|bideu|cabina dus|cap dus|\bdus\b/, EX),
      cuti: sum(/hidrant/, /exterior|racord|robinet|furtun|vana|clapet|suport|panou/),
      ventilo: sum(/ventiloconvector|ventilo-?convector|\bcaseta\b/, EX),
    };
  }
  /* Prețuri pe aparat deduse din ofertele tale de manoperă (total capitol ÷ număr aparate din „OFERTA INCLUDE”). */
  const HIST = {};

  const api = { CAPS, autoCap, counts, HIST, keyOf, strip, feats, score, prepCatalog, matchItem, total, chapters, risc, r2, umFamily };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.OF = api;
})(typeof window !== "undefined" ? window : globalThis);

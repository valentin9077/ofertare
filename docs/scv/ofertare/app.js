/* Ofertare SCV – ecranele aplicației. Oferta arată ca foaia de Excel: antet, beneficiar, rânduri, total, condiții.
   Datele și intrarea în cont: lib/scv.js. Potrivirea denumirilor: core.js. Excel: export.js. Cititul listelor: imp.js. Fișierul clientului: wb.js. */
(function () {
"use strict";
/* ---------- unelte ---------- */
const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const r2 = OF.r2;
/* numere scrise românește: „1.800” = 1800, „14,5” = 14,5, „12.5” = 12,5 */
const num = v => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/\s|lei|ron/gi, ""); if (!s) return 0;
  if (/^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s) || s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s); return isNaN(n) ? 0 : n;
};
const fmt = n => { n = +n || 0; const w = Math.abs(n - Math.round(n)) < 0.005; return n.toLocaleString("ro-RO", { minimumFractionDigits: w ? 0 : 2, maximumFractionDigits: w ? 0 : 2 }); };
const fq = n => (+n || 0).toLocaleString("ro-RO", { maximumFractionDigits: 3 });
const edn = n => (+n ? String(Math.round(+n * 1000) / 1000).replace(".", ",") : "");
const p2 = n => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return p2(d.getDate()) + "." + p2(d.getMonth() + 1) + "." + d.getFullYear(); };
const todayIso = () => { const d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
const svg = (inner, s, w) => '<svg class="ic" width="' + (s || 22) + '" height="' + (s || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
const ic = (n, s, w) => (window.OFI && OFI[n]) ? svg(OFI[n], s, w) : SCVI.icon(n, s, w);
const plural = (n, one, many) => n === 1 ? one : n + " " + (n % 100 >= 20 || n % 100 === 0 && n ? "de " : "") + many;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const fileSafe = s => String(s || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80).replace(/[. ]+$/, "");   // fără semne nepermise, fără punct la coadă, cel mult 80 de litere

/* ---------- starea aplicației ---------- */
let store = null, ME = null, booted = false, DOCS = {}, IDX = { list: [] }, FIRMA = {}, PIATA = null;
let catalog = [], BASE_CAT = [], pcat = [], REF = [], nextCatId = 1, catDirty = false, PX = null, TAR = null;
let CUR = "", st = null;                 // oferta deschisă (același obiect ca DOCS["p/"+CUR])
let VIEW = { name: "list" }, SAVED = "", SAVEDW = false, AFTER = null;
const DEF_NU = ["TVA", "legături electrice"].join("\n");
const UMS = ["buc", "ml", "mp", "kg", "set", "punct", "baie", "ore", "mc"];
const STARI = { lucru: "în lucru", trimisa: "trimisă", castigata: "câștigată", pierduta: "pierdută" };
/* domeniile pe care nu le face oricine: la aducerea unei liste întreb dacă le ofertezi */
const DOMQ = { v: "Ventilație", c: "Climatizare", e: "Electrice", g: "Gaze", p: "Săpături și terasamente" };   // domeniile pe care poate nu le faci: la aducerea unei liste pornesc oprite, până spui tu altfel
const DOMALL = { s: "Sanitare", t: "Termice", h: "Hidranți", v: DOMQ.v, c: DOMQ.c, g: DOMQ.g, e: DOMQ.e, p: DOMQ.p, x: "Probe, demontări și alte lucrări", n: "Alte poziții (nerecunoscute)" }, DOMORD = "sthvcgepxn";
const domKey = x => OF.domainOf(x.den, x.um) || "n";
const domGroups = xs => { const g = {}; xs.forEach(x => { const d = domKey(x); (g[d] = g[d] || []).push(x); }); const o = {}; DOMORD.split("").forEach(k => { if (g[k]) o[k] = g[k]; }); return o; };
const domDef = k => DOMQ[k] ? !!(FIRMA.dom || {})[k] : true;   // cum pornește comutatorul la o listă nouă: sanitare, termice, hidranți mereu pornite; ventilație, climatizare… cum ai răspuns ultima dată (prima dată oprite)
const LVT = ["", "prețul tău", "din prețurile tale", "socotit din prețurile tale", "estimat larg", "după piață"];
const FF = [["firma", "Denumirea firmei"], ["firmaCif", "CIF și nr. registrul comerțului"], ["firmaAdresa", "Adresă"], ["firmaContact", "Telefon și email"], ["semnatar", "Semnează ofertele (nume)"], ["iban", "IBAN (opțional, apare în antet)"]];
const CF = [["tva", "TVA (%)", "n"], ["avans", "Avans la semnare (%)", "n"], ["garantie", "Garanție (luni)", "n"], ["valab", "Oferta e valabilă (zile)", "n"], ["termen", "Termen de execuție", "t"], ["materialeDe", "Materialele sunt asigurate de", "t"], ["normative", "Normative", "t"]];
const DEFC = { tva: 21, avans: 30, garantie: 24, valab: 30, termen: "conform contractului", materialeDe: "sunt asigurate de beneficiar", normative: "I9, I13, GP 043, NP 059", nuInclude: DEF_NU, includeTxt: "" };
const defc = k => (FIRMA.def && FIRMA.def[k] != null) ? FIRMA.def[k] : DEFC[k];

/* ---------- oferta: forma datelor ---------- */
function nextNr() {
  const y = String(new Date().getFullYear()); let mx = 0, w = 4;
  Object.keys(DOCS).forEach(p => { if (p.indexOf("p/") !== 0) return; const m = /^(\d{4})\/(\d+)$/.exec(String((DOCS[p].proj || {}).nrOferta || "").trim()); if (m && m[1] === y) { mx = Math.max(mx, +m[2]); w = Math.max(w, m[2].length); } });
  if (typeof IDX !== "undefined" && IDX && IDX.nr && IDX.nr[y] > mx) mx = IDX.nr[y];   // și numerele ofertelor șterse rămân „date”
  if (mx) return y + "/" + String(mx + 1).padStart(w, "0");
  const m = /^(\d{4})\/(\d+)$/.exec(String(FIRMA.nrStart || "").trim());
  return m && m[1] === y ? FIRMA.nrStart : y + "/0001";
}
const blankProj = () => ({ santier: "", beneficiar: "", beneficiarCif: "", beneficiarContact: "", obiect: "", nrOferta: "", data: today(), valab: defc("valab"), tva: defc("tva"), avans: defc("avans"), garantie: defc("garantie"), termen: defc("termen"), materialeDe: defc("materialeDe"), normative: defc("normative"), semnatar: "", iban: "", nuInclude: defc("nuInclude"), includeTxt: defc("includeTxt"), stare: "lucru" });
/* Aduce orice ofertă (și proiectele făcute cu aplicația veche) la forma de acum: rânduri + poziții. */
function normSt(s) {
  s = Object.assign({ items: [], adaos: 0, rnd: 0, cnt: {}, chapOv: {}, risk: {} }, s || {});
  s.proj = Object.assign(blankProj(), s.proj || {});
  s.items = s.items || []; s.items.forEach((it, i) => { it.id = it.id || i + 1; });
  if (!Array.isArray(s.rows)) {            // proiect vechi: fiecare capitol din lista de poziții devine un rând al ofertei
    s.rows = OF.chapters(s.items, 0).map((c, i) => { const ov = (s.chapOv || {})[c.cap] || {}; return { id: i + 1, k: "c", cap: c.cap, den: ov.name || c.cap, ov: +ov.manual || 0 }; });
    s.rnd = 0;
  }
  s.files = s.files || []; s.files.forEach((f, i) => { if (f.id == null) f.id = i; });   // fișierele vechi își iau drept număr locul din listă (pozițiile lor așa le știu)
  syncRows(s);
  /* Suma scrisă de tine pe un capitol ține minte cât dădeau pozițiile în clipa aceea (ovT). Dacă apoi scoți, adaugi sau schimbi poziții,
     suma merge odată cu ele, în aceeași măsură – altfel ai oferta lucrări pe nimic sau ai cere bani pe ce nu mai ofertezi. */
  s.rows.forEach(r => { if (r.k === "c" && r.ov > 0 && r.ovT == null) setOv(r, r.ov, s); });
  s.v = 3; return s;
}
/* fiecare poziție stă într-un capitol care apare ca rând în ofertă */
function syncRows(s) {
  const caps = new Set(s.rows.filter(r => r.k === "c").map(r => r.cap));
  for (const it of s.items) { const k = it.cap || (it.cap = "Fără capitol"); if (!caps.has(k)) { caps.add(k); s.rows.push({ id: newNum(s.rows), k: "c", cap: k, den: k, ov: 0 }); } }
}
/* pune (sau scoate) suma scrisă de tine pe un capitol și însemnează pozițiile de care e legată */
function setOv(r, v, s) {
  s = s || st; const xs = s.items.filter(i => i.cap === r.cap); xs.forEach(i => { delete i.ovd; });
  if (!(v > 0)) { r.ov = 0; delete r.ovT; return; }
  r.ov = v; let t = 0; if (!r.no) xs.forEach(i => { if (!i.no && i.pret > 0) { i.ovd = 1; t += OF.total(i, s.adaos); } }); t = r2(t);
  if (t > 0) r.ovT = t; else { delete r.ovT; xs.forEach(i => { delete i.ovd; }); }
}
const rndTo = (v, s) => { if (!s) return r2(v); const q = Math.round(v / s) * s; return q > 0 ? q : r2(v); };   // un capitol mai mic decât jumătate de treaptă rămâne cum e, nu devine 0
function rowInfo(r, s) {
  s = s || st;
  if (r.k === "c") { let tot = 0, tOld = 0, n = 0, np = 0, nn = 0, ne = 0; for (const i of s.items) if (i.cap === r.cap) { if (i.no || r.no) { nn++; continue; } n++; if (i.pret > 0) { np++; if (!i.conf && i.src === "cat" && i.lv >= 3) ne++; } const t = OF.total(i, s.adaos); tot += t; if (i.ovd) tOld += t; } tot = r2(tot); tOld = r2(tOld);
    /* Suma pusă de tine pe capitol (ov) e legată de pozițiile care aveau preț în clipa aceea (ovd), când dădeau ovT. Dacă scoți din ele sau le schimbi,
       suma scade ori crește în aceeași măsură; pozițiile venite după aceea se adaugă la prețul lor. Așa nu oferi lucrări pe nimic și nu ceri bani pe ce nu mai ofertezi. */
    const off = !!r.no || (n === 0 && nn > 0), scaled = r.ov > 0 && r.ovT > 0, moved = !off && scaled && (Math.abs(tOld - r.ovT) >= 0.005 || Math.abs(tot - tOld) >= 0.005);
    return { n, np, nn, ne, tot, tOld, off, scaled, moved, val: off ? 0 : scaled ? (moved ? r2(r.ov * tOld / r.ovT + (tot - tOld)) : r.ov) : r.ov > 0 ? r.ov : rndTo(tot, s.rnd) }; }
  return { val: r.no ? 0 : r2((+r.cant || 0) * (+r.pret || 0)) };
}
function totals(s) { s = s || st; const sub = r2(s.rows.reduce((a, r) => a + rowInfo(r, s).val, 0)), tva = r2(sub * (+s.proj.tva || 0) / 100), tot = r2(sub + tva); return { sub, tva, tot, avans: r2(tot * (+s.proj.avans || 0) / 100) }; }
const nameOf = (s, e) => (s.proj.santier || "").trim() || (e && e.nume && !/^Proiect (nou|fără nume)$/.test(e.nume) ? e.nume : "") || "Ofertă fără nume";
const entry = id => IDX.list.find(x => x.id === id);
const newId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
/* Numere de ordine care nu se pot nimeri la fel pe telefon și pe laptop (altfel două rânduri puse în același timp pe două aparate s-ar călca) */
const newNum = xs => { let m = Date.now() * 1000; for (const x of xs) if (x.id > m) m = x.id; return m + 1 + Math.floor(Math.random() * 500); };
const nextRow = () => newNum(st.rows);
const nextItem = () => newNum(st.items);
const isNo = (it, s) => !!it.no || (s || st).rows.some(r => r.k === "c" && r.no && r.cap === it.cap);
const offered = s => (s || st).items.filter(i => !isNo(i, s));
const noCaps = () => st.rows.filter(r => r.no || (r.k === "c" && rowInfo(r).n === 0 && rowInfo(r).nn > 0)).map(r => r.den);
/* Prețul pe unitate care ajunge la client (anexă și fișierul lui): cu adaosul și cu tot ce a schimbat suma capitolului
   (rotunjire, sumă pusă de tine, „vreau alt total”), ca pozițiile adunate să dea suma din ofertă. */
function effPrices(s) {
  s = s || st; const out = new Map(), ad = 1 + (+s.adaos || 0) / 100;
  for (const r of s.rows) {
    if (r.k !== "c") continue; const info = rowInfo(r, s), xs = info.off ? [] : s.items.filter(i => i.cap === r.cap && !i.no && i.pret > 0); if (!xs.length) continue;
    const kOld = info.scaled ? r.ov / r.ovT : 1, k = !info.scaled && info.tot > 0 && info.val > 0 ? info.val / info.tot : 1; let sum = 0;
    xs.forEach(i => { const p = Math.max(0.01, r2(r2(i.pret * ad) * (info.scaled ? (i.ovd ? kOld : 1) : k))); out.set(i.id, p); sum += r2((+i.cant || 0) * p); });
    const d = r2(info.val - sum); if (Math.abs(d) < 0.01 || (!info.scaled && k === 1)) continue;
    let best = null, br = Infinity;                       // restul din rotunjiri merge pe poziția unde încape cel mai bine
    for (const i of xs) { const q = +i.cant || 0, p0 = out.get(i.id); if (!(q > 0)) continue; const p1 = r2(p0 + d / q); if (!(p1 > 0)) continue; const res = Math.abs(r2(d - (r2(q * p1) - r2(q * p0)))); if (res < br) { br = res; best = [i.id, p1]; if (res < 0.005) break; } }
    if (br >= 0.005) for (const i of xs) {               // nu iese la ban cu două zecimale: un singur preț primește patru zecimale (în fișier se vede tot cu două)
      const q = +i.cant || 0, p0 = out.get(i.id); if (!(q > 0)) continue; const p1 = Math.round((p0 + d / q) * 1e4) / 1e4; if (!(p1 > 0)) continue; const res = Math.abs(r2(d - (r2(q * p1) - r2(q * p0)))); if (res < br) { br = res; best = [i.id, p1]; if (res < 0.005) break; } }
    if (best) out.set(best[0], best[1]);
  }
  return out;
}
/* în Excel, la „nu include” apar singure și capitolele neofertate */
const projX = () => { const p = Object.assign({}, st.proj); for (const [k] of FF) if (!p[k] && FIRMA[k]) p[k] = FIRMA[k]; const nc = noCaps(); if (nc.length) p.nuInclude = [String(p.nuInclude || "").trim()].concat(nc.map(x => x.toLowerCase())).filter(Boolean).join("\n"); return p; };

/* ---------- salvare ---------- */
function setSaved(t, w) { SAVED = t; SAVEDW = !!w; const e = $("#saved"); if (e) { e.textContent = t; e.classList.toggle("bad", SAVEDW); } }
let REV = 0;                                  // crește la fiecare salvare: „Anulează” merge doar dacă între timp nu s-a schimbat altceva
function save() {
  if (!booted || !CUR) return; const id = CUR; REV++;
  store.put("p/" + id, () => DOCS["p/" + id]);
  const e = entry(id), nm = nameOf(st, e), d = todayIso();
  if (e && (e.nume !== nm || e.upd !== d)) { e.nume = nm; e.upd = d; store.put("index", () => IDX); }
  saveCat();
}
function saveCat() { if (catDirty) { catDirty = false; store.put("catalog", () => ({ items: catalog })); } }
function saveFirma() { store.put("firma", () => FIRMA); }
function createOffer(proj, state) {
  const id = newId(), s = normSt(state || { rows: [], items: [] });
  Object.assign(s.proj, proj || {}); if (!s.proj.nrOferta) { s.proj.nrOferta = nextNr(); s.proj.nrAuto = 1; }
  DOCS["p/" + id] = s; IDX.list.unshift({ id, nume: nameOf(s), upd: todayIso() });
  store.put("p/" + id, () => DOCS["p/" + id], 0); store.put("index", () => IDX, 0); return id;
}
const inLucru = s => (s.proj.stare || "lucru") === "lucru";
/* La pornire: ofertele în lucru făcute cu reguli mai vechi își refac prețurile o singură dată (ce ai pus, ai verificat sau nu ofertezi nu se atinge).
   Ofertele trimise, câștigate sau pierdute rămân exact cum au plecat. */
function rematchAll() {
  let ch = 0;
  Object.keys(DOCS).forEach(p => { const s = DOCS[p]; if (p.indexOf("p/") !== 0 || !s.items || !s.items.length || !inLucru(s)) return;
    if (s.mv !== OF.MV) autoMatch(null, s); else if (PIATA && !s.mk && s.items.some(i => !i.no && !(i.pret > 0))) autoMatch(s.items.filter(i => !i.no && !(i.pret > 0)), s); else return;
    store.put(p, () => DOCS[p]); ch++; });
  if (ch && !isOpen()) render();
}
function openOffer(id) {
  CUR = id; st = DOCS["p/" + id]; SCV.LS.set("scv-oferta-cur", id);
  if (st.items.length && st.mv !== OF.MV && inLucru(st)) { autoMatch(); save(); }
}

/* ---------- prețuri: catalog, potrivire, învățare ---------- */
function rebuildCat() { pcat = OF.prepCatalog(catalog); PX = null; TAR = null; }
const catById = id => pcat.find(c => c.id === id);
/* documentul „ref2”: rândurile din alte oferte ale tale, scrise scurt (denumire, unitate, preț, sursă) */
function ref2Items() { const d = DOCS.ref2 || {}, src = d.src || []; return (d.items || []).concat((d.rows || []).map(r => { const z = src[r[3]] || {}; return { d: r[0], u: r[1], p: r[2], pr: z.pr || "", an: z.an || "", s: "s" }; })); }
/* Tariful: tot ce știu despre prețurile tale, pus la un loc (prețurile puse de tine, lista ta, ofertele vechi, bugete, piață). */
function tarif() {
  if (TAR) return TAR; const S = [];
  catalog.forEach(c => S.push({ den: c.den, desc: c.desc, um: c.um, pret: c.pret, q: c.learned ? OF.QUAL.mine : OF.QUAL.cat, an: c.an || 2026, lab: c.learned ? (c.sec ? "prețul tău (" + String(c.sec).trim() + ")" : "prețul tău") : "lista ta de prețuri", dom: c.dom, sec: c.sec, id: c.id, learned: !!c.learned && !c.imp, fam: c.fam || undefined, sz: c.sz, vars: c.vars }));
  REF.forEach((r, i) => S.push({ den: r.d, um: r.u, pret: r.p, q: r.s === "s" ? OF.QUAL.ref : OF.QUAL.weak, an: r.an, lab: (r.pr || "ofertă veche") + (r.an ? ", " + r.an : ""), id: "r" + i }));
  const R2 = DOCS.ref2 || {}; (R2.pts || []).forEach((p, i) => { if (p[2] == null && OF.isBroad(p[0])) return; S.push({ den: OF.famLabel(p[0]).replace(/ \(.*$/, ""), fam: p[0], um: p[1], sz: p[2], pret: p[3], q: OF.QUAL.weak, an: R2.an || 2026, lab: R2.lab || "bugete de antreprenor", id: "b" + i }); });
  ((PIATA && PIATA.lista) || []).forEach((p, i) => { const v = +p.eng || +p.tipic || (p.min && p.max ? (p.min + p.max) / 2 : 0); if (p.fam && v > 0) S.push({ den: p.lucrare, fam: p.fam, vars: p.vars, um: String(p.um || "").replace(/^lei\//, "").replace("m2", "mp"), pret: v, q: OF.QUAL.mkt, lab: "piață", lo: p.lo, hi: p.hi, id: "m" + i }); });
  return TAR = OF.buildTarif(S);
}
/* Pune preț pe tot ce poate și spune de unde l-a luat și cât de sigur e. Ce ai pus, ai verificat sau ai trecut „nu ofertez” nu se atinge. */
/* reperele din bugete de antreprenor: un preț mediu pe familie. Le folosesc doar la familiile înguste sau cu dimensiune (la „ventilație” ori „rezervor” un mijlociu nu spune nimic). */
function ref2Pts() { return ((DOCS.ref2 && DOCS.ref2.pts) || []).filter(p => p[2] != null || !OF.isBroad(p[0])); }
function autoMatch(only, S) {
  S = S || st; const T = tarif(); let a = 0, e = 0, z = 0;
  for (const it of (only || S.items)) {
    if (it.no) continue;
    if (it.pret > 0 && (it.src === "manual" || it.src === "file" || it.conf || it.ap)) continue;
    it.sug = null; it.sugR = null; const r = OF.priceItem(it, T);
    if (!r) { if (it.src === "cat" || it.src === "ref") { it.pret = 0; it.src = ""; } it.lv = 0; it.sugW = ""; it.lab = ""; it.catId = null; z++; continue; }
    it.pret = r.p; it.src = "cat"; it.lv = r.lv; it.sugW = r.why; it.lab = r.lab || ""; it.catId = typeof r.id === "number" ? r.id : null; it.conf = false; r.lv <= 2 ? a++ : e++;   // „verificat” e doar ce ai confirmat tu în oferta asta; prețul tău de altădată apare ca „din prețurile tale”
  }
  S.items.forEach(it => { if (it.pret > 0 && !it.src) it.src = "file"; }); S.mv = OF.MV; S.mk = PIATA ? 1 : 0;   // mk: reperele de piață erau încărcate când s-au pus prețurile
  return { a, e, z };
}
/* prețul pus de tine rămâne ținut minte pentru denumirea asta (și, prin familie, pentru cele scrise altfel) */
const newCatId = () => { let m = Date.now() * 1000; for (const c of catalog) if (c.id > m) m = c.id; return m + 1 + Math.floor(Math.random() * 500); };   // două aparate pot învăța câte un preț în același timp
function learn(it) {
  if (!(it.pret > 0) || !String(it.den || "").trim()) return;
  const k = OF.keyOf(it.den), f = OF.umFamily(it.um); let c = catalog.find(x => x.learned && OF.keyOf(x.den) === k && OF.umFamily(x.um) === f);
  const h = { p: +it.pret, d: todayIso(), o: st ? nameOf(st, entry(CUR)) : "" };
  if (c) { if (+c.pret !== +it.pret || !(c.h || []).length) c.h = [h].concat((c.h || []).filter(x => !(x.d === h.d && x.o === h.o))).slice(0, 6); c.pret = +it.pret; }
  else catalog.push({ id: newCatId(), dom: "ÎNVĂȚAT", sec: "", den: it.den, desc: "", um: it.um, pret: +it.pret, learned: true, h: [h] });
  catDirty = true; rebuildCat();
}
/* căutare în toate prețurile, pentru sugestiile de la „Rând nou” și pentru ecranul „Prețurile mele” */
function priceIndex() {
  if (PX) return PX; PX = [];
  const fam = (d, u) => { try { return OF.classify(d, u).fam || ""; } catch (e) { return ""; } };
  catalog.forEach(c => PX.push({ t: c.learned ? "m" : "c", s: OF.strip(c.den + " " + (c.desc || "")), den: OF.entryLabel(c), um: c.um, p: +c.pret, sub: c.learned ? "prețul tău" : "catalogul tău" + (c.dom ? " · " + String(c.dom).toLowerCase() : ""), w: c.learned ? 3 : 2, id: c.id, fam: fam(c.desc || c.den, c.um) }));
  REF.forEach((r, i) => PX.push({ t: "r", s: OF.strip(r.d + " " + (r.pr || "")), den: r.d, um: r.u, p: +r.p, sub: (r.pr || "ofertă veche") + (r.an ? ", " + r.an : ""), w: r.s === "p" ? 0 : 1, an: +r.an || 0, ri: i, fam: fam(r.d, r.u) }));
  return PX;
}
function searchPrices(q, lim, types) {
  const s = OF.strip(q), ws = s.split(/[^a-z0-9./"']+/).filter(w => w.length > 1); if (!ws.length) return [];
  let qf = ""; try { qf = OF.classify(q, "").fam || ""; } catch (e) { }
  const out = [];
  for (const e of priceIndex()) {
    if (types && !types.includes(e.t)) continue;
    let hit = 0; for (const w of ws) if (e.s.includes(w)) hit++;
    const famHit = qf && e.fam === qf;
    if (hit < ws.length && !(famHit && hit >= ws.length - 1)) continue;
    out.push({ e, sc: hit * 10 + (famHit ? 6 : 0) + e.w * 3 + (e.s.indexOf(ws[0]) === 0 ? 2 : 0) + (e.an ? (e.an - 2022) * 0.8 : 0) - e.s.length / 400 });
  }
  out.sort((a, b) => b.sc - a.sc); const seen = new Set(), res = [];
  for (const o of out) { const k = OF.keyOf(o.e.den) + "|" + o.e.um + "|" + o.e.p; if (seen.has(k)) continue; seen.add(k); res.push(o.e); if (res.length >= (lim || 6)) break; }
  return res;
}
/* ---------- fișe, ecrane peste aplicație, mesaje ---------- */
const ovl = () => $("#ovl");
const isOpen = () => !!ovl().firstChild;
/* cursorul se pune singur în prima căsuță doar dacă n-ai apucat tu să intri în alta (altfel ți-ar muta scrisul în altă căsuță) */
const typing = f => { const a = document.activeElement; return !f.isConnected || (a && a !== f && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && ovl().contains(a)); };
function closeOvl() { ovl().innerHTML = ""; document.body.style.overflow = ""; }
function sheet(html) { if (!UNDO) { const tq = $("#toast"); if (tq) tq.classList.remove("on"); } ovl().innerHTML = '<button class="scrim" data-a="x" aria-label="Închide"></button><div class="sheet" role="dialog" aria-modal="true">' + html + "</div>"; document.body.style.overflow = "hidden"; const f = $(".sheet [autofocus]"); if (f) setTimeout(() => { if (typing(f)) return; f.focus(); if (f.select) f.select(); }, 60); return $(".sheet"); }
function full(html) { ovl().innerHTML = '<div class="full" role="dialog" aria-modal="true"><div class="in">' + html + "</div></div>"; document.body.style.overflow = "hidden"; const f = $(".full [autofocus]"); if (f) setTimeout(() => { if (!typing(f)) f.focus(); }, 60); return $(".full"); }
const h3 = t => `<h3>${t}<button data-a="x" aria-label="Închide">${ic("x", 22, 2.2)}</button></h3>`;
let toastT = null, UNDO = null;
function toast(t, undo) {
  const e = $("#toast"); UNDO = undo || null;
  e.innerHTML = "<span>" + esc(t) + "</span>" + (undo ? '<button data-a="undo">Anulează</button>' : ""); e.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => { e.classList.remove("on"); UNDO = null; }, undo ? 7000 : 2600);
}
/* schimbare care se poate anula din mesajul de jos */
function undoable(msg, fn) {
  const id = CUR, snap = JSON.stringify(st), cat = JSON.stringify(catalog); fn(); save(); render(); const rv = REV;
  toast(msg, () => { if (REV !== rv || CUR !== id) { toast("Nu mai pot anula: ai schimbat altceva între timp."); return; } DOCS["p/" + id] = normSt(JSON.parse(snap)); st = DOCS["p/" + id]; catalog = JSON.parse(cat); catDirty = true; rebuildCat(); save(); render(); });
}
const sw = (id, label, on) => `<button class="sw${on ? " on" : ""}" data-a="sw" id="${id}" role="switch" aria-checked="${on ? "true" : "false"}"><span>${label}</span><i></i></button>`;
const isOn = id => { const e = $("#" + id); return !!e && e.classList.contains("on"); };
const fld = (id, label, val, o) => { o = o || {}; return `<label class="lb" for="${id}">${label}</label>` + (o.area ? `<textarea class="inp" id="${id}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ""}>${esc(val)}</textarea>` : `<input class="inp" id="${id}" value="${esc(val)}" ${o.n ? 'inputmode="decimal"' : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} ${o.af ? "autofocus" : ""} autocomplete="off">`); };
const val = id => { const e = $("#" + id); return e ? e.value.trim() : ""; };

/* ---------- drumul prin aplicație (adresa din bară) ---------- */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  if (h[0] === "o" && h[1]) { if (h[2] === "c" && h[3]) return { name: "pos", id: h[1], row: +h[3] }; if (h[2] === "fara") return { name: "pos", id: h[1], row: 0, f: "no" }; if (h[2] === "verifica") return { name: "pos", id: h[1], row: 0, f: "est" }; return { name: "offer", id: h[1] }; }
  if (h[0] === "preturi") return { name: "prices" }; if (h[0] === "firma") return { name: "firma" };
  return { name: "list" };
}
function go(h) { if (location.hash === h) route(); else location.hash = h; }
function route() {
  if (!booted) return; const v = parseHash();
  if (v.id) { if (!DOCS["p/" + v.id]) { location.replace("#/"); return; } if (v.id !== CUR || !st) openOffer(v.id); if (v.name === "pos" && v.row && !st.rows.some(r => r.id === v.row)) { location.replace("#/o/" + v.id); return; } }
  const same = VIEW.name === v.name && VIEW.id === v.id && VIEW.row === v.row;
  VIEW = same ? Object.assign(VIEW, v) : v; closeOvl(); render(); if (!same) window.scrollTo(0, 0);
  if (AFTER) { const f = AFTER; AFTER = null; f(); }
}
function render() {
  const v = VIEW, top = v.name === "list" || v.name === "prices" || v.name === "firma";
  $("#app").innerHTML = v.name === "list" ? vList() : v.name === "offer" ? vOffer() : v.name === "pos" ? vPos() : v.name === "prices" ? vPrices() : vFirma();
  $("#nav").hidden = !top; $$("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === v.name));
  setSaved(SAVED, SAVEDW);
}
const stPill = '<div class="st" id="saved"></div>';

/* ---------- lista ofertelor ---------- */
function listData() { const all = IDX.list.map(e => ({ e, s: DOCS["p/" + e.id] })).filter(x => x.s), c = { all: 0, lucru: 0, trimisa: 0, castigata: 0, pierduta: 0, arh: 0 }; all.forEach(x => { if (x.e.arh) c.arh++; else { c.all++; const k = x.s.proj.stare || "lucru"; c[k in c ? k : "lucru"]++; } }); return { all, c }; }
function listRows() {
  const { all } = listData(), f = VIEW.f || "all", q = OF.strip(VIEW.q || "");
  const xs = all.filter(x => f === "arh" ? x.e.arh : !x.e.arh && (f === "all" || f === (x.s.proj.stare || "lucru")))
    .filter(x => !q || OF.strip(nameOf(x.s, x.e) + " " + (x.s.proj.beneficiar || "") + " " + (x.s.proj.nrOferta || "")).includes(q))
    .sort((a, b) => String(b.e.upd || "").localeCompare(String(a.e.upd || "")));
  if (!xs.length) return `<div class="emp">${q || f !== "all" ? "Nicio ofertă aici." : "<b>Nu ai nicio ofertă încă.</b>Apasă „Ofertă nouă” și fă prima."}</div>`;
  return '<div class="ofl">' + xs.map(x => {
    const s = x.s, p = s.proj, t = totals(s), of = offered(s), n = of.length, np = of.filter(i => i.pret > 0).length, sr = p.stare || "lucru";
    const tag = n && np < n ? `<span class="w">${np} din ${n} cu preț</span>` : `<span class="${sr === "castigata" ? "p" : sr === "pierduta" ? "n" : ""}">${STARI[sr] || STARI.lucru}</span>`;
    return `<div class="ofw"><button class="of" data-a="open" data-id="${x.e.id}"><div class="tx"><b>${esc(nameOf(s, x.e))}</b><span>${esc([p.beneficiar, p.data].filter(Boolean).join(" · ") || "fără beneficiar")}</span></div><div class="am"><b>${fmt(t.sub)} lei</b>${tag}</div></button><button class="ofm" data-a="lmenu" data-id="${x.e.id}" aria-label="Mai multe pentru oferta ${esc(nameOf(s, x.e))}">${ic("ellipsis-vertical", 20, 2.2)}</button></div>`;
  }).join("") + "</div>";
}
function vList() {
  const { c } = listData(), f = VIEW.f || "all", ch = (k, t, n, always) => n || always || f === k ? `<button data-a="lf" data-f="${k}" class="${f === k ? "on" : ""}">${t} · ${n}</button>` : "";
  return `<div class="top"><div class="tt"><h1>Ofertele mele</h1></div>${stPill}</div><main>
<button class="pri" data-a="new" id="bNew">${ic("plus", 22, 2.6)}Ofertă nouă</button>
<div class="srch" style="margin-top:14px">${ic("search", 20, 2.2)}<input id="lq" data-i="lq" placeholder="Caută o ofertă" value="${esc(VIEW.q || "")}" autocomplete="off"></div>
<div class="fl">${ch("all", "Toate", c.all, 1)}${ch("lucru", "În lucru", c.lucru, 1)}${ch("trimisa", "Trimise", c.trimisa, 1)}${ch("castigata", "Câștigate", c.castigata)}${ch("pierduta", "Pierdute", c.pierduta)}${ch("arh", "Arhivă", c.arh)}</div>
<div id="lst">${listRows()}</div></main>`;
}

/* ---------- oferta: foaia ---------- */
function rowHtml(r, i) {
  const x = rowInfo(r), nr = (i + 1) * 10;
  if (r.k === "c") {
    const pct = x.n ? Math.round(100 * x.np / x.n) : 0, off = r.no || (!x.n && x.nn > 0);
    return `<button class="tr${off ? " off" : ""}" data-a="cap" data-id="${r.id}"><i>${nr}</i><div><b>${esc(r.den)}</b><span>${off ? (x.nn === 1 ? "o poziție, nu o ofertez" : plural(x.nn, "o poziție", "poziții") + ", nu le ofertez") : x.n ? `${x.n === 1 ? (x.np ? "poziția are preț" : "poziția nu are preț") : x.np + " din " + x.n + " poziții au preț"}${x.ne ? " · " + x.ne + " de verificat" : ""}${x.nn ? " · " + x.nn + " neofertate" : ""}` : "nicio poziție"}${r.ov > 0 && !off ? (x.moved ? " · pornind de la suma ta" : " · sumă pusă de tine") : ""}</span>${x.n && !off ? `<div class="mb"><u style="width:${pct}%"></u></div>` : ""}</div>${off ? `<strong class="n">nu ofertez${ic("chevron-right", 15, 2.4)}</strong>` : x.val > 0 ? `<strong>${fmt(x.val)}${ic("chevron-right", 15, 2.4)}</strong>` : `<strong class="n">fără preț${ic("chevron-right", 15, 2.4)}</strong>`}</button>`;
  }
  return `<button class="tr${r.no ? " off" : ""}" data-a="row" data-id="${r.id}"><i>${nr}</i><div><b>${esc(r.den)}</b><span>${r.no ? "nu ofertez" : `${fq(r.cant)} ${esc(r.um)} × ${fmt(r.pret)} lei`}</span></div>${r.no ? `<em class="z">—</em>` : x.val !== 0 ? `<em>${fmt(x.val)}</em>` : `<em class="z">pune preț</em>`}</button>`;
}
/* ---------- verificare înainte de trimitere: lucrări care se uită de obicei, prețuri ieșite din tipar, date lipsă ---------- */
const CHK_W = [   // [cheie, familiile care o „dovedesc”, cuvinte care arată că e deja pomenită la include / nu include, când se pune întrebarea, titlu, textul de pus la include / nu include]
  ["proba", ["proba"], /\bprob/, f => f.pipe, "Nu văd nicio probă de presiune", "probe de presiune și de funcționare", "Normativele cer probă la rece, la cald și de funcționare. Dacă nu scrie nicăieri, beneficiarul poate spune că e în preț."],
  ["spalare", ["spalare"], /spalar|dezinfect/, f => f.apa, "Nu văd spălarea și dezinfectarea instalației", "spălarea și dezinfectarea instalației", "La instalațiile de apă se cere spălare și, la apa potabilă, dezinfectare înainte de dare în folosință."],
  ["pif", ["pif"], /puner\w+ in functiune|\bpif\b/, f => f.ech, "Nu văd punerea în funcțiune a echipamentelor", "punerea în funcțiune a echipamentelor", "Lista are echipamente (centrală, pompe, boiler, grup de pompare). Punerea lor în funcțiune se plătește de obicei separat."],
  ["gol", ["gol", "strapungere"], /\bgol|strapung|carot/, f => f.pipe, "Golurile și străpungerile nu sunt pomenite", "goluri, străpungeri și carotări prin pereți și planșee", "Sunt cea mai deasă sursă de discuții pe șantier. Scrie limpede dacă sunt sau nu în preț."],
  ["foc", ["etans_foc"], /\bfoc\b|antifoc|ignifug/, f => f.pipe, "Etanșările antifoc la treceri nu sunt pomenite", "etanșări antifoc la trecerile prin pereți și planșee", "Trecerile prin pereți și planșee rezistente la foc trebuie etanșate. Scrie dacă le faci tu sau nu."],
  /* din cercetarea din 15.11.2026: ce lipsește des din oferte, după tipul lucrării */
  ["fixare", ["fixare"], /bratar|brid|colier|suport/, f => f.pipe >= 5, "Nu văd brățări / suporți pentru țevi", "brățări, bride și suporți pentru conducte", "În devize apar ca poziții separate, pe fiecare diametru. Dacă nu sunt în listă, scrie limpede dacă sunt în preț."],
  ["aerisire", ["caciula", "aerator"], /caciul|cap de coloan|aerisire|ventilare coloan/, f => f.canal >= 2, "Nu văd căciula de ventilație / capul de coloană", "căciulile de ventilație la coloanele de canalizare", "Coloanele de canalizare se termină cu căciulă de ventilație (sau aerator). Se uită des."],
  ["coltar", ["rob_coltar"], /coltar|robinet\w* de colt/, f => f.obiecte >= 2, "Nu văd robineții colțar la obiectele sanitare", "robineți colțar la obiectele sanitare", "La fiecare lavoar, vas WC sau spălător se montează robinet colțar. Dacă sunt ale beneficiarului, scrie asta."],
  ["filtru", ["filtru_y"], /filtru/, f => f.cazan, "Nu văd filtrul (magnetic) la centrală", "filtru magnetic / de impurități la centrală", "La o centrală nouă pe instalație veche, producătorii cer filtru magnetic pentru garanție."],
  ["evac", [], /evacuar|cos de fum|kit de evacuare|tiraj/, f => f.cazan, "Nu văd kitul de evacuare / coșul de fum", "kitul de evacuare a gazelor arse / coșul de fum", "Centrala murală pe gaz are nevoie de kit de evacuare; montajul lui se plătește de obicei separat."],
  ["siguranta", ["supapa_sig"], /grup\w* de siguranta|supap/, f => f.boiler, "Nu văd grupul de siguranță la boiler", "grupul de siguranță la boiler", "Boilerul se montează cu grup / supapă de siguranță. Se uită des."],
  ["anre", [], /anre|receptie|documentati/, f => f.gaz, "Nu e pomenită documentația și recepția ANRE", "documentația și recepția ANRE pentru instalația de gaze", "La gaze, proiectul, dosarul și recepția cu firmă autorizată ANRE costă separat. Scrie cine le face."],
];
/* Ce costă o lucrare întreagă pe aparat: sumele de pe sanitare, termice, hidranți împărțite la câte obiecte, calorifere, cutii de hidrant are lista.
   Comparația se face cu ofertele tale de până acum; dacă nu sunt destule, cu oferta ta pe capitole din 27.07.2026. */
/* pentru verificări automate (teste): citire, fără să schimbe nimic */
window.OFAPP = { indOf: s => indOf(s), counts: () => OF.counts(offered()), items: () => offered().map(i => ({ den: i.den, um: i.um, cant: i.cant, pret: i.pret, dom: OF.domainOf(i.den, i.um) })), checks: () => checkOffer().map(x => x.t), totals: () => totals(), mkt: den => mktOf({ den, um: "buc" }) };
const IND0 = { obiecte: [1500, "lei pe obiect sanitar", "s"], calorifere: [1200, "lei pe calorifer", "t"], cuti: [3500, "lei pe hidrant", "h"] };
const INDF = { obiecte: [/sanitar/, /^(?:lavoar|vas_wc|pisoar|cada|spalator|bideu)$/], calorifere: [/termic|incalzir/, /^(?:radiator|rad_baie)$/], cuti: [/hidrant|incendiu|psi/, /^hidrant_int$/] };
function indOf(s) {   // pe capitolele care sunt clar sanitare / termice / hidranți: suma capitolului ÷ câte obiecte, calorifere, cutii de hidrant are
  s = s || st; const o = {};
  for (const r of s.rows) {
    if (r.k !== "c" || r.no) continue; const nm = OF.strip(r.cap + " " + r.den), k = Object.keys(INDF).find(x => INDF[x][0].test(nm)); if (!k || o[k]) continue;
    const xs = s.items.filter(i => i.cap === r.cap && !isNo(i, s)); if (!xs.length) continue;
    let n = 0, np = 0; xs.forEach(i => { let c = null; try { c = OF.classify(i.den, i.um); } catch (e) { } if (c && c.fam && INDF[k][1].test(c.fam) && OF.umFamily(i.um) === "buc") { n += +i.cant || 0; if (i.pret > 0) np += +i.cant || 0; } });
    const pr = xs.filter(i => i.pret > 0).length, val = rowInfo(r, s).val;
    if (n >= 3 && np >= n * 0.8 && pr >= xs.length * 0.8 && val > 0) o[k] = { n, v: r2(val), per: r2(val / n), cap: r.den };   // doar când aproape totul are preț: altfel „prea puțin” ar însemna doar „fără preț”
  }
  return o;
}
let INDH = null;
function indHist() {   // mediana din ofertele tale (fără cea deschisă), pe fiecare indicator
  const key = IDX.list.length + "|" + CUR; if (INDH && INDH.key === key) return INDH.v; const acc = {};
  IDX.list.forEach(e => { if (e.id === CUR) return; const s = DOCS["p/" + e.id]; if (!s || !s.items || !s.items.length) return; let o = {}; try { o = indOf(s); } catch (x) { } Object.keys(o).forEach(k => (acc[k] = acc[k] || []).push(o[k].per)); });
  const v = {}; Object.keys(acc).forEach(k => { const a = acc[k].sort((x, y) => x - y); if (a.length >= 2) v[k] = { per: a[Math.floor(a.length / 2)], n: a.length }; });
  INDH = { key, v }; return v;
}
function checkOffer() {
  const p = st.proj, items = offered(), out = [], fam = new Map(); let pipe = 0, apa = 0, ech = 0;
  const of = items.concat(st.rows.filter(r => r.k !== "c" && !r.no && r.den).map(r => ({ den: r.den, um: r.um, cant: r.cant, pret: r.pret, src: "", conf: true, row: r.id })));   // și rândurile scrise de mână
  of.forEach(it => { let c = null; try { c = OF.classify(it.den, it.um); } catch (e) { } const f = c && c.fam ? c.fam.replace(/:.*$/, "") : ""; fam.set(f, (fam.get(f) || 0) + 1);
    if (c && c.fam && c.fam.indexOf("teava:") === 0) { pipe++; if (c.grp === "s" && !/pvc|pp$|fonta/.test(c.fam) && !(c.vars || []).some(v => v === "canalizare" || v === "pluvial")) apa++; }
    if (["cazan", "pompa", "boiler", "grup_pompare", "pompa_caldura"].includes(f)) ech++; });
  const fara = items.filter(i => !(i.pret > 0)).length, nest = items.filter(i => stOf(i) === "est").length;
  if (!of.length) return out;
  if (fara) out.push({ t: plural(fara, "O poziție nu are", "poziții nu au") + " preț", s: "Ori le pui preț, ori le treci la „nu ofertez”. Altfel oferta pleacă fără ele în sumă.", b: [["go", "#/o/" + CUR + "/fara", "Arată-le"]] });
  if (nest) out.push({ t: plural(nest, "Un preț e estimat și nevăzut de tine", "prețuri sunt estimate și nevăzute de tine"), s: "Sunt socotite de aplicație, nu puse de tine. Uită-te peste ele înainte să trimiți.", b: [["go", "#/o/" + CUR + "/verifica", "Verifică"]] });
  // prețuri ieșite din tipar față de prețurile tale pentru aceeași lucrare
  const T = tarif(), odd = [];
  of.forEach(it => { if (!(it.pret > 0) || (it.src === "cat" && !it.conf)) return; let r = null; try { r = OF.priceItem({ den: it.den, um: it.um, cap0: it.cap0, cap: it.cap }, T); } catch (e) { }
    if (r && r.lv <= 2 && r.p > 0 && (it.pret < r.p * 0.5 || it.pret > r.p * 2)) odd.push({ it, r, d: Math.abs(it.pret - r.p) * (+it.cant || 0) }); });
  odd.sort((a, b) => b.d - a.d).slice(0, 6).forEach(o => out.push({ t: "Preț neobișnuit: " + (o.it.den.length > 60 ? o.it.den.slice(0, 60) + "…" : o.it.den), s: "În ofertă e " + fmt(o.it.pret) + " lei / " + (o.it.um || "buc") + ", iar în prețurile tale e " + fmt(o.r.p) + " lei. Poate e voit, poate e o greșeală de tastare.", b: [o.it.row != null ? ["row", o.it.row, "Deschide rândul"] : ["pos", o.it.id, "Deschide poziția"]] }));
  const nc = OF.counts(items), canal = of.reduce((a, it) => { const c = OF.classify(it.den, it.um); return a + (c && c.fam && /^teava:(pp|pvc|fonta)$/.test(c.fam) ? 1 : 0); }, 0);
  const txt = OF.strip(String(p.includeTxt || "") + " \n " + String(p.nuInclude || "")), F = { pipe, apa, ech, canal, obiecte: nc.obiecte || 0, cazan: !!fam.get("cazan"), boiler: !!fam.get("boiler"), gaz: (fam.get("gaz") || 0) >= 2 };
  // sumă pe aparat față de ofertele tale (sau față de oferta pe capitole din iulie 2026)
  try { const io = indOf(), ih = indHist(); Object.keys(io).forEach(k => { const x = io[k], h = ih[k], ref = h ? h.per : IND0[k][0], src = h ? "în " + plural(h.n, "o ofertă de-a ta", "oferte de-ale tale") + " (mediana)" : "în oferta ta pe capitole din 27.07.2026";
    if (x.per < ref * 0.5 || x.per > ref * 2) out.push({ t: (x.per < ref ? "Prea puțin" : "Mult") + " pe " + IND0[k][1].replace(/^lei pe /, "") + ": " + fmt(x.per) + " lei", s: "Pe " + plural(x.n, "un aparat", "aparate") + " ies " + fmt(x.v) + " lei, adică " + fmt(x.per) + " " + IND0[k][1] + ". " + src.charAt(0).toUpperCase() + src.slice(1) + " era " + fmt(ref) + " " + IND0[k][1] + ". Poate lipsesc poziții, poate e o zecimală greșită – sau e voit.", b: [] }); }); } catch (e) { }
  CHK_W.forEach(w => { if (!w[3](F) || w[1].some(f => fam.get(f)) || w[2].test(txt)) return; out.push({ t: w[4], s: w[6], b: [["chkinc", w[0], "E în preț"], ["chknu", w[0], "Nu e în preț"]] }); });
  if (!String(p.beneficiar || "").trim()) out.push({ t: "Lipsește beneficiarul", s: "Oferta pleacă fără numele celui căruia îi e adresată.", b: [["hben", "", "Scrie-l"]] });
  if (!String(p.santier || "").trim()) out.push({ t: "Lipsește lucrarea", s: "Scrie pentru ce lucrare e oferta (adresa sau numele șantierului).", b: [["hluc", "", "Scrie-o"]] });
  return out;
}
function vOffer() {
  const p = st.proj, e = entry(CUR), t = totals(), of = offered(), fara = of.filter(i => !(i.pret > 0)).length, nest = of.filter(i => stOf(i) === "est").length, ch = ic("chevron-right", 15, 2.4);
  const nu = String(p.nuInclude || "").split("\n").map(x => x.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean), inc = String(p.includeTxt || "").split("\n").map(x => x.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);
  return `<div class="top"><button class="ibn" data-a="back" data-h="#/" aria-label="Înapoi la oferte">${ic("chevron-left", 22, 2.4)}</button><div class="tt"><b>${esc(nameOf(st, e))}</b><small>${esc(p.beneficiar || "fără beneficiar")} · ${fmt(t.sub)} lei${e && e.arh ? " · în arhivă" : ""}</small></div>${stPill}<button class="ibn" data-a="menu" aria-label="Mai multe">${ic("ellipsis", 20, 2.2)}</button></div><main>
<div class="paper" id="paper">
<button class="band" data-a="hnr"><div><b>OFERTĂ DE PREȚ</b><span>manoperă instalații · ${STARI[p.stare] || STARI.lucru}</span></div><div><b>Nr. ${esc(p.nrOferta || "—")}</b><span>${esc(p.data || "")} · valabilă ${plural(+p.valab || 0, "o zi", "zile")}</span></div></button>
<button class="fr" data-a="hben"><span>Beneficiar</span><b class="${p.beneficiar ? "" : "ph"}"><i>${esc(p.beneficiar || "apasă și scrie")}</i>${ch}</b></button>
<button class="fr" data-a="hluc"><span>Lucrarea</span><b class="${p.santier ? "" : "ph"}"><i>${esc(p.santier || "apasă și scrie")}</i>${ch}</b></button>
<div class="th"><span>Nr.</span><span>Denumire</span><span>Valoare fără TVA</span></div>
${st.rows.length ? st.rows.map(rowHtml).join("") : '<div class="hint">Oferta e goală. Apasă „Rând nou” și scrie prima lucrare, sau adu o listă.</div>'}
<div class="add"><button data-a="row" data-id="0" id="bRow">${ic("plus", 16, 2.6)}Rând nou</button><button data-a="imp" id="bImp">${ic("file-spreadsheet", 16, 2.2)}Adu o listă</button></div>
${fara ? `<button class="wrn" data-a="go" data-h="#/o/${CUR}/fara">${ic("triangle-alert", 16, 2.2)}${plural(fara, "o poziție nu are", "poziții nu au")} încă preț<span>arată-le</span></button>` : ""}
${nest ? `<button class="wrn q" data-a="go" data-h="#/o/${CUR}/verifica">${ic("circle-help", 16, 2.2)}${plural(nest, "un preț e estimat", "prețuri sunt estimate")}<span>verifică</span></button>` : ""}
${of.length || st.rows.some(r => r.k !== "c") ? (nchk => `<button class="wrn q" data-a="chk" id="bChk">${ic("list-checks", 16, 2.2)}Verificare înainte de trimitere<span>${nchk ? plural(nchk, "un lucru", "lucruri") + " de văzut" : "e în regulă"}</span></button>`)(checkOffer().length) : ""}
<div class="tl"><span>${fara ? "Subtotal până acum" : "Subtotal manoperă"} (fără TVA)</span><b id="tSub">${fmt(t.sub)}</b></div>
${condTxt() ? `<button class="am2 cnd" data-a="opts"><b>Condiții:</b> ${esc(condTxt())} – adaos total ${fq(st.adaos)}%</button>` : ""}
<div class="tl"><span>TVA ${fq(p.tva)}%</span><b>${fmt(t.tva)}</b></div>
<div class="tl T"><span>TOTAL CU TVA</span><span id="tTot">${fmt(t.tot)} lei</span></div>
<button class="gr" data-a="cond"><b>Avans ${fq(p.avans)}%</b> la semnare: ${fmt(t.avans)} lei · <b>Garanție</b> ${fq(p.garantie)} luni · <b>Termen:</b> ${esc(p.termen || "—")}</button>
${inc.length ? `<button class="am2 inc" data-a="inc"><b>Include:</b> ${esc(inc.join(", "))}</button>` : ""}
<button class="am2" data-a="inc"><b>Nu include:</b> ${esc(nu.join(", ") || "apasă și scrie")}</button>
</div></main>
<div class="bar bt"><div class="btot" id="bTot"><small>${of.length ? (of.length - fara) + " din " + of.length + " poziții au preț" : "fără TVA"}</small><b>${fmt(t.sub)} lei</b><small>cu TVA ${fmt(t.tot)}</small></div><button class="pri" data-a="xl" id="bXl">${ic("file-spreadsheet", 20, 2.2)}Excel</button></div>`;
}

/* ---------- pozițiile unui capitol (lista lungă) ---------- */
const stOf = it => isNo(it) ? "nu" : it.pret > 0 ? (it.conf ? "ok" : it.src === "cat" && it.lv >= 3 ? "est" : "sig") : "no";
const SRC = { cat: "din prețurile tale", file: "din fișier", ref: "din ofertă veche", manual: "pus de tine" };
function posAll() { const r = VIEW.row ? st.rows.find(x => x.id === VIEW.row) : null; return { r, xs: r ? st.items.filter(i => i.cap === r.cap) : st.items }; }
const inF = (it, f) => f === "all" || (f === "lucru" ? (s => s === "no" || s === "est")(stOf(it)) : stOf(it) === f);
function posShown() { const f = VIEW.f || "all", q = OF.strip(VIEW.q || ""); return posAll().xs.filter(it => inF(it, f) && (!q || OF.strip(it.den + " " + (it.cod || "")).includes(q))); }
/* ---------- piața: interval, din câte surse, și unde stă prețul tău față de ea (cercetarea din 15.11.2026) ---------- */
let TMK = null;
function mktTarif() {
  if (TMK && TMK.P === PIATA) return TMK.T; const S = [];
  ((PIATA && PIATA.lista) || []).forEach((p, i) => { const v = +p.eng || +p.tipic || (p.min && p.max ? (p.min + p.max) / 2 : 0); if (p.fam && v > 0) S.push({ den: p.lucrare, fam: p.fam, vars: p.vars, um: String(p.um || "").replace(/^lei\//, "").replace("m2", "mp"), pret: v, q: OF.QUAL.mkt, lab: "piață", id: "m" + i }); });
  TMK = { P: PIATA, T: OF.buildTarif(S), c: new Map() }; return TMK.T;
}
/* Reperul de piață al poziției: {min, max, tipic, n, sigur, ref, k} sau null. Doar când reperul e din aceeași familie de lucrări (nu „ceva asemănător”). */
function mktOf(it) {
  if (!PIATA || !it || !String(it.den || "").trim()) return null;
  const T = mktTarif(), key = it.den + "|" + it.um + "|" + (it.cod || "") + "|" + (it.cap0 || it.cap || "");
  if (TMK.c.has(key)) return TMK.c.get(key);
  let r = null, o = null; try { r = OF.priceItem({ den: it.den, um: it.um, cod: it.cod, cap: it.cap, cap0: it.cap0 }, T); } catch (e) { }
  if (r && typeof r.id === "string" && r.id[0] === "m") {
    const p = PIATA.lista[+r.id.slice(1)], v = p ? (+p.eng || +p.tipic || (p.min + p.max) / 2) : 0, k = v > 0 ? r.p / v : 1;   // „zeci m”, „sute m”: intervalul se înmulțește la fel ca prețul
    if (p && p.min > 0 && p.max > 0 && (!r.fam || r.fam === p.fam)) o = { min: r2(p.min * k), max: r2(p.max * k), tipic: r2(v * k), n: p.n || (p.surse || []).length || 1, sigur: p.sigur || "", ref: p, k };
  }
  TMK.c.set(key, o); return o;
}
/* sub / în / peste piață, pe prețul care ajunge la client (cu adaosul) */
const mktPos = (it, m) => { if (!m || !(it.pret > 0)) return ""; const p = r2(it.pret * (1 + (+st.adaos || 0) / 100)); return p < m.min * 0.98 ? "sub" : p > m.max * 1.02 ? "peste" : "in"; };
const lunaAn = d => String(d || "").replace(/^(\d{4})-(\d{2})$/, (x, y, m) => ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."][+m - 1] + " " + y);
const MKT_T = { sub: "sub piață", in: "în piață", peste: "peste piață" };
const nSurse = n => n === 1 ? "o sursă" : n + " surse";
function posCard(it, cap) {
  const s = stOf(it), pb = PROB[it.id], lv = it.src === "cat" ? (it.lv || 2) : 0, m = s === "nu" ? null : mktOf(it), mp = mktPos(it, m);
  const tg = (cls, inner) => `<button class="tag ${cls}" data-a="why" data-id="${it.id}" aria-label="De ce acest preț?">${inner}</button>`;
  const tag = s === "nu" ? '<span class="tag gy">nu ofertez</span>' : s === "ok" ? tg("ok", `${ic("check", 14, 2.8)}verificat`) : s === "est" ? tg("wr", lv >= 5 ? "după piață" : lv === 4 ? "estimat larg" : "estimat") : s === "sig" ? tg("in", esc(SRC[it.src] || "preț")) : "";
  const mk = m ? `<button class="mk" data-a="why" data-id="${it.id}"><span>Piață: ${fmt(m.min)}–${fmt(m.max)} lei/${esc(it.um)} · din ${nSurse(m.n)}</span>${mp ? `<b class="${mp}">${MKT_T[mp]}</b>` : ""}</button>` : "";
  return `<div class="pos${s === "nu" ? " off" : ""} s-${s}" data-id="${it.id}"><div class="d" data-a="pexp">${esc(it.den)}</div><div class="m">${fq(it.cant)} ${esc(it.um)}${it.cod ? " · " + esc(it.cod) : ""}${cap ? " · " + esc(it.cap) : ""}${it.hid ? " · ascuns în fișier" : ""}</div>
<div class="pr"><button class="p${it.pret > 0 && s !== "nu" ? "" : " z"}" data-a="pp" data-id="${it.id}">${s === "nu" ? "nu ofertez" : it.pret > 0 ? fmt(it.pret) + " lei/" + esc(it.um) : "pune preț"}</button>${tag}<div class="t">${it.pret > 0 && s !== "nu" ? fmt(OF.total(it, st.adaos)) + " lei" : ""}</div></div>
${mk}
${pb && s !== "nu" ? `<div class="nt">${ic("triangle-alert", 14, 2.2)} ${esc(pb)}</div>` : ""}
${(s === "est" || s === "sig") && it.src === "cat" && it.sugW ? `<div class="sgs${s === "sig" ? " q" : ""}">${esc(it.sugW)}${it.lab && it.sugW.indexOf(it.lab) < 0 ? " · " + esc(it.lab) : ""}${s === "est" ? `<br><button data-a="pok" data-id="${it.id}">E bun</button><button class="g" data-a="pp" data-id="${it.id}">Schimbă</button>` : ""}</div>` : ""}
${s === "no" ? `<div class="sgs q">Nu am un preț de la care să pornesc.<br><button class="g" data-a="pno" data-id="${it.id}">Nu ofertez</button></div>` : ""}
${s === "nu" ? `<div class="sgs q"><button class="g" data-a="pyes" data-id="${it.id}">Ofertez totuși</button></div>` : ""}</div>`;
}
function posList() {
  const xs = posShown(), lim = VIEW.lim || 40, f = VIEW.f || "all";
  let h = "";
  if (f === "est" && xs.length) h += `<button class="sec" data-a="okall" style="margin-bottom:12px">${ic("check-check", 18, 2.2)}Sunt bune toate (${xs.length})</button>`;
  if (f === "no" && xs.length) h += `<button class="sec" data-a="noall" style="margin-bottom:12px">${ic("ban", 18, 2.2)}${xs.length === 1 ? "Nu ofertez poziția rămasă fără preț" : "Nu ofertez cele " + plural(xs.length, "", "poziții") + " rămase fără preț"}</button>`;
  if (f === "nu" && xs.length) h += `<button class="sec" data-a="yesall" style="margin-bottom:12px">${ic("rotate-ccw", 18, 2.2)}Ofertez totuși ${plural(xs.length, "poziția", "poziții")}</button>`;
  if (!xs.length) return h + '<div class="emp">Nimic aici.</div>';
  return h + xs.slice(0, lim).map(it => posCard(it, !VIEW.row)).join("") + (xs.length > lim ? `<button class="more" data-a="pmore">Arată încă ${Math.min(40, xs.length - lim)} (din ${xs.length})</button>` : "");
}
function vPos() {
  const { r, xs } = posAll(), f = VIEW.f || "all", cn = { all: xs.length, no: 0, est: 0, nu: 0, sig: 0, ok: 0 };
  checks(); xs.forEach(it => { cn[stOf(it)]++; }); cn.lucru = cn.no + cn.est;
  const off = xs.filter(i => !isNo(i)), x = r ? rowInfo(r) : { val: r2(off.reduce((a, i) => a + OF.total(i, st.adaos), 0)), n: off.length, np: off.length - cn.no };
  const est = r2(off.reduce((a, i) => a + (stOf(i) === "est" ? OF.total(i, st.adaos) : 0), 0));
  const ch = (k, t) => cn[k] || k === "all" || k === f ? `<button data-a="pf" data-f="${k}" class="${f === k ? "on" : ""}">${t} · ${cn[k]}</button>` : "";
  return `<div class="top"><button class="ibn" data-a="back" data-h="#/o/${CUR}" aria-label="Înapoi la ofertă">${ic("chevron-left", 22, 2.4)}</button><div class="tt"><b>${esc(r ? r.den : "Toate pozițiile")}</b><small>${esc(nameOf(st, entry(CUR)))}</small></div>${stPill}${r ? `<button class="ibn" data-a="cmenu" aria-label="Capitolul">${ic("ellipsis", 20, 2.2)}</button>` : ""}</div><main>
<div class="sum"><div><small>${r ? "Capitolul" : "Toate capitolele"}, fără TVA</small><b>${r && r.no ? "nu ofertez" : fmt(x.val) + "<span>lei</span>"}</b></div><em>${x.np} din ${x.n}<br>au preț${r && r.ov > 0 ? (x.moved ? "<br>pornind de la suma ta" : "<br>sumă pusă de tine") : ""}</em></div>
${r && x.moved ? `<p class="s" style="margin:-4px 2px 12px">Ai pus tu suma ${fmt(r.ov)} lei când pozițiile dădeau ${fmt(r.ovT)} lei. De atunci pozițiile s-au schimbat, așa că suma a mers odată cu ele: ${fmt(x.val)} lei. O poți scrie din nou din meniul capitolului.</p>` : ""}
${est > 0 && !(r && (r.no || r.ov > 0)) ? `<p class="s" style="margin:-4px 2px 12px">Din sumă, ${fmt(est)} lei sunt prețuri estimate. Uită-te peste ele la „De verificat”.</p>` : ""}
<div class="srch">${ic("search", 20, 2.2)}<input id="pq" data-i="pq" placeholder="Caută în poziții" value="${esc(VIEW.q || "")}" autocomplete="off"></div>
<div class="fl">${ch("all", "Toate")}${cn.lucru && cn.lucru < cn.all ? ch("lucru", "De lucrat") : ""}${ch("no", "Fără preț")}${ch("est", "De verificat")}${ch("sig", "Din prețurile mele")}${ch("ok", "Verificate")}${ch("nu", "Nu ofertez")}</div>
<div id="plist">${posList()}</div></main>`;
}

/* ---------- catalogul de lucrări: tot ce știe aplicația să recunoască, cu sau fără preț (nomen.json e generic: familie, unitate, mărime, variantă) ---------- */
let NOMEN = null, NX = null;
const umShow = u => u === "m" ? "ml" : u;
function nomRows() {
  const T = tarif(); if (NX && NX.T === T && NX.n === catalog.length) return NX.rows;
  const mine = new Map(); catalog.forEach(c => { if (c.learned) mine.set(OF.keyOf(c.den) + "|" + OF.umFamily(c.um), c); });
  const rows = ((NOMEN && NOMEN.items) || []).map((x, i) => { const vars = x[3] || [], den = OF.nomLabel(x[0], x[2], vars), e = { i, fam: x[0], um: x[1], sz: x[2], vars, den, tier: x[4] || 0, s: OF.strip(den) };
    let r = null; try { r = OF.priceItem({ den, um: x[1], fam: x[0], sz: x[2], vars }, T); } catch (err) { }
    e.c = mine.get(OF.keyOf(den) + "|" + OF.umFamily(x[1])) || null; e.p = r ? r.p : 0; e.lv = r ? r.lv : 0; e.why = r ? r.why : ""; e.lab = r ? r.lab || "" : "";
    e.k = e.c ? "m" : !r ? "z" : r.lv <= 2 ? "t" : "e";   // m = pus de tine chiar aici · t = din prețurile tale · e = socotit / estimat · z = fără preț
    const g = OF.famLabel(x[0]).replace(/ \(.*$/, "").replace(/:.*$/, ""); e.g = x[0].indexOf("teava:") === 0 ? "Țevi" : g; return e; });
  NX = { T, n: catalog.length, rows }; return rows;
}
const nomSub = e => (e.k === "m" ? "prețul tău" : e.k === "t" ? "din prețurile tale" : e.k === "z" ? "fără preț" : e.lv === 3 ? "socotit din prețurile tale · de verificat" : e.lv === 5 ? "după piață · de verificat" : "estimat · de verificat") + (e.tier === 3 ? " · apare des în liste" : "");
const nomBtn = e => `<button data-a="${e.prod ? "pprod" : "pnom"}" data-k="${e.i}"><p>${esc(e.den)}<small>${e.prod ? (e.k === "m" ? "prețul tău" : "fără preț") + " · nerecunoscută · apare " + (e.n === 1 ? "o dată" : "de " + e.n + " ori") + " în ofertele tale" : nomSub(e)}</small></p><b>${e.p > 0 ? fmt(e.p) + " lei" : "—"}<small>/ ${esc(umShow(e.um))}</small></b></button>`;
function nomFind(q) { const ws = OF.strip(q).split(/[^a-z0-9./"']+/).filter(w => w.length > 1); if (!ws.length) return []; return nomRows().filter(e => ws.every(w => e.s.includes(w))).slice(0, 40).concat(prodRows().filter(e => e.k === "z" && ws.every(w => e.s.includes(w))).slice(0, 15)); }

/* produsele din ofertele tale pe care aplicația încă nu le recunoaște (nu țin de nicio familie): se adună din ofertele din cont, ca să le poți pune preț */
let PRX = null;
function prodRows() {
  const ps = Object.keys(DOCS).filter(p => p.indexOf("p/") === 0), sig = ps.map(p => p + ":" + ((DOCS[p].items || []).length)).join(",") + "|" + catalog.length + "|" + catalog.filter(c => c.learned).map(c => c.pret).join(",");
  if (PRX && PRX.sig === sig) return PRX.rows;
  const mine = new Map(); catalog.forEach(c => { if (c.learned) mine.set(OF.keyOf(c.den) + "|" + OF.umFamily(c.um), c); });
  const M = new Map();
  ps.forEach(p => (DOCS[p].items || []).forEach(it => { const den = String(it.den || "").replace(/\s+/g, " ").trim(); if (den.length < 6 || den.length > 160 || !/[a-zăâîșț]{3}/i.test(den) || /^(total|subtotal|pre[tț] total|valoare|din care|nr\.? ?crt)/i.test(den)) return;
    let fam = null; try { fam = OF.classify(den, it.um).fam; } catch (e) { } if (fam) return;
    const k = OF.keyOf(den) + "|" + OF.umFamily(it.um); let e = M.get(k); if (!e) M.set(k, e = { prod: 1, den, um: OF.umFamily(it.um), n: 0, vars: [], s: OF.strip(den) }); e.n++; }));
  const rows = [...M.entries()].map(([k, e]) => { e.c = mine.get(k) || null; e.p = e.c ? +e.c.pret : 0; e.k = e.c ? "m" : "z"; e.tier = 0; e.g = "Alte produse din ofertele tale (nerecunoscute de aplicație)"; return e; })
    .sort((a, b) => b.n - a.n || a.den.localeCompare(b.den, "ro")).slice(0, 600); rows.forEach((e, i) => { e.i = i; });
  PRX = { sig, rows }; return rows;
}

/* ---------- prețurile mele ---------- */
function priceRows() {
  const q = (VIEW.q || "").trim(), f = VIEW.f || (catalog.some(c => c.learned) ? "m" : "c"), lim = VIEW.lim || 50;
  let xs;
  if (q.length > 1) xs = searchPrices(q, 80).map(e => ({ e })).concat(nomFind(q).map(n => ({ n }))).concat(piataFind(q).map(p => ({ p })));
  else if (f === "n" || f === "z") { xs = nomRows().filter(e => f === "n" || e.k === "z"); if (f === "z") xs = xs.slice().sort((a, b) => b.tier - a.tier); xs = xs.map(n => ({ n, g: f === "n" ? n.g : (n.tier === 3 ? "Apar des în listele de cantități" : n.tier === 2 ? "Apar uneori" : "Apar rar") }))
    .concat(prodRows().filter(e => f === "n" || e.k === "z").map(n => ({ n, g: n.g }))); }
  else if (f === "p") xs = ((PIATA && PIATA.lista) || []).filter(p => p.min || p.max).map(p => ({ p }));
  else { xs = priceIndex().filter(e => e.t === f); if (f !== "r") xs = xs.map(e => ({ e, g: OF.famLabel(e.fam).replace(/ \(.*$/, "") || "Altele" })).sort((a, b) => (a.g === "Altele") - (b.g === "Altele") || a.g.localeCompare(b.g, "ro") || a.e.den.localeCompare(b.e.den, "ro", { numeric: true })); else xs = xs.map(e => ({ e })); }
  if (!xs.length) return `<div class="emp">${q.length > 1 ? "Nu am găsit nimic pentru „" + esc(q) + "”." : f === "m" ? "<b>Aici se adună prețurile pe care le pui tu.</b>De fiecare dată când scrii un preț într-o ofertă, îl țin minte." : f === "z" ? "<b>Toate lucrările din catalog au un preț.</b>" : "Nimic aici."}</div>`;
  let lastG = null; const grp = x => x.g && x.g !== lastG ? (lastG = x.g, `</div><div class="prg">${esc(x.g)}</div><div class="prl">`) : "";
  return '<div class="prl">' + xs.slice(0, lim).map(x => grp(x) + (x.n ? nomBtn(x.n) : x.p
    ? `<button data-a="ppia" data-k="${PIATA.lista.indexOf(x.p)}"><p>${esc(x.p.lucrare)}<small>reper de piață · ${esc(x.p.cat || "")}${x.p.dim ? " · " + esc(x.p.dim) : ""}</small></p><b>${fmt(x.p.min)}–${fmt(x.p.max)}<small>${esc(x.p.um || "")}</small></b></button>`
    : `<button data-a="${x.e.t === "r" ? "pref" : "pcat"}" data-k="${x.e.t === "r" ? x.e.ri : x.e.id}"><p>${esc(x.e.den)}<small>${esc(x.e.sub)}</small></p><b>${fmt(x.e.p)} lei<small>/ ${esc(x.e.um)}</small></b></button>`)).join("").replace('<div class="prl"></div>', "") + "</div>" + (xs.length > lim ? `<button class="more" data-a="prmore">Arată mai multe (din ${xs.length})</button>` : "");
}
function piataFind(q) { const ws = OF.strip(q).split(" ").filter(w => w.length > 1); return ((PIATA && PIATA.lista) || []).filter(p => { const s = OF.strip(p.lucrare + " " + (p.cat || "")); return ws.every(w => s.includes(w)); }).slice(0, 20); }
function vPrices() {
  const nr = nomRows(), pr = nr.length ? prodRows() : [], nz = nr.filter(e => e.k === "z").length, pz = pr.filter(e => e.k === "z").length;
  const n = { m: catalog.filter(c => c.learned).length, c: catalog.filter(c => !c.learned).length, r: REF.length, p: ((PIATA && PIATA.lista) || []).filter(p => p.min || p.max).length, n: nr.length + pr.length, z: nz + pz }, f = VIEW.f || (n.m ? "m" : "c");
  const ne = nr.filter(e => e.k === "e").length;
  const ch = (k, t) => `<button data-a="prf" data-f="${k}" class="${f === k ? "on" : ""}">${t} · ${n[k]}</button>`;
  return `<div class="top"><div class="tt"><h1>Prețurile mele</h1></div>${stPill}</div><main>
<button class="pri" data-a="pnew" id="bPnew">${ic("plus", 22, 2.6)}Preț nou</button>
<button class="sec" data-a="plearn" id="bLearn" style="margin-top:10px">${ic("book-open", 18, 2.2)}Învață prețurile dintr-o ofertă veche</button>
<p class="s" style="margin:12px 2px 0">Când aduci o listă, pornesc de la ${plural(n.m + n.c, "un preț al tău", "prețuri ale tale")}, apoi de la cele ${n.r} din ofertele tale vechi, și la urmă de la ${ref2Pts().length} repere din bugete de antreprenor și ${((PIATA && PIATA.lista) || []).filter(x => x.fam).length} de pe piață.</p>
<div class="srch" style="margin-top:14px">${ic("search", 20, 2.2)}<input id="prq" data-i="prq" placeholder="Caută: calorifer, țeavă PPR 25, hidrant…" value="${esc(VIEW.q || "")}" autocomplete="off"></div>
<div class="fl w">${ch("m", "Puse de mine")}${ch("c", "Catalogul meu")}${ch("r", "Din oferte vechi")}${ch("p", "Piață")}${n.n ? ch("n", "Toate lucrările") + ch("z", "De pus preț") : ""}</div>
${n.n && (f === "n" || f === "z") ? `<p class="s" style="margin:10px 2px 0">Catalogul are ${plural(nr.length, "o lucrare", "lucrări")}: la ${nr.length - nz - ne} ai prețul tău, ${ne} sunt socotite sau estimate (de verificat), iar ${nz === 1 ? "una nu are" : nz + " nu au"} încă preț. Apasă pe o lucrare ca să-i pui prețul; îl folosesc apoi singură la toate listele.${pr.length ? " La sfârșit sunt și " + plural(pr.length, "un produs", "produse") + " din ofertele tale pe care încă nu le recunosc: le poți pune preț și lor." : ""}</p>` : ""}
<div id="prl">${priceRows()}</div>
<div class="box"><h3>Toate prețurile deodată</h3><p class="s">La început de an poți crește sau scădea toate prețurile tale cu un procent.</p><button class="sec" data-a="pidx">${ic("percent", 18, 2.2)}Schimbă toate prețurile cu un procent</button></div>
<div class="box fam"><h3>Denumiri pe care le socotesc la fel</h3><p class="s">Proiectanții scriu aceeași lucrare în multe feluri. Un preț pus la una se propune și la celelalte din același rând.</p><button class="lnk" data-a="fam">arată lista${ic("chevron-down", 15, 2.4)}</button><div id="famList"></div></div></main>`;
}

/* ---------- firma mea ---------- */
function vFirma() {
  const d = FIRMA.def || {};
  return `<div class="top"><div class="tt"><h1>Firma mea</h1></div>${stPill}</div><main>
<div class="box"><h3>Datele firmei</h3><p class="s">Le scrii o singură dată. Apar în antetul fiecărei oferte.</p>
${FF.map(([k, l]) => `<label class="lb" for="f_${k}">${l}</label><input class="inp" id="f_${k}" data-i="ff" data-k="${k}" value="${esc(FIRMA[k] || "")}" autocomplete="off">`).join("")}</div>
<div class="box"><h3>Condițiile mele obișnuite</h3><p class="s">Cu ele pornește fiecare ofertă nouă. Într-o ofertă le poți schimba doar pentru ea.</p>
${CF.map(([k, l, t]) => `<label class="lb" for="d_${k}">${l}</label><input class="inp" id="d_${k}" data-i="fd" data-k="${k}" data-t="${t}" ${t === "n" ? 'inputmode="decimal"' : ""} value="${esc(t === "n" ? edn(defc(k)) : defc(k))}" autocomplete="off">`).join("")}
<label class="lb" for="d_nuInclude">Oferta nu include (câte una pe rând)</label><textarea class="inp" id="d_nuInclude" data-i="fd" data-k="nuInclude" data-t="t">${esc(defc("nuInclude"))}</textarea>
<label class="lb" for="d_includeTxt">Oferta include (câte una pe rând; poate rămâne gol)</label><textarea class="inp" id="d_includeTxt" data-i="fd" data-k="includeTxt" data-t="t">${esc(defc("includeTxt"))}</textarea>
<label class="lb" for="f_nrStart">Numărul primei oferte din an (dacă nu vrei să înceapă de la 0001)</label><input class="inp" id="f_nrStart" data-i="ff" data-k="nrStart" value="${esc(FIRMA.nrStart || "")}" placeholder="${new Date().getFullYear()}/0001" autocomplete="off"></div>
<div class="box"><h3>Siguranță</h3><p class="s">Tot ce scrii se salvează singur și apare la fel pe telefon și pe laptop.</p>
<button class="sec" data-a="acct">${ic("key-round", 18, 2.2)}Cont și parolă</button>
<button class="sec" data-a="hist" style="margin-top:10px">${ic("history", 18, 2.2)}Copii automate (revino la o zi mai veche)</button>
<button class="sec" data-a="bkp" style="margin-top:10px">${ic("download", 18, 2.2)}Salvează tot într-un fișier</button></div></main>`;
}
/* ---------- ce se întâmplă la apăsare (data-a) și la scris (data-i) ---------- */
const ACT = {}, INP = {};
document.addEventListener("click", e => { const el = e.target.closest("[data-a]"); if (!el || el.disabled) return; const f = ACT[el.dataset.a]; if (f) { e.preventDefault(); f(el, e); } });
document.addEventListener("input", e => { const el = e.target.closest("[data-i]"); if (el && INP[el.dataset.i]) INP[el.dataset.i](el); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && isOpen()) ACT.x(); if (e.key === "Enter" && e.target.tagName === "INPUT" && isOpen()) { const b = $("#ovl [data-ok]"); if (b) { e.preventDefault(); b.click(); } } });
window.addEventListener("hashchange", route);
ACT.x = () => { if (DQ && $('[data-a="dqok"]')) { ACT.dqok(); return; } closeOvl(); };   // „Ce ofertezi din listă?” închis altfel decât cu butonul: tot ce arată comutatoarele se aplică
ACT.undo = () => { const u = UNDO; UNDO = null; $("#toast").classList.remove("on"); if (u) u(); };
ACT.sw = el => { el.classList.toggle("on"); el.setAttribute("aria-checked", el.classList.contains("on") ? "true" : "false"); if (el.dataset.then && ACT[el.dataset.then]) ACT[el.dataset.then](el); };
ACT.go = el => go(el.dataset.h);
ACT.back = el => go(el.dataset.h);
ACT.nav = el => go(el.dataset.v === "prices" ? "#/preturi" : el.dataset.v === "firma" ? "#/firma" : "#/");
ACT.open = el => go("#/o/" + el.dataset.id);
ACT.lf = el => { VIEW.f = el.dataset.f; render(); };
INP.lq = el => { VIEW.q = el.value; $("#lst").innerHTML = listRows(); };

/* ---------- ofertă nouă ---------- */
let NEW = null;
const bens = () => { const m = new Map(); Object.keys(DOCS).forEach(p => { if (p.indexOf("p/") !== 0) return; const x = DOCS[p].proj || {}, k = (x.beneficiar || "").trim(); if (k && !m.has(k.toLowerCase())) m.set(k.toLowerCase(), { beneficiar: k, beneficiarCif: x.beneficiarCif || "", beneficiarContact: x.beneficiarContact || "" }); }); return [...m.values()].slice(0, 8); };
const benChips = () => { const b = bens(); return b.length ? `<div class="cps" id="benCh">${b.map((x, i) => `<button data-a="benpick" data-k="${i}">${esc(x.beneficiar)}</button>`).join("")}</div>` : ""; };
ACT.benpick = el => { const b = bens()[+el.dataset.k]; if (!b) return; if ($("#hBen")) $("#hBen").value = b.beneficiar; if ($("#hCif")) $("#hCif").value = b.beneficiarCif; if ($("#hCon")) $("#hCon").value = b.beneficiarContact; if (NEW) NEW.ben = b; };
const op = (a, k, icon, t, s) => `<button class="op" data-a="${a}" data-k="${k}"><i>${ic(icon, 24, 2)}</i><p>${t}<small>${s}</small></p>${ic("chevron-right", 18, 2.2)}</button>`;
ACT.new = () => { NEW = {}; sheet(h3("Ofertă nouă") + '<p class="s">Cum o faci?</p>' +
  op("nk", "rows", "pencil-line", "Scriu eu câteva rânduri", "Lucrare, cantitate, preț. Ca la o casă sau un apartament.") +
  op("nk", "caps", "layers", "Sume pe capitole", "Termice, Sanitare, Hidranți… câte o sumă la fiecare.") +
  op("nk", "list", "file-spreadsheet", "Am listă de la proiectant", "Excel, PDF sau text lipit. Pun preț pe poziții.") +
  op("nk", "copy", "copy", "Pornesc de la o ofertă veche", "O copiez și schimb ce trebuie.")); };
ACT.nk = el => {
  NEW = { k: el.dataset.k };
  if (NEW.k === "copy") { const xs = IDX.list.map(e => ({ e, s: DOCS["p/" + e.id] })).filter(x => x.s); sheet(h3("Ce ofertă copiezi?") + (xs.length ? '<div class="sg" style="margin-top:8px">' + xs.map(x => `<button data-a="ncopy" data-id="${x.e.id}"><p>${esc(nameOf(x.s, x.e))}<small>${esc([x.s.proj.beneficiar, x.s.proj.data].filter(Boolean).join(" · "))}</small></p><b>${fmt(totals(x.s).sub)} lei</b></button>`).join("") + "</div>" : '<p class="s">Nu ai încă nicio ofertă de copiat.</p>')); return; }
  sheet(h3("Ofertă nouă") + '<p class="s">Pentru ce lucrare și pentru cine? Le poți schimba oricând.</p>' + fld("hLuc", "Lucrarea", "", { ph: "ex. Casă pe strada Lalelelor, Bloc B2", af: 1 }) + fld("hBen", "Beneficiar (firmă sau om)", "", {}) + benChips() + `<button class="pri" data-a="nmake" data-ok="1">Fă oferta</button>`);
};
ACT.nmake = () => {
  const b = NEW.ben && NEW.ben.beneficiar === val("hBen") ? NEW.ben : { beneficiar: val("hBen") }, k = NEW.k;
  const id = createOffer(Object.assign({ santier: val("hLuc") }, b));
  AFTER = k === "rows" ? () => openRow(0) : k === "caps" ? capsSheet : k === "list" ? () => ACT.imp() : null; NEW = null; go("#/o/" + id);
};
function dupOffer(src) { const s = clone(DOCS["p/" + src]); s.proj.nrOferta = ""; s.proj.data = today(); s.proj.stare = "lucru"; s.proj.santier = nameOf(DOCS["p/" + src], entry(src)) + " (copie)"; return createOffer({}, s); }
ACT.ncopy = el => { const id = dupOffer(el.dataset.id); NEW = null; go("#/o/" + id); toast("Am făcut o copie. Schimbă ce trebuie."); };
const CAPN = ["TERMICE", "SANITARE", "HIDRANȚI", "CANALIZARE", "PLUVIALE", "VENTILAȚIE", "CLIMATIZARE", "CAMERĂ TEHNICĂ", "GAZ"];
function capsSheet() { sheet(h3("Ce capitole are oferta?") + '<p class="s">Alege-le. Apoi apeși pe fiecare și scrii suma.</p><div class="cps">' + CAPN.map(c => `<button data-a="cpt">${c}</button>`).join("") + "</div>" + fld("capX", "Alt capitol (scris de tine)", "", {}) + '<button class="pri" data-a="capsok" data-ok="1">Pune capitolele</button>'); }
ACT.cpt = el => el.classList.toggle("on");
ACT.capsok = () => { const xs = $$("#ovl .cps button.on").map(b => b.textContent); const o = val("capX"); if (o) xs.push(o.toUpperCase()); if (!xs.length) { closeOvl(); return; } xs.forEach(d => st.rows.push({ id: nextRow(), k: "r", den: d, um: "buc", cant: 1, pret: 0 })); save(); closeOvl(); render(); };

/* ---------- antetul ofertei: număr, beneficiar, lucrare, condiții ---------- */
ACT.hnr = () => { const p = st.proj; sheet(h3("Număr și dată") + fld("hNr", "Numărul ofertei", p.nrOferta, {}) + fld("hDat", "Data (zz.ll.aaaa)", p.data, {}) + fld("hVal", "Valabilă (zile)", edn(p.valab), { n: 1 }) + '<button class="pri" data-a="hsave" data-k="nr" data-ok="1">Gata</button>'); };
ACT.hben = () => { const p = st.proj; NEW = null; sheet(h3("Beneficiar") + fld("hBen", "Firma sau numele", p.beneficiar, { af: !p.beneficiar }) + benChips() + fld("hCif", "CIF (dacă e firmă)", p.beneficiarCif, {}) + fld("hCon", "Telefon sau email", p.beneficiarContact, {}) + '<button class="pri" data-a="hsave" data-k="ben" data-ok="1">Gata</button>'); };
ACT.hluc = () => { const p = st.proj; sheet(h3("Lucrarea") + fld("hLuc", "Lucrarea (șantierul)", p.santier, { af: !p.santier, ph: "ex. Bloc B2, instalații" }) + fld("hOb", "Titlul din ofertă (poate rămâne gol)", p.obiect, { ph: "INSTALAȚII " + (p.santier || "…").toUpperCase() }) + '<button class="pri" data-a="hsave" data-k="luc" data-ok="1">Gata</button>'); };
ACT.cond = () => { const p = st.proj; sheet(h3("Condiții") + '<p class="s">Doar pentru oferta asta.</p>' + CF.map(([k, l, t]) => fld("c_" + k, l, t === "n" ? edn(p[k]) : p[k], { n: t === "n" })).join("") + fld("c_semnatar", "Semnează (nume)", p.semnatar || FIRMA.semnatar || "", {}) + sw("cAll", "Folosește-le și la ofertele următoare", false) + '<button class="pri" data-a="hsave" data-k="cond" data-ok="1">Gata</button>'); };
ACT.inc = () => { const p = st.proj; sheet(h3("Ce include și ce nu") + fld("iNu", "Oferta NU include (câte una pe rând)", p.nuInclude, { area: 1 }) + fld("iInc", "Oferta include (poate rămâne gol)", p.includeTxt, { area: 1, ph: "ex. probe la rece, probe la cald, punere în funcțiune" }) + sw("iAll", "Folosește-le și la ofertele următoare", false) + '<button class="pri" data-a="hsave" data-k="inc">Gata</button>'); };
ACT.hsave = el => {
  const p = st.proj, k = el.dataset.k;
  if (k === "nr") { const ds = val("hDat"), dd = OFX.readDate(ds); if (ds && !dd) { toast("Data nu e bună. Scrie-o așa: 15.11.2026."); const e0 = $("#hDat"); if (e0) e0.focus(); return; }   // altfel în Excel ar ieși altă zi decât cea scrisă
    if (val("hNr") !== p.nrOferta) delete p.nrAuto; p.nrOferta = val("hNr"); if (dd) p.data = OFX.fmtDate(dd); p.valab = num(val("hVal")) || p.valab; }
  if (k === "ben") { p.beneficiar = val("hBen"); p.beneficiarCif = val("hCif"); p.beneficiarContact = val("hCon"); }
  if (k === "luc") { p.santier = val("hLuc"); p.obiect = val("hOb"); }
  if (k === "cond") { CF.forEach(([c, , t]) => { p[c] = t === "n" ? num(val("c_" + c)) : val("c_" + c); }); p.semnatar = val("c_semnatar"); if (isOn("cAll")) { FIRMA.def = FIRMA.def || {}; CF.forEach(([c]) => FIRMA.def[c] = p[c]); saveFirma(); } }
  if (k === "inc") { p.nuInclude = $("#iNu").value; p.includeTxt = $("#iInc").value; if (isOn("iAll")) { FIRMA.def = FIRMA.def || {}; FIRMA.def.nuInclude = p.nuInclude; FIRMA.def.includeTxt = p.includeTxt; saveFirma(); } }
  save(); closeOvl(); render();
};

/* ---------- rând nou / schimbă rândul (ecran întreg) ---------- */
let RE = null;
function openRow(id) {
  const r = id ? st.rows.find(x => x.id === id) : null; RE = r ? { id: r.id, um: r.um } : { id: 0, um: "buc" };
  const ums = [...new Set(UMS.concat(r && r.um ? [r.um] : []))];
  full(`<div class="top"><button class="ibn" data-a="x" aria-label="Închide">${ic("x", 20, 2.4)}</button><div class="tt"><b>${r ? "Schimbă rândul" : "Rând nou"}</b><small>în oferta ${esc(nameOf(st, entry(CUR)))}</small></div></div>
<label class="lb" for="rDen">Ce lucrare?</label><input class="inp" id="rDen" data-i="rden" value="${esc(r ? r.den : "")}" placeholder="ex. montaj calorifer sau: 12 calorifere la 230" autocomplete="off" ${r ? "" : "autofocus"}>
<div id="rUnd"></div><div id="rSg"></div>
<div class="r3"><div><label class="lb" for="rCant">Cantitate</label><input class="inp" id="rCant" data-i="rnum" inputmode="decimal" value="${r ? edn(r.cant) : "1"}" autocomplete="off"></div>
<div class="um"><label class="lb" for="rUm">UM</label><select class="inp" id="rUm" data-i="rnum">${ums.map(u => `<option ${u === RE.um ? "selected" : ""}>${esc(u)}</option>`).join("")}</select></div>
<div><label class="lb" for="rPret">Preț (lei)</label><input class="inp" id="rPret" data-i="rnum" inputmode="decimal" value="${r ? edn(r.pret) : ""}" autocomplete="off"></div></div>
<div class="val"><span>Valoare rând</span><b id="rVal">0 lei</b></div>
${sw("rKeep", "Ține minte prețul pentru data viitoare", true)}
${r ? sw("rNo", "Nu ofertez rândul ăsta", !!r.no) + `<div class="minis"><button data-a="rmv" data-d="-1">${ic("arrow-up", 16, 2.2)}Mai sus</button><button data-a="rmv" data-d="1">${ic("arrow-down", 16, 2.2)}Mai jos</button><button class="r" data-a="rdel">${ic("trash-2", 16, 2.2)}Șterge</button></div>` : ""}
<div class="bar"><button class="pri" data-a="rsave" data-ok="1">${r ? "Gata" : "Pune în ofertă"}</button></div>`);
  rVal(); if (r) rSug();
}
const rVal = () => { const ps = $("#rPret").value.replace(/\s/g, ""); $("#rVal").textContent = fmt(r2(num($("#rCant").value) * (/^[-−–]/.test(ps) ? -1 : 1) * num(ps.replace(/^[-−–+]/, "")))) + " lei"; };
let RSG = [], RPL = null;
function rSug() {
  const q = $("#rDen").value; RSG = q.trim().length > 1 ? searchPrices(RPL ? RPL.den : q, 6) : [];
  $("#rSg").innerHTML = RSG.length ? '<span class="lb">Din prețurile tale</span><div class="sg">' + RSG.map((e, i) => `<button data-a="rsug" data-k="${i}"><p>${esc(e.den)}<small>${esc(e.sub)}</small></p><b>${fmt(e.p)} lei / ${esc(e.um)}</b></button>`).join("") + "</div>" : "";
}
function setUm(u) { const s = $("#rUm"); if (![...s.options].some(o => o.value === u)) s.add(new Option(u, u)); s.value = u; }
INP.rden = el => {
  RPL = null; const t = el.value;
  if (window.IMP && /\d/.test(t)) { const p = IMP.parseLine(t); if (p && p.den && (p.pret > 0 || p.cant !== 1) && OF.strip(p.den) !== OF.strip(t)) RPL = p; }
  $("#rUnd").innerHTML = RPL ? `<div class="und"><span>Am înțeles: <b>${fq(RPL.cant)} ${esc(RPL.um)}${RPL.pret ? " × " + fmt(RPL.pret) + " lei" : ""}</b> – ${esc(RPL.den)}</span>` + (RPL.amb && RPL.cant > 1 ? `<button data-a="rpl" data-m="u">${fmt(RPL.pret)} lei pe ${esc(RPL.um)}</button><button class="g" data-a="rpl" data-m="t">${fmt(RPL.pret)} lei cu totul</button>` : '<button data-a="rpl" data-m="u">Așa e</button>') + "</div>" : "";
  rSug();
};
ACT.rpl = el => { const p = RPL; if (!p) return; $("#rDen").value = p.den.charAt(0).toUpperCase() + p.den.slice(1); $("#rCant").value = edn(p.cant) || "1"; setUm(p.um || "buc"); const pr = el.dataset.m === "t" && p.cant ? r2(p.pret / p.cant) : p.pret; if (pr) $("#rPret").value = edn(pr); RPL = null; $("#rUnd").innerHTML = ""; rVal(); rSug(); };
ACT.rsug = el => { const e = RSG[+el.dataset.k]; if (!e) return; const d = $("#rDen"); if (RPL || OF.strip(d.value).length < OF.strip(e.den).length) d.value = e.den; if (RPL) { $("#rCant").value = edn(RPL.cant) || "1"; RPL = null; $("#rUnd").innerHTML = ""; } setUm(e.um); $("#rPret").value = edn(e.p); rVal(); $("#rSg").innerHTML = ""; };
INP.rnum = rVal;
ACT.rsave = () => {
  const den = val("rDen"); if (!den) { toast("Scrie ce lucrare e."); $("#rDen").focus(); return; }
  const qs = val("rCant"), ps = val("rPret").replace(/\s/g, ""), neg = /^[-−–]/.test(ps);
  const o = { den, um: $("#rUm").value || "buc", cant: qs === "" ? 1 : num(qs), pret: (neg ? -1 : 1) * num(ps.replace(/^[-−–+]/, "")) }, keep = isOn("rKeep"), id = RE.id;
  if (!(o.cant > 0)) { toast("Cantitatea trebuie să fie mai mare ca 0."); $("#rCant").focus(); return; }
  if (id) { let r0 = st.rows.find(x => x.id === id); if (!r0) { r0 = { id: nextRow(), k: "r" }; st.rows.push(r0); toast("Rândul fusese șters de pe celălalt aparat. L-am pus la loc, cu ce ai scris."); } Object.assign(r0, o); if (isOn("rNo")) r0.no = 1; else delete r0.no; } else st.rows.push(Object.assign({ id: nextRow(), k: "r" }, o));
  if (keep && o.pret > 0 && !(o.cant === 1 && o.um === "buc" && o.pret >= 20000)) learn(o);     // sumele mari pe capitol nu sunt „prețuri” de ținut minte
  save(); closeOvl(); render(); if (!id) toast("Rând pus în ofertă.");
};
ACT.rdel = () => { const id = RE.id; closeOvl(); undoable("Rând șters.", () => { st.rows = st.rows.filter(r => r.id !== id); }); };
function moveRow(id, d) { const i = st.rows.findIndex(r => r.id === id), j = i + d; if (i < 0 || j < 0 || j >= st.rows.length) return false; const t = st.rows[i]; st.rows[i] = st.rows[j]; st.rows[j] = t; return true; }
ACT.rmv = el => { if (moveRow(RE.id, +el.dataset.d)) { save(); render(); toast(+el.dataset.d < 0 ? "Mutat mai sus." : "Mutat mai jos."); } };
ACT.row = el => openRow(+el.dataset.id);
ACT.cap = el => go("#/o/" + CUR + "/c/" + el.dataset.id);

/* ---------- pozițiile: preț, sugestii, capitol ---------- */
const itemOf = id => st.items.find(i => i.id == id);
const rePos = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
ACT.pf = el => { VIEW.f = el.dataset.f; VIEW.lim = 40; rePos(); };
ACT.pmore = () => { VIEW.lim = (VIEW.lim || 40) + 40; $("#plist").innerHTML = posList(); };
INP.pq = el => { VIEW.q = el.value; VIEW.lim = 40; $("#plist").innerHTML = posList(); };
ACT.pexp = el => el.classList.toggle("x");
ACT.why = el => {
  const it = itemOf(el.dataset.id); if (!it) return; const s = stOf(it), m = mktOf(it), mp = mktPos(it, m), lv = it.src === "cat" ? (it.lv || 2) : 0;
  const src = s === "nu" ? "Nu o ofertezi." : !(it.pret > 0) ? "Nu are preț încă." : s === "ok" ? "Verificat de tine în oferta asta." : it.src === "cat" ? (LVT[lv] || "din prețurile tale") + (lv >= 3 ? " – socotit de aplicație, nu pus de tine." : ".") : (SRC[it.src] || "pus de tine") + ".";
  const c = it.catId != null ? catById(it.catId) : null, k = OF.keyOf(it.den), f = OF.umFamily(it.um);
  const mine = (c && c.h && c.h.length ? c : catalog.find(x => x.learned && OF.keyOf(x.den) === k && OF.umFamily(x.um) === f && (x.h || []).length)) || null;
  const hist = mine ? (mine.h || []).slice(0, 3) : [];
  const li = xs => `<ul class="wl">${xs.join("")}</ul>`;
  let h = h3("De ce acest preț?") + `<p class="s">${esc(it.den.length > 160 ? it.den.slice(0, 160) + "…" : it.den)}</p>`;
  h += `<div class="wb"><small>Prețul din ofertă</small><b>${it.pret > 0 && s !== "nu" ? fmt(it.pret) + " lei / " + esc(it.um) : "—"}</b><p>${esc(src)}</p>${it.sugW && it.src === "cat" ? `<p class="m">${esc(it.sugW)}${it.lab && it.sugW.indexOf(it.lab) < 0 ? " · " + esc(it.lab) : ""}</p>` : ""}</div>`;
  if (m) {
    const r = m.ref, sur = (r.surse || []).slice(0, 6).map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.titlu || x.url)}</a></li>`);
    h += `<div class="wb"><small>Piața${r.data ? " · " + esc(lunaAn(r.data)) : ""}</small><b>${fmt(m.min)}–${fmt(m.max)} lei / ${esc(it.um)}</b><p>Tipic ${fmt(m.tipic)} lei · din ${nSurse(m.n)} · ${esc(r.sigur || "")}${r.tva && r.tva !== "neprecizat" ? " · " + esc(r.tva) : " · TVA nespecificat"}</p>${mp ? `<p class="mt ${mp}">Prețul tău (cu adaosul) e <b>${MKT_T[mp]}</b>.</p>` : ""}<p class="m">Reper: ${esc(r.lucrare)}</p>${r.nota ? `<p class="m">${esc(r.nota)}</p>` : ""}${sur.length ? li(sur) : ""}<p class="m">Prețurile publice sunt mai ales pentru persoane fizice și renovări; la lucrări mari folosește-le ca plafon de verificare.</p></div>`;
  } else h += `<div class="wb"><small>Piața</small><p>Nu am un reper de piață pentru lucrarea asta.</p></div>`;
  if (hist.length) h += `<div class="wb"><small>Prețurile tale de altădată</small>${li(hist.map(x => `<li><b>${fmt(x.p)} lei</b> · ${esc(x.d || "")}${x.o ? " · " + esc(x.o) : ""}</li>`))}</div>`;
  h += `<div class="minis">${s === "est" ? `<button data-a="pok" data-id="${it.id}" data-x="1">${ic("check", 16, 2.4)}E bun</button>` : ""}<button data-a="pp" data-id="${it.id}">${ic("pencil", 16, 2.2)}Schimbă prețul</button></div>`;
  sheet(h);
};
ACT.pok = el => { itemOf(el.dataset.id).conf = true; save(); if (el.dataset.x) closeOvl(); rePos(); };
ACT.okall = () => { const xs = posShown(); undoable("Le-am trecut ca verificate.", () => xs.forEach(it => { it.conf = true; })); };
const setNo = (it, v) => { if (v) it.no = 1; else { delete it.no; const r = st.rows.find(x => x.k === "c" && x.cap === it.cap); if (r && r.no) { delete r.no; st.items.forEach(o => { if (o.cap === it.cap && o !== it) o.no = 1; }); } } };
ACT.pno = el => { setNo(itemOf(el.dataset.id), 1); save(); rePos(); };
ACT.pyes = el => { const it = itemOf(el.dataset.id); setNo(it, 0); if (!(it.pret > 0)) autoMatch([it]); save(); rePos(); };
ACT.noall = () => { const xs = posShown(); undoable(plural(xs.length, "O poziție trecută", "poziții trecute") + " la „nu ofertez”.", () => xs.forEach(it => setNo(it, 1))); };
ACT.yesall = () => { const xs = posShown(); undoable("Le ofertezi din nou.", () => { xs.forEach(it => setNo(it, 0)); autoMatch(xs.filter(it => !(it.pret > 0))); }); };
let PP = null;
ACT.pp = el => {
  const it = itemOf(el.dataset.id), k = OF.keyOf(it.den), f = OF.umFamily(it.um), same = st.items.filter(o => o !== it && OF.keyOf(o.den) === k && OF.umFamily(o.um) === f && !(o.src === "manual" && o.pret > 0)).length;
  PP = { id: it.id, same }; const caps = st.rows.filter(r => r.k === "c");
  sheet(h3("Preț") + `<p class="s">${esc(it.den.length > 140 ? it.den.slice(0, 140) + "…" : it.den)}</p><div class="r3"><div>` + fld("ppP", "Preț (lei / " + esc(it.um) + ")", edn(it.pret), { n: 1, af: 1 }) + "</div><div>" + fld("ppQ", "Cantitate", edn(it.cant), { n: 1 }) + "</div></div>" +
    (same ? sw("ppSame", "La fel la celelalte " + same + " cu aceeași denumire", true) : "") + sw("ppKeep", "Ține minte prețul pentru data viitoare", true) +
    `<label class="lb" for="ppCap">Capitol</label><select class="inp" id="ppCap">${caps.map(r => `<option value="${esc(r.cap)}" ${r.cap === it.cap ? "selected" : ""}>${esc(r.den)}</option>`).join("")}</select>
<div class="minis"><button data-a="ppno">${ic("ban", 16, 2.2)}Nu ofertez</button><button class="r" data-a="ppdel">${ic("trash-2", 16, 2.2)}Șterge poziția</button></div><p class="s" style="margin-top:10px">Preț 0 înseamnă că nu ofertezi poziția: rămâne în listă, dar nu intră în total și nu apare ca „fără preț”.</p><button class="pri" data-a="ppsave" data-ok="1">Gata</button>`);
};
ACT.ppsave = () => {
  if (!itemOf(PP.id)) { closeOvl(); rePos(); toast("Poziția a fost ștearsă de pe celălalt aparat."); return; }
  const it = itemOf(PP.id), p = num(val("ppP")), q = num(val("ppQ")), k = OF.keyOf(it.den), f = OF.umFamily(it.um), zero = /^\s*0+([.,]0*)?\s*$/.test(val("ppP"));
  if (q > 0) it.cant = q; { const nc = $("#ppCap").value || it.cap; if (nc !== it.cap) { it.cap = nc; delete it.ovd; } }
  if (zero) { setNo(it, 1); if (PP.same && isOn("ppSame")) st.items.forEach(o => { if (o !== it && OF.keyOf(o.den) === k && OF.umFamily(o.um) === f) o.no = 1; }); save(); closeOvl(); rePos(); toast("Am trecut-o la „nu ofertez”."); return; }
  if (/^\s*[-−–]/.test(val("ppP"))) { toast("Prețul unei poziții nu poate fi cu minus. Pentru o reducere, pune un rând separat în ofertă."); return; }
  if (p > 0 && it.no) setNo(it, 0);
  if (p !== +it.pret || (p > 0 && !it.conf)) { it.pret = p; it.src = p > 0 ? "manual" : ""; it.conf = p > 0; it.sug = null; it.sugR = null; it.ap = 0;
    if (p > 0) { if (PP.same && isOn("ppSame")) st.items.forEach(o => { if (o !== it && OF.keyOf(o.den) === k && OF.umFamily(o.um) === f && !(o.src === "manual" && o.pret > 0)) { o.pret = p; o.src = "manual"; o.conf = true; o.sug = null; o.sugR = null; } }); if (isOn("ppKeep")) learn(it); }
    else autoMatch([it]); }
  save(); closeOvl(); rePos();
};
ACT.ppno = () => { const it = itemOf(PP.id); setNo(it, 1); save(); closeOvl(); rePos(); toast("Am trecut-o la „nu ofertez”."); };
/* o poziție adusă dintr-un fișier și ștearsă apoi: țin minte rândul, ca în fișierul clientului să nu rămână acolo prețul lui vechi */
function dropItems(pred) { st.items.forEach(i => { if (!pred(i) || !i.rw) return; const f = fileOf(i.f); if (f) (f.del = f.del || []).push([i.sh || "", i.rw]); }); st.items = st.items.filter(i => !pred(i)); }
ACT.ppdel = () => { const id = PP.id; closeOvl(); undoable("Poziție ștearsă.", () => { dropItems(i => i.id === id); }); };
ACT.cmenu = () => { const r = st.rows.find(x => x.id === VIEW.row), x = rowInfo(r); sheet(h3("Capitolul") + fld("cDen", "Cum apare în ofertă", r.den, {}) + fld("cOv", "Sumă pe tot capitolul (gol = suma pozițiilor: " + fmt(rndTo(x.tot, st.rnd)) + " lei)", r.ov > 0 ? edn(x.off ? r.ov : x.val) : "", { n: 1 }) + sw("cNo", "Nu ofertez capitolul ăsta", !!r.no) + `<div class="minis"><button data-a="cmv" data-d="-1">${ic("arrow-up", 16, 2.2)}Mai sus</button><button data-a="cmv" data-d="1">${ic("arrow-down", 16, 2.2)}Mai jos</button><button class="r" data-a="cdel">${ic("trash-2", 16, 2.2)}Șterge</button></div><button class="pri" data-a="csave" data-ok="1">Gata</button>`); };
ACT.csave = () => { const r = st.rows.find(x => x.id === VIEW.row), no = isOn("cNo"); r.den = val("cDen") || r.den; { const x0 = rowInfo(r), was = r.ov > 0 ? (x0.off ? r.ov : x0.val) : 0, nv = num(val("cOv")); if (Math.abs(nv - was) >= 0.005) setOv(r, nv); } if (no) r.no = 1; else if (r.no) { delete r.no; autoMatch(st.items.filter(i => i.cap === r.cap && !i.no && !(i.pret > 0))); } save(); closeOvl(); render(); if (no) toast("Capitolul nu intră în ofertă."); };
ACT.cmv = el => { if (moveRow(VIEW.row, +el.dataset.d)) { save(); toast(+el.dataset.d < 0 ? "Mutat mai sus în ofertă." : "Mutat mai jos în ofertă."); } };
ACT.cdel = () => { const r = st.rows.find(x => x.id === VIEW.row), n = rowInfo(r).n, id = CUR; closeOvl(); const snap = JSON.stringify(st); st.rows = st.rows.filter(x => x !== r); dropItems(i => i.cap === r.cap); save(); const rv = REV; go("#/o/" + id); toast("Capitol șters" + (n ? " (cu " + plural(n, "o poziție", "poziții") + ")" : "") + ".", () => { if (REV !== rv || CUR !== id) { toast("Nu mai pot anula: ai schimbat altceva între timp."); return; } DOCS["p/" + id] = normSt(JSON.parse(snap)); st = DOCS["p/" + id]; save(); render(); }); };

/* ---------- lucruri de verificat în listă (dubluri, unități ciudate, preț mult diferit de al tău) ---------- */
let PROB = {};
function checks() {
  PROB = {}; if (!st || !st.items.length) return PROB;
  const seen = new Map();
  for (const it of st.items) {
    const k = it.cap + "|" + OF.keyOf(it.den) + "|" + OF.umFamily(it.um) + "|" + (+it.cant || 0), o = seen.get(k);
    if (o) { PROB[it.id] = PROB[o.id] = "Apare de două ori cu aceeași cantitate. Poate e dublură."; continue; } seen.set(k, it);
    let fam = it._f; if (fam === undefined) { try { fam = OF.classify(it.den, it.um).fam || ""; } catch (e) { fam = ""; } Object.defineProperty(it, "_f", { value: fam, enumerable: false, writable: true }); }
    const uf = OF.umFamily(it.um);
    if (/^teava/.test(fam) && uf === "buc") PROB[it.id] = "E țeavă, dar unitatea e „" + it.um + "”. Verifică dacă nu trebuia la metru.";
    else if (/^(radiator|rad_baie|lavoar|vas_wc|pisoar|boiler|hidrant_int|cada|spalator)/.test(fam) && uf === "m") PROB[it.id] = "E aparat, dar unitatea e „" + it.um + "”. Verifică.";
    else if (it.src === "manual" && it.pret > 0) { const m = OF.matchItem(Object.assign({}, it, { pret: 0 }), pcat.filter(c => OF.keyOf(c.den) !== OF.keyOf(it.den))); const c = m && m.sure ? catById(m.id) : null; if (c && c.pret > 0 && (it.pret > c.pret * 1.4 || it.pret < c.pret * 0.6)) PROB[it.id] = "Prețul e mult diferit de al tău obișnuit (" + fmt(c.pret) + " lei).";
    }
  }
  return PROB;
}
/* ---------- meniul ofertei: stare, alt total, copie, arhivă, „îmi iese?” ---------- */
ACT.chk = () => { const xs = checkOffer();
  sheet(h3("Verificare înainte de trimitere") + (xs.length ? `<p class="s">${plural(xs.length, "Un lucru", "lucruri")} de văzut. Nimic nu se schimbă singur: tu hotărăști la fiecare.</p>` + xs.map(x => `<div class="chk"><b>${esc(x.t)}</b><p class="s">${esc(x.s)}</p><div class="minis">${x.b.map(b => b[0] === "go" ? `<button data-a="go" data-h="${b[1]}">${b[2]}</button>` : b[0] === "row" ? `<button data-a="row" data-id="${esc(String(b[1]))}">${b[2]}</button>` : `<button data-a="${b[0]}" data-k="${esc(String(b[1]))}">${b[2]}</button>`).join("")}</div></div>`).join("")
    : '<p class="s">Nu am găsit nimic de semnalat: toate pozițiile ofertate au preț, prețurile estimate sunt văzute, iar probele, spălarea, punerea în funcțiune, golurile și etanșările antifoc sunt fie în listă, fie pomenite la „include” / „nu include”.</p>') + '<button class="pri" data-a="x">Gata</button>'); };
const chkPut = (el, field) => { const w = CHK_W.find(x => x[0] === el.dataset.k); if (!w) return; const p = st.proj, cur = String(p[field] || "").trim(); p[field] = (cur ? cur + "\n" : "") + w[5]; save(); render(); ACT.chk(); toast("Am scris „" + w[5] + "” la „" + (field === "includeTxt" ? "oferta include" : "oferta nu include") + "”."); };
ACT.chkinc = el => chkPut(el, "includeTxt");
ACT.chknu = el => chkPut(el, "nuInclude");
ACT.pos = el => { const it = st.items.find(i => String(i.id) === String(el.dataset.k)); if (!it) return; closeOvl(); const r = st.rows.find(x => x.k === "c" && x.cap === it.cap); if (r) go("#/o/" + CUR + "/c/" + r.id); };
ACT.menu = () => {
  const p = st.proj, e = entry(CUR), has = st.items.length > 0;
  sheet(h3("Oferta") + '<span class="lb">Cum stă</span><div class="seg">' + Object.keys(STARI).map(k => `<button data-a="stare" data-k="${k}" class="${(p.stare || "lucru") === k ? "on" : ""}">${STARI[k]}</button>`).join("") + "</div>" +
    op("target", "", "target", "Vreau alt total", "Scrii suma finală și prețurile se potrivesc singure.") +
    op("risc", "", "calculator", "Îmi iese?", "Câți oameni, câte zile: vezi ce îți rămâne.") +
    (has ? op("chk", "", "list-checks", "Verifică oferta", "Poziții fără preț, prețuri neobișnuite, lucrări care se uită: probe, spălare, goluri.") : "") +
    op("dup", "", "copy", "Fă o copie", "Pentru o variantă sau pentru altă lucrare la fel.") +
    (has ? op("opts", "", "sliders-horizontal", "Rotunjire, adaos și condiții", "Capitole rotunjite, adaos, acces greu, urgență.") : "") +
    (has && st.items.length ? op("domq", "", "ban", "Ce ofertez din listă", "Sanitare, termice, hidranți, ventilație, climatizare… alegi ce intră în ofertă.") : "") +
    (has ? op("rematch", "", "refresh-cw", "Pune din nou prețurile", "După ce ți-ai schimbat prețurile. Ce ai pus sau ai verificat tu rămâne.") : "") +
    (e && e.arh ? op("unarh", "", "archive", "Scoate din arhivă", "O pui înapoi în lista de oferte.") : op("arh", "", "archive", "Arhivează", "Dispare din listă. O găsești la „Arhivă”.")) +
    op("del", "", "trash-2", "Șterge oferta", "Se șterge de tot, de pe telefon și de pe laptop."));
};
/* aceeași întrebare ca la aducerea listei, pentru o ofertă deja făcută */
ACT.domq = () => { const dq = domGroups(st.items);
  sheet(h3("Ce ofertezi din listă?") + '<p class="s">Lasă pornit doar ce ofertezi. Restul rămân în listă, dar nu intră în ofertă și nu apar ca „fără preț”.</p>' + Object.keys(dq).map(k => sw("dq_" + k, DOMALL[k] + " · " + plural(dq[k].length, "o poziție", "poziții"), dq[k].some(x => !isNo(x)))).join("") + '<button class="pri" data-a="domqok">Gata</button>'); DQ = { dq, old: 1 }; };
ACT.domqok = () => { if (!DQ) { closeOvl(); return; } const dq = DQ.dq, on = {}; for (const k in dq) on[k] = isOn("dq_" + k); DQ = null; closeOvl(); FIRMA.dom = FIRMA.dom || {}; for (const k in dq) if (DOMQ[k]) FIRMA.dom[k] = on[k] ? 1 : 0; saveFirma();
  undoable("Am schimbat ce ofertezi.", () => { const back = []; for (const k in dq) dq[k].forEach(x => { if (on[k]) { if (isNo(x)) { setNo(x, 0); back.push(x); } } else x.no = 1; }); autoMatch(back.filter(x => !(x.pret > 0))); }); };
ACT.rematch = () => { closeOvl(); let m; undoable("Am pus din nou prețurile.", () => { m = autoMatch(); }); };
/* meniul unei oferte direct din listă */
ACT.lmenu = el => { const id = el.dataset.id, s0 = DOCS["p/" + id], e = entry(id); if (!s0) return; LM = id;
  sheet(h3(esc(nameOf(s0, e))) + '<span class="lb">Cum stă</span><div class="seg">' + Object.keys(STARI).map(k => `<button data-a="lstare" data-k="${k}" class="${(s0.proj.stare || "lucru") === k ? "on" : ""}">${STARI[k]}</button>`).join("") + "</div>" +
    op("lopen", "", "folder-open", "Deschide", "Vezi și schimbi oferta.") + op("ldup", "", "copy", "Fă o copie", "Pentru o variantă sau pentru altă lucrare la fel.") +
    (e && e.arh ? op("lunarh", "", "archive", "Scoate din arhivă", "O pui înapoi în lista de oferte.") : op("larh", "", "archive", "Arhivează", "Dispare din listă. O găsești la „Arhivă”.")) +
    op("ldel", "", "trash-2", "Șterge oferta", "Se șterge de tot, de pe telefon și de pe laptop.")); };
let LM = "";
ACT.lstare = el => { const s0 = DOCS["p/" + LM]; s0.proj.stare = el.dataset.k; store.put("p/" + LM, () => DOCS["p/" + LM]); closeOvl(); render(); toast("Oferta e " + STARI[el.dataset.k] + "."); };
ACT.lopen = () => go("#/o/" + LM);
ACT.ldup = () => { const id = dupOffer(LM); go("#/o/" + id); toast("Am făcut o copie. Ești în copie acum."); };
ACT.larh = () => { const e = entry(LM); e.arh = true; store.put("index", () => IDX, 0); closeOvl(); render(); toast("Am pus-o în arhivă.", () => { delete e.arh; store.put("index", () => IDX, 0); render(); }); };
ACT.lunarh = () => { delete entry(LM).arh; store.put("index", () => IDX, 0); closeOvl(); render(); toast("E din nou în lista de oferte."); };
ACT.ldel = () => delAsk(LM);
function delAsk(id) { DEL = id; sheet(h3("Ștergi oferta?") + `<p class="s">„${esc(nameOf(DOCS["p/" + id], entry(id)))}” se șterge de tot, de pe telefon și de pe laptop, și nu se mai poate aduce înapoi din listă.</p><button class="sec r" data-a="delok">Da, șterge definitiv</button><button class="pri" data-a="x">Nu, las-o</button>`); }
let DEL = "";
ACT.stare = el => { st.proj.stare = el.dataset.k; save(); closeOvl(); render(); toast("Oferta e " + STARI[el.dataset.k] + "."); };
ACT.dup = () => { const id = dupOffer(CUR); go("#/o/" + id); toast("Am făcut o copie. Ești în copie acum."); };
ACT.arh = () => { const e = entry(CUR); e.arh = true; store.put("index", () => IDX, 0); go("#/"); toast("Am pus-o în arhivă.", () => { delete e.arh; store.put("index", () => IDX, 0); render(); }); };
ACT.unarh = () => { delete entry(CUR).arh; store.put("index", () => IDX, 0); closeOvl(); render(); toast("E din nou în lista de oferte."); };
ACT.del = () => delAsk(CUR);
ACT.delok = async () => { const id = DEL || CUR; { const mn = /^(\d{4})\/(\d+)$/.exec(String(((DOCS["p/" + id] || {}).proj || {}).nrOferta || "").trim()); if (mn) { IDX.nr = IDX.nr || {}; IDX.nr[mn[1]] = Math.max(IDX.nr[mn[1]] || 0, +mn[2]); } } IDX.list = IDX.list.filter(x => x.id !== id); (IDX.del = IDX.del || {})[id] = todayIso(); delete DOCS["p/" + id]; if (CUR === id) { CUR = ""; st = null; } store.put("index", () => IDX, 0); try { await store.remove("p/" + id); } catch (e) { } closeOvl(); if (VIEW.name === "list") render(); else go("#/"); toast("Ofertă ștearsă."); };
ACT.target = () => { const t = totals(); sheet(h3("Vreau alt total") + `<p class="s">Acum oferta e ${fmt(t.sub)} lei fără TVA. Scrie cât vrei să fie. Toate prețurile se schimbă în aceeași măsură.</p>` + fld("tgt", "Total dorit, fără TVA (lei)", "", { n: 1, af: 1 }) + '<button class="pri" data-a="tgtok" data-ok="1">Schimbă prețurile</button>'); };
function scaleTo(target) {
  const cur = totals().sub; if (!(cur > 0) || !(target > 0)) return null; const f = target / cur;
  st.rows.forEach(r => { if (r.k === "c") { const i = rowInfo(r); if (i.val > 0) setOv(r, Math.round(i.val * f)); } else if (+r.pret) r.pret = r2(r.pret * f); });   // și reducerile (rânduri cu minus) se schimbă în aceeași măsură
  const d = r2(target - totals().sub);
  if (Math.abs(d) >= 0.005) { const c = st.rows.filter(r => (r.k === "c" && r.ov > 0) || (r.k === "r" && (+r.cant || 0) === 1 && r.pret > 0)).sort((a, b) => rowInfo(b).val - rowInfo(a).val)[0]; if (c) { if (c.k === "c") c.ov = r2(c.ov + d); else c.pret = r2(c.pret + d); } }
  return r2(target - totals().sub);
}
ACT.tgtok = () => { const t = num(val("tgt")); if (!(t > 0)) { toast("Scrie suma dorită."); return; } if (!(totals().sub > 0)) { closeOvl(); toast("Oferta nu are încă prețuri."); return; } closeOvl(); let d = 0; undoable("Prețuri schimbate.", () => { d = scaleTo(t); }); if (d) toast("A ieșit " + fmt(totals().sub) + " lei (diferență de " + fmt(Math.abs(d)) + " lei din rotunjiri).", UNDO); };
/* Condiții de lucru (cercetarea din 15.11.2026): acces greu și urgență cresc toată manopera, transparent, peste adaosul tău.
   Se păstrează separat (st.cond) și adaosul total se socotește din ele de fiecare dată, ca să nu se adune de două ori. */
const COND = { acc: [[0, "normal"], [10, "greu +10%"], [20, "foarte greu +20%"]], urg: [[0, "normal"], [25, "urgent +25%"], [50, "noapte / sărbători +50%"]] };
const condOf = s => { s = s || st; const c = s.cond || {}; return { adm: c.adm != null ? +c.adm : +s.adaos || 0, acc: +c.acc || 0, urg: +c.urg || 0 }; };
const condAdaos = c => r2(((1 + (+c.adm || 0) / 100) * (1 + (+c.acc || 0) / 100) * (1 + (+c.urg || 0) / 100) - 1) * 100);
const condTxt = s => { const c = condOf(s), t = []; if (c.acc) t.push("acces " + (c.acc >= 20 ? "foarte greu" : "greu") + " +" + c.acc + "%"); if (c.urg) t.push((c.urg >= 50 ? "noapte / sărbători" : "urgent") + " +" + c.urg + "%"); return t.join(" · "); };
const segC = (id, k, cur) => `<div class="seg" id="${id}">` + COND[k].map(([v, t]) => `<button data-a="segp" data-v="${v}" class="${cur === v ? "on" : ""}">${t}</button>`).join("") + "</div>";
ACT.opts = () => { const c = condOf(); sheet(h3("Rotunjire, adaos și condiții") + '<span class="lb">Rotunjește fiecare capitol la</span><div class="seg" id="oRnd">' + [[0, "nimic"], [100, "100 lei"], [500, "500 lei"], [1000, "1.000 lei"]].map(([v, t]) => `<button data-a="segp" data-v="${v}" class="${(+st.rnd || 0) === v ? "on" : ""}">${t}</button>`).join("") + "</div>" + fld("oAd", "Adaos la toate pozițiile din listă (%)", edn(c.adm), { n: 1, ph: "0" }) +
  '<span class="lb">Acces la lucrare</span>' + segC("oAcc", "acc", c.acc) + '<p class="s" style="margin:6px 2px 0">Subsol, etaj fără lift, spații înguste, program impus de beneficiar.</p>' +
  '<span class="lb">Urgență</span>' + segC("oUrg", "urg", c.urg) + '<p class="s" style="margin:6px 2px 0">Se adaugă peste prețuri; în ofertă apar deja socotite, iar aici vezi din ce vin.</p>' +
  '<button class="pri" data-a="optsok" data-ok="1">Gata</button>'); };
ACT.segp = el => { $$("button", el.parentNode).forEach(b => b.classList.toggle("on", b === el)); };
ACT.optsok = () => { const b = $("#oRnd button.on"), on = id => { const x = $("#" + id + " button.on"); return x ? +x.dataset.v : 0; }; st.rnd = b ? +b.dataset.v : 0;
  const c = { adm: num(val("oAd")), acc: on("oAcc"), urg: on("oUrg") }; if (c.acc || c.urg) st.cond = c; else delete st.cond; st.adaos = condAdaos(c); save(); closeOvl(); render(); };
/* „Îmi iese?”: costul oamenilor față de ofertă */
const RK = [["muncitori", "Câți oameni"], ["zile", "Câte zile de lucru"], ["oreZi", "Ore pe zi"], ["costOra", "Cât te costă un om pe oră (lei, cu tot cu taxe)"], ["deplasare", "Drum, cazare, diurnă (lei)"], ["materiale", "Alte cheltuieli (lei)"]];
function riscOut() {
  const o = {}; RK.forEach(([k]) => o[k] = num(val("k_" + k))); const sub = totals().sub, r = OF.risc(Object.assign({}, o, { oferta: sub })), m = r.marja * 100, zi = o.muncitori * o.oreZi * o.costOra;
  const cls = !(r.ore > 0) ? "gy" : m < 15 ? "no" : m < 25 ? "wr" : "ok";
  $("#kOut").innerHTML = !(r.ore > 0) ? '<div class="nt">Scrie câți oameni și câte zile.</div>' : `<div class="tl"><span>Oferta (fără TVA)</span><b>${fmt(sub)} lei</b></div><div class="tl"><span>Te costă (${fmt(r.ore)} ore de om + cheltuieli)</span><b>${fmt(r.cost)} lei</b></div><div class="tl"><span>Îți rămâne</span><b>${fmt(r.profit)} lei</b></div>
<div class="tag ${cls}" style="margin-top:10px;width:100%;justify-content:center;min-height:40px">${r.profit < 0 ? "Ieși în pierdere." : "Rămâi cu " + fmt(m) + "% din ofertă."} ${r.ore ? "Încasezi " + fmt(sub / r.ore) + " lei pe ora de om." : ""}</div>${zi > 0 ? `<p class="s" style="margin-top:10px">Banii din ofertă ajung pentru ${fmt(Math.floor((sub - o.deplasare - o.materiale) / zi))} zile cu ${fmt(o.muncitori)} oameni. Peste atât, lucrezi în pierdere.</p>` : ""}`;
  return o;
}
ACT.risc = () => { const d = Object.assign({ muncitori: 4, zile: 0, oreZi: 8, costOra: 50, deplasare: 0, materiale: 0 }, FIRMA.risc || {}, st.risk && st.risk.zile ? st.risk : {}); sheet(h3("Îmi iese?") + '<p class="s">Socoteala e doar pentru tine. Nu apare în ofertă.</p>' + RK.map(([k, l]) => fld("k_" + k, l, edn(d[k]), { n: 1 })).join("") + '<div id="kOut" style="margin-top:14px"></div><button class="pri" data-a="riscok">Gata</button>'); $$("#ovl .sheet input").forEach(i => i.setAttribute("data-i", "krisc")); riscOut(); };
INP.krisc = () => riscOut();
ACT.riscok = () => { const o = riscOut(); st.risk = Object.assign(st.risk || {}, o); FIRMA.risc = { muncitori: o.muncitori, oreZi: o.oreZi, costOra: o.costOra }; saveFirma(); save(); closeOvl(); };

/* ---------- adu o listă: fișier (Excel, CSV, PDF) sau text lipit ---------- */
let IM = null; const FILES = {};
ACT.imp = () => { sheet(h3("Adu o listă") + '<p class="s">Lista de cantități de la proiectant sau de la antreprenor.</p>' + op("ifile", "", "file-up", "Alege un fișier", "Excel (.xlsx, .xls), ODS, CSV, PDF sau Word.") + op("itext", "", "clipboard-paste", "Lipește sau scrie text", "Din WhatsApp, e-mail sau Excel. Merge și „12 calorifere la 230”.")); };
ACT.ifile = () => { $("#fImp").value = ""; $("#fImp").click(); };
$("#fImp").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return; sheet(h3("Citesc fișierul…") + `<p class="s">${esc(f.name)}</p>`);
  try { const buf = await f.arrayBuffer(), res = await IMP.readFile({ name: f.name, data: buf }); IM = { res, buf, on: res.tables.map(t => t.ok && !t.skip), grp: "fel", hid: 1 }; impSheet(); }
  catch (err) { sheet(h3("Nu am putut citi fișierul") + `<p class="s">${esc((err && err.message) || err)}</p><button class="pri" data-a="x">Am înțeles</button>`); }
});
function impSheet() {
  const r = IM.res, n = r.tables.reduce((a, t, i) => a + (IM.on[i] ? t.n : 0), 0), any = r.tables.some(t => t.ok), nh = r.tables.reduce((a, t, i) => a + (IM.on[i] && t.ok ? t.items.filter(x => x.hid).length : 0), 0);
  sheet(h3(any ? "Am găsit " + plural(r.tables.reduce((a, t) => a + (t.ok ? t.n : 0), 0), "o poziție", "poziții") : "Nu am găsit o listă") + `<p class="s">${esc(r.name || "")}</p>` +
    r.tables.map((t, i) => `<button class="tb ${t.ok ? (IM.on[i] ? "on" : "") : "off"}" data-a="${t.ok ? "imt" : ""}" data-k="${i}"><i>${IM.on[i] ? ic("check", 16, 3) : ""}</i><p>${esc(t.name || "Tabel")}<small>${t.ok ? plural(t.n, "o poziție", "poziții") + (t.kind === "sume" || t.kind === "randuri" ? " · intră ca rânduri în ofertă" : "") + (t.skip ? " · " + (t.hint === "echipamente" ? "listă de echipamente, nebifată" : t.hint === "ascunsa" ? "foaie ascunsă în fișier, nebifată" : t.hint === "alaturate" ? "două tabele alăturate, nebifată" : "centralizator, nebifat") : "") + (t.title && t.title !== t.name ? " · " + esc(t.title) : "") : esc(t.why || "nu am găsit denumire și cantitate")}${(t.warn || []).length ? "<br>" + t.warn.map(esc).join("<br>") : ""}</small></p></button>`).join("") +
    (r.notes || []).map(x => `<div class="nt">${esc(x)}</div>`).join("") +
    (nh ? `<span class="lb">${plural(nh, "Un rând ascuns", "rânduri ascunse")} în fișier</span><div class="seg"><button data-a="imhid" data-k="1" class="${IM.hid ? "on" : ""}">le ofertez</button><button data-a="imhid" data-k="0" class="${IM.hid ? "" : "on"}">nu le ofertez</button></div>` : "") +
    (any ? `<span class="lb">Cum le împart pe capitole</span><div class="seg"><button data-a="imgrp" data-k="fel" class="${IM.grp === "fel" ? "on" : ""}">după felul lucrării</button><button data-a="imgrp" data-k="fis" class="${IM.grp === "fis" ? "on" : ""}">ca în fișier</button></div><button class="pri" data-a="imok" ${n ? "" : "disabled"}>Adu ${plural(n, "o poziție", "poziții")}</button>` : '<button class="pri" data-a="x">Am înțeles</button>'));
}
ACT.imagain = () => { if (!IM) { closeOvl(); return; } IM.again = 1; ACT.imok(); };
ACT.imt = el => { const i = +el.dataset.k; IM.on[i] = !IM.on[i]; impSheet(); };
ACT.imgrp = el => { IM.grp = el.dataset.k; impSheet(); };
ACT.imhid = el => { IM.hid = el.dataset.k === "1" ? 1 : 0; impSheet(); };
ACT.imok = () => {
  const r = IM.res, fi = newNum(st.files), meta = { id: fi, n: r.name, k: r.kind, t: {} }; let add = 0; const mine = [];   // fiecare fișier adus are numărul lui (două aparate pot aduce liste în același timp)
  /* aceeași listă adusă încă o dată: mă uit câte dintre rândurile ei sunt deja în ofertă (și dacă între timp ai șters câteva) */
  const nNew = r.tables.reduce((a, t, i) => a + (IM.on[i] && t.ok ? t.n : 0), 0), sameF = st.files.filter(f => f.n === r.name).map(f => f.id), have = new Set(st.items.filter(it => sameF.includes(it.f)).map(it => (it.sh || "") + "|" + (it.rw || 0)));
  let nDup = 0; if (have.size) r.tables.forEach((t, i) => { if (IM.on[i] && t.ok) t.items.forEach(it => { if (have.has((it.sheet || t.name) + "|" + (it.row || 0))) nDup++; }); });
  const dup = !IM.again && r.kind !== "text" && nDup > 0;
  if (dup) { sheet(h3("Lista asta e deja în ofertă") + `<p class="s">Ai mai adus „${esc(r.name)}” (${nDup === nNew ? plural(nNew, "o poziție", "poziții") : nDup + " din cele " + plural(nNew, "o poziție", "poziții") + " sunt deja în ofertă"}). Dacă o aduci încă o dată, pozițiile apar de două ori și suma se dublează.</p><button class="pri" data-a="x">Nu o mai aduc</button><button class="sec" data-a="imagain" style="margin-top:10px">O aduc încă o dată</button>`); return; }
  r.tables.forEach((t, i) => { if (!IM.on[i] || !t.ok) return; meta.t[t.name] = { cols: t.cols, hr: t.headerRow, title: t.title || "" };
    if (t.kind === "sume" || t.kind === "randuri") { t.items.forEach(it => st.rows.push({ id: nextRow(), k: "r", den: it.den, um: it.um || "buc", cant: +it.cant || 1, pret: (it.neg ? -1 : 1) * (+it.pret || 0) })); add += t.items.length; return; }
    t.items.forEach(it => { if (it.neg) { st.rows.push({ id: nextRow(), k: "r", den: it.den, um: it.um || "buc", cant: +it.cant || 1, pret: -(+it.pret || 0) }); add++; return; } const cap0 = String(it.cap0 || t.title || t.name || "Listă").replace(/\s+/g, " ").slice(0, 90), x = { id: nextItem(), cap0, cap: IM.grp === "fis" ? cap0 : OF.autoCap(it.den, cap0), cod: it.cod || "", den: it.den, um: it.um || "buc", cant: +it.cant || 0, pret: +it.pret || 0, conf: false, src: it.pret > 0 ? "file" : "", f: fi, sh: it.sheet || t.name, rw: it.row || 0 }; if (r.kind !== "text") x.q0 = x.cant; if (it.hid) x.hid = 1; st.items.push(x); mine.push(x); add++; }); });
  st.files.push(meta); if (IM.buf && /^xls[xm]$/.test(r.kind || "")) FILES[CUR + "/" + fi] = { name: r.name, data: IM.buf }; syncRows(st); const hidNo = IM.hid ? [] : mine.filter(x => x.hid), m = autoMatch(mine.filter(x => !hidNo.includes(x))); hidNo.forEach(x => { x.no = 1; }); save(); closeOvl(); IM = null; render();
  const nfp = mine.filter(x => x.src === "file" && x.pret > 0).length, parts = [nfp ? nfp + " cu preț din fișier" : "", m.a ? m.a + " cu preț din prețurile tale" : "", m.e ? m.e + " estimate" : "", m.z ? m.z + " fără preț" : ""].filter(Boolean);
  const msg = (mine.length ? `Am adus ${plural(add, "o poziție", "poziții")}${parts.length ? ": " + parts.join(", ") : ""}.` : `Am adus ${plural(add, "un rând", "rânduri")}.`) + (hidNo.length ? ` ${plural(hidNo.length, "Un rând ascuns e", "rânduri ascunse sunt")} la „nu ofertez”.` : "");
  const dq = domGroups(mine);   // întreabă doar dacă lista are și lucrări pe care poate nu le faci (ori un domeniu pe care l-ai oprit data trecută); atunci arată TOATE domeniile din listă
  if (Object.keys(dq).some(k => DOMQ[k])) { DQ = { dq, msg }; domSheet(); } else toast(msg);
};
/* lista are și ventilație, climatizare, electrice…: le ofertezi? (ține minte răspunsul pentru data viitoare) */
let DQ = null;
function domSheet() { sheet(h3("Ce ofertezi din listă?") + `<p class="s">${esc(DQ.msg)}</p><p class="s">Lista are și lucrări pe care poate nu le faci. Lasă pornit doar ce ofertezi. Restul rămân în listă, dar nu intră în ofertă și nu apar ca „fără preț”.</p>` + Object.keys(DQ.dq).map(k => sw("dq_" + k, DOMALL[k] + " · " + plural(DQ.dq[k].length, "o poziție", "poziții"), domDef(k))).join("") + '<button class="pri" data-a="dqok">Gata</button>'); }
ACT.dqok = () => { if (!DQ) { closeOvl(); return; } FIRMA.dom = FIRMA.dom || {}; let n = 0; for (const k in DQ.dq) { const on = isOn("dq_" + k); if (DOMQ[k]) FIRMA.dom[k] = on ? 1 : 0; if (!on) DQ.dq[k].forEach(x => { x.no = 1; n++; }); } saveFirma(); save(); DQ = null; closeOvl(); render(); toast(n ? plural(n, "O poziție trecută", "poziții trecute") + " la „nu ofertez”. Le găsești în capitol, la „Nu ofertez”." : "Le ofertezi pe toate."); };
ACT.itext = () => { sheet(h3("Lipește sau scrie") + '<p class="s">Câte o lucrare pe rând. Exemple: „12 calorifere la 230”, „pardoseală 190 mp x 68”, „montaj centrală 1150”. Poți lipi și un tabel copiat din Excel.</p><textarea class="inp" id="iTxt" style="min-height:170px" placeholder="12 calorifere la 230&#10;pardoseală 190 mp x 68&#10;montaj centrală 1150" autofocus></textarea><button class="pri" data-a="iread">Citește</button>'); };
let LN = null;
ACT.iread = () => {
  const t = $("#iTxt").value; if (!t.trim()) { toast("Scrie sau lipește ceva."); return; }
  const ls = t.split(/\r?\n/).filter(x => x.trim()), tab = ls.filter(x => /\t|;|\|/.test(x)).length;
  if (ls.length > 1 && tab >= ls.length * 0.6) { const res = IMP.readText(t, "Text lipit"); IM = { res, buf: null, on: res.tables.map(x => x.ok && !x.skip), grp: "fel" }; impSheet(); return; }
  LN = IMP.parseLines(t).filter(x => x && x.den).map(x => Object.assign({ m: "u" }, x)); if (!LN.length) { toast("Nu am înțeles niciun rând."); return; } lnSheet();
};
function lnSheet() { sheet(h3("Am înțeles " + plural(LN.length, "un rând", "rânduri")) + '<p class="s">Verifică. Unde nu e clar dacă suma e pe bucată sau cu totul, alege tu.</p>' + LN.map((x, i) => { const pr = (x.neg ? -1 : 1) * (x.m === "t" && x.cant ? r2(x.pret / x.cant) : x.pret); return `<div class="tb on" style="cursor:default"><i>${ic("check", 16, 3)}</i><p>${esc(x.den)}<small>${fq(x.cant)} ${esc(x.um)} × ${fmt(pr)} lei = ${fmt(r2(x.cant * pr))} lei</small>${x.amb && x.cant > 1 ? `<span class="seg" style="margin-top:8px;display:flex"><button data-a="lnm" data-k="${i}" data-m="u" class="${x.m === "u" ? "on" : ""}">${fmt(x.pret)} pe ${esc(x.um)}</button><button data-a="lnm" data-k="${i}" data-m="t" class="${x.m === "t" ? "on" : ""}">${fmt(x.pret)} cu totul</button></span>` : ""}</p></div>`; }).join("") + `<button class="pri" data-a="lnok">Pune ${plural(LN.length, "rândul", "rânduri")} în ofertă</button>`); }
ACT.lnm = el => { LN[+el.dataset.k].m = el.dataset.m; lnSheet(); };
ACT.lnok = () => { const n = LN.length; LN.forEach(x => { const sg = x.neg && x.pret > 0 ? -1 : 1, o = { den: x.den.charAt(0).toUpperCase() + x.den.slice(1), um: x.um || "buc", cant: +x.cant || 1, pret: sg * (x.m === "t" && x.cant ? r2(x.pret / x.cant) : +x.pret || 0) }; st.rows.push(Object.assign({ id: nextRow(), k: "r" }, o)); learn(o); }); LN = null; save(); closeOvl(); render(); toast(plural(n, "Un rând pus", "rânduri puse") + " în ofertă."); };

/* ---------- descarcă: Excel ca al tău, listă scurtă sau fișierul clientului cu prețurile tale ---------- */
let XP = null;
const chapX = () => st.rows.filter(r => !r.no && !(r.k === "c" && rowInfo(r).n === 0 && rowInfo(r).nn > 0)).map(r => { const i = rowInfo(r); return r.k === "c" ? { name: r.den, value: i.val } : { name: r.den, um: r.um, cant: +r.cant || 0, pret: +r.pret || 0, value: i.val }; }).filter(c => c.value > 0 || c.name);
const fileOf = id => st.files.find(f => f.id === id);
const xlFiles = () => st.files.map(f => ({ f, i: f.id })).filter(x => x.f.k !== "text" && st.items.some(it => it.f === x.i));   // textul lipit nu e „fișierul clientului”
ACT.xl = () => { if (!st.rows.length) { toast("Oferta e goală. Pune întâi un rând."); return; } XP = { k: "mare", anexa: st.items.length > 0, fi: -1 }; xlSheet(); xlPrep(); };
function xlSheet() {
  const fara = offered().filter(i => !(i.pret > 0)).length, nno = st.items.length - offered().length, r0 = st.rows.filter(r => !r.no && rowInfo(r).val <= 0 && !(r.k === "c" && rowInfo(r).n === 0)).length, cl = xlFiles();
  const o = (k, icon, t, s, fi) => `<button class="op" data-a="xlk" data-k="${k}" data-fi="${fi == null ? -1 : fi}" style="${XP.k === k && (k !== "client" || XP.fi === fi) ? "box-shadow:inset 0 0 0 2.5px var(--navy);background:#F4F8FD" : ""}"><i>${ic(icon, 24, 2)}</i><p>${t}<small>${s}</small></p></button>`;
  sheet(h3("Descarcă oferta") + o("mare", "file-spreadsheet", "Oferta mea, cu antet", "Foaia cu antet albastru, beneficiar, capitole, total, condiții.") + o("scurta", "list", "Ofertă scurtă", "Listă simplă: lucrare și cost. Cum faci la case.") +
    cl.map(x => o("client", "file-up", "Fișierul clientului, cu prețurile mele", /\.xls[xm]$/i.test(x.f.n || "") ? "Pun prețurile în „" + esc(x.f.n) + "”, fără să-i schimb forma." : "Fac un Excel cu rândurile din „" + esc(x.f.n) + "”, în aceeași ordine, cu prețul și valoarea.", x.i)).join("") +
    (XP.k === "mare" && st.items.length ? sw("xAnx", "Pune și lista de poziții cu prețuri (anexă)", XP.anexa).replace('data-a="sw"', 'data-a="sw" data-then="xlanx"') : "") +
    (fara || r0 ? `<div class="nt">${fara ? plural(fara, "O poziție nu are", "poziții nu au") + " preț și nu intră în total. " : ""}${r0 ? plural(r0, "Un rând e fără valoare și nu apare", "rânduri sunt fără valoare și nu apar") + " în ofertă." : ""}</div>` : "") +
    (nno ? `<div class="nt q">${plural(nno, "O poziție neofertată rămâne", "poziții neofertate rămân")} fără preț în fișier.</div>` : "") +
    (!String(FIRMA.firma || "").trim() ? '<div class="nt">Nu ai completat „Firma mea”: oferta iese fără numele și datele firmei. Le pui din lista de oferte, la „Firma mea”.</div>' : "") +
    '<div id="xNote"></div><button class="pri" data-a="xlgo" id="xGo" disabled>Se pregătește…</button>');
}
ACT.xlk = el => { XP = { k: el.dataset.k, anexa: XP.anexa, fi: +el.dataset.fi }; xlSheet(); xlPrep(); };
ACT.xlanx = () => { XP = { k: XP.k, anexa: isOn("xAnx"), fi: XP.fi }; const b = $("#xGo"); if (b) { b.disabled = true; b.textContent = "Se pregătește…"; } xlPrep(); };
async function xlPrep() {
  const my = XP, nm = fileSafe(st.proj.santier) || "fara nume"; my.blob = null; my.err = "";
  try {
    if (my.k === "client") {
      const key = CUR + "/" + my.fi, inPlace = /^xls[xm]$/.test(fileOf(my.fi).k || "") && /\.xls[xm]$/i.test(fileOf(my.fi).n || ""), f = inPlace ? FILES[key] : { name: fileOf(my.fi).n, data: new Uint8Array(0) };   // pentru PDF, .xls, text nu am nevoie de fișier: fac unul nou din rândurile ținute minte
      if (!f) { my.need = true; if (XP === my) { $("#xNote").innerHTML = `<div class="nt">Am nevoie de fișierul primit: „${esc(fileOf(my.fi).n)}”. Apasă mai jos și alege-l din telefon sau din laptop.</div>`; const b = $("#xGo"); b.disabled = false; b.textContent = "Alege fișierul primit"; } return; }
      const out = await fillClient(f, my.fi); my.blob = new Blob([out.data], { type: XLSX_MIME }); my.name = out.name; my.notes = out.notes || [];
    } else {
      await SCV.needXl();
      const wb = my.k === "scurta" ? OFX.exportShort(ExcelJS, { proj: projX(), chap: chapX() }) : OFX.exportOffer(ExcelJS, { proj: projX(), chap: chapX(), items: (EP => { const ord = new Map(), nmc = new Map(); st.rows.forEach((r, i) => { if (r.k === "c") { ord.set(r.cap, i); nmc.set(r.cap, r.den || r.cap); } });   // anexa: capitolele în ordinea și cu numele din ofertă
        return offered().map((it, j) => Object.assign({}, it, { cap: nmc.get(it.cap) || it.cap, ord: (ord.has(it.cap) ? ord.get(it.cap) : 1e6) * 1e6 + j, pret: EP.get(it.id) || 0, tot: r2((+it.cant || 0) * (EP.get(it.id) || 0)) })); })(effPrices()), adaos: 0 }, { anexa: my.anexa });
      my.blob = new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME }); my.name = "OFERTA " + nm + (my.k === "scurta" ? " (scurta)" : "") + ".xlsx";
    }
  } catch (e) { my.err = (e && e.message) || String(e); }
  if (XP !== my || !$("#xGo")) return; const b = $("#xGo");
  if (my.need && !my.blob) return;
  if (my.err) { $("#xNote").innerHTML = `<div class="nt">Nu am putut face fișierul: ${esc(my.err)}</div>`; b.disabled = true; b.textContent = "Nu s-a putut"; return; }
  $("#xNote").innerHTML = (my.notes || []).map(x => `<div class="nt">${esc(x)}</div>`).join(""); b.disabled = false; b.innerHTML = ic("download", 20, 2.2) + "Descarcă";
}
ACT.xlgo = async () => {
  if (XP.need && !XP.blob) { $("#fOrig").value = ""; $("#fOrig").click(); return; }
  if (!XP.blob) return; const r = await SCV.saveFile(XP.name, XP.blob, XLSX_MIME); if (r !== "cancelled") { closeOvl(); toast(r === "shared" ? "Trimis." : "Am descărcat „" + XP.name + "”."); if (st.proj.stare === "lucru") { /* rămâne în lucru până o trece el la trimisă */ } }
};
$("#fOrig").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f || !XP) return; const my = XP, fi = my.fi, buf = await f.arrayBuffer(), b = $("#xGo"); if (b) { b.disabled = true; b.textContent = "Verific fișierul…"; }
  let bad = -1;                                           // câte rânduri din ofertă nu se regăsesc la locul lor în fișierul ales
  try { const res = await IMP.readFile({ name: f.name, data: buf.slice(0) }), m = new Map(); res.tables.forEach(t => (t.items || []).forEach(it => m.set((it.sheet || t.name) + "|" + it.row, OF.keyOf(it.den))));
    const mine = st.items.filter(it => it.f === fi && it.rw); if (mine.length) bad = mine.filter(it => { const a = m.get(it.sh + "|" + it.rw), k = OF.keyOf(it.den); return a == null || !(a === k || a.indexOf(k) >= 0 || k.indexOf(a) >= 0); }).length; } catch (err) { bad = -1; }
  if (XP !== my) return;
  if (bad !== 0) { if ($("#xNote")) $("#xNote").innerHTML = `<div class="nt">Fișierul ales nu e cel din care ai adus lista${bad > 0 ? " (" + plural(bad, "un rând nu se potrivește", "rânduri nu se potrivesc") + ")" : ""}. Alege fișierul primit la început. Dacă ai primit o variantă nouă a listei, adu-o din nou în ofertă.</div>`; if (b) { b.disabled = false; b.textContent = "Alege fișierul primit"; } return; }
  FILES[CUR + "/" + fi] = { name: f.name, data: buf }; my.need = false; if (b) { b.disabled = true; b.textContent = "Se pregătește…"; } xlPrep();
});
/* prețurile mele puse în fișierul primit (wb.js) */
async function fillClient(file, fi) {
  if (!window.WB) throw new Error("modulul pentru fișierul clientului nu e încărcat");
  const meta = fileOf(fi), by = {}, clr = {}, EP = effPrices(), live = new Set(); st.items.forEach(it => { if (it.f !== fi || !it.rw) return; live.add(it.sh + "|" + it.rw); by[it.sh] = by[it.sh] || []; if (isNo(it)) (clr[it.sh] = clr[it.sh] || []).push(it.rw); else by[it.sh].push({ row: it.rw, pret: EP.get(it.id) || 0, cant: +it.cant || 0 }); });
  (meta.del || []).forEach(([sh, rw]) => { if (live.has(sh + "|" + rw)) return; by[sh] = by[sh] || []; (clr[sh] = clr[sh] || []).push(rw); });   // pozițiile șterse din ofertă: prețul vechi din fișier se golește
  const sheets = Object.keys(by).map(sh => { const t = meta.t[sh] || {}, tbl = { name: sh, cols: t.cols || {}, headerRow: t.hr || 0 }; return { sheet: sh, plan: WB.plan(tbl), headerRow: t.hr || 0, cols: t.cols || {}, rows: by[sh], clear: clr[sh] || [] }; });
  const tables = Object.keys(by).map(sh => ({ name: sh, title: (meta.t[sh] || {}).title || "", items: st.items.filter(it => it.f === fi && it.sh === sh).map(it => ({ nr: "", cod: it.cod || "", den: it.den, um: it.um, cant: +it.cant || 0, pret: 0, cap0: it.cap0 || "", row: it.rw })) }));
  const out = await WB.fill({ name: file.name, data: file.data }, sheets, { tables });
  out.notes = (out.notes || []).concat(clientDiff(fi)); return out;
}
/* Fișierul clientului are doar pozițiile lui, cu cantitățile lui. Dacă oferta ta are și altceva (rânduri puse de tine, o reducere, alte liste)
   sau ai schimbat cantități, totalul din fișier nu mai e totalul ofertei: o spun limpede, cu sumele. */
function clientDiff(fi) {
  const EP = effPrices(), mine = st.items.filter(it => it.f === fi && it.rw && !isNo(it)), notes = [];
  const qch = mine.filter(it => it.q0 != null && Math.abs((+it.cant || 0) - it.q0) > 1e-9);
  const fileTot = r2(mine.reduce((a, it) => a + r2((it.q0 != null ? it.q0 : (+it.cant || 0)) * (EP.get(it.id) || 0)), 0)), offTot = totals().sub;
  if (qch.length) notes.push((qch.length === 1 ? "La o poziție ai" : "La " + qch.length + " poziții ai") + " schimbat cantitatea față de fișier (de ex. „" + String(qch[0].den).slice(0, 40) + "”: " + fq(qch[0].q0) + " → " + fq(qch[0].cant) + "). În fișierul clientului a rămas cantitatea lui.");
  if (Math.abs(fileTot - offTot) >= 0.01) notes.push("ATENȚIE: pozițiile din fișierul clientului dau " + fmt(fileTot) + " lei, iar oferta ta e " + fmt(offTot) + " lei (diferență " + fmt(Math.abs(r2(offTot - fileTot))) + " lei). Diferența vine din " + (qch.length ? "cantitățile schimbate" : "ce mai ai în ofertă pe lângă fișier") + (qch.length && Math.abs(r2(offTot - fileTot) - r2(mine.reduce((a, it) => a + r2(((+it.cant || 0) - (it.q0 != null ? it.q0 : (+it.cant || 0))) * (EP.get(it.id) || 0)), 0))) >= 0.01 ? " și din ce mai ai în ofertă pe lângă fișier" : "") + " (rânduri puse de tine, reduceri, alte liste). Spune-i clientului sau trimite-i și oferta ta.");
  return notes;
}

/* ---------- prețurile mele ---------- */
ACT.prf = el => { VIEW.f = el.dataset.f; VIEW.lim = 50; VIEW.q = ""; render(); };
ACT.prmore = () => { VIEW.lim = (VIEW.lim || 50) + 50; $("#prl").innerHTML = priceRows(); };
INP.prq = el => { VIEW.q = el.value; VIEW.lim = 50; $("#prl").innerHTML = priceRows(); };
ACT.fam = el => { const g = {}; OF.famList().forEach(f => (g[f.grp] = g[f.grp] || []).push(f)); $("#famList").innerHTML = Object.keys(g).map(k => `<h4>${esc(k)}</h4><ul>${g[k].map(f => `<li>${esc(f.label)}${f.soft ? ' <span class="mut">– prețul rămâne de verificat</span>' : ""}</li>`).join("")}</ul>`).join(""); el.remove(); };
let PE = null;
function priceSheet(c) { PE = c ? c.id : 0; const h = (c && c.h) || []; sheet(h3(c ? "Preț" : "Preț nou") + fld("eDen", "Lucrarea", c ? c.den : "", { af: !c }) + '<div class="r3"><div>' + fld("eP", "Preț (lei)", c ? edn(c.pret) : "", { n: 1 }) + '</div><div class="um">' + fld("eUm", "UM", c ? c.um : "buc", {}) + "</div></div>" + (c && c.desc ? `<p class="s" style="margin-top:10px">${esc(c.desc)}</p>` : "") + (h.length ? `<p class="s" style="margin-top:10px">Ultimele prețuri puse: ${h.map(x => fmt(x.p) + " lei (" + String(x.d).split("-").reverse().join(".") + (x.o ? ", " + esc(x.o) : "") + ")").join(" · ")}</p>` : "") + (c ? `<div class="minis"><button class="r" data-a="edel">${ic("trash-2", 16, 2.2)}Șterge prețul</button></div>` : "") + '<button class="pri" data-a="esave" data-ok="1">Gata</button>'); }
ACT.pnew = () => priceSheet(null);
/* o lucrare din catalog: îi pui prețul tău (sau îl accepți pe cel propus) */
let NE = null;
ACT.pnom = el => nomSheet(nomRows()[+el.dataset.k]);
ACT.pprod = el => nomSheet(prodRows()[+el.dataset.k]);
function nomSheet(e) { if (!e) return; NE = e; const c = e.c, h = (c && c.h) || [];
  sheet(h3(e.den.length > 90 ? e.den.slice(0, 90) + "…" : e.den) + `<p class="s">${e.prod ? "Apare " + (e.n === 1 ? "o dată" : "de " + e.n + " ori") + " în ofertele tale. Aplicația nu o recunoaște încă; după ce îi pui prețul, îl pun singură de câte ori apare denumirea asta într-o listă." : e.k === "m" ? "Aici ai pus tu prețul." : e.k === "z" ? "Nu ai încă niciun preț pentru lucrarea asta și nici unul din care să-l pot socoti." : e.k === "t" ? "Prețul vine din prețurile tale: " + esc(e.why) + "." : "Preț propus, de verificat: " + esc(e.why) + "."}${e.tier === 3 ? " Apare des în listele de cantități." : ""}</p>` +
    fld("nP", "Prețul tău (lei / " + esc(umShow(e.um)) + ")", c ? edn(c.pret) : "", { n: 1, af: 1, ph: !c && e.p > 0 ? "propus: " + fmt(e.p) : "" }) +
    (h.length ? `<p class="s" style="margin-top:10px">Ultimele prețuri puse: ${h.map(x => fmt(x.p) + " lei (" + String(x.d).split("-").reverse().join(".") + ")").join(" · ")}</p>` : "") +
    (!c && e.p > 0 ? `<button class="sec" data-a="nomacc" style="margin-top:12px">E bun prețul propus: ${fmt(e.p)} lei</button>` : "") +
    (c ? `<div class="minis"><button class="r" data-a="nomdel">${ic("trash-2", 16, 2.2)}Șterge prețul meu</button></div>` : "") + '<button class="pri" data-a="nomsave" data-ok="1">Gata</button>'); }
function nomPut(p) { const e = NE; if (!e) return; if (!(p > 0)) { toast("Scrie prețul."); return; }
  const old = JSON.stringify(catalog), c = e.c && catalog.find(x => x.id === e.c.id);
  if (c) { if (+c.pret !== p) c.h = [{ p, d: todayIso(), o: "" }].concat(c.h || []).slice(0, 6); c.pret = p; }
  else catalog.unshift({ id: newCatId(), dom: "MEU", sec: "", den: e.den, desc: "", um: umShow(e.um), pret: p, learned: true, fam: e.fam || undefined, sz: e.fam ? e.sz : undefined, vars: e.vars.length ? e.vars : undefined, h: [{ p, d: todayIso(), o: "" }] });
  NE = null; catDirty = true; rebuildCat(); saveCat(); closeOvl(); render();
  toast("Am ținut minte: " + e.den + " – " + fmt(p) + " lei / " + umShow(e.um) + ".", () => { catalog = JSON.parse(old); catDirty = true; rebuildCat(); saveCat(); render(); }); }
ACT.nomsave = () => nomPut(num(val("nP")));
ACT.nomacc = () => nomPut(NE ? NE.p : 0);
ACT.nomdel = () => { const e = NE; if (!e || !e.c) return; const id = e.c.id, old = JSON.stringify(catalog); catalog = catalog.filter(c => c.id !== id); NE = null; catDirty = true; rebuildCat(); saveCat(); closeOvl(); render(); toast("Preț șters.", () => { catalog = JSON.parse(old); catDirty = true; rebuildCat(); saveCat(); render(); }); };
/* învață prețurile din ofertele vechi (unul sau mai multe fișiere deodată) */
let LRN = null;
ACT.plearn = () => { $("#fLearn").value = ""; $("#fLearn").click(); };
$("#fLearn").addEventListener("change", async e => {
  const fs = [...e.target.files]; if (!fs.length) return; sheet(h3("Citesc…") + `<p class="s">${plural(fs.length, "un fișier", "fișiere")}</p>`);
  const got = [], bad = [], seen = new Set(); let nf = 0;
  for (const f of fs) { let n = 0; try { const res = await IMP.readFile({ name: f.name, data: await f.arrayBuffer() });
      res.tables.forEach(t => { if (!t.ok || t.f3) return; t.items.forEach(it => { if (!(it.pret > 0) || !it.den || (+it.cant === 1 && OF.umFamily(it.um) === "buc" && it.pret >= 20000)) return; const k = OF.keyOf(it.den) + "|" + OF.umFamily(it.um); if (seen.has(k)) return; seen.add(k); got.push({ den: it.den, um: it.um || "buc", pret: +it.pret, f: f.name, k }); n++; }); }); } catch (err) { }
    if (n) nf++; else bad.push(f.name); }
  const have = new Set(catalog.map(c => OF.keyOf(c.den) + "|" + OF.umFamily(c.um)));
  LRN = { nw: got.filter(x => !have.has(x.k)), all: got.length, nf, bad }; learnSheet();
});
function learnSheet() { const L = LRN, nw = L.nw;
  sheet(h3(nw.length ? "Am găsit " + plural(nw.length, "un preț nou", "prețuri noi") : "Nu am găsit prețuri noi") + `<p class="s">${L.all ? plural(L.all, "Un preț", "prețuri") + " în " + plural(L.nf, "un fișier", "fișiere") + (L.all > nw.length ? "; " + (L.all - nw.length) + " le aveai deja" : "") + "." : "În fișierele alese nu am găsit rânduri cu preț."}</p>` +
    (nw.length ? '<div class="prl" style="margin-top:8px">' + nw.slice(0, 6).map(x => `<button disabled><p>${esc(x.den.length > 80 ? x.den.slice(0, 80) + "…" : x.den)}<small>${esc(x.f)}</small></p><b>${fmt(x.pret)} lei<small>/ ${esc(x.um)}</small></b></button>`).join("") + "</div>" + (nw.length > 6 ? `<p class="s" style="margin-top:8px">… și încă ${nw.length - 6}.</p>` : "") : "") +
    (L.bad.length ? `<div class="nt">Fără prețuri de luat: ${esc(L.bad.join(", "))}</div>` : "") +
    (nw.length ? `<p class="s" style="margin-top:10px">Ia-le doar dacă sunt prețurile tale de manoperă. Prețurile cu material cu tot ar strica ofertele următoare.</p><button class="pri" data-a="plearnok">Ține-le minte (${nw.length})</button>` : '<button class="pri" data-a="x">Am înțeles</button>')); }
ACT.plearnok = () => { const nw = LRN.nw, old = JSON.stringify(catalog), y = new Date().getFullYear(); nw.forEach(x => catalog.push({ id: newCatId(), dom: "OFERTE VECHI", sec: String(x.f).replace(/\.\w+$/, ""), den: x.den, desc: "", um: x.um, pret: x.pret, learned: true, imp: 1, an: y })); LRN = null; catDirty = true; rebuildCat(); saveCat(); closeOvl(); VIEW.f = "m"; VIEW.q = ""; render();
  toast("Am ținut minte " + plural(nw.length, "un preț", "prețuri") + ".", () => { catalog = JSON.parse(old); catDirty = true; rebuildCat(); saveCat(); render(); }); };
ACT.pcat = el => priceSheet(catalog.find(c => c.id == el.dataset.k));
ACT.esave = () => { const den = val("eDen"), p = num(val("eP")), um = val("eUm") || "buc"; if (!den) { toast("Scrie lucrarea."); return; } const c = PE ? catalog.find(x => x.id === PE) : null; if (c) { if (+c.pret !== p) c.h = [{ p, d: todayIso(), o: "" }].concat(c.h || []).slice(0, 6); Object.assign(c, { den, um, pret: p }); } else catalog.unshift({ id: nextCatId++, dom: "MEU", sec: "", den, desc: "", um, pret: p, learned: true, h: [{ p, d: todayIso(), o: "" }] }); catDirty = true; rebuildCat(); saveCat(); closeOvl(); render(); };
ACT.edel = () => { const id = PE, old = JSON.stringify(catalog); catalog = catalog.filter(c => c.id !== id); catDirty = true; rebuildCat(); saveCat(); closeOvl(); render(); toast("Preț șters.", () => { catalog = JSON.parse(old); catDirty = true; rebuildCat(); saveCat(); render(); }); };
ACT.pref = el => { const r = REF[+el.dataset.k]; PE = +el.dataset.k; sheet(h3("Din ofertele tale vechi") + `<p style="font-weight:700;margin:6px 0 0">${esc(r.d)}</p><p class="s" style="margin-top:6px">${fmt(r.p)} lei / ${esc(r.u)} · ${esc(r.pr || "")}${r.an ? ", " + esc(r.an) : ""}${r.s === "p" ? " · de verificat" : ""}</p><button class="pri" data-a="prefok">Pune-l în prețurile mele</button>`); };
ACT.prefok = () => { const r = REF[PE]; catalog.unshift({ id: newCatId(), dom: "OFERTE VECHI", sec: (r.pr || "") + " " + (r.an || ""), den: r.d, desc: "", um: r.u, pret: +r.p, learned: true }); catDirty = true; rebuildCat(); saveCat(); closeOvl(); VIEW.f = "m"; VIEW.q = ""; render(); toast("L-am pus în prețurile tale."); };
ACT.ppia = el => { const p = PIATA.lista[+el.dataset.k]; sheet(h3("Reper de piață") + `<p style="font-weight:700;margin:6px 0 0">${esc(p.lucrare)}</p><div class="tl" style="margin-top:10px"><span>De la – până la</span><b>${fmt(p.min)} – ${fmt(p.max)} ${esc(p.um || "")}</b></div>${p.tipic ? `<div class="tl"><span>Cel mai des</span><b>${fmt(p.tipic)}</b></div>` : ""}<p class="s" style="margin-top:10px">${esc(p.nota || "")}</p><p class="s">TVA: ${esc(p.tva || "neprecizat")} · cât de sigur: ${esc(p.sigur || "orientativ")} · ${esc(PIATA.data || "")}</p><div class="src">${(p.surse || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.titlu)}</a>`).join("")}</div><p class="s" style="margin-top:12px">${p.fam ? "E un reper de pe internet. Îl folosesc doar unde nu ai tu niciun preț, iar poziția apare cu „după piață”, ca să o verifici." : "E doar un reper de pe internet. Nu se pune singur în ofertă."}</p><button class="pri" data-a="x">Am înțeles</button>`); };
ACT.pidx = () => { sheet(h3("Schimbă toate prețurile") + `<p class="s">Se schimbă cele ${catalog.length} prețuri din „Puse de mine” și „Catalogul meu”. Ofertele deja făcute rămân cum sunt.</p>` + fld("ixP", "Cu cât la sută? (ex. 8 sau -5)", "", { n: 1, af: 1 }) + '<button class="pri" data-a="pidxok" data-ok="1">Schimbă</button>'); };
ACT.pidxok = () => { const s = val("ixP").replace(/\s/g, ""), p = (s[0] === "-" ? -1 : 1) * num(s.replace(/^[-+]/, "")); if (!p || p < -90 || p > 300) { toast("Scrie un procent, de exemplu 8."); return; } const old = JSON.stringify(catalog); catalog.forEach(c => { if (c.pret > 0) c.pret = r2(c.pret * (1 + p / 100)); }); catDirty = true; rebuildCat(); saveCat(); closeOvl(); render(); toast("Prețuri schimbate cu " + fmt(p) + "%.", () => { catalog = JSON.parse(old); catDirty = true; rebuildCat(); saveCat(); render(); }); };

/* ---------- firma mea ---------- */
INP.ff = el => { FIRMA[el.dataset.k] = el.value; saveFirma(); };
INP.fd = el => { FIRMA.def = FIRMA.def || {}; FIRMA.def[el.dataset.k] = el.dataset.t === "n" ? num(el.value) : el.value; saveFirma(); };
ACT.acct = () => SCV.account({ pending: () => store ? store.pending() : 0 });
ACT.bkp = () => { const o = {}; Object.keys(DOCS).forEach(p => o[p] = DOCS[p]); o.index = IDX; o.firma = FIRMA; o.catalog = { items: catalog }; SCV.saveFile("ofertare_tot_" + todayIso() + ".json", JSON.stringify(o), "application/json"); };
ACT.hist = () => SCV.history({ app: "oferta",
  label: p => { if (p.indexOf("p/") === 0) { const e = entry(p.slice(2)); return "Ofertă: " + (e ? e.nume : "(ștearsă)"); } return p === "index" ? "Lista de oferte" : p === "catalog" ? "Prețurile tale" : p === "firma" ? "Datele firmei" : p === "hist" ? "Reperele din ofertele tale" : null; },
  restore: (p, d) => {
    if (p.indexOf("p/") === 0) { const id = p.slice(2); DOCS[p] = normSt(clone(d)); let ch = false; if (IDX.del && IDX.del[id]) { delete IDX.del[id]; ch = true; }   // nu mai e „ștearsă”: altfel celălalt aparat ar șterge-o din nou
      if (!entry(id)) { IDX.list.unshift({ id, nume: nameOf(DOCS[p]), upd: todayIso() }); ch = true; } if (ch) store.put("index", () => IDX, 0); if (id === CUR) st = DOCS[p]; store.put(p, () => DOCS[p], 0); }
    else { onRemote(p, clone(d)); store.put(p, () => p === "index" ? IDX : p === "catalog" ? { items: catalog } : p === "firma" ? FIRMA : OF.HIST, 0); }
    render(); toast("Am pus înapoi copia."); } });

/* ---------- schimbări venite de pe celălalt aparat ---------- */
/* Două aparate care fac câte o ofertă în aceeași clipă primesc același număr. Când se văd una pe alta, cea făcută a doua (dacă numărul e pus de aplicație și oferta e încă în lucru) ia numărul următor. */
function dedupeNr() {
  const by = {}; Object.keys(DOCS).forEach(p => { if (p.indexOf("p/") !== 0) return; const nr = String(((DOCS[p] || {}).proj || {}).nrOferta || "").trim(); if (/^\d{4}\/\d+$/.test(nr)) (by[nr] = by[nr] || []).push(p); });
  let ch = null; Object.keys(by).forEach(nr => { const xs = by[nr].sort(); if (xs.length < 2) return; xs.slice(1).forEach(p => { const pr = DOCS[p].proj; if (!pr.nrAuto || (pr.stare && pr.stare !== "lucru")) return; pr.nrOferta = ""; pr.nrOferta = nextNr(); store.put(p, () => DOCS[p], 0); if (p === "p/" + CUR) ch = pr.nrOferta; }); });
  return ch;
}
function onRemote(path, data) {
  if (path === "index" && data && Array.isArray(data.list)) { IDX = data; const gone = Object.keys(IDX.del || {}).filter(id => DOCS["p/" + id]);
    gone.forEach(id => { delete DOCS["p/" + id]; store.remove("p/" + id).catch(() => { }); });   // ce era de trimis pentru o ofertă ștearsă se aruncă (altfel ar bloca salvarea celorlalte)
    if (CUR && IDX.del && IDX.del[CUR]) { CUR = ""; st = null; closeOvl(); go("#/"); toast("Oferta a fost ștearsă de pe celălalt aparat."); return; } }
  else if (path === "firma") FIRMA = data || {};
  else if (path === "hist") OF.HIST = data || {};
  else if (path === "ref" || path === "ref2") { DOCS[path] = data; REF = ((DOCS.ref && DOCS.ref.items) || []).concat(ref2Items()); TAR = null; PX = null; }
  else if (path === "catalog" && data && data.items) { catalog = data.items; nextCatId = Math.max(1, ...catalog.map(c => c.id || 0)) + 1; rebuildCat(); }
  else if (path.indexOf("p/") === 0) { if (IDX.del && IDX.del[path.slice(2)]) { delete DOCS[path]; store.remove(path).catch(() => { }); return; } DOCS[path] = normSt(data); if (path === "p/" + CUR) st = DOCS[path]; const nn = dedupeNr(); if (nn) toast("Oferta a primit numărul " + nn + ": celălalt aparat luase același număr în aceeași clipă."); }
  else DOCS[path] = data;
  if (booted && !isOpen() && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) render();
}

/* ---------- pornire ---------- */
window.__of = { check: () => checkOffer(), prod: () => prodRows(), prodOpen: i => ACT.pprod({ dataset: { k: i } }), nom: () => nomRows(), nomOpen: i => ACT.pnom({ dataset: { k: i } }), tarif, autoMatch, offered, effPrices, get st() { return st; }, get docs() { return DOCS; }, get idx() { return IDX; }, get cat() { return catalog; }, get firma() { return FIRMA; }, totals, rowInfo, searchPrices, scaleTo, checks, num, fmt, ref2n: () => ref2Pts().length };
(async function () {
  const fail = m => { $("#app").innerHTML = '<main><div class="emp">' + m + '<br><br><button class="sec" onclick="location.reload()">Încearcă din nou</button></div></main>'; };
  try {
    ME = await SCV.gate({ name: "Ofertare SCV", sub: "Oferte de manoperă · doar pentru proprietar" });
    store = SCV.store("oferta", { cache: "pend", pullFirst: true, delay: 1200, warnUnload: true, onStatus: setSaved, onRemote, onAuthLost: () => { SCV.gate({ name: "Ofertare SCV", sub: "Sesiunea a expirat – intră din nou. Ce ai scris rămâne pe ecran și se salvează după intrare." }).then(u => { ME = u; store.resume(); }); } });
    let r = await store.load();
    if (!Object.keys(r.docs).length) { const n = await SCV.claimSeed(); if (n) r = await store.load(); }
    DOCS = r.docs;
    BASE_CAT = (DOCS.catalog0 && DOCS.catalog0.items) || [];
    catalog = (DOCS.catalog && DOCS.catalog.items) ? DOCS.catalog.items : BASE_CAT.map(x => Object.assign({}, x));
    nextCatId = Math.max(1, ...catalog.map(c => c.id || 0)) + 1;
    FIRMA = DOCS.firma || {}; OF.HIST = DOCS.hist || {}; REF = ((DOCS.ref && DOCS.ref.items) || []).concat(ref2Items());
    IDX = DOCS.index && Array.isArray(DOCS.index.list) ? DOCS.index : { list: [] };
    Object.keys(DOCS).forEach(p => { if (p.indexOf("p/") === 0) DOCS[p] = normSt(DOCS[p]); });
    Object.keys(DOCS).forEach(p => { if (p.indexOf("p/") !== 0 || entry(p.slice(2))) return; if (IDX.del && IDX.del[p.slice(2)]) { delete DOCS[p]; store.remove(p).catch(() => { }); } else IDX.list.push({ id: p.slice(2), nume: nameOf(DOCS[p]), upd: "" }); });   // ce a fost șters (și n-a apucat să dispară de pe server) se șterge acum, nu se întoarce
    rebuildCat(); booted = true; store.start(); setSaved(""); route();
    fetch("nomen.json", { cache: "no-cache" }).then(x => x.ok ? x.json() : null).then(j => { NOMEN = j; NX = null; if (VIEW.name === "prices" && !isOpen()) render(); }).catch(() => { });
    const piata = fetch("piata.json", { cache: "no-cache" }).then(x => x.ok ? x.json() : null).then(j => { PIATA = j; TAR = null; PX = null; if (VIEW.name === "prices" && !isOpen()) render(); }).catch(() => { });
    Promise.race([piata, new Promise(r => setTimeout(r, 4000))]).then(rematchAll); piata.then(() => { if (PIATA) rematchAll(); });
  } catch (e) { const m = String((e && e.message) || e); fail(/failed to fetch|networkerror|load failed|fără internet/i.test(m) ? "Nu am internet acum. Aplicația are nevoie de internet ca să pornească; ce ai scris și n-a apucat să se salveze e păstrat pe acest aparat și se trimite la următoarea pornire." : "Nu pot încărca datele: " + esc(m)); }
})();
})();

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
const fileSafe = s => String(s || "").replace(/[\\/:*?"<>|]/g, "").trim();

/* ---------- starea aplicației ---------- */
let store = null, ME = null, booted = false, DOCS = {}, IDX = { list: [] }, FIRMA = {}, PIATA = null;
let catalog = [], BASE_CAT = [], pcat = [], REF = [], pref = [], nextCatId = 1, catDirty = false, PX = null;
let CUR = "", st = null;                 // oferta deschisă (același obiect ca DOCS["p/"+CUR])
let VIEW = { name: "list" }, SAVED = "", SAVEDW = false, AFTER = null;
const DEF_NU = ["TVA", "legături electrice"].join("\n");
const UMS = ["buc", "ml", "mp", "kg", "set", "punct", "baie", "ore", "mc"];
const STARI = { lucru: "în lucru", trimisa: "trimisă", castigata: "câștigată", pierduta: "pierdută" };
const FF = [["firma", "Denumirea firmei"], ["firmaCif", "CIF și nr. registrul comerțului"], ["firmaAdresa", "Adresă"], ["firmaContact", "Telefon și email"], ["semnatar", "Semnează ofertele (nume)"], ["iban", "IBAN (opțional, apare în antet)"]];
const CF = [["tva", "TVA (%)", "n"], ["avans", "Avans la semnare (%)", "n"], ["garantie", "Garanție (luni)", "n"], ["valab", "Oferta e valabilă (zile)", "n"], ["termen", "Termen de execuție", "t"], ["materialeDe", "Materialele sunt asigurate de", "t"], ["normative", "Normative", "t"]];
const DEFC = { tva: 21, avans: 30, garantie: 24, valab: 30, termen: "conform contractului", materialeDe: "sunt asigurate de beneficiar", normative: "I9, I13, GP 043, NP 059", nuInclude: DEF_NU, includeTxt: "" };
const defc = k => (FIRMA.def && FIRMA.def[k] != null) ? FIRMA.def[k] : DEFC[k];

/* ---------- oferta: forma datelor ---------- */
function nextNr() {
  const y = String(new Date().getFullYear()); let mx = 0, w = 4;
  Object.keys(DOCS).forEach(p => { if (p.indexOf("p/") !== 0) return; const m = /^(\d{4})\/(\d+)$/.exec(String((DOCS[p].proj || {}).nrOferta || "").trim()); if (m && m[1] === y) { mx = Math.max(mx, +m[2]); w = Math.max(w, m[2].length); } });
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
  s.files = s.files || [];
  syncRows(s); s.v = 3; return s;
}
/* fiecare poziție stă într-un capitol care apare ca rând în ofertă */
function syncRows(s) {
  const caps = new Set(s.rows.filter(r => r.k === "c").map(r => r.cap)); let id = Math.max(0, ...s.rows.map(r => r.id || 0));
  for (const it of s.items) { const k = it.cap || (it.cap = "Fără capitol"); if (!caps.has(k)) { caps.add(k); s.rows.push({ id: ++id, k: "c", cap: k, den: k, ov: 0 }); } }
}
const rndTo = (v, s) => s ? Math.round(v / s) * s : r2(v);
function rowInfo(r, s) {
  s = s || st;
  if (r.k === "c") { let tot = 0, n = 0, np = 0; for (const i of s.items) if (i.cap === r.cap) { n++; if (i.pret > 0) np++; tot += OF.total(i, s.adaos); } tot = r2(tot); return { n, np, tot, val: r.ov > 0 ? r.ov : rndTo(tot, s.rnd) }; }
  return { val: r2((+r.cant || 0) * (+r.pret || 0)) };
}
function totals(s) { s = s || st; const sub = r2(s.rows.reduce((a, r) => a + rowInfo(r, s).val, 0)), tva = r2(sub * (+s.proj.tva || 0) / 100), tot = r2(sub + tva); return { sub, tva, tot, avans: r2(tot * (+s.proj.avans || 0) / 100) }; }
const nameOf = (s, e) => (s.proj.santier || "").trim() || (e && e.nume && !/^Proiect (nou|fără nume)$/.test(e.nume) ? e.nume : "") || "Ofertă fără nume";
const entry = id => IDX.list.find(x => x.id === id);
const newId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const nextRow = () => Math.max(0, ...st.rows.map(r => r.id || 0)) + 1;
const nextItem = () => Math.max(0, ...st.items.map(i => i.id || 0)) + 1;
const projX = () => { const p = Object.assign({}, st.proj); for (const [k] of FF) if (!p[k] && FIRMA[k]) p[k] = FIRMA[k]; return p; };

/* ---------- salvare ---------- */
function setSaved(t, w) { SAVED = t; SAVEDW = !!w; const e = $("#saved"); if (e) { e.textContent = t; e.classList.toggle("bad", SAVEDW); } }
function save() {
  if (!booted || !CUR) return; const id = CUR;
  store.put("p/" + id, () => DOCS["p/" + id]);
  const e = entry(id), nm = nameOf(st, e), d = todayIso();
  if (e && (e.nume !== nm || e.upd !== d)) { e.nume = nm; e.upd = d; store.put("index", () => IDX); }
  saveCat();
}
function saveCat() { if (catDirty) { catDirty = false; store.put("catalog", () => ({ items: catalog })); } }
function saveFirma() { store.put("firma", () => FIRMA); }
function createOffer(proj, state) {
  const id = newId(), s = normSt(state || { rows: [], items: [] });
  Object.assign(s.proj, proj || {}); if (!s.proj.nrOferta) s.proj.nrOferta = nextNr();
  DOCS["p/" + id] = s; IDX.list.unshift({ id, nume: nameOf(s), upd: todayIso() });
  store.put("p/" + id, () => DOCS["p/" + id], 0); store.put("index", () => IDX, 0); return id;
}
function openOffer(id) {
  CUR = id; st = DOCS["p/" + id]; SCV.LS.set("scv-oferta-cur", id);
  if (st.items.length && st.mv !== OF.MV) { autoMatch(); save(); }
}

/* ---------- prețuri: catalog, potrivire, învățare ---------- */
function rebuildCat() { pcat = OF.prepCatalog(catalog); PX = null; }
const catById = id => pcat.find(c => c.id === id);
/* Pune singură prețul unde lucrarea și dimensiunea sunt sigure; în rest lasă o sugestie cu motivul. Ce ai pus sau verificat tu nu se atinge. */
function autoMatch(only, S) {
  S = S || st; let a = 0, s = 0, v = 0;
  for (const it of (only || S.items)) {
    if (it.pret > 0 && (it.src === "manual" || it.src === "file" || it.src === "ref" || it.conf || it.ap)) continue;
    if (it.pret > 0 && it.src === "cat") { it.pret = 0; it.src = ""; it.catId = null; }
    const m = OF.matchItem(it, pcat); it.sug = null; it.sugW = ""; it.sugR = null;
    if ((!m || !m.sure) && pref.length) { const m2 = OF.matchItem(it, pref); if (m2) { const r = REF[+String(m2.id).slice(1)]; if (r && !(m && catById(m.id) && +catById(m.id).pret === +r.p)) { it.sugR = { p: r.p, d: r.d, pr: r.pr, an: r.an, w: m2.why }; v++; } } }
    if (!m) continue;
    if (m.sure) { const c = catById(m.id); it.pret = c.pret; it.src = "cat"; it.catId = c.id; it.conf = !!m.exact; it.sugW = m.why; a++; } else { it.sug = m.id; it.sugW = m.why; s++; }
  }
  S.items.forEach(it => { if (it.pret > 0 && !it.src) it.src = "file"; }); S.mv = OF.MV;
  return { a, s, v };
}
/* prețul pus de tine rămâne ținut minte pentru denumirea asta (și, prin familie, pentru cele scrise altfel) */
function learn(it) {
  if (!(it.pret > 0) || !String(it.den || "").trim()) return;
  const k = OF.keyOf(it.den), f = OF.umFamily(it.um); let c = catalog.find(x => x.learned && OF.keyOf(x.den) === k && OF.umFamily(x.um) === f);
  const h = { p: +it.pret, d: todayIso(), o: st ? nameOf(st, entry(CUR)) : "" };
  if (c) { if (+c.pret !== +it.pret || !(c.h || []).length) c.h = [h].concat((c.h || []).filter(x => !(x.d === h.d && x.o === h.o))).slice(0, 6); c.pret = +it.pret; }
  else catalog.push({ id: nextCatId++, dom: "ÎNVĂȚAT", sec: "", den: it.den, desc: "", um: it.um, pret: +it.pret, learned: true, h: [h] });
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
function closeOvl() { ovl().innerHTML = ""; document.body.style.overflow = ""; }
function sheet(html) { if (!UNDO) { const tq = $("#toast"); if (tq) tq.classList.remove("on"); } ovl().innerHTML = '<button class="scrim" data-a="x" aria-label="Închide"></button><div class="sheet" role="dialog" aria-modal="true">' + html + "</div>"; document.body.style.overflow = "hidden"; const f = $(".sheet [autofocus]"); if (f) setTimeout(() => { f.focus(); if (f.select) f.select(); }, 60); return $(".sheet"); }
function full(html) { ovl().innerHTML = '<div class="full" role="dialog" aria-modal="true"><div class="in">' + html + "</div></div>"; document.body.style.overflow = "hidden"; const f = $(".full [autofocus]"); if (f) setTimeout(() => f.focus(), 60); return $(".full"); }
const h3 = t => `<h3>${t}<button data-a="x" aria-label="Închide">${ic("x", 22, 2.2)}</button></h3>`;
let toastT = null, UNDO = null;
function toast(t, undo) {
  const e = $("#toast"); UNDO = undo || null;
  e.innerHTML = "<span>" + esc(t) + "</span>" + (undo ? '<button data-a="undo">Anulează</button>' : ""); e.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => { e.classList.remove("on"); UNDO = null; }, undo ? 7000 : 2600);
}
/* schimbare care se poate anula din mesajul de jos */
function undoable(msg, fn) {
  const id = CUR, snap = JSON.stringify(st), cat = JSON.stringify(catalog); fn(); save(); render();
  toast(msg, () => { DOCS["p/" + id] = normSt(JSON.parse(snap)); if (CUR === id) st = DOCS["p/" + id]; catalog = JSON.parse(cat); catDirty = true; rebuildCat(); save(); render(); });
}
const sw = (id, label, on) => `<button class="sw${on ? " on" : ""}" data-a="sw" id="${id}" role="switch" aria-checked="${on ? "true" : "false"}"><span>${label}</span><i></i></button>`;
const isOn = id => { const e = $("#" + id); return !!e && e.classList.contains("on"); };
const fld = (id, label, val, o) => { o = o || {}; return `<label class="lb" for="${id}">${label}</label>` + (o.area ? `<textarea class="inp" id="${id}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ""}>${esc(val)}</textarea>` : `<input class="inp" id="${id}" value="${esc(val)}" ${o.n ? 'inputmode="decimal"' : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} ${o.af ? "autofocus" : ""} autocomplete="off">`); };
const val = id => { const e = $("#" + id); return e ? e.value.trim() : ""; };

/* ---------- drumul prin aplicație (adresa din bară) ---------- */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  if (h[0] === "o" && h[1]) { if (h[2] === "c" && h[3]) return { name: "pos", id: h[1], row: +h[3] }; if (h[2] === "fara") return { name: "pos", id: h[1], row: 0, f: "no" }; return { name: "offer", id: h[1] }; }
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
function listData() { const all = IDX.list.map(e => ({ e, s: DOCS["p/" + e.id] })).filter(x => x.s), c = { all: 0, lucru: 0, gata: 0, arh: 0 }; all.forEach(x => { if (x.e.arh) c.arh++; else { c.all++; (x.s.proj.stare || "lucru") === "lucru" ? c.lucru++ : c.gata++; } }); return { all, c }; }
function listRows() {
  const { all } = listData(), f = VIEW.f || "all", q = OF.strip(VIEW.q || "");
  const xs = all.filter(x => f === "arh" ? x.e.arh : !x.e.arh && (f === "all" || (f === "lucru") === ((x.s.proj.stare || "lucru") === "lucru")))
    .filter(x => !q || OF.strip(nameOf(x.s, x.e) + " " + (x.s.proj.beneficiar || "") + " " + (x.s.proj.nrOferta || "")).includes(q))
    .sort((a, b) => String(b.e.upd || "").localeCompare(String(a.e.upd || "")));
  if (!xs.length) return `<div class="emp">${q || f !== "all" ? "Nicio ofertă aici." : "<b>Nu ai nicio ofertă încă.</b>Apasă „Ofertă nouă” și fă prima."}</div>`;
  return '<div class="ofl">' + xs.map(x => {
    const s = x.s, p = s.proj, t = totals(s), n = s.items.length, np = n ? s.items.filter(i => i.pret > 0).length : 0, sr = p.stare || "lucru";
    const tag = n && np < n ? `<span class="w">${np} din ${n} cu preț</span>` : `<span class="${sr === "castigata" ? "p" : sr === "pierduta" ? "n" : ""}">${STARI[sr] || STARI.lucru}</span>`;
    return `<button class="of" data-a="open" data-id="${x.e.id}"><div class="tx"><b>${esc(nameOf(s, x.e))}</b><span>${esc([p.beneficiar, p.data].filter(Boolean).join(" · ") || "fără beneficiar")}</span></div><div class="am"><b>${fmt(t.sub)} lei</b>${tag}</div></button>`;
  }).join("") + "</div>";
}
function vList() {
  const { c } = listData(), f = VIEW.f || "all", ch = (k, t, n) => `<button data-a="lf" data-f="${k}" class="${f === k ? "on" : ""}">${t} · ${n}</button>`;
  return `<div class="top"><div class="tt"><h1>Ofertele mele</h1></div>${stPill}</div><main>
<button class="pri" data-a="new" id="bNew">${ic("plus", 22, 2.6)}Ofertă nouă</button>
<div class="srch" style="margin-top:14px">${ic("search", 20, 2.2)}<input id="lq" data-i="lq" placeholder="Caută o ofertă" value="${esc(VIEW.q || "")}" autocomplete="off"></div>
<div class="fl">${ch("all", "Toate", c.all)}${ch("lucru", "În lucru", c.lucru)}${ch("gata", "Trimise", c.gata)}${c.arh ? ch("arh", "Arhivă", c.arh) : ""}</div>
<div id="lst">${listRows()}</div></main>`;
}

/* ---------- oferta: foaia ---------- */
function rowHtml(r, i) {
  const x = rowInfo(r), nr = (i + 1) * 10;
  if (r.k === "c") {
    const pct = x.n ? Math.round(100 * x.np / x.n) : 0;
    return `<button class="tr" data-a="cap" data-id="${r.id}"><i>${nr}</i><div><b>${esc(r.den)}</b><span>${x.n ? `${x.np} din ${x.n} poziții au preț` : "nicio poziție"}${r.ov > 0 ? " · sumă pusă de tine" : ""}</span>${x.n ? `<div class="mb"><u style="width:${pct}%"></u></div>` : ""}</div>${x.val > 0 ? `<strong>${fmt(x.val)}${ic("chevron-right", 15, 2.4)}</strong>` : `<strong class="n">fără preț${ic("chevron-right", 15, 2.4)}</strong>`}</button>`;
  }
  return `<button class="tr" data-a="row" data-id="${r.id}"><i>${nr}</i><div><b>${esc(r.den)}</b><span>${fq(r.cant)} ${esc(r.um)} × ${fmt(r.pret)} lei</span></div>${x.val > 0 ? `<em>${fmt(x.val)}</em>` : `<em class="z">pune preț</em>`}</button>`;
}
function vOffer() {
  const p = st.proj, e = entry(CUR), t = totals(), fara = st.items.filter(i => !(i.pret > 0)).length, ch = ic("chevron-right", 15, 2.4);
  const nu = String(p.nuInclude || "").split("\n").map(x => x.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean), inc = String(p.includeTxt || "").split("\n").map(x => x.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);
  return `<div class="top"><button class="ibn" data-a="back" data-h="#/" aria-label="Înapoi la oferte">${ic("chevron-left", 22, 2.4)}</button><div class="tt"><b>${esc(nameOf(st, e))}</b><small>${esc(p.beneficiar || "fără beneficiar")} · ${fmt(t.sub)} lei${e && e.arh ? " · în arhivă" : ""}</small></div>${stPill}<button class="ibn" data-a="menu" aria-label="Mai multe">${ic("ellipsis", 20, 2.2)}</button></div><main>
<div class="paper" id="paper">
<button class="band" data-a="hnr"><div><b>OFERTĂ DE PREȚ</b><span>manoperă instalații · ${STARI[p.stare] || STARI.lucru}</span></div><div><b>Nr. ${esc(p.nrOferta || "—")}</b><span>${esc(p.data || "")} · valabilă ${fq(p.valab)} zile</span></div></button>
<button class="fr" data-a="hben"><span>Beneficiar</span><b class="${p.beneficiar ? "" : "ph"}"><i>${esc(p.beneficiar || "apasă și scrie")}</i>${ch}</b></button>
<button class="fr" data-a="hluc"><span>Lucrarea</span><b class="${p.santier ? "" : "ph"}"><i>${esc(p.santier || "apasă și scrie")}</i>${ch}</b></button>
<div class="th"><span>Nr.</span><span>Denumire</span><span>Valoare fără TVA</span></div>
${st.rows.length ? st.rows.map(rowHtml).join("") : '<div class="hint">Oferta e goală. Apasă „Rând nou” și scrie prima lucrare, sau adu o listă.</div>'}
<div class="add"><button data-a="row" data-id="0" id="bRow">${ic("plus", 16, 2.6)}Rând nou</button><button data-a="imp" id="bImp">${ic("file-spreadsheet", 16, 2.2)}Adu o listă</button></div>
${fara ? `<button class="wrn" data-a="go" data-h="#/o/${CUR}/fara">${ic("triangle-alert", 16, 2.2)}${plural(fara, "o poziție nu are", "poziții nu au")} încă preț<span>arată-le</span></button>` : ""}
<div class="tl"><span>${fara ? "Subtotal până acum" : "Subtotal manoperă"} (fără TVA)</span><b id="tSub">${fmt(t.sub)}</b></div>
<div class="tl"><span>TVA ${fq(p.tva)}%</span><b>${fmt(t.tva)}</b></div>
<div class="tl T"><span>TOTAL CU TVA</span><span id="tTot">${fmt(t.tot)} lei</span></div>
<button class="gr" data-a="cond"><b>Avans ${fq(p.avans)}%</b> la semnare: ${fmt(t.avans)} lei · <b>Garanție</b> ${fq(p.garantie)} luni · <b>Termen:</b> ${esc(p.termen || "—")}</button>
${inc.length ? `<button class="am2 inc" data-a="inc"><b>Include:</b> ${esc(inc.join(", "))}</button>` : ""}
<button class="am2" data-a="inc"><b>Nu include:</b> ${esc(nu.join(", ") || "apasă și scrie")}</button>
</div></main>
<div class="bar"><button class="pri" data-a="xl" id="bXl">${ic("file-spreadsheet", 20, 2.2)}Descarcă Excel</button></div>`;
}

/* ---------- pozițiile unui capitol (lista lungă) ---------- */
const stOf = it => it.pret > 0 ? (it.conf ? "ok" : "ver") : ((it.sug != null && catById(it.sug)) || it.sugR ? "sg" : "no");
const SRC = { cat: "din catalog", file: "din fișier", ref: "din ofertă veche", manual: "pus de mână" };
function posAll() { const r = VIEW.row ? st.rows.find(x => x.id === VIEW.row) : null; return { r, xs: r ? st.items.filter(i => i.cap === r.cap) : st.items }; }
function posShown() { const f = VIEW.f || "all", q = OF.strip(VIEW.q || ""); return posAll().xs.filter(it => (f === "all" || (f === "no" ? !(it.pret > 0) : stOf(it) === f)) && (!q || OF.strip(it.den + " " + (it.cod || "")).includes(q))); }
function posCard(it, cap) {
  const s = stOf(it), c = it.sug != null ? catById(it.sug) : null, cc = s === "ver" && it.src === "cat" && it.catId != null ? catById(it.catId) : null, pb = PROB[it.id];
  return `<div class="pos" data-id="${it.id}"><div class="d" data-a="pexp">${esc(it.den)}</div><div class="m">${fq(it.cant)} ${esc(it.um)}${it.cod ? " · " + esc(it.cod) : ""}${cap ? " · " + esc(it.cap) : ""}</div>
<div class="pr"><button class="p${it.pret > 0 ? "" : " z"}" data-a="pp" data-id="${it.id}">${it.pret > 0 ? fmt(it.pret) + " lei/" + esc(it.um) : "pune preț"}</button>${s === "ok" ? `<span class="tag ok">${ic("check", 14, 2.8)}verificat</span>` : s === "ver" ? `<span class="tag wr">de verificat</span>` : ""}<div class="t">${it.pret > 0 ? fmt(OF.total(it, st.adaos)) + " lei" : ""}</div></div>
${pb ? `<div class="nt">${ic("triangle-alert", 14, 2.2)} ${esc(pb)}</div>` : ""}
${s === "ver" ? `<div class="sgs">${SRC[it.src] || "preț"}${cc ? ": <b>" + esc(OF.entryLabel(cc)) + "</b>" : ""}${it.sugW ? "<br>" + esc(it.sugW) : ""}<br><button data-a="pok" data-id="${it.id}">E bun</button></div>` : ""}
${!(it.pret > 0) && c ? `<div class="sgs">Sugestie din prețurile tale: <b>${esc(OF.entryLabel(c))} – ${fmt(c.pret)} lei</b>${it.sugW ? "<br>" + esc(it.sugW) : ""}<br><button data-a="sug" data-id="${it.id}">Pune ${fmt(c.pret)} lei</button></div>` : ""}
${!(it.pret > 0) && it.sugR ? `<div class="sgs">Din oferta ta veche${it.sugR.pr ? " (" + esc(it.sugR.pr) + (it.sugR.an ? ", " + esc(it.sugR.an) : "") + ")" : ""}: <b>${esc(it.sugR.d)} – ${fmt(it.sugR.p)} lei</b>${it.sugR.w ? "<br>" + esc(it.sugR.w) : ""}<br><button data-a="sugr" data-id="${it.id}">Pune ${fmt(it.sugR.p)} lei</button></div>` : ""}</div>`;
}
function posList() {
  const xs = posShown(), lim = VIEW.lim || 40, f = VIEW.f || "all";
  let h = "";
  if (f === "sg" && xs.length) h += `<button class="sec" data-a="sgall" style="margin-bottom:12px">${ic("check-check", 18, 2.2)}Pune toate cele ${xs.length} sugestii</button>`;
  if (f === "ver" && xs.length) h += `<button class="sec" data-a="okall" style="margin-bottom:12px">${ic("check-check", 18, 2.2)}Sunt bune toate (${xs.length})</button>`;
  if (!xs.length) return h + '<div class="emp">Nimic aici.</div>';
  return h + xs.slice(0, lim).map(it => posCard(it, !VIEW.row)).join("") + (xs.length > lim ? `<button class="more" data-a="pmore">Arată încă ${Math.min(40, xs.length - lim)} (din ${xs.length})</button>` : "");
}
function vPos() {
  const { r, xs } = posAll(), f = VIEW.f || "all", cn = { all: xs.length, no: 0, sg: 0, ver: 0, pb: 0 };
  checks(); xs.forEach(it => { const s = stOf(it); if (!(it.pret > 0)) cn.no++; if (s === "sg") cn.sg++; if (s === "ver") cn.ver++; });
  const x = r ? rowInfo(r) : { val: r2(xs.reduce((a, i) => a + OF.total(i, st.adaos), 0)), n: xs.length, np: xs.length - cn.no };
  const ch = (k, t) => `<button data-a="pf" data-f="${k}" class="${f === k ? "on" : ""}">${t} · ${cn[k]}</button>`;
  return `<div class="top"><button class="ibn" data-a="back" data-h="#/o/${CUR}" aria-label="Înapoi la ofertă">${ic("chevron-left", 22, 2.4)}</button><div class="tt"><b>${esc(r ? r.den : "Toate pozițiile")}</b><small>${esc(nameOf(st, entry(CUR)))}</small></div>${stPill}${r ? `<button class="ibn" data-a="cmenu" aria-label="Capitolul">${ic("ellipsis", 20, 2.2)}</button>` : ""}</div><main>
<div class="sum"><div><small>${r ? "Capitolul" : "Toate capitolele"}, fără TVA</small><b>${fmt(x.val)}<span>lei</span></b></div><em>${x.np} din ${x.n}<br>au preț${r && r.ov > 0 ? "<br>sumă pusă de tine" : ""}</em></div>
<div class="srch">${ic("search", 20, 2.2)}<input id="pq" data-i="pq" placeholder="Caută în poziții" value="${esc(VIEW.q || "")}" autocomplete="off"></div>
<div class="fl">${ch("all", "Toate")}${ch("no", "Fără preț")}${ch("sg", "Cu sugestie")}${ch("ver", "De verificat")}</div>
<div id="plist">${posList()}</div></main>`;
}

/* ---------- prețurile mele ---------- */
function priceRows() {
  const q = (VIEW.q || "").trim(), f = VIEW.f || (catalog.some(c => c.learned) ? "m" : "c"), lim = VIEW.lim || 50;
  let xs;
  if (q.length > 1) xs = searchPrices(q, 80).map(e => ({ e })).concat(piataFind(q).map(p => ({ p })));
  else if (f === "p") xs = ((PIATA && PIATA.lista) || []).map(p => ({ p }));
  else xs = priceIndex().filter(e => e.t === f).map(e => ({ e }));
  if (!xs.length) return `<div class="emp">${q.length > 1 ? "Nu am găsit nimic pentru „" + esc(q) + "”." : f === "m" ? "<b>Aici se adună prețurile pe care le pui tu.</b>De fiecare dată când scrii un preț într-o ofertă, îl țin minte." : "Nimic aici."}</div>`;
  return '<div class="prl">' + xs.slice(0, lim).map(x => x.p
    ? `<button data-a="ppia" data-k="${PIATA.lista.indexOf(x.p)}"><p>${esc(x.p.lucrare)}<small>reper de piață · ${esc(x.p.cat || "")}</small></p><b>${fmt(x.p.min)}–${fmt(x.p.max)}<small>${esc(x.p.um || "")}</small></b></button>`
    : `<button data-a="${x.e.t === "r" ? "pref" : "pcat"}" data-k="${x.e.t === "r" ? x.e.ri : x.e.id}"><p>${esc(x.e.den)}<small>${esc(x.e.sub)}</small></p><b>${fmt(x.e.p)} lei<small>/ ${esc(x.e.um)}</small></b></button>`).join("") + "</div>" + (xs.length > lim ? `<button class="more" data-a="prmore">Arată mai multe (din ${xs.length})</button>` : "");
}
function piataFind(q) { const ws = OF.strip(q).split(" ").filter(w => w.length > 1); return ((PIATA && PIATA.lista) || []).filter(p => { const s = OF.strip(p.lucrare + " " + (p.cat || "")); return ws.every(w => s.includes(w)); }).slice(0, 20); }
function vPrices() {
  const n = { m: catalog.filter(c => c.learned).length, c: catalog.filter(c => !c.learned).length, r: REF.length, p: ((PIATA && PIATA.lista) || []).length }, f = VIEW.f || (n.m ? "m" : "c");
  const ch = (k, t) => `<button data-a="prf" data-f="${k}" class="${f === k ? "on" : ""}">${t} · ${n[k]}</button>`;
  return `<div class="top"><div class="tt"><h1>Prețurile mele</h1></div>${stPill}</div><main>
<button class="pri" data-a="pnew" id="bPnew">${ic("plus", 22, 2.6)}Preț nou</button>
<div class="srch" style="margin-top:14px">${ic("search", 20, 2.2)}<input id="prq" data-i="prq" placeholder="Caută: calorifer, țeavă PPR 25, hidrant…" value="${esc(VIEW.q || "")}" autocomplete="off"></div>
<div class="fl">${ch("m", "Puse de mine")}${ch("c", "Catalogul meu")}${ch("r", "Din oferte vechi")}${ch("p", "Piață")}</div>
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
document.addEventListener("keydown", e => { if (e.key === "Escape" && isOpen()) closeOvl(); if (e.key === "Enter" && e.target.tagName === "INPUT" && isOpen()) { const b = $("#ovl [data-ok]"); if (b) { e.preventDefault(); b.click(); } } });
window.addEventListener("hashchange", route);
ACT.x = () => closeOvl();
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
  if (k === "nr") { p.nrOferta = val("hNr"); p.data = val("hDat") || p.data; p.valab = num(val("hVal")) || p.valab; }
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
${r ? `<div class="minis"><button data-a="rmv" data-d="-1">${ic("arrow-up", 16, 2.2)}Mai sus</button><button data-a="rmv" data-d="1">${ic("arrow-down", 16, 2.2)}Mai jos</button><button class="r" data-a="rdel">${ic("trash-2", 16, 2.2)}Șterge</button></div>` : ""}
<div class="bar"><button class="pri" data-a="rsave" data-ok="1">${r ? "Gata" : "Pune în ofertă"}</button></div>`);
  rVal(); if (r) rSug();
}
const rVal = () => { $("#rVal").textContent = fmt(r2(num($("#rCant").value) * num($("#rPret").value))) + " lei"; };
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
  const o = { den, um: $("#rUm").value || "buc", cant: num(val("rCant")) || 1, pret: num(val("rPret")) }, keep = isOn("rKeep"), id = RE.id;
  if (id) Object.assign(st.rows.find(x => x.id === id), o); else st.rows.push(Object.assign({ id: nextRow(), k: "r" }, o));
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
function applySug(it, ref) { if (ref) { it.pret = +it.sugR.p; it.src = "ref"; } else { const c = catById(it.sug); if (!c) return; it.pret = +c.pret; it.src = "cat"; it.catId = c.id; } it.ap = 1; it.conf = false; it.sug = null; it.sugR = null; }
ACT.sug = el => { applySug(itemOf(el.dataset.id), false); save(); rePos(); };
ACT.sugr = el => { applySug(itemOf(el.dataset.id), true); save(); rePos(); };
ACT.pok = el => { itemOf(el.dataset.id).conf = true; save(); rePos(); };
ACT.sgall = () => { const xs = posShown(); undoable(plural(xs.length, "o sugestie pusă", "sugestii puse") + ". Verifică-le.", () => xs.forEach(it => applySug(it, !(it.sug != null && catById(it.sug))))); };
ACT.okall = () => { const xs = posShown(); undoable("Le-am trecut ca verificate.", () => xs.forEach(it => { it.conf = true; })); };
let PP = null;
ACT.pp = el => {
  const it = itemOf(el.dataset.id), k = OF.keyOf(it.den), f = OF.umFamily(it.um), same = st.items.filter(o => o !== it && OF.keyOf(o.den) === k && OF.umFamily(o.um) === f && !(o.src === "manual" && o.pret > 0)).length;
  PP = { id: it.id, same }; const caps = st.rows.filter(r => r.k === "c");
  sheet(h3("Preț") + `<p class="s">${esc(it.den.length > 140 ? it.den.slice(0, 140) + "…" : it.den)}</p><div class="r3"><div>` + fld("ppP", "Preț (lei / " + esc(it.um) + ")", edn(it.pret), { n: 1, af: 1 }) + "</div><div>" + fld("ppQ", "Cantitate", edn(it.cant), { n: 1 }) + "</div></div>" +
    (same ? sw("ppSame", "La fel la celelalte " + same + " cu aceeași denumire", true) : "") + sw("ppKeep", "Ține minte prețul pentru data viitoare", true) +
    `<label class="lb" for="ppCap">Capitol</label><select class="inp" id="ppCap">${caps.map(r => `<option value="${esc(r.cap)}" ${r.cap === it.cap ? "selected" : ""}>${esc(r.den)}</option>`).join("")}</select>
<div class="minis"><button class="r" data-a="ppdel">${ic("trash-2", 16, 2.2)}Șterge poziția</button></div><button class="pri" data-a="ppsave" data-ok="1">Gata</button>`);
};
ACT.ppsave = () => {
  const it = itemOf(PP.id), p = num(val("ppP")), q = num(val("ppQ")), k = OF.keyOf(it.den), f = OF.umFamily(it.um);
  if (q > 0) it.cant = q; it.cap = $("#ppCap").value || it.cap;
  if (p !== +it.pret || (p > 0 && !it.conf)) { it.pret = p; it.src = p > 0 ? "manual" : ""; it.conf = p > 0; it.sug = null; it.sugR = null; it.ap = 0;
    if (p > 0) { if (PP.same && isOn("ppSame")) st.items.forEach(o => { if (o !== it && OF.keyOf(o.den) === k && OF.umFamily(o.um) === f && !(o.src === "manual" && o.pret > 0)) { o.pret = p; o.src = "manual"; o.conf = true; o.sug = null; o.sugR = null; } }); if (isOn("ppKeep")) learn(it); }
    else autoMatch([it]); }
  save(); closeOvl(); rePos();
};
ACT.ppdel = () => { const id = PP.id; closeOvl(); undoable("Poziție ștearsă.", () => { st.items = st.items.filter(i => i.id !== id); }); };
ACT.cmenu = () => { const r = st.rows.find(x => x.id === VIEW.row), x = rowInfo(r); sheet(h3("Capitolul") + fld("cDen", "Cum apare în ofertă", r.den, {}) + fld("cOv", "Sumă pe tot capitolul (gol = suma pozițiilor: " + fmt(rndTo(x.tot, st.rnd)) + " lei)", r.ov > 0 ? edn(r.ov) : "", { n: 1 }) + `<div class="minis"><button data-a="cmv" data-d="-1">${ic("arrow-up", 16, 2.2)}Mai sus</button><button data-a="cmv" data-d="1">${ic("arrow-down", 16, 2.2)}Mai jos</button><button class="r" data-a="cdel">${ic("trash-2", 16, 2.2)}Șterge</button></div><button class="pri" data-a="csave" data-ok="1">Gata</button>`); };
ACT.csave = () => { const r = st.rows.find(x => x.id === VIEW.row); r.den = val("cDen") || r.den; r.ov = num(val("cOv")); save(); closeOvl(); render(); };
ACT.cmv = el => { if (moveRow(VIEW.row, +el.dataset.d)) { save(); toast(+el.dataset.d < 0 ? "Mutat mai sus în ofertă." : "Mutat mai jos în ofertă."); } };
ACT.cdel = () => { const r = st.rows.find(x => x.id === VIEW.row), n = rowInfo(r).n, id = CUR; closeOvl(); const snap = JSON.stringify(st); st.rows = st.rows.filter(x => x !== r); st.items = st.items.filter(i => i.cap !== r.cap); save(); go("#/o/" + id); toast("Capitol șters" + (n ? " (cu " + plural(n, "o poziție", "poziții") + ")" : "") + ".", () => { DOCS["p/" + id] = normSt(JSON.parse(snap)); if (CUR === id) st = DOCS["p/" + id]; save(); render(); }); };

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
ACT.menu = () => {
  const p = st.proj, e = entry(CUR), has = st.items.length > 0;
  sheet(h3("Oferta") + '<span class="lb">Cum stă</span><div class="seg">' + Object.keys(STARI).map(k => `<button data-a="stare" data-k="${k}" class="${(p.stare || "lucru") === k ? "on" : ""}">${STARI[k]}</button>`).join("") + "</div>" +
    op("target", "", "target", "Vreau alt total", "Scrii suma finală și prețurile se potrivesc singure.") +
    op("risc", "", "calculator", "Îmi iese?", "Câți oameni, câte zile: vezi ce îți rămâne.") +
    op("dup", "", "copy", "Fă o copie", "Pentru o variantă sau pentru altă lucrare la fel.") +
    (has ? op("opts", "", "sliders-horizontal", "Rotunjire și adaos", "Capitole rotunjite, adaos la toate pozițiile.") : "") +
    (e && e.arh ? op("unarh", "", "archive", "Scoate din arhivă", "O pui înapoi în lista de oferte.") + op("del", "", "trash-2", "Șterge definitiv", "Nu se mai poate aduce înapoi din aplicație.") : op("arh", "", "archive", "Arhivează", "Dispare din listă. O găsești la „Arhivă”.")));
};
ACT.stare = el => { st.proj.stare = el.dataset.k; save(); closeOvl(); render(); toast("Oferta e " + STARI[el.dataset.k] + "."); };
ACT.dup = () => { const id = dupOffer(CUR); go("#/o/" + id); toast("Am făcut o copie. Ești în copie acum."); };
ACT.arh = () => { const e = entry(CUR); e.arh = true; store.put("index", () => IDX, 0); go("#/"); toast("Am pus-o în arhivă.", () => { delete e.arh; store.put("index", () => IDX, 0); render(); }); };
ACT.unarh = () => { delete entry(CUR).arh; store.put("index", () => IDX, 0); closeOvl(); render(); toast("E din nou în lista de oferte."); };
ACT.del = () => { sheet(h3("Ștergi oferta?") + `<p class="s">„${esc(nameOf(st, entry(CUR)))}” se șterge de tot, de pe telefon și de pe laptop. Din aplicație nu se mai poate aduce înapoi.</p><button class="sec r" data-a="delok">Da, șterge definitiv</button><button class="pri" data-a="x">Nu, las-o</button>`); };
ACT.delok = async () => { const id = CUR; IDX.list = IDX.list.filter(x => x.id !== id); delete DOCS["p/" + id]; CUR = ""; st = null; store.put("index", () => IDX, 0); try { await store.remove("p/" + id); } catch (e) { } go("#/"); toast("Ofertă ștearsă."); };
ACT.target = () => { const t = totals(); sheet(h3("Vreau alt total") + `<p class="s">Acum oferta e ${fmt(t.sub)} lei fără TVA. Scrie cât vrei să fie. Toate prețurile se schimbă în aceeași măsură.</p>` + fld("tgt", "Total dorit, fără TVA (lei)", "", { n: 1, af: 1 }) + '<button class="pri" data-a="tgtok" data-ok="1">Schimbă prețurile</button>'); };
function scaleTo(target) {
  const cur = totals().sub; if (!(cur > 0) || !(target > 0)) return null; const f = target / cur;
  st.rows.forEach(r => { if (r.k === "c") { const i = rowInfo(r); if (i.val > 0) r.ov = Math.round(i.val * f); } else if (r.pret > 0) r.pret = r2(r.pret * f); });
  const d = r2(target - totals().sub);
  if (Math.abs(d) >= 0.005) { const c = st.rows.filter(r => (r.k === "c" && r.ov > 0) || (r.k === "r" && (+r.cant || 0) === 1 && r.pret > 0)).sort((a, b) => rowInfo(b).val - rowInfo(a).val)[0]; if (c) { if (c.k === "c") c.ov = r2(c.ov + d); else c.pret = r2(c.pret + d); } }
  return r2(target - totals().sub);
}
ACT.tgtok = () => { const t = num(val("tgt")); if (!(t > 0)) { toast("Scrie suma dorită."); return; } if (!(totals().sub > 0)) { closeOvl(); toast("Oferta nu are încă prețuri."); return; } closeOvl(); let d = 0; undoable("Prețuri schimbate.", () => { d = scaleTo(t); }); if (d) toast("A ieșit " + fmt(totals().sub) + " lei (diferență de " + fmt(Math.abs(d)) + " lei din rotunjiri).", UNDO); };
ACT.opts = () => { sheet(h3("Rotunjire și adaos") + '<span class="lb">Rotunjește fiecare capitol la</span><div class="seg" id="oRnd">' + [[0, "nimic"], [100, "100 lei"], [500, "500 lei"], [1000, "1.000 lei"]].map(([v, t]) => `<button data-a="segp" data-v="${v}" class="${(+st.rnd || 0) === v ? "on" : ""}">${t}</button>`).join("") + "</div>" + fld("oAd", "Adaos la toate pozițiile din listă (%)", edn(st.adaos), { n: 1, ph: "0" }) + '<button class="pri" data-a="optsok" data-ok="1">Gata</button>'); };
ACT.segp = el => { $$("button", el.parentNode).forEach(b => b.classList.toggle("on", b === el)); };
ACT.optsok = () => { const b = $("#oRnd button.on"); st.rnd = b ? +b.dataset.v : 0; st.adaos = num(val("oAd")); save(); closeOvl(); render(); };
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
  try { const buf = await f.arrayBuffer(), res = await IMP.readFile({ name: f.name, data: buf }); IM = { res, buf, on: res.tables.map(t => t.ok && !t.skip), grp: "fel" }; impSheet(); }
  catch (err) { sheet(h3("Nu am putut citi fișierul") + `<p class="s">${esc((err && err.message) || err)}</p><button class="pri" data-a="x">Am înțeles</button>`); }
});
function impSheet() {
  const r = IM.res, n = r.tables.reduce((a, t, i) => a + (IM.on[i] ? t.n : 0), 0), any = r.tables.some(t => t.ok);
  sheet(h3(any ? "Am găsit " + plural(r.tables.reduce((a, t) => a + (t.ok ? t.n : 0), 0), "o poziție", "poziții") : "Nu am găsit o listă") + `<p class="s">${esc(r.name || "")}</p>` +
    r.tables.map((t, i) => `<button class="tb ${t.ok ? (IM.on[i] ? "on" : "") : "off"}" data-a="${t.ok ? "imt" : ""}" data-k="${i}"><i>${IM.on[i] ? ic("check", 16, 3) : ""}</i><p>${esc(t.name || "Tabel")}<small>${t.ok ? plural(t.n, "o poziție", "poziții") + (t.kind === "sume" || t.kind === "randuri" ? " · intră ca rânduri în ofertă" : "") + (t.skip ? " · " + (t.hint === "echipamente" ? "listă de echipamente, nebifată" : "centralizator, nebifat") : "") + (t.title && t.title !== t.name ? " · " + esc(t.title) : "") : esc(t.why || "nu am găsit denumire și cantitate")}${(t.warn || []).length ? "<br>" + t.warn.map(esc).join("<br>") : ""}</small></p></button>`).join("") +
    (r.notes || []).map(x => `<div class="nt">${esc(x)}</div>`).join("") +
    (any ? `<span class="lb">Cum le împart pe capitole</span><div class="seg"><button data-a="imgrp" data-k="fel" class="${IM.grp === "fel" ? "on" : ""}">după felul lucrării</button><button data-a="imgrp" data-k="fis" class="${IM.grp === "fis" ? "on" : ""}">ca în fișier</button></div><button class="pri" data-a="imok" ${n ? "" : "disabled"}>Adu ${plural(n, "o poziție", "poziții")}</button>` : '<button class="pri" data-a="x">Am înțeles</button>'));
}
ACT.imt = el => { const i = +el.dataset.k; IM.on[i] = !IM.on[i]; impSheet(); };
ACT.imgrp = el => { IM.grp = el.dataset.k; impSheet(); };
ACT.imok = () => {
  const r = IM.res, fi = st.files.length, meta = { n: r.name, k: r.kind, t: {} }; let add = 0; const mine = [];
  r.tables.forEach((t, i) => { if (!IM.on[i] || !t.ok) return; meta.t[t.name] = { cols: t.cols, hr: t.headerRow, title: t.title || "" };
    if (t.kind === "sume" || t.kind === "randuri") { t.items.forEach(it => st.rows.push({ id: nextRow(), k: "r", den: it.den, um: it.um || "buc", cant: +it.cant || 1, pret: +it.pret || 0 })); add += t.items.length; return; }
    t.items.forEach(it => { const cap0 = String(it.cap0 || t.title || t.name || "Listă").replace(/\s+/g, " ").slice(0, 90), x = { id: nextItem(), cap0, cap: IM.grp === "fis" ? cap0 : OF.autoCap(it.den, cap0), cod: it.cod || "", den: it.den, um: it.um || "buc", cant: +it.cant || 0, pret: +it.pret || 0, conf: false, src: it.pret > 0 ? "file" : "", f: fi, sh: it.sheet || t.name, rw: it.row || 0 }; st.items.push(x); mine.push(x); add++; }); });
  st.files.push(meta); if (IM.buf && /^xls[xm]$/.test(r.kind || "")) FILES[CUR + "/" + fi] = { name: r.name, data: IM.buf }; syncRows(st); const m = autoMatch(mine); save(); closeOvl(); IM = null; render();
  toast(mine.length ? `Am adus ${plural(add, "o poziție", "poziții")}. ${m.a} au primit preț singure, ${m.s + m.v} au o sugestie.` : `Am adus ${plural(add, "un rând", "rânduri")}.`);
};
ACT.itext = () => { sheet(h3("Lipește sau scrie") + '<p class="s">Câte o lucrare pe rând. Exemple: „12 calorifere la 230”, „pardoseală 190 mp x 68”, „montaj centrală 1150”. Poți lipi și un tabel copiat din Excel.</p><textarea class="inp" id="iTxt" style="min-height:170px" placeholder="12 calorifere la 230&#10;pardoseală 190 mp x 68&#10;montaj centrală 1150" autofocus></textarea><button class="pri" data-a="iread">Citește</button>'); };
let LN = null;
ACT.iread = () => {
  const t = $("#iTxt").value; if (!t.trim()) { toast("Scrie sau lipește ceva."); return; }
  const ls = t.split(/\r?\n/).filter(x => x.trim()), tab = ls.filter(x => /\t|;|\|/.test(x)).length;
  if (ls.length > 1 && tab >= ls.length * 0.6) { const res = IMP.readText(t, "Text lipit"); IM = { res, buf: null, on: res.tables.map(x => x.ok && !x.skip), grp: "fel" }; impSheet(); return; }
  LN = IMP.parseLines(t).filter(x => x && x.den).map(x => Object.assign({ m: "u" }, x)); if (!LN.length) { toast("Nu am înțeles niciun rând."); return; } lnSheet();
};
function lnSheet() { sheet(h3("Am înțeles " + plural(LN.length, "un rând", "rânduri")) + '<p class="s">Verifică. Unde nu e clar dacă suma e pe bucată sau cu totul, alege tu.</p>' + LN.map((x, i) => { const pr = x.m === "t" && x.cant ? r2(x.pret / x.cant) : x.pret; return `<div class="tb on" style="cursor:default"><i>${ic("check", 16, 3)}</i><p>${esc(x.den)}<small>${fq(x.cant)} ${esc(x.um)} × ${fmt(pr)} lei = ${fmt(r2(x.cant * pr))} lei</small>${x.amb && x.cant > 1 ? `<span class="seg" style="margin-top:8px;display:flex"><button data-a="lnm" data-k="${i}" data-m="u" class="${x.m === "u" ? "on" : ""}">${fmt(x.pret)} pe ${esc(x.um)}</button><button data-a="lnm" data-k="${i}" data-m="t" class="${x.m === "t" ? "on" : ""}">${fmt(x.pret)} cu totul</button></span>` : ""}</p></div>`; }).join("") + `<button class="pri" data-a="lnok">Pune ${plural(LN.length, "rândul", "rânduri")} în ofertă</button>`); }
ACT.lnm = el => { LN[+el.dataset.k].m = el.dataset.m; lnSheet(); };
ACT.lnok = () => { const n = LN.length; LN.forEach(x => { const o = { den: x.den.charAt(0).toUpperCase() + x.den.slice(1), um: x.um || "buc", cant: +x.cant || 1, pret: x.m === "t" && x.cant ? r2(x.pret / x.cant) : +x.pret || 0 }; st.rows.push(Object.assign({ id: nextRow(), k: "r" }, o)); learn(o); }); LN = null; save(); closeOvl(); render(); toast(plural(n, "Un rând pus", "rânduri puse") + " în ofertă."); };

/* ---------- descarcă: Excel ca al tău, listă scurtă sau fișierul clientului cu prețurile tale ---------- */
let XP = null;
const chapX = () => st.rows.map(r => { const i = rowInfo(r); return r.k === "c" ? { name: r.den, value: i.val } : { name: r.den, um: r.um, cant: +r.cant || 0, pret: +r.pret || 0, value: i.val }; }).filter(c => c.value > 0 || c.name);
const xlFiles = () => st.files.map((f, i) => ({ f, i })).filter(x => x.f.k !== "text" && st.items.some(it => it.f === x.i));   // textul lipit nu e „fișierul clientului”
ACT.xl = () => { if (!st.rows.length) { toast("Oferta e goală. Pune întâi un rând."); return; } XP = { k: "mare", anexa: st.items.length > 0, fi: -1 }; xlSheet(); xlPrep(); };
function xlSheet() {
  const fara = st.items.filter(i => !(i.pret > 0)).length, r0 = st.rows.filter(r => rowInfo(r).val <= 0).length, cl = xlFiles();
  const o = (k, icon, t, s, fi) => `<button class="op" data-a="xlk" data-k="${k}" data-fi="${fi == null ? -1 : fi}" style="${XP.k === k && (k !== "client" || XP.fi === fi) ? "box-shadow:inset 0 0 0 2.5px var(--navy);background:#F4F8FD" : ""}"><i>${ic(icon, 24, 2)}</i><p>${t}<small>${s}</small></p></button>`;
  sheet(h3("Descarcă oferta") + o("mare", "file-spreadsheet", "Oferta mea, cu antet", "Foaia cu antet albastru, beneficiar, capitole, total, condiții.") + o("scurta", "list", "Ofertă scurtă", "Listă simplă: lucrare și cost. Cum faci la case.") +
    cl.map(x => o("client", "file-up", "Fișierul clientului, cu prețurile mele", /\.xls[xm]$/i.test(x.f.n || "") ? "Pun prețurile în „" + esc(x.f.n) + "”, fără să-i schimb forma." : "Fac un Excel cu rândurile din „" + esc(x.f.n) + "”, în aceeași ordine, cu prețul și valoarea.", x.i)).join("") +
    (XP.k === "mare" && st.items.length ? sw("xAnx", "Pune și lista de poziții cu prețuri (anexă)", XP.anexa).replace('data-a="sw"', 'data-a="sw" data-then="xlanx"') : "") +
    (fara || r0 ? `<div class="nt">${fara ? plural(fara, "O poziție nu are", "poziții nu au") + " preț și nu intră în total. " : ""}${r0 ? plural(r0, "Un rând e", "rânduri sunt") + " fără valoare." : ""}</div>` : "") +
    '<div id="xNote"></div><button class="pri" data-a="xlgo" id="xGo" disabled>Se pregătește…</button>');
}
ACT.xlk = el => { XP.k = el.dataset.k; XP.fi = +el.dataset.fi; xlSheet(); xlPrep(); };
ACT.xlanx = () => { XP.anexa = isOn("xAnx"); xlPrep(); };
async function xlPrep() {
  const my = XP, nm = fileSafe(st.proj.santier || "SANTIER"); my.blob = null; my.err = "";
  try {
    if (my.k === "client") {
      const key = CUR + "/" + my.fi, inPlace = /^xls[xm]$/.test(st.files[my.fi].k || "") && /\.xls[xm]$/i.test(st.files[my.fi].n || ""), f = inPlace ? FILES[key] : { name: st.files[my.fi].n, data: new Uint8Array(0) };   // pentru PDF, .xls, text nu am nevoie de fișier: fac unul nou din rândurile ținute minte
      if (!f) { my.need = true; if (XP === my) { $("#xNote").innerHTML = `<div class="nt">Am nevoie de fișierul primit: „${esc(st.files[my.fi].n)}”. Apasă mai jos și alege-l din telefon sau din laptop.</div>`; const b = $("#xGo"); b.disabled = false; b.textContent = "Alege fișierul primit"; } return; }
      const out = await fillClient(f, my.fi); my.blob = new Blob([out.data], { type: XLSX_MIME }); my.name = out.name; my.notes = out.notes || [];
    } else {
      await SCV.needXl();
      const wb = my.k === "scurta" ? OFX.exportShort(ExcelJS, { proj: projX(), chap: chapX() }) : OFX.exportOffer(ExcelJS, { proj: projX(), chap: chapX(), items: st.items, adaos: st.adaos }, { anexa: my.anexa });
      my.blob = new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME }); my.name = "OFERTA " + nm + (my.k === "scurta" ? " (scurta)" : "") + ".xlsx";
    }
  } catch (e) { my.err = (e && e.message) || String(e); }
  if (XP !== my || !$("#xGo")) return; const b = $("#xGo");
  if (my.err) { $("#xNote").innerHTML = `<div class="nt">Nu am putut face fișierul: ${esc(my.err)}</div>`; b.disabled = true; b.textContent = "Nu s-a putut"; return; }
  $("#xNote").innerHTML = (my.notes || []).map(x => `<div class="nt">${esc(x)}</div>`).join(""); b.disabled = false; b.innerHTML = ic("download", 20, 2.2) + "Descarcă";
}
ACT.xlgo = async () => {
  if (XP.need && !XP.blob) { $("#fOrig").value = ""; $("#fOrig").click(); return; }
  if (!XP.blob) return; const r = await SCV.saveFile(XP.name, XP.blob, XLSX_MIME); if (r !== "cancelled") { closeOvl(); toast(r === "shared" ? "Trimis." : "Am descărcat „" + XP.name + "”."); if (st.proj.stare === "lucru") { /* rămâne în lucru până o trece el la trimisă */ } }
};
$("#fOrig").addEventListener("change", async e => { const f = e.target.files[0]; if (!f || !XP) return; FILES[CUR + "/" + XP.fi] = { name: f.name, data: await f.arrayBuffer() }; XP.need = false; const b = $("#xGo"); if (b) { b.disabled = true; b.textContent = "Se pregătește…"; } xlPrep(); });
/* prețurile mele puse în fișierul primit (wb.js) */
async function fillClient(file, fi) {
  if (!window.WB) throw new Error("modulul pentru fișierul clientului nu e încărcat");
  const meta = st.files[fi], by = {}; st.items.forEach(it => { if (it.f === fi && it.rw) (by[it.sh] = by[it.sh] || []).push({ row: it.rw, pret: r2((+it.pret || 0) * (1 + (st.adaos || 0) / 100)), cant: +it.cant || 0 }); });
  const sheets = Object.keys(by).map(sh => { const t = meta.t[sh] || {}, tbl = { name: sh, cols: t.cols || {}, headerRow: t.hr || 0 }; return { sheet: sh, plan: WB.plan(tbl), headerRow: t.hr || 0, cols: t.cols || {}, rows: by[sh] }; });
  const tables = Object.keys(by).map(sh => ({ name: sh, title: (meta.t[sh] || {}).title || "", items: st.items.filter(it => it.f === fi && it.sh === sh).map(it => ({ nr: "", cod: it.cod || "", den: it.den, um: it.um, cant: +it.cant || 0, pret: 0, cap0: it.cap0 || "", row: it.rw })) }));
  return WB.fill({ name: file.name, data: file.data }, sheets, { tables });
}

/* ---------- prețurile mele ---------- */
ACT.prf = el => { VIEW.f = el.dataset.f; VIEW.lim = 50; VIEW.q = ""; render(); };
ACT.prmore = () => { VIEW.lim = (VIEW.lim || 50) + 50; $("#prl").innerHTML = priceRows(); };
INP.prq = el => { VIEW.q = el.value; VIEW.lim = 50; $("#prl").innerHTML = priceRows(); };
ACT.fam = el => { const g = {}; OF.famList().forEach(f => (g[f.grp] = g[f.grp] || []).push(f)); $("#famList").innerHTML = Object.keys(g).map(k => `<h4>${esc(k)}</h4><ul>${g[k].map(f => `<li>${esc(f.label)}${f.soft ? ' <span class="mut">– doar sugestie</span>' : ""}</li>`).join("")}</ul>`).join(""); el.remove(); };
let PE = null;
function priceSheet(c) { PE = c ? c.id : 0; const h = (c && c.h) || []; sheet(h3(c ? "Preț" : "Preț nou") + fld("eDen", "Lucrarea", c ? c.den : "", { af: !c }) + '<div class="r3"><div>' + fld("eP", "Preț (lei)", c ? edn(c.pret) : "", { n: 1 }) + '</div><div class="um">' + fld("eUm", "UM", c ? c.um : "buc", {}) + "</div></div>" + (c && c.desc ? `<p class="s" style="margin-top:10px">${esc(c.desc)}</p>` : "") + (h.length ? `<p class="s" style="margin-top:10px">Ultimele prețuri puse: ${h.map(x => fmt(x.p) + " lei (" + String(x.d).split("-").reverse().join(".") + (x.o ? ", " + esc(x.o) : "") + ")").join(" · ")}</p>` : "") + (c ? `<div class="minis"><button class="r" data-a="edel">${ic("trash-2", 16, 2.2)}Șterge prețul</button></div>` : "") + '<button class="pri" data-a="esave" data-ok="1">Gata</button>'); }
ACT.pnew = () => priceSheet(null);
ACT.pcat = el => priceSheet(catalog.find(c => c.id == el.dataset.k));
ACT.esave = () => { const den = val("eDen"), p = num(val("eP")), um = val("eUm") || "buc"; if (!den) { toast("Scrie lucrarea."); return; } const c = PE ? catalog.find(x => x.id === PE) : null; if (c) { if (+c.pret !== p) c.h = [{ p, d: todayIso(), o: "" }].concat(c.h || []).slice(0, 6); Object.assign(c, { den, um, pret: p }); } else catalog.unshift({ id: nextCatId++, dom: "MEU", sec: "", den, desc: "", um, pret: p, learned: true, h: [{ p, d: todayIso(), o: "" }] }); catDirty = true; rebuildCat(); saveCat(); closeOvl(); render(); };
ACT.edel = () => { const id = PE, old = JSON.stringify(catalog); catalog = catalog.filter(c => c.id !== id); catDirty = true; rebuildCat(); saveCat(); closeOvl(); render(); toast("Preț șters.", () => { catalog = JSON.parse(old); catDirty = true; rebuildCat(); saveCat(); render(); }); };
ACT.pref = el => { const r = REF[+el.dataset.k]; PE = +el.dataset.k; sheet(h3("Din ofertele tale vechi") + `<p style="font-weight:700;margin:6px 0 0">${esc(r.d)}</p><p class="s" style="margin-top:6px">${fmt(r.p)} lei / ${esc(r.u)} · ${esc(r.pr || "")}${r.an ? ", " + esc(r.an) : ""}${r.s === "p" ? " · de verificat" : ""}</p><button class="pri" data-a="prefok">Pune-l în prețurile mele</button>`); };
ACT.prefok = () => { const r = REF[PE]; catalog.unshift({ id: nextCatId++, dom: "OFERTE VECHI", sec: (r.pr || "") + " " + (r.an || ""), den: r.d, desc: "", um: r.u, pret: +r.p, learned: true }); catDirty = true; rebuildCat(); saveCat(); closeOvl(); VIEW.f = "m"; VIEW.q = ""; render(); toast("L-am pus în prețurile tale."); };
ACT.ppia = el => { const p = PIATA.lista[+el.dataset.k]; sheet(h3("Reper de piață") + `<p style="font-weight:700;margin:6px 0 0">${esc(p.lucrare)}</p><div class="tl" style="margin-top:10px"><span>De la – până la</span><b>${fmt(p.min)} – ${fmt(p.max)} ${esc(p.um || "")}</b></div>${p.tipic ? `<div class="tl"><span>Cel mai des</span><b>${fmt(p.tipic)}</b></div>` : ""}<p class="s" style="margin-top:10px">${esc(p.nota || "")}</p><p class="s">TVA: ${esc(p.tva || "neprecizat")} · cât de sigur: ${esc(p.sigur || "orientativ")} · ${esc(PIATA.data || "")}</p><div class="src">${(p.surse || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.titlu)}</a>`).join("")}</div><p class="s" style="margin-top:12px">E doar un reper de pe internet. Nu se pune singur în ofertă.</p><button class="pri" data-a="x">Am înțeles</button>`); };
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
    if (p.indexOf("p/") === 0) { const id = p.slice(2); DOCS[p] = normSt(clone(d)); if (!entry(id)) { IDX.list.unshift({ id, nume: nameOf(DOCS[p]), upd: todayIso() }); store.put("index", () => IDX, 0); } if (id === CUR) st = DOCS[p]; store.put(p, () => DOCS[p], 0); }
    else { onRemote(p, clone(d)); store.put(p, () => p === "index" ? IDX : p === "catalog" ? { items: catalog } : p === "firma" ? FIRMA : OF.HIST, 0); }
    render(); toast("Am pus înapoi copia."); } });

/* ---------- schimbări venite de pe celălalt aparat ---------- */
function onRemote(path, data) {
  if (path === "index" && data && Array.isArray(data.list)) IDX = data;
  else if (path === "firma") FIRMA = data || {};
  else if (path === "hist") OF.HIST = data || {};
  else if (path === "catalog" && data && data.items) { catalog = data.items; nextCatId = Math.max(1, ...catalog.map(c => c.id || 0)) + 1; rebuildCat(); }
  else if (path.indexOf("p/") === 0) { DOCS[path] = normSt(data); if (path === "p/" + CUR) st = DOCS[path]; }
  else DOCS[path] = data;
  if (booted && !isOpen() && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) render();
}

/* ---------- pornire ---------- */
window.__of = { get st() { return st; }, get docs() { return DOCS; }, get idx() { return IDX; }, get cat() { return catalog; }, get firma() { return FIRMA; }, totals, rowInfo, searchPrices, scaleTo, checks, num, fmt };
(async function () {
  const fail = m => { $("#app").innerHTML = '<main><div class="emp">' + m + '<br><br><button class="sec" onclick="location.reload()">Încearcă din nou</button></div></main>'; };
  try {
    ME = await SCV.gate({ name: "Ofertare SCV", sub: "Oferte de manoperă · doar pentru proprietar" });
    store = SCV.store("oferta", { cache: false, delay: 1200, warnUnload: true, onStatus: setSaved, onRemote, onAuthLost: () => { SCV.gate({ name: "Ofertare SCV", sub: "Sesiunea a expirat – intră din nou. Ce ai scris rămâne pe ecran și se salvează după intrare." }).then(u => { ME = u; store.resume(); }); } });
    let r = await store.load();
    if (!Object.keys(r.docs).length) { const n = await SCV.claimSeed(); if (n) r = await store.load(); }
    DOCS = r.docs;
    BASE_CAT = (DOCS.catalog0 && DOCS.catalog0.items) || [];
    catalog = (DOCS.catalog && DOCS.catalog.items) ? DOCS.catalog.items : BASE_CAT.map(x => Object.assign({}, x));
    nextCatId = Math.max(1, ...catalog.map(c => c.id || 0)) + 1;
    FIRMA = DOCS.firma || {}; OF.HIST = DOCS.hist || {}; REF = (DOCS.ref && DOCS.ref.items) || [];
    pref = OF.prepCatalog(REF.map((x, i) => ({ id: "r" + i, dom: "", sec: "", den: x.d, desc: "", um: x.u, pret: x.p, an: x.an })));
    IDX = DOCS.index && Array.isArray(DOCS.index.list) ? DOCS.index : { list: [] };
    Object.keys(DOCS).forEach(p => { if (p.indexOf("p/") === 0) DOCS[p] = normSt(DOCS[p]); });
    Object.keys(DOCS).forEach(p => { if (p.indexOf("p/") === 0 && !entry(p.slice(2))) IDX.list.push({ id: p.slice(2), nume: nameOf(DOCS[p]), upd: "" }); });
    rebuildCat(); booted = true; store.start(); setSaved(""); route();
    /* ofertele potrivite cu reguli mai vechi se refac o singură dată (prețurile puse sau verificate de tine nu se ating) */
    setTimeout(() => { let ch = 0; Object.keys(DOCS).forEach(p => { const s = DOCS[p]; if (p.indexOf("p/") === 0 && s.items.length && s.mv !== OF.MV) { autoMatch(null, s); store.put(p, () => DOCS[p]); ch++; } }); if (ch && !isOpen()) render(); }, 50);
    fetch("piata.json", { cache: "no-cache" }).then(x => x.ok ? x.json() : null).then(j => { PIATA = j; if (VIEW.name === "prices" && !isOpen()) render(); }).catch(() => { });
  } catch (e) { fail("Nu pot încărca datele: " + esc((e && e.message) || e)); }
})();
})();

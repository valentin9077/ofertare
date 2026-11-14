/* „Deschide orice listă” – citește o listă de cantități / o ofertă din Excel (.xlsx, .xlsm, .xls, .ods), CSV, PDF cu text,
   Word (.docx) sau din text lipit și întoarce pozițiile găsite (denumire, UM, cantitate, preț de manoperă dacă există).
   Fără server: bibliotecile mari (SheetJS, pdf.js) se încarcă doar când e nevoie, din lib/vendor/.
   Folosit în browser (window.IMP) și în node (teste). Nu schimbă niciodată fișierul citit. */
(function (root) {
  "use strict";
  var L = {};                                   // biblioteci: puse de teste (IMP.libs) sau încărcate la nevoie

  /* ---------- text, numere, unități ---------- */
  function strip(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function clean(s) { return String(s == null ? "" : s).replace(/[  \s]+/g, " ").trim(); }
  function hasLetters(s, n) { var m = String(s).match(/[A-Za-zÀ-ɏȘ-ț]/g); return !!m && m.length >= (n || 2); }

  /** Numere scrise românește: „1.800” = 1800, „1800,50”, „1 800”, „2,5”, „12.5”, „0.125”, „2,5k”. Gol sau text = 0. */
  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    var s = String(v == null ? "" : v).replace(/[  \s]/g, "").replace(/(lei|ron|eur|euro|€)\.?$/i, ""), k = 1;
    if (/^[-+]?\d[\d.,]*k$/i.test(s)) { k = 1000; s = s.slice(0, -1); }
    if (!/^[-+]?[\d.,]+$/.test(s) || !/\d/.test(s)) return 0;
    var neg = s.charAt(0) === "-"; s = s.replace(/^[-+]/, "").replace(/[.,]+$/, "");
    var ld = s.lastIndexOf("."), lc = s.lastIndexOf(",");
    if (ld >= 0 && lc >= 0) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if (lc >= 0) s = (s.match(/,/g).length > 1) ? s.replace(/,/g, "") : s.replace(",", ".");
    else if (ld >= 0 && (s.match(/\./g).length > 1 || (/^\d{1,3}\.\d{3}$/.test(s) && s.charAt(0) !== "0"))) s = s.replace(/\./g, "");
    var n = parseFloat(s) * k; return isFinite(n) ? (neg ? -n : n) : 0;
  }
  function isNum(v) { return typeof v === "number" ? isFinite(v) : /^[-+]?\d[\d.,\s ]*$/.test(String(v == null ? "" : v).trim()) && /\d/.test(String(v)); }
  var r6 = function (n) { return Math.round(n * 1e6) / 1e6; };

  var UM = [[/^(buc|bucata|bucati|bucat|bc|pcs|pc|bucăți)$/, "buc"], [/^(m|ml|metru|metri|mliniar|mliniari|metruliniar|metriliniari|ml\.)$/, "ml"],
  [/^(mp|m2|m²|metrupatrat|metripatrati|mpatrat|mpatrati|mpatr|mp\.)$/, "mp"], [/^(mc|m3|m³|metrucub|metricubi|mcub|mcubi)$/, "mc"], [/^(kg|kilogram|kilograme)$/, "kg"], [/^(to|t|tona|tone)$/, "to"],
  [/^(set|seturi)$/, "set"], [/^(l|litru|litri)$/, "l"], [/^(pereche|perechi|per)$/, "pereche"], [/^(punct|puncte|pct)$/, "punct"], [/^(ore|ora|h)$/, "ore"], [/^(ans|ansamblu|ansambluri)$/, "ans"]];
  /** Unitatea de măsură adusă la o formă: buc, ml, mp, mc, kg, set, punct, ore, ans; ce nu cunosc rămâne cum e (cu litere mici); gol = buc. */
  function normUm(s) {
    var t = clean(strip(s)).replace(/[.\s]+$/, ""); if (!t) return "buc";
    var k = t.replace(/[.\s]/g, "");
    for (var i = 0; i < UM.length; i++) if (UM[i][0].test(k)) return UM[i][1];
    return t;
  }
  var UMTOK = /^(buc|bucata|bucati|ml|m|metri|mp|m2|m²|mc|m3|kg|set|seturi|punct|puncte|ore|ans|ansamblu|to|tona|l|litri|grup|sistem|sisteme|sist|pereche|perechi|cm|mm|rola|role|cutie|cutii|sac|saci|zeci m|sute buc|100 mc|kw|co|cv)$/;
  function isUmTok(v) { var t = clean(strip(v)).replace(/[.\s]+$/, ""); return !!t && t.length <= 12 && UMTOK.test(t); }
  /* fără coloană de UM: metru la țevi, izolații, cabluri; bucată la rest */
  function guessUm(den) { return /^(teava|tevi|conducta|conducte|tub |tuburi|tubulatura|izolatie|izolatii|cablu|cabluri|traseu|trasee|banda|furtun|jgheab|burlan|plinta|canal |profil)/.test(strip(den)) ? "ml" : "buc"; }

  /* ---------- capitole, totaluri, titlu ---------- */
  function capsRatio(s) { var a = String(s).match(/[A-Za-zÀ-ɏȘ-ț]/g) || [], u = String(s).match(/[A-ZÀ-ÞĂȘȚŞŢ]/g) || []; return a.length >= 4 ? u.length / a.length : 0; }
  var NUMPRE = /^\s*(?:cap(?:itol(?:ul)?)?\.?\s*)?((?:\d{1,2}(?:\.\d{1,2}){0,3}[.)]|\d{1,2}(?:\.\d{1,2}){1,3}|[IVX]{1,4}[.)]|[A-Za-z][.)]))\s+(?=\S)/;
  function capInfo(text, nrCell) {
    var t = clean(text); if (!t || t.length < 3 || t.length > 140 || !hasLetters(t, 3)) return null;
    if (/^(total|subtotal|sub-total|nota|notă|obs|observatii|observații|intocmit|întocmit|verificat|aprobat|semnatura|pagina|pag\.)\b/i.test(t)) return null;
    if (/^(materiale?|manopera|utilaje?|transport)\s*:$/i.test(t)) return null;          // rândurile de defalcare de sub o poziție din F3
    var mc = /^\s*cap(?:itol(?:ul)?)?\.?\s*(\d{1,2}(?:\.\d{1,2}){0,3}|[IVX]{1,4})\s*[:.)\-–]?\s+(?=\S)/i.exec(t);
    if (mc && hasLetters(t.slice(mc[0].length), 3)) return { title: t.slice(mc[0].length).replace(/\s*:$/, ""), lvl: /^\d/.test(mc[1]) ? mc[1].split(".").length : 1, strong: true, generic: false };
    var m = NUMPRE.exec(t), lvl = 1, strong = false, title = t;
    if (m) { strong = true; title = t.slice(m[0].length); var p = m[1]; lvl = /^\d/.test(p) ? p.replace(/[.)]+$/, "").split(".").length : /^[a-z]/.test(p) ? 2 : 1; if (!hasLetters(title, 3)) return null; }
    else if (capsRatio(t) >= 0.8) strong = true;
    else if (/:$/.test(t) && t.length <= 70) { strong = true; title = t.replace(/\s*:$/, ""); }
    else if (nrCell && /^[A-Z]{1,4}[.\-]?\d{1,3}[A-Z]?\.?$/.test(clean(nrCell))) strong = true;
    var weak = !strong && t.length <= 60 && /^[A-ZĂÂÎȘȚÀ-Þ]/.test(t) && !/[,;:.!?]/.test(t.replace(/\.$/, "")) && t.split(" ").length <= 8 && !/^-/.test(t);
    if (!strong && !weak) return null;
    return { title: title, lvl: lvl, strong: strong, generic: /^(materiale?|echipamente?|manopera|montaj|utilaje|dotari|accesorii|diverse)\b/.test(strip(title)) && title.length < 70 };
  }
  var TOTRE = /^(total|subtotal|sub total|sub-total|totaluri)\b/, TOT2 = /^(tva\b|taxa pe valoarea|valoare totala|cheltuieli (directe|indirecte)|recapitula|profit\b|contributi|cota |c\.a\.s|alte cheltuieli|din care)/;
  function isTotal(den, hasQty) { var s = strip(den); return TOTRE.test(s) || (!hasQty && TOT2.test(s)); }
  var GENT = /^(lista|liste|li\w{2,6}ta|formular|formularul|centralizator|anexa|tabel|deviz oferta|antemasuratoare)\b/, SKIPT = /^(nr\b|pag|data\b|proiectant|adresa|beneficiar|obiectiv|intocmit|faza|contract|cod cpv|\[ ?ron|ron\b)/;
  function findTitle(g, upto) {
    var cand = [], lab = "", i, r;
    for (i = Math.max(0, upto - 12); i < upto; i++) {
      r = g[i] || []; var parts = [];
      for (var c = 0; c < r.length; c++) { var v = r[c]; if (typeof v === "string" && clean(v)) parts.push(clean(v)); }
      var t = (parts.length > 1 && /:$/.test(parts[0]) ? parts[0] + " " + parts[1] : parts[0] || "").replace(/\s*\[\s*(ron|lei|euro|eur)\s*\]\s*$/i, ""); if (t.length < 4 || !hasLetters(t, 3)) continue;
      var m = /^(categorie|categoria|obiect|obiectul|deviz|devizul|stadiu fizic|specialitatea|lucrarea)\s*:\s*(.{3,})$/i.exec(t);
      if (m) { lab = m[2]; continue; }
      if (SKIPT.test(strip(t))) continue;
      cand.push(t);
    }
    var good = cand.filter(function (t) { return !GENT.test(strip(t)) && t.length > 6; });
    return (lab || (good.length ? good[good.length - 1] : cand[0]) || "").slice(0, 90);
  }

  /* ---------- capul de tabel ---------- */
  function hnorm(v) { return strip(v).replace(/[^a-z0-9%€²³]+/g, " ").trim(); }
  function labKind(h) {
    if (!h || h.length > 70) return "";
    if (/^(nr|nr crt|nr crit|crt|poz|pozitie|pozitia|no)( |$)/.test(h) && h.length <= 16 && !/buc/.test(h)) return "nr";
    if (/^(cant|catit|bucati|qty|nr buc|buc m|cantitate)/.test(h)) return "cant";
    if (/^(um|u m)( |$)|^unitate|^unit mas|^u de m/.test(h)) return "um";
    if (h === "tip" || h === "tip articol" || h === "tip resursa") return "tip";
    if (/manoper/.test(h) && !/^(total|valoare|val )/.test(h) && !/total manopera|valoare manopera/.test(h)) return "man";
    if (/material|echipament|utilaj|transport/.test(h) && /^(pret|pretul|pu|p u|valoare|cost)/.test(h)) return "val";
    if (/^(pret|pretul|pu|p u)( |$)/.test(h) && !/total/.test(h)) return "unit";
    if (/^(cost|costuri|valoare|valoarea|suma|pret total|total|pret)( |$)/.test(h)) return "sum";
    if (/^cod (si )?(denumire|descriere)/.test(h)) return "den1";
    if (/^(cod|simbol|art deviz|articol de deviz|norma|indicator)( |$)/.test(h)) return "cod";
    if (/^(denumire|denumirea|descriere|descrierea)/.test(h)) return "den1";
    if (/^(capitol(ul)? (de )?lucrari|articol|articole|id articol|lucrare|lucrarea|lucrari|specificatie|produs|operatiune|operatie|operatiuni|activitate|liste? (de )?cantitati|material|materiale|echipament|serviciu|servicii)( |$)/.test(h)) return "den2";
    if (/^(specif|caracteristic|dimensiun)/.test(h)) return "ext";
    return "";
  }
  function rowKinds(row) {
    var k = {}, n = 0;
    for (var c = 0; c < row.length; c++) { var v = row[c]; if (typeof v !== "string") continue; var kd = labKind(hnorm(v)); if (kd) { (k[kd] = k[kd] || []).push(c); n++; } }
    k.n = n; return k;
  }
  function findHeader(g) {
    var lim = Math.min(g.length, 45), sume = null, r, k, k2, c;
    for (r = 0; r < lim; r++) {
      k = rowKinds(g[r] || []);
      if (k.cant && (k.den1 || k.den2)) return { r: r, k: k };
      if (k.cant && k.n >= 2 && r + 1 < g.length) {             // „Cod” sus, „Denumirea” dedesubt (antet pe două rânduri)
        k2 = rowKinds(g[r + 1] || []);
        if (k2.den1 || k2.den2) { for (c in k2) if (c !== "n" && !k[c]) k[c] = k2[c]; return { r: r, k: k, two: true }; }
      }
      if (!sume && !k.cant && (k.den1 || k.den2) && (k.sum || k.man || k.unit) && k.n >= 2) sume = { r: r, k: k, sume: true };
    }
    return sume;
  }
  /* fără cap de tabel: coloana cu text e denumirea, cea cu numere e cantitatea, cea cu „buc/ml” e UM */
  function guessCols(g) {
    var st = {}, lim = Math.min(g.length, 400), r, c, v;
    for (r = 0; r < lim; r++) {
      var row = g[r] || [];
      for (c = 0; c < row.length && c < 40; c++) {
        v = row[c]; if (v === "" || v == null) continue;
        var s = st[c] = st[c] || { t: 0, n: 0, u: 0, seq: 0, last: null, rows: {} };
        if (isNum(v)) { var x = num(v); if (x > 0) { s.n++; s.rows[r] = 1; if (s.last != null && x === s.last + 1) s.seq++; s.last = x; } }
        else if (isUmTok(v)) s.u++;
        else if (hasLetters(v, 4) && clean(v).length >= 6) { s.t++; s.rows[r] = 2; }
      }
    }
    var den = -1, cant = -1, um = -1, nr = -1, best = 2;
    for (c in st) if (st[c].t > best) { best = st[c].t; den = +c; }
    if (den < 0) return null;
    var both = function (cc) { var n = 0; for (var rr in st[cc].rows) if (st[cc].rows[rr] === 1 && st[den].rows[rr] === 2) n++; return n; };
    best = 2;
    for (c in st) if (+c !== den && st[c].u > best) { best = st[c].u; um = +c; }
    best = 2;
    for (c in st) { c = +c; if (c === den || c === um || st[c].n < 3) continue; var seq = st[c].seq >= st[c].n * 0.6; if (seq && c < den) { nr = c; continue; } if (c < den && um < 0) continue; var b = both(c) + (c > den ? 0.5 : 0); if (b > best) { best = b; cant = c; } }
    if (cant < 0) return null;
    return { den: den, cant: cant, um: um, nr: nr };
  }

  /* ---------- un tabel (foaie de calcul, tabel din Word, text cu coloane) ---------- */
  function newTable(name) { return { name: name, title: "", ok: false, why: "", kind: "lista", cols: { nr: -1, cod: -1, den: -1, um: -1, cant: -1, pret: -1 }, headerRow: 0, items: [], n: 0, warn: [] }; }
  var SYM = /^([A-Z]{1,5}\d{2,3}[A-Z]\d{0,2}[A-Z]?\d{0,2}\+?)(?:\s+\d{1,3})?[\s\-–:]+(?=\S)/;
  function finish(T, st) {
    T.n = T.items.length; T.ok = T.n > 0;
    if (!T.ok && !T.why) T.why = "Nu am găsit rânduri cu denumire și cantitate.";
    if (st) {
      if (st.zero) T.warn.push(st.zero === 1 ? "Un rând are cantitatea zero sau goală și a fost sărit." : st.zero + " rânduri au cantitatea zero sau goală și au fost sărite.");
      if (st.noUm && T.ok) T.warn.push("Lista nu are coloană de UM: am pus „ml” la țevi și izolații și „buc” la rest. Verifică.");
      if (st.euro) T.warn.push("Prețurile din fișier sunt în euro: nu le-am luat.");
      if (st.unitPrice && T.items.some(function (i) { return i.pret > 0; })) T.warn.push("Am luat prețurile din coloana „Preț unitar”. Verifică dacă sunt prețuri de manoperă.");
    }
    /* o ofertă gata făcută (puține rânduri, toate cu preț): rândurile ei intră ca rânduri de ofertă, cu prețul lor */
    if (T.ok && T.kind === "lista" && T.n <= 40 && T.items.every(function (i) { return i.pret > 0; }) && /(^| )ofert/.test(strip((T.title || "") + " " + (T.name || "") + " " + ((st && st.hint) || "")))) { T.kind = "randuri"; T.warn = T.warn.filter(function (w) { return !/Preț unitar/.test(w); }); }
    return T;
  }
  function Caps(title, fallback) {
    var stack = [];
    return {
      set: function (ci) { stack = stack.filter(function (x) { return x.lvl < ci.lvl; }); stack.push(ci); },
      get: function () { for (var i = stack.length - 1; i >= 0; i--) if (!stack[i].generic || i === 0) return stack[i].title.slice(0, 90); return title || fallback; }
    };
  }
  function txtCells(row, skip) {                      // celulele cu text dintr-un rând (fără cele din skip)
    var out = [];
    for (var c = 0; c < row.length; c++) { var v = row[c]; if (skip && skip[c]) continue; if (typeof v === "string" && hasLetters(v, 3)) out.push({ c: c, t: clean(v) }); }
    return out;
  }
  function analyze(g, merges, name) {
    var T = newTable(name), st = { zero: 0 }, H = findHeader(g), r, c, row;
    if (!g.length) { T.why = "Foaia e goală."; return T; }
    if (!H) {
      var G = guessCols(g);
      if (!G) { var NR = necRows(g, T, st, name); if (NR) return NR; T.why = "Nu am găsit coloane cu denumire și cantitate."; return T; }
      var first = 0; for (r = 0; r < g.length; r++) { row = g[r] || []; if (isNum(row[G.cant]) && num(row[G.cant]) > 0 && typeof row[G.den] === "string" && hasLetters(row[G.den], 3)) { first = r; break; } }
      T.title = findTitle(g, first);
      T.cols.den = G.den; T.cols.cant = G.cant; T.cols.um = G.um; T.cols.nr = G.nr;
      var frac = 0, tot = 0; for (r = first; r < g.length; r++) { var q0 = (g[r] || [])[G.cant]; if (isNum(q0) && num(q0) > 0) { tot++; if (num(q0) % 1 !== 0 && Math.abs(num(q0) * 100 - Math.round(num(q0) * 100)) < 1e-6 || num(q0) >= 20000) frac++; } }
      var money = G.um < 0 && tot >= 3 && frac / tot >= 0.5;
      if (money) { T.kind = "sume"; T.cols.pret = G.cant; T.cols.cant = -1; }
      return flat(g, T, st, { r: first - 1, den: [G.den], short: [], ext: [], cant: [G.cant], um: G.um, nr: G.nr, cod: -1, tip: -1, pret: -1, rev: {}, asSum: money }, name);
    }
    var k = H.k, hr = H.r, hrow = g[hr] || [];
    T.headerRow = hr + 1; T.title = findTitle(g, hr);
    var den1 = k.den1 || [], den2 = k.den2 || [], cod = k.cod ? k.cod[0] : -1;
    if (den1.length) { den2 = den2.filter(function (x) { if (/^(articol|id articol)/.test(hnorm(hrow[x] != null ? hrow[x] : (g[hr + 1] || [])[x])) && cod < 0) { cod = x; return false; } return true; }); }
    var den = den1.length ? den1 : den2.slice(0, 1), short = den1.length ? den2 : den2.slice(1);
    var pret = -1, euro = false, unitP = false, hx = function (x) { return hnorm(hrow[x]) + " " + hnorm((g[hr + 1] || [])[x]); };
    if (k.man) pret = k.man[0]; else if (k.unit && !k.val) { pret = k.unit[0]; unitP = true; } else if (k.unit && k.val) { pret = -1; }
    if (pret >= 0 && /eur|€/.test(hx(pret))) { euro = true; pret = -1; }
    st.euro = euro; st.unitPrice = unitP && !H.sume;
    T.cols.nr = k.nr ? k.nr[0] : -1; T.cols.cod = cod; T.cols.den = den[0]; T.cols.um = k.um ? k.um[0] : -1; T.cols.cant = k.cant ? k.cant[0] : -1; T.cols.pret = pret;
    /* liste „Articol | Cost”, fără cantitate: fiecare rând e o sumă */
    if (H.sume) {
      var sc = (k.man || k.sum || k.unit)[0], sub0 = g[hr + 1] || [], cx; T.kind = "sume";
      for (cx = sc; cx < sub0.length; cx++) if (/manoper/.test(hnorm(sub0[cx]))) { sc = cx; break; }
      if (cx >= sub0.length && !k.man) for (cx = sub0.length - 1; cx >= sc; cx--) if (/^total/.test(hnorm(sub0[cx]))) { sc = cx; break; }
      T.cols.pret = sc;
      var caps0 = Caps(T.title, name);
      for (r = hr + 1; r < g.length; r++) {
        row = g[r] || []; var d0 = joinDen(row, den, [], []), v0 = isNum(row[sc]) ? num(row[sc]) : 0;
        if (!d0 || !hasLetters(d0, 3) || isTotal(d0, false)) continue;
        if (!(v0 > 0)) { var ci0 = capInfo(d0, ""); if (ci0 && ci0.strong) caps0.set(ci0); continue; }
        T.items.push({ nr: T.cols.nr >= 0 ? clean(row[T.cols.nr]) : "", cod: "", den: d0, um: T.cols.um >= 0 ? normUm(row[T.cols.um]) : "buc", cant: 1, pret: r6(v0), cap0: caps0.get(), sheet: name, row: r + 1 });
      }
      return finish(T, st);
    }
    /* antet pe mai multe rânduri: „Simbol / Denumire” una sub alta = fiecare articol stă pe mai multe rânduri (F3, F4 din programele de devize) */
    var dc = den[0], stacked = false, hEnd = hr, manLine = -1, pc = pret >= 0 ? pret : (k.unit ? k.unit[0] : -1), cc = k.cant[0];
    for (r = hr + 1; r <= hr + 7 && r < g.length; r++) {
      row = g[r] || []; if (isNum(row[cc]) && num(row[cc]) > 0) break;
      if (T.cols.um >= 0 && isNum(row[T.cols.um]) && num(row[T.cols.um]) > 0 && typeof row[cc] === "string" && isUmTok(row[cc])) break;   // rând de date cu UM și cantitatea puse invers
      var lab = hnorm(row[dc]), any = false, cells = 0;
      for (c = 0; c < row.length; c++) if (row[c] !== "" && row[c] != null && clean(row[c])) { cells++; if (typeof row[c] === "string") any = true; }
      if (!any) break;
      /* un singur text pe rând, scris ca un titlu de capitol („Capitolul 1: …”, „A. SANITARE”): e deja din listă, nu din capul de tabel */
      if (cells <= 2 && lab && !labKind(lab) && !rowKinds(row).n) { var cih = capInfo(clean(row[dc]), ""); if (cih && cih.strong && clean(row[dc]).length >= 8) break; }
      if (/^(denumire|denumirea)/.test(lab) && (r > hr)) stacked = stacked || /^(cod|simbol|capitol)/.test(hnorm(hrow[dc])) || /^(simbol|cod)/.test(hnorm((g[hr + 1] || [])[dc]));
      if (pc >= 0 && /manoper/.test(hnorm(row[pc]))) manLine = r - hr;
      if (lab || (pc >= 0 && typeof row[pc] === "string") || /^(crt|deviz|general|\(|0$)/.test(hnorm(row[T.cols.nr >= 0 ? T.cols.nr : 0]) || "x") || rowKinds(row).n || /\brev\b|^\(/.test(row.map(function (x) { return typeof x === "string" ? x : ""; }).join(" ").trim())) hEnd = r; else break;
    }
    if (stacked) return stackedRows(g, T, st, { hEnd: hEnd, dc: dc, cc: cc, um: T.cols.um, nr: T.cols.nr, pc: pc, manLine: manLine, hr: hr }, name);
    /* coloane de revizie („Cantitate (rev.1)”): ultima completată câștigă */
    var rev = {}, sub = g[hr + 1] || [];
    ["cant", "um", "den1"].forEach(function (kk) { var a = k[kk] || []; if (a.length > 1 && a.slice(1).some(function (x) { return /rev/.test(hnorm(sub[x])) || /rev/.test(hnorm(hrow[x])); })) rev[kk] = a; });
    var cant = rev.cant ? rev.cant : [pickCant(k.cant, hrow)];
    if (rev.den1) den = [den1[0]];
    T.cols.cant = cant[0];
    /* în unele fișiere capul de tabel zice „U.M | Cantitate”, dar dedesubt sunt puse invers: mă iau după ce conțin */
    if (T.cols.um >= 0 && cant.length === 1 && !rev.um) {
      var sN = 0, sU = 0, sT = 0;
      for (r = hEnd + 1; r < Math.min(g.length, hEnd + 300); r++) { var ua = (g[r] || [])[T.cols.um], qa = (g[r] || [])[cant[0]]; if ((ua === "" || ua == null) && (qa === "" || qa == null)) continue; sT++; if (isNum(ua) && num(ua) > 0) sN++; if (typeof qa === "string" && isUmTok(qa)) sU++; }
      if (sT >= 2 && sN >= sT * 0.6 && sU >= sT * 0.6) { var swp = T.cols.um; T.cols.um = cant[0]; cant = [swp]; T.cols.cant = swp; T.warn.push("În fișier, coloanele „UM” și „Cantitate” sunt puse invers față de capul de tabel. Le-am citit după ce conțin."); }
    }
    /* coloane fără nume lipite de denumire (celule unite, dimensiunea pusă alături) */
    var labeled = {}; for (var kk in k) if (kk !== "n") k[kk].forEach(function (x) { labeled[x] = 1; });
    var extL = [], extR = [], last = den[den.length - 1], w = 0; for (r = 0; r < g.length; r++) w = Math.max(w, (g[r] || []).length);
    for (c = last + 1; c < w && !labeled[c] && !clean(hrow[c]); c++) extR.push(c);
    for (c = den[0] - 1; c >= 0 && !labeled[c] && !clean(hrow[c]); c--) extL.unshift(c);
    return flat(g, T, st, { r: hEnd, den: den, short: short, ext: (k.ext || []).concat(extR), extL: extL, cant: cant, um: T.cols.um, umRev: rev.um, denRev: rev.den1, nr: T.cols.nr, cod: cod, tip: k.tip ? k.tip[0] : -1, pret: pret, rev: rev }, name);
  }
  /* „Cot 20x90-30”, „Teava pex 16-760ml”, „Robinet cu olandez - 2 buc”, „Placi cu nuturi 68mp” */
  var NECU = "buc|bucati|bucata|ml|m|metri|mp|m2|m²|mc|kg|set|seturi|role|rola|saci|sac|cutii|cutie|l|litri|pereche|perechi|bare|bara|colac|colaci";
  var NEC1 = new RegExp("^(.*?\\S)\\s*[-–—:=]\\s*(\\d[\\d.,]*)\\s*(" + NECU + ")?\\.?$", "i"), NEC2 = new RegExp("^(.*?[^\\d\\s.,])\\s*(\\d[\\d.,]*)\\s*(" + NECU + ")\\.?$", "i");
  function necLine(t) {
    t = clean(t).replace(/^[\-–—•*·]+\s*|^\d{1,3}[.)]\s+/, "");
    var m = NEC1.exec(t), um; if (m && hasLetters(m[1], 3)) um = m[3] || ""; else { m = NEC2.exec(t); if (!m || !hasLetters(m[1], 3)) return null; um = m[3]; }
    var q = num(m[2]); if (!(q > 0) || q > 1e6) return null;
    var den = clean(m[1]).replace(/[\s\-–—:=,;]+$/, ""); if (!hasLetters(den, 3) || isTotal(den, true)) return null;
    return { den: den, cant: r6(q), um: um ? normUm(um) : guessUm(den) };
  }
  function necRows(g, T, st, name) {
    var items = [], tried = 0, r, c;
    for (r = 0; r < g.length; r++) {
      var row = g[r] || [], parts = [];
      for (c = 0; c < row.length && c < 12; c++) { var v = row[c]; if (v === "" || v == null) continue; parts.push(clean(typeof v === "number" ? String(v) : v)); }
      if (!parts.length || !hasLetters(parts.join(" "), 3)) continue; tried++;
      var p = necLine(parts.length > 1 ? parts.slice(0, -1).join(" ") + " - " + parts[parts.length - 1] : parts[0]) || (parts.length > 1 ? necLine(parts.join(" ")) : null);
      if (p) items.push({ nr: "", cod: "", den: p.den, um: p.um, cant: p.cant, pret: 0, cap0: "", sheet: name, row: r + 1 });
    }
    if (items.length < 3 || items.length < tried * 0.5) return null;
    T.items = items; T.free = true; T.warn.push("Lista nu are coloane: am citit fiecare rând ca „denumire – cantitate”. Verifică.");
    if (tried > items.length) T.warn.push(tried - items.length === 1 ? "Un rând fără cantitate a fost sărit." : (tried - items.length) + " rânduri fără cantitate au fost sărite.");
    return finish(T, null);
  }
  function pickCant(a, hrow) { for (var i = 0; i < a.length; i++) if (/total/.test(hnorm(hrow[a[i]]))) return a[i]; return a[0]; }
  function lastVal(row, cols, numeric) { for (var i = cols.length - 1; i >= 0; i--) { var v = row[cols[i]]; if (numeric ? (isNum(v) && num(v) > 0) : clean(v)) return v; } return numeric ? row[cols[0]] : ""; }
  function joinDen(row, den, short, ext, extL) {
    var parts = [], seen = {}, add = function (v, strict) { if (typeof v === "number") { if (strict) return; v = String(v); } v = clean(v); if (!v || seen[v]) return; if (strict && !(hasLetters(v, 3) && v.indexOf(" ") > 0)) return; seen[v] = 1; parts.push(v); };
    (extL || []).forEach(function (c) { add(row[c], true); });
    den.forEach(function (c) { add(row[c]); });
    (ext || []).forEach(function (c) { var v = row[c]; if (typeof v === "string" || (typeof v === "number" && parts.length)) add(v); });
    var long = parts.join(" "), sh = short && short.length ? clean(row[short[0]]) : "";
    if (sh && typeof row[short[0]] === "string" && hasLetters(sh, 2)) { if (!long) return sh; if (strip(long).indexOf(strip(sh)) !== 0) return sh + " – " + long; }
    return long;
  }
  function flat(g, T, st, C, name) {
    var caps = Caps(T.title, name), r, row, hrow = g[C.r] || [], hasNorm = false, strongSeen = false, pend = [];
    if (C.tip >= 0) for (r = C.r + 1; r < g.length; r++) if (/^norm/.test(strip((g[r] || [])[C.tip]))) { hasNorm = true; break; }
    var skip = {}; C.cant.forEach(function (c) { skip[c] = 1; }); if (C.um >= 0) skip[C.um] = 1; if (C.pret >= 0) skip[C.pret] = 1;
    st.noUm = C.um < 0 && !C.asSum;
    /* coloană fără nume, în stânga denumirii, plină de numere de ordine = „Nr.” */
    if (C.nr < 0 && C.extL && C.extL.length) { var ec = C.extL[C.extL.length - 1], ni = 0, nt = 0; for (r = C.r + 1; r < Math.min(g.length, C.r + 80); r++) { var ev = (g[r] || [])[ec]; if (ev === "" || ev == null) continue; nt++; if (isNum(ev)) ni++; } if (nt >= 3 && ni / nt >= 0.5) { C.nr = ec; T.cols.nr = ec; } }
    for (r = C.r + 1; r < g.length; r++) {
      row = g[r] || []; if (!row.length) continue;
      if (hasNorm && !/^norm/.test(strip(row[C.tip]))) continue;
      var den = joinDen(row, C.denRev ? [0] : C.den, C.short, C.ext, C.extL);
      if (C.denRev) den = clean(lastVal(row, C.denRev, false));
      var qv = C.cant.length > 1 ? lastVal(row, C.cant, true) : row[C.cant[0]], qty = isNum(qv) ? num(qv) : 0;
      var umv = C.umRev ? lastVal(row, C.umRev, false) : (C.um >= 0 ? row[C.um] : ""), nrv = C.nr >= 0 ? row[C.nr] : "";
      if (den && C.r >= 0 && strip(den) === strip(joinDen(hrow, C.den, C.short, C.ext, C.extL)) && !qty) continue;      // capul de tabel repetat
      if (qty > 0 && !den) { var tc = txtCells(row, skip); tc.sort(function (a, b) { return b.t.length - a.t.length; }); if (tc.length) den = tc[0].t; }
      if (den && isTotal(den, qty > 0 && !C.asSum)) continue;
      if (qty > 0 && den && hasLetters(den, 2)) {
        var cod = C.cod >= 0 ? clean(row[C.cod]) : "", m = !cod && SYM.exec(den);
        if (m) { cod = m[1]; den = den.slice(m[0].length); }
        var pret = C.pret >= 0 && isNum(row[C.pret]) ? num(row[C.pret]) : 0;
        T.items.push(C.asSum ? { nr: clean(nrv), cod: "", den: den, um: "buc", cant: 1, pret: r6(qty), cap0: "", sheet: name, row: r + 1 } : { nr: clean(nrv), cod: cod, den: den, um: C.um >= 0 || C.umRev ? normUm(umv) : guessUm(den), cant: r6(qty), pret: pret > 0 ? r6(pret) : 0, cap0: "", sheet: name, row: r + 1 });
        pend.push(T.items.length - 1);
        continue;
      }
      /* rând fără cantitate: capitol, rând de descriere sau poziție cu cantitatea zero */
      var cells = txtCells(row, null), one = cells.length ? cells.slice().sort(function (a, b) { return b.t.length - a.t.length; })[0].t : "";
      var text = den || one; if (!text) continue;
      if (den && (clean(umv) || (qv !== "" && qv != null && isNum(qv)))) { if (isUmTok(umv) || (isNum(qv))) { st.zero++; continue; } }
      var ci = capInfo(text, nrv);
      if (!ci) continue;
      var alone = cells.length <= 2 && !row.some(function (v, i) { return isNum(v) && num(v) !== 0 && i !== C.nr; });
      if (!alone) continue;
      pend.push({ ci: ci, at: T.items.length }); if (ci.strong) strongSeen = true;
    }
    /* capitolele „slabe” (titluri scrise normal) se iau doar dacă lista nu are capitole clare */
    var cur = caps;
    pend.forEach(function (p) { if (typeof p === "number") T.items[p].cap0 = cur.get(); else if (p.ci.strong || !strongSeen) cur.set(p.ci); });
    return finish(T, st);
  }
  function stackedRows(g, T, st, C, name) {
    var caps = Caps(T.title, name), r, row, cur = null, typeCol = -1, w = 0, c;
    for (r = C.hEnd + 1; r < Math.min(g.length, C.hEnd + 60); r++) w = Math.max(w, (g[r] || []).length);
    if (C.pc >= 0) for (c = Math.min(w - 1, C.pc + 3); c > C.pc; c--) {     // coloana cu felul rândului (1 = materiale, 2 = manoperă … 5 = total)
      var ok = 0, bad = 0; for (r = C.hEnd + 1; r < Math.min(g.length, C.hEnd + 80); r++) { var v = (g[r] || [])[c]; if (v === "" || v == null) continue; if (isNum(v) && num(v) >= 1 && num(v) <= 5 && num(v) % 1 === 0) ok++; else bad++; }
      if (ok >= 3 && bad <= 1) { typeCol = c; break; }
    }
    var close = function () { if (cur && cur.den && hasLetters(cur.den, 2)) { delete cur._k; delete cur._x; T.items.push(cur); } cur = null; };
    var SPR = /^sp\.? ?(mat|man|uti|tra)|^\d+([.,]\d+)? ?%$/i, LABR = /^(obiect|obiectul|categorie|categoria|capitol|capitolul|subcapitol|stadiu|stadiul|deviz|devizul)\b/i;
    for (r = C.hEnd + 1; r < g.length; r++) {
      row = g[r] || []; var qty = isNum(row[C.cc]) ? num(row[C.cc]) : 0, head = clean(row[C.dc]);
      var txt = [], lim = C.pc >= 0 ? C.pc : row.length;
      for (c = 0; c < lim; c++) if (typeof row[c] === "string" && hasLetters(row[c], 3) && c !== C.um && !SPR.test(clean(row[c]))) txt.push(clean(row[c]));
      txt.sort(function (a, b) { return b.length - a.length; });
      var hasPrice = C.pc >= 0 && isNum(row[C.pc]);
      /* sfârșitul listei: recapitulația cu „Cheltuieli directe”, „Total general” nu mai are poziții */
      var marks3 = [C.nr >= 0 ? row[C.nr] : "", head].concat(txt).map(function (v) { return strip(clean(v)); });
      if (marks3.some(function (v) { return /^(cheltuieli (directe|indirecte)|total cheltuieli|total chelt|total general|recapitula)/.test(v); })) { close(); break; }
      if (qty > 0 && marks3.some(function (v) { return /^(total\b|subtotal|din care|- ?vut|alte cheltuieli)/.test(v); })) { close(); continue; }
      if (qty > 0 && (head || (C.nr >= 0 && clean(row[C.nr])))) {
        close();
        var umv = C.um >= 0 ? row[C.um] : "", code = head, name1 = "";
        if (hasLetters(head, 3) && head.indexOf(" ") > 0 && !/^[A-Z0-9+.^\-]+\s+\d{1,3}$/.test(head) && head.length > 14) { name1 = head; code = ""; }   // denumirea e chiar pe rândul cu cantitatea
        cur = { nr: C.nr >= 0 ? clean(row[C.nr]) : "", cod: code.replace(/\s+\d{1,3}$/, ""), den: name1, um: normUm(umv), cant: r6(qty), pret: 0, cap0: caps.get(), sheet: name, row: r + 1, _k: 0, _x: 0 };
        continue;
      }
      if (cur) {
        cur._k++;
        if (txt.length && LABR.test(txt[0]) && !hasPrice) { var ci = capInfo(txt[0], ""); close(); if (ci) caps.set(ci); else caps.set({ title: txt[0], lvl: 1, strong: true, generic: false }); continue; }
        if (!cur.den && txt.length && cur._k <= 4) cur.den = txt[0];
        else if (cur.den && txt.length && !hasPrice && cur._x < 2 && !isTotal(txt[0], false) && cur.den.length < 300) { cur.den += " – " + txt[0]; cur._x++; }   // rândurile de descriere de sub denumire
        if (hasPrice && C.manLine > 0 && !cur.pret && (typeCol >= 0 ? num(row[typeCol]) === 2 : cur._k === 1)) cur.pret = r6(num(row[C.pc]));
        continue;
      }
      if (txt.length) { var ci2 = capInfo(txt[0], C.nr >= 0 ? row[C.nr] : ""); if (ci2 && !isTotal(txt[0], false)) caps.set(ci2); }
    }
    close();
    T.cols.cod = C.dc; T.cols.den = C.dc; T.cols.pret = C.manLine > 0 ? C.pc : -1; st.unitPrice = st.unitPrice && !(C.manLine > 0); st.noUm = C.um < 0;
    return finish(T, st);
  }

  /* ---------- foi de calcul ---------- */
  function gridOf(X, ws) {
    if (!ws || !ws["!ref"]) return null;
    var rg = X.utils.decode_range(ws["!ref"]); rg.s.r = 0; rg.s.c = 0; if (rg.e.r > 30000) rg.e.r = 30000; if (rg.e.c > 80) rg.e.c = 80;
    return X.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: true, range: rg });
  }
  var ECH = /^(echipamente|utilaje|dotari|f4)\b/, ECHT = /^(formular(ul)? f4|lista cu cantitatile de utilaje)/, CENT = /^(centraliz|recapitul|f1\b|f2\b|sumar|rezumat|grafic)/;
  function readBook(X, u8, name, kind) {
    var res = { name: name, kind: kind, tables: [], notes: [] }, wb;
    try { wb = X.read(u8, { type: "array", cellDates: false, cellStyles: false, cellHTML: false, cellFormula: false }); }
    catch (e) { res.notes.push(/password|encrypt/i.test(String(e && e.message)) ? "Fișierul are parolă. Salvează-l fără parolă și încearcă din nou." : "Nu am putut citi fișierul (pare stricat sau nu e un tabel Excel)."); return res; }
    wb.SheetNames.forEach(function (n) {
      var g; try { g = gridOf(X, wb.Sheets[n]); } catch (e) { g = null; }
      if (!g) return;
      var T; try { T = analyze(g, wb.Sheets[n]["!merges"] || [], n); } catch (e) { T = newTable(n); T.why = "Nu am putut citi această foaie."; }
      if (ECH.test(strip(n)) || ECHT.test(strip(T.title))) { T.echip = true; T.skip = true; T.hint = "echipamente"; }
      else if (CENT.test(strip(n)) || /^(formular(ul)? f[12]\b|centralizator)/.test(strip(T.title))) { T.skip = true; T.hint = "centralizator"; }
      res.tables.push(T);
    });
    if (!res.tables.length) res.notes.push("Fișierul nu are nicio foaie cu date.");
    else if (!res.tables.some(function (t) { return t.ok; })) res.notes.push("Nu am găsit în fișier nicio listă cu denumire și cantitate.");
    return res;
  }

  /* ---------- text: CSV, tabel lipit, rânduri scrise liber ---------- */
  function decode(u8) {
    if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder("utf-16le").decode(u8);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(u8).replace(/^﻿/, ""); } catch (e) { }
    try { return new TextDecoder("windows-1250").decode(u8); } catch (e) { }
    var s = ""; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s;
  }
  function splitCsv(line, d) {
    var out = [], cur = "", q = false, i, ch;
    for (i = 0; i < line.length; i++) {
      ch = line.charAt(i);
      if (q) { if (ch === '"') { if (line.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"' && !cur) q = true; else if (ch === d) { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur); return out;
  }
  function gridFromText(text, comma) {
    var lines = String(text).replace(/\r\n?/g, "\n").split("\n"), ne = lines.filter(function (l) { return l.trim(); }), best = "", bs = 0;
    if (ne.length < 2) return null;
    (comma ? ["\t", ";", "|", ","] : ["\t", ";", "|"]).forEach(function (d) {
      var n = 0, min = d === "\t" ? 1 : 2; ne.forEach(function (l) { if (splitCsv(l, d).length > min) n++; });
      var sc = n / ne.length; if (sc >= 0.6 && sc > bs) { bs = sc; best = d; }
    });
    if (!best) return null;
    return lines.map(function (l) { return splitCsv(l, best).map(function (c) { c = c.trim(); if (best === "|") c = c.replace(/^\|+|\|+$/g, ""); return isNum(c) && /\d/.test(c) && !/^0\d/.test(c) ? num(c) : c; }); });
  }
  var UW = /^(buc|bucati|bucata|ml|m|metri|metru|mp|m2|m²|mc|m3|kg|set|seturi|punct|puncte|ore|ora|ans|zile|zi|pereche|perechi)$/;
  var DIMPRE = /^(dn|de|d|ø|φ|pn|ppr|pp-r|pex|pe-x|pexa|pe-xa|pehd|pvc|pp|tip|nr|nr\.|model|cod)$/, DIMSUF = /^(mm|cm|kw|w|btu|l|litri|bar|toli|tol|v|elementi|elemente|cai|grade|atm|gpm)$/;
  var SEP = /^(la|x|×|\*|@|cu|=|per|cate|câte|:)$/;
  /** Un rând scris liber: „12 calorifere la 230”, „pardoseală 190 mp x 68 lei”, „montaj centrala 1150”, „4 băi 1800”. */
  /* începutul unui mesaj copiat din WhatsApp: „[14.11.2026, 09:12] Nume: ” sau „14.11.2026, 09:12 - Nume: ” */
  var CHATPRE = /^[\u200e\u200f\s]*\[?\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–]?\s*[^:\d]{1,40}:\s*/;
  function parseLine(s) {
    var raw = clean(String(s == null ? "" : s).replace(CHATPRE, "")); if (!raw) return null;
    var t = raw.replace(/^[\s\-–—•*·>]+/, "").replace(/^\d{1,3}[.)]\s+(?=\D)/, "").replace(/\s+a\s+c[aâ]te\s+/gi, " la ");
    /* scrieri întâlnite în ofertele vechi: „RON 47.300, 00”, „baie:1000lei”, „tavan -1000lei”, „(centrală)-6000lei” */
    t = t.replace(/(\d\.\d{3}),\s+(\d{2})(?!\d)/g, "$1,$2").replace(/(^|\s)(ron|lei)\s+(\d[\d.,]*\d|\d)(?=\s|$)/gi, "$1$3 lei").replace(/([^\s\d])\s*[:=]\s*(\d)/g, "$1 : $2").replace(/([\s)])[-–](\d)/g, "$1 $2").replace(/([)\]])(\d)/g, "$1 $2");
    t = t.replace(/([^\s\d])(=)(\d)/g, "$1 = $3").replace(/(\d)\s*(?:×|\*)\s*(\d)/g, "$1 x $2").replace(/(^|\s)(x|×)(\d)/gi, "$1x $3").replace(/(\d)(x|×)(\s|$)/gi, "$1 x$3");
    var tk = [], i, parts = t.split(" ");
    for (i = 0; i < parts.length; i++) {
      var p = parts[i], m = /^(\d[\d.,]*?)(lei|ron|euro|eur|€|buc|bucati|ml|mp|m2|m²|mc|kg|m)((?:\/|\+)[^\s]*)?[.,;]?$/i.exec(p);
      if (m && /\d$/.test(m[1])) { tk.push(m[1]); tk.push(m[2] + (m[3] || "")); } else tk.push(p);
    }
    var T = tk.map(function (w, ix) {
      var b = w.replace(/[,;:]+$/, ""), l = strip(b);
      if (/^\d{1,3}(\.\d{3})+(,\d+)?$|^\d+([.,]\d+)?k?$/i.test(b)) return { k: "N", v: num(b), w: w };
      if (/^(lei|ron|leu|euro|eur|€|tva|\+tva|\+|fara|plus|net|brut)$/.test(l) || /^\+?tva$/.test(l)) return { k: "M", w: w };
      if (/^(lei|ron)?\/(buc|bucata|ml|m|mp|m2|kg|set|ora|punct|baie)\.?$/.test(l) || /^(lei|ron)\/(.+)$/.test(l) || l === "bucata" && ix > 0 && /^(pe|per|\/)$/.test(strip(tk[ix - 1]))) return { k: "M", per: 1, w: w };
      if (/^(total|totul|totalul)$/.test(l)) return { k: "M", tot: 1, w: w };
      if (UW.test(l.replace(/\.$/, ""))) return { k: "U", u: normUm(l), w: w };
      if (SEP.test(l) || w === ":") return { k: "S", w: w };
      return { k: "W", w: w, l: l };
    });
    /* numere care țin de denumire: diametre, puteri, „ppr 25”, „dn 50”, „24 kw” */
    T.forEach(function (x, ix) {
      if (x.k !== "N") return;
      var pv = T[ix - 1], nx = T[ix + 1];
      if (nx && nx.k === "W" && DIMSUF.test(nx.l)) x.dim = 1;
      else if (pv && pv.k === "W" && DIMPRE.test(pv.l) && !(nx && nx.k === "U")) x.dim = 1;
    });
    /* despărțitoarele contează doar lângă un număr */
    T.forEach(function (x, ix) { if (x.k === "S") { var pv = T[ix - 1], nx = T[ix + 1]; if (!((nx && nx.k === "N") || (pv && pv.k === "N" && /^(x|×|\*)$/i.test(x.w)))) { x.k = "W"; x.l = strip(x.w); } } });
    var per = T.some(function (x) { return x.per; }), tot = T.some(function (x) { return x.tot; });
    var qi = -1, pi = -1, um = "buc", sepUsed = false, F;
    for (i = 0; i < T.length - 1; i++) if (T[i].k === "N" && T[i + 1].k === "U") { qi = i; um = T[i + 1].u; T[i + 1].used = 1; break; }
    if (qi >= 0) {
      for (i = qi + 2; i < T.length; i++) { if (T[i].k === "N" && !T[i].dim) { pi = i; break; } }
      if (pi < 0) for (i = qi - 1; i >= 1; i--) if (T[i].k === "N" && !T[i].dim && T[i - 1].k === "S") { pi = i; break; }
      sepUsed = true;
    } else {
      F = []; T.forEach(function (x, ix) { if (x.k === "N" && !x.dim) F.push(ix); });
      if (F.length === 1) {
        var only = F[0], nxt = T[only + 1];
        if (only === 0 && !(nxt && nxt.k === "M" && !nxt.per)) qi = only; else pi = only;
      } else if (F.length >= 2) {
        pi = F[F.length - 1];
        for (i = 0; i < F.length - 1; i++) { var a = F[i], bx = T[a + 1]; if (bx && bx.k === "S") { qi = a; sepUsed = true; break; } }
        if (qi < 0 && T[pi - 1] && T[pi - 1].k === "S") { sepUsed = true; qi = F[0] === 0 ? F[0] : F[F.length - 2]; }
        if (qi < 0) qi = F[0] === 0 ? F[0] : F[F.length - 2];
      }
    }
    /* „160 lei mp”, „70 lei pe ml”: preț pe unitate, fără cantitate */
    if (qi < 0 && pi >= 0) { var j = pi + 1; while (T[j] && (T[j].k === "M" || /^(pe|per|\/)$/.test(strip(T[j].w)))) { T[j].used = 1; j++; } if (j > pi + 1 && T[j] && T[j].k === "U" && !T[j].used) { um = T[j].u; T[j].used = 1; } }
    var cant = qi >= 0 ? T[qi].v : 1, pret = pi >= 0 ? T[pi].v : 0;
    if (!(cant > 0)) cant = 1;
    if (tot && pret && cant) pret = r6(pret / cant);
    var den = T.filter(function (x, ix) { return ix !== qi && ix !== pi && !x.used && x.k !== "M" && !(x.k === "S" && (ix === pi - 1 || ix === qi + 1 || ix === qi - 1 || ix === pi + 1)); }).map(function (x) { return x.w; }).join(" ");
    den = clean(den.replace(/^[\s\-–—:=,.;]+|[\s\-–—:=,;]+$/g, "").replace(/\s+(la|x|cu|per|pe)$/i, ""));
    if (!hasLetters(den, 2)) return null;
    return { den: den, cant: r6(cant), um: um, pret: r6(pret), amb: !!(qi >= 0 && pi >= 0 && cant > 1 && !sepUsed && !per && !tot), raw: raw };
  }
  /* într-un document (Word, fișier text) sunt și rânduri care nu țin de listă: antetul firmei, CUI, IBAN, e-mail, clauze de contract */
  var IDLINE = /^(ro)?\s?\d{6,10}$|^j\s?\d{1,2}\/|\biban\b|@|^(tel|telefon|mobil|fax|c\.?u\.?i|cif|cod fiscal|nr\.? ?reg|capital social|cont|banca)\b/;
  var LEGAL = /\b(contract|contractul|contractului|contractante|articolul|sediul|reprezentat|reprezentata|denumit|denumita|in calitate de|se obliga|obligatii|obligatiile|prezentul|prezenta|partile|litigii|forta majora|penalitati|conform art|art\.)\b/;
  var PRICEONLY = /^[:=\-–\s]*(\d[\d.,\s]*)\s*(lei|ron|euro|eur|€)?\s*(\/\s*\w+)?\.?$/i;
  function parseLines(text, opt) {
    var doc = !!(opt && opt.doc), out = [], cap = "", prev = "", cand = 0, lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
    lines.forEach(function (ln, ix) {
      var t = clean(String(ln).replace(CHATPRE, "")); if (!t) return;
      if (doc) {
        var st0 = strip(t);
        if (IDLINE.test(st0)) { prev = ""; return; }
        t = clean(t.replace(/\b\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}\b/g, " "));                      // datele nu sunt cantități
        if (!t) return;
        if (isTotal(t, false)) { prev = ""; return; }
        if (/\d/.test(t)) cand++;
        if (t.length > 140 || t.split(" ").length > 18 || LEGAL.test(st0)) { prev = ""; return; }
      }
      var hasN = /\d/.test(t), bullet = /^[\-–—•*·]|^\d{1,3}[.)]\s/.test(t);
      if (!hasN) {
        if (/:$/.test(t) || (capsRatio(t) >= 0.8 && t.length <= 60)) { cap = t.replace(/\s*:$/, ""); prev = doc ? cap : ""; return; }
        if (doc) { if (t.length <= 70 && !/[.!?]$/.test(t)) { cap = t.replace(/^[\-–—•*·\s]+/, ""); prev = cap; } else prev = ""; return; }   // rând fără număr: titlu de grup, nu lucrare
        if (!bullet && (t.length > 60 || /[.!?]$/.test(t) || /^(buna|bună|salut|multumesc|mulțumesc|mersi|va rog|vă rog|cu stima|cu stimă|o zi|ok|da|nu|servus|hello)\b/i.test(t))) return;
      }
      /* prețul scris pe rândul următor („Montaj automatizare …” / „:800 lei”) */
      var po = doc && prev ? PRICEONLY.exec(t) : null;
      if (po && num(po[1]) > 0) { out.push({ den: prev, cant: 1, um: "buc", pret: r6(num(po[1])), amb: false, raw: prev + " " + t, cap: out.length ? out[out.length - 1].cap : "", line: ix + 1, eur: /euro|eur|€/i.test(t) }); cap = out.length > 1 ? out[out.length - 2].cap : ""; prev = ""; return; }
      var p = parseLine(t); prev = ""; if (!p) return;
      if (doc && (!(p.pret > 0 || p.cant !== 1) || p.pret >= 1e7 || !hasLetters(p.den, 3))) return;        // în document: doar rândurile cu un preț sau o cantitate
      p.cap = cap; p.line = ix + 1; if (/\d\s*(euro|eur|€)/i.test(t)) p.eur = true; out.push(p);
    });
    out.cand = cand;
    return out;
  }
  function readText(text, name, opt) {
    var res = { name: name || "Text lipit", kind: "text", tables: [], notes: [] }, g, T;
    /* o conversație salvată (WhatsApp) nu e o listă: nu o iau ca atare */
    var ls0 = String(text || "").split(/\r?\n/).filter(function (x) { return x.trim(); }), chat = 0;
    ls0.forEach(function (x) { if (/^[\u200e\u200f\s]*\[?\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4},?\s+\d{1,2}:\d{2}(:\d{2})?\]?\s*[-–]?\s*[^:]{1,40}:/.test(x)) chat++; });
    if (chat >= 5 && chat >= 0.05 * ls0.length) {
      T = newTable("Text"); T.why = "E o conversație, nu o listă."; res.tables.push(T);
      res.notes.push("Fișierul e o conversație salvată (de pe WhatsApp), nu o listă. Copiază din ea doar rândurile cu lucrări și lipește-le la „Lipește sau scrie”.");
      return res;
    }
    g = gridFromText(text, false);
    if (g) { try { T = analyze(g, [], "Text lipit"); } catch (e) { T = null; } if (T && T.ok) { res.tables.push(T); return res; } }
    T = newTable("Text lipit"); T.kind = "randuri";
    var PL = parseLines(text, opt);
    /* document: îl iau doar dacă seamănă a listă (cel puțin două rânduri cu preț sau cantitate și măcar o treime din rândurile cu numere) */
    if (opt && opt.doc && !((PL.length >= 2 && PL.length >= 0.34 * (PL.cand || 0)) || (PL.length === 1 && PL[0].pret > 0 && (PL.cand || 0) <= 2))) PL = [];
    if (PL.some(function (p) { return p.eur; })) T.warn.push("Unele prețuri din text sunt în euro. Le-am adus ca număr: schimbă-le în lei.");
    PL.forEach(function (p) { T.items.push({ nr: "", cod: "", den: p.den, um: p.um, cant: p.cant, pret: p.pret, cap0: p.cap || "", sheet: "Text lipit", row: p.line, amb: p.amb, raw: p.raw }); });
    var na = T.items.filter(function (i) { return i.amb; }).length;
    if (na) T.warn.push(na === 1 ? "La un rând nu e clar dacă suma e pe bucată sau în total." : "La " + na + " rânduri nu e clar dacă suma e pe bucată sau în total.");
    finish(T, null); if (!T.ok) T.why = "Nu am găsit rânduri cu o lucrare și un număr.";
    res.tables.push(T);
    if (!T.ok) res.notes.push("Nu am înțeles niciun rând din text. Scrie câte o lucrare pe rând, de exemplu „12 calorifere la 230”.");
    return res;
  }

  /* ---------- Word (.docx): tabelele și paragrafele din document ---------- */
  function xmlText(s) { return s.replace(/<w:tab\b[^>]*\/>/g, "\t").replace(/<w:br\b[^>]*\/>/g, " ").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }
  function readDocx(X, u8, name) {
    var res = { name: name, kind: "docx", tables: [], notes: [] }, xml = "";
    try { var cfb = X.CFB.read(u8, { type: "array" }), f = X.CFB.find(cfb, "word/document.xml") || X.CFB.find(cfb, "/word/document.xml"); xml = f ? decode(f.content instanceof Uint8Array ? f.content : new Uint8Array(f.content)) : ""; } catch (e) { xml = ""; }
    if (!xml) { res.notes.push("Nu am putut citi documentul Word. Salvează-l ca PDF sau ca Excel și încearcă din nou."); return res; }
    var body = xml, n = 0, tbl = /<w:tbl>[\s\S]*?<\/w:tbl>/g, m, rest = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, "\n");
    while ((m = tbl.exec(body))) {
      var g = [], rows = m[0].match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
      rows.forEach(function (tr) {
        var cells = tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [], row = [];
        cells.forEach(function (tc) {
          var t = clean((tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(xmlText).join(" ")), span = /<w:gridSpan w:val="(\d+)"/.exec(tc);
          row.push(isNum(t) && !/^0\d/.test(t) ? num(t) : t); for (var k = 1; span && k < +span[1]; k++) row.push("");
        });
        g.push(row);
      });
      n++; var T; try { T = analyze(g, [], "Tabelul " + n); } catch (e) { T = newTable("Tabelul " + n); }
      if (T.ok || g.length > 2) res.tables.push(T);
    }
    if (!res.tables.some(function (t) { return t.ok; })) {
      var paras = (rest.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(function (p) { return clean(xmlText(p).replace(/\t/g, " ")); }).filter(Boolean);
      var R = readText(paras.join("\n"), name, { doc: true }), T2 = R.tables[0];
      if (T2 && T2.ok) { T2.name = "Textul documentului"; res.tables.push(T2); }
    }
    if (!res.tables.some(function (t) { return t.ok; })) res.notes.push("Nu am găsit în document nicio listă cu denumire și cantitate.");
    return res;
  }

  /* ---------- PDF cu text ---------- */
  function segClean(t) { return clean(t).replace(/\s+([,.;:)])/g, "$1").replace(/\(\s+/g, "("); }
  function segsOf(items) {                           // bucățile de text ale unei pagini, lipite pe rând și despărțite la golurile mari
    var its = [], i;
    for (i = 0; i < items.length; i++) { var it = items[i]; if (!it.str) continue; its.push({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: it.height || Math.abs(it.transform[3]) || 0, sp: !it.str.trim() }); }
    var lines = [];
    its.forEach(function (it) {
      if (it.sp && !it.w) return;
      var Ln = null; for (var k = lines.length - 1; k >= 0 && k >= lines.length - 40; k--) if (Math.abs(lines[k].y - it.y) <= Math.max(1.6, 0.3 * (lines[k].h || 6))) { Ln = lines[k]; break; }
      if (!Ln) { Ln = { y: it.y, h: 0, its: [] }; lines.push(Ln); }
      Ln.its.push(it); if (!it.sp) Ln.h = Math.max(Ln.h, it.h);
    });
    var segs = [];
    lines.forEach(function (Ln) {
      Ln.its.sort(function (a, b) { return a.x - b.x; });
      var cur = null, h = Ln.h || 6, big = Math.max(5, 0.95 * h);
      Ln.its.forEach(function (it) {
        if (it.sp) { if (cur) { if (it.w > big) cur = null; else if (!/ $/.test(cur.t)) cur.t += " "; } return; }
        var gap = cur ? it.x - cur.x1 : 0;
        if (!cur || gap > big) { cur = { t: it.s, x0: it.x, x1: it.x + it.w, y: Ln.y, h: h }; segs.push(cur); return; }
        var sp = gap > 0.16 * h || (/[A-Za-zÀ-ɏ]$/.test(cur.t) && /^\d/.test(it.s) && gap > -0.5);
        if (gap > 1.5) (cur.ps = cur.ps || []).push({ x: it.x, xe: cur.x1, i: cur.t.length });
        cur.t += (sp && !/ $/.test(cur.t) ? " " : "") + it.s; cur.x1 = Math.max(cur.x1, it.x + it.w);
      });
    });
    segs.forEach(function (s) { if (s.ps) s.raw = s.t; s.t = segClean(s.t); });
    return segs.filter(function (s) { return s.t; });
  }
  var FOOT = /^(pag(ina|\.)?\s*\d+(\s*(din|\/)\s*\d+)?|\d+\s*\/\s*\d+|-\s*\d+\s*-|\d{1,3})$/i;
  var F3HEAD = /^(observatii|corectii|liste anexe|denumire resursa|simbol|capitol lucrari|[a-d]\) ?(materiale?|manopera|utilaje?|transport)|total ?\(a\+b\+c\+d\)|nr|crt|nr crt|u\/m|um|cantitatea|pretul unitar|valoare|\[ ?ron ?\])$/;
  function pdfF3(pages, T, st, hp, bandOf, labs) {
    var lab = {}; labs.near.forEach(function (s) { var k = labKind(hnorm(s.t)); if (k && !lab[k]) lab[k] = s; });
    if (!lab.cant || !lab.um) return null;
    var pl = lab.unit || lab.man || lab.sum, xQ0 = lab.um.x1 + 12, xQ1 = pl ? pl.x0 + 2 : 1e9, lines = [];
    pages.forEach(function (pg, ix) {
      if (ix < hp) return;
      var b = ix === hp ? labs : bandOf(pg.segs), by = {}, loY = 1e9, hiY = -1e9;
      pg.segs.forEach(function (s) { if (s.y < loY) loY = s.y; if (s.y > hiY) hiY = s.y; });
      pg.segs.forEach(function (s) {
        if (b && s.y >= b.bottom) return;
        if (b && s.y > b.bottom - 110 && F3HEAD.test(strip(s.t).replace(/\.+$/, "").replace(/\s+/g, " "))) return;      // restul capului de tabel, scris pe mai multe rânduri
        if (FOOT.test(s.t) && (!/^\d{1,3}$/.test(s.t) || s.y - loY < 3 || hiY - s.y < 3)) return;
        var k = Math.round(s.y / 2); (by[k] = by[k] || { p: ix, y: s.y, segs: [] }).segs.push(s);
      });
      Object.keys(by).map(function (k) { return by[k]; }).sort(function (x, y) { return y.y - x.y; }).forEach(function (L) { L.segs.sort(function (x, y) { return x.x0 - y.x0; }); lines.push(L); });
    });
    var rowOf = function (L) {
      var s0 = L.segs[0]; if (!s0 || L.segs.length < 3 || !/^\d{1,4}$/.test(s0.t) || (lab.nr && s0.x0 > lab.nr.x1 + 20)) return null;
      var q = null; L.segs.forEach(function (s) { var c = (s.x0 + s.x1) / 2; if (!q && s !== s0 && isNum(s.t) && s.x0 >= xQ0 && c < xQ1) q = s; });
      if (!q) return null;
      var um = L.segs.filter(function (s) { return s.x0 >= lab.um.x0 - 8 && s.x1 < q.x0 && !isNum(s.t); }).map(function (s) { return s.t; }).join(" ");
      var cod = L.segs[1] && L.segs[1].x1 < lab.um.x0 && !isNum(L.segs[1].t) ? L.segs[1].t : "";
      return { nr: s0.t, cod: cod, um: um, q: num(q.t) };
    };
    var cur = null, n = 0, add = function (t, into) { into.t = into.t ? (/-$/.test(into.t) ? into.t + t : into.t + " " + t) : t; };
    var flush = function () {
      if (!cur) return;
      var den = clean(cur.a.t + (cur.b.t ? (cur.a.t ? " – " : "") + cur.b.t : "")) || cur.cod; n++;
      if (!(cur.q > 0)) { st.zero++; cur = null; return; }
      if (hasLetters(den, 2)) T.items.push({ nr: cur.nr, cod: cur.cod, den: den, um: cur.um ? normUm(cur.um) : guessUm(den), cant: r6(cur.q), pret: 0, cap0: T.title, sheet: T.name, row: (cur.p + 1) * 1000 + n });
      cur = null;
    };
    var hs = pages[hp].segs.filter(function (s) { return s.y > labs.bottom; }), cat = "", ob = "";
    hs.forEach(function (s) { var m = /^(categorie|categoria|obiect|obiectul)\s*:\s*(.{3,})$/i.exec(s.t); if (m) { if (/^cat/i.test(m[1])) cat = m[2]; else ob = m[2]; } });
    T.title = clean((cat || ob).replace(/^\d{1,3}\s+/, "")).slice(0, 90);
    lines.forEach(function (L) {
      var R = rowOf(L);
      if (R) { flush(); cur = { nr: R.nr, cod: R.cod, um: R.um, q: R.q, p: L.p, a: { t: "" }, b: { t: "" }, tot: false, end: false }; return; }
      if (!cur || cur.end) return;
      var nums = 0, txt = [];
      L.segs.forEach(function (s) { if (isNum(s.t)) { nums++; return; } if (/^sp\.\s?(mat|man|uti|tra)/i.test(s.t)) return; var u = s.t; if (/^asimilat\b/i.test(u)) { cur.tot = true; u = u.replace(/^asimilat\b\s*/i, ""); if (!u) return; } txt.push(u); });
      var t = clean(txt.join(" "));
      if (!t) { if (nums >= 2 && (cur.a.t || cur.b.t)) cur.tot = true; return; }
      if (isTotal(t, false) || /^(recapitula|cheltuieli|din care|greutate)/.test(strip(t))) { cur.end = true; return; }
      if (nums >= 2) cur.tot = true;
      add(t, cur.tot ? cur.b : cur.a);
    });
    flush();
    if (!T.items.length) return null;
    T.headerRow = 1; T.cols = { nr: 0, cod: 1, den: 1, um: 2, cant: 3, pret: -1 }; T.f3 = true;
    T.warn.push("Formular F3: prețurile din fișier sunt cu material cu tot, nu le-am luat. Pui tu prețul de manoperă.");
    return finish(T, st);
  }
  function pdfTable(pages, name) {
    var T = newTable(pages.length > 1 ? "Paginile 1–" + pages.length : "Pagina 1"), st = { zero: 0 }, p, i;
    /* două titluri de coloană lipite într-o singură bucată („CANTITATI Pret/U.M”): le despart */
    pages.forEach(function (pg) {
      var add = [];
      pg.segs.forEach(function (s) {
        if (!s.ps || !s.raw || s.t.length > 60) return;
        for (var q = 0; q < s.ps.length; q++) {
          var lt = segClean(s.raw.slice(0, s.ps[q].i)), rt = segClean(s.raw.slice(s.ps[q].i)), k1 = labKind(hnorm(lt)), k2 = labKind(hnorm(rt));
          if (k1 && k2 && k1 !== k2 && !(/^den/.test(k1) && /^den/.test(k2))) { add.push({ t: rt, x0: s.ps[q].x, x1: s.x1, y: s.y, h: s.h }); s.t = lt; s.x1 = s.ps[q].xe; s.ps = null; s.raw = null; break; }
        }
      });
      add.forEach(function (s) { pg.segs.push(s); });
    });
    /* capul de tabel: unde apare „Cantitate” */
    var hp = -1, labs = null;
    var bandOf = function (segs) {
      var cs = segs.filter(function (s) { return labKind(hnorm(s.t)) === "cant"; });
      for (var a = 0; a < cs.length; a++) {
        var near = segs.filter(function (s) { return Math.abs(s.y - cs[a].y) <= 26 && labKind(hnorm(s.t)); });
        var kinds = {}; near.forEach(function (s) { kinds[labKind(hnorm(s.t))] = 1; });
        if (kinds.den1 || kinds.den2) {
          var lo = Math.min.apply(null, near.map(function (s) { return s.y; })), hh = cs[a].h || 6, bottom = lo - Math.max(9, 1.7 * hh);
          /* primul rând de date e uneori lipit de capul de tabel: dacă imediat sub titluri e un rând cu numere, e deja din listă */
          var first = segs.filter(function (s) { return s.y > bottom && s.y < lo - 0.7 * hh; }), fy = -1e9;
          first.forEach(function (s) { if (isNum(s.t) && first.filter(function (o) { return Math.abs(o.y - s.y) < 2; }).length >= 3 && s.y > fy) fy = s.y; });
          if (fy > -1e9) bottom = fy + 0.45 * hh;
          return { near: near, bottom: bottom, top: Math.max.apply(null, near.map(function (s) { return s.y; })) + 2 * hh };
        }
      }
      return null;
    };
    for (p = 0; p < Math.min(pages.length, 4) && hp < 0; p++) { labs = bandOf(pages[p].segs); if (labs) hp = p; }
    if (hp < 0) return pdfLines(pages, T, st);
    /* formularul F3 scos din programul de devize: rândul cu simbol, UM și cantitate, iar denumirea e scrisă dedesubt, pe toată lățimea */
    if (pages[hp].segs.some(function (s) { return /^a\)\s*material/i.test(s.t); }) && pages[hp].segs.some(function (s) { return /^b\)\s*manoper/i.test(s.t); })) {
      var R3 = pdfF3(pages, T, st, hp, bandOf, labs); if (R3) return R3;
    }
    /* datele: tot ce e sub capul de tabel (pe fiecare pagină, sub capul repetat, dacă există) */
    var data = [], above = [];
    pages.forEach(function (pg, ix) {
      var b = ix === hp ? labs : (ix > hp ? bandOf(pg.segs) : null), loY = 1e9, hiY = -1e9;
      pg.segs.forEach(function (s) { if (s.y < loY) loY = s.y; if (s.y > hiY) hiY = s.y; });
      pg.segs.forEach(function (s) {
        if (ix < hp) return;
        if (b && s.y >= b.bottom) { if (ix === hp && s.y > b.top) above.push(s); return; }
        /* un număr singur e număr de pagină doar dacă stă singur pe primul sau pe ultimul rând al paginii; altfel poate fi o cantitate */
        if (FOOT.test(s.t) && (!/^\d{1,3}$/.test(s.t) || ((s.y - loY < 3 || hiY - s.y < 3) && !pg.segs.some(function (o) { return o !== s && Math.abs(o.y - s.y) < 3; })))) return;
        s.p = ix; data.push(s);
      });
    });
    T.title = (above.filter(function (s) { return s.t.length > 6 && hasLetters(s.t, 4) && !GENT.test(strip(s.t)) && !/:\s*$/.test(s.t) && !SKIPT.test(strip(s.t)); }).sort(function (a, b) { return b.y - a.y; })[0] || above.sort(function (a, b) { return b.y - a.y; })[0] || { t: "" }).t.slice(0, 90);
    /* coloanele: întâi din rândurile cu mai multe celule (acolo golurile dintre coloane se văd clar),
       apoi din textul rămas între ele (de ex. o coloană de descriere scrisă pe mai multe rânduri) */
    var W = 0; data.forEach(function (s) { W = Math.max(W, s.x1); }); W = Math.ceil(W) + 2;
    var lineOf = {}; data.forEach(function (s) { var k = s.p + ":" + Math.round(s.y / 1.6); (lineOf[k] = lineOf[k] || []).push(s); });
    var multi = [], single = []; Object.keys(lineOf).forEach(function (k) { (lineOf[k].length >= 3 ? multi : single).push(lineOf[k]); });
    if (multi.length < 3) { multi = multi.concat(single); single = []; }
    var runs = function (list, thr) {
      var cov = new Array(W + 2).fill(0), out = [], run = null, x;
      list.forEach(function (s) { for (var x2 = Math.max(0, Math.floor(s.x0)); x2 <= Math.min(W, Math.ceil(s.x1)); x2++) cov[x2]++; });
      for (x = 0; x <= W; x++) { if (cov[x] >= thr) { if (!run) { run = { a: x, b: x }; out.push(run); } run.b = x; } else run = null; }
      for (var q = out.length - 1; q > 0; q--) if (out[q].a - out[q - 1].b < 2.5) { out[q - 1].b = out[q].b; out.splice(q, 1); }
      return out;
    };
    var flatM = [].concat.apply([], multi), colsX = runs(flatM, Math.max(2, Math.round(multi.length * 0.04)));
    var ovl = function (s, c) { return Math.min(s.x1, c.b) - Math.max(s.x0, c.a); };
    var gapSegs = [];
    single.forEach(function (ln) { ln.forEach(function (s) { var hit = colsX.filter(function (c) { return ovl(s, c) > 1.5; }); if (!hit.length) gapSegs.push(s); else if (hit.length > 1) s.span = 1; }); });
    if (gapSegs.length >= 3) { runs(gapSegs, 2).forEach(function (c) { if (!colsX.some(function (o) { return Math.min(o.b, c.b) - Math.max(o.a, c.a) > 1.5; })) colsX.push(c); }); colsX.sort(function (a, b) { return a.a - b.a; }); }
    var colAt = function (s) { if (s.span) return -1; var best = -1, bo = 0.5; colsX.forEach(function (c, ix) { var o = ovl(s, c); if (o > bo) { bo = o; best = ix; } }); return best; };
    var colNear = function (s) { var best = colAt({ x0: s.x0, x1: s.x1 }), bd = 1e9; if (best >= 0) return best; colsX.forEach(function (c, ix) { var d = Math.abs((c.a + c.b) / 2 - (s.x0 + s.x1) / 2); if (d < bd) { bd = d; best = ix; } }); return best; };
    var kindOf = {};
    var labSeg = {};
    labs.near.forEach(function (s) { var k = labKind(hnorm(s.t)), ci = colNear(s); if (ci < 0) return; if (k === "den1" || k === "den2") { (kindOf.den = kindOf.den || []); if (kindOf.den.indexOf(ci) < 0) kindOf.den.push(ci); } else if (kindOf[k] == null) { kindOf[k] = ci; labSeg[k] = s; } else if (k === "unit" && kindOf.sum == null && ci > kindOf.unit) { kindOf.sum = ci; labSeg.sum = s; } });
    /* două titluri puse unul lângă altul (nu unul sub altul) care cad pe aceeași coloană */
    var side = function (k1, k2) { var s1 = labSeg[k1], s2 = labSeg[k2]; return kindOf[k1] != null && kindOf[k1] === kindOf[k2] && s1 && s2 && (s1.x1 < s2.x0 - 2 || s2.x1 < s1.x0 - 2); };
    /* când golurile dintre coloane nu se văd (numere aliniate la dreapta, coloane goale), mai multe titluri cad pe aceeași coloană:
       atunci împart pagina după locul titlurilor din capul de tabel */
    var clash = kindOf.cant != null && (kindOf.um === kindOf.cant || kindOf.man === kindOf.cant || kindOf.unit === kindOf.cant || kindOf.sum === kindOf.cant || (kindOf.den && kindOf.den.indexOf(kindOf.cant) >= 0) || (kindOf.nr != null && kindOf.den && kindOf.den.indexOf(kindOf.nr) >= 0) || side("unit", "sum") || side("unit", "man") || side("unit", "um") || side("man", "sum"));
    if (clash) {
      var LB = []; labs.near.forEach(function (s) { var k = labKind(hnorm(s.t)); if (!k) return; var c = (s.x0 + s.x1) / 2; if (LB.some(function (o) { return Math.abs(o.c - c) < 6; })) return; LB.push({ k: k, c: c }); });
      LB.sort(function (x, y) { return x.c - y.c; });
      if (LB.length >= 3) {
        /* marginea dintre două coloane: la jumătatea dintre titluri; dacă acolo e text, o mut în golul cel mai apropiat */
        var cov = new Array(W + 4).fill(0); data.forEach(function (s) { for (var x2 = Math.max(0, Math.floor(s.x0)); x2 <= Math.min(W + 2, Math.ceil(s.x1)); x2++) cov[x2]++; });
        var cuts = []; for (var ib = 0; ib < LB.length - 1; ib++) {
          var c0 = LB[ib].c, c1 = LB[ib + 1].c, mid = (c0 + c1) / 2, mn = 1e9, bx = -1, x3;
          for (x3 = Math.ceil(c0) + 1; x3 < Math.floor(c1); x3++) if (cov[x3] < mn) mn = cov[x3];
          if (cov[Math.round(mid)] > mn) { for (x3 = Math.ceil(c0) + 1; x3 < Math.floor(c1); x3++) if (cov[x3] === mn && (bx < 0 || Math.abs(x3 - mid) < Math.abs(bx - mid))) bx = x3; }
          cuts.push(bx >= 0 ? bx : mid);
        }
        colsX = LB.map(function (l, ix) { return { a: ix ? cuts[ix - 1] : -1, b: ix < LB.length - 1 ? cuts[ix] : W + 2 }; });
        for (var id = 0; id < LB.length - 1; id++) if (/^den/.test(LB[id].k) && /^den/.test(LB[id + 1].k)) {
          var cut = cuts[id], add = [];
          data.forEach(function (s) {
            if (!s.ps || !s.raw || s.x0 > cut - 6 || s.x1 < cut + 6) return;
            var pp = null; s.ps.forEach(function (q) { if (!pp && q.x >= cut - 3 && q.x <= cut + 10 && q.xe <= cut + 3) pp = q; });
            if (!pp) return;
            var lt = segClean(s.raw.slice(0, pp.i)), rt = segClean(s.raw.slice(pp.i)); if (!lt || !rt) return;
            add.push({ t: rt, x0: pp.x, x1: s.x1, y: s.y, h: s.h, p: s.p }); s.t = lt; s.x1 = pp.xe; s.ps = null;
          });
          add.forEach(function (s) { data.push(s); });
        }
        data.forEach(function (s) { delete s.span; });
        colAt = function (s) { var best = -1, bo = 0; for (var q = 0; q < colsX.length; q++) { var o = Math.min(s.x1, colsX[q].b) - Math.max(s.x0, colsX[q].a); if (o > bo) { bo = o; best = q; } } return best; };
        kindOf = {}; LB.forEach(function (l, ix) { if (l.k === "den1" || l.k === "den2") (kindOf.den = kindOf.den || []).push(ix); else if (kindOf[l.k] == null) kindOf[l.k] = ix; else if (l.k === "unit" && kindOf.sum == null) kindOf.sum = ix; });
      }
    }
    if (kindOf.cant == null || !kindOf.den) return pdfLines(pages, T, st);
    kindOf.den = kindOf.den.filter(function (c) { return c !== kindOf.cant && c !== kindOf.um; }).sort(function (a, b) { return a - b; });
    if (!kindOf.den.length) return pdfLines(pages, T, st);
    var byCol = colsX.map(function () { return []; }), spans = []; data.forEach(function (s) { var ci = colAt(s); s.c = ci; if (ci >= 0) byCol[ci].push(s); else spans.push(s); });
    /* capul de tabel zice „U.M | Cantitate”, dar dedesubt sunt puse invers: mă iau după ce conțin */
    if (kindOf.um != null && kindOf.um !== kindOf.cant) {
      var cu = byCol[kindOf.um], cq = byCol[kindOf.cant], nu = cu.filter(function (s) { return isNum(s.t); }).length, tq = cq.filter(function (s) { return isUmTok(s.t); }).length;
      if (cu.length >= 3 && cq.length >= 3 && nu >= 0.6 * cu.length && tq >= 0.6 * cq.length) { var sw = kindOf.um; kindOf.um = kindOf.cant; kindOf.cant = sw; T.warn.push("În fișier, coloanele „UM” și „Cantitate” sunt puse invers față de capul de tabel. Le-am citit după ce conțin."); }
    }
    /* fiecare număr din coloana de cantitate e un rând */
    var qv = function (t) { var u = String(t).replace(/[,.]$/, ""); return isNum(u) ? num(u) : 0; };   // „1,” = 1 (zecimalele tăiate la tipărire)
    var anchors = byCol[kindOf.cant].filter(function (s) { return qv(s.t) > 0; }).map(function (s) { return { p: s.p, y: s.y, h: s.h, q: qv(s.t), cells: {} }; });
    /* rândul cu numerele coloanelor („0 1 2 3 4 5=3x4”) nu e o poziție */
    anchors = anchors.filter(function (a) {
      var ln = data.filter(function (s) { return s.p === a.p && Math.abs(s.y - a.y) < 2.5; });
      return !(ln.length >= 4 && ln.every(function (s) { return /^\d{1,2}(\s*[=x*+\-]\s*\d{1,2}){0,3}$/i.test(s.t); }));
    });
    anchors.sort(function (a, b) { return a.p - b.p || b.y - a.y; });
    if (!anchors.length) return pdfLines(pages, T, st);
    var orphans = spans.slice();
    /* un titlu de capitol scris cu litere mari („G. HIDRANȚI INTERIORI”), fără cantitate pe rândul lui, nu ține de poziția de lângă el */
    var HEADA = /^\s*(?:[A-Z][.)]|[IVX]{1,4}[.)])\s+(.+)$/, HEADB = /^\s*cap(?:itol(?:ul)?)?\.?\s*[\dIVX]{1,4}\b[.:)]?\s*(.+)$/i;
    var headSeg = function (s, A) {
      var m = HEADA.exec(s.t), ok = m && hasLetters(m[1], 4) && capsRatio(m[1]) >= 0.8;
      if (!ok) { m = HEADB.exec(s.t); ok = m && hasLetters(m[1], 4) && s.t.length <= 90; }
      if (!ok || isTotal(s.t, false)) return false;
      var tol = 0.8 * (s.h || 6); return !A.some(function (a) { return Math.abs(a.y - s.y) <= tol; });
    };
    /* un rând cu număr („1.3”, „1.3.1”) dar fără cantitate e un titlu de capitol, nu începutul poziției de sub el */
    var headY = {}, NRH = /^(?:\d{1,3}(?:\.\d{1,3}){0,4}\.?|[A-Z]\.?|[IVX]{1,4}\.?)$/, nearY = function (s, y) { return Math.abs(y - s.y) <= 0.8 * (s.h || 6); };
    if (kindOf.nr != null && kindOf.den.indexOf(kindOf.nr) < 0 && kindOf.nr !== kindOf.cant) {
      var nrAll = 0, nrNo = []; byCol[kindOf.nr].forEach(function (s) { if (!NRH.test(s.t)) return; nrAll++; if (!anchors.some(function (a) { return a.p === s.p && nearY(s, a.y); })) nrNo.push(s); });
      if (nrNo.length && nrNo.length <= 0.5 * nrAll) nrNo.forEach(function (s) { s.hd = 1; (headY[s.p] = headY[s.p] || []).push(s.y); });
    }
    var groups = [], denList = []; byCol.forEach(function (list, ci) { if (kindOf.den.indexOf(ci) >= 0) denList = denList.concat(list); else groups.push({ list: list, ci: ci, den: false }); });
    groups.unshift({ list: denList, ci: kindOf.den[0], den: true });
    groups.forEach(function (G) {
      var list = G.list, ci = G.ci; G.work = [];
      if (ci === kindOf.cant) { list.forEach(function (s) { if (!(qv(s.t) > 0) && hasLetters(s.t, 3)) orphans.push(s); }); return; }
      var perPage = {}; list.forEach(function (s) { (perPage[s.p] = perPage[s.p] || []).push(s); });
      Object.keys(perPage).forEach(function (pp) {
        var A = anchors.filter(function (a) { return a.p === +pp; });
        var L2 = perPage[pp].filter(function (s) {
          var hd = s.hd || (G.den && (headSeg(s, A) || ((headY[pp] || []).some(function (y) { return nearY(s, y); }) && !A.some(function (a) { return nearY(s, a.y); }))));
          if (hd) { orphans.push(s); return false; } return true;
        }).sort(function (a, b) { return b.y - a.y || a.x0 - b.x0; });
        if (!L2.length) return;
        var gaps = []; for (var k = 1; k < L2.length; k++) { var d = L2[k - 1].y - L2[k].y; if (d > 0.5 && d < 2.4 * (L2[k].h || 6)) gaps.push(d); }
        gaps.sort(function (a, b) { return a - b; }); var pitch = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 1.25 * (L2[0].h || 6);
        var blocks = [], cur = null;
        L2.forEach(function (s) { if (!cur || cur.lo - s.y > 1.7 * pitch) { cur = { hi: s.y, lo: s.y, segs: [] }; blocks.push(cur); } cur.segs.push(s); cur.lo = s.y; });
        blocks.forEach(function (b) { b.tol = 0.8 * (b.segs[0].h || 6); b.inside = A.filter(function (a) { return a.y <= b.hi + b.tol && a.y >= b.lo - b.tol; }); });
        G.work.push({ A: A, pitch: pitch, blocks: blocks });
      });
    });
    /* cum stă textul pe mai multe rânduri față de rândul cu cantitatea: de la el în jos (aliniat sus), de la el în sus (aliniat jos) sau în jurul lui (centrat) */
    var nAbove = 0, nBelow = 0, nExtra = 0;
    groups[0].work.forEach(function (w) { w.blocks.forEach(function (b) {
      if (!b.inside.length) return; var ys = b.inside.map(function (a) { return a.y; }), top = Math.max.apply(null, ys), bot = Math.min.apply(null, ys), ab = b.hi > top + b.tol, be = b.lo < bot - b.tol;
      if (ab || be) nExtra++; if (ab) nAbove++; if (be) nBelow++;
    }); });
    var topAl = nExtra >= 3 && nAbove === 0, botAl = nExtra >= 3 && nBelow === 0;
    groups.forEach(function (G) {
      G.work.forEach(function (w) {
        var A = w.A, pitch = w.pitch;
        w.blocks.forEach(function (b) {
          var inside = b.inside;
          if (!inside.length) {
            /* descrierea scrisă sub rândul cu cantitatea (în coloana ei, goală pe rândul acela) ține de rândul de deasupra */
            var btxt = b.segs.map(function (s) { return s.t; }).join(" "), bci = capInfo(btxt, ""), up = null;
            if (G.den && !(bci && bci.strong) && !isTotal(btxt, false)) A.forEach(function (a) { if (a.y > b.hi && a.y - b.hi < 7 * pitch && (!up || a.y < up.y)) up = a; });
            if (up && !b.segs.some(function (s) { return up.cells[s.c] && up.cells[s.c].length; })) { b.segs.forEach(function (s) { (up.cells[s.c] = up.cells[s.c] || []).push(s); }); return; }
            b.segs.forEach(function (s) { orphans.push(s); }); return;
          }
          var put = function (a, s) { (a.cells[s.c] = a.cells[s.c] || []).push(s); };
          if (inside.length === 1) { b.segs.forEach(function (s) { put(inside[0], s); }); return; }
          /* mai multe poziții lipite una de alta: textul de pe rândul cantității e al ei; rândurile dintre două cantități se împart la golul cel mai mare dintre ele */
          var ins = inside.slice().sort(function (x, y) { return y.y - x.y; }), free = [], lo = ins.map(function (a) { return a.y; }), hi = lo.slice();
          b.segs.forEach(function (s) {
            var at = -1, bd = 1e9; ins.forEach(function (a, j) { var d = Math.abs(a.y - s.y); if (d <= b.tol && d < bd) { bd = d; at = j; } });
            if (at < 0) { free.push(s); return; }
            put(ins[at], s); if (s.y < lo[at]) lo[at] = s.y; if (s.y > hi[at]) hi[at] = s.y;
          });
          var cutY = {};
          free.forEach(function (s) {
            var j = -1; for (var q = 0; q < ins.length - 1; q++) if (s.y < ins[q].y && s.y > ins[q + 1].y) { j = q; break; }
            if (j < 0) { put(s.y > ins[0].y ? ins[0] : ins[ins.length - 1], s); return; }
            if (cutY[j] == null) {
              var ys = []; free.forEach(function (o) { if (o.y < ins[j].y && o.y > ins[j + 1].y && !ys.some(function (y) { return Math.abs(y - o.y) < 1.5; })) ys.push(o.y); });
              ys.sort(function (x, y) { return y - x; });
              var ch = [lo[j]].concat(ys, [hi[j + 1]]), g1 = -1, g2 = -1, gi = 0;
              for (var q2 = 0; q2 < ch.length - 1; q2++) { var g = ch[q2] - ch[q2 + 1]; if (g > g1) { g2 = g1; g1 = g; gi = q2; } else if (g > g2) g2 = g; }
              if (g1 >= 1.12 * g2 && g1 > 0) cutY[j] = (ch[gi] + ch[gi + 1]) / 2;                    // deasupra golului: poziția de sus; sub el: poziția de jos
              else cutY[j] = topAl ? ins[j + 1].y - 1e6 : botAl ? ins[j].y + 1e6 : (ins[j].y + ins[j + 1].y) / 2 - 0.01;
            }
            put(s.y > cutY[j] ? ins[j] : ins[j + 1], s);
          });
        });
      });
    });
    /* rândurile fără cantitate: capitole */
    var marks = []; var oLines = {};
    orphans.forEach(function (s) { var k = s.p + ":" + Math.round(s.y / 2); (oLines[k] = oLines[k] || { p: s.p, y: s.y, segs: [] }).segs.push(s); });
    Object.keys(oLines).forEach(function (k) { var o = oLines[k]; o.segs.sort(function (a, b) { return a.x0 - b.x0; }); var t = o.segs.map(function (s) { return s.t; }).join(" "), ci = capInfo(t, ""); if (ci && ci.strong && !isTotal(t, false)) marks.push({ p: o.p, y: o.y, ci: ci }); });
    marks.sort(function (a, b) { return a.p - b.p || b.y - a.y; });
    var caps = Caps(T.title, name), mi = 0, cellText = function (a, ci) { return (a.cells[ci] || []).sort(function (x, y) { return y.y - x.y || x.x0 - y.x0; }).map(function (s) { return s.t; }).join(" "); };
    var manCol = kindOf.man != null ? kindOf.man : (kindOf.unit != null && kindOf.val == null ? kindOf.unit : -1);
    var hband = pages[hp].segs.filter(function (s) { return s.y >= labs.bottom && s.y <= labs.top; }).map(function (s) { return strip(s.t); });
    if (manCol >= 0 && hband.some(function (t) { return /^(euro|eur|€)$/.test(t) || /\((euro|eur|€)\)|\beuro$/.test(t); }) && !hband.some(function (t) { return /^(ron|lei)$/.test(t) || /\((ron|lei)\)|\b(ron|lei)$/.test(t); })) { st.euro = true; manCol = -1; }
    st.unitPrice = kindOf.man == null && manCol >= 0; st.hint = above.map(function (s) { return s.t; }).join(" ").slice(0, 600);
    anchors.forEach(function (a, ix) {
      while (mi < marks.length && (marks[mi].p < a.p || (marks[mi].p === a.p && marks[mi].y > a.y))) { caps.set(marks[mi].ci); mi++; }
      var parts = kindOf.den.map(function (ci) { return clean(cellText(a, ci)); }).filter(Boolean), den = parts[0] || "";
      for (var k = 1; k < parts.length; k++) if (strip(parts[k]).indexOf(strip(den)) !== 0) den += " – " + parts[k]; else den = parts[k];
      if (!hasLetters(den, 2)) return;
      if (isTotal(den, true)) return;
      var cod = kindOf.cod != null ? clean(cellText(a, kindOf.cod)) : "", m = !cod && SYM.exec(den); if (m) { cod = m[1]; den = den.slice(m[0].length); }
      var pr = 0; if (manCol >= 0) { var ps = (a.cells[manCol] || []).filter(function (s) { return isNum(s.t); }); if (ps.length === 1) pr = num(ps[0].t); }
      /* prețul e uneori afișat rotunjit (1,13 în loc de 1,125): dacă valoarea rândului arată altceva, iau prețul din valoare */
      if (pr > 0 && kindOf.sum != null && a.q > 0) { var vs = (a.cells[kindOf.sum] || []).filter(function (s) { return isNum(s.t); }), vv = vs.length === 1 ? num(vs[0].t) : 0, pe = vv / a.q; if (vv > 0 && Math.abs(a.q * pr - vv) > 0.006 && Math.abs(pe - pr) <= 0.00501 + 1e-9) pr = pe; }
      var nrT = ""; if (kindOf.nr != null) { var ns = (a.cells[kindOf.nr] || []).filter(function (s) { return NRH.test(s.t); }).sort(function (x, y) { return Math.abs(x.y - a.y) - Math.abs(y.y - a.y); }); nrT = ns.length ? ns[0].t : clean(cellText(a, kindOf.nr)).slice(0, 20); }
      T.items.push({ nr: nrT, cod: cod, den: den, um: (kindOf.um != null && clean(cellText(a, kindOf.um))) ? normUm(clean(cellText(a, kindOf.um)).split(" ")[0]) : guessUm(den), cant: r6(a.q), pret: pr > 0 ? r6(pr) : 0, cap0: caps.get(), sheet: T.name, row: (a.p + 1) * 1000 + ix + 1 });
    });
    /* numărul curent lipit de denumire („2 Brățări 40”): îl scot din denumire */
    var lead = T.items.map(function (i) { return /^(\d{1,4})[.)]?\s+(?=\S)/.exec(i.den); }), nl = lead.filter(Boolean).length, inc = 0;
    for (var li = 1; li < lead.length; li++) if (lead[li] && lead[li - 1] && +lead[li][1] > +lead[li - 1][1]) inc++;
    if (T.items.length >= 3 && nl >= 0.8 * T.items.length && inc >= 0.7 * (T.items.length - 1)) T.items.forEach(function (i, ix) { if (lead[ix] && hasLetters(i.den.slice(lead[ix][0].length), 2)) { if (!i.nr) i.nr = lead[ix][1]; i.den = i.den.slice(lead[ix][0].length); } });
    T.headerRow = 1; T.cols = { nr: kindOf.nr != null ? kindOf.nr : -1, cod: kindOf.cod != null ? kindOf.cod : -1, den: kindOf.den[0], um: kindOf.um != null ? kindOf.um : -1, cant: kindOf.cant, pret: manCol };
    st.noUm = kindOf.um == null;
    return finish(T, st);
  }
  /* PDF fără cap de tabel recunoscut: rând cu rând, „denumire … UM cantitate” */
  var LNUM = "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)", LUM = "(buc|bucati|bucata|ml|m|mp|m2|mc|m3|kg|set|ans|punct|ore|to)\\.?";
  var LRE1 = new RegExp("^(?:(\\d{1,4})[.)]?\\s+)?(.{4,}?)\\s+" + LUM + "\\s+" + LNUM + "(?:\\s+" + LNUM + ")?(?:\\s+" + LNUM + ")?\\s*$", "i");
  var LRE2 = new RegExp("^(?:(\\d{1,4})[.)]?\\s+)?(.{4,}?)\\s+" + LNUM + "\\s+" + LUM + "(?:\\s+" + LNUM + ")?(?:\\s+" + LNUM + ")?\\s*$", "i");
  function pdfLines(pages, T, st) {
    var caps = Caps("", T.name), n = 0, loose = [], lines0 = 0;
    pages.forEach(function (pg, pi) {
      var pl0 = loose.length, pt0 = 0;
      var by = {}; pg.segs.forEach(function (s) { var k = Math.round(s.y / 2.2); (by[k] = by[k] || { y: s.y, segs: [] }).segs.push(s); });
      Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.y - a.y; }).forEach(function (ln) {
        ln.segs.sort(function (a, b) { return a.x0 - b.x0; });
        var t = clean(ln.segs.map(function (s) { return s.t; }).join(" ")); n++;
        if (!t || FOOT.test(t)) return;
        if (hasLetters(t, 3)) pt0++;
        var m = LRE1.exec(t), q, u, den, nr;
        if (m) { nr = m[1] || ""; den = m[2]; u = m[3]; q = num(m[4]); }
        else if ((m = LRE2.exec(t))) { nr = m[1] || ""; den = m[2]; q = num(m[3]); u = m[4]; }
        if (m && q > 0 && hasLetters(den, 3) && !isTotal(den, true)) { T.items.push({ nr: nr, cod: "", den: clean(den), um: normUm(u), cant: r6(q), pret: 0, cap0: caps.get(), sheet: T.name, row: (pi + 1) * 1000 + n }); return; }
        var lastS = ln.segs[ln.segs.length - 1];
        if (ln.segs.length >= 2 && /^\d{1,6}([.,]\d{1,2})?$/.test(clean(lastS.t))) {            // „Țeavă 50x500 ......... 15”: numărul stă singur, în dreapta
          var d2 = clean(ln.segs.slice(0, -1).map(function (s) { return s.t; }).join(" ")).replace(/^\d{1,3}[.)]\s+/, ""), q2 = num(lastS.t);
          if (q2 > 0 && hasLetters(d2, 3) && !/[:?]$/.test(d2) && !isTotal(d2, true) && !FOOT.test(d2)) { loose.push({ nr: "", cod: "", den: d2, um: guessUm(d2), cant: r6(q2), pret: 0, cap0: caps.get(), sheet: T.name, row: (pi + 1) * 1000 + n }); return; }
        }
        if (!/\d\s*$/.test(t)) { var ci = capInfo(t, ""); if (ci && ci.strong && !isTotal(t, false)) caps.set(ci); }
      });
      /* pe o planșă sau într-un act, rândurile „text … număr” sunt puține printre altele: acolo nu le iau */
      if (loose.length - pl0 < Math.max(3, pt0 * 0.5)) loose.length = pl0;
    });
    /* rândurile „denumire … număr” se iau doar dacă sunt destule ca să fie o listă (nu o planșă cu cote) */
    if (loose.length >= 4 && loose.length >= T.items.length) { T.items = T.items.concat(loose).sort(function (a, b) { return a.row - b.row; }); T.free = true; T.warn.push("Lista nu are unități de măsură: am pus „ml” la țevi și izolații și „buc” la rest. Verifică."); }
    if (!T.items.length) T.why = "Nu am găsit în PDF un tabel cu denumire și cantitate.";
    return finish(T, st);
  }
  function readPdf(P, u8, name) {
    var res = { name: name, kind: "pdf", tables: [], notes: [] };
    return P.getDocument({ data: new Uint8Array(u8), disableFontFace: true, isEvalSupported: false, useSystemFonts: false, stopAtErrors: false, verbosity: 0 }).promise.then(function (doc) {
      var pages = [], chars = 0, np = Math.min(doc.numPages, 300), chain = Promise.resolve();
      for (var p = 1; p <= np; p++) (function (pn) { chain = chain.then(function () { return doc.getPage(pn); }).then(function (pg) { return pg.getTextContent(); }).then(function (tc) { var s = segsOf(tc.items); s.forEach(function (x) { chars += x.t.length; }); pages.push({ segs: s }); }); })(p);
      return chain.then(function () {
        try { if (doc.destroy) doc.destroy(); } catch (e) { }
        if (chars < 40) { var T0 = newTable("Pagina 1"); T0.why = "PDF-ul nu are text (e o scanare sau o poză)."; res.tables.push(T0); res.notes.push("Fișierul e o scanare: nu are text. Cere lista în Excel sau într-un PDF făcut din calculator."); return res; }
        var T; try { T = pdfTable(pages, name); } catch (e) { T = newTable("Pagina 1"); T.why = "Nu am putut citi tabelul din PDF."; }
        res.tables.push(T);
        if (doc.numPages > np) res.notes.push("PDF-ul are " + doc.numPages + " pagini; am citit primele " + np + ".");
        if (!T.ok) res.notes.push("Nu am găsit în PDF o listă cu denumire și cantitate.");
        return res;
      });
    }, function (e) {
      res.notes.push(/password/i.test(String(e && (e.name + " " + e.message))) ? "PDF-ul are parolă. Salvează-l fără parolă și încearcă din nou." : "Nu am putut citi PDF-ul (pare stricat).");
      return res;
    });
  }

  /* ---------- biblioteci la nevoie ---------- */
  var ME = (typeof document !== "undefined" && document.currentScript && document.currentScript.src) || "";
  function vend() { if (root.SCV && root.SCV.base) return root.SCV.base + "lib/vendor/"; try { return new URL("../lib/vendor/", ME || location.href).href; } catch (e) { return "../lib/vendor/"; } }
  var loading = {};
  function load(file) {
    var src = vend() + file;
    if (root.SCV && root.SCV.loadScript) return root.SCV.loadScript(src);
    if (!loading[src]) loading[src] = new Promise(function (ok, no) { var s = document.createElement("script"); s.src = src; s.onload = function () { ok(); }; s.onerror = function () { delete loading[src]; no(new Error("Nu am putut încărca " + file)); }; document.head.appendChild(s); });
    return loading[src];
  }
  function need(k) {
    if (k === "xlsx") { if (L.XLSX) return Promise.resolve(L.XLSX); if (root.XLSX) return Promise.resolve(root.XLSX); return load("xlsx.full.min.js").then(function () { return root.XLSX; }); }
    if (L.pdfjsLib) return Promise.resolve(L.pdfjsLib);
    var got = function () { var P = root.pdfjsLib || root["pdfjs-dist/build/pdf"]; if (P && P.GlobalWorkerOptions && !P.GlobalWorkerOptions.workerSrc) P.GlobalWorkerOptions.workerSrc = vend() + "pdf.worker.min.js"; return P; };
    if (root.pdfjsLib) return Promise.resolve(got());
    return load("pdf.min.js").then(got);
  }
  function bytes(file) {
    if (file && file.data) return Promise.resolve(file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data));
    if (file && file.arrayBuffer) return file.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (ok, no) { var fr = new FileReader(); fr.onload = function () { ok(new Uint8Array(fr.result)); }; fr.onerror = function () { no(fr.error); }; fr.readAsArrayBuffer(file); });
  }
  var NOLIB = "Nu am putut încărca modulul de citire. Verifică internetul și încearcă din nou.";
  /** Citește un fișier și întoarce tabelele găsite. Nu aruncă erori: ce nu merge apare în notes, pe românește. */
  function readFile(file) {
    var name = (file && file.name) || "fișier", ext = (/\.([a-z0-9]+)$/i.exec(name) || [0, ""])[1].toLowerCase();
    var fail = function (kind, msg) { return { name: name, kind: kind, tables: [], notes: [msg] }; };
    return bytes(file).then(function (u8) {
      var pk = u8[0] === 0x50 && u8[1] === 0x4b, ole = u8[0] === 0xd0 && u8[1] === 0xcf, pdf = u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46;
      if (!u8.length) return fail("text", "Fișierul e gol.");
      if (pdf || ext === "pdf") return need("pdf").then(function (P) { return readPdf(P, u8, name); }, function () { return fail("pdf", NOLIB); });
      if (/^(jpe?g|png|heic|heif|gif|webp|bmp|tiff?)$/.test(ext)) return fail("text", "E o poză. Nu pot citi poze: cere lista în Excel sau PDF, ori scrie rândurile de mână.");
      if (ext === "doc" || (ole && ext !== "xls" && ext !== "xlt")) return ext === "doc" ? fail("docx", "E un document Word vechi (.doc). Deschide-l și salvează-l ca PDF sau .docx, apoi încearcă din nou.") : need("xlsx").then(function (X) { return readBook(X, u8, name, "xls"); }, function () { return fail("xls", NOLIB); });
      if (ext === "docx" || ext === "docm") return need("xlsx").then(function (X) { return readDocx(X, u8, name); }, function () { return fail("docx", NOLIB); });
      if (ext === "csv" || ext === "tsv" || (ext === "txt" && !pk && !ole)) {
        var text = decode(u8), g = gridFromText(text, ext !== "txt");
        if (ext === "txt" || !g) { var R = readText(text, name, { doc: true }); R.kind = ext === "txt" ? "text" : "csv"; return R; }
        var res = { name: name, kind: "csv", tables: [], notes: [] }, T; try { T = analyze(g, [], name.replace(/\.[a-z0-9]+$/i, "")); } catch (e) { T = newTable(name); T.why = "Nu am putut citi fișierul."; }
        res.tables.push(T); if (!T.ok) res.notes.push("Nu am găsit în fișier o listă cu denumire și cantitate."); return res;
      }
      if (pk || ole || /^(xlsx|xlsm|xlsb|xls|xlt|ods|fods|numbers)$/.test(ext)) {
        var kind = ext === "xls" || ext === "xlt" || ole ? "xls" : ext === "ods" || ext === "fods" ? "ods" : "xlsx";
        return need("xlsx").then(function (X) { if (pk && !/^(xlsx|xlsm|xlsb|ods|numbers)$/.test(ext)) { try { var cf = X.CFB.read(u8, { type: "array" }); if (X.CFB.find(cf, "word/document.xml")) return readDocx(X, u8, name); } catch (e) { } } return readBook(X, u8, name, kind); }, function () { return fail(kind, NOLIB); });
      }
      var R2 = readText(decode(u8), name); if (!R2.tables.some(function (t) { return t.ok; })) R2.notes = ["Nu cunosc acest fel de fișier. Merg: Excel (.xlsx, .xls), .ods, .csv, PDF cu text, Word (.docx) și text lipit."]; return R2;
    }).catch(function (e) { return fail(ext || "text", "Nu am putut citi fișierul."); });
  }

  var api = { readFile: readFile, readText: readText, parseLine: parseLine, parseLines: parseLines, num: num, normUm: normUm, libs: function (o) { for (var k in o) L[k] = o[k]; return api; }, _analyze: analyze, _segs: segsOf, _pdfTable: pdfTable };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.IMP = api;
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : this);

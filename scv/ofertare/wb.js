/* Ofertare SCV – „prețurile înapoi în fișierul clientului”.
   Primești o listă de cantități în Excel, pui prețurile în aplicație, iar aici ele sunt scrise în ACELAȘI fișier:
   doar în căsuțele de preț (și, dacă lista nu avea coloană de preț, în două coloane adăugate la dreapta).
   Fișierul .xlsx/.xlsm nu e „redesenat”: îl desfac (e o arhivă zip), schimb numai căsuțele respective din foaia cu pricina
   și îl închid la loc. Culorile, chenarele, formulele, celulele unite, validările, desenele și celelalte foi rămân neatinse.
   Pentru .xls/.ods/.csv/PDF nu se poate lucra pe loc: fac un .xlsx nou, curat, cu aceleași rânduri.
   Folosit în browser (window.WB) și în Node, la probe (module.exports). */
(function (root) {
  "use strict";
  const L = {};
  const libs = o => { Object.assign(L, o || {}); return api; };
  const MSG_ZIP = "Nu am putut încărca modulul pentru fișiere Excel. Verifică internetul și încearcă din nou.";
  async function needZip() {
    if (L.JSZip) return L.JSZip;
    if (root.JSZip) return (L.JSZip = root.JSZip);
    if (root.SCV && root.SCV.loadScript) { try { await root.SCV.loadScript(root.SCV.base + "lib/vendor/jszip.min.js"); } catch (e) { throw new Error(MSG_ZIP); } if (root.JSZip) return (L.JSZip = root.JSZip); }
    throw new Error(MSG_ZIP);
  }
  async function needXl() {
    if (L.ExcelJS) return L.ExcelJS;
    if (root.ExcelJS) return (L.ExcelJS = root.ExcelJS);
    if (root.SCV && root.SCV.needXl) { await root.SCV.needXl(); if (root.ExcelJS) return (L.ExcelJS = root.ExcelJS); }
    throw new Error(MSG_ZIP);
  }

  /* ---------- unelte mici ---------- */
  const colL = i => { let s = ""; i = i + 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; };   // 0 → A, 26 → AA
  const colI = s => { let n = 0; for (let k = 0; k < s.length; k++) n = n * 26 + (s.charCodeAt(k) - 64); return n - 1; };                                   // A → 0
  const xe = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const xu = s => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");
  const attr = (s, n) => { const m = new RegExp("(?:^|\\s)" + n + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')").exec(s || ""); return m ? (m[1] != null ? m[1] : m[2]) : null; };
  const setAttr = (s, n, v) => { const re = new RegExp("(^|\\s)" + n + "\\s*=\\s*(?:\"[^\"]*\"|'[^']*')"); return re.test(s) ? s.replace(re, (m, a) => a + n + '="' + v + '"') : s + " " + n + '="' + v + '"'; };
  const delAttr = (s, n) => s.replace(new RegExp("\\s+" + n + "\\s*=\\s*(?:\"[^\"]*\"|'[^']*')"), "");
  const numS = v => { const n = Math.round((+v || 0) * 1e4) / 1e4; return String(n); };                       // cel mult 4 zecimale, fără scriere cu „e”
  const r2 = v => Math.round((+v || 0) * 100) / 100;
  const bytes = d => d instanceof Uint8Array ? d : new Uint8Array(d || 0);
  const extOf = n => { const m = /\.([a-z0-9]+)$/i.exec(n || ""); return m ? m[1].toLowerCase() : ""; };
  const baseOf = n => String(n || "lista").replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]+$/i, "");
  const NF = { createFolders: false };                             // în arhivă nu adaug dosare care nu erau
  const refOf = r => { const m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(r || ""); return m ? { c: colI(m[1]), r: +m[2] } : null; };

  /* ---------- unde scriu prețurile ---------- */
  /** table = tabelul dat de cititor (IMP): {cols:{nr,cod,den,um,cant,pret}, headerRow, items}. opts: {priceCol, totalCol, maxCol (ultima coloană folosită în foaie, de la 0)}. */
  function plan(table, opts) {
    opts = opts || {}; const c = (table && table.cols) || {};
    const has = v => typeof v === "number" && v >= 0;
    if (has(opts.priceCol)) {
      const t = has(opts.totalCol) ? opts.totalCol : -1;
      return { priceCol: opts.priceCol, totalCol: t, newCols: !!opts.newCols, header: { priceTitle: opts.priceTitle || "Preț manoperă (lei)", totalTitle: opts.totalTitle || "Valoare manoperă (lei)" },
        note: "Scriu prețul în coloana " + colL(opts.priceCol) + (t >= 0 ? " și valoarea în coloana " + colL(t) : "") + "." };
    }
    if (has(c.pret)) return { priceCol: c.pret, totalCol: has(opts.totalCol) ? opts.totalCol : -1, newCols: false, header: { priceTitle: "", totalTitle: "" },
      note: "Scriu prețul în coloana " + colL(c.pret) + ", cea de preț de manoperă din listă. Restul fișierului rămâne cum l-ai primit." };
    let mx = -1; ["nr", "cod", "den", "um", "cant"].forEach(k => { if (has(c[k]) && c[k] > mx) mx = c[k]; });
    if (has(opts.maxCol) && opts.maxCol > mx) mx = opts.maxCol;
    if (table && has(table.width) && table.width - 1 > mx) mx = table.width - 1;
    const p = mx + 1;
    return { priceCol: p, totalCol: p + 1, newCols: true, header: { priceTitle: "Preț manoperă (lei)", totalTitle: "Valoare manoperă (lei)" },
      note: "Lista nu are coloană de preț. Adaug două coloane la dreapta: " + colL(p) + " – «Preț manoperă» și " + colL(p + 1) + " – «Valoare manoperă»." };
  }

  /* ---------- cititul unei foi (text XML) ---------- */
  function sheetParts(xml) {
    const pm = /<((?:[A-Za-z_][\w.\-]*:)?)worksheet\b/.exec(xml); if (!pm) throw new Error("Foaia nu arată ca o foaie de Excel.");
    const P = pm[1];
    const o = new RegExp("<" + P + "sheetData\\b[^>]*?(/?)>").exec(xml); if (!o) throw new Error("Foaia nu are date.");
    const a = o.index, b = a + o[0].length; let c, d;
    if (o[1] === "/") { c = b; d = b; } else { c = xml.indexOf("</" + P + "sheetData>", b); if (c < 0) throw new Error("Foaia e stricată."); d = c + P.length + 12; }
    return { P, head: xml.slice(0, a), body: xml.slice(b, c), tail: xml.slice(d) };
  }
  function parseRows(body, P) {
    const re = new RegExp("<" + P + "row\\b([^>]*?)(/>|>([\\s\\S]*?)</" + P + "row>)", "g"), rows = []; let m, prev = 0, last = 0;
    while ((m = re.exec(body))) {
      const rn = +attr(m[1], "r") || prev + 1; prev = rn;
      rows.push({ r: rn, a: m[1], inner: m[3] || "", raw: m[0], pre: body.slice(last, m.index), cells: null, dirty: false }); last = m.index + m[0].length;
    }
    return { rows, post: body.slice(last) };
  }
  function parseCells(row, P) {
    if (row.cells) return row.cells;
    const re = new RegExp("<" + P + "c\\b([^>]*?)(/>|>([\\s\\S]*?)</" + P + "c>)", "g"), cells = []; let m, prev = -1;
    while ((m = re.exec(row.inner))) {
      const rf = refOf(attr(m[1], "r")), col = rf ? rf.c : prev + 1; prev = col;
      cells.push({ col, a: m[1], inner: m[3] || "" });
    }
    return (row.cells = cells);
  }
  const cellOf = (row, col, P) => { const cs = parseCells(row, P); for (let i = 0; i < cs.length; i++) if (cs[i].col === col) return cs[i]; return null; };
  const hasF = (c, P) => !!c && new RegExp("<" + P + "f[\\s>/]").test(c.inner);
  const filled = (c, P) => !!c && new RegExp("<" + P + "(v|f|is)[\\s>/]").test(c.inner) && !new RegExp("^\\s*<" + P + "v\\s*/>\\s*$|^\\s*<" + P + "v>\\s*</" + P + "v>\\s*$").test(c.inner);
  function putCell(row, col, a, inner, P) {
    const cs = parseCells(row, P), nc = { col, a, inner };
    let i = 0; while (i < cs.length && cs[i].col < col) i++;
    if (i < cs.length && cs[i].col === col) cs[i] = nc; else cs.splice(i, 0, nc);
    row.dirty = true; return nc;
  }
  function rowXml(row, P) {
    if (!row.dirty) return row.raw;
    let a = row.a; const cs = row.cells || [];
    if (cs.length) {                                             // „spans” e doar un ajutor pentru Excel; îl țin corect dacă am adăugat căsuțe
      const sp = attr(a, "spans");
      if (sp) { const m = /^(\d+):(\d+)$/.exec(sp); if (m) { const lo = Math.min(+m[1], cs[0].col + 1), hi = Math.max(+m[2], cs[cs.length - 1].col + 1); a = setAttr(a, "spans", lo + ":" + hi); } }
    }
    return "<" + P + "row" + a + ">" + cs.map(c => "<" + P + "c" + (attr(c.a, "r") == null ? ' r="' + colL(c.col) + row.r + '"' : "") + c.a + (c.inner ? ">" + c.inner + "</" + P + "c>" : "/>")).join("") + "</" + P + "row>";
  }

  /* ---------- stiluri: o copie a stilului vecin, dar cu numărul scris cu două zecimale ---------- */
  function stylesCtx(xml) {
    if (!xml) return { num: () => null, out: () => null };
    const pm = /<((?:[A-Za-z_][\w.\-]*:)?)styleSheet\b/.exec(xml), P = pm ? pm[1] : "";
    const o = new RegExp("<" + P + "cellXfs\\b([^>]*)>").exec(xml); if (!o) return { num: () => null, out: () => null };
    const b = o.index + o[0].length, c = xml.indexOf("</" + P + "cellXfs>", b); if (c < 0) return { num: () => null, out: () => null };
    const xfs = []; const re = new RegExp("<" + P + "xf\\b([^>]*?)(/>|>[\\s\\S]*?</" + P + "xf>)", "g"); let m; const blk = xml.slice(b, c);
    while ((m = re.exec(blk))) xfs.push({ a: m[1], rest: m[2] });
    const n0 = xfs.length, cache = {}, cnt = attr(o[1], "count");
    if (!n0 || (cnt != null && +cnt !== n0)) return { num: () => null, out: () => null };
    return {
      num(s) {                                                   // stilul s, cu format „#,##0.00”
        s = +s; if (!(s >= 0) || s >= n0) return null; if (cache[s] != null) return cache[s];
        let a = setAttr(xfs[s].a, "numFmtId", "4"); a = setAttr(a, "applyNumberFormat", "1");
        xfs.push({ a, rest: xfs[s].rest }); return (cache[s] = xfs.length - 1);
      },
      out() {
        if (xfs.length === n0) return null;
        return xml.slice(0, o.index) + "<" + P + "cellXfs" + setAttr(o[1], "count", xfs.length) + ">" + xfs.map(x => "<" + P + "xf" + x.a + x.rest).join("") + xml.slice(c);
      }
    };
  }

  /* ---------- socoteala formulelor simple din foaie (ca totalurile să arate bine și acolo unde fișierul nu e recalculat: previzualizare pe telefon, LibreOffice) ---------- */
  function shiftF(f, dr, dc) {                                   // formula „stăpân” mutată cu dr rânduri și dc coloane (formule împărțite)
    return f.replace(/("[^"]*")|('[^']*'!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/g, (m, str, sh, d1, col, d2, row) => {
      if (str) return str; const c = d1 ? col : colL(colI(col) + dc), r = d2 ? row : String(+row + dr); return (sh || "") + d1 + c + d2 + r;
    });
  }
  function evaluator(get, rng) {
    /* get(col,row) → număr | text | true/false | null (gol); rng(c1,r1,c2,r2,fn) parcurge căsuțele existente. Aruncă eroare la orice nu înțelege. */
    return function (src) {
      let i = 0; const s = src;
      const ws = () => { while (s[i] === " " || s[i] === "\n" || s[i] === "\r" || s[i] === "\t") i++; };
      const fail = () => { throw new Error("x"); };
      const numOf = v => { if (v == null) return 0; if (typeof v === "number") return v; if (typeof v === "boolean") return v ? 1 : 0; if (typeof v === "string" && v.trim() !== "" && isFinite(+v.replace(",", "."))) return +v.replace(",", "."); return fail(); };
      const flat = (args, f) => args.forEach(a => { if (a && a.rg) rng(a.rg[0], a.rg[1], a.rg[2], a.rg[3], v => { if (typeof v === "number") f(v); }); else f(numOf(a)); });
      const rnd = (v, n, mode) => { const k = Math.pow(10, n), x = Math.abs(v * k), sg = v < 0 ? -1 : 1; return sg * (mode === 0 ? Math.round(x + 1e-9) : mode > 0 ? Math.ceil(x - 1e-9) : Math.floor(x + 1e-9)) / k; };
      const FN = {
        SUM: a => { let t = 0; flat(a, v => t += v); return t; },
        PRODUCT: a => { let t = 1, n = 0; flat(a, v => { t *= v; n++; }); return n ? t : 0; },
        MIN: a => { let t = Infinity; flat(a, v => t = Math.min(t, v)); return isFinite(t) ? t : 0; },
        MAX: a => { let t = -Infinity; flat(a, v => t = Math.max(t, v)); return isFinite(t) ? t : 0; },
        AVERAGE: a => { let t = 0, n = 0; flat(a, v => { t += v; n++; }); return n ? t / n : fail(); },
        ROUND: a => a.length === 2 ? rnd(numOf(a[0]), numOf(a[1]), 0) : fail(),
        ROUNDUP: a => a.length === 2 ? rnd(numOf(a[0]), numOf(a[1]), 1) : fail(),
        ROUNDDOWN: a => a.length === 2 ? rnd(numOf(a[0]), numOf(a[1]), -1) : fail(),
        TRUNC: a => rnd(numOf(a[0]), a.length > 1 ? numOf(a[1]) : 0, -1),
        INT: a => Math.floor(numOf(a[0])), ABS: a => Math.abs(numOf(a[0])),
        SUBTOTAL: a => { const k = numOf(a[0]); return k === 9 || k === 109 ? FN.SUM(a.slice(1)) : fail(); }
      };
      function prim() {
        ws(); const ch = s[i];
        if (ch === "(") { i++; const v = expr(); ws(); if (s[i] !== ")") fail(); i++; return v; }
        if (ch === "-") { i++; return -numOf(prim()); }
        if (ch === "+") { i++; return numOf(prim()); }
        if (ch === '"') { let j = i + 1, t = ""; for (;;) { if (j >= s.length) fail(); if (s[j] === '"') { if (s[j + 1] === '"') { t += '"'; j += 2; continue; } break; } t += s[j++]; } i = j + 1; return t; }
        let m = /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/i.exec(s.slice(i)); if (m) { i += m[0].length; return +m[0]; }
        m = /^([A-Z][A-Z0-9.]*)\s*\(/i.exec(s.slice(i));
        if (m) {
          const name = m[1].toUpperCase(); i += m[0].length; const args = []; ws();
          if (name === "IF") {
            const c = expr(); ws(); if (s[i] !== ",") fail(); i++;
            const p0 = i, a = lazy(), hasB = (ws(), s[i] === ","); let p1 = -1; if (hasB) { i++; p1 = i; lazy(); } ws(); if (s[i] !== ")") fail(); const end = i + 1;
            const pick = (typeof c === "boolean" ? c : numOf(c) !== 0) ? p0 : p1; if (pick < 0) { i = end; return false; }
            i = pick; const v = expr(); i = end; void a; return v;
          }
          if (name === "IFERROR") { const p0 = i; lazy(); ws(); if (s[i] !== ",") fail(); i++; const p1 = i; lazy(); ws(); if (s[i] !== ")") fail(); const end = i + 1; let v; try { i = p0; v = expr(); } catch (e) { i = p1; v = expr(); } i = end; return v; }
          if (!FN[name]) fail();
          if (s[i] === ")") { i++; return FN[name](args); }
          for (;;) { args.push(arg()); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === ")") { i++; break; } fail(); }
          return FN[name](args);
        }
        m = /^(\$?[A-Z]{1,3}\$?\d+)(:(\$?[A-Z]{1,3}\$?\d+))?(?![\w!(])/.exec(s.slice(i));
        if (m) { i += m[0].length; const a = refOf(m[1]); if (m[3]) return fail(); const v = get(a.c, a.r); return v; }
        return fail();
      }
      function arg() {                                           // un argument de funcție: poate fi o zonă (A1:B9)
        ws(); const m = /^(\$?[A-Z]{1,3}\$?\d+):(\$?[A-Z]{1,3}\$?\d+)\s*(?=[,)])/.exec(s.slice(i));
        if (m) { i += m[0].length; const a = refOf(m[1]), b = refOf(m[2]); return { rg: [Math.min(a.c, b.c), Math.min(a.r, b.r), Math.max(a.c, b.c), Math.max(a.r, b.r)] }; }
        return expr();
      }
      function lazy() {                                          // sare peste o expresie fără s-o socotească (pentru IF)
        let d = 0; for (; i < s.length; i++) { const ch = s[i]; if (ch === '"') { i++; while (i < s.length && !(s[i] === '"' && s[i + 1] !== '"')) { if (s[i] === '"') i++; i++; } continue; } if (ch === "(") d++; else if (ch === ")") { if (!d) return; d--; } else if (ch === "," && !d) return; }
        fail();
      }
      function pct() { let v = prim(); ws(); while (s[i] === "%") { i++; v = numOf(v) / 100; ws(); } return v; }
      function pow() { let v = pct(); ws(); while (s[i] === "^") { i++; v = Math.pow(numOf(v), numOf(pct())); ws(); } return v; }
      function mul() { let v = pow(); for (;;) { ws(); const ch = s[i]; if (ch === "*") { i++; v = numOf(v) * numOf(pow()); } else if (ch === "/") { i++; const d = numOf(pow()); if (!d) fail(); v = numOf(v) / d; } else return v; } }
      function add() { let v = mul(); for (;;) { ws(); const ch = s[i]; if (ch === "+") { i++; v = numOf(v) + numOf(mul()); } else if (ch === "-") { i++; v = numOf(v) - numOf(mul()); } else return v; } }
      function cat() { let v = add(); ws(); if (s[i] === "&") fail(); return v; }
      function expr() {
        const v = cat(); ws(); const m = /^(<=|>=|<>|=|<|>)/.exec(s.slice(i)); if (!m) return v; i += m[0].length; const w = cat();
        const a = v == null ? (typeof w === "string" ? "" : 0) : v, b = w == null ? (typeof a === "string" ? "" : 0) : w; if (typeof a !== typeof b) fail();
        const x = typeof a === "string" ? a.toLowerCase() : a, y = typeof b === "string" ? b.toLowerCase() : b;
        return m[0] === "=" ? x === y : m[0] === "<>" ? x !== y : m[0] === "<" ? x < y : m[0] === ">" ? x > y : m[0] === "<=" ? x <= y : x >= y;
      }
      const v = expr(); ws(); if (i < s.length) fail(); return v;
    };
  }
  /** După ce am scris prețurile: recalculez formulele din aceeași foaie care depind de ele și pe care le înțeleg. Celelalte rămân cum erau (Excel le reface la deschidere). */
  function recalc(rows, P, changed, shared) {
    const byRow = new Map(); rows.forEach(r => byRow.set(r.r, r));
    const rowNums = rows.map(r => r.r).sort((a, b) => a - b);
    const chRows = new Map(); changed.forEach((v, k) => { const [c, r] = k.split(":"); if (!chRows.has(+c)) chRows.set(+c, new Set()); chRows.get(+c).add(+r); });
    const fRe = new RegExp("<" + P + "f\\b([^>]*?)(/>|>([\\s\\S]*?)</" + P + "f>)"), vRe = new RegExp("<" + P + "v\\b[^>]*>([\\s\\S]*?)</" + P + "v>");
    const masters = new Map();                                   // si → {f, c, r}
    rows.forEach(r => { if (r.inner.indexOf("shared") < 0 && !r.dirty) return; parseCells(r, P).forEach(c => { const m = fRe.exec(c.inner); if (m && attr(m[1], "t") === "shared" && m[3]) masters.set(attr(m[1], "si"), { f: xu(m[3]), c: c.col, r: r.r }); }); });
    const info = (row, c) => {
      if (c.x) return c.x; const x = (c.x = { f: null, v: null, t: attr(c.a, "t") });
      const fm = fRe.exec(c.inner);
      if (fm) {
        const ft = attr(fm[1], "t");
        if (ft === "shared" && !fm[3]) { const ms = masters.get(attr(fm[1], "si")); x.f = ms ? shiftF(ms.f, row.r - ms.r, c.col - ms.c) : "#"; }
        else if (ft === "array" || ft === "dataTable") x.f = "#"; else x.f = xu(fm[3] || "");
      }
      const vm = vRe.exec(c.inner);
      if (vm) { const raw = xu(vm[1]); x.v = x.t === "s" ? (shared ? shared(+raw) : "") : x.t === "str" || x.t === "e" ? raw : x.t === "b" ? raw === "1" : (isFinite(+raw) && raw !== "" ? +raw : raw); }
      else if (x.t === "inlineStr") x.v = xu((c.inner.match(new RegExp("<" + P + "t\\b[^>]*>([\\s\\S]*?)</" + P + "t>", "g")) || []).map(t => t.replace(/<[^>]+>/g, "")).join(""));
      return x;
    };
    const memo = new Map(), busy = new Set(), dep = new Map(); let curDep = false;
    const isCh = (c, r) => changed.has(c + ":" + r);
    function val(c, r) {
      const k = c + ":" + r;
      if (changed.has(k)) { curDep = true; return changed.get(k); }
      const row = byRow.get(r); if (!row) return null; const cell = cellOf(row, c, P); if (!cell) return null; const x = info(row, cell);
      if (x.f == null) return x.v;
      if (memo.has(k)) { if (dep.get(k)) curDep = true; const m = memo.get(k); if (m && m.err) throw new Error("x"); return m; }
      if (busy.has(k) || x.f === "#") throw new Error("x");
      busy.add(k); const save = curDep; curDep = false; let out;
      try { out = ev(x.f); memo.set(k, out); dep.set(k, curDep); }
      catch (e) { memo.set(k, { err: 1 }); dep.set(k, curDep); busy.delete(k); curDep = save || curDep; throw e; }
      busy.delete(k); curDep = save || curDep; return out;
    }
    function rng(c1, r1, c2, r2, fn) {
      for (let c = c1; c <= c2; c++) { const st = chRows.get(c); if (st) { for (const r of st) if (r >= r1 && r <= r2) { curDep = true; break; } } }
      let lo = 0, hi = rowNums.length; while (lo < hi) { const md = (lo + hi) >> 1; if (rowNums[md] < r1) lo = md + 1; else hi = md; }
      for (let q = lo; q < rowNums.length && rowNums[q] <= r2; q++) {
        const row = byRow.get(rowNums[q]), cs = parseCells(row, P);
        for (let j = 0; j < cs.length; j++) { const c = cs[j].col; if (c < c1) continue; if (c > c2) break; let v; try { v = val(c, row.r); } catch (e) { throw e; } fn(v); }
      }
    }
    const ev = evaluator(val, rng); let n = 0;
    rows.forEach(row => {
      if (row.inner.indexOf("<" + P + "f") < 0 && !row.dirty) return;
      parseCells(row, P).forEach((cell, idx) => {
        const x = info(row, cell); if (x.f == null || x.f === "#" || isCh(cell.col, row.r)) return;
        const k = cell.col + ":" + row.r; let out; curDep = false;
        try { out = val(cell.col, row.r); } catch (e) { return; }
        if (!dep.get(k) || typeof out !== "number" || !isFinite(out)) return;
        if (typeof x.v === "number" && Math.abs(x.v - out) < 1e-9) return;
        const vNew = "<" + P + "v>" + String(+out.toPrecision(15)) + "</" + P + "v>";
        let inner = vRe.test(cell.inner) ? cell.inner.replace(vRe, () => vNew) : cell.inner.replace(new RegExp("<" + P + "v\\s*/>"), "") + vNew;
        let a = cell.a; if (x.t && x.t !== "n") a = delAttr(a, "t");
        row.cells[idx] = { col: cell.col, a, inner }; row.dirty = true; n++;
      });
    });
    return n;
  }

  /* ---------- scrisul într-o foaie ---------- */
  function patchSheet(xml, e, st, shared, doRe) {
    const notes = [], sp = sheetParts(xml), P = sp.P, pr = parseRows(sp.body, P), rows = pr.rows;
    const byRow = new Map(); rows.forEach(r => byRow.set(r.r, r));
    const cols = e.cols || {}, hasC = v => typeof v === "number" && v >= 0;
    let p = e.plan || plan({ cols }, {});
    const tg = new Map(); (e.rows || []).forEach(x => { const r = +x.row, v = +x.pret; if (r > 0 && isFinite(v) && v > 0) tg.set(r, { pret: v, cant: x.cant }); });
    if (!tg.size) return { xml, changed: 0, notes };
    const tr = [...tg.keys()].sort((a, b) => a - b), rMin = hasC(e.headerRow) && e.headerRow > 0 ? Math.min(e.headerRow, tr[0]) : tr[0], rMax = tr[tr.length - 1];
    let pc = p.priceCol, tc = hasC(p.totalCol) ? p.totalCol : -1;
    if (p.newCols) {                                             // coloanele noi trebuie să fie chiar libere; dacă nu sunt, mă mut la dreapta
      const used = new Set(); rows.forEach(r => { if (r.r < rMin || r.r > rMax) return; parseCells(r, P).forEach(c => { if (c.col >= pc && filled(c, P)) used.add(c.col); }); });
      /* o coloană acoperită de celule unite (de ex. „Cantitatea” întinsă pe două coloane) nu e liberă: ce scriu acolo nu s-ar vedea */
      { const mre = new RegExp("<" + P + "mergeCell\\b[^>]*?\\bref=\"([A-Z]+)(\\d+):([A-Z]+)(\\d+)\"", "g"); let mm;
        while ((mm = mre.exec(sp.tail))) { const c1 = colI(mm[1]), c2 = colI(mm[3]); if (+mm[4] < rMin || +mm[2] > rMax) continue; for (let c = Math.max(c1 + 1, pc); c <= c2; c++) used.add(c); } }
      const p0 = pc; while (used.has(pc) || (tc >= 0 && used.has(pc + (tc - p.priceCol)))) pc++;
      if (pc !== p0) { if (tc >= 0) tc = pc + (tc - p.priceCol); notes.push("Coloana " + colL(p0) + " era ocupată; am scris prețurile în coloana " + colL(pc) + (tc >= 0 ? " și valorile în " + colL(tc) : "") + "."); }
      else notes.push("Lista nu avea coloană de preț: am adăugat la dreapta coloana " + colL(pc) + " («Preț manoperă»)" + (tc >= 0 ? " și coloana " + colL(tc) + " («Valoare manoperă»)" : "") + ".");
    }
    const mode = col => {                                        // stilul cel mai des întâlnit în coloana aceea, pe rândurile listei
      const n = {}; let best = null, bn = 0; rows.forEach(r => { if (r.r <= (e.headerRow || 0) || r.r > rMax) return; const c = cellOf(r, col, P), s = c && attr(c.a, "s"); if (s != null) { n[s] = (n[s] || 0) + 1; if (n[s] > bn) { bn = n[s]; best = s; } } }); return best;
    };
    const colStyle = p.newCols ? null : mode(pc);
    const leftOf = (row, col) => { const cs = parseCells(row, P); let b = null; for (let i = 0; i < cs.length; i++) { if (cs[i].col >= col) break; if (attr(cs[i].a, "s") != null) b = cs[i]; } return b; };
    const newStyle = (row, col) => {                             // stil pentru o căsuță pe care o creez eu
      if (!p.newCols && colStyle != null) return colStyle;
      const src = (hasC(cols.cant) && cellOf(row, cols.cant, P)) || leftOf(row, col), s = src && attr(src.a, "s");
      if (s == null) return null; const k = st.num(s); return k == null ? s : String(k);
    };
    const mkRow = r => {                                         // rând care nu există încă în fișier
      const row = { r, a: ' r="' + r + '"', inner: "", raw: "", pre: "", cells: [], dirty: true }; let i = 0; while (i < rows.length && rows[i].r < r) i++; rows.splice(i, 0, row); byRow.set(r, row); return row;
    };
    const changed = new Map(); let n = 0, skipF = 0, maxCol = -1;
    tr.forEach(r => {
      const t = tg.get(r), row = byRow.get(r) || mkRow(r), old = cellOf(row, pc, P);
      if (hasF(old, P)) { skipF++; return; }
      const v = numS(t.pret); let a;
      if (old) { a = delAttr(old.a, "t"); if (attr(a, "r") == null) a = ' r="' + colL(pc) + r + '"' + a; }
      else { const s = newStyle(row, pc); a = ' r="' + colL(pc) + r + '"' + (s != null ? ' s="' + s + '"' : ""); }
      putCell(row, pc, a, "<" + P + "v>" + v + "</" + P + "v>", P); changed.set(pc + ":" + r, +v); n++; if (pc > maxCol) maxCol = pc;
      if (tc >= 0 && (p.newCols || e.writeTotal)) {
        const ot = cellOf(row, tc, P); if (hasF(ot, P) || (!p.newCols && filled(ot, P) && !e.writeTotal)) return;
        let q = +t.cant; const qc = hasC(cols.cant) ? cellOf(row, cols.cant, P) : null;
        if (!isFinite(q) && qc) { const m = new RegExp("<" + P + "v>([^<]*)</" + P + "v>").exec(qc.inner); if (m && attr(qc.a, "t") == null) q = +m[1]; }
        let ta; if (ot) { ta = delAttr(ot.a, "t"); if (attr(ta, "r") == null) ta = ' r="' + colL(tc) + r + '"' + ta; } else { const s = newStyle(row, tc); ta = ' r="' + colL(tc) + r + '"' + (s != null ? ' s="' + s + '"' : ""); }
        const cached = isFinite(q) ? "<" + P + "v>" + numS(r2(q * +v)) + "</" + P + "v>" : "";
        if (hasC(cols.cant)) putCell(row, tc, ta, "<" + P + "f>" + colL(cols.cant) + r + "*" + colL(pc) + r + "</" + P + "f>" + cached, P);
        else if (cached) { putCell(row, tc, ta, cached, P); changed.set(tc + ":" + r, r2(q * +v)); } else return;
        if (tc > maxCol) maxCol = tc;
      }
    });
    if (skipF) notes.push(skipF === 1 ? "O căsuță de preț avea formulă; am lăsat-o cum era." : skipF + " căsuțe de preț aveau formule; le-am lăsat cum erau.");
    if (!n) return { xml, changed: 0, notes };
    let head = sp.head, tail = sp.tail;
    if (p.newCols) {
      if (e.headerRow > 0) {                                     // titlurile coloanelor noi, în rândul de cap al listei
        const hr = byRow.get(e.headerRow) || mkRow(e.headerRow), src = leftOf(hr, pc), s = src && attr(src.a, "s");
        const put = (col, title) => { if (!title || filled(cellOf(hr, col, P), P)) return; putCell(hr, col, ' r="' + colL(col) + e.headerRow + '"' + (s != null ? ' s="' + s + '"' : "") + ' t="inlineStr"', "<" + P + "is><" + P + "t>" + xe(title) + "</" + P + "t></" + P + "is>", P); };
        const h = p.header || {}; put(pc, h.priceTitle || "Preț manoperă (lei)"); if (tc >= 0) put(tc, h.totalTitle || "Valoare manoperă (lei)");
      }
      head = addCols(head, P, pc, tc >= 0 ? tc : pc);
      head = head.replace(new RegExp("<" + P + "dimension\\b([^>]*?)/>"), (m, a) => {
        const ref = attr(a, "ref"), mm = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(ref || ""); if (!mm) return m;
        const c2 = Math.max(colI(mm[3] || mm[1]), maxCol), r2x = Math.max(+(mm[4] || mm[2]), rMax); return "<" + P + "dimension" + setAttr(a, "ref", mm[1] + mm[2] + ":" + colL(c2) + r2x) + "/>";
      });
    }
    let re = 0; if (doRe) { try { re = recalc(rows, P, changed, shared); } catch (x) { re = 0; } }
    const body = rows.map(r => r.pre + rowXml(r, P)).join("") + pr.post;
    return { xml: head + "<" + P + "sheetData>" + body + "</" + P + "sheetData>" + tail, changed: n, notes, recalc: re, priceCol: pc, totalCol: tc };
  }
  /* lățime pentru coloanele adăugate (dacă foaia nu le are deja descrise) */
  function addCols(head, P, c1, c2) {
    const W = i => "<" + P + 'col min="' + (i + 1) + '" max="' + (i + 1) + '" width="18.7109375" customWidth="1"/>';
    const o = new RegExp("<" + P + "cols>([\\s\\S]*?)</" + P + "cols>").exec(head);
    if (!o) return head + "<" + P + "cols>" + (c1 === c2 ? W(c1) : W(c1) + W(c2)) + "</" + P + "cols>";
    const list = []; const re = new RegExp("<" + P + "col\\b([^>]*?)/>", "g"); let m;
    while ((m = re.exec(o[1]))) list.push({ min: +attr(m[1], "min"), max: +attr(m[1], "max"), raw: m[0] });
    const need = []; for (let c = c1; c <= c2; c += Math.max(1, c2 - c1)) { if (!list.some(x => x.min <= c + 1 && x.max >= c + 1)) need.push(c); if (c1 === c2) break; }
    if (!need.length) return head;
    need.forEach(c => list.push({ min: c + 1, max: c + 1, raw: W(c) })); list.sort((a, b) => a.min - b.min);
    return head.slice(0, o.index) + "<" + P + "cols>" + list.map(x => x.raw).join("") + "</" + P + "cols>" + head.slice(o.index + o[0].length);
  }

  /* ---------- arhiva: care fișier dinăuntru e care foaie ---------- */
  const dirOf = p => p.replace(/[^/]*$/, "");
  const join = (dir, t) => { if (t[0] === "/") return t.slice(1); const parts = (dir + t).split("/"), out = []; parts.forEach(x => { if (x === "..") out.pop(); else if (x !== "." && x !== "") out.push(x); }); return out.join("/"); };
  async function openBook(zip) {
    const txt = async p => { const f = zip.file(p); return f ? f.async("string") : null; };
    let wbPath = "xl/workbook.xml"; const top = await txt("_rels/.rels");
    if (top) { const re = /<Relationship\b([^>]*?)\/?>/g; let m; while ((m = re.exec(top))) if (/officeDocument$/.test(attr(m[1], "Type") || "")) wbPath = join("", attr(m[1], "Target")); }
    const wb = await txt(wbPath); if (!wb) throw new Error("Fișierul nu arată ca un Excel (.xlsx).");
    const relsPath = dirOf(wbPath) + "_rels/" + wbPath.slice(dirOf(wbPath).length) + ".rels", rels = (await txt(relsPath)) || "";
    const rel = {}; let stylesPath = null, ssPath = null, calcId = null, calcPath = null; { const re = /<Relationship\b([^>]*?)\/?>/g; let m;
      while ((m = re.exec(rels))) { const id = attr(m[1], "Id"), ty = attr(m[1], "Type") || "", tgt = join(dirOf(wbPath), attr(m[1], "Target") || ""); rel[id] = tgt;
        if (/\/styles$/.test(ty)) stylesPath = tgt; if (/\/sharedStrings$/.test(ty)) ssPath = tgt; if (/\/calcChain$/.test(ty)) { calcId = id; calcPath = tgt; } } }
    const sheets = []; { const blk = /<(?:[\w.\-]+:)?sheets\b[^>]*>([\s\S]*?)<\/(?:[\w.\-]+:)?sheets>/.exec(wb), re = /<(?:[\w.\-]+:)?sheet\b([^>]*?)\/?>/g; let m;
      while (blk && (m = re.exec(blk[1]))) { const id = (/[\w.\-]+:id\s*=\s*"([^"]*)"/.exec(m[1]) || [])[1]; sheets.push({ name: xu(attr(m[1], "name") || ""), path: rel[id] || null }); } }
    return { wbPath, wb, relsPath, rels, sheets, stylesPath: stylesPath || "xl/styles.xml", ssPath: ssPath || "xl/sharedStrings.xml", calcId, calcPath, txt };
  }
  const findSheet = (bk, name) => { const n = String(name || ""), t = s => s.trim().toLowerCase(); return bk.sheets.find(s => s.name === n) || bk.sheets.find(s => t(s.name) === t(n)) || null; };
  function sharedGetter(xml) {                                   // textele comune, citite doar la nevoie
    if (!xml) return null; let list = null;
    return i => { if (!list) { list = []; const re = /<(?:[\w.\-]+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:[\w.\-]+:)?si>)/g; let m; while ((m = re.exec(xml))) list.push(xu(((m[1] || "").replace(/<(?:[\w.\-]+:)?rPh\b[\s\S]*?<\/(?:[\w.\-]+:)?rPh>/g, "").match(/<(?:[\w.\-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.\-]+:)?t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join(""))); } return list[i] == null ? "" : list[i]; };
  }

  /** Ce foi are fișierul și până unde sunt folosite (ajută la alegerea coloanelor noi). */
  async function scan(file) {
    const JSZip = await needZip(), zip = await JSZip.loadAsync(bytes(file.data)), bk = await openBook(zip), out = [];
    for (const s of bk.sheets) {
      if (!s.path || !/worksheets\//.test(s.path)) continue; const xml = await bk.txt(s.path); if (!xml) continue;
      let maxCol = -1, maxRow = 0; try { const sp = sheetParts(xml), pr = parseRows(sp.body, sp.P); pr.rows.forEach(r => { parseCells(r, sp.P).forEach(c => { if (filled(c, sp.P)) { if (c.col > maxCol) maxCol = c.col; if (r.r > maxRow) maxRow = r.r; } }); }); } catch (e) { }
      out.push({ name: s.name, maxCol, maxRow });
    }
    return { sheets: out };
  }

  /* ---------- fișier nou, când cel primit nu e .xlsx ---------- */
  async function rebuild(file, sheets, opts, notes) {
    const tables = (opts.tables || []).filter(t => t && t.items && t.items.length);
    if (!tables.length) throw new Error("Nu am lista citită din fișier, așa că nu pot face unul nou cu prețuri.");
    const X = await needXl(), wb = new X.Workbook(); wb.created = new Date();
    const thin = { style: "thin", color: { argb: "FF9CA3AF" } }, box = { top: thin, left: thin, bottom: thin, right: thin }, used = {};
    const pm = {}; (sheets || []).forEach(e => { const m = (pm[e.sheet] = pm[e.sheet] || new Map()); (e.rows || []).forEach(x => { if (+x.pret > 0) m.set(+x.row, +x.pret); }); });
    let n = 0;
    tables.forEach((t, ti) => {
      let nm = String(t.name || "Lista " + (ti + 1)).replace(/[\\/*?:\[\]]/g, " ").trim().slice(0, 31) || "Lista " + (ti + 1); let k = 2, b = nm; while (used[nm.toLowerCase()]) nm = b.slice(0, 28) + " " + k++; used[nm.toLowerCase()] = 1;
      const ws = wb.addWorksheet(nm, { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      const hasNr = t.items.some(i => i.nr != null && String(i.nr).trim() !== ""), hasCod = t.items.some(i => i.cod != null && String(i.cod).trim() !== "");
      const C = []; if (hasNr) C.push(["Nr.", 7, "nr"]); if (hasCod) C.push(["Cod", 14, "cod"]); C.push(["Denumire", 70, "den"], ["UM", 8, "um"], ["Cantitate", 12, "cant"], ["Preț manoperă (lei)", 18, "p"], ["Valoare manoperă (lei)", 20, "v"]);
      C.forEach((c, i) => ws.getColumn(i + 1).width = c[1]);
      const iq = C.findIndex(c => c[2] === "cant") + 1, ip = iq + 1, iv = iq + 2, Lq = colL(iq - 1), Lp = colL(ip - 1), Lv = colL(iv - 1);
      let r = 1; if (t.title) { ws.mergeCells(r, 1, r, C.length); const c = ws.getCell(r, 1); c.value = t.title; c.font = { bold: true, size: 13 }; c.alignment = { wrapText: true, vertical: "middle" }; r += 2; }
      C.forEach((c, i) => { const x = ws.getCell(r, i + 1); x.value = c[0]; x.font = { bold: true }; x.border = box; x.alignment = { wrapText: true, vertical: "middle", horizontal: i >= iq - 2 ? "center" : "left" }; x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } }; });
      ws.views = [{ state: "frozen", ySplit: r }]; r++; const r0 = r; let cap = null; const prices = pm[t.name] || new Map();
      t.items.forEach(it => {
        if ((it.cap0 || "") !== (cap || "") && it.cap0 && it.cap0 !== t.title) { cap = it.cap0; ws.mergeCells(r, 1, r, C.length); const c = ws.getCell(r, 1); c.value = cap; c.font = { bold: true }; c.border = box; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }; r++; }
        const p = prices.has(+it.row) ? prices.get(+it.row) : (+it.pret > 0 ? +it.pret : null);
        C.forEach((c, i) => { const x = ws.getCell(r, i + 1); x.border = box;
          if (c[2] === "p") { if (p != null) { x.value = Math.round(p * 1e4) / 1e4; n++; } x.numFmt = "#,##0.00"; }
          else if (c[2] === "v") { x.value = { formula: Lq + r + "*" + Lp + r, result: p != null ? r2((+it.cant || 0) * p) : 0 }; x.numFmt = "#,##0.00"; }
          else if (c[2] === "cant") { x.value = +it.cant || 0; x.numFmt = "#,##0.##"; }
          else { x.value = it[c[2]] == null ? "" : it[c[2]]; if (c[2] === "den") x.alignment = { wrapText: true, vertical: "top" }; } });
        r++;
      });
      const tot = t.items.reduce((a, it) => { const p = prices.has(+it.row) ? prices.get(+it.row) : (+it.pret > 0 ? +it.pret : 0); return a + r2((+it.cant || 0) * p); }, 0);
      ws.mergeCells(r, 1, r, iv - 1); const tl = ws.getCell(r, 1); tl.value = "Total manoperă (fără TVA)"; tl.font = { bold: true }; tl.alignment = { horizontal: "right" }; tl.border = box;
      const tv = ws.getCell(r, iv); tv.value = { formula: "SUM(" + Lv + r0 + ":" + Lv + (r - 1) + ")", result: r2(tot) }; tv.numFmt = "#,##0.00"; tv.font = { bold: true }; tv.border = box;
    });
    const ext = extOf(file.name);
    notes.push("Fișierul primit era " + (ext ? "." + ext : "în alt format") + "; am făcut unul nou, .xlsx, cu aceleași rânduri, în aceeași ordine, plus prețul și valoarea.");
    const buf = await wb.xlsx.writeBuffer();
    return { data: new Uint8Array(buf), changed: n };
  }

  /* ---------- treaba mare ---------- */
  /**
   * file = {name, data}; sheets = [{sheet, plan, headerRow, cols?, rows:[{row, pret, cant?}]}];
   * opts = {tables (obligatoriu când fișierul nu e .xlsx/.xlsm), recalc: false ca să nu ating valorile ținute de formule}.
   * Întoarce {data: Uint8Array, name, changed (câte prețuri au fost scrise), notes: [propoziții pe românește], kind: "patched" | "rebuilt"}.
   */
  async function fill(file, sheets, opts) {
    opts = opts || {}; sheets = sheets || []; const notes = [], data = bytes(file && file.data), ext = extOf(file && file.name), base = baseOf(file && file.name);
    const isZip = data.length > 4 && data[0] === 0x50 && data[1] === 0x4B, macro = ext === "xlsm";
    const outName = base + " - cu preturi SCV." + (macro ? "xlsm" : "xlsx");
    let bk = null, zip = null;
    if (isZip && (ext === "xlsx" || ext === "xlsm" || ext === "")) { try { const JSZip = await needZip(); zip = await JSZip.loadAsync(data); bk = await openBook(zip); } catch (e) { if (/modulul/.test(e.message)) throw e; bk = null; } }
    if (!bk) { const r = await rebuild(file || {}, sheets, opts, notes); return { data: r.data, name: base + " - cu preturi SCV.xlsx", changed: r.changed, notes, kind: "rebuilt" }; }
    const st = stylesCtx(await bk.txt(bk.stylesPath)), shared = opts.recalc === false ? null : sharedGetter(await bk.txt(bk.ssPath)), cache = {}; let changed = 0, re = 0;
    for (const e of sheets) {
      const s = findSheet(bk, e.sheet);
      if (!s || !s.path || !zip.file(s.path)) { notes.push("Nu am găsit foaia «" + e.sheet + "» în fișier; prețurile ei nu au fost scrise."); continue; }
      const xml = cache[s.path] != null ? cache[s.path] : await bk.txt(s.path);
      let r; try { r = patchSheet(xml, e, st, shared, opts.recalc !== false); } catch (x) { notes.push("Nu am putut scrie în foaia «" + e.sheet + "»: " + x.message); continue; }
      if (r.changed) { cache[s.path] = r.xml; changed += r.changed; re += r.recalc || 0; }
      r.notes.forEach(t => notes.push((sheets.length > 1 ? "«" + e.sheet + "»: " : "") + t));
    }
    if (!changed) { notes.push("Nu am avut niciun preț de scris."); return { data, name: outName, changed: 0, notes, kind: "patched" }; }
    Object.keys(cache).forEach(p => zip.file(p, cache[p], NF));
    const so = st.out(); if (so) zip.file(bk.stylesPath, so, NF);
    /* lanțul de calcul nu mai e bun după ce am schimbat căsuțe: îl scot și cer Excelului să socotească tot la deschidere */
    if (bk.calcPath && zip.file(bk.calcPath)) {
      zip.remove(bk.calcPath);
      zip.file(bk.relsPath, bk.rels.replace(new RegExp("<Relationship\\b[^>]*\\bId\\s*=\\s*\"" + bk.calcId + "\"[^>]*?/>|<Relationship\\b[^>]*\\bId\\s*=\\s*\"" + bk.calcId + "\"[^>]*?>\\s*</Relationship>"), ""), NF);
      const ct = await bk.txt("[Content_Types].xml"); if (ct) zip.file("[Content_Types].xml", ct.replace(/<Override\b[^>]*PartName\s*=\s*"\/?[^"]*calcChain\.xml"[^>]*?\/>/i, ""), NF);
    }
    { const m = /<((?:[\w.\-]+:)?)calcPr\b([^>]*?)\/>/.exec(bk.wb); let wb2;
      if (m) wb2 = bk.wb.slice(0, m.index) + "<" + m[1] + "calcPr" + setAttr(m[2], "fullCalcOnLoad", "1") + "/>" + bk.wb.slice(m.index + m[0].length);
      else { const P = (/<((?:[\w.\-]+:)?)workbook\b/.exec(bk.wb) || [, ""])[1], tag = "<" + P + 'calcPr fullCalcOnLoad="1"/>';
        const after = ["definedNames", "externalReferences", "functionGroups", "sheets"]; wb2 = null;
        for (const t of after) { const k = bk.wb.indexOf("</" + P + t + ">"); if (k >= 0) { const at = k + P.length + t.length + 3; wb2 = bk.wb.slice(0, at) + tag + bk.wb.slice(at); break; } }
        if (!wb2) wb2 = bk.wb; }
      zip.file(bk.wbPath, wb2, NF); }
    notes.push(changed === 1 ? "Am scris un preț." : "Am scris " + changed + " prețuri. Restul fișierului e neatins.");
    if (opts.recalc !== false) notes.push("Totalurile se refac singure când deschizi fișierul în Excel.");
    const out = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
    return { data: out, name: outName, changed, notes, kind: "patched", recalc: re };
  }

  const api = { plan, fill, scan, libs, colL, colI };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.WB = api;
})(typeof window !== "undefined" ? window : globalThis);

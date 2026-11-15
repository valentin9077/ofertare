/* Export Excel în stilul SCV (ExcelJS). Folosit în browser și în node (test). */
(function (root) {
  const NAVY = "FF1E3A8A", BLUE = "FF2563EB", CREAM = "FFFEFCE8", GREEN = "FF064E3B", AMBER = "FFFEF3C7", GREY = "FFF1F5F9";
  const LEI = '#,##0.00" lei"', NUM = "#,##0.00";
  const thin = { style: "thin", color: { argb: "FFCBD5E1" } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const fmtDate = d => { const p = n => String(n).padStart(2, "0"); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; };
  /* Data scrisă de om: 15.11.2026, 15/11/2026, 15-11-26, 2026-11-15. Întoarce data sau null dacă nu e o zi care există (31.02). */
  const readDate = s => { const t = String(s == null ? "" : s).trim(); let m = /^(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{4}|\d{2})$/.exec(t), y, mo, d;
    if (m) { d = +m[1]; mo = +m[2]; y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; } else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) { y = +m[1]; mo = +m[2]; d = +m[3]; } else return null;
    const dt = new Date(y, mo - 1, d); return y >= 2000 && y <= 2100 && dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null; };
  const parseDate = s => readDate(s) || new Date();
  /* „30 de zile”, „24 de luni”, „o zi” */
  const cu = (n, one, many) => n === 1 ? one : n + (n !== 0 && (n % 100 >= 20 || n % 100 === 0) ? " de " : " ") + many;
  const r2 = x => { const v = Math.round(+x * 1e6) / 1e4; return Math.round(v + (v >= 0 ? 1e-9 : -1e-9)) / 100; };   // la ban, ca în aplicație (8,325 → 8,33)
  /* Numele firmei vine din datele firmei (contul tău), nu e scris în aplicație. Pentru titlu scot „S.C.” și „S.R.L.”. */
  const firmShort = f => String(f || "").replace(/^\s*s\.?\s?c\.?\s+/i, "").replace(/[\s,]+(s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?|p\.?\s?f\.?\s?a\.?|i\.?\s?i\.?)\s*$/i, "").trim().toUpperCase();
  const nz = (v, d) => v === "" || v == null || !isFinite(+v) ? d : +v;      // 0 e o valoare bună (TVA 0, fără avans), doar golul ia valoarea obișnuită

  function fill(cell, argb) { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }; }

  /** st: {proj, chap:[{name,value}], items:[...], adaos} */
  function exportOffer(ExcelJS, st, opt) {
    opt = opt || {};
    const p = st.proj, wb = new ExcelJS.Workbook();
    wb.creator = firmShort(p.firma) || "Ofertare"; wb.created = new Date();
    const ws = wb.addWorksheet("OFERTA", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    [2, 8, 2, 56, 8, 8, 17, 17, 17].forEach((w, i) => ws.getColumn(i + 1).width = w);
    for (let r = 1; r <= 6; r++) for (let c = 1; c <= 9; c++) fill(ws.getCell(r, c), NAVY);
    ws.mergeCells("B2:D3"); const t = ws.getCell("B2"); t.value = "💧 " + (firmShort(p.firma) || "OFERTĂ"); t.font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } }; t.alignment = { vertical: "middle" };
    ws.getCell("B4").value = "Instalații sanitare • termice • stingere incendiu"; ws.getCell("B4").font = { size: 10, color: { argb: "FFBFDBFE" } };
    const co = [p.firma || "", p.firmaCif || "", p.firmaAdresa || "", p.firmaContact || "", p.iban ? "IBAN: " + p.iban : ""];
    co.forEach((v, i) => { const r = 2 + i; ws.mergeCells(`F${r}:I${r}`); const c = ws.getCell(`F${r}`); c.value = v; c.font = { size: 10, color: { argb: "FFFFFFFF" }, bold: i === 0 }; c.alignment = { horizontal: "right" }; });

    ws.getCell("F8").value = "OFERTA nr."; ws.getCell("F8").font = { bold: true }; ws.getCell("F8").alignment = { horizontal: "right" };
    const g8 = ws.getCell("G8"); g8.value = p.nrOferta || ""; g8.font = { bold: true, size: 12 }; fill(g8, CREAM); g8.border = box; g8.alignment = { horizontal: "center" };
    ws.getCell("H8").value = "Data:"; ws.getCell("H9").value = "Valabilă până:"; ["H8", "H9"].forEach(a => { ws.getCell(a).alignment = { horizontal: "right" }; ws.getCell(a).font = { bold: true }; });
    const vz = +p.valab > 0 ? Math.round(+p.valab) : 30, d0 = parseDate(p.data), d1 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + vz);   // zile de calendar (nu ore: la schimbarea orei ar ieși cu o zi mai puțin)
    ws.getCell("I8").value = fmtDate(d0); ws.getCell("I9").value = fmtDate(d1);
    ["I8", "I9"].forEach(a => { fill(ws.getCell(a), CREAM); ws.getCell(a).border = box; ws.getCell(a).alignment = { horizontal: "center" }; });

    ws.getCell("B11").value = "BENEFICIAR"; ws.getCell("B11").font = { bold: true, color: { argb: BLUE } };
    [["Firmă:", p.beneficiar], ["Șantier:", p.santier], ["CIF:", p.beneficiarCif], ["Contact:", p.beneficiarContact]].forEach((x, i) => {
      const r = 12 + i; ws.getCell(`B${r}`).value = x[0]; ws.getCell(`B${r}`).font = { bold: true }; ws.mergeCells(`C${r}:I${r}`);
      const c = ws.getCell(`C${r}`); c.value = x[1] || ""; fill(c, CREAM);
    });
    ws.mergeCells("B19:I19"); const o = ws.getCell("B19"); o.value = (p.obiect || (/^\s*instala[tț]i/i.test(p.santier || "") ? p.santier : "INSTALAȚII " + (p.santier || ""))).toUpperCase(); o.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } }; fill(o, BLUE); o.alignment = { vertical: "middle" }; ws.getRow(19).height = 24;

    const H = 21; ["Nr.", "", "Denumire capitol de lucrări", "UM", "Cant.", "Preț manoperă (lei)", "Valoare fără TVA", "TVA " + nz(p.tva, 21) + "%"].forEach((v, i) => {
      const c = ws.getCell(H, i + 2); c.value = v; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; fill(c, NAVY); c.alignment = { horizontal: i >= 3 ? "center" : "left", wrapText: true, vertical: "middle" }; c.border = box;
    });
    ws.getRow(H).height = 30;
    const chap = st.chap.filter(c => c.value !== 0);   // rândurile fără valoare nu se trimit clientului ca „0,00 lei”
    let r = H + 1;
    chap.forEach((c, i) => {
      const q = c.cant > 0 ? +c.cant : 1, pu = c.cant > 0 && c.pret != null ? +c.pret : c.value;
      ws.getCell(r, 2).value = (i + 1) * 10; ws.getCell(r, 4).value = c.name; ws.getCell(r, 5).value = c.cant > 0 && c.um ? c.um : "buc"; ws.getCell(r, 6).value = q;
      ws.getCell(r, 7).value = pu; ws.getCell(r, 8).value = { formula: `ROUND(F${r}*G${r},2)`, result: c.value }; ws.getCell(r, 9).value = { formula: `H${r}*${nz(p.tva, 21) / 100}`, result: c.value * nz(p.tva, 21) / 100 };
      for (let k = 2; k <= 9; k++) { const x = ws.getCell(r, k); x.border = box; if (k >= 7) x.numFmt = LEI; if (k === 7) fill(x, CREAM); if (k === 5 || k === 6) x.alignment = { horizontal: "center" }; }
      ws.getCell(r, 4).alignment = { wrapText: true, vertical: "middle" }; r++;
    });
    const last = r - 1, tv = nz(p.tva, 21) / 100;
    const sub = chap.reduce((a, c) => a + c.value, 0);
    r++;
    const tot = (label, f, res, bold, bg) => { ws.mergeCells(`B${r}:G${r}`); const l = ws.getCell(`B${r}`); l.value = label; l.alignment = { horizontal: "right" }; l.font = { bold: !!bold };
      const a = ws.getCell(`H${r}`), b = ws.getCell(`I${r}`); return { l, a, b, row: r }; };
    let x = tot("Subtotal manoperă (fără TVA)"); x.a.value = { formula: `SUM(H${H + 1}:H${last})`, result: sub }; x.a.numFmt = LEI; x.a.font = { bold: true }; const rSub = r; r++;
    x = tot("TVA " + nz(p.tva, 21) + "%" + (nz(p.tva, 21) > 0 ? " (la încasare, art. 282 CF)" : "")); x.b.value = { formula: `ROUND(SUM(I${H + 1}:I${last}),2)`, result: r2(sub * tv) }; x.b.numFmt = LEI; const rTva = r; r++;
    x = tot("TOTAL CU TVA", null, null, true); x.a.value = { formula: `H${rSub}`, result: sub }; x.b.value = { formula: `H${rSub}+I${rTva}`, result: sub * (1 + tv) }; [x.a, x.b].forEach(c => { c.numFmt = LEI; c.font = { bold: true, size: 12 }; fill(c, AMBER); c.border = box; }); x.l.font = { bold: true, size: 12 }; const rTot = r; r++;
    const av = nz(p.avans, 30) / 100;
    if (av > 0) {
      x = tot("Avans la semnare " + nz(p.avans, 30) + "% (cu TVA)"); x.b.value = { formula: `I${rTot}*${av}`, result: sub * (1 + tv) * av }; x.b.numFmt = LEI; r++;
      x = tot("Rest la recepție (cu TVA)"); x.b.value = { formula: `I${rTot}-I${r - 1}`, result: sub * (1 + tv) * (1 - av) }; x.b.numFmt = LEI; r += 2;
    } else r++;                                                 // fără avans: nu scriu „Avans 0%”

    const block = (title, lines, bg, fg) => {
      ws.mergeCells(`B${r}:I${r}`); const h = ws.getCell(`B${r}`); h.value = title; h.font = { bold: true, color: { argb: fg } }; fill(h, bg); r++;
      lines.filter(Boolean).forEach(l => { ws.mergeCells(`B${r}:I${r}`); const c = ws.getCell(`B${r}`); c.value = "• " + l; c.alignment = { wrapText: true, vertical: "top" }; ws.getRow(r).height = Math.max(15, Math.ceil(l.length / 105) * 15); r++; });
      r++;
    };
    block("CONDIȚII DE PLATĂ ȘI EXECUȚIE", [
      `Ofertă doar de manoperă; materialele și echipamentele ${p.materialeDe || "sunt asigurate de beneficiar"}.`,
      av > 0 ? `Avans ${nz(p.avans, 30)}% la semnare; restul pe situații de lucrări, conform graficului de decontare.` : "Fără avans; plata pe situații de lucrări, conform graficului de decontare.",
      (nz(p.tva, 21) > 0 ? `TVA ${nz(p.tva, 21)}% la încasare (art. 282 CF). ` : "Prețurile sunt fără TVA. ") + `Termen de execuție: ${p.termen || "conform contractului"}.`,
      `Oferta este valabilă ${cu(vz, "o zi", "zile")} de la data emiterii (${fmtDate(d0)}).`,
      `Execuție conform normativelor: ${p.normative || "I9, I13, GP 043, NP 059"}.`, String(p.clauza || "").trim()], GREY, "FF0F172A");   // clauza de ajustare cu indicele INS, doar dacă e aleasă în ofertă
    block("GARANȚIE", [`${cu(nz(p.garantie, 24), "o lună", "luni")} pentru manoperă, de la recepție.`], GREEN, "FFFFFFFF");
    if (String(p.includeTxt || "").trim()) block("OFERTA INCLUDE", String(p.includeTxt).split("\n").map(x => x.replace(/^\s*[-•]\s*/, "")), GREY, "FF0F172A");
    block("OFERTA NU INCLUDE", String(p.nuInclude || "").split("\n").map(x => x.replace(/^\s*[-•]\s*/, "")), AMBER, "FF92400E");
    if (String(p.semnatar || "").trim()) { ws.mergeCells(`B${r}:I${r}`); ws.getCell(`B${r}`).value = "Cu stimă,"; r++; ws.mergeCells(`B${r}:I${r}`); const sg = ws.getCell(`B${r}`); sg.value = String(p.semnatar).trim(); sg.font = { bold: true }; r++; }

    // foaie "Calculator" – ca în ofertele tale: total, TVA, avans (formule vii)
    {
      const wc = wb.addWorksheet("Calculator"); wc.getColumn(1).width = 34; wc.getColumn(2).width = 20; wc.getColumn(3).width = 12;
      wc.getCell("A1").value = "📊 Calculator"; wc.getCell("A1").font = { bold: true, size: 14 };
      const rows = [["Valoare ofertă fără TVA", { formula: `OFERTA!H${rSub}`, result: sub }, LEI], ["Cota TVA", tv, "0%"], ["TVA", { formula: "B3*B4", result: sub * tv }, LEI], ["TOTAL CU TVA", { formula: "B3+B5", result: sub * (1 + tv) }, LEI], ["Avans (%)", av, "0%"], ["Avans cu TVA", { formula: "B6*B7", result: sub * (1 + tv) * av }, LEI], ["Rest la recepție", { formula: "B6-B8", result: sub * (1 + tv) * (1 - av) }, LEI]];
      rows.forEach((x, i) => { const rr = 3 + i; wc.getCell(`A${rr}`).value = x[0]; wc.getCell(`B${rr}`).value = x[1]; wc.getCell(`B${rr}`).numFmt = x[2]; wc.getCell(`A${rr}`).border = box; wc.getCell(`B${rr}`).border = box; });
      ["B4", "B7"].forEach(a => fill(wc.getCell(a), CREAM)); wc.getCell("A6").font = wc.getCell("B6").font = { bold: true };
      wc.getCell("A11").value = "Celulele crem se pot modifica (TVA, avans)."; wc.getCell("A11").font = { italic: true, color: { argb: "FF64748B" } };
    }

    if (opt.anexa !== false && st.items && st.items.length) {
      const wa = wb.addWorksheet("ANEXA CANTITATI", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
      [6, 16, 70, 8, 10, 16, 16].forEach((w, i) => wa.getColumn(i + 1).width = w);
      wa.mergeCells("A1:G1"); wa.getCell("A1").value = "ANEXĂ – detaliu cantități și prețuri unitare (manoperă, fără TVA)"; wa.getCell("A1").font = { bold: true, size: 13 };
      wa.addRow(["Nr.", "Cod", "Descriere", "UM", "Cantitate", "Preț unitar (lei)", "Total (lei)"]).eachCell(c => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; fill(c, NAVY); c.border = box; });
      let n = 0, cur = null;
      const total = it => r2((+it.cant || 0) * r2((+it.pret || 0) * (1 + (st.adaos || 0) / 100)));
      (st.items.some(it => it.ord != null) ? st.items.slice().sort((a, b) => (a.ord || 0) - (b.ord || 0)) : st.items.slice().sort((a, b) => String(a.cap).localeCompare(String(b.cap), "ro", { numeric: true }))).forEach(it => {
        if (it.cap !== cur) { cur = it.cap; const rr = wa.addRow([cur]); wa.mergeCells(`A${rr.number}:G${rr.number}`); rr.getCell(1).font = { bold: true }; fill(rr.getCell(1), GREY); }
        const unit = Math.round((+it.pret || 0) * (1 + (st.adaos || 0) / 100) * 1e8) / 1e8;   // până la 8 zecimale (de obicei 2): așa cantitate × preț dă exact valoarea de pe rând și după „alt total”
        const rr = wa.addRow([++n, it.cod, it.den, it.um, it.cant, it.pret > 0 ? unit : null, it.pret > 0 ? (it.tot != null ? it.tot : total(it)) : null]);
        rr.eachCell(c => c.border = box); rr.getCell(3).alignment = { wrapText: true, vertical: "top" };
        rr.getCell(6).numFmt = "#,##0.00######"; rr.getCell(7).numFmt = NUM; rr.getCell(5).numFmt = "#,##0.##";
      });
      wa.views = [{ state: "frozen", ySplit: 2 }];
    }
    return wb;
  }

  /** Ofertă scurtă în stilul „Listă” al proprietarului. st: {proj, chap:[{name,value}]} */
  function exportShort(ExcelJS, st) {
    const p = st.proj, wb = new ExcelJS.Workbook(); wb.creator = firmShort(p.firma) || "Ofertare"; wb.created = new Date();
    const ws = wb.addWorksheet("Lista", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.getColumn(1).width = 58; ws.getColumn(2).width = 20;
    let r = 1; const line = (t, o) => { ws.mergeCells(`A${r}:B${r}`); const c = ws.getCell(`A${r}`); c.value = t; c.font = Object.assign({ name: "Calibri", size: 11 }, o && o.font); c.alignment = Object.assign({ wrapText: true, vertical: "top" }, o && o.al); if (o && o.h) ws.getRow(r).height = o.h; r++; return c; };
    line(p.firma || "", { font: { bold: true, size: 12 } });
    line(p.firmaCif || "");
    if (p.firmaAdresa) line(p.firmaAdresa);
    line(p.firmaContact || "");
    if (p.iban) line("IBAN: " + p.iban);
    r++;
    line("Oferta " + (p.santier || ""), { font: { bold: true, size: 14 } });
    { const nr = String(p.nrOferta || "").trim(), dt = readDate(p.data); if (nr || dt) line((nr ? "Nr. " + nr : "") + (nr && dt ? " din " : "") + (dt ? (nr ? "" : "Data: ") + fmtDate(dt) : "")); }
    r++;
    const sub = st.chap.reduce((a, c) => a + c.value, 0);
    const hd = ws.getRow(r); hd.getCell(1).value = "Articol"; hd.getCell(2).value = "Cost"; [1, 2].forEach(k => { const c = hd.getCell(k); c.font = { bold: true }; c.border = box; fill(c, GREY); }); hd.getCell(2).alignment = { horizontal: "right" }; r++;
    const r0 = r;
    st.chap.filter(c => c.value !== 0).forEach(c => { ws.getCell(r, 1).value = c.name; ws.getCell(r, 2).value = c.value; ws.getCell(r, 2).numFmt = '#,##0.00" lei"'; ws.getCell(r, 1).border = box; ws.getCell(r, 2).border = box; ws.getCell(r, 1).alignment = { wrapText: true }; r++; });
    const r1 = r - 1;
    ws.getCell(r, 1).value = "Total"; ws.getCell(r, 2).value = r1 >= r0 ? { formula: `SUM(B${r0}:B${r1})`, result: sub } : 0;   // fără niciun rând: 0 scris, nu o formulă care se adună pe ea însăși ws.getCell(r, 2).numFmt = '#,##0.00" lei"';
    [1, 2].forEach(k => { const c = ws.getCell(r, k); c.font = { bold: true, size: 12 }; c.border = box; fill(c, AMBER); }); r += 2;
    const inc = String(p.includeTxt || "").split("\n").map(x => x.trim()).filter(Boolean);
    if (inc.length) { line("OFERTA INCLUDE", { font: { bold: true } }); inc.forEach(x => line(x.startsWith("-") ? x : "-" + x)); r++; }
    const nu = String(p.nuInclude || "").split("\n").map(x => x.trim()).filter(Boolean);
    if (nu.length) { line("OFERTA NU INCLUDE", { font: { bold: true } }); nu.forEach(x => line(x.startsWith("-") ? x : "-" + x)); r++; }
    line("Valabilitate oferta: " + cu(+p.valab > 0 ? Math.round(+p.valab) : 30, "o zi", "zile")); r++;
    if (String(p.clauza || "").trim()) { line(String(p.clauza).trim(), { h: 32 }); r++; }
    line("In speranta ca oferta noastra intruneste toate cerintele, asteptam raspunsul dumneavoastra.", { h: 32 }); r++;
    line("Cu stimă,"); line(p.semnatar || "", { font: { bold: true } });
    return wb;
  }
  const api = { exportOffer, exportShort, readDate, fmtDate }; if (typeof module !== "undefined" && module.exports) module.exports = api; else root.OFX = api;
})(typeof window !== "undefined" ? window : globalThis);

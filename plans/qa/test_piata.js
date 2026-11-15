/* T1: reperele de piață noi sunt folosite la prețuri (nivel „după piață”). */
const OF = require("/home/claude/ofertare/docs/scv/ofertare/core.js");
const P = require("/home/claude/ofertare/docs/scv/ofertare/piata.json");
let ok = 0, bad = 0; const fail = []; const t = (n, c, info) => { if (c) ok++; else { bad++; fail.push(n + (info ? " → " + info : "")); } };
const S = []; P.lista.forEach((p, i) => { const v = +p.eng || +p.tipic || (p.min && p.max ? (p.min + p.max) / 2 : 0); if (p.fam && v > 0) S.push({ den: p.lucrare, fam: p.fam, vars: p.vars, um: String(p.um || "").replace(/^lei\//, "").replace("m2", "mp"), pret: v, q: OF.QUAL.mkt, lab: "piață", id: "m" + i }); });
const T = OF.buildTarif(S);
const price = (den, um) => { const r = OF.priceItem({ den, um }, T); return r ? [r.p, r.lv] : null; };
t("164 repere", P.lista.length >= 164, P.lista.length);
t("toate noile au sursă și nr. surse", P.lista.filter(p => p.data === "2026-11").every(p => p.surse && p.surse.length && p.n === p.surse.length));
for (const [den, um, lo, hi] of [["Montaj bideu", "buc", 150, 350], ["Montaj centrală în condensație 24 kW", "buc", 800, 1500], ["Filtru magnetic DN20", "buc", 150, 400], ["Montaj cadru WC încastrat", "buc", 250, 900], ["Robinet termostatat 1/2", "buc", 80, 200], ["Deplasare", "buc", 40, 120]]) {
  const r = price(den, um); t("preț piață: " + den, r && r[0] >= lo && r[0] <= hi, JSON.stringify(r));
}
t("nu pune preț de piață pe „Traseu WC” fără familie", !P.lista.find(p => /^Traseu pentru vas WC/.test(p.lucrare)).fam);
console.log(`piata: ${ok} trecute, ${bad} picate`); fail.forEach(f => console.log("  ✗ " + f)); process.exitCode = bad ? 1 : 0;

// Clasificare: cazurile din recenzia a doua + comparația cu producția pe tot corpusul (2.696 de texte)
const NEW = require("/home/claude/ofertare/docs/scv/ofertare/core.js"), OLD = require("./core_old.js");
let ok = 0, bad = 0; const eq = (n, a, b) => { if (a === b) ok++; else { bad++; console.log("  ✗", n, "→", a, "≠", b); } };
const C = [
  ["Boiler indirect cu serpentina racordat la centrala termica", "boiler"], ["Boiler termoelectric 100 l racordat la centrala murala", "boiler"],
  ["Boiler bivalent 300 l pentru panouri solare", "boiler"], ["Vas de expansiune solar 18 l pentru panouri solare", "vas_exp"],
  ["Pompa de circulatie circuit panouri solare", "pompa"], ["Teava cupru pentru racordare panouri solare", "teava:cu", "m"],
  ["Teava multistrat 16x2 de la centrala termica", "teava:mst", "m"], ["Teava PPR 20 mm racord centrala termica", "teava:ppr", "m"],
  ["Racord flexibil pentru centrala termica", "racord"], ["Robinet de gaz pentru centrala termica", "rob_trecere"],
  ["Separator hidraulic centrala termica", "boiler"], ["Montaj radiator cu robinet coltar tur si retur", "radiator"],
  ["Robinet tur calorifer coltar 1/2", "rob_trecere"], ["Robinet termostatat coltar 1/2", "rob_termo"],
  ["Racord flexibil lavoar 1/2 cu robinet coltar", "racord"], ["Cot coltar 90 grade", "fiting"], ["Teava PPR pentru robinet coltar", "teava:ppr", "m"],
  // ce trebuia rezolvat în prima recenzie rămâne rezolvat
  ["Centrala de detectie gaz metan", "gaz"], ["Centrala detectie gaze cu 4 zone", "gaz"], ["Kit evacuare centrala condens", null],
  ["Centrala termica in condensare 24 kW", "cazan"], ["Montaj centrala murala pe gaz", "cazan"], ["Panouri solare fotovoltaice 450W", null],
  ["Panou solar termic plan 2,5 mp", "solar"], ["Set de racordare panouri solare", "racord"], ["Suport panouri solare", "fixare"],
  ["Coltar aluminiu pentru faianta", null, "m"], ["Profil coltar", null, "m"], ["Robinet coltar 1/2 x 3/8", "rob_coltar"], ["Coltar 1/2 cu filtru", "rob_coltar"],
  ["TERMOMETRU (DREPT SAU COLTAR) CU APARATOARE", "termometru"], ["ROBINET DE REGLAJ, DREPT SAU COLTAR, MONT. INAINTEA ARMATURILOR", "rob_reglaj"],
];
for (const [d, f, u] of C) eq(d, NEW.classify(d, u || "buc").fam, f);
// corpusul: schimbările față de producție trebuie să fie doar cele aprobate
const OKCH = new Set(["rob_trecere>clapeta_sens", "∅>cazan", "boiler>dedurizator", "radiator>rob_coltar", "∅>solar", "teava:ol>teava:zn", "rob_trecere>rob_coltar", "∅>fiting", "gaz>cazan", "fiting>racord"]);
const corp = require("./corpus.json"), ch = {};
for (const t of corp) { const a = OLD.classify(t, "buc").fam, b = NEW.classify(t, "buc").fam; if (a !== b) { const k = (a || "∅") + ">" + (b || "∅"); (ch[k] = ch[k] || []).push(t.slice(0, 90)); } }
for (const k of Object.keys(ch)) eq("corpus " + k + " (" + ch[k].length + "): " + ch[k][0], OKCH.has(k), true);
console.log(`clasificare: ${ok} trecute, ${bad} picate · schimbări în corpus față de producție: ${Object.values(ch).reduce((a, x) => a + x.length, 0)}`); process.exitCode = bad ? 1 : 0;

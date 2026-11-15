/* Teste node pentru core.js – sinonime, familii noi, coduri de normă. Rulează: node /home/claude/qa/test_core.js */
const OF = require("/home/claude/ofertare/docs/scv/ofertare/core.js");
let ok = 0, bad = 0; const fail = [];
const eq = (name, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { bad++; fail.push(name + ": " + JSON.stringify(a) + " ≠ " + JSON.stringify(b)); } };
const fam = (d, u) => { const c = OF.classify(d, u || "buc"); return c && c.fam; };
// T2 – familii și sinonime
eq("bideu", fam("Montaj bideu"), "bideu");
eq("filtru magnetic", fam("Filtru magnetic DN20"), "filtru_y");
eq("filtru mecanic", fam("Filtru mecanic 1\""), "filtru_y");
eq("centrala condensatie", fam("Montaj centrală în condensație 24 kW"), "cazan");
eq("centrala electrica", fam("Centrală electrică 12 kW"), "cazan");
eq("centrala tratare ramane ventilatie", fam("Centrală de tratare a aerului"), "vent");
eq("puffer", fam("Montaj puffer 500 l"), "boiler");
eq("dedurizator", fam("Stație de dedurizare"), "dedurizator");
eq("osmoza", fam("Osmoză inversă"), "dedurizator");
eq("panou solar", fam("Panou solar termic"), "solar");
eq("colector solar", fam("Colector solar plan"), "solar");
eq("distribuitor ramane", fam("Distribuitor 6 circuite"), "distribuitor");
eq("grup siguranta", fam("Grup de siguranță boiler"), "supapa_sig");
eq("olandez", fam("Olandez 1\""), "racord");
eq("holender", fam("Holender 3/4"), "racord");
eq("buson", fam("Bușon 1/2"), "fiting");
eq("coltar", fam("Colțar 1/2 x 3/8"), "rob_coltar");
eq("ventil de sens", fam("Ventil de sens 1 1/4"), "clapeta_sens");
eq("deplasare", fam("Deplasare București"), "transport");
eq("moloz", fam("Evacuare moloz", "mc"), "terasament");
eq("slit", fam("Spargere și refacere șanț în zidărie", "ml"), "slit");
eq("slituire", fam("Șlițuire perete pentru conducte", "ml"), "slit");
eq("mobilier baie", fam("Montaj mobilier de baie"), "accesorii");
eq("lavoar ramane", fam("Montaj lavoar"), "lavoar");
eq("vas wc ramane", fam("Montaj vas WC"), "vas_wc");
// materiale de țeavă
eq("metaloplast", fam("Țeavă metaloplast 20x2", "ml"), "teava:mst");
eq("pexal", fam("Țeavă pexal 16x2", "ml"), "teava:mst");
eq("galvanizat", fam("Țeavă oțel galvanizat 1\"", "ml"), "teava:zn");
eq("fonoabsorbant", fam("Țeavă canalizare fonoabsorbantă DN110", "ml"), "teava:pp");
// T3 – coduri de normă: indiciu când textul e scurt
eq("cod SA01A02", (OF.normHint("SA01A02") || {}).fam, "teava:ppr");
eq("cod SA01A02 dn", (OF.normHint("SA01A02") || {}).sz, 20);
eq("cod IC07A01", (OF.normHint("IC07A01") || {}).fam, "fixare");
eq("cod SD27B1", (OF.normHint("SD27B1") || {}).fam, "hidrant_int");
eq("cod SF02A1", (OF.normHint("SF02A1") || {}).fam, "proba");
eq("cod SF04A1", (OF.normHint("SF04A1") || {}).fam, "spalare");
eq("cod necunoscut", OF.normHint("XX99"), null);
console.log(`core: ${ok} trecute, ${bad} picate`); fail.forEach(f => console.log("  ✗ " + f)); process.exitCode = bad ? 1 : 0;
// T3 – codul de normă folosit la preț când textul e neclar
{
  const S = [{ den: "Țeavă PPR montată", fam: "teava:ppr", um: "ml", pret: 35, q: OF.QUAL.mkt, lab: "piață", id: "m1" }];
  const T = OF.buildTarif(S);
  const r = OF.priceItem({ den: "Conductă", um: "m", cod: "SA01A02" }, T);
  eq("preț după cod", !!(r && r.p > 0), true);
  eq("de ce: cod", !!(r && /codul SA01A02/.test(r.why)), true);
  eq("fără cod: nimic", OF.priceItem({ den: "Conductă", um: "m" }, T), null);
  console.log(`core+cod: ${ok} trecute, ${bad} picate`); fail.forEach(f => console.log("  ✗ " + f)); process.exitCode = bad ? 1 : 0;
}

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
eq("moloz rămâne cum era (inclus, nu la Săpături)", fam("Evacuare moloz", "mc"), null);
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
// verificate pe lista ta „Cez” (cod + descriere) și pe devize publice
eq("cod SA04C zincat 1\"", JSON.stringify(OF.normHint("SA04C")), JSON.stringify({ fam: "teava:zn", sz: 25 }));
eq("cod SA03F zincat 2\"", (OF.normHint("SA03F") || {}).sz, 50);
eq("cod SA14E PPR 40 mm = DN32", JSON.stringify(OF.normHint("SA14E")), JSON.stringify({ fam: "teava:ppr", sz: 32 }));
eq("cod SD27B1", (OF.normHint("SD27B1") || {}).fam, "hidrant_int");
eq("cod SF02A probă apă rece", (OF.normHint("SF02A") || {}).fam, "proba");
eq("cod SF04A probă canalizare", (OF.normHint("SF04A") || {}).fam, "proba");
eq("cod SF05A spălare", (OF.normHint("SF05A") || {}).fam, "spalare");
eq("cod IC39B distribuitor", (OF.normHint("IC39B") || {}).fam, "distribuitor");
eq("cod neverificat SA01A02: nu ghicim", OF.normHint("SA01A02"), null);
eq("cod reparații RpIC19E: nu", OF.normHint("RpIC19E"), null);
eq("cod necunoscut", OF.normHint("XX99"), null);
console.log(`core: ${ok} trecute, ${bad} picate`); fail.forEach(f => console.log("  ✗ " + f)); process.exitCode = bad ? 1 : 0;
// T3 – codul de normă folosit la preț când textul e neclar
{
  const S = [{ den: "Țeavă PPR montată", fam: "teava:ppr", um: "ml", pret: 35, q: OF.QUAL.mkt, lab: "piață", id: "m1" }];
  const T = OF.buildTarif(S);
  const r = OF.priceItem({ den: "Conductă", um: "m", cod: "SA14C" }, T);
  eq("preț după cod", !!(r && r.p > 0), true);
  eq("de ce: cod", !!(r && /codul SA14C/.test(r.why)), true);
  eq("fără cod: nimic", OF.priceItem({ den: "Conductă", um: "m" }, T), null);
  const T2 = OF.buildTarif([{ den: "Demontare conducte", fam: "demontare", um: "m", pret: 8 }, { den: "Țeavă PPR 25", fam: "teava:ppr", um: "m", pret: 35.5 }]);
  const r2 = OF.priceItem({ den: "Demontare teava existenta", um: "m", cod: "SA14C" }, T2);
  eq("codul nu trece peste o lucrare recunoscută (demontare)", r2 && r2.p, 8);
  console.log(`core+cod: ${ok} trecute, ${bad} picate`); fail.forEach(f => console.log("  ✗ " + f)); process.exitCode = bad ? 1 : 0;
}

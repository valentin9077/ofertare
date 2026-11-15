// condițiile de lucru: adaosul salvat e mereu cel adevărat; condiții agățate de pe versiunea veche nu se mai arată
const fs = require("fs"), src = fs.readFileSync("/home/claude/ofertare/docs/scv/ofertare/app.js", "utf8");
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const grab = name => { const i = src.indexOf("const " + name + " = "); let d = 0, j = src.indexOf("=>", i), seen = false; for (; j < src.length; j++) { const ch = src[j]; if (ch === "{" || ch === "(") { d++; seen = true; } else if (ch === "}" || ch === ")") d--; if (seen && d === 0 && src[j + 1] === ";") break; } return src.slice(i, j + 2) + "\n"; };
let st = {}; eval(grab("condAdaos") + grab("condOf") + grab("condK") + "global.condAdaos=condAdaos;global.condOf=condOf;global.condK=condK;");
let ok = 0, bad = 0; const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { bad++; console.log("  ✗", n, JSON.stringify(a), "≠", JSON.stringify(b)); } };
eq("fără condiții", condOf({ adaos: 7.125 }), { adm: 7.125, acc: 0, urg: 0 });
eq("cu condiții valabile", condOf({ adaos: 21, cond: { adm: 10, acc: 10, urg: 0 } }), { adm: 10, acc: 10, urg: 0 });
eq("factor rânduri scrise (acces+urgent)", r2(condK({ adaos: 37.5, cond: { adm: 0, acc: 10, urg: 25 } })), 1.38);
eq("adaos schimbat pe versiunea veche: condițiile vechi cad", condOf({ adaos: 15, cond: { adm: 10, acc: 10, urg: 0 } }), { adm: 15, acc: 0, urg: 0 });
eq("… și rândurile scrise nu mai primesc factor", condK({ adaos: 15, cond: { adm: 10, acc: 10, urg: 0 } }), 1);
console.log(`condiții: ${ok} trecute, ${bad} picate`); process.exitCode = bad ? 1 : 0;

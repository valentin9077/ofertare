/* Miez comun: potrivire cantități ↔ catalog de prețuri + calcule. Rulează în browser și în node. */
(function (root) {
  const strip = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[øØ∅⌀]/g, "d").replace(/[“”„"']/g, "").replace(/\s+/g, " ").trim();

  function umFamily(u) {
    u = strip(u).replace(/\./g, "");
    if (/^(m|ml|metri|m liniar|ml\.?)$/.test(u)) return "m";
    if (/^(mp|m2)$/.test(u)) return "mp"; if (/^(mc|m3)$/.test(u)) return "mc"; if (u === "kg") return "kg";
    if (/^(buc|bucati|ans|ansamblu|sistem|sisteme|grup|set|kit|cmp|complet|punct|probe|proba)$/.test(u)) return "buc";
    return u || "buc";
  }

  /* ====================== POTRIVIRE: familii de denumiri + dimensiune ======================
     Fiecare poziție (din lista de cantități, din catalog, din ofertele vechi) e încadrată într-o FAMILIE
     (ex. „robinet de trecere” = de sectorizare = cu sferă = cu bilă = de separație; „fixare” = brățară = bridă = colier)
     și primește o dimensiune (DN, grosime de izolație, lungime de calorifer). Două poziții se potrivesc dacă au
     aceeași familie, același material (la țevi) și aceeași unitate de măsură; „sigur” doar dacă și dimensiunea e aceeași. */
  const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/¼/g, " 1/4").replace(/½/g, " 1/2").replace(/¾/g, " 3/4")
    .replace(/[“”„″‟]|''|’’|‘‘|``|´´/g, '"').replace(/[’‘´`]/g, "'")
    .replace(/\bD[eE] ?(?=\d{2,3}(?!\d))/g, " ø").replace(/\b[OF] ?(?=\d{1,3}(?:[ \/".,x-]|$|mm))/g, " ø").replace(/[øØ∅⌀ΦφϕФ]/g, " ø")
    .toLowerCase().replace(/_/g, " ").replace(/\b([12])([13])\/([248])(?!\d)/g, "$1 $2/$3").replace(/\s+/g, " ").trim();

  const INCH = { "1/4": 8, "3/8": 10, "1/2": 15, "3/4": 20, "1": 25, "1 1/4": 32, "1 1/2": 40, "2": 50, "2 1/2": 65, "3": 80, "4": 100, "5": 125, "6": 150, "8": 200 };
  const DE2DN = { 16: 12, 17: 12, 18: 12, 20: 15, 25: 20, 32: 25, 40: 32, 50: 40, 63: 50, 75: 65, 90: 80, 110: 100, 125: 125, 140: 125, 160: 150, 200: 200, 250: 250, 315: 300, 400: 400 };
  const DNS = [8, 10, 12, 15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 400];
  const SEWER = new Set([32, 40, 50, 75, 90, 110, 125, 160, 200, 250, 315, 400]);
  const OD2DN = [[21.3, 15], [26.9, 20], [33.7, 25], [42.4, 32], [48.3, 40], [60.3, 50], [76.1, 65], [88.9, 80], [114.3, 100], [139.7, 125], [168.3, 150], [219.1, 200]];
  const DN_LABEL = { 8: '1/4"', 10: '3/8"', 15: '1/2"', 20: '3/4"', 25: '1"', 32: '1 1/4"', 40: '1 1/2"', 50: '2"', 65: '2 1/2"', 80: '3"', 100: '4"' };
  function toDn(n, kind, cls) {
    if (cls === "sewer") return SEWER.has(n) ? DE2DN[n] : (DNS.includes(n) ? n : null);
    if (cls === "plastic") return kind === "dn" && DNS.includes(n) ? n : (DE2DN[n] || (DNS.includes(n) ? n : null));
    if (Number.isInteger(n) && DNS.includes(n)) return n;
    for (const [od, dn] of OD2DN) if (Math.abs(od - n) < 1.3) return dn;
    return kind !== "dn" && DE2DN[n] ? DE2DN[n] : null;
  }
  /** Diametrele nominale (DN) găsite într-o denumire deja normalizată. cls: "plastic" | "sewer" | "metal". */
  function sizes(t, cls) {
    const out = []; const add = v => { if (v && !out.includes(v)) out.push(v); }; let m;
    const reIn = /(\d \d\/\d|\d\/\d|\b\d)\s?(?:"|toli?\b|inch)/g; while ((m = reIn.exec(t))) add(INCH[m[1]]);
    const reFr = /(?:ø|\bdn|\bd ?[.=]) ?(\d \d\/\d|\d\/\d)(?!\d)/g; while ((m = reFr.exec(t))) add(INCH[m[1]]);
    const reDn = /\bdn ?\.? ?(\d{2,3})(?![\d/])/g; while ((m = reDn.exec(t))) add(toDn(+m[1], "dn", cls));
    const rePh = /(?:ø|\bd ?[.=]|\bdiametru\w* ?(?:de |nominal )?:?) ?(\d{2,3}(?:[.,]\d)?)(?![\d/])/g;
    while ((m = rePh.exec(t))) add(toDn(parseFloat(m[1].replace(",", ".")), "o", cls));
    return out;
  }
  function sizesShort(t, cls) {
    if (t.length > 48) return [];
    const out = []; let m;
    const reF = /(?:^| )(\d \d\/\d|\d\/\d)(?= |$)/g; while ((m = reF.exec(t))) if (INCH[m[1]]) out.push(INCH[m[1]]);
    if (!out.length) { const reM = /(?:^| )(\d{2,3})(?= |$|\+)/g; while ((m = reM.exec(t))) { const v = toDn(+m[1], "o", cls); if (v) out.push(v); } }
    if (!out.length) { m = /(?<!nr|pn|x) ([1-6])(?= toli?\b| tol\b|$| (?!cai|bazine|cuve|circuite|strat|buc|bar|ml\b|m\b))/.exec(t); if (m && INCH[m[1]] && !/\b(?:nr|pn) ?\d/.test(t.slice(Math.max(0, m.index - 3), m.index + 1))) out.push(INCH[m[1]]); }
    return out.filter((v, i) => out.indexOf(v) === i);
  }
  const thickOf = t => { const m = /(?:grosim\w*|\bs) ?(?:de|=|:)? ?(\d{1,3}) ?mm/.exec(t) || /\b(\d{1,2}) ?mm\b/.exec(t); return m ? +m[1] : null; };
  function radOf(t) {
    const h = /(?:\bh ?= ?|inaltime\w*(?: totala)?(?: de)? ?)(\d{3,4})/.exec(t), l = /(?:\bl ?= ?|lungime\w*(?: de)? ?)(\d{3,4})/.exec(t);
    return h || l ? { h: h ? +h[1] : null, l: l ? +l[1] : null } : null;
  }

  /* Materialul țevii: cel scris primul după cuvântul „țeavă/conductă”. */
  const MATS = [
    ["ppr", "PPR", /\bpp-?r\b|polifuziune/], ["pex", "PEX", /\bpe-?x\w?\b|\bpex\w?\b|reticulat/], ["mst", "multistrat", /multistrat|pex-?al/],
    ["cu", "cupru", /\bcupru\b/], ["zn", "oțel zincat", /zincat|\bol ?-?zn\b/], ["inox", "inox", /\binox/],
    ["pehd", "PEHD", /\bpe-?hd\b|\bpeid\b|\bpe ?100\b|\bpe ?80\b|polietilena de inalta/], ["pvc", "PVC", /\bpvc\b/], ["pp", "PP", /\bpp\b|polipropilena/],
    ["fonta", "fontă", /\bfonta\b/], ["ol", "oțel", /\botel\b|\bol\b|\bneagra\b|\bnegre\b|sudat/],
  ];
  function pipeMat(t) {
    const head = t.slice(0, 150); let best = null, bi = 1e9;
    for (const m of MATS) { const x = m[2].exec(head); if (x && x.index < bi) { bi = x.index; best = m; } }
    if (best && best[0] === "ol" && /zincat|\bol ?-?zn\b/.test(head)) best = MATS[4];
    if (!best) return null;
    let cls = "metal";
    if (best[0] === "pvc" || best[0] === "pp") cls = "sewer";
    else if (best[0] === "pehd") cls = /pluvial|canaliz|menajer|scurger/.test(t) && !/\bpn ?\d/.test(head) ? "sewer" : "plastic";
    else if (["ppr", "pex", "mst"].includes(best[0])) cls = "plastic";
    return { id: best[0], label: best[1], cls };
  }

  /* Familiile. [id, nume afișat, grup, expresie, dimensiune]. Ordinea contează doar la egalitate de poziție în text:
     familia al cărei cuvânt apare PRIMUL în denumire câștigă („Lavoar … cu sifon” e lavoar, nu sifon). */
  const G = { s: "Sanitare", t: "Termice", h: "Hidranți", v: "Ventilație", c: "Climatizare", g: "Gaz", e: "Electrice", p: "Terasamente", x: "Diverse" };
  const FAMS = [
    // --- în afara meseriei de bază (recunoscute ca să nu primească din greșeală un preț de instalații)
    ["terasament", "Săpături și terasamente", "p", /\bsapatur|\bumplutur|imprastier|compactare|\budare|excavat|sprijinir|transportul? rutier|\bpamant|\bnisip\b|\bcamin\b|banda avertizoare/],
    ["clima_teava", "Țeavă frigorifică (cupru izolat)", "c", /^ø ?\d+[.,]\d+ ?(?:mm)? ?izolat|teava (?:de |din )?cupru|\btevi (?:de |din )?cupru/],
    ["clima", "Climatizare (split, VRF)", "c", /\bsplit\b|monosplit|multisplit|\bvrf\b|\bvrv\b|freon|agent frigorific|branch joint|kit distributie|unitat\w+ (?:interioar|exterioar)|compresor condensator|aer conditionat|cabluri de interconectare/],
    ["vent_clapeta", "Clapetă antifoc / de reglaj (ventilație)", "v", /clapet\w+ (?:rectangular|circular|antifoc|rezistent\w+ la foc|de reglaj|de aer)/],
    ["vent_tub_c", "Tubulatură circulară", "v", /tubulatur\w+ circular|canal\w* de aer circular(?! flexibil)|conduct\w+ de aer circular/],
    ["vent_tub_r", "Tubulatură rectangulară", "v", /tubulatur\w+ rectangular|canal\w* de aer rectangular|conduct\w+ de aer rectangular/],
    ["vent_flex", "Tubulatură flexibilă", "v", /tubulatur\w+ flexibil|canal\w* de aer circular flexibil|tub flexibil/],
    ["vent_grila", "Grile și anemostate", "v", /\bgril[ae]\b|anemostat|difuzor|\bvalv[ae] (?:cu con|de aspiratie|aspiratie|de evacuare)|priza de (?:aer|admisie)/],
    ["vent", "Ventilație (alte poziții)", "v", /tubulatur|canal\w* de aer|ventilator|\bcta\b|centrala de tratare|agregat de ventilare|recuperator|\bhota\b|\bhote\b|burduf|jacheting|piese speciale|debitului de aer|plenum|atenuator|conducte de aer/],
    ["gaz", "Instalație de gaze", "g", /\bgaz(?:e|elor)?\b/],
    ["electric", "Electrice", "e", /\bcablu|\bcabluri|\btablou\w* electric|energie electrica/],
    // --- lucrări
    ["demontare", "Demontări", "x", /\bdemonta|dezafect/],
    ["proba", "Probe de presiune / etanșeitate / funcționare", "x", /\bprob[ae]\b|\bprobei\b/],
    ["spalare", "Spălare și dezinfectare instalație", "x", /\bspalare\w*|dezinfect|desinfect/],
    ["pif", "Punere în funcțiune", "x", /puner\w+ in functiune|\bpif\b/],
    ["etans_foc", "Etanșări la foc (treceri prin pereți)", "x", /etansar\w+ (?:la )?foc|etansa foc|inchidere si etansare rezistent|matar\w+ ale strapunger|manson\w* antifoc|sistem agrementat de inchidere/],
    ["strapungere", "Străpungeri / carotări", "x", /strapunger|carotare/],
    ["gol", "Goluri în zidărie / planșeu", "x", /\bgol(?:uri)?\b/],
    ["piesa_trecere", "Piese de trecere etanșe", "x", /pies\w+ (?:de )?trecere|pies\w+ etans/],
    ["grund", "Grunduire / vopsire", "x", /grundui|\bgrund\b|vopsi|\bvopsea\b/],
    ["transport", "Transport materiale", "x", /\btransport/],
    ["eticheta", "Etichetare / plăcuțe", "x", /etichet|placut\w+ indicatoare/],
    // --- izolații
    ["izol_vata", "Izolație din vată minerală", "t", /izolati\w+ (?:termic\w+ )?(?:tip saltea|din vata)|vata minerala/, "thick"],
    ["izolatie", "Izolație pentru conducte (Armaflex, K-flex, cauciuc sintetic, elastomer)", "s", /\bizolati[ei]\b|\bizolare\w*|termoizolati|armaflex|k-?flex|elastomer/, "thick"],
    // --- obiecte sanitare (înaintea țevilor: „Tub cu gură de curățire”, „Rigolă duș”)
    ["curatire", "Piesă de curățire", "s", /pies\w+ (?:de )?curatire|tub cu gura de curatire|gura de curatire/, "dn"],
    ["receptor", "Receptor de terasă / gură de scurgere terasă", "s", /\breceptor|gur\w+ de scurgere (?:pentru|de|la) teras/, "dn"],
    ["sifon_pard", "Sifon de pardoseală / gură de scurgere", "s", /sifo\w+ (?:de )?pardoseala|gur\w+ de scurgere/, "dn"],
    ["rigola", "Rigolă de duș", "s", /\brigol/],
    ["aerator", "Aerator cu membrană (canalizare)", "s", /\baerator/, "dn"],
    ["caciula", "Căciulă de ventilație", "s", /caciul\w+ (?:de )?ventilati/, "dn"],
    ["garnitura", "Garnitură de etanșare", "s", /\bgarnitur/, "dn"],
    ["baterie", "Baterie (lavoar, spălător, duș)", "s", /\bbateri[ei]\b/],
    ["coloana_dus", "Coloană de duș", "s", /coloan\w+ de dus/],
    ["lavoar", "Lavoar", "s", /\blavoar/],
    ["rezervor_wc", "Rezervor WC îngropat", "s", /rezervor\w* (?:incastrat|ingropat|wc|de wc|(?:de )?apa pentru wc)|cadru (?:wc|incastrat)/],
    ["vas_wc", "Vas WC", "s", /\bvas\w* (?:de )?wc\b|\bwc\b|closet/],
    ["pisoar", "Pisoar", "s", /\bpisoar/],
    ["cada", "Cadă / cădiță / cabină de duș", "s", /\bcada\b|\bcazi\b|cadit|cabin\w+ (?:de )?dus/],
    ["spalator", "Spălător / chiuvetă", "s", /\bspalator|chiuvet/],
    ["accesorii", "Accesorii baie (oglindă, portprosop, săpunieră)", "s", /\boglin|port-?prosop|port-?hartie|sapunier|etajer|dispenser|uscator de maini|bar\w+ (?:de )?sprijin/],
    // --- hidranți
    ["hidrant_ext", "Hidrant exterior", "h", /hidran\w+ exterior|hidran\w+ suprateran|hidran\w+ subteran/],
    ["distr_hidranti", "Distribuitor hidranți", "h", /distribuitor\w* hidran/],
    ["grup_pompare", "Grup de pompare", "t", /grup\w* (?:de )?pompare|statie (?:de )?pompare/],
    ["hidrant_int", "Hidrant interior (cutie completă)", "h", /hidran\w+ interior|cutie\w* (?:de )?hidran|\bhidrant\b/],
    ["stingator", "Stingător", "h", /stingato/],
    ["pichet", "Pichet / panou PSI", "h", /\bpichet|panou psi/],
    ["storz", "Cuplaj Storz", "h", /\bstorz\b/, "dn"],
    ["sorb", "Sorb", "h", /\bsorb\b/, "dn"],
    // --- armături
    ["rob_coltar", "Robinet colțar", "s", /robine\w+ coltar|rob\.? ?coltar/, "dn"],
    ["rob_golire", "Robinet de golire", "s", /robine\w+ (?:de )?golire/, "dn"],
    ["rob_termo", "Robinet de calorifer tur (termostatat)", "t", /robine\w+ (?:de )?(?:calorifer|radiator) tur|robine\w+ termostat|cap\w* termostat/, "dn"],
    ["rob_retur", "Robinet de calorifer retur", "t", /robine\w+ (?:de )?(?:calorifer|radiator) retur|reglaj retur|detentor/, "dn"],
    ["rob_reglaj", "Robinet de reglaj / echilibrare", "t", /robine\w+ de (?:reglaj|echilibrare)|van\w+ de echilibrare/, "dn"],
    ["rob_plutitor", "Robinet cu plutitor", "s", /robine\w+ cu plutitor/, "dn"],
    ["vana_fluture", "Vană fluture", "s", /van\w+ (?:tip )?fluture/, "dn"],
    ["electrovana", "Electrovană", "s", /electrovan/, "dn"],
    ["vana_3c", "Vană cu 3 căi", "t", /van\w+ cu (?:3|trei) cai|\bv3c\b/, "dn"],
    ["vana_2c", "Vană cu 2 căi", "t", /van\w+ cu (?:2|doua) cai|\bv2c\b/, "dn"],
    ["vana_amestec", "Ventil / vană termostatică de amestec", "t", /(?:ventil|vana|vane) termostatic|van\w+ de amestec/, "dn"],
    ["rob_trecere", "Robinet de trecere (de sectorizare, cu sferă, cu bilă, de separație, de închidere)", "s",
      /robine\w+ (?:de )?(?:sectorizare|trecere|inchidere|izolare|separatie|separare)|robine\w+ (?:cu )?(?:sfera|bila)\b|robine\w+ sferic|van\w+ cu (?:sfera|bila)/, "dn"],
    ["clapeta_sens", "Clapetă de sens (supapă de sens, de reținere)", "s", /clapet\w+ (?:de )?(?:sens|retinere)|supap\w+ (?:de )?sens|clapet\w+ antiretur/, "dn"],
    ["filtru_y", "Filtru de impurități (tip Y)", "s", /filtru\w* (?:de )?impuritati|filtru\w* (?:tip )?"?y\b|filtru\w* (?:cu )?sita/, "dn"],
    ["supapa_sig", "Supapă de siguranță", "s", /supap\w+ (?:de )?siguranta/, "dn"],
    ["aerisitor", "Aerisitor (dezaerator, ventil de aerisire)", "t", /aerisitor|dezaerator|ventil\w* (?:automat\w* )?de aerisire|robine\w+ de aerisire/, "dn"],
    ["manometru", "Manometru", "s", /\bmanometr/],
    ["termometru", "Termometru", "t", /\btermometr/],
    ["senzor", "Senzor / termostat", "t", /\bsenzor|\btermostat\b|\bsonda\b/],
    ["antivibrant", "Racord / manșon antivibrant", "s", /(?:manson|racord|compensator)\w* (?:de )?antivibra|compensator/, "dn"],
    ["reductor", "Reductor / regulator de presiune", "s", /(?:reductor|regulator)\w* (?:de )?presiune/, "dn"],
    ["contor", "Apometru / contor / debitmetru", "s", /apometr|\bcontor|debitmetr/, "dn"],
    // --- termice
    ["rad_baie", "Radiator de baie (portprosop)", "t", /radiato\w+ (?:de )?baie|radiato\w+ portprosop|calorifer\w* (?:de )?baie/],
    ["rad_electric", "Radiator electric", "t", /radiato\w+ electric|convecto\w+ electric/],
    ["radiator", "Radiator / calorifer", "t", /\bradiato|\bcalorifer/, "rad"],
    ["ventilo", "Ventiloconvector", "t", /ventilo-?convecto/],
    ["distribuitor", "Distribuitor / colector", "t", /distribuitor|\bcolector/],
    ["vas_exp", "Vas de expansiune", "t", /\bvas\w* (?:de )?expansiune/],
    ["pompa", "Pompă", "t", /\bpomp[aei]\b|\bpompele\b|electropomp/],
    ["cazan", "Centrală termică / cazan", "t", /\bcazan|centrala termica|centrala murala|sursa (?:de )?preparare agent/],
    ["boiler", "Boiler / rezervor", "t", /\bboiler|\brezervor|\bbazin\b|\bseparator\b|butelie de egalizare|statie de dedurizare/],
    ["pardoseala", "Încălzire în pardoseală (plăci, bandă, țeavă)", "t", /incalzire in pardoseala|placa (?:cu )?nuturi|banda perimetrala|aditiv (?:beton|sapa)|curba conducatoare/],
    // --- fixări (brățară = bridă = colier = clemă; suporți)
    ["fixare", "Fixare conducte: brățări, bride, coliere, cleme, suporți", "s", /\bbratar[aiă]|\bbratari\b|\bbrid[ae]\b|\bbride\b|\bcolier|\bclem[ae]\b|\bcleme\b|\bsuport[i]?\b|dispozitive de (?:sustinere|fixare)|\bconsol[ae]\b|\bconsole\b/, "dn"],
    // --- fitinguri mărunte
    ["racord", "Racord (olandez, eurocon, flexibil)", "s", /\bracord/, "dn"],
    ["fiting", "Fitinguri (cot, teu, mufă, reducție, niplu, dop)", "s", /\bcot\b|\bcoturi\b|\bcurba\b|\bteu\b|\bteuri\b|\bmuf[ae]\b|\bmufe\b|reducti[ei]|\bnipl[ue]|\bdop\b|\bdopuri\b|\bflans[ae]\b/, "dn"],
    // --- țevi (la urmă: multe denumiri conțin „țeavă” în descriere)
    ["rob_trecere", "", "s", /\brobineti?\b(?! (?:de )?(?:hidrant|incendiu))/, "dn"],
    ["tub_protectie", "Tub / țeavă de protecție", "s", /(?:tub|teava|tevi)\w* (?:de )?protectie/, "dn"],
    ["teava", "Țeavă", "s", /\bteav[ai]\b|\btevi\b|\bconduct[ae]\b|\btub\b|\btuburi\b|coloane si distributie/, "dn"],
  ];
  const FAM = Object.fromEntries(FAMS.filter(f => f[1]).map(f => [f[0], f]));
  /* Familii prea largi ca să primească singure un preț (doar denumirea identică, învățată, le potrivește). */
  const NOMATCH = new Set(["terasament", "clima", "clima_teava", "vent", "vent_clapeta", "vent_tub_c", "vent_tub_r", "vent_flex", "vent_grila", "gaz", "electric",
    "demontare", "eticheta", "transport", "grund", "pif", "gol", "teava", "fiting", "racord", "garnitura"]);
  /* Familii la care prețul depinde mult de aparat: se dă doar sugestie, niciodată preț pus singur. */
  const SOFT = new Set(["strapungere", "etans_foc", "piesa_trecere", "pompa", "cazan", "boiler", "vas_exp", "grup_pompare", "distribuitor", "senzor", "pardoseala",
    "izol_vata", "accesorii", "rad_baie", "rad_electric", "ventilo", "hidrant_ext", "contor", "antivibrant", "reductor"]);
  /* Cuvinte care deosebesc variantele din aceeași familie (cu prețuri diferite). */
  const VARIANTS = [["dizabilitati", /dizabilit|handicap/], ["suspendat", /suspendat/], ["inox", /\binox/], ["fonta", /\bfonta\b/], ["pvc", /\bpvc\b/], ["pehd", /\bpe-?hd\b|\bpeid\b/],
    ["pp", /\bpp\b(?!-?r)|polipropilena/], ["antiseismic", /antiseismic/], ["co2", /\bco2\b/], ["p50", /\bp ?50\b|transportabil/], ["fotocelula", /fotocel|senzor/],
    ["pluvial", /pluvial/], ["canalizare", /canaliz|menajer/], ["hidrant", /hidran|\bpsi\b|incendiu/], ["coloane", /\bcoloan/], ["de radiator", /radiator|calorifer/],
    ["lavoar", /\blavoar/], ["spalator", /\bspalator|chiuvet/], ["wc", /\bwc\b/], ["pisoar", /\bpisoar/], ["dus", /\bdus\b/], ["presemnalizare", /presemnaliz/],
    ["motorizat", /motoriz|servomotor/], ["dilatare", /dilatare/], ["functionare", /functionare|eficacitate/], ["solar", /\bsolar/], ["terasa", /\bteras/]];

  /** Încadrarea unei denumiri: familie, material (la țevi), dimensiune, cuvinte de variantă. */
  const EQUIP = new Set(["boiler", "pompa", "cazan", "senzor", "vas_exp", "distribuitor"]);
  const BOILER = /^(?:(?:idem|procurare si montaj|procurare si montare|procurare si|furnizare si montaj|furnizare si montare|montaj|montare|efectuarea?|realizare|executie|p\d+|\d+[.)])[ ,;:-]*)+/;
  const HEAD = 48;   // cuvântul care dă familia trebuie să fie la începutul denumirii, nu în descrierea de după
  function classify(den, um) {
    const full = norm(den), t = full.replace(BOILER, ""); let fam = null, at = 1e9;
    for (const f of FAMS) { const m = f[3].exec(t); if (m && m.index < at) { at = m.index; fam = f; } }
    if (fam && (at > HEAD || (EQUIP.has(fam[0]) && at > 14))) fam = null;
    // o poziție care vorbește de split/VRF/freon ori de tubulatură de aer ține de climatizare / ventilație, orice cuvânt ar avea la început
    const h90 = t.slice(0, 90);
    if (fam && fam[2] !== "c" && /\b(?:mono|multi)?split\b|\bvrf\b|\bvrv\b|freon|frigorific/.test(h90)) fam = FAM.clima;
    else if (fam && fam[2] !== "v" && /tubulatur|conduct\w+ de aer|\bcta\b|gur\w+ de aer/.test(h90)) fam = FAM.vent;
    const o = { t, fam: fam ? fam[0] : null, grp: fam ? fam[2] : null, um: umFamily(um), dn: [], mat: null, thick: null, rad: null, vars: [] };
    if (!fam) return o;
    let cls = "metal";
    if (fam[0] === "teava" || fam[0] === "tub_protectie") { const m = pipeMat(t.slice(at)); if (m) { o.mat = m.id; cls = m.cls; if (fam[0] === "teava") o.fam = "teava:" + m.id; } }
    else if (["curatire", "sifon_pard", "receptor", "caciula", "aerator"].includes(fam[0])) cls = "sewer";
    if (fam[4] === "dn") { o.dn = sizes(t, cls); if (!o.dn.length) o.dn = sizesShort(t, cls); }
    else if (fam[4] === "thick") o.thick = thickOf(t);
    else if (fam[4] === "rad") o.rad = radOf(t);
    const isPipe = o.fam.startsWith("teava:");
    // la țevi contează doar la ce folosește țeava (pluvial, canalizare, hidranți, solar), nu restul cuvintelor din descriere
    o.vars = VARIANTS.filter(v => (!isPipe || ["pluvial", "canalizare", "hidrant", "solar"].includes(v[0])) && v[1].test(t.slice(0, 220))).map(v => v[0]);
    return o;
  }
  /** Numele familiei, pentru afișare („Țeavă PPR”, „Robinet de trecere (…)”). */
  function famLabel(id) {
    if (!id) return "";
    if (id.startsWith("teava:")) { const m = MATS.find(x => x[0] === id.slice(6)); return "Țeavă " + (m ? m[1] : ""); }
    return FAM[id] ? FAM[id][1] : id;
  }
  /** Denumirea unei poziții din catalog, cu dimensiunea adăugată dacă lipsește din nume („ROBINETI” → „ROBINETI DN25 (1")”). */
  function entryLabel(c) {
    const f = c.f || classify((c.desc ? c.desc + " | " : "") + c.den, c.um); let x = "";
    if (!/\d/.test(c.den)) { if (f.dn && f.dn.length) x = " " + f.dn.map(dnLabel).join("/"); else if (f.rad && f.rad.l) x = " " + (f.rad.h ? "H" + f.rad.h + " " : "") + "L" + f.rad.l; else if (f.thick != null) x = " " + f.thick + " mm"; }
    return c.den + x;
  }
  /** Lista familiilor care primesc preț, pe grupe – pentru panoul „Denumiri asimilate”. */
  function famList() { return FAMS.filter(f => f[1] && (!NOMATCH.has(f[0]) || f[0] === "teava")).map(f => ({ id: f[0], label: f[0] === "teava" ? "Țeavă (pe materiale: PPR, PEX, oțel, oțel zincat, PEHD, PP, PVC, cupru)" : f[1], grp: G[f[2]], soft: SOFT.has(f[0]) })); }
  const MV = 2;   // versiunea regulilor de potrivire; când crește, proiectele deschise își refac singure potrivirea
  const dnLabel = dn => "DN" + dn + (DN_LABEL[dn] ? " (" + DN_LABEL[dn] + ")" : "");

  function feats(den, um) { const c = classify(den, um); return Object.assign(c, { s: strip(den), fam0: c.fam, kinds: new Set(c.fam ? [c.fam] : []), mats: new Set(c.mat ? [c.mat] : []), dia: new Set(c.dn), words: new Set() }); }
  function score(fi, fc) { return fi.fam && fi.fam === fc.fam && fi.um === fc.um ? 3 : 0; }
  function keyOf(den) { return strip(den).replace(/[^a-z0-9]+/g, " ").trim(); }
  const domOf = c => { const s = strip((c.dom || "") + " " + (c.sec || "")); return /hidrant|psi|incend|stingere/.test(s) ? "h" : /termic|incalzire|radiato/.test(s) ? "t" : /sanitar|canaliz|pluvial/.test(s) ? "s" : /ventil/.test(s) ? "v" : ""; };
  const domOfCap = cap => { const s = strip(cap || ""); return /hidrant/.test(s) ? "h" : /termic|camera tehnica|ventiloconv|incalzire/.test(s) ? "t" : /sanitar|pluvial|canaliz/.test(s) ? "s" : /ventilat/.test(s) ? "v" : ""; };

  /** Pregătește catalogul: fiecare poziție e încadrată o dată. La pozițiile cu descriere, descrierea e cea care contează
      (în unele liste denumirea scurtă e uneori doar „ROBINETI” sau „Teava PPR”, iar diametrul e în descriere). */
  function prepCatalog(cat) {
    return cat.map(c => {
      const full = c.desc && String(c.desc).trim() ? c.desc + " | " + c.den : c.den;
      let f = classify(full, c.um);
      const fd = classify(c.den, c.um);
      if (!f.fam || (fd.fam && f.fam !== fd.fam && !(c.desc && String(c.desc).trim().length > 12))) f = fd;
      if (f.fam && fd.fam === f.fam) { for (const d of fd.dn) if (!f.dn.includes(d)) f.dn.push(d); if (f.thick == null) f.thick = fd.thick; if (!f.rad) f.rad = fd.rad; }
      return Object.assign({}, c, { key: c.learned ? keyOf(c.den) : "", f, d: domOf(c) });
    });
  }

  const idx = dn => { const i = DNS.indexOf(dn); return i < 0 ? 99 : i; };
  /** Cât de bine se potrivește dimensiunea: 3 = aceeași, 2 = niciuna nu are dimensiune, 1.5 = catalogul are un preț general,
      1 = poziția nu spune dimensiunea, 0.x = altă dimensiune (cu cât mai departe, cu atât mai puțin). */
  function dimFit(a, b, kind) {
    if (kind === "dn") {
      if (a.dn.length && b.dn.length) { if (a.dn.some(d => b.dn.includes(d))) return 3; const dist = Math.min(...a.dn.map(x => Math.min(...b.dn.map(y => Math.abs(idx(x) - idx(y)))))); return Math.max(0.1, 0.9 - 0.12 * dist); }
      return !a.dn.length && !b.dn.length ? 2 : !b.dn.length ? 1.5 : 1;
    }
    if (kind === "thick") {
      if (a.thick != null && b.thick != null) return a.thick === b.thick ? 3 : Math.max(0.1, 0.9 - Math.abs(a.thick - b.thick) / 80);
      return a.thick == null && b.thick == null ? 2 : b.thick == null ? 1.5 : 1;
    }
    if (kind === "rad") {
      if (a.rad && b.rad && a.rad.l && b.rad.l) { if (a.rad.l === b.rad.l && (!a.rad.h || !b.rad.h || a.rad.h === b.rad.h)) return 3; return Math.max(0.1, 0.9 - Math.abs(a.rad.l - b.rad.l) / 4000 - (a.rad.h && b.rad.h && a.rad.h !== b.rad.h ? 0.2 : 0)); }
      return !a.rad && !b.rad ? 2 : !b.rad ? 1.5 : 1;
    }
    return 2;
  }
  const varFit = (a, b) => { const I = a.vars, C = b.vars; return I.filter(v => C.includes(v)).length - 0.5 * C.filter(v => !I.includes(v)).length - 0.25 * I.filter(v => !C.includes(v)).length; };

  /** Potrivește o poziție cu catalogul. Întoarce {id, score, sure, exact, why} sau null.
      sure = aceeași familie, aceeași unitate, aceeași dimensiune și nicio îndoială între variante cu prețuri diferite. */
  function matchItem(item, pcat) {
    const sk = keyOf(item.den), fam = umFamily(item.um);
    for (const c of pcat) if (c.key && c.key === sk && c.f.um === fam) return { id: c.id, score: 99, sure: true, exact: true, why: "aceeași denumire, preț pus de tine" };
    const fi = classify(item.den, item.um); if (!fi.fam || NOMATCH.has(fi.fam)) return null;
    const kind = fi.fam.startsWith("teava:") ? "dn" : (FAM[fi.fam] || [])[4];
    // domeniul poziției: hidranții se recunosc după familie sau capitol; altfel după foaia din fișier, apoi după capitolul ales
    const dItem = (FAM[fi.fam] || [])[2] === "h" || domOfCap(item.cap) === "h" ? "h" : (domOfCap(item.cap0) || domOfCap(item.cap));
    const cand = [];
    for (const c of pcat) {
      if (c.f.fam !== fi.fam || c.f.um !== fi.um || !(+c.pret > 0)) continue;
      const dim = dimFit(fi, c.f, kind); if (dim < 0.6) continue;            // mai mult de două trepte de diametru: nu mai e o sugestie bună
      const dom = c.learned ? 2 : (dItem && c.d && dItem === c.d ? 1 : (!dItem || !c.d ? 0.5 : 0));
      cand.push({ c, dim, dom, v: varFit(fi, c.f) });
    }
    if (!cand.length) return null;
    cand.sort((x, y) => (y.dim >= 3) - (x.dim >= 3) || y.dom - x.dom || y.dim - x.dim || y.v - x.v);
    const top = cand[0], peers = cand.filter(x => x.dim === top.dim && x.dom === top.dom);
    const bestV = Math.max(...peers.map(x => x.v)), best = peers.filter(x => x.v === bestV);
    best.sort((x, y) => (+y.c.an || 0) - (+x.c.an || 0));
    const pick = best[0], samePrice = peers.every(x => +x.c.pret === +pick.c.pret);
    const cleanVar = fi.vars.every(v => pick.c.f.vars.includes(v)) && pick.c.f.vars.every(v => fi.vars.includes(v));
    const dimOk = pick.dim >= 3 || (pick.dim === 2 && !kind);
    const perUnit = (fi.fam === "proba" || fi.fam === "spalare") && fi.um !== "m";      // probă „pe ansamblu”: prețul din listă e pe metru
    const sure = dimOk && pick.dom > 0 && !SOFT.has(fi.fam) && !perUnit && ((samePrice && (peers.length > 1 || cleanVar)) || (best.length === 1 && cleanVar));
    let why = famLabel(fi.fam).replace(/ \(.*$/, "").replace(/:.*$/, "");   // numele scurt al familiei
    if (pick.dim >= 3 && kind === "dn") why += ", " + dnLabel(fi.dn.find(d => pick.c.f.dn.includes(d)));
    else if (pick.dim >= 3 && kind === "thick") why += ", " + fi.thick + " mm";
    else if (pick.dim < 1 && kind === "dn") why += ": în catalog e " + pick.c.f.dn.map(dnLabel).join("/") + ", aici " + fi.dn.map(dnLabel).join("/");
    else if (pick.dim < 1 && kind === "thick") why += ": în catalog e " + pick.c.f.thick + " mm, aici " + fi.thick + " mm";
    else if (pick.dim < 1 && kind === "rad") why += ": altă lungime";
    else if (pick.dim === 1) why += ": aici nu scrie dimensiunea";
    else if (pick.dim === 1.5) why += ": preț general din catalog";
    if (!sure && dimOk && pick.dom === 0) why += "; prețul e de la alt fel de instalație";
    else if (!sure && dimOk && !samePrice && best.length > 1) why += "; mai multe variante în catalog";
    else if (!sure && dimOk && !cleanVar) why += "; altă variantă";
    else if (!sure && dimOk && (SOFT.has(fi.fam) || perUnit)) why += "; de verificat";
    return { id: pick.c.id, score: 3 + pick.dim + pick.dom, sure, why, fam: fi.fam, near: pick.dim < 2 };
  }

  const r2 = x => Math.round((+x + Number.EPSILON) * 100) / 100;
  function total(it, adaos) { return r2((+it.cant || 0) * r2((+it.pret || 0) * (1 + (adaos || 0) / 100))); }

  function chapters(items, adaos) {
    const m = new Map();
    for (const it of items) {
      const k = it.cap || "FĂRĂ CAPITOL";
      const c = m.get(k) || { cap: k, total: 0, n: 0, fara: 0 };
      c.n++; if (!(it.pret > 0)) c.fara++; c.total += total(it, adaos); m.set(k, c);
    }
    return [...m.values()].map(c => (c.total = r2(c.total), c));
  }

  /** Verificare „nu intru în faliment”: cost estimat vs. ofertă. */
  function risc(o) {
    const ore = o.muncitori * o.zile * o.oreZi, manopera = ore * o.costOra;
    const cost = manopera + (o.deplasare || 0) + (o.materiale || 0);
    const profit = o.oferta - cost;
    return { ore, manopera: r2(manopera), cost: r2(cost), profit: r2(profit), marja: o.oferta ? profit / o.oferta : 0 };
  }


  /* Capitolele „ale tale” (din ofertele tale anterioare) */
  const CAPS = [
    ["Hidranți", /hidrant|stingator|pichet|stingere|sprinkl/],
    ["Instalații ventiloconvectoare", /ventiloconvector|ventilo-?convector|caseta (de )?(perete|tavan|pardoseala)|\bcasete\b/],
    ["Climatizare", /clima|split|multisplit|\bvrf\b|agent frigorific|cupru|unitate (interioara|exterioara)/],
    ["Ventilație", /ventilat|tubulatura|grila|anemostat|clapeta|difuzor|recuperator|\bhota\b|atenuator/],
    ["Cameră tehnică (centrală, panouri solare, pompe)", /centrala termica|panou(ri)? solar|boiler|hidrofor|grup(uri)? (de )?pompare|\bpompa|vas (de )?expansiune|distribuitor|colector|cazan|schimbator|rezervor|separator|bazin|statie|dedurizator|lampa uv|apometru|electrovana|pachet sistem solar/],
    ["Pluviale", /pluvial|burlan|jgheab/],
    ["Instalații termice", /calorifer|radiator|incalzire|pe-?x|pardoseala|convector|agent termic|termostat/],
    ["Instalații sanitare", /sanitar|lavoar|\bwc\b|pisoar|\bdus\b|cada|chiuveta|bideu|apa (rece|calda|potabila)|\bppr\b|pehd|canalizare|menajer|pvc-kg/],
  ];
  function autoCap(den, sheetCap) {
    const s = strip(den);
    for (const [name, re] of CAPS) if (re.test(s)) return name;
    return /sanitar/i.test(strip(sheetCap)) ? "Instalații sanitare" : "Instalații termice";
  }
  /** Număr de aparate (orientativ) pentru „OFERTA INCLUDE” și comparația pe aparat. */
  function counts(items) {
    const sum = (re, ex) => items.reduce((a, it) => { const s = strip(it.den); return a + (re.test(s) && !(ex && ex.test(s)) && umFamily(it.um) === "buc" ? +it.cant || 0 : 0); }, 0);
    const EX = /robinet|sifon|racord|flexibil|bateri|rezervor|bride|set |suport|conso|valv|vana|electric|filtru|pompa|izolat/;
    return {
      calorifere: sum(/radiator|calorifer/, EX),
      obiecte: sum(/lavoar|vas wc|\bwc\b|pisoar|cada|chiuveta|bideu|cabina dus|cap dus|\bdus\b/, EX),
      cuti: sum(/hidrant/, /exterior|racord|robinet|furtun|vana|clapet|suport|panou/),
      ventilo: sum(/ventiloconvector|ventilo-?convector|\bcaseta\b/, EX),
    };
  }
  /* Prețuri pe aparat deduse din ofertele tale de manoperă (total capitol ÷ număr aparate din „OFERTA INCLUDE”). */
  const HIST = {};

  const api = { CAPS, autoCap, counts, HIST, keyOf, strip, norm, feats, score, classify, famLabel, dnLabel, entryLabel, famList, MV, sizes, FAMS, G, prepCatalog, matchItem, total, chapters, risc, r2, umFamily };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.OF = api;
})(typeof window !== "undefined" ? window : globalThis);

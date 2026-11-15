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
  /* „ans”, „sistem”, „instalație”: o sumă pe tot, nu un preț pe bucată sau pe metru */
  function isLump(u) { return /^(ans|ansamblu|ansamblul|sistem|sisteme|instalatie|instalatia|lot|gl|global|ls|ft|forfetar)$/.test(strip(u).replace(/\./g, "")); }
  const WORKFAM = new Set(["proba", "spalare", "pif", "eticheta", "demontare", "vent", "vent_tub_c", "vent_tub_r", "vent_flex", "vent_grila", "vent_clapeta", "teava", "izolatie", "izol_vata", "pardoseala", "pard_acc", "strapungere", "etans_foc", "terasament", "curatire", "fixare", "tub_protectie", "grund", "gaz", "electric", "transport", "gol", "fiting", "racord", "garnitura", "clima_teava", "piesa"]);

  /* ====================== POTRIVIRE: familii de denumiri + dimensiune ======================
     Fiecare poziție (din lista de cantități, din catalog, din ofertele vechi) e încadrată într-o FAMILIE
     (ex. „robinet de trecere” = de sectorizare = cu sferă = cu bilă = de separație; „fixare” = brățară = bridă = colier)
     și primește o dimensiune (DN, grosime de izolație, lungime de calorifer). Două poziții se potrivesc dacă au
     aceeași familie, același material (la țevi) și aceeași unitate de măsură; „sigur” doar dacă și dimensiunea e aceeași. */
  const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/¼/g, " 1/4").replace(/½/g, " 1/2").replace(/¾/g, " 3/4")
    .replace(/[“”„″‟]|''|’’|‘‘|``|´´/g, '"').replace(/[’‘´`]/g, "'")
    .replace(/\bD[eE] ?(?=\d{2,3}(?!\d))/g, " ø").replace(/\bD ?(?=\d{2,3}(?![\d.,]))/g, " ø").replace(/\b[OF] ?(?=\d{1,3}(?:[ \/".,x-]|$|mm))/g, " ø").replace(/[øØ∅⌀ΦφϕФ]/g, " ø")
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
    if (!out.length) { m = /(?:^| )(\d{2,3}) ?[x×] ?\d{1,3}(?:[.,]\d)?(?![\d.,])/.exec(t); if (m) add(toDn(+m[1], "o", cls)); }   // „110x10”, „Cot 20x90”: primul număr e diametrul
    return out;
  }
  function sizesShort(t, cls) {
    if (t.length > 48) return [];
    t = t.replace(/\b(?:pn|cod|nr|art|sdr|sn|tip|clasa)\.? ?\d+(?:[.,]\d+)?\b/g, " ").replace(/(?:^| )\d+(?:[.,]\d+)? ?(?:buc|bucati|ml|mp|mc|kg|litri|l|kw|w|bar|grade|ore|zile|m)\b/g, " ");   // presiunea, codul și cantitățile nu sunt diametre
    const out = []; let m;
    const reF = /(?:^| )(\d \d\/\d|\d\/\d)(?= |$)/g; while ((m = reF.exec(t))) if (INCH[m[1]]) out.push(INCH[m[1]]);
    if (!out.length) { const reM = /(?:^| )(\d{2,3})(?= |$|\+)/g; while ((m = reM.exec(t))) { const v = toDn(+m[1], "o", cls); if (v) out.push(v); } }
    if (!out.length) { m = /(?<!nr|pn|x) ([1-6])(?= toli?\b| tol\b|$| (?!cai|bazine|cuve|circuite|strat|buc|bar|ml\b|m\b))/.exec(t); if (m && INCH[m[1]] && !/\b(?:nr|pn) ?\d/.test(t.slice(Math.max(0, m.index - 3), m.index + 1))) out.push(INCH[m[1]]); }
    return out.filter((v, i) => out.indexOf(v) === i);
  }
  const mmOf = t => { const m = /ø ?(\d{1,4}(?:[.,]\d{1,2})?)/.exec(t) || /(\d{1,4}(?:[.,]\d{1,2})?) ?mm\b/.exec(t); return m ? parseFloat(m[1].replace(",", ".")) : null; };
  const thickOf = t => { const m = /(?:grosim\w*|\bs) ?(?:de|=|:)? ?(\d{1,3}) ?mm/.exec(t) || /\b(\d{1,2}) ?mm\b/.exec(t); return m ? +m[1] : null; };
  function radOf(t) {
    const h = /(?:\bh ?=? ?|inaltime\w*(?: totala)?(?: de)? ?)(\d{3,4})(?!\d)/.exec(t), l = /(?:\bl ?=? ?|lungime\w*(?: de)? ?)(\d{3,4})(?!\d)/.exec(t);
    let H = h ? +h[1] : null, L = l ? +l[1] : null;
    if (!L) { const m = /(?:^|[^\d.,])(?:\d{2} ?[x×*] ?)?(\d{3}) ?[x×*\/] ?(\d{3,4})(?![\d.,])/.exec(t); if (m) { H = H || +m[1]; L = +m[2]; } }   // „22x600x1200”, „600/1000”
    if (!L) { const m = /\b(?:1[01]|2[012]|33) ?[\/x] ?(\d{3}) ?- ?(\d{3,4})(?![\d.,])/.exec(t); if (m) { H = H || +m[1]; L = +m[2]; } }   // „22/600-1400”
    return H || L ? { h: H, l: L } : null;
  }

  /* Materialul țevii: cel scris primul după cuvântul „țeavă/conductă”. */
  const MATS = [
    ["ppr", "PPR", /\bpp-?r\b|polifuziune|polipropilena random|\brandom\b/], ["pex", "PEX", /\bpe-?x\w?\b|\bpex\w?\b|reticulat/], ["mst", "multistrat", /multistrat|pex-?al/],
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
    ["piesa", "Piese și accesorii (sifon, capac, furtun, rozetă, set de fixare)", "s", /^(?:sifo\w+(?! (?:de )?pardoseala)|capac\w*|furtun\w*|rozet\w+|masc[aă]\w*|picior\w*|semipicior\w*|set\w* (?:de )?(?:fixare|prindere|montaj|suruburi)|surub\w*|ventil\w* (?:de )?scurgere|preaplin\w*)\b/],
    ["camin", "Cămin de vizitare / de vane", "s", /\bcamin\w*/],
    ["terasament", "Săpături și terasamente", "p", /\bsapatur|\bumplutur|imprastier|compactare|\budare|excavat|sprijinir|transportul? rutier|\bpamant|\bnisip\b|banda avertizoare/],
    ["clima_teava", "Țeavă frigorifică (cupru izolat)", "c", /^ø ?\d+[.,]\d+ ?(?:mm)? ?izolat|(?:teava|tevi|conduct[ae]) (?:de |din )?cupru\b(?=.{0,70}(?:izolat|frigorific|freon|6[.,]35|9[.,]52|12[.,]7|15[.,]88|19[.,]05|22[.,]2|28[.,]6))/, "mm"],
    ["pompa_caldura", "Pompă de căldură / chiller", "t", /pomp\w+ de caldura|\bchiller/],
    ["clima", "Climatizare (split, VRF)", "c", /\bsplit\b|monosplit|multisplit|\bvrf\b|\bvrv\b|freon|agent frigorific|branch joint|kit distributie|unitat\w+ (?:interioar|exterioar)|compresor condensator|aer conditionat|cabluri de interconectare/],
    ["vent_clapeta", "Clapetă antifoc / de reglaj (ventilație)", "v", /clapet\w+ (?:rectangular|circular|antifoc|rezistent\w+ la foc|de reglaj|de reglare|de aer|cu contragreutate)|registru\w* (?:de )?reglaj|clap\.? ?de regl/],
    ["vent_tub_c", "Tubulatură circulară", "v", /tubulatur\w+ circular|canal\w* de aer circular(?! flexibil)|conduct\w+ de aer circular/, "mm"],
    ["vent_tub_r", "Tubulatură rectangulară", "v", /tubulatur\w+ rectangular|canal\w* de aer rectangular|conduct\w+ de aer rectangular|canale drepte/],
    ["vent_flex", "Tubulatură flexibilă", "v", /tubulatur\w+ flexibil|canal\w* de aer circular flexibil|tub flexibil/, "mm"],
    ["vent_grila", "Grile și anemostate", "v", /\bgril[ae]\b|anemostat|difuzor|\bvalv[ae] (?:cu con|de aspiratie|aspiratie|de evacuare)|priza de (?:aer|admisie)|gur\w+ de (?:refulare|absorbtie)|ram\w+ (?:rectangular\w+ )?cu jaluzele/],
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
    ["caciula", "Căciulă de ventilație", "s", /caciul\w+ (?:de )?(?:ventila|protectie|prot\b)/, "dn"],
    ["garnitura", "Garnitură de etanșare", "s", /\bgarnitur/, "dn"],
    ["baterie", "Baterie (lavoar, spălător, duș)", "s", /\bbateri[ei]\b/],
    ["coloana_dus", "Coloană de duș", "s", /coloan\w+ de dus/],
    ["lavoar", "Lavoar", "s", /\blavoar/],
    ["rezervor_wc", "Rezervor WC îngropat", "s", /rezervor\w* (?:incastrat|ingropat|wc|de wc|(?:de )?apa pentru wc)|cadru (?:wc|incastrat)/],
    ["vas_wc", "Vas WC", "s", /\bvas\w* (?:de )?wc\b|\bwc\b|closet/],
    ["pisoar", "Pisoar", "s", /\bpisoar/],
    ["cada", "Cadă / cădiță / cabină de duș", "s", /\bcada\b|\bcazi\b|cadit|cabin\w+ (?:de )?dus/],
    ["spalator", "Spălător / chiuvetă", "s", /\bspalator|chiuvet/],
    ["accesorii", "Accesorii baie (oglindă, portprosop, săpunieră)", "s", /\boglin|port-?prosop|port-?hartie|sapunier|etajer|dispenser|uscator de m[ai]ini|bar\w+ (?:de )?sprijin/],
    // --- hidranți
    ["hidrant_ext", "Hidrant exterior", "h", /hidran\w+ exterior|hidran\w+ suprateran|hidran\w+ subteran/],
    ["distr_hidranti", "Distribuitor hidranți", "h", /distribuitor\w* hidran/],
    ["grup_pompare", "Grup de pompare", "t", /grup\w* (?:de )?pompare|statie (?:de )?pompare|grup\w* compact\w* de ridic/],
    ["rob_hidrant", "Robinet de hidrant", "h", /robine\w+ (?:de |pentru )?(?:hidrant|incendiu)/, "dn"],
    ["hidrant_int", "Hidrant interior (cutie completă)", "h", /hidran\w+ interior|cutie\w* (?:de )?hidran|\bhidrant\b/],
    ["sprinkler", "Sprinkler", "h", /sprinkler/],
    ["cuplaj", "Cuplaj canelat (Victaulic)", "h", /\bcupl[ae]j?\w* (?:flexibil\w* |rigid\w* )?(?:canelat|victaulic)|\bcuplaj(?! storz)|\bcupla (?:redusa )?\d/, "dn"],
    ["stingator", "Stingător", "h", /stingato/],
    ["pichet", "Pichet / panou PSI", "h", /\bpichet|panou psi/],
    ["storz", "Cuplaj Storz", "h", /\bstorz\b/, "dn"],
    ["sorb", "Sorb", "h", /\bsorb\b/, "dn"],
    // --- armături
    ["rob_coltar", "Robinet colțar", "s", /robine\w+ coltar|rob\.? ?coltar/, "dn"],
    ["rob_golire", "Robinet de golire", "s", /robine\w+ (?:de )?golire/, "dn"],
    ["rob_termo", "Robinet de calorifer tur (termostatat)", "t", /robine\w+ (?:de )?(?:calorifer|radiator) tur|robine\w+ termostat|cap\w* termostat/, "dn"],
    ["rob_retur", "Robinet de calorifer retur", "t", /robine\w+ (?:de )?(?:calorifer|radiator) retur|reglaj retur|detentor/, "dn"],
    ["rob_reglaj", "Robinet de reglaj / echilibrare", "t", /robine\w+ de (?:reglaj|echilibrare)|van\w+ de echilibrare|regulator\w* de (?:debit|echilibrare)/, "dn"],
    ["rob_plutitor", "Robinet cu plutitor", "s", /robine\w+ cu plutitor|plutito(?:r|are) (?:mecanic\w*|pentru alimentare)/, "dn"],
    ["vana_fluture", "Vană fluture", "s", /van\w+ (?:tip )?fluture/, "dn"],
    ["electrovana", "Electrovană", "s", /electrovan/, "dn"],
    ["vana_3c", "Vană cu 3 căi", "t", /van\w+ cu (?:3|trei) cai|\bv3c\b/, "dn"],
    ["vana_2c", "Vană cu 2 căi", "t", /van\w+ cu (?:2|doua) cai|\bv2c\b/, "dn"],
    ["vana_amestec", "Ventil / vană termostatică de amestec", "t", /(?:ventil|vana|vane) termostatic|van\w+ de amestec/, "dn"],
    ["rob_trecere", "Robinet de trecere (de sectorizare, cu sferă, cu bilă, de separație, de închidere)", "s",
      /robine\w+ (?:de )?(?:sectorizare|trecere|inchidere|izolare|separatie|separare)|robine\w+ (?:cu )?(?:sfera|bila)\b|robine\w+ sferic|van\w+ cu (?:sfera|bila)/, "dn"],
    ["clapeta_sens", "Clapetă de sens (supapă de sens, de reținere)", "s", /clapet\w+ (?:de )?(?:sens|retinere)|supap\w+ (?:de )?sens|clapet\w+ anti[ -]?retur/, "dn"],
    ["filtru_y", "Filtru de impurități (tip Y)", "s", /filtru\w* (?:de )?impuritati|filtru\w* (?:tip )?"?y\b|filtru\w* (?:cu )?sita|filtru\w* anticalcar/, "dn"],
    ["supapa_sig", "Supapă de siguranță", "s", /supap\w+ (?:de )?siguranta/, "dn"],
    ["aerisitor", "Aerisitor (dezaerator, ventil de aerisire)", "t", /aerisitor|dezaerator|ventil\w* (?:automat\w* )?de aerisire|robine\w+ de aerisire|\bpurjor/, "dn"],
    ["manometru", "Manometru", "s", /\bmanometr/],
    ["termometru", "Termometru", "t", /\btermometr/],
    ["senzor", "Senzor / termostat", "t", /\bsenzor|\btermostat\b|\bsonda\b|\bpreso?s?tat/],
    ["antivibrant", "Racord / manșon antivibrant", "s", /(?:manson|racord|compensator)\w* (?:de )?antivibra|compensator/, "dn"],
    ["reductor", "Reductor / regulator de presiune", "s", /(?:reductor|regulator)\w* (?:de )?presiune/, "dn"],
    ["contor", "Apometru / contor / debitmetru", "s", /apometr|\bcontor|\bcontoare\b|debitmetr/, "dn"],
    // --- termice
    ["rad_baie", "Radiator de baie (portprosop)", "t", /radiato\w+ (?:de )?baie|radiato\w+ portprosop|calorifer\w* (?:de )?baie/],
    ["rad_electric", "Radiator electric", "t", /radiato\w+ electric|convecto\w+ electric/],
    ["radiator", "Radiator / calorifer", "t", /\bradiato|\bcalorifer|convecto-?radiator/, "rad"],
    ["ventilo", "Ventiloconvector", "t", /ventilo-?convecto/],
    ["distribuitor", "Distribuitor / colector", "t", /distribuitor|distribuitro\b|\bcolector|caset\w+ de distributie/],
    ["vas_exp", "Vas de expansiune", "t", /\bvas\w* (?:de )?expansiune/],
    ["pompa", "Pompă", "t", /\bpomp[aei]\b|\bpompele\b|electropomp/],
    ["cazan", "Centrală termică / cazan", "t", /\bcazan|centrala termica|centrala murala|sursa (?:de )?preparare agent/],
    ["boiler", "Boiler / rezervor", "t", /\bboiler|\brezervor|\bbazin\b|\bseparator\b|butelie de egalizare|statie de dedurizare/],
    ["pard_acc", "Accesorii pentru încălzirea în pardoseală (plăci, bandă, curbe, aditiv)", "t", /plac\w+ (?:cu )?nuturi|banda perimetrala|aditiv (?:beton|sapa|pentru sapa)|curb\w+ conducatoare|clips\w* (?:de )?fixare|agraf/],
    ["pardoseala", "Încălzire în pardoseală (montaj complet)", "t", /incalzire in pardoseala/],
    // --- fixări (brățară = bridă = colier = clemă; suporți)
    ["fixare", "Fixare conducte: brățări, bride, coliere, cleme, suporți", "s", /\bbratar[aiă]|\bbratari\b|\bbrid[ae]\b|\bbride\b|\bcolier|\bclem[ae]\b|\bcleme\b|\bsuport[i]?\b|dispozitive de (?:sustinere|fixare)|elemente de sustinere|\bconsol[ae]\b|\bconsole\b/, "dn"],
    // --- fitinguri mărunte
    ["racord", "Racord (olandez, eurocon, flexibil)", "s", /\bracord(?!\w* (?:fix |tip |incendiu tip )?storz)/, "dn"],
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
    ["motorizat", /motoriz|servomotor/], ["canelat", /canelat|victaulic/], ["interioara", /unitat\w+ interioar/], ["exterioara", /unitat\w+ exterioar/], ["dilatare", /dilatare/], ["functionare", /functionare|eficacitate/], ["solar", /\bsolar/], ["terasa", /\bteras/]];

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
    let grpOver = null; const work = fam && /^(pif|proba|spalare|demontare|eticheta)$/.test(fam[0]);   // „PIF VRF”, „Demontare tubulatură”: rămân punere în funcțiune / demontare (nu primesc preț de montaj), dar țin de climatizare / ventilație
    if (fam && fam[2] !== "c" && /\b(?:mono|multi)?split\b|\bvrf\b|\bvrv\b|freon|frigorific/.test(h90)) { if (work) grpOver = "c"; else fam = FAM.clima; }
    else if (fam && fam[2] !== "v" && /tubulatur|conduct\w+ de aer|\bcta\b|gur\w+ de aer/.test(h90)) { if (work) grpOver = "v"; else fam = FAM.vent; }
    const o = { t, fam: fam ? fam[0] : null, grp: fam ? (grpOver || fam[2]) : null, um: umFamily(um), dn: [], mat: null, thick: null, rad: null, mm: null, vars: [] };
    if (!fam) return o;
    let cls = "metal";
    if (fam[0] === "teava" || fam[0] === "tub_protectie") { const m = pipeMat(t.slice(at)); if (m) { o.mat = m.id; cls = m.cls; o.cls = cls; if (fam[0] === "teava") o.fam = "teava:" + m.id; } }
    else if (["curatire", "sifon_pard", "receptor", "caciula", "aerator"].includes(fam[0])) cls = "sewer";
    if (fam[4] === "dn") { o.dn = sizes(t, cls); if (!o.dn.length) o.dn = sizesShort(t, cls); }
    else if (fam[4] === "thick") o.thick = thickOf(t);
    else if (fam[4] === "rad") o.rad = radOf(t);
    else if (fam[4] === "mm") o.mm = mmOf(t);
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
  const MV = 3;   // versiunea regulilor de potrivire; când crește, proiectele deschise își refac singure potrivirea
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

  const r2 = x => { const v = Math.round(+x * 1e6) / 1e4; return Math.round(v + (v >= 0 ? 1e-9 : -1e-9)) / 100; };   // la ban, cu jumătatea în sus (8,325 → 8,33), fără capcanele virgulei mobile

  /* ====================== MOTORUL DE PREȚURI ======================
     Toate prețurile cunoscute (ale tale, din ofertele vechi, din bugete, de pe piață) devin „puncte”: familie + unitate + dimensiune + preț.
     Pentru o poziție caut, în ordine: 1) aceeași denumire cu preț pus de tine; 2) aceeași lucrare și aceeași dimensiune;
     3) aceeași lucrare, altă dimensiune (socotesc prețul între cele două dimensiuni vecine); 4) o lucrare asemănătoare sau o sursă mai slabă;
     5) reper de piață. Fiecare preț pus spune de unde vine și cât de sigur e (lv 1…5). */
  const QUAL = { mine: 4, cat: 3, ref: 2, weak: 1, mkt: 0 };
  const KINDOF = fam => fam.startsWith("teava:") ? "dn" : (FAM[fam] || [])[4] || "";
  const sizeOf = (f, kind) => kind === "dn" ? (f.dn.length ? Math.max.apply(null, f.dn) : null) : kind === "thick" ? f.thick : kind === "rad" ? (f.rad && f.rad.l) || null : kind === "mm" ? f.mm : null;
  const SLOPE = { dn: 0.6, mm: 0.55, thick: 0.3, rad: 0.5 };
  /* Lucrări care se plătesc cam la fel (pentru când nu există niciun preț la lucrarea cerută). */
  const ALIKE = [
    ["rob_trecere", "clapeta_sens", "filtru_y", "rob_golire", "vana_fluture", "electrovana", "vana_2c", "vana_3c", "vana_amestec", "reductor", "supapa_sig", "rob_reglaj", "antivibrant", "rob_plutitor", "contor", "rob_hidrant"],
    ["lavoar", "spalator", "vas_wc", "pisoar", "cada"], ["radiator", "rad_baie", "rad_electric"], ["curatire", "sifon_pard", "receptor", "aerator", "caciula"],
    ["teava:ppr", "teava:pex", "teava:mst", "teava:cu"], ["teava:ol", "teava:zn", "teava:inox"], ["teava:pvc", "teava:pp", "teava:pehd", "teava:fonta"],
    ["vent_tub_c", "vent_flex"], ["boiler", "vas_exp"], ["cazan", "pompa_caldura"], ["hidrant_int", "hidrant_ext"], ["fiting", "cuplaj", "racord"],
  ];
  const alikeOf = fam => { const out = []; for (const g of ALIKE) if (g.includes(fam)) for (const x of g) if (x !== fam && !out.includes(x)) out.push(x); return out; };
  /* Familii la care prețul depinde mult de aparat sau de situație: prețul pus se arată mereu „de verificat”. */
  const LOOSE = new Set(["fiting", "racord", "garnitura", "gol", "transport", "electric", "gaz", "teava", "demontare", "eticheta", "grund", "pif", "terasament", "clima", "vent", "camin", "pompa_caldura", "pard_acc", "piesa"]);
  const med = a => { a = a.slice().sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0; };
  const nice = p => p < 20 ? Math.round(p * 10) / 10 : p < 200 ? Math.round(p * 2) / 2 : p < 2000 ? Math.round(p) : Math.round(p / 10) * 10;
  const f2 = n => (Math.round(n * 100) / 100).toLocaleString("ro-RO", { maximumFractionDigits: 2 });

  /** Tariful: lista de surse → puncte grupate pe familie și unitate.
      src: [{den, desc?, um, pret, q, an?, lab?, dom?, sec?, id?, learned?, lo?, hi?}]  (lo/hi = interval de DN la reperele de piață) */
  function buildTarif(src) {
    const T = { by: new Map(), name: new Map(), same: new Map(), n: 0 };
    for (const c of src) {
      if (!(+c.pret > 0)) continue;
      let f;
      if (c.fam) { const k0 = KINDOF(c.fam), z = +c.sz || null; f = { t: norm(c.den), fam: c.fam, um: umFamily(c.um), dn: k0 === "dn" && z ? [z] : [], thick: k0 === "thick" ? z : null, rad: k0 === "rad" && z ? { h: null, l: z } : null, mm: k0 === "mm" ? z : null, vars: c.vars || [] }; }
      else { const full = c.desc && String(c.desc).trim() ? c.desc + " | " + c.den : c.den; f = classify(full, c.um); const fd = classify(c.den, c.um);
        if (!f.fam || (fd.fam && f.fam !== fd.fam && !(c.desc && String(c.desc).trim().length > 12))) f = fd;
        if (f.fam && fd.fam === f.fam) { for (const d of fd.dn) if (!f.dn.includes(d)) f.dn.push(d); if (f.thick == null) f.thick = fd.thick; if (!f.rad) f.rad = fd.rad; if (f.mm == null) f.mm = fd.mm; } }
      if (c.learned) T.name.set(keyOf(c.den) + "|" + f.um, { p: +c.pret, id: c.id, lab: c.lab || "prețul tău" });
      else if ((c.q == null ? QUAL.ref : c.q) >= QUAL.ref) { const k0 = keyOf(c.desc && String(c.desc).trim().length > 14 ? c.desc : c.den) + "|" + f.um, o = T.same.get(k0); if (!o || (c.q || 0) > o.q || ((c.q || 0) === o.q && (+c.an || 0) > o.an)) T.same.set(k0, { p: +c.pret, id: c.id, lab: c.lab || "", q: c.q || 0, an: +c.an || 0 }); }
      if (!f.fam) continue;
      const kind = KINDOF(f.fam), pt = { fam: f.fam, f, kind, tk: toks(f.t || norm(c.den)), sz: sizeOf(f, kind), lo: c.lo || null, hi: c.hi || null, p: +c.pret, q: c.q == null ? QUAL.ref : c.q, an: +c.an || 0, lab: c.lab || "", d: c.d != null ? c.d : domOf(c), id: c.id, den: c.den, lump: isLump(c.um) };
      const k = f.fam + "|" + f.um; let a = T.by.get(k); if (!a) T.by.set(k, a = []); a.push(pt); T.n++;
    }
    return T;
  }
  const dnIdx = dn => { let b = 0, bd = 1e9; for (let i = 0; i < DNS.length; i++) { const d = Math.abs(DNS[i] - dn); if (d < bd) { bd = d; b = i; } } return b; };
  const szLabel = (kind, v) => kind === "dn" ? "DN" + v : kind === "thick" ? v + " mm" : kind === "rad" ? "L" + v : "Ø" + f2(v);
  /* prețul pentru mărimea x dintr-un șir (mărime → preț) */
  function interp(x, ser, kind) {
    ser.sort((a, b) => a.s - b.s); const n = ser.length; let lo = null, hi = null;
    for (const e of ser) { if (e.s <= x) lo = e; if (e.s >= x && !hi) hi = e; }
    const slope = (a, b) => Math.min(1.1, Math.max(0.15, Math.log(b.p / a.p) / Math.log(b.s / a.s)));
    if (lo && hi) { if (lo === hi) return { p: lo.p, a: lo, b: null }; const t = Math.log(x / lo.s) / Math.log(hi.s / lo.s); return { p: Math.exp(Math.log(lo.p) + t * Math.log(hi.p / lo.p)), a: lo, b: hi }; }
    const e = lo || hi; let al = SLOPE[kind] || 0.5;
    if (n >= 2) { const a = lo ? ser[n - 2] : ser[0], b = lo ? ser[n - 1] : ser[1]; if (b.s > a.s && a.p > 0 && b.p > 0 && b.p !== a.p) al = slope(a, b); }
    return { p: e.p * Math.pow(x / e.s, al), a: e, b: null, out: true };
  }
  /* cuvintele care spun ce lucrare e (fără „procurare”, „montaj”, „inclusiv”…), pentru asemănarea a două denumiri */
  const STOPW = new Set("procur monta monte inclu pentr avand diame presi compl echip confo proie carac tehni furni execu reali efect urmat nomin maxim minim clasa dimen mater acces neces toate fieca aferen".split(" "));
  const toks = t => { const o = []; for (const w of String(t).slice(0, 160).split(/[^a-z0-9]+/)) { if (w.length < 4 || /^\d/.test(w)) continue; const k = w.slice(0, 5); if (!STOPW.has(k) && !o.includes(k)) o.push(k); if (o.length >= 10) break; } return o; };
  const simOf = (a, b) => { if (!a.length || !b.length) return 0; let n = 0; for (const w of a) if (b.includes(w)) n++; const v = n / Math.sqrt(a.length * b.length); return a[0] === b[0] ? Math.max(v, 0.5) : v; };
  const okSize = (kind, fam, v) => v == null ? null : kind === "mm" ? (fam === "clima_teava" ? (v >= 4 && v <= 60 ? v : null) : (v >= 80 && v <= 2500 ? v : null)) : v;
  function pickIn(fi, pts, dItem, far) {
    if (!pts || !pts.length) return null;
    const kind = KINDOF(fi.fam); let x = okSize(kind, fi.fam, far ? sizeOf(fi, KINDOF(far)) : sizeOf(fi, kind)), assumed = 0;
    if (x == null && kind === "dn" && fi.fam.startsWith("teava:")) { x = fi.cls === "sewer" ? 100 : fi.cls === "plastic" ? 20 : 25; assumed = x; }   // țeavă fără diametru scris: socotesc ca pentru diametrul obișnuit
    const short = famLabel(far || fi.fam).replace(/ \(.*$/, "").replace(/:.*$/, ""), tk = toks(fi.t);
    const mm = a => [Math.min.apply(null, a), Math.max.apply(null, a)];
    for (const tier of [[3, 9], [2, 2], [1, 1], [0, 0]]) {            // 1) lista ta de prețuri; 2) alte oferte ale tale; 3) surse mai slabe (bugete, prețuri deduse); 4) piață
      const S = pts.filter(p => p.q >= tier[0] && p.q <= tier[1]); if (!S.length) continue;
      const sc = S.map(p => ({ p, sz: okSize(kind, fi.fam, p.sz), dm: p.q >= QUAL.mine ? 1 : (dItem && p.d ? (dItem === p.d ? 1 : 0) : 0.5), dv: varFit(fi, p.f), sim: Math.round(simOf(tk, p.tk) * 4) / 4 }));
      sc.forEach(e => { e.ex = !kind ? 1 : (x != null && (e.sz === x || (e.p.lo && x >= e.p.lo && x <= e.p.hi) || (kind === "dn" && fi.dn.some(d => e.p.f.dn.includes(d))))) ? 1 : 0; });
      const mineFirst = !!kind || !(LOOSE.has(fi.fam) || SOFT.has(fi.fam));        // la aceeași lucrare, prețul pus de tine bate lista, oricum ar fi scrisă denumirea
      const rank = (a, b) => b.dm - a.dm || b.dv - a.dv || (mineFirst ? (b.p.q >= QUAL.mine) - (a.p.q >= QUAL.mine) : 0) || b.sim - a.sim || b.p.q - a.p.q || b.p.an - a.p.an;
      const base = tier[0] >= 3 ? 0 : tier[0] === 2 ? 3 : tier[0] === 1 ? 4 : 5; let res = null;
      let E = sc.filter(e => e.ex).sort(rank);
      if (kind && E.length && E[0].dm === 0 && x != null) { const own = sc.filter(e => e.dm > 0 && e.sz != null).map(e => e.sz); if (own.length && x > Math.min.apply(null, own) && x < Math.max.apply(null, own)) E = []; }   // între două dimensiuni de la același fel de instalație: socotesc între ele; în afara lor: iau prețul tău de la dimensiunea exactă, chiar de la alt fel de instalație
      else if (kind && E.length && E[0].dv < 0 && sc.some(e => e.sz != null && e.dv >= 0 && e.dm >= E[0].dm)) E = [];   // aceeași dimensiune doar la altă variantă (ex. pluvial): socotesc din varianta bună      // aceeași dimensiune doar la alt fel de instalație: mai bine socotesc între dimensiunile vecine de la același fel
      if (E.length) {
        const t = E[0], same = E.filter(e => e.dm === t.dm && e.dv === t.dv), grp = same.filter(e => e.sim === t.sim && e.p.q === t.p.q && e.p.an === t.p.an), p = med(grp.map(e => e.p.p));
        const clean = fi.vars.every(v => t.p.f.vars.includes(v)) && t.p.f.vars.every(v => fi.vars.includes(v)), r = mm(same.map(e => e.p.p)), wide = r[1] / r[0] > 2.5;
        if (!kind && t.sim < 0.5 && (wide || LOOSE.has(fi.fam) || SOFT.has(fi.fam))) continue;   // aceeași familie, dar lucrări prea diferite între ele și niciuna care să semene: nu ghicesc
        res = { p, lv: t.dm > 0 && clean && !(!kind && (t.sim < 0.5 || (wide && t.sim < 0.75))) ? 2 : 3, pt: t.p, why: short + (kind && x != null ? ", " + szLabel(kind, x) : "") + (t.dm === 0 ? "; prețul tău pentru dimensiunea asta e de la alt fel de instalație" : !clean ? "; altă variantă" : !kind && wide ? "; ai prețuri diferite la lucrarea asta (" + f2(r[0]) + "–" + f2(r[1]) + " lei), l-am luat pe cel care seamănă cel mai mult" : "") };
      } else if (kind && x != null && sc.some(e => e.sz != null)) {
        const W = sc.filter(e => e.sz != null).sort(rank), t = W[0], G = W.filter(e => e.dm === t.dm && (e.dv >= 0) === (t.dv >= 0)), by = new Map();
        for (const e of G) { const o = by.get(e.sz); if (!o || rank(e, o) < 0) by.set(e.sz, e); }
        const ser = [...by.values()].map(e => ({ s: e.sz, p: e.p.p, pt: e.p })), r = interp(x, ser, kind);
        const steps = kind === "dn" ? Math.abs(dnIdx(x) - dnIdx(r.a.s)) : Math.abs(Math.log(x / r.a.s)) / 0.25;
        if (r.out) r.p = Math.min(r.a.p * 3, Math.max(r.a.p / 3, r.p));               // în afara dimensiunilor cunoscute nu mă depărtez de mai mult de 3 ori
        res = { p: nice(r.p), lv: r.out && steps > 2 ? 4 : 3, pt: r.a.pt, why: short + ": " + (r.b ? "socotit între " + szLabel(kind, r.a.s) + " (" + f2(r.a.p) + " lei) și " + szLabel(kind, r.b.s) + " (" + f2(r.b.p) + " lei)" : "socotit după " + szLabel(kind, r.a.s) + " (" + f2(r.a.p) + " lei); " + (sc.some(e => e.ex) ? "la " + szLabel(kind, x) + " ai preț doar la altă variantă sau la alt fel de instalație" : "nu ai preț la " + szLabel(kind, x))) };
      } else {
        const gen = sc.filter(e => e.sz == null).sort(rank), W = gen.length ? gen : sc.slice().sort(rank), t = W[0], G = W.filter(e => e.dm === t.dm), r = mm(G.map(e => e.p.p));
        if (t.sim < 0.5 && (r[1] / r[0] > 2.5 || LOOSE.has(fi.fam) || SOFT.has(fi.fam))) continue;
        if (gen.length) res = { p: med(G.filter(e => e.sim === t.sim && e.p.q === t.p.q).map(e => e.p.p)), lv: 3, pt: t.p, why: short + ": preț general" + (x == null && kind ? ", aici nu scrie dimensiunea" : kind && x != null && t.p.lo && (x < t.p.lo || x > t.p.hi) ? ", dat pentru " + szLabel(kind, t.p.lo) + "–" + szLabel(kind, t.p.hi) + ", nu pentru " + szLabel(kind, x) : "") };
        else { const ps = G.map(e => e.p.p).sort((a, b) => a - b), low = kind === "dn" || kind === "mm"; res = { p: nice(low ? med(ps.slice(0, Math.ceil(ps.length / 2))) : med(ps)), lv: 4, pt: t.p, why: short + ": aici nu scrie dimensiunea, am pus " + (low ? "prețul dimensiunilor mici" : "prețul mijlociu") + " (" + f2(r[0]) + "–" + f2(r[1]) + " lei)" }; }
      }
      if (assumed) { res.lv = Math.max(res.lv, 4); res.why = short + ": aici nu scrie diametrul, am socotit ca pentru DN" + assumed; }
      res.lv = Math.max(res.lv, base, far ? 4 : 0, LOOSE.has(fi.fam) || SOFT.has(fi.fam) ? 3 : 0);
      if (!kind && fi.um === "buc" && /^(proba|spalare|pif)$/.test(fi.fam)) { res.lv = Math.max(res.lv, 4); res.why += "; e o sumă pe toată instalația, depinde de mărimea lucrării"; }
      if (base === 3 || base === 4) res.why += "; din " + (res.pt.lab || "o sursă mai slabă");
      if (base === 5) {   // reper de piață: spun și cum am ajuns la sumă (altă dimensiune, fără dimensiune, altă variantă), nu doar de unde e
        const det = res.why.slice(short.length).replace(/^, [^;]*/, "").replace(/^[;:] /, "").replace("nu ai preț la", "nu există reper la").replace(/la (\S+) ai preț doar la/, "la $1 e reper doar la").replace("ai prețuri diferite la lucrarea asta", "reperele de piață diferă mult");
        res.why = short + ": reper de piață" + (res.pt.den ? " („" + res.pt.den + "”)" : "") + (det ? "; " + det : "");
      }
      if (base === 4) res.why = res.why.replace("ai prețuri diferite la lucrarea asta", "sursele diferă mult");
      if (far) res.why = "după „" + short + "” (lucrare asemănătoare)" + (res.why.indexOf(": ") > 0 ? ": " + res.why.split(": ").slice(1).join(": ") : "");
      return { p: r2(res.p), lv: res.lv, why: res.why, lab: res.pt.lab || "", id: res.pt.id, fam: fi.fam, src: res.pt.den || "" };
    }
    return null;
  }
  /** Prețul unei poziții. Întoarce {p, lv, why, lab, id, fam, src} sau null. */
  const UMMULT = [[/^zeci ?(?:de )?(?:m|ml|metri)$/, 10, "ml"], [/^(?:sute|suta|100) ?(?:de )?(?:m|ml|metri)$/, 100, "ml"], [/^zeci ?(?:de )?mp$/, 10, "mp"], [/^(?:sute|suta|100) ?(?:de )?mp$/, 100, "mp"], [/^(?:sute|suta|100) ?(?:de )?mc$/, 100, "mc"], [/^zeci ?(?:de )?(?:buc|bucati)$/, 10, "buc"]];
  /** Prețul unei poziții. Unitățile de deviz „zeci m”, „sute m”, „100 mc” se socotesc din prețul pe unitatea simplă, înmulțit. */
  function priceItem(item, T) {
    const u = norm(String(item.um || "")).replace(/\./g, "").trim();
    for (const [re, k, base] of UMMULT) if (re.test(u)) {
      const r = priceItem0(Object.assign({}, item, { um: base }), T); if (!r) return null;
      return Object.assign({}, r, { p: r2(r.p * k), why: r.why + " · prețul pe " + base + " înmulțit cu " + k + " (în listă unitatea e „" + String(item.um).trim() + "”)" });
    }
    return priceItem0(item, T);
  }
  function priceItem0(item, T) {
    const um = umFamily(item.um), ex = T.name.get(keyOf(item.den) + "|" + um);
    if (ex) return { p: ex.p, lv: 1, why: "aceeași denumire, preț pus de tine", lab: ex.lab, id: ex.id, fam: "", src: item.den };
    const sm = T.same.get(keyOf(item.den) + "|" + um);
    if (sm && keyOf(item.den).length > 14) return { p: sm.p, lv: 2, why: "aceeași denumire ca în prețurile tale", lab: sm.lab, id: sm.id, fam: "", src: item.den };
    const fi = classify(item.den, item.um); if (!fi.fam) return null;
    const dItem = (FAM[fi.fam] || [])[2] === "h" || domOfCap(item.cap) === "h" ? "h" : (domOfCap(item.cap0) || domOfCap(item.cap));
    if (isLump(item.um) && /\bvrf\b|\bvrv\b|multisplit/.test(fi.t)) return null;   // un sistem VRF întreg: nu există reper care să i se potrivească
    const lumpStrict = isLump(item.um) && WORKFAM.has(fi.fam.replace(/:.*$/, ""));
    const ptsOf = k => { const a = T.by.get(k); return a && lumpStrict ? a.filter(p => p.lump) : a; };
    let r = pickIn(fi, ptsOf(fi.fam + "|" + fi.um), dItem, "");
    if (r && r.lv <= 3) return r;
    for (const alt of alikeOf(fi.fam)) { const r2_ = pickIn(Object.assign({}, fi, { fam: alt, vars: fi.vars }), ptsOf(alt + "|" + fi.um), dItem, fi.fam && alt); if (r2_ && (!r || r2_.lv < r.lv)) { r = r2_; r.fam = fi.fam; break; } }
    return r;
  }
  /** Domeniul unei poziții (s, t, h, v, c, g, e, p, x) – pentru „ce ofertez din lista asta”. */
  function domainOf(den, um) { const c = classify(den, um); return c.grp || ""; }
  function total(it, adaos) { return it.no ? 0 : r2((+it.cant || 0) * r2((+it.pret || 0) * (1 + (adaos || 0) / 100))); }

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

  /* familie largă: sub același nume stau lucrări foarte diferite, deci un preț mediu pe familie nu spune nimic */
  const isBroad = fam => { const b = String(fam || "").replace(/:.*$/, ""); return LOOSE.has(b) || SOFT.has(b) || LOOSE.has(fam) || SOFT.has(fam); };
  const api = { QUAL, buildTarif, priceItem, domainOf, alikeOf, isLump, isBroad, CAPS, autoCap, counts, HIST, keyOf, strip, norm, feats, score, classify, famLabel, dnLabel, entryLabel, famList, MV, sizes, FAMS, G, prepCatalog, matchItem, total, chapters, risc, r2, umFamily };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.OF = api;
})(typeof window !== "undefined" ? window : globalThis);

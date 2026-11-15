/* Miez comun: potrivire cantități ↔ catalog de prețuri + calcule. Rulează în browser și în node. */
(function (root) {
  const strip = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[øØ∅⌀]/g, "d").replace(/[“”„"']/g, "").replace(/\s+/g, " ").trim();

  function umFamily(u) {
    u = strip(u).replace(/\./g, "");
    if (/^(m|ml|metri|m liniar|ml\.?)$/.test(u)) return "m";
    if (/^(mp|m2)$/.test(u)) return "mp"; if (/^(mc|m3)$/.test(u)) return "mc"; if (u === "kg") return "kg";
    if (/^(buc|bucati|ans|ansamblu|sistem|sisteme|sist|syst|lot|inst|lucrare|grup|set|kit|cmp|complet|punct|probe|proba)$/.test(u)) return "buc";
    return u || "buc";
  }
  /* „ans”, „sistem”, „instalație”: o sumă pe tot, nu un preț pe bucată sau pe metru */
  function isLump(u) { return /^(ans|ansamblu|ansamblul|sistem|sisteme|sist|syst|inst|lucrare|instalatie|instalatia|lot|gl|global|ls|ft|forfetar)$/.test(strip(u).replace(/\./g, "")); }
  /* „lot”, „inst”, „lucrare”: niciodată o bucată (spre deosebire de „ans”, care la aparate înseamnă de obicei o bucată montată) */
  function hardLump(u) { return /^(lot|inst|lucrare)$/.test(strip(u).replace(/\./g, "")); }
  const WORKFAM = new Set(["proba", "spalare", "pif", "eticheta", "demontare", "vent", "vent_tub_c", "vent_tub_r", "vent_flex", "vent_grila", "vent_clapeta", "teava", "izolatie", "izol_vata", "pardoseala", "pard_acc", "strapungere", "etans_foc", "terasament", "curatire", "fixare", "tub_protectie", "grund", "gaz", "electric", "transport", "gol", "fiting", "racord", "garnitura", "clima_teava", "piesa", "reglaj_inst", "prindere", "etansare"]);

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
    ["ppr", "PPR", /\bpp-?r\b|polifuziune|polipropilena random|\brandom\b/], ["pex", "PEX", /\bpe-?x\w?\b|\bpex\w?\b|reticulat/], ["mst", "multistrat", /multistrat|pex-?al|metaloplast|\bpe-?rt-?al/],
    ["cu", "cupru", /\bcupru\b/], ["zn", "oțel zincat", /zincat|galvanizat|\bol ?-?zn\b/], ["inox", "inox", /\binox/],
    ["pehd", "PEHD", /\bpe-?hd\b|\bpeid\b|\bpe ?100\b|\bpe ?80\b|polietilena de inalta|\bpoliet\w*\.? ?(?:armat\w*\.? )?de (?:inalta|in\.?) ?dens/], ["pvc", "PVC", /\bpvc\b/], ["pp", "PP", /\bpp\b|polipropilen\w*|\bpolipr\w*|fonoabsorb|insonorizat/],
    ["fonta", "fontă", /\bfonta\b/], ["ol", "oțel", /\botel\b|\bol\b|\bneagra\b|\bnegre\b|sudat/],
  ];
  function pipeMat(t) {
    const head = t.slice(0, 150); let best = null, bi = 1e9;
    for (const m of MATS) { const x = m[2].exec(head); if (x && x.index < bi) { bi = x.index; best = m; } }
    if (best && best[0] === "ol" && /zincat|galvanizat|\bol ?-?zn\b/.test(head)) best = MATS[4];
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
    ["trapa_vizitare", "Ușă / trapă de vizitare", "x", /\b(?:usa|usi|usita|usite|trap[aei])\w*\.? (?:de )?vizitare|\bcapac\w* (?:de )?vizitare/],
    ["piesa", "Piese și accesorii (sifon, capac, furtun, rozetă, set de fixare)", "s", /^(?:sifo\w+(?! (?:de )?pardoseala)|capac\w*|furtun\w*|rozet\w+|masc[aă]\w*|picior\w*|semipicior\w*|set\w* (?:de )?(?:fixare|prindere|montaj|suruburi)|surub\w*|ventil\w* (?:de )?scurgere|ventil\w* click\w*|click-?clack|preaplin\w*)\b/],
    ["camin", "Cămin de vizitare / de vane", "s", /\bcamin\w*/],
    ["terasament", "Săpături și terasamente", "p", /\bsapatur|\bumplutur|imprastier|compactare|\budare|excavat|sprijinir|transportul? rutier|\bpamant|\bnisip\b|banda avertizoare|band\w* (?:de )?avertizare|\bsap\.|sprijin\w*\.? ?(?:de )?maluri|geotextil|bordur[aie]\b|\bbalast|\bpietris|fir\w* trasor|band\w* semnalizatoare|\bpavaj\w*/],
    ["constructii", "Lucrări de construcții (beton, cofraj, zidărie, finisaje)", "p", /\bbeton\w*|\bcofraj|\bzidari|\btencuial|\bgips-?carton|\bglet\w*|\bfaianta|\bgresie|\bpardoseal\w* (?:din |placi|pvc|industrial|ceramic|tehnic|epoxi)|\bplinta|\bfatad\w*|\bsapa\b(?! (?:pentru |de )?(?:pardoseala|incalzire))|\bhidroizolati|\btamplari|\bfereastr|\busa\b|\busi\b|\bdulap|\bconfecti\w* metalic|\bzugrav|turnar\w* (?:de )?ciment|\bmatari? rf|\binchidere rost/],
  ["clima_teava", "Țeavă frigorifică (cupru izolat)", "c", /^ø ?\d+[.,]\d+ ?(?:mm)? ?izolat|(?:teava|tevi|conduct[ae]) (?:de |din )?cupru\b(?=.{0,70}(?:izolat|frigorific|freon|6[.,]35|9[.,]52|12[.,]7|15[.,]88|19[.,]05|22[.,]2|28[.,]6))/, "mm"],
    ["pompa_caldura", "Pompă de căldură / chiller", "t", /pomp\w+ de caldura|\bchiller|grup\w* de racire\w*|\bagreg\w*\.? (?:ar\b|de racire|apa racita)/],
    ["clima", "Climatizare (split, VRF)", "c", /\bsplit\b|monosplit|multisplit|\bvrf\b|\bvrv\b|freon|agent frigorific|branch joint|kit distributie|unitat\w+ (?:interioar|exterioar)|compresor condensator|aer conditionat|cabluri de interconectare|compresor\w* frig|\bbtu\b|unitat\w+ (?:intern|extern)[aei](?! (?:a |pt\.? |pentru )?pomp)|(?:com|con)presor\w*[ -]+condensator|^u[ei]\b(?=[ ,.;:–-]|$)|\br ?32\b|\br ?410/],
    ["vent_clapeta", "Clapetă antifoc / de reglaj (ventilație)", "v", /clapet\w+ (?:rectangular|circular|antifoc|rezistent\w+ la foc|de reglaj|de reglare|de aer|cu contragreutate)|registru\w* (?:de )?reglaj|clap\.? ?de regl|\bclpet\w*|\bvolet\w*|clapet\w*[- ]fluture,? (?:de )?regl|clapet\w* on ?\/ ?off|clapet\w* (?:de tip )?registru/],
    ["vent_tub_c", "Tubulatură circulară", "v", /tubulatur\w+ circular|canal\w* de aer circular(?! flexibil)|conduct\w+ de aer circular/, "mm"],
    ["vent_tub_r", "Tubulatură rectangulară", "v", /tubulatur\w+ rectangular|canal\w* de aer rectangular|conduct\w+ de aer rectangular|canale drepte/],
    ["vent_flex", "Tubulatură flexibilă", "v", /tubulatur\w+ flexibil|canal\w* de aer circular flexibil|tub flexibil/, "mm"],
    ["vent_grila", "Grile și anemostate", "v", /\bgril[ae]\b|anemostat|difuzor|difuzoar|\bvalv[ae] (?:cu con|de aspiratie|aspiratie|de evacuare)|priza de (?:aer|admisie)|gur\w+ de (?:refulare|absorbtie)|ram\w+ (?:rectangular\w+ )?cu jaluzele|ram\w+ (?:rectangular|circular)\w*,? cu jaluzele|ram\w+ cu plasa|plas\w+ (?:de )?sarma/],
    ["vent", "Ventilație (alte poziții)", "v", /tubulatur|canal\w* de aer|ventilator|\bcta\b|centrala de tratare|agregat de ventilare|recuperator|\bhota\b|\bhote\b|burduf|jacheting|piese speciale|debitului de aer|plenum|atenuator|conducte de aer|caciul\w+ (?:pt\.?|pentru) ?canal|canal\w*\.? (?:de )?aer|plafon\w* filtrant|central\w* de ventilati\w*|\bcta ?\d+\b|\btub\w* (?:de )?ventilati\w*|ventilati\w* cu recuperare|recuperare de caldura|sistem\w* de ventilati|evacuar\w* (?:a )?aer\w* viciat|introducer\w* (?:a )?aer\w* proaspat|protecti\w* mecanic\w* cu tabla|perde\w* de aer|sistem\w* circular pentru (?:introducere|evacuare)|\bumidificat\w*/],
    ["gaz", "Instalație de gaze", "g", /\bgaz(?:e|elor)?\b/],
    ["cablu_incalzitor", "Cablu / fir încălzitor pentru conducte (degivrare, menținere temperatură)", "t", /fir\w* incalzitor|cablu\w* (?:auto)?incalzitor|cablu\w* autoreglabil|cablu\w* (?:de )?(?:incalzire|degivrare)|sistem\w* (?:de )?degivrare|protecti\w* cu fir/],
    ["electric", "Electrice", "e", /\bcablu|\bcabluri|\btablou\w*(?! (?:de )?(?:automatizare|comanda))|energie electrica|corp\w* de iluminat|aparat\w* de (?:comutare|iluminat)|\bups\d*\b|sursa neinteruptibila|cap terminal|\bpriz[aei]\b|canalet|\bintrerupator|\bcomutator|\bdoz[aei] (?:de )?(?:aparataj|derivatie|montaj)|\bimpamantare|\bparatrasnet|grup\w* electrogen|sistem\w* fotovoltaic|\bpanou\w* electric|\bbara verticala de distributie|\bsectie \d+ ?kv|\bcil\b|\blicenta|\bmodul\w* de conexiune|\bfirid\w*(?!.{0,40}\bgaz)|telecomunicati/],
    // --- lucrări
    ["demontare", "Demontări", "x", /\bdemonta|dezafect/],
    ["proba", "Probe de presiune / etanșeitate / funcționare", "x", /\bprob[ae]?\b|\bprobei\b|incercar\w+ (?:la )?presiune/],
    ["spalare", "Spălare și dezinfectare instalație", "x", /\bspalar\w*|dezinfect|desinfect/],
    ["pif", "Punere în funcțiune", "x", /puner\w+ in func(?:tiune|\b)|\bpif\b/],
    ["reglaj_inst", "Reglare și echilibrare instalație", "x", /echilibrar\w*(?: a)? (?:sistem|instalat|hidraulic|retel)|reglar\w*(?: a)? instalati|verificar\w* corectitudin/],
    ["proiect", "Documentație / proiect (as-built, carte tehnică)", "x", /intocmir\w* (?:proiect|documentat)|proiect\w* as-?buil|\bas-?built|cart\w* tehnic|documentati\w+ (?:tehnic|de executie|as)/],
    ["etans_foc", "Etanșări la foc (treceri prin pereți)", "x", /etansar\w+ (?:la )?foc|etansa foc|inchidere si etansare rezistent|matar\w+ ale strapunger|manson\w* antifoc|etansar\w* antifoc|protecti\w* la foc la trecer\w*|sistem\w* (?:de )?protectie la foc la trecere|manson\w* rezistent\w* la foc|manson\w* intumescent|sistem\w* (?:de )?piese de etansare|piese de etansare.{0,60}\brf\b|sistem agrementat de inchidere/],
    ["strapungere", "Străpungeri / carotări", "x", /strapunger|carotare/],
    ["gol", "Goluri în zidărie / planșeu", "x", /\bgol(?:uri)?\b/],
    ["slit", "Șlițuri / șanțuri în zidărie (spargere și refacere)", "x", /\bslit\w*|executar\w* (?:a )?santuril\w*|\bslitui\w*|spargere\w*.{0,30}(?:sant|perete|zidarie)|sant\w* (?:in|prin) (?:zidarie|perete|beton|pardoseala)/],
    ["piesa_trecere", "Piese de trecere etanșe", "x", /pies\w+ (?:de )?trecere|pies\w+ (?:de )?etans/],
    ["grund", "Grunduire / vopsire", "x", /grundui|\bgrund\b|vopsi|\bvopsea\b/],
    ["transport", "Transport materiale / deplasare", "x", /\btransport|\bdeplasar/],
    ["eticheta", "Etichetare / plăcuțe", "x", /etichet|placut\w+ indicatoare/],
    // --- izolații
    ["izol_vata", "Izolație din vată minerală", "t", /izolati\w+ (?:termic\w+ )?(?:tip saltea|din vata)|vata minerala|vata (?:de )?sticla|\bizol\w*\b.{0,40}saltel\w* (?:lamelar\w* )?(?:de |din )?vata/, "thick"],
    ["izolatie", "Izolație pentru conducte (Armaflex, K-flex, cauciuc sintetic, elastomer)", "s", /\bizolati[ei]\b|\bizolare\w*|termoizolati|armaflex|k-?flex|elastomer|\bizol\b|\bcochili|\blzolati\w*/, "thick"],
    // --- obiecte sanitare (înaintea țevilor: „Tub cu gură de curățire”, „Rigolă duș”)
    ["curatire", "Piesă de curățire", "s", /pies\w+ (?:de )?curatire|tub cu gura de curatire|gura de curatire|elem\w*\.? (?:pp |pvc )?(?:de )?curatire/, "dn"],
    ["receptor", "Receptor de terasă / gură de scurgere terasă", "s", /\breceptor|gur\w+ de scurgere (?:pentru|de|la) teras|\bsif\.? ?teras\w*/, "dn"],
    ["sifon_pard", "Sifon de pardoseală / gură de scurgere", "s", /sifo\w+ (?:de )?pardoseala|gur\w+ (?:de )?scurgere/, "dn"],
    ["rigola", "Rigolă de duș", "s", /\brigol/],
    ["aerator", "Aerator cu membrană (canalizare)", "s", /\baerator/, "dn"],
    ["caciula", "Căciulă de ventilație", "s", /caciul\w+ (?:de )?(?:ventila|protectie|prot\b)|pies\w+ (?:de )?capat (?:de )?coloan\w* (?:de )?ventil/, "dn"],
    ["garnitura", "Garnitură de etanșare", "s", /\bgarnitur/, "dn"],
    ["baterie", "Baterie (lavoar, spălător, duș)", "s", /\bbateri[ei]\b|\bbat\.? ?amestec/],
    ["coloana_dus", "Coloană de duș", "s", /coloan\w+ de dus/],
    ["lavoar", "Lavoar", "s", /\blavoar/],
    ["rezervor_wc", "Rezervor WC îngropat", "s", /rezervor\w* (?:incastrat|ingropat|wc|de wc|(?:de )?apa pentru wc)|cadru (?:wc|incastrat)|\brezerv\.? ?apa\b.{0,60}(?:closet|wc)/],
    ["bideu", "Bideu", "s", /\bbideu/],
    ["vas_wc", "Vas WC", "s", /\bvas\w* (?:de )?wc\b|\bwc\b|closet/],
    ["pisoar", "Pisoar", "s", /\bpisoar/],
    ["cada", "Cadă / cădiță / cabină de duș", "s", /\bcada\b|\bcazi\b|cadit|cabin\w+ (?:de )?dus/],
    ["vidoar", "Vidoar", "s", /\bvidoar/],
    ["spalator", "Spălător / chiuvetă", "s", /\bspalator|chiuvet/],
    ["accesorii", "Accesorii baie (oglindă, portprosop, săpunieră)", "s", /\boglin|port-?prosop|port-?hartie|sapunier|etajer|dispenser|uscator de m[ai]ini|bar\w+ (?:de )?sprijin|\bmobilier|port[- ]prosop|port[- ]?h[ai]rtie|porthirtie|\bcuier|bar\w+ rabatabil|maner\w* (?:de )?(?:siguranta|sprijin)|\bscaun\w* (?:de )?dus|perie (?:de )?wc|\bcos\w* (?:de )?gunoi|\bsuport\w* (?:de )?(?:hartie|prosop)/],
    // --- hidranți
    ["hidrant_ext", "Hidrant exterior", "h", /hidran\w+ exterior|hidran\w+ suprateran|hidran\w+ subteran/],
    ["distr_hidranti", "Distribuitor hidranți", "h", /distribuitor\w* hidran/],
    ["grup_pompare", "Grup de pompare", "t", /grup\w* (?:de )?pompare|statie (?:de )?pompare|grup\w* compact\w* de ridic|\bhidrofor\w*|statie (?:de )?colectare si (?:pompare|evacuare)/],
    ["rob_hidrant", "Robinet de hidrant", "h", /robine\w+ (?:de |pentru )?(?:hidrant|incendiu)/, "dn"],
    ["hidrant_int", "Hidrant interior (cutie completă)", "h", /hidran\w+ interior|cutie\w* (?:de )?hidran|\bhidrant\b/],
    ["sprinkler", "Sprinkler", "h", /sprinkler|aparat\w* de control si semnalizare|clapet\w* de alarma|post\w* de control (?:si semnalizare|sprinkler)/],
    ["cuplaj", "Cuplaj canelat (Victaulic)", "h", /\bcupl[ae]j?\w* (?:flexibil\w* |rigid\w* )?(?:canelat|victaulic|grooved)|\bcuplaj(?! storz)|\bcupla (?:redusa )?\d|conector\w* (?:de )?prindere rapida|conector\w*.{0,40}canelat/, "dn"],
    ["stingator", "Stingător", "h", /stingato/],
    ["kit_test", "Kit de testare (debit hidranți / sprinklere)", "h", /kit\w* (?:de )?test\w*|trus\w* (?:de )?testare/, "dn"],
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
    ["vana_3c", "Vană cu 3 căi", "t", /van\w+ (?:cu )?(?:3|trei) cai|\bv3c\b|ventil\w* (?:cu )?(?:3|trei) cai/, "dn"],
    ["vana_2c", "Vană cu 2 căi", "t", /van\w+ (?:cu )?(?:2|doua) cai|\bv2c\b|ventil\w* (?:cu )?(?:2|doua) cai/, "dn"],
    ["vana_amestec", "Ventil / vană termostatică de amestec", "t", /(?:ventil|vana|vane) termostatic|van\w+ de amestec/, "dn"],
    ["rob_trecere", "Robinet de trecere (de sectorizare, cu sferă, cu bilă, de separație, de închidere)", "s",
      /robine\w+ (?:de )?(?:sectorizare|trecere|inchidere|izolare|separatie|separare)|robine\w+ (?:cu )?(?:sfera|bila)\b|robine\w+ sferic|van\w+ cu (?:sfera|bila)|\brob\.? ?(?:cu )?(?:bila|sfera|sferic|sectorizare|trecere|inchidere)\b|van\w+ (?:de )?(?:sectionare|separare|inchidere)\b|\brob\.? ?de (?:fonta|alama|bronz|otel)\b/, "dn"],
    ["clapeta_sens", "Clapetă de sens (supapă de sens, de reținere)", "s", /clapet\w+ (?:de )?(?:sens|retinere)|supap\w+ (?:de )?sens|clapet\w+ anti[ -]?retur|ventil\w* (?:de )?sens|robine\w+ (?:de )?retinere|^clapet\w* (?=\d \d\/\d|\d\/\d|[1-4]\b(?![\d.,x])|dn ?\d|cu arc|cu resort)|ventil\w* (?:de )?retinere/, "dn"],
    ["filtru_y", "Filtru de impurități (tip Y)", "s", /filtru\w* (?:de )?impuritati|filtru\w* (?:tip )?"?y(?![a-z])|filtru\w* (?:cu )?sita|filtru\w* anticalcar|filtru\w* magnetic|filtru\w* mecanic|filtru\w* (?:cu )?autocuratare|filtru\w* de particule/, "dn"],
    ["supapa_sig", "Supapă de siguranță", "s", /supap\w+ (?:de )?siguranta|grup\w* (?:de )?siguranta|^supap\w*(?= \d)/, "dn"],
    ["aerisitor", "Aerisitor (dezaerator, ventil de aerisire)", "t", /aerisitor|dezaerator|ventil\w* (?:automat\w* )?(?:de )?aerisire|robine\w+ (?:de )?aerisire|van\w+ (?:de )?aerisire|\bpurjor|\bcap\w* (?:de )?golire/, "dn"],
    ["manometru", "Manometru / termomanometru", "s", /\b(?:termo)?manometr|armatur\w* fine.{0,50}manometr/],
    ["termometru", "Termometru", "t", /\btermometr|armatur\w* fine.{0,50}termometr/],
    ["senzor", "Senzor / termostat", "t", /\bsenzor|\b(?:crono)?termostat\b|\bsonda\b|\bpreso?s?tat|plutitor\w* electric|flotor\w* electric|traductor\w*|regulator\w* electronic|indicator\w* de nivel|detector\w* de curgere|\bmont\w*\.? accesori\w* la cazan/],
    ["automatizare", "Automatizare / sistem de control", "t", /sistem\w* (?:de )?(?:automatizare|control centralizat|comanda|management)|\bautomatizar\w+|\bbms\b|monitorizare (?:a )?nivel\w*|sistem\w* (?:de )?monitorizare|tablou\w* (?:de )?(?:automatizare|comanda)|modul\w* (?:de )?(?:comanda|control)|\bcontroler\w*|telecomand\w*/],
    ["disconector", "Disconector (protecție la retur)", "s", /disconector|backflow|\bpreventer/, "dn"],
    ["antivibrant", "Racord / manșon antivibrant", "s", /(?:manson|racord|compensator)\w* (?:de )?antivibra|compensator|covor\w* .{0,15}antivibra/, "dn"],
    ["reductor", "Reductor / regulator de presiune", "s", /(?:reductor|regulator)\w* (?:de )?presiune|alimentator\w* automat|grup\w* (?:de )?umplere|robine\w+ (?:de )?umplere/, "dn"],
    ["contor", "Apometru / contor / debitmetru", "s", /apometr|\bcontor|\bcontoare\b|debitmetr/, "dn"],
    // --- termice
    ["rad_baie", "Radiator de baie (portprosop)", "t", /radiato\w+ (?:de )?baie|radiato\w+ portprosop|calorifer\w* (?:de )?baie/],
    ["rad_electric", "Radiator electric", "t", /radiato\w+ electric|convecto\w+ electric/],
    ["radiator", "Radiator / calorifer", "t", /\bradiato|\bcalorifer|convecto-?radiator|corp\w* (?:de )?incalzire|corpuri statice|^(?:1[01]|2[012]|33) ?[x×\/] ?[2-9]\d\d ?[x×\/] ?\d{3,4}\b/, "rad"],
    ["ventilo", "Ventiloconvector", "t", /ventilo-?convecto/],
    ["aeroterma", "Aerotermă", "t", /\baeroterm\w*/],
    ["solar", "Panou / colector solar termic", "t", /panou\w* solar|panouri solare|colector\w* solar|captator\w* solar|\btub\w* vidat\w*|pachet\w* (?:sistem )?solar/, null, /fotovolt|\bpv\b|^\W*(?:set|kit|suport\w*|accesori\w*|racord\w*|cadru|structur\w*|fixar\w*)\b/],
    ["dedurizator", "Dedurizator / osmoză / tratare apă", "s", /dedurizat|statie (?:de )?dedurizare|osmoz|sterilizator uv|lampa uv|\blamp\w* (?:cu )?uv|filtru\w* (?:de )?apa\b|filtru\w* (?:cu )?cartus|dozator\w* (?:de )?(?:anticalcar|polifosfat)|dozator\w* contra depuner|neutraliza\w* (?:de )?condens|\bclorinator|statie (?:de )?tratare (?:a )?apei/],
    ["grup_amestec", "Grup de amestec / modul hidraulic", "t", /grup\w* (?:de )?amestec|modul\w* (?:hidraulic )?(?:de )?amestec|kit\w* (?:de )?amestec|grup\w* (?:de )?pompare (?:si |cu )?amestec/],
    ["cos_fum", "Coș de fum / evacuare gaze arse", "t", /\bcos\w* (?:de )?fum|\bsist\w*\.? de cos|prelungitor\w* (?:de )?cos|\bcot\w* coaxial|\btub\w* coaxial|\bcoaxial\w*|evacuar\w* (?:a )?gaze\w* arse|admisie (?:a )?aer\w* (?:de )?combusti|canal\w* de admisie|\bterminal\w* (?:de )?(?:evacuare|cos)|kit\w* (?:de )?evacuare (?:gaze|fum|coaxial)/],
    ["distribuitor", "Distribuitor / colector", "t", /distribuitor|distribuitro\b|\bcolector|caset\w+ de distributie|caset\w*\.? (?:met\w*\.? )?(?:pt\.?|pentru) ?distribuitor|^cutie\w*.{0,40}(?:distribuitor|colector)|\d+ circuite\b.{0,30}carcas|^caset\w* \d{3} ?x ?\d{3}|\bcutie\w* \d+ circuite/],
    ["schimbator", "Schimbător de căldură (în plăci)", "t", /schimbat\w* (?:de )?caldura|schimbat\w* in placi/],
    ["vas_exp", "Vas de expansiune", "t", /\bvas\w* (?:de )?expansiune/],
    ["pompa", "Pompă", "t", /\bpomp[aei]\b|\bpompele\b|electropomp/],
    ["cazan", "Centrală termică / cazan", "t", /\bcazan|centrala termica|centrala murala|sursa (?:de )?preparare agent|\barzator\w*|^central[aei]$|\bcentral[aei]\b(?! de tratare| (?:de )?ventilare)(?=.{0,25}(?:condens|gaz|electric|combustibil|lemne|peleti|\d+ ?kw))/, null, /central\w* (?:de )?(?:detecti|semnaliz|avertiz|alarm)|detector\w*.{0,25}central|^\W*kit\w* (?:de )?evacuar/],
    ["boiler", "Boiler / rezervor", "t", /\bboiler|\brezervor|\bbazin\b|\bseparator\b|butelie (?:de )?egalizare|\bpuffer|acumulator\w* (?:de )?(?:apa|agent|caldura)|\bvas\w* (?:de )?acumulare|separator\w* hidraulic|preselector\w* hidraulic|recipient\w*(?: de| pt\.?| pentru)? ?hidrofor/],
    ["pard_acc", "Accesorii pentru încălzirea în pardoseală (plăci, bandă, curbe, aditiv)", "t", /plac\w+ (?:cu )?nuturi|banda perimetrala|aditiv\w* (?:beton|sapa|pentru sapa|pentru cresterea)|curb\w+ conducatoare|clips\w* (?:de )?fixare|agraf|rost\w* (?:de )?dilatare|sapa (?:pentru )?(?:pardoseala|incalzire)/],
    ["pardoseala", "Încălzire în pardoseală (montaj complet)", "t", /incalzire in pardoseala/],
    // --- fixări (brățară = bridă = colier = clemă; suporți)
    ["fixare", "Fixare conducte: brățări, bride, coliere, cleme, suporți", "s", /\bbratar[aiă]|\bbratari\b|\bbrid[ae]\b|\bbride\b|\bcolier(?!\w* (?:de )?bransare)|\bclem[ae]\b|\bcleme\b|\bsuport[i]?\b|dispozitive de (?:sustinere|fixare)|elemente de sustinere|\bconsol[ae]\b|\bconsole\b/, "dn"],
    ["prindere", "Elemente de prindere (tijă filetată, piuliță, șaibă, diblu, ancoră, șină)", "x", /\btij[ae]\b|\btije\b|\bpiulit\w*|\bsaib[aei]\w*|\bdibl[uie]\w*|\bancor[aei]\b|\bancore\b|\bmoli\b|\bprezon\w*|\btalp\w* (?:de )?sustinere|\bplac\w* (?:dreptunghiular\w* )?(?:de )?fixare|\bsin[aei] c\b|\bsin[aei] (?:de )?(?:montaj|perforat\w*)|\bprofil\w* c ?\d|\bband\w* perforat\w*|\bbar\w* filetat\w*|\bconexpand|\bholzsurub/, "mth"],
    ["etansare", "Materiale de etanșare și consumabile (cânepă, pastă, teflon, silicon)", "x", /\bcanep\w*|\bpast[aei]\b|\bteflon|band\w* obo|\bsilicon\w*|ulei\w* (?:de )?filet\w*|aliaj\w* (?:de )?brazare|\bfludor|\bdecapant|spuma poliuretan|\badeziv\w*|\btangit|\bloctite|\bfir\w* (?:de )?etansare|\bvaselin|\bchit\b|etilen ?glicol|propilen ?glicol|\bantigel/],
    // --- fitinguri mărunte
    ["racord", "Racord (olandez, eurocon, flexibil)", "s", /\bracord(?!\w* (?:fix |tip |incendiu tip )?storz)|\badaptor|\bolandez|\bholender|\bsemi-?olandez|\bconector\w*|\beurocon\w*|^flexibil\w*/, "dn"],
    ["fiting", "Fitinguri (cot, teu, mufă, reducție, niplu, dop)", "s", /\bcot\b|\bcoturi\b|\bcurba\b|\bteu\b|\bteuri\b|\bmuf[ae]\b|\bmufe\b|reducti[ei]|\bnipl[ue]|\bdop\b|\bdopuri\b|\bbuson\w*|\bflans[ae]\b|\bfitin?g\w*|\b(?:teu|cot|mufa|dop)(?=\d)|\breiser\w*|pies\w+ (?:de )?bransare|\bram\.? (?:pp|pvc|pehd|pe)\b|\bprelungiri\b|\bramificati\w*|\bnipr\w*|\bsaritur\w*|\breduc\b|pies\w+ (?:de )?derivatie|\bderivati[ei]\b|\bsa (?:de )?bransare|colier\w* (?:de )?bransare|\bstut\w*(?! cu robinet)|\bprelungi(?:re|tor)\b(?!.{0,30}camin)|\bcruce\b|\bmanson\w*(?! (?:antifoc|rezistent|intumescent|antivibra|de trecere))/, "dn"],
    // --- țevi (la urmă: multe denumiri conțin „țeavă” în descriere)
    ["rob_trecere", "", "s", /\brobineti?\b(?! (?:de )?(?:hidrant|incendiu))|^van[aei]\w* (?=\d|dn)/, "dn"],
    ["rob_coltar", "", "s", /\bcoltar\b(?!.{0,200}(?:vas\w* (?:de )?wc|set (?:de )?conectare))/, "dn", /(?:profil\w*|faiant\w*|gresie|placaj\w*|tencui\w*|gips\w*|glet\w*) .{0,20}coltar|coltar\w* .{0,25}(?:profil|faiant|gresie|placaj|tencui|gips|glet|alumin)|termometr|manometr|drept sau coltar|coltar sau drept/],
    ["tub_protectie", "Tub / țeavă de protecție", "s", /(?:tub|teava|tevi)\w* (?:de )?protectie/, "dn"],
    ["teava", "Țeavă", "s", /\bteav[ai]\b|\btevi\b|\btevii\b|\btevilor\b|\bconduct[ae]\b|\btub\b|\btuburi\b|coloane si distributie|^(?:pp-?r?|pvc(?:-?kg)?|pe-?hd|pe-?xa?)[ -]?\d{2,3}(?:[x× ]|$)|\btv\b\.? ?(?:din )?(?:poliet|polipr|pp\b|pvc|pe\b|ol\b|otel|zn|zinc|cupru|pehd|pex)|^polietilena reticulata/, "dn"],
  ];
  const FAM = Object.fromEntries(FAMS.filter(f => f[1]).map(f => [f[0], f]));
  /* Familii prea largi ca să primească singure un preț (doar denumirea identică, învățată, le potrivește). */
  const NOMATCH = new Set(["terasament", "clima", "clima_teava", "vent", "vent_clapeta", "vent_tub_c", "vent_tub_r", "vent_flex", "vent_grila", "gaz", "electric",
    "demontare", "eticheta", "transport", "grund", "pif", "gol", "teava", "fiting", "racord", "garnitura", "constructii", "proiect", "prindere", "etansare", "reglaj_inst"]);
  /* Familii la care prețul depinde mult de aparat: se dă doar sugestie, niciodată preț pus singur. */
  const SOFT = new Set(["strapungere", "etans_foc", "piesa_trecere", "pompa", "cazan", "boiler", "vas_exp", "grup_pompare", "distribuitor", "senzor", "pardoseala",
    "izol_vata", "accesorii", "rad_baie", "rad_electric", "ventilo", "aeroterma", "hidrant_ext", "contor", "antivibrant", "reductor", "automatizare", "grup_amestec", "cos_fum", "disconector", "schimbator", "kit_test", "cablu_incalzitor", "trapa_vizitare"]);
  /* Cuvinte care deosebesc variantele din aceeași familie (cu prețuri diferite). */
  const VARIANTS = [["dizabilitati", /dizabilit|handicap/], ["suspendat", /suspendat/], ["inox", /\binox/], ["fonta", /\bfonta\b/], ["pvc", /\bpvc\b/], ["pehd", /\bpe-?hd\b|\bpeid\b/],
    ["pp", /\bpp\b(?!-?r)|polipropilena/], ["antiseismic", /antiseismic/], ["co2", /\bco2\b/], ["p50", /\bp ?50\b|transportabil/], ["fotocelula", /fotocel|senzor/],
    ["pluvial", /pluvial/], ["canalizare", /canaliz|menajer/], ["hidrant", /hidran|\bpsi\b|incendiu/], ["coloane", /\bcoloan/], ["de radiator", /radiator|calorifer/],
    ["lavoar", /\blavoar/], ["spalator", /\bspalator|chiuvet/], ["wc", /\bwc\b/], ["pisoar", /\bpisoar/], ["dus", /\bdus\b/], ["presemnalizare", /presemnaliz/],
    ["motorizat", /motoriz|servomotor/], ["canelat", /canelat|victaulic|grooved/], ["interioara", /unitat\w+ interioar/], ["exterioara", /unitat\w+ exterioar/], ["dilatare", /dilatare/], ["functionare", /functionare|eficacitate/], ["solar", /\bsolar/], ["terasa", /\bteras/]];

  /* Felul fitingului / racordului: cuvântul care l-a încadrat (teu = ramificație = derivație, mufă = manșon, niplu = nipru = ștuț, dop = bușon). */
  const FITV = [["cot", /\bcot\b|\bcot(?=\d)|\bcoturi\b|\bcurb[aei]\b(?! conducatoare)/], ["teu", /\bteu\b|\bteu(?=\d)|\bram\.? (?:pp|pvc|pehd|pe)\b|\bteuri\b|\bramificati\w*|\bderivati[ei]\b|pies\w+ (?:de )?derivatie|\bcruce\b/], ["mufa", /\bmuf[ae]\b|\bmufe\b|\bmanson\w*/],
    ["reductie", /\breducti\w*|\breduc\b|\bredus[ae]?\b/], ["niplu", /\bnipl\w*|\bnipr\w*|\bstut\w*(?! cu robinet)/], ["dop", /\bdop\b|\bdopuri\b|\bbuson\w*/], ["flansa", /\bflans\w*/],
    ["saritura", /\bsaritur\w*|curb\w* de ocolire/], ["olandez", /\bolandez\w*|\bsemi-?olandez|\bholender/], ["eurocon", /\beurocon\w*/], ["conector", /\bconector\w*|\badaptor\w*/], ["flexibil", /\bflexibil\w*/],
    ["sa_bransare", /\bsa (?:de )?bransare|colier\w* (?:de )?bransare/], ["prelungitor", /\bprelungi(?:re|ri|tor)\b/], ["reiser", /\breiser\w*|pies\w+ (?:de )?bransare/]];
  const FITLAB = { cot: "Cot", teu: "Teu / ramificație", mufa: "Mufă (manșon)", reductie: "Reducție", niplu: "Niplu", dop: "Dop (bușon)", flansa: "Flanșă", saritura: "Săritură (curbă de ocolire)", olandez: "Racord olandez",
    eurocon: "Racord eurocon", conector: "Conector / adaptor", flexibil: "Racord flexibil", sa_bransare: "Șa de branșare", prelungitor: "Prelungitor", reiser: "Piesă de branșare (reiser)" };
  const mthOf = t => { const m = /\bm ?(\d{1,2})(?![\d.,])/.exec(t) || /\b(?:dibl\w*|moli|ancor\w*)\.? (?:\w+ ){0,2}?(\d{1,2}) ?(?:x ?\d{2,3}|mm\b)/.exec(t); const v = m ? +m[1] : null; return [4, 5, 6, 8, 10, 12, 14, 16, 20, 24].includes(v) ? v : null; };
  /** Încadrarea unei denumiri: familie, material (la țevi), dimensiune, cuvinte de variantă. */
  const EQUIP = new Set(["boiler", "pompa", "cazan", "senzor", "vas_exp", "distribuitor"]);
  const BOILER = /^(?:(?:idem|procurare si montaj|procurare si montare|procurare si|furnizare si montaj|furnizare si montare|montaj|montare|efectuarea?|realizare|executie|p\d+|\d+[.)])[ ,;:-]*)+/;
  const HEAD = 48;   // cuvântul care dă familia trebuie să fie la începutul denumirii, nu în descrierea de după
  function classify(den, um) {
    const full = norm(den), t = full.replace(BOILER, ""); let fam = null, at = 1e9;
    for (const f of FAMS) { const m = f[3].exec(t); if (m && m.index < at && !(f[5] && f[5].test(t))) { at = m.index; fam = f; } }   // f[5]: cuvinte care arată că nu e lucrarea asta (ex. „centrală de detecție gaz”, „panou fotovoltaic”)
    if (fam && (at > HEAD || (EQUIP.has(fam[0]) && at > 14))) fam = null;
    // o poziție care vorbește de split/VRF/freon ori de tubulatură de aer ține de climatizare / ventilație, orice cuvânt ar avea la început
    const h90 = t.slice(0, 90);
    let grpOver = null; const work = fam && /^(pif|proba|spalare|demontare|eticheta)$/.test(fam[0]);   // „PIF VRF”, „Demontare tubulatură”: rămân punere în funcțiune / demontare (nu primesc preț de montaj), dar țin de climatizare / ventilație
    if (fam && fam[2] !== "c" && /\b(?:mono|multi)?split\b|\bvrf\b|\bvrv\b|freon|frigorific/.test(h90)) { if (work) grpOver = "c"; else fam = FAM.clima; }
    else if (fam && fam[2] !== "v" && /tubulatur(?!\w* (?:de |pentru )?incalzire)|conduct\w+ de aer|\bcta\b|gur\w+ de aer/.test(h90)) { if (work) grpOver = "v"; else fam = FAM.vent; }
    const o = { t, fam: fam ? fam[0] : null, grp: fam ? (grpOver || fam[2]) : null, um: umFamily(um), dn: [], mat: null, thick: null, rad: null, mm: null, vars: [] };
    if (!fam) return o;
    let cls = "metal";
    if (fam[0] === "teava" || fam[0] === "tub_protectie") { const m = pipeMat(t.slice(at)); if (m) { o.mat = m.id; cls = m.cls; o.cls = cls; if (fam[0] === "teava") o.fam = "teava:" + m.id; } }
    else if (["curatire", "sifon_pard", "receptor", "caciula", "aerator"].includes(fam[0])) cls = "sewer";
    let fitv = null;
    if (fam[0] === "fiting" || fam[0] === "racord") {   // fitingul de plastic (cot PP 110x45, mufă PPR 20) nu ia prețul unuia de oțel sau canelat, și invers
      const m = pipeMat(t); if (m) o.pc = m.cls === "metal" ? "metal" : "plast";
      else if (/canelat|victaulic|\bsudat|filet|\bzincat|fonta|\bnegru\b|\binox|\d\/\d|\d ?"|\btol|\bdn ?\d/.test(t)) o.pc = "metal";
      else if (/(?:^|[^\d.,])(?:16|20|25|32|40|50|63|75|90|110|125|160|200|250|315) ?[x×]/.test(t) || /(?:^| )(?:16|20|25|32|40|50|63|75|90|110|125|160)(?: |$)/.test(t)) o.pc = "plast";
      if (o.pc === "plast") cls = m && m.cls === "sewer" ? "sewer" : "plastic";   // „Cot 32x90” de plastic e Ø32 (DN25), nu DN32
      let bi = 1e9; for (const v of FITV) { const x = v[1].exec(t.slice(0, 60)); if (x && x.index < bi) { bi = x.index; fitv = v[0]; } }
    }
    if (fam[4] === "dn") { o.dn = sizes(t, cls); if (!o.dn.length) o.dn = sizesShort(t, cls); }
    else if (fam[4] === "thick") o.thick = thickOf(t);
    else if (fam[4] === "rad") o.rad = radOf(t);
    else if (fam[4] === "mm") o.mm = mmOf(t);
    else if (fam[4] === "mth") o.mth = mthOf(t);
    const isPipe = o.fam.startsWith("teava:");
    // la țevi contează doar la ce folosește țeava (pluvial, canalizare, hidranți, solar), nu restul cuvintelor din descriere
    o.vars = VARIANTS.filter(v => (!isPipe || ["pluvial", "canalizare", "hidrant", "solar"].includes(v[0])) && v[1].test(t.slice(0, 220))).map(v => v[0]);
    if (fitv) o.fit = fitv;   // felul fitingului: doar pentru catalog (nu schimbă prețurile puse până acum)
    // alte mărimi folosite doar în catalog: tipul și înălțimea caloriferului, armătura cu flanșe, capacitatea (l), puterea (kW / BTU)
    if (o.fam === "radiator") { const m = /\btip ?(1[01]|2[012]|33)\b|(?:^|[^\d.,])(1[01]|2[012]|33) ?[x×\/\-] ?[2-9]\d\d(?!\d)/.exec(t); if (m) o.radt = m[1] || m[2]; }   // și „22x600x1000”
    else if (/^(?:rob_\w+|vana_\w+|clapeta_sens|filtru_y|supapa_sig|electrovana|reductor|contor|antivibrant|disconector)$/.test(o.fam) && /\bflans|cu flanse|\bflansat/.test(t.slice(0, 220))) o.cx = "flanse";
    else if (o.fam === "boiler" || o.fam === "vas_exp") { const m = /(?:^|[^\d.,])(\d{1,5}) ?(?:l|litri|ltr)\b/.exec(t); if (m && +m[1] >= 2) o.cap = +m[1]; }
    else if (o.fam === "cazan" || o.fam === "pompa_caldura") { const m = /(\d{1,4}(?:[.,]\d)?) ?kw\b/.exec(t); if (m) o.kw = Math.round(parseFloat(m[1].replace(",", "."))); }
    else if (o.fam === "clima") { const m = /\b(\d{1,2}) ?[.]?000 ?btu|\b(\d{4,5}) ?btu/.exec(t); if (m) o.btu = m[1] ? +m[1] * 1000 : +m[2]; }
    return o;
  }
  /** Numele familiei, pentru afișare („Țeavă PPR”, „Robinet de trecere (…)”). */
  function famLabel(id) {
    if (!id) return "";
    if (id.startsWith("teava:")) { const m = MATS.find(x => x[0] === id.slice(6)); return "Țeavă " + (m ? m[1] : ""); }
    return FAM[id] ? FAM[id][1] : id;
  }
  /* Catalogul de lucrări: numele unei lucrări după familie, mărime și variantă („Țeavă PPR Ø25 (DN20)”, „Vas WC – suspendat”). */
  const DN2DE = { 12: 16, 15: 20, 20: 25, 25: 32, 32: 40, 40: 50, 50: 63, 65: 75, 80: 90, 100: 110, 125: 125, 150: 160, 200: 200, 250: 250, 300: 315, 400: 400 };
  const VARLAB = { dizabilitati: "pentru persoane cu dizabilități", fonta: "fontă", pvc: "PVC", pehd: "PEHD", pp: "PP", co2: "CO2", p50: "P50, transportabil", fotocelula: "cu senzor", hidrant: "hidranți", "de radiator": "de calorifer",
    spalator: "spălător", wc: "WC", dus: "duș", interioara: "unitate interioară", exterioara: "unitate exterioară", functionare: "funcționare", terasa: "terasă", plastic: "din plastic", metal: "metalic", flanse: "cu flanșe" };
  const varLab = v => { let m; if (VARLAB[v]) return VARLAB[v]; if ((m = /^(\d+)l$/.exec(v))) return m[1] + " l"; if ((m = /^(\d+)kw$/.exec(v))) return m[1] + " kW"; if ((m = /^(\d+)btu$/.exec(v))) return (+m[1]).toLocaleString("ro-RO") + " BTU"; return v; };
  function nomLabel(fam, sz, vars) {
    const fv = (fam === "fiting" || fam === "racord") && (vars || []).find(v => FITLAB[v]);
    if (fv) { const pl = (vars || []).includes("plastic"), mt = (vars || []).includes("metal"), rest = (vars || []).filter(v => v !== fv && v !== "plastic" && v !== "metal" && !(v === "pvc" || v === "pp" || v === "pehd"));
      const s = sz == null || sz === "" ? "" : pl && DN2DE[sz] ? " Ø" + DN2DE[sz] + " (DN" + sz + ")" : " " + dnLabel(+sz);
      return FITLAB[fv] + (pl ? " din plastic" : mt ? " metalic" : "") + s + (rest.length ? " – " + rest.map(v => VARLAB[v] || v).join(", ") : ""); }
    if (fam === "radiator" && (vars || []).some(v => /^[th]\d+$/.test(v))) { const ty = (vars || []).find(v => /^t\d+$/.test(v)), h = (vars || []).find(v => /^h\d+$/.test(v)), rest = (vars || []).filter(v => !/^[th]\d+$/.test(v));
      return "Radiator" + (ty ? " tip " + ty.slice(1) : "") + (h ? " H" + h.slice(1) : "") + (sz != null && sz !== "" ? " L" + sz : "") + (rest.length ? " – " + rest.map(varLab).join(", ") : ""); }
    const base = famLabel(fam).replace(/ \(.*$/, "").replace(/:.*$/, "").trim(), kind = KINDOF(fam); let s = "";
    if (sz != null && sz !== "") {
      if (kind === "dn") { const mat = fam.startsWith("teava:") ? fam.slice(6) : "", sewer = mat === "pvc" || mat === "pp" || ["curatire", "sifon_pard", "receptor", "caciula", "aerator"].includes(fam), plastic = ["ppr", "pex", "mst", "pehd"].includes(mat);
        s = (sewer || plastic) && DN2DE[sz] ? "Ø" + DN2DE[sz] + (plastic ? " (DN" + sz + ")" : "") : dnLabel(+sz); }
      else s = szLabel(kind, +sz);
    }
    const full = norm(famLabel(fam)), vs = (vars || []).filter(v => { const V = VARIANTS.find(x => x[0] === v); return !(V && V[1].test(full)); });   // „wc” la Vas WC, „pvc” la Țeavă PVC: se înțeleg din nume
    return base + (s ? " " + s : "") + (vs.length ? " – " + vs.map(varLab).join(", ") : "");
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
    if (kind === "mth") { if (a.mth != null && b.mth != null) return a.mth === b.mth ? 3 : 0.5; return a.mth == null && b.mth == null ? 2 : b.mth == null ? 1.5 : 1; }
    return 2;
  }
  const varFit = (a, b) => { const I = a.vars, C = b.vars; return I.filter(v => C.includes(v)).length - 0.5 * C.filter(v => !I.includes(v)).length - 0.25 * I.filter(v => !C.includes(v)).length; };

  /** Potrivește o poziție cu catalogul. Întoarce {id, score, sure, exact, why} sau null.
      sure = aceeași familie, aceeași unitate, aceeași dimensiune și nicio îndoială între variante cu prețuri diferite. */
  function matchItem(item, pcat) {
    const sk = keyOf(item.den), fam = umFamily(item.um);
    for (const c of pcat) if (c.key && c.key === sk && c.f.um === fam && isLump(c.um) === isLump(item.um)) return { id: c.id, score: 99, sure: true, exact: true, why: "aceeași denumire, preț pus de tine" };
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
  const radH = f => (f.rad && f.rad.h) || +((f.vars || []).find(v => /^h\d+$/.test(v)) || "h0").slice(1) || null;
  const radT = f => f.radt || ((f.vars || []).find(v => /^t\d+$/.test(v)) || "").slice(1) || null;
  const sizeOf = (f, kind) => kind === "dn" ? (f.dn.length ? Math.max.apply(null, f.dn) : null) : kind === "thick" ? f.thick : kind === "rad" ? (f.rad && f.rad.l) || null : kind === "mm" ? f.mm : kind === "mth" ? f.mth : null;
  const SLOPE = { dn: 0.6, mm: 0.55, thick: 0.3, rad: 0.5 };
  /* Lucrări care se plătesc cam la fel (pentru când nu există niciun preț la lucrarea cerută). */
  const ALIKE = [
    ["rob_trecere", "clapeta_sens", "filtru_y", "rob_golire", "vana_fluture", "electrovana", "vana_2c", "vana_3c", "vana_amestec", "reductor", "supapa_sig", "rob_reglaj", "antivibrant", "rob_plutitor", "contor", "rob_hidrant", "disconector"],
    ["lavoar", "spalator", "vas_wc", "pisoar", "cada", "vidoar"], ["radiator", "rad_baie", "rad_electric"], ["curatire", "sifon_pard", "receptor", "aerator", "caciula"],
    ["teava:ppr", "teava:pex", "teava:mst", "teava:cu"], ["teava:ol", "teava:zn", "teava:inox"], ["teava:pvc", "teava:pp", "teava:pehd", "teava:fonta"],
    ["vent_tub_c", "vent_flex"], ["ventilo", "aeroterma"], ["pif", "reglaj_inst"], ["boiler", "vas_exp"], ["cazan", "pompa_caldura"], ["hidrant_int", "hidrant_ext"], ["fiting", "cuplaj", "racord"],
  ];
  const alikeOf = fam => { const out = []; for (const g of ALIKE) if (g.includes(fam)) for (const x of g) if (x !== fam && !out.includes(x)) out.push(x); return out; };
  /* Familii la care prețul depinde mult de aparat sau de situație: prețul pus se arată mereu „de verificat”. */
  const LOOSE = new Set(["fiting", "racord", "garnitura", "gol", "transport", "electric", "gaz", "teava", "demontare", "eticheta", "grund", "pif", "terasament", "clima", "vent", "camin", "pompa_caldura", "pard_acc", "piesa", "prindere", "etansare", "reglaj_inst", "proiect", "constructii"]);
  const med = a => { a = a.slice().sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0; };
  const nice = p => p < 20 ? Math.round(p * 10) / 10 : p < 200 ? Math.round(p * 2) / 2 : p < 2000 ? Math.round(p) : Math.round(p / 10) * 10;
  const f2 = n => (Math.round(n * 100) / 100).toLocaleString("ro-RO", { maximumFractionDigits: 2 });

  /** Tariful: lista de surse → puncte grupate pe familie și unitate.
      src: [{den, desc?, um, pret, q, an?, lab?, dom?, sec?, id?, learned?, lo?, hi?}]  (lo/hi = interval de DN la reperele de piață) */
  const famInfo = c => { const k0 = KINDOF(c.fam), z = +c.sz || null, base = c.fam.replace(/:.*$/, ""), mat = c.fam.startsWith("teava:") ? c.fam.slice(6) : null;
    return { t: norm(c.den), fam: c.fam, grp: (FAM[base] || [])[2] || null, um: umFamily(c.um), mat, dn: k0 === "dn" && z ? [z] : [], thick: k0 === "thick" ? z : null, rad: k0 === "rad" && z ? { h: null, l: z } : null, mm: k0 === "mm" ? z : null, mth: k0 === "mth" ? z : null, vars: c.vars || [], pc: (c.vars || []).includes("plastic") ? "plast" : (c.vars || []).includes("metal") ? "metal" : undefined }; };
  function buildTarif(src) {
    const T = { by: new Map(), name: new Map(), same: new Map(), sameW: new Map(), n: 0, hl: 0 };
    for (const c of src) {
      if (!(+c.pret > 0)) continue;
      let f;
      if (c.fam) f = famInfo(c);
      else { const full = c.desc && String(c.desc).trim() ? c.desc + " | " + c.den : c.den; f = classify(full, c.um); const fd = classify(c.den, c.um);
        if (!f.fam || (fd.fam && f.fam !== fd.fam && !(c.desc && String(c.desc).trim().length > 12))) f = fd;
        if (f.fam && fd.fam === f.fam) { for (const d of fd.dn) if (!f.dn.includes(d)) f.dn.push(d); if (f.thick == null) f.thick = fd.thick; if (!f.rad) f.rad = fd.rad; if (f.mm == null) f.mm = fd.mm; } }
      const uk = f.um + (isLump(c.um) ? "|L" : "");   // „ans”, „sistem” (o sumă pe tot) și „buc” au aceeași unitate, dar la aceeași denumire nu-și dau prețul unul altuia
      if (c.learned) T.name.set(keyOf(c.den) + "|" + uk, { p: +c.pret, id: c.id, lab: c.lab || "prețul tău" });
      else if ((c.q == null ? QUAL.ref : c.q) >= QUAL.ref) { const k0 = keyOf(c.desc && String(c.desc).trim().length > 14 ? c.desc : c.den) + "|" + uk, o = T.same.get(k0); if (!o || (c.q || 0) > o.q || ((c.q || 0) === o.q && (+c.an || 0) > o.an)) T.same.set(k0, { p: +c.pret, id: c.id, lab: c.lab || "", q: c.q || 0, an: +c.an || 0 }); }
      else if ((c.q || 0) >= QUAL.weak) { const k0 = keyOf(c.den) + "|" + uk, o = T.sameW.get(k0); if (!o || (+c.an || 0) > o.an) T.sameW.set(k0, { p: +c.pret, id: c.id, lab: c.lab || "", an: +c.an || 0 }); }   // aceeași denumire într-o ofertă / situație veche „de verificat”
      if (!f.fam) continue;
      const kind = KINDOF(f.fam), pt = { fam: f.fam, f, kind, tk: toks(f.t || norm(c.den)), sz: sizeOf(f, kind), lo: c.lo || null, hi: c.hi || null, p: +c.pret, q: c.q == null ? QUAL.ref : c.q, an: +c.an || 0, lab: c.lab || "", d: c.d != null ? c.d : domOf(c), id: c.id, den: c.den, lump: isLump(c.um), hl: hardLump(c.um) };
      const k = f.fam + "|" + f.um; let a = T.by.get(k); if (!a) T.by.set(k, a = []); a.push(pt); T.n++; if (pt.hl) T.hl++;
    }
    return T;
  }
  const dnIdx = dn => { let b = 0, bd = 1e9; for (let i = 0; i < DNS.length; i++) { const d = Math.abs(DNS[i] - dn); if (d < bd) { bd = d; b = i; } } return b; };
  const szLabel = (kind, v) => kind === "dn" ? "DN" + v : kind === "thick" ? v + " mm" : kind === "rad" ? "L" + v : kind === "mth" ? "M" + v : "Ø" + f2(v);
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
  const PIECE = new Set(["fiting", "racord"]), STRONGV = ["canelat", "hidrant", "inox", "fonta", "solar"];
  function pickIn(fi, pts, dItem, far) {
    if (!pts || !pts.length) return null;
    const kind = KINDOF(fi.fam); let x = okSize(kind, fi.fam, far ? sizeOf(fi, KINDOF(far)) : sizeOf(fi, kind)), assumed = 0;
    if (x == null && kind === "dn" && fi.fam.startsWith("teava:")) { x = fi.cls === "sewer" ? 100 : fi.cls === "plastic" ? 20 : 25; assumed = x; }   // țeavă fără diametru scris: socotesc ca pentru diametrul obișnuit
    const short = famLabel(far || fi.fam).replace(/ \(.*$/, "").replace(/:.*$/, ""), tk = toks(fi.t);
    /* calorifere: aceeași lungime nu e „aceeași mărime” dacă înălțimea sau tipul (22, 33) diferă */
    const xh = kind === "rad" ? radH(fi) : null, xt = kind === "rad" ? radT(fi) : null;
    const rdif = p => { if (kind !== "rad") return ""; const ph = radH(p.f), pt = radT(p.f); return xh && ph && xh !== ph ? "înălțime " + xh + " față de " + ph : xt && pt && xt !== pt ? "tip " + xt + " față de " + pt : ""; };
    const mm = a => [Math.min.apply(null, a), Math.max.apply(null, a)];
    for (const tier of [[3, 9], [2, 2], [1, 1], [0, 0]]) {            // 1) lista ta de prețuri; 2) alte oferte ale tale; 3) surse mai slabe (bugete, prețuri deduse); 4) piață
      const S = pts.filter(p => p.q >= tier[0] && p.q <= tier[1] && !(PIECE.has(fi.fam) && (p.f.vars.some(v => STRONGV.includes(v) && !fi.vars.includes(v)) || (fi.pc && p.f.pc && fi.pc !== p.f.pc)))); if (!S.length) continue;   // un cot de PP nu ia prețul unui cot canelat de hidranți
      const sc = S.map(p => ({ p, sz: okSize(kind, fi.fam, p.sz), dm: p.q >= QUAL.mine ? 1 : (dItem && p.d ? (dItem === p.d ? 1 : 0) : 0.5), dv: varFit(fi, p.f), sim: Math.round(simOf(tk, p.tk) * 4) / 4, rd: rdif(p) }));
      sc.forEach(e => { e.ex = !kind ? 1 : (x != null && !e.rd && (e.sz === x || (e.p.lo && x >= e.p.lo && x <= e.p.hi) || (kind === "dn" && fi.dn.some(d => e.p.f.dn.includes(d))))) ? 1 : 0; });
      const rok = sc.some(e => e.sz != null && !e.rd);   // calorifere: există prețuri la aceeași înălțime și același tip (la alte lungimi)
      const mineFirst = !!kind || !(LOOSE.has(fi.fam) || SOFT.has(fi.fam));        // la aceeași lucrare, prețul pus de tine bate lista, oricum ar fi scrisă denumirea
      const rank = (a, b) => b.dm - a.dm || b.dv - a.dv || (mineFirst ? (b.p.q >= QUAL.mine) - (a.p.q >= QUAL.mine) : 0) || b.sim - a.sim || b.p.q - a.p.q || b.p.an - a.p.an;
      const base = tier[0] >= 3 ? 0 : tier[0] === 2 ? 3 : tier[0] === 1 ? 4 : 5; let res = null;
      let E = sc.filter(e => e.ex).sort(rank);
      if (kind && E.length && E[0].dm === 0 && x != null) { const own = sc.filter(e => e.dm > 0 && e.sz != null).map(e => e.sz); if (own.length && x > Math.min.apply(null, own) && x < Math.max.apply(null, own)) E = []; }   // între două dimensiuni de la același fel de instalație: socotesc între ele; în afara lor: iau prețul tău de la dimensiunea exactă, chiar de la alt fel de instalație
      else if (kind && E.length && E[0].dv < 0 && sc.some(e => e.sz != null && e.dv >= 0 && e.dm >= E[0].dm)) E = [];   // aceeași dimensiune doar la altă variantă (ex. pluvial): socotesc din varianta bună      // aceeași dimensiune doar la alt fel de instalație: mai bine socotesc între dimensiunile vecine de la același fel
      const RH = !E.length && kind === "rad" && x != null && !rok ? sc.filter(e => e.sz === x && e.rd).sort(rank) : [];   // doar aceeași lungime la altă înălțime sau alt tip
      if (E.length) {
        const t = E[0], same = E.filter(e => e.dm === t.dm && e.dv === t.dv), grp = same.filter(e => e.sim === t.sim && e.p.q === t.p.q && e.p.an === t.p.an), p = med(grp.map(e => e.p.p));
        const clean = fi.vars.every(v => t.p.f.vars.includes(v)) && t.p.f.vars.every(v => fi.vars.includes(v)), r = mm(same.map(e => e.p.p)), wide = r[1] / r[0] > 2.5;
        if (!kind && t.sim < 0.5 && (wide || LOOSE.has(fi.fam) || SOFT.has(fi.fam))) continue;   // aceeași familie, dar lucrări prea diferite între ele și niciuna care să semene: nu ghicesc
        res = { p, lv: t.dm > 0 && clean && !(!kind && (t.sim < 0.5 || (wide && t.sim < 0.75))) ? 2 : 3, pt: t.p, why: short + (kind && x != null ? ", " + szLabel(kind, x) : "") + (t.dm === 0 ? "; prețul tău pentru dimensiunea asta e de la alt fel de instalație" : !clean ? "; altă variantă" : !kind && wide ? "; ai prețuri diferite la lucrarea asta (" + f2(r[0]) + "–" + f2(r[1]) + " lei), l-am luat pe cel care seamănă cel mai mult" : "") };
      } else if (RH.length) {
        const t = RH[0], g = RH.filter(e => e.dm === t.dm && e.rd === t.rd);
        res = { p: med(g.map(e => e.p.p)), lv: 3, pt: t.p, why: short + ", " + szLabel(kind, x) + ": " + t.rd + ", de verificat" };
      } else if (kind && x != null && sc.some(e => e.sz != null)) {
        const W = sc.filter(e => e.sz != null && !(e.rd && rok)).sort(rank), t = W[0], G = W.filter(e => e.dm === t.dm && (e.dv >= 0) === (t.dv >= 0)), by = new Map();
        for (const e of G) { const o = by.get(e.sz); if (!o || rank(e, o) < 0) by.set(e.sz, e); }
        const ser = [...by.values()].map(e => ({ s: e.sz, p: e.p.p, pt: e.p })), r = interp(x, ser, kind);
        const steps = kind === "dn" ? Math.abs(dnIdx(x) - dnIdx(r.a.s)) : Math.abs(Math.log(x / r.a.s)) / 0.25;
        if (r.out) r.p = Math.min(r.a.p * 3, Math.max(r.a.p / 3, r.p));               // în afara dimensiunilor cunoscute nu mă depărtez de mai mult de 3 ori
        res = { p: nice(r.p), lv: r.out && steps > 2 ? 4 : 3, pt: r.a.pt, why: short + ": " + (r.b ? "socotit între " + szLabel(kind, r.a.s) + " (" + f2(r.a.p) + " lei) și " + szLabel(kind, r.b.s) + " (" + f2(r.b.p) + " lei)" : "socotit după " + szLabel(kind, r.a.s) + " (" + f2(r.a.p) + " lei); " + (sc.some(e => e.ex) ? "la " + szLabel(kind, x) + " ai preț doar la altă variantă sau la alt fel de instalație" : "nu ai preț la " + szLabel(kind, x))) + (t.rd ? "; " + t.rd : "") };
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
  const UMMULT = [[/^(?:zeci|10) ?(?:de )?(?:m|ml|metri)$/, 10, "ml"], [/^(?:sute|suta|100) ?(?:de )?(?:m|ml|metri)$/, 100, "ml"], [/^zeci ?(?:de )?mp$/, 10, "mp"], [/^(?:sute|suta|100) ?(?:de )?mp$/, 100, "mp"], [/^(?:sute|suta|100) ?(?:de )?mc$/, 100, "mc"], [/^zeci ?(?:de )?(?:buc|bucati)$/, 10, "buc"]];
  /** Prețul unei poziții. Unitățile de deviz „zeci m”, „sute m”, „100 mc” se socotesc din prețul pe unitatea simplă, înmulțit. */
  function priceItem(item, T) {
    const u = norm(String(item.um || "")).replace(/\./g, "").trim();
    for (const [re, k, base] of UMMULT) if (re.test(u)) {
      const r = priceItem0(Object.assign({}, item, { um: base }), T); if (!r) return null;
      return Object.assign({}, r, { p: r2(r.p * k), mult: k, why: r.why + " · prețul pe " + base + " înmulțit cu " + k + " (în listă unitatea e „" + String(item.um).trim() + "”)" });
    }
    return priceItem0(item, T);
  }
  function priceItem0(item, T) {
    const lump = isLump(item.um), um = umFamily(item.um) + (lump ? "|L" : ""), kn = keyOf(item.den), ex = T.name.get(kn + "|" + um);
    if (ex) return { p: ex.p, lv: 1, why: "aceeași denumire, preț pus de tine", lab: ex.lab, id: ex.id, fam: "", src: item.den };
    const sm = T.same.get(kn + "|" + um);
    if (sm && kn.length > 14) return { p: sm.p, lv: 2, why: "aceeași denumire ca în prețurile tale", lab: sm.lab, id: sm.id, fam: "", src: item.den };
    const sw = kn.length > 5 ? T.sameW.get(kn + "|" + um) : null;
    /* aceeași denumire, dar o parte e o sumă pe tot (ans, sistem, lot) și cealaltă e pe bucată: prețul nu trece de la una la alta, la nicio lucrare
       (nici la aparate: vas WC, calorifer, robinet, hidrant, boiler). Un preț luat din altă parte e „de verificat” (nivel ≥ 3) și explicația spune de ce. */
    const ou = umFamily(item.um) + (lump ? "" : "|L"), other = T.name.get(kn + "|" + ou) || (kn.length > 14 && T.same.get(kn + "|" + ou)) || (kn.length > 5 && T.sameW.get(kn + "|" + ou));
    const r0 = priceItem1(item, T, sw, lump, !!other);
    if (!other) return r0;
    const note = lump ? "la tine e preț pe bucată pentru aceeași denumire (" + f2(other.p) + " lei), aici e o sumă pe tot" : "la tine e preț pe ansamblu pentru aceeași denumire (" + f2(other.p) + " lei), aici e pe " + (umFamily(item.um) === "buc" ? "bucată" : umFamily(item.um));
    return r0 ? Object.assign({}, r0, { lv: Math.max(r0.lv, 3), why: r0.why + "; " + note + ", de verificat" }) : null;
  }
  function priceItem1(item, T, sw, lump, xo) {
    const swR = () => ({ p: sw.p, lv: 3, why: "aceeași denumire, dintr-o ofertă veche de-a ta (de verificat)", lab: sw.lab, id: sw.id, fam: "", src: item.den });
    let fi = item.fam ? famInfo(item) : classify(item.den, item.um), byCod = false;
    if ((!fi.fam || fi.fam === "teava") && item.cod) { const h = normHint(item.cod); if (h) { fi = famInfo({ den: item.den, um: item.um, fam: h.fam, sz: h.sz }); byCod = true; } }   // textul nu spune ce e (sau spune doar „țeavă”), dar codul de normă spune; nu trece peste o lucrare recunoscută (demontare, gaze, clima…)
    if (!fi.fam) return sw ? swR() : null;
    const dItem = (FAM[fi.fam] || [])[2] === "h" || domOfCap(item.cap) === "h" ? "h" : (domOfCap(item.cap0) || domOfCap(item.cap));
    if (lump && /\bvrf\b|\bvrv\b|multisplit/.test(fi.t)) return null;   // un sistem VRF întreg: nu există reper care să i se potrivească
    /* la lucrările care se plătesc după mărime (țeavă, probe, spălare…) și oriunde ai aceeași denumire cu cealaltă unitate (xo), o sumă pe tot (ans, sistem, lot)
       și un preț pe bucată nu se amestecă, în niciun sens. „lot”, „inst”, „lucrare” iau preț doar de la o sumă pe tot, iar o bucată nu ia prețul unui „lot” (ca înainte de 15.11, când erau unități separate). */
    const wf = WORKFAM.has(fi.fam.replace(/:.*$/, "")), sep = wf || !!xo, hard = hardLump(item.um), same = lump ? p => p.lump : p => !p.lump;
    const keep = sep || hard ? same : !lump && T.hl ? p => !p.hl : null;
    const ptsOf = k => { const a = T.by.get(k); return a && keep ? a.filter(keep) : a; };
    /* la orice altă lucrare (portat din reparațiile echipei v3, P1 și P3): prețurile pe ansamblu și cele pe bucată nu se amestecă într-un calcul (mediană, socotit între mărimi).
       Întâi doar sursele pe aceeași unitate; dacă există doar pe cealaltă, prețul rămâne propunere, dar „estimat larg” (nivel ≥ 4) și spus clar. Fără surse pe cealaltă unitate: exact ca înainte. */
    const uTxt = umFamily(item.um) === "buc" ? "bucată" : umFamily(item.um);
    const pick2 = (fx, pts, far) => {
      if (!pts || !pts.length || keep === same) return pickIn(fx, pts, dItem, far);
      const sm = pts.filter(same); if (sm.length === pts.length) return pickIn(fx, pts, dItem, far);
      const rs = sm.length ? pickIn(fx, sm, dItem, far) : null, ro0 = pickIn(fx, pts.filter(p => !same(p)), dItem, far);
      const ro = ro0 && Object.assign({}, ro0, { lv: Math.max(ro0.lv, 4), why: ro0.why + "; " + (lump ? "vine din prețuri pe bucată, aici e o sumă pe tot" : "vine din prețuri pe ansamblu, aici e pe " + uTxt) + ", de verificat" });
      return rs && (!ro || rs.lv <= ro.lv) ? rs : ro;
    };
    let r = pick2(fi, ptsOf(fi.fam + "|" + fi.um), "");
    if (r && byCod) r = Object.assign({}, r, { why: r.why + " · recunoscut după codul " + String(item.cod).trim() });
    if (r && r.lv <= 3) return r;
    for (const alt of alikeOf(fi.fam)) { const r2_ = pick2(Object.assign({}, fi, { fam: alt, vars: fi.vars }), ptsOf(alt + "|" + fi.um), fi.fam && alt); if (r2_ && (!r || r2_.lv < r.lv)) { r = r2_; r.fam = fi.fam; break; } }
    if (sw && (!r || r.lv >= 4)) return swR();
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
  /* Codurile de normă de deviz din listele F3 (ex. SA04C) spun ce lucrare e, chiar când textul e scurt sau scris altfel.
     Doar coduri verificate: lista ta „Instalatii Sani+Term+Hidr Cez” (cod + descriere), devizul public Sânpetru (SA07, SD27B) și devize publice F3 (SA03/SA04/SA14–17).
     Litera de după cifre dă diametrul doar unde l-am văzut confirmat; altfel nu ghicim mărimea. Mărimea e DN (PPR 20 mm = DN15). */
  const ZN = { A: 15, B: 20, C: 25, D: 32, E: 40, F: 50, G: 65, H: 80 }, PPR = { B: 15, C: 20, D: 25, E: 32, F: 40, G: 50 };
  const NORMS = [
    [/^SA0[34]([A-H])\d*$/, "teava:zn", ZN],          // țeavă oțel zincat în coloane (SA03) / distribuție (SA04): A = 1/2" … H = 3"
    [/^SA07A0?1$/, "teava:zn", 50], [/^SA07B0?1$/, "teava:zn", 65],
    [/^SA14([B-G])\d*$/, "teava:ppr", PPR],           // țeavă PP-R prin polifuziune: B = 20 mm … G = 63 mm
    [/^SA1[57][A-H]\d*$/, "teava:ppr", null], [/^IC36[A-H]\d*$/, "teava:ppr", null],
    [/^SA35/, "fiting", null], [/^IC38/, "fiting", null],
    [/^SA38/, "fixare", null], [/^IC40/, "fixare", null], [/^SA33/, "tub_protectie", null],
    [/^IC39/, "distribuitor", null], [/^SD27B\d*$/, "hidrant_int", null],
    [/^SF0[1-4][A-B]\d*$/, "proba", null], [/^SF05[A-B]\d*$/, "spalare", null],
  ];
  function normHint(cod) {
    const c = String(cod == null ? "" : cod).toUpperCase().replace(/[\s.\-]/g, "");
    if (!c) return null;
    for (const [re, fam, sz] of NORMS) { const m = re.exec(c); if (m) return { fam, sz: sz && typeof sz === "object" ? (sz[m[1]] || null) : sz }; }
    return null;
  }
  /* ---------- banii pe o zi de om (cercetarea din 15.11.2026, ideile 1, 3, 4, 5, 10) ---------- */
  /* CAM = contribuția asiguratorie pentru muncă, 2,25% din salariul brut, plătită de firmă
     (https://www.capital.ro/costul-unui-angajat-in-romania-in-2026-diferenta-dintre-salariul-net-brut-si-costul-total.html). */
  const CAM = 2.25;
  /* Salariul minim în construcții, 2026: 4.582 lei brut pe lună, adică 27,71 lei pe oră; cu CAM 2,25% firma plătește cel puțin 28,34 lei pe oră.
     Surse: Inspecția Muncii, comunicat aprilie 2026 (https://www.inspectiamuncii.ro/documents/521316/523496/20260407_COMUNICAT+PRESA+INFORMARE+ANGAJATORI+DIN+DOMENIUL+CONSTRUCTIILOR+-APRILIE+2026.pdf/11a0c4b0-f07a-4515-b18f-920a305473ab)
     și https://folositor.ro/ghid/salariu-minim-sectorial-2026. */
  const MINCONSTR = { an: 2026, brut: 4582, ora: 27.71, oraCost: 28.34, sursa: "Inspecția Muncii, comunicat din aprilie 2026; CAM 2,25%" };
  /** Cât costă firma pe o zi de om. o: {oameni, salariu (brut pe lună), masini, chirie, scule, contabil (lei pe lună), zile (de lucru pe an de om), pierdute (din ele), ore (pe zi, 8)}.
      Costul pe an (salarii cu CAM + cheltuieli fixe) împărțit la om-zilele în care se lucrează efectiv. */
  function costZi(o) {
    o = o || {}; const v = k => { const x = +o[k]; return isFinite(x) ? Math.max(0, x) : 0; };   // o valoare negativă, scrisă greșit sau infinită („1e400”) contează ca 0 (nu dă un cost negativ sau ∞)
    const n = v("oameni"), zp = v("zile") - v("pierdute"), ore = v("ore") || 8;
    const sal = n * v("salariu") * (1 + CAM / 100) * 12, fixe = (v("masini") + v("chirie") + v("scule") + v("contabil")) * 12, oz = n * zp;
    if (!(oz > 0) || !(sal + fixe > 0)) return null;
    const zi = (sal + fixe) / oz; if (!isFinite(zi) || !isFinite(sal + fixe)) return null;   // sume prea mari ca să fie adevărate
    return { an: r2(sal + fixe), sal: r2(sal), fixe: r2(fixe), omZile: oz, zileOm: zp, zi: r2(zi), ora: r2(zi / ore) };
  }
  /** Preț din „câte faci pe zi”: lei pe om-zi × oameni ÷ bucăți (sau metri) pe zi. */
  function prodPret(t, oameni, q) { return t > 0 && oameni > 0 && q > 0 ? r2(t * oameni / q) : 0; }
  /** Pozițiile care fac cea mai mare parte din bani (analiza ABC): cele mai mari valori, până se adună `share` (80%) din total. Întoarce indicii, în ordinea valorii. */
  function topShare(vals, share) {
    share = share || 0.8; const ix = vals.map((v, i) => [+v || 0, i]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const tot = ix.reduce((a, x) => a + x[0], 0), idx = []; let s = 0;
    for (const [v, i] of ix) { if (s >= tot * share - 1e-9) break; idx.push(i); s += v; }
    return { idx, sum: r2(s), tot: r2(tot), pct: tot > 0 ? s / tot : 0 };
  }
  /* Indicele costului în construcții (INS), 2021 = 100: media pe an și ultimul trimestru publicat.
     Sursa: INS, prin Eurostat – „Construction producer prices or costs, new residential buildings”, România, costuri (indic_bt = COST), index 2021 = 100:
     anual https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sts_copi_a?geo=RO (actualizat 26.09.2026)
     trimestrial https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sts_copi_q?geo=RO (actualizat 14.11.2026; trim. II 2026 = 164,7).
     Verificat și cu seria INS „Construction Cost Index: Buildings: Residential” (sept. 2025 = 153,5) de la https://www.ceicdata.com/en/romania/construction-cost-index-2021100 . Citit la 15.11.2026.
     Formula (OUG 64/2022, ghidul de aplicare): preț nou = preț vechi × indice acum ÷ indice atunci. */
  const ICC = { baza: "2021 = 100", acum: 164.7, acumLbl: "trim. II 2026", acumAn: 2026,
    an: { 2010: 59.6, 2011: 65.0, 2012: 69.2, 2013: 66.2, 2014: 65.8, 2015: 65.4, 2016: 65.9, 2017: 71.1, 2018: 79.9, 2019: 87.6, 2020: 88.8, 2021: 100.0, 2022: 119.0, 2023: 128.6, 2024: 141.2, 2025: 150.9 },
    sursa: "INS (indicele costului în construcții, clădiri rezidențiale noi, 2021 = 100), publicat de Eurostat; citit la 15.11.2026" };
  /** De câte ori a crescut costul în construcții din anul `an` până azi (1 = nu se schimbă: anul curent, un an viitor sau unul fără indice). */
  function iccFactor(an) { const y = parseInt(an, 10), v = ICC.an[y]; return y && v && y < ICC.acumAn ? ICC.acum / v : 1; }
  const api = { normHint, QUAL, buildTarif, priceItem, nomLabel, KINDOF, domainOf, alikeOf, isLump, isBroad, CAPS, autoCap, counts, HIST, keyOf, strip, norm, feats, score, classify, famLabel, dnLabel, entryLabel, famList, MV, sizes, FAMS, G, prepCatalog, matchItem, total, chapters, risc, r2, umFamily, CAM, MINCONSTR, costZi, prodPret, topShare, ICC, iccFactor };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.OF = api;
})(typeof window !== "undefined" ? window : globalThis);

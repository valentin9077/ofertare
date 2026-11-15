# STARE – Ofertare SCV v2 (se actualizează la fiecare pas)
- 15.11 12:05 Pornit. Cercetarea din 15.11 (raport în conversație) e baza. Plan: plans/2026-11-15-oferta-v2.md.
- Mediu de test: /home/claude/qa (serve.sh pe :8765 servește docs/, harness.py cu mock Supabase).
- Branch de lucru: claude/oferta-v2-wip (NU se publică). Deploy: claude/work-quotation-app-bv6cv → docs/.
- 12:20 T2+T3 GATA (commit 04a3d9b): familii noi bideu/solar/dedurizator/slit, sinonime, normHint(cod). Test: plans/qa/test_core.js 36/36. Regresie pe 2.696 texte din exemple: 23 schimbări, toate corecte.
- 12:27 T1 GATA: piata.json 121 → 164 repere (43 noi cu surse, n, data; 10 vechi au primit familie). Test: plans/qa/test_piata.js 9/9.
- URMEAZĂ: integrare normHint în priceItem/classify când textul nu are familie (T3 rest), apoi T4+T5 (semafor, interval, termometru, fișa „De ce acest preț?”).
- Unelte de test copiate în plans/qa/ (mock-supabase.js, harness.py, serve.sh, test_*.js). Pornire: plans/qa/serve.sh (servește docs/ pe :8765).
- 12:50 T3 rest GATA (cod de normă în priceItem). T4+T5 GATA: semafor (bordura stânga), linie „Piață: min–max · din N surse” + sub/în/peste piață, fișa „De ce acest preț?” (sursa, piața cu linkuri, prețurile tale vechi), filtrul „De lucrat”. Test UI plans/qa/ui_flow.py 7/7.
- 13:00 T6+T7 GATA: „Rotunjire, adaos și condiții” (acces greu +10/+20%, urgent +25%, noapte/sărbători +50%; st.cond; adaosul total = compunere, nu se adună de două ori), linie „Condiții:” în foaie, bară jos cu total fără/cu TVA și câte poziții au preț. Test plans/qa/ui_cond.py 9/9.
- 13:20 T8+T9 GATA: verificare cu lucrări uitate după tipul lucrării (brățări/suporți, căciulă ventilație, colțare, filtru și kit evacuare la centrală, grup de siguranță la boiler, ANRE la gaze) + sumă pe aparat pe capitol (sanitare/obiect, termice/calorifer, hidranți/cutie) față de mediana ofertelor tale sau oferta din 27.07.2026; doar când ~tot are preț. window.OFAPP pentru teste (doar citire). Test plans/qa/ui_chk.py.
- 13:35 T10 GATA: piata.json.material (50 prețuri de raft: PPR, multistrat, cupru, PVC, fitinguri PPR, cu marcă și sursă), filtrul „Materiale” în Prețurile mele + fișa materialului (cu/fără TVA), secțiunea „Material, orientativ” în „De ce acest preț?” la țevi. Test plans/qa/ui_mat.py.
- 14:10 T11 în lucru: compatibilitate oferte vechi (ui_compat.py 5/5: sume identice), toate testele UI și pe WebKit (Safari), verificare pe laptop 1280×800 (bara de jos aliniată la coloană), versiuni noi pentru telefoane (app.css v6, core.js v7, app.js v8, cache scv-v14), test Excel ui_xl.py 11/11 (subtotal, TVA, anexă, oferta scurtă, formule recalculate în LibreOffice = aceleași sume). piata.json readus la formatul inițial (în istoric apar doar adăugiri). Recenzie independentă pornită pe diferența față de producție.
- 15:20 Recenzie independentă: 9 probleme confirmate, toate rezolvate:
  1) condițiile (acces/urgență) se aplică și rândurilor scrise de mână (nu și reducerilor cu minus); în Excel prețul unitar e cel cu condiții;
  2) codul de normă nu mai trece peste o lucrare recunoscută din text (ex. demontare);
  3) intervalul de piață de pe card = cel din surse (se înmulțește doar la „zeci m / sute m”);
  4–5) centrala de detecție gaz → gaze, kit evacuare → nerecunoscut ca înainte, panouri fotovoltaice / suport / set racordare ≠ panou solar termic;
  6) tabelul de coduri refăcut doar din coduri verificate: lista ta Cez (39 de coduri cu descriere), devizul Sânpetru, devize F3 publice. SF04 = probă canalizare, SF05 = spălare, IC39 = distribuitor, SA03/SA04 = zincat cu diametru din literă, SA14 = PP-R; scoase SA01A, SA10/12, SA43, IC07A (neconfirmate);
  7) adaosul fără condiții se păstrează exact (7,125 rămâne 7,125);
  8) referința de material la cupru pe diametrul exterior (15 ≠ 22);
  9) verificarea: kit evacuare găsit și după nume; grup de siguranță doar la boiler.
  În plus: condiții vechi agățate după o schimbare pe versiunea veche nu se mai arată; „colțar” la profile de faianță/termometre nu mai e robinet; moloz rămâne ca înainte; dedurizare cu reper propriu; indicatorii ținuți minte pe ofertă (mai repede).
  Teste: core 44/44, piata 9/9, condiții 5/5, UI 7+9+8+5, compatibilitate 5/5, Excel 11/11, remedieri 9/9 – Chrome și WebKit, telefon și laptop. Corpus 2.696 texte: 40 de schimbări față de producție, toate corecte.
- 16:05 Recenzia a doua și a treia: excluderile (centrală de detecție, panou fotovoltaic, colțar de faianță) mutate într-o verificare separată, doar lângă cuvântul cheie – cuvântul cheie rămâne primul, ca în producție. Test nou plans/qa/test_clasif.js: 41 de descrieri + tot corpusul comparat cu producția (23 de schimbări, toate aprobate). Verdict recenzent: „ship after one fix” → fix făcut. Toate testele trec (Chrome + WebKit, telefon + laptop). PUBLICAT.

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

# AquaFirm / AquaOffer — logica aplicației care trebuie să prindă viață

Acest document este harta aplicației din repo-ul `ofertare`. Scopul nu este doar un demo vizual, ci o aplicație de firmă pentru instalații care leagă ofertarea, importul listelor de la beneficiari, situațiile de lucrări, garanțiile, pontajul importat, salariile, cheltuielile, profitul, SmartBill și AI.

## 0. Principiul principal

Aplicația trebuie să funcționeze pe fluxul:

```text
Beneficiar → Import listă beneficiar → Potrivire catalog → Ciornă editabilă → Export Excel / PDF → Acceptare ofertă → Proiect → Situații lucrări → Decontări → Garanții → Facturi SmartBill → Încasări → Pontaj importat → Salarii → Cheltuieli → Profit → Fiscal → AI
```

Aplicația mare nu trebuie să refacă aplicația de pontaj GPS. Trebuie să **preia datele** din aplicația de pontaj existentă, exact cum trebuie să preia facturi și încasări din SmartBill.

---

## 1. Memorie / baza de date

Aplicația are nevoie de două niveluri de memorie:

1. **Memorie locală** pentru lucru rapid în browser: `localStorage` / IndexedDB.
2. **Memorie online** pentru cont, sincronizare și backup: Supabase/Postgres.

Datele importante nu trebuie să stea doar pe telefon. Trebuie sincronizate în cont.

Entități principale:

```text
companies
users
clients
client_sites
product_catalog
product_aliases
imports
import_rows
offers
offer_items
projects
project_items
work_situations
work_situation_items
warranties
warranty_events
attendance_imports
attendance_rows
employees
payroll_periods
payroll_items
expenses
receipts
smartbill_connections
smartbill_documents
fiscal_snapshots
ai_memory
ai_messages
```

---

## 2. Beneficiari cu CUI / ANAF

Flux:

1. Utilizatorul introduce CUI-ul.
2. Aplicația cere datele firmei dintr-un serviciu ANAF / firmă publică / integrare terță.
3. Completează automat beneficiarul.
4. Utilizatorul completează șantierul, contactul și observațiile.

Date beneficiar:

```text
Denumire firmă
CUI
Reg. Com.
Adresă
Telefon
Email
Persoană contact
Șantier / punct de lucru
Istoric oferte
Istoric proiecte
Garanții active
Facturi / încasări
```

---

## 3. Catalog manoperă

Catalogul este inima aplicației. Pentru început este catalog de **manoperă**, nu materiale.

Fiecare articol are:

```text
Denumire internă
Domeniu / grup
Subcategorie
UM
Preț manoperă fără TVA
TVA
Preț cu TVA calculat
Tip: componentă / pachet complet / serviciu
Descriere tehnică
Sinonime / aliasuri
Normativ, dacă există
Status activ/inactiv
```

Domenii recomandate:

```text
A. Sanitare - conducte alimentare apă
B. Canalizare menajeră
C. Canalizare pluvială
D. Obiecte sanitare
E. Armături și accesorii
F. Izolații termice
G. Hidranți interiori
H. Dotări mijloace tehnice PSI
I. Probe de presiune și funcționare
J. Gospodărie apă și PSI
K. Radiatoare
L. Aparate, armături, accesorii
M. Instalații ventilare
N. Echipamente
Diverse
```

---

## 4. Aliasuri / sinonime produse

Beneficiarul poate scrie diferit față de catalogul intern.

Exemplu:

```text
Beneficiar scrie: teava ppr 63
Catalog intern: Țeavă PP-R De63
```

La fiecare potrivire confirmată, aplicația trebuie să salveze aliasul pentru data viitoare.

Regulă:

```text
Dacă utilizatorul confirmă manual o potrivire, aliasul intră în product_aliases.
La următorul import, potrivirea devine automată.
```

---

## 5. Import listă beneficiar

Tipuri de import:

```text
Excel
PDF
Poză / scan OCR
Text copiat
WhatsApp / email
```

Flux:

1. Se încarcă lista primită.
2. Aplicația extrage rândurile.
3. Pentru fiecare rând extrage: denumire, cantitate, UM, observații.
4. Motorul de potrivire caută în catalog.
5. Se creează o ciornă editabilă.

Statusuri rând importat:

```text
matched_auto
needs_review
missing_catalog_item
ignored
manual_added
```

---

## 6. Ciornă editabilă

Ciorna este zona de lucru internă înainte de ofertă.

Coloane:

```text
Nr.
Domeniu
Denumire beneficiar
Denumire internă
Descriere
UM
Cantitate
Preț fără TVA
Total fără TVA
TVA
Total cu TVA
Status potrivire
Încredere potrivire
```

Utilizatorul poate modifica:

```text
Denumirea
Produsul potrivit
Domeniul
Cantitatea
UM
Prețul
Descrierea
Ordinea rândurilor
Dacă rândul intră sau nu în ofertă
```

---

## 7. Exporturi ofertare

Aplicația trebuie să scoată două exporturi:

### 7.1 Excel / listă detaliată

Arată ca lista de prețuri cu multe rânduri.

Include:

```text
Nr.
Denumire lucrare
Descriere
UM
Cantitate
Preț manoperă fără TVA
Total fără TVA
Total cu TVA
```

### 7.2 PDF ofertă finală

Arată ca oferta oficială SCV.

Include:

```text
Antet firmă
Date ofertă
Date beneficiar
Obiectul ofertei
Tabel pe domenii
Subtotal
TVA
Total cu TVA
Condiții de plată
Garanții și termene
Normative aplicate
Oferta nu include
Semnături
Footer firmă
```

---

## 8. Ofertă acceptată → proiect

Când oferta este acceptată:

```text
Oferta devine proiect
Rândurile ofertei devin project_items
Se activează situațiile de lucrări
Se activează decontările
La recepție se creează garanția
```

Status proiect:

```text
nou
in_lucru
partial_decontat
finalizat
facturat
inchis
```

---

## 9. Situații de lucrări

Pentru fiecare poziție din proiect:

```text
Cantitate contractată
Cantitate decontată anterior
Cantitate executată acum
Cantitate rămasă
Preț unitar
Valoare situație curentă
```

Formula:

```text
rămas = contractat - decontat_anterior - executat_acum
valoare_acum = executat_acum × preț_unitar
```

Status situație:

```text
draft
trimisa
aprobata
facturata
platita
anulata
```

---

## 10. Evidență decontări

Pe fiecare proiect:

```text
Total contract
Total decontat
Total facturat
Total încasat
Rămas de executat
Rămas de facturat
Rămas de încasat
Procent execuție
```

---

## 11. Garanții

La finalizarea proiectului / recepție:

```text
Se creează garanție automat
Durata implicită vine din ofertă: de exemplu 24 luni
Data expirării = data recepției + durata garanției
```

Date garanție:

```text
Beneficiar
Șantier
Proiect / contract
Data recepției
Durată garanție
Data expirare
Status
Observații
Documente atașate
```

Notificări:

```text
90 zile înainte
30 zile înainte
7 zile înainte
în ziua expirării
```

Status garanție:

```text
activa
expira_curand
expirata
interventie_deschisa
inchisa
```

---

## 12. Intervenții în garanție

Dacă apare o problemă:

```text
Data sesizării
Descriere problemă
Poze
Angajat / echipă trimisă
Cost intervenție
Status
Data rezolvare
```

Costurile intervențiilor trebuie să intre în profitul proiectului.

---

## 13. Integrare pontaj existent

AquaFirm nu creează pontaj GPS nou. Preia datele din aplicația existentă.

Surse posibile:

```text
API aplicație pontaj
Export Excel / CSV
Acces DB
Webhook zilnic
Import manual
```

Date preluate:

```text
Angajați
Locații
Prezențe
Absențe
Concedii
Zile extra
Pontaj lunar
```

Aceste date se folosesc la:

```text
Salarii
Cost proiect
Profit proiect
Dashboard firmă
```

---

## 14. Salarii bimensual

Perioade:

```text
1-15
16-31
```

Pentru fiecare angajat:

```text
Salariu zi
Zile lucrate
Zile extra
Concedii
Absențe
Diurnă
Suplimentar
Total perioadă
```

---

## 15. Cheltuieli și profit

Cheltuieli:

```text
Salarii
Materiale
Combustibil
Scule
Utilaje
Transport
Chirii
Contabilitate
Taxe
Subcontractori
Altele
```

Profit proiect:

```text
Valoare ofertă
Valoare situații
Facturat
Încasat
Cost salarii
Cost materiale
Cost transport
Cost subcontractori
Alte cheltuieli
Profit estimat
Profit real
Profit %
```

---

## 16. SmartBill

AquaFirm trebuie să se sincronizeze cu SmartBill pentru:

```text
Clienți
Facturi
Proforme
Încasări
Status document
SPV / e-Factura, dacă este disponibil prin API
```

Flux:

```text
Situație aprobată → factură SmartBill → status factură → încasare → actualizare proiect
```

---

## 17. Dashboard fiscal

Estimări utile:

```text
TVA colectat
TVA deductibil
TVA estimat de plată
Facturi neîncasate
Salarii lunare
Cheltuieli lunare
Profit estimat
Impozit estimat
Scadențe
Documente lipsă
```

---

## 18. AI Assistant

AI-ul trebuie să lucreze pe datele aplicației.

Întrebări utile:

```text
Cât mai am de încasat pe contractul 2026/007?
Ce proiect are profitul cel mai slab?
Creează-mi o situație de lucrări cu 50% din cantități.
Importă lista asta și potrivește produsele.
Ce produse nu au fost potrivite automat?
Cât am salarii pe Bolintin-Green în martie?
Ce TVA estimat am luna asta?
Ce garanții expiră în următoarele 30 zile?
```

---

## 19. Ordinea de implementare

### Etapa 1

```text
Beneficiari
Catalog manoperă
Oferte manuale
PDF ofertă
Memorie online Supabase
```

### Etapa 2

```text
Import Excel
Potrivire catalog
Aliasuri
Ciornă editabilă
Export Excel + PDF
```

### Etapa 3

```text
Proiecte
Situații lucrări
Decontări
Garanții
Notificări garanții
```

### Etapa 4

```text
Preluare pontaj din aplicația existentă
Salarii bimensual
Cheltuieli
Profit proiect
```

### Etapa 5

```text
SmartBill
Fiscal
AI Assistant
```

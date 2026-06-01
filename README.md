# Ofertare lucrări instalații 💧

Aplicație web instalabilă (PWA) pentru generarea ofertelor de preț pentru lucrări
de instalații (sanitare, termice, pluviale, hidranți, PSI) — **manoperă**.

Aplicația e în folderul [`docs/`](docs/) și rulează direct în browser (telefon sau laptop).

## Ce face
- **Catalog propriu** de articole cu prețuri de manoperă (207 articole extrase din listele UTCB 2026), editabil.
- **Constructor de ofertă**: alegi articole din catalog, pui cantități → calculează automat valori, subtotaluri pe categorie, TVA 21% (la încasare) și total.
- **Import listă de cantități** (Excel) primită de la beneficiar: aplicația potrivește automat articolele cu catalogul tău și completează prețurile tale (învață denumirile diferite — ex. „brățară 1/2" = „brățară 20").
- **Export PDF** (din butonul de printare al browserului → „Salvează ca PDF"):
  - **Oferta de prețuri** — formatul tău SCV, cu fiecare categorie pe un rând, antet firmă, condiții de plată, garanție, normative, „Oferta nu include", semnături.
  - **Lista de cantități** detaliată — toate articolele pe categorii, cu prețuri.
- **Funcționează offline** (după prima deschidere) și se poate **instala** pe ecranul telefonului / desktopului.
- **Backup** date (catalog + oferte + setări) într-un fișier.

## Cum se publică (GitHub Pages)
Setări → Pages → Source: branch de lucru, folder `/docs`. URL: `https://<user>.github.io/ofertare/`.

## Stadiu
Versiunea 1 — datele se salvează **pe dispozitiv** (în browser). Sincronizarea cont online
între telefon și laptop este pasul următor.

## Materiale de referință
- `exemple/` — oferte și liste reale (provenance).
- `modele/` — șabloanele de ofertă SCV și listele de prețuri sursă.

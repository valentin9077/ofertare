/* Lucru fără semnal: paginile vin întâi din rețea (mereu versiunea nouă), iar fără internet din ce s-a păstrat pe aparat.
   Bibliotecile mari și fonturile vin din păstrare. Cererile către baza de date nu trec pe aici.
   Toate adresele sunt relative la folderul aplicației. */
const V = "scv-v2";
const HERE = new URL("./", self.location).href;
const SHELL = ["./", "prezenta/", "ofertare/", "lib/scv.js", "lib/fonts.css", "lib/vendor/supabase.js", "ofertare/core.js", "ofertare/export.js", "ofertare/piata.json", "manifest.webmanifest", "icon-192.png"].map(p => new URL(p, HERE).href);
const own = () => caches.open(V);
self.addEventListener("install", e => { e.waitUntil(own().then(c => c.addAll(SHELL)).catch(() => { }).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf("scv-") === 0 && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.url.indexOf(HERE) !== 0) return;
  const rel = req.url.slice(HERE.length);
  const keep = res => { if (res.ok) { const copy = res.clone(); own().then(c => c.put(req, copy)); } return res; };
  if (rel.indexOf("lib/vendor/") === 0 || rel.indexOf("fonts/") === 0) {
    e.respondWith(own().then(c => c.match(req)).then(hit => hit || fetch(req).then(keep)));
    return;
  }
  e.respondWith(fetch(req).then(keep).catch(() => own().then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? c.match(HERE) : Response.error())))));
});

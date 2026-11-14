/* Lucru fără semnal: paginile vin întâi din rețea (mereu versiunea nouă), iar fără internet din ce s-a păstrat pe aparat.
   Bibliotecile mari și fonturile vin din păstrare. Cererile către baza de date nu trec pe aici.
   Toate adresele sunt relative la folderul aplicației. */
const V = "scv-v8";
const HERE = new URL("./", self.location).href;
const SHELL = ["prezenta/", "ofertare/", "lib/scv.js", "lib/alarm.js", "lib/ui.css", "lib/icons.js", "lib/fonts.css", "lib/vendor/supabase.js", "ofertare/core.js", "ofertare/export.js", "ofertare/piata.json", "ofertare/app.js", "ofertare/app.css", "ofertare/icons2.js", "ofertare/imp.js", "ofertare/wb.js",
  "lib/vendor/jszip.min.js", "lib/vendor/exceljs.min.js", "lib/vendor/xlsx.full.min.js", "lib/vendor/pdf.min.js", "lib/vendor/pdf.worker.min.js",
  "prezenta/manifest.webmanifest", "prezenta/icon-192.png", "prezenta/apple-touch-icon.png", "ofertare/manifest.webmanifest", "ofertare/icon-192.png", "ofertare/apple-touch-icon.png"].map(p => new URL(p, HERE).href);
const own = () => caches.open(V);
/* fiecare fișier se păstrează separat: dacă unul nu vine (semnal slab), celelalte rămân */
self.addEventListener("install", e => { e.waitUntil(own().then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => { })))).catch(() => { }).then(() => self.skipWaiting())); });
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
  e.respondWith(fetch(req).then(keep).catch(() => own().then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || Response.error()))));
});

/* Alarme pentru prezență. Mesajul vine de la baza de date (prin funcția „remind”), în forma
   {web_push: 8030, notification: {title, body, navigate, tag}}. Telefoanele noi îl arată singure;
   pe celelalte îl arătăm aici. La apăsare se deschide Prezența. */
const PREZ = new URL("prezenta/", HERE).href;
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { try { d = { notification: { body: e.data.text() } }; } catch (y) { d = {}; } }
  const n = (d && d.notification) || d || {};
  const url = typeof n.navigate === "string" && n.navigate.indexOf(HERE) === 0 ? n.navigate : PREZ;
  e.waitUntil(self.registration.showNotification(n.title || "Prezență SCV", {
    body: n.body || "Nu ai dat prezența azi.", tag: n.tag || "prezenta-azi", renotify: true, lang: "ro",
    icon: new URL("prezenta/icon-192.png", HERE).href, badge: new URL("prezenta/icon-192.png", HERE).href, data: { url }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || PREZ;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if (c.url.indexOf(PREZ) === 0 && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});

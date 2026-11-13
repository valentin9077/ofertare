/* Alarme pentru prezență: abonează acest aparat la notificări (Web Push).
   Baza de date verifică din oră în oră dacă azi mai sunt oameni nemarcați și, dacă da, trimite o notificare
   pe aparatele abonate. Aici e doar partea de pe aparat: permisiunea, abonarea, proba. */
(function () {
  "use strict";
  const sb = SCV.sb;
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => !!(navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches));
  const u8 = s => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };
  const b64 = buf => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const wait = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  const err = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  const label = () => (ios ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "aparat") + (standalone() ? " (aplicație)" : " (browser)");

  function support() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return "no";
    if (!("PushManager" in window) || !("Notification" in window)) return ios ? (standalone() ? "ios-old" : "ios-install") : "no";
    return "ok";
  }
  async function getReg() { try { return (await wait(navigator.serviceWorker.getRegistration(SCV.base), 3000)) || null; } catch (e) { return null; } }
  async function readyReg() { try { return (await wait(navigator.serviceWorker.ready, 8000)) || null; } catch (e) { return null; } }
  async function current() { const r = await getReg(); if (!r || !r.pushManager) return null; try { return await r.pushManager.getSubscription(); } catch (e) { return null; } }

  /** Starea pe acest aparat: "ios-install" | "ios-old" | "no" | "nosw" | "denied" | "off" | "on" */
  async function state() {
    const s = support(); if (s !== "ok") return { s };
    if (Notification.permission === "denied") return { s: "denied" };
    const r = await getReg(); if (!r) return { s: "nosw" };
    let sub = null; try { sub = await r.pushManager.getSubscription(); } catch (e) { }
    return { s: sub && Notification.permission === "granted" ? "on" : "off" };
  }
  async function rpc(name, args) { const { data, error } = await sb.rpc(name, args || {}); if (error) throw error; return data; }
  const info = () => rpc("push_info");
  async function save(sub) {
    const j = sub.toJSON ? sub.toJSON() : {}; const k = j.keys || {};
    const row = { endpoint: sub.endpoint, p256dh: k.p256dh || b64(sub.getKey("p256dh")), auth: k.auth || b64(sub.getKey("auth")), ua: label().slice(0, 80), seen_at: new Date().toISOString() };
    const { error } = await sb.from("push_subs").upsert(row, { onConflict: "endpoint" });
    if (error) throw error;
    SCV.LS.set("scv_push_seen", Date.now());
  }
  const sameKey = (sub, key) => { try { const k = sub.options && sub.options.applicationServerKey; return !k || b64(k) === key; } catch (e) { return true; } };

  /** Pornește alarmele pe acest aparat. Trebuie chemat direct dintr-o apăsare de buton (așa cere iPhone-ul). */
  async function enable() {
    if (support() !== "ok") throw err(support());
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw err(perm === "denied" ? "denied" : "dismissed");
    const i = await info();
    if (!i || !i.key) throw err("not_ready");
    const reg = await readyReg(); if (!reg) throw err("nosw");
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, i.key)) { try { await sub.unsubscribe(); } catch (e) { } sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(i.key) });
    await save(sub);
    return true;
  }
  /** Oprește alarmele pe acest aparat. */
  async function disable() {
    const sub = await current(); if (!sub) return;
    const ep = sub.endpoint;
    try { await sub.unsubscribe(); } catch (e) { }
    try { await sb.from("push_subs").delete().eq("endpoint", ep); } catch (e) { }
  }
  /** La pornirea aplicației: dacă aparatul e abonat, reîmprospătează abonarea o dată pe zi (cheile se pot schimba). */
  async function sync() {
    try {
      if (support() !== "ok" || Notification.permission !== "granted" || !navigator.onLine) return;
      if (Date.now() - (+SCV.LS.get("scv_push_seen") || 0) < 20 * 3600 * 1000) return;
      const reg = await getReg(); if (!reg) return;
      let sub = await reg.pushManager.getSubscription(); if (!sub) return;
      const i = await info();
      if (i && i.key && !sameKey(sub, i.key)) { try { await sub.unsubscribe(); } catch (e) { } sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(i.key) }); }
      await save(sub);
    } catch (e) { }
  }
  /** Trimite o alarmă de probă și așteaptă răspunsul serviciului de notificări. onStep primește "sent". */
  async function test(onStep) {
    const r = await rpc("push_test");
    if (!r || !r.ok) throw err((r && r.why) || "fail");
    if (onStep) onStep("sent");
    for (let k = 0; k < 9; k++) {
      await new Promise(x => setTimeout(x, k < 2 ? 1500 : 2500));
      let res = null; try { res = await rpc("push_result", { p_id: r.id }); } catch (e) { }
      if (res) {
        const list = res.results || [], ok = list.filter(x => x.status >= 200 && x.status < 300).length;
        return { done: true, ok, n: list.length, http: res.http, bad: list.filter(x => !(x.status >= 200 && x.status < 300)).map(x => x.status + (x.error ? " " + x.error : "")) };
      }
    }
    return { done: false };
  }
  /** Șterge de pe ecran alarmele rămase (după ce prezența a fost dată). Nu toate telefoanele permit asta. */
  async function clear() { try { const r = await getReg(); if (!r || !r.getNotifications) return; (await r.getNotifications({ tag: "prezenta-azi" })).forEach(n => n.close()); } catch (e) { } }

  window.SCVA = { support, state, info, enable, disable, sync, test, clear, ios, standalone };
})();

/* SCV – bibliotecă comună pentru aplicațiile firmei: cont, date sincronizate, fișiere.
   Datele stau în baza de date proprie (Supabase). Fiecare rând aparține contului proprietar. */
(function () {
  "use strict";
  const CFG = {
    url: "https://vympzujixmklqfyuxywm.supabase.co",
    key: "sb_publishable_duFb1e0RqQSLklkzs-nR3Q_4JhemyGt"
  };
  /* Adresa de bază a aplicației (folderul în care stă), ca să meargă la fel la rădăcină sau într-un subfolder. */
  const BASE = new URL("..", document.currentScript.src).href;
  const sb = window.supabase.createClient(CFG.url, CFG.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "scv-auth" }
  });

  const LS = {
    get(k) { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
    keys() { try { return Object.keys(localStorage); } catch (e) { return []; } }
  };
  /* Fără rețea: cererea nu a primit niciun răspuns. (Un răspuns 5xx de la server nu e „fără rețea”.) */
  const isNet = e => !!e && !(e.status >= 400) && (e.name === "AuthRetryableFetchError" || e.status === 0 ||
    /failed to fetch|networkerror|load failed|network request failed|timeout|fetch/i.test(String(e.message || e)));
  const isRetryable = e => !!e && (e.name === "AuthRetryableFetchError" || isNet(e));

  let me = null;
  /* Fiecare citire are o adresă unică, ca nimic de pe drum (nici o aplicație mai veche de pe aceeași adresă) să nu poată întoarce date vechi. */
  const fresh = q => q.neq("path", "~" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

  /** Contul curent: {id, email, offline} sau null dacă nu e nimeni intrat. */
  async function user() {
    let r;
    try { r = await sb.auth.getSession(); } catch (e) { r = { data: { session: null }, error: e }; }
    const s = r && r.data && r.data.session;
    if (s && s.user) {
      me = { id: s.user.id, email: s.user.email, offline: false };
      LS.set("scv-me", { id: me.id, email: me.email });
      return me;
    }
    const c = LS.get("scv-me");
    if (c && c.id && (isRetryable(r && r.error) || navigator.onLine === false)) {
      me = { id: c.id, email: c.email, offline: true };
      return me;
    }
    me = null;
    return null;
  }

  async function requireUser(next) {
    const u = await user();
    if (!u) { location.replace(BASE + (next ? "?next=" + encodeURIComponent(next) : "")); return null; }
    return u;
  }

  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }

  /** Creează contul proprietarului. Serverul acceptă un singur cont și îl confirmă singur, deci după creare intrăm direct. */
  async function signUp(email, password) {
    let err = null;
    try {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) err = error; else if (data && data.session) return data.session;
    } catch (e) { err = e; }
    try { return await signIn(email, password); } catch (e2) { throw err || e2; }
  }

  async function signOut() {
    try { await sb.auth.signOut(); } catch (e) { }
    LS.keys().forEach(k => { if (k.indexOf("scv-cache-") === 0 || k === "scv-me") LS.del(k); });
    me = null;
  }

  async function changePassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
  }

  /** Starea bazei de date: {ready:false} dacă nu e pregătită încă; altfel {ready:true, owner:true|false}. */
  async function dbState() {
    try {
      const { data, error } = await sb.rpc("scv_state");
      if (error) return { ready: false, error, net: isNet(error) };
      return { ready: true, owner: !!data };
    } catch (e) { return { ready: false, error: e, net: isNet(e) }; }
  }

  /** Preia datele de pornire pregătite pentru proprietar (o singură dată). */
  async function claimSeed() {
    try { const { data, error } = await sb.rpc("claim_seed"); return error ? 0 : (data || 0); } catch (e) { return 0; }
  }

  /** Mesaj pe românește pentru erorile de cont. */
  function authMessage(e) {
    const m = String((e && (e.message || e.msg)) || e || "");
    if (/invalid login credentials/i.test(m)) return "Email sau parolă greșită.";
    if (/database error saving new user|deja un proprietar/i.test(m)) return "Aplicația are deja un proprietar. Nu se pot crea alte conturi. Intră cu emailul și parola ta.";
    if (/already registered|already been registered/i.test(m)) return "Contul există deja. Intră cu emailul și parola ta.";
    if (/email not confirmed/i.test(m)) return "Contul nu e confirmat încă. Deschide emailul primit și apasă pe link, apoi intră din nou.";
    if (/password should be at least|weak password/i.test(m)) return "Parola e prea scurtă sau prea simplă. Folosește cel puțin 8 caractere.";
    if (/rate limit|too many/i.test(m)) return "Prea multe încercări. Așteaptă un minut și încearcă din nou.";
    if (/invalid.*email|email address.*invalid/i.test(m)) return "Adresa de email nu pare corectă.";
    if (/different from the old/i.test(m)) return "Parola nouă trebuie să fie diferită de cea veche.";
    if (isNet(e) || navigator.onLine === false) return "Nu am internet. Verifică semnalul și încearcă din nou.";
    if (e && e.status >= 500) return "Serverul nu răspunde acum. Încearcă din nou peste un minut.";
    return "Nu a mers: " + (m || "eroare necunoscută");
  }

  /**
   * Depozit de documente pentru o aplicație ("prezenta" sau "oferta").
   * opt: { onRemote(path,data), onStatus(text,warn), cache:true|false, delay:ms, poll:ms, warnUnload:bool, onAuthLost() }
   */
  function store(app, opt) {
    opt = opt || {};
    const uid = me.id, ckey = "scv-cache-" + app + "-" + uid, useCache = opt.cache !== false;
    const dirty = new Map();
    let cache = (useCache && LS.get(ckey)) || { docs: {}, ts: {}, pend: [] };
    cache.docs = cache.docs || {}; cache.ts = cache.ts || {}; cache.pend = cache.pend || [];
    let lastTs = "";
    const bump = t => { if (t && (!lastTs || Date.parse(t) > Date.parse(lastTs))) lastTs = t; };
    let flushing = false, timer = null, retry = null, started = false, online = true;
    const status = (t, w) => { if (opt.onStatus) opt.onStatus(t, !!w); };
    const saveCache = () => {
      if (!useCache) return;
      cache.pend = [...dirty.keys()];
      if (!LS.set(ckey, cache)) LS.set(ckey, { docs: {}, ts: cache.ts, pend: [] });
    };
    const fromCachePending = docs => {
      (cache.pend || []).forEach(p => {
        if (cache.docs && p in cache.docs) { const snap = cache.docs[p]; if (docs) docs[p] = snap; dirty.set(p, { get: () => snap }); }
      });
    };

    async function load() {
      let rows = null, err = null;
      if (!me.offline) {
        try {
          const r = await fresh(sb.from("docs").select("path,data,updated_at").eq("app", app));
          if (r.error) err = r.error; else rows = r.data;
        } catch (e) { err = e; }
      }
      if (rows) {
        const docs = {}, ts = {};
        rows.forEach(r => { docs[r.path] = r.data; ts[r.path] = r.updated_at; bump(r.updated_at); });
        fromCachePending(docs);
        cache.docs = useCache ? JSON.parse(JSON.stringify(docs)) : {}; cache.ts = ts; saveCache();
        online = true;
        if (dirty.size) kick(0);
        return { docs, offline: false };
      }
      if (useCache && cache.docs && Object.keys(cache.docs).length && (me.offline || isNet(err) || navigator.onLine === false)) {
        fromCachePending(null);
        Object.values(cache.ts).forEach(bump);
        online = false;
        return { docs: JSON.parse(JSON.stringify(cache.docs)), offline: true, error: err };
      }
      throw err || new Error("Fără internet și fără date păstrate pe acest aparat.");
    }

    function kick(ms) { clearTimeout(timer); timer = setTimeout(flush, ms); }

    function put(path, getter, delay) {
      dirty.set(path, { get: getter });
      if (useCache) { try { cache.docs[path] = JSON.parse(JSON.stringify(getter())); } catch (e) { } saveCache(); }
      status("se salvează…");
      kick(delay == null ? (opt.delay == null ? 250 : opt.delay) : delay);
    }

    async function flush() {
      if (flushing) return;
      clearTimeout(timer); clearTimeout(retry);
      flushing = true;
      let fail = null;
      try {
        for (const [path, ent] of [...dirty]) {
          let data;
          try { data = ent.get(); } catch (e) { dirty.delete(path); continue; }
          const r = await sb.from("docs").upsert({ owner: uid, app, path, data }, { onConflict: "owner,app,path" }).select("updated_at").single();
          if (r.error) { fail = r.error; break; }
          cache.ts[path] = r.data.updated_at; bump(r.data.updated_at);
          if (dirty.get(path) === ent) dirty.delete(path);
        }
      } catch (e) { fail = e; }
      flushing = false;
      saveCache();
      if (fail) {
        online = false;
        const net = isNet(fail) || navigator.onLine === false;
        status(net ? "fără internet – se salvează când revine" : "NESALVAT – reîncerc", true);
        retry = setTimeout(flush, 5000);
        if (!net && (fail.code === "PGRST301" || fail.code === "PGRST303" || fail.status === 401) && opt.onAuthLost) opt.onAuthLost();
      } else {
        online = true;
        if (dirty.size) kick(50); else status("salvat ✓");
      }
    }

    async function poll() {
      if (me.offline) { const u = await user(); if (!u || u.offline) return; }
      try {
        const since = lastTs ? new Date(Date.parse(lastTs) - 5000).toISOString() : "1970-01-01T00:00:00Z";
        const r = await fresh(sb.from("docs").select("path,data,updated_at").eq("app", app).gt("updated_at", since));
        if (r.error) return;
        online = true;
        let changed = false;
        r.data.forEach(row => {
          if (cache.ts[row.path] === row.updated_at) return;
          cache.ts[row.path] = row.updated_at; bump(row.updated_at);
          if (dirty.has(row.path)) return;
          if (useCache) cache.docs[row.path] = row.data;
          changed = true;
          if (opt.onRemote) opt.onRemote(row.path, row.data);
        });
        if (changed) saveCache();
        if (dirty.size && !flushing) kick(0);
      } catch (e) { }
    }

    async function remove(path) {
      dirty.delete(path); delete cache.docs[path]; delete cache.ts[path]; saveCache();
      const r = await sb.from("docs").delete().eq("app", app).eq("path", path);
      if (r.error) throw r.error;
    }

    function start() {
      if (started) return; started = true;
      setInterval(() => { if (document.visibilityState === "visible") poll(); }, opt.poll || 20000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") poll(); else if (dirty.size) flush(); });
      window.addEventListener("online", () => { flush(); poll(); });
      window.addEventListener("pagehide", () => { if (dirty.size) flush(); });
      if (opt.warnUnload) window.addEventListener("beforeunload", e => { if (dirty.size) { e.preventDefault(); e.returnValue = ""; } });
    }

    return { load, put, remove, poll, start, flush, pending: () => dirty.size, isOnline: () => online };
  }

  /** Dă un fișier utilizatorului: pe telefon deschide „Partajează” (WhatsApp, Mail, Fișiere), pe laptop îl descarcă. */
  async function saveFile(name, data, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || "application/octet-stream" });
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (mobile && navigator.canShare) {
      try {
        const file = new File([blob], name, { type: blob.type });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return "shared"; }
      } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    return "downloaded";
  }

  const scripts = {};
  function loadScript(src) {
    if (scripts[src]) return scripts[src];
    scripts[src] = new Promise((ok, no) => {
      const s = document.createElement("script"); s.src = src; s.onload = () => ok();
      s.onerror = () => { delete scripts[src]; no(new Error("Nu am putut încărca " + src)); };
      document.head.appendChild(s);
    });
    return scripts[src];
  }
  const needXl = () => window.ExcelJS ? Promise.resolve() :
    loadScript(BASE + "lib/vendor/exceljs.min.js").catch(() => { throw new Error("Nu am putut încărca modulul Excel. Verifică internetul și încearcă din nou."); });

  /* Lucrul fără semnal. Se înregistrează imediat, ca paginile de aici să fie ținute de această aplicație, nu de alta mai veche de pe aceeași adresă. */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register(BASE + "sw.js", { scope: new URL(BASE).pathname }).catch(() => { });
  }

  window.SCV = { base: BASE, sb, user, requireUser, signIn, signUp, signOut, changePassword, dbState, claimSeed, authMessage, store, saveFile, loadScript, needXl, LS, isNet };
})();

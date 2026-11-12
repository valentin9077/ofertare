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


  /* ---------- Intrarea în cont: fiecare aplicație are propriul ecran de intrare (nu există pagină comună) ---------- */
  const UI_CSS = `
.scv-gate{position:fixed;inset:0;z-index:1000;overflow:auto;background:var(--bg,#F1F3F4);color:var(--ink,#16212B);font:17px/1.4 var(--f-body,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif)}
.scv-gate *,.scv-acct *{box-sizing:border-box}
.scv-gate .g-in{width:100%;max-width:440px;margin:0 auto;padding:28px 18px 40px}
.g-plate{display:flex;gap:14px;align-items:center;margin:14px 0 26px}
.g-plate i{width:14px;height:54px;background:var(--acc,#0B6B86);border-radius:1px;flex:none}
.g-plate b{display:block;font-family:var(--f-head,inherit);font-size:40px;line-height:.95;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
.g-plate span{display:block;color:var(--mut,#5B6872);font-size:15px;margin-top:5px}
.g-card{background:var(--surface,#fff);border:1px solid var(--line,#DADFE3);border-radius:6px;padding:16px;margin:0 0 14px}
.g-card h2{font-family:var(--f-head,inherit);font-size:24px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.03em}
.g-card p{margin:0 0 12px}
.g-mut{color:var(--mut,#5B6872);font-size:14px}
.g-card label{display:block;font-size:12px;font-weight:600;color:var(--mut,#5B6872);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 4px}
.g-card input{display:block;width:100%;padding:12px;border:1px solid var(--line,#DADFE3);border-radius:5px;background:var(--surface,#fff);color:inherit;font:inherit;font-size:17px}
.g-card input:focus{outline:none;border-color:var(--acc,#0B6B86)}
.g-btn{display:block;width:100%;padding:13px 16px;border-radius:5px;background:var(--acc,#0B6B86);color:var(--acc-ink,#fff);border:1px solid var(--acc,#0B6B86);font:inherit;font-weight:600;cursor:pointer;text-align:center;margin-top:14px}
.g-btn.g-g{background:var(--surface,#fff);color:var(--ink,#16212B);border-color:var(--line,#DADFE3)}
.g-btn[disabled]{opacity:.55;cursor:default}
.g-link{background:none;border:none;color:var(--acc,#0B6B86);font:inherit;font-weight:600;cursor:pointer;padding:8px 0;text-decoration:underline;text-underline-offset:3px}
.g-err{background:var(--neg-bg,#FBE8E6);color:var(--neg,#B3261E);padding:10px 12px;border-radius:5px;font-weight:600;font-size:15px;margin-top:12px}
.g-ok{background:var(--pos-bg,#E3F3E8);color:var(--pos,#1B6B3A);padding:10px 12px;border-radius:5px;font-weight:600;font-size:15px;margin-top:12px}
.g-note{background:var(--warn-bg,#FFF3D0);color:var(--warn,#8A5A00);padding:10px 12px;border-radius:5px;font-size:15px;margin-bottom:14px}
.scv-gate [hidden],.scv-acct [hidden]{display:none!important}
.scv-acct{position:fixed;inset:0;z-index:1001;background:rgba(10,16,22,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 14px;color:var(--ink,#16212B);font:17px/1.4 var(--f-body,system-ui,sans-serif)}
.scv-acct .g-card{width:100%;max-width:420px;margin:0}
.a-row{display:flex;gap:10px}.a-row .g-btn{flex:1}
.scv-acctbtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;margin-right:-6px;border:1px solid var(--line,#DADFE3);border-radius:50%;background:var(--surface,#fff);color:var(--mut,#5B6872);cursor:pointer;padding:0}
.scv-acctbtn:hover{color:var(--acc,#0B6B86);border-color:var(--acc,#0B6B86)}
.scv-acctbtn svg{width:20px;height:20px;display:block}`;
  let cssDone = false;
  function uiCss() { if (cssDone) return; cssDone = true; const s = document.createElement("style"); s.textContent = UI_CSS; document.head.appendChild(s); }
  const escH = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /**
   * Deschide aplicația doar pentru proprietar. Dacă nu e nimeni intrat, arată ecranul de intrare al ACESTEI aplicații
   * și așteaptă. Întoarce contul: {id, email, offline}.  opt: { name:"Prezență SCV", sub:"…" }
   */
  function gate(opt) {
    opt = opt || {};
    return new Promise(async resolve => {
      const u0 = await user();
      if (u0) return resolve(u0);
      uiCss();
      const g = document.createElement("div"); g.className = "scv-gate"; g.id = "scvGate";
      g.innerHTML = `<div class="g-in">
<div class="g-plate"><i></i><div><b>${escH(opt.name || "SCV")}</b><span>${escH(opt.sub || "acces doar pentru proprietar")}</span></div></div>
<div id="gLoad" class="g-card"><p class="g-mut" style="margin:0">Se verifică…</p></div>
<div id="gPrep" hidden><div class="g-note"><b>Aplicația e aproape gata.</b> Baza de date nu e pregătită încă. Încearcă din nou peste puțin.</div><button class="g-btn g-g" type="button" data-g="retry">Verifică din nou</button></div>
<div id="gOff" hidden><div class="g-note">Nu am internet acum. Verifică semnalul și încearcă din nou.</div><button class="g-btn g-g" type="button" data-g="retry">Încearcă din nou</button></div>
<form id="gIn" class="g-card" hidden autocomplete="on">
<h2 id="gTitle">Intră în cont</h2><p class="g-mut" id="gSub">Cu emailul și parola ta.</p>
<label for="gEmail">Email</label><input id="gEmail" type="email" name="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required>
<label for="gPass">Parolă</label><input id="gPass" type="password" name="password" autocomplete="current-password" required minlength="8">
<div id="gWrap2" hidden><label for="gPass2">Repetă parola</label><input id="gPass2" type="password" name="password2" autocomplete="new-password" minlength="8"></div>
<div id="gErr" class="g-err" hidden></div>
<button class="g-btn" id="gGo" type="submit">Intră</button>
<p style="margin:12px 0 0;text-align:center"><button class="g-link" type="button" id="gSwitch" hidden></button></p>
</form></div>`;
      document.body.appendChild(g);
      const q = s => g.querySelector(s);
      const show = id => ["gLoad", "gPrep", "gOff", "gIn"].forEach(v => { q("#" + v).hidden = v !== id; });
      let mode = "in";
      function setMode(m, hasOwner) {
        mode = m;
        q("#gTitle").textContent = m === "up" ? "Creează contul tău" : "Intră în cont";
        q("#gSub").textContent = m === "up" ? "Se poate crea un singur cont: al tău. După aceea, nimeni altcineva nu mai poate face cont aici." : "Cu emailul și parola ta.";
        q("#gWrap2").hidden = m !== "up"; q("#gPass2").required = m === "up";
        q("#gPass").autocomplete = m === "up" ? "new-password" : "current-password";
        q("#gGo").textContent = m === "up" ? "Creează contul" : "Intră";
        const sw = q("#gSwitch"); sw.hidden = !!hasOwner; sw.textContent = m === "up" ? "Am deja cont – vreau să intru" : "Prima deschidere? Creează contul";
        q("#gErr").hidden = true;
      }
      const done = u => { g.remove(); resolve(u); };
      async function boot() {
        show("gLoad");
        const u = await user();
        if (u) return done(u);
        const s = await dbState();
        if (!s.ready) { show(s.net || navigator.onLine === false ? "gOff" : "gPrep"); return; }
        setMode(s.owner ? "in" : "up", s.owner); show("gIn");
      }
      g.addEventListener("click", e => { if (e.target.closest('[data-g="retry"]')) boot(); });
      q("#gSwitch").onclick = () => setMode(mode === "up" ? "in" : "up", false);
      q("#gIn").onsubmit = async e => {
        e.preventDefault();
        const email = q("#gEmail").value.trim(), p = q("#gPass").value, er = q("#gErr"), b = q("#gGo"); er.hidden = true;
        const bad = t => { er.textContent = t; er.hidden = false; };
        if (mode === "up") {
          if (p.length < 8) return bad("Parola trebuie să aibă cel puțin 8 caractere.");
          if (p !== q("#gPass2").value) return bad("Cele două parole nu sunt la fel.");
        }
        b.disabled = true; const old = b.textContent; b.textContent = "Un moment…";
        try {
          if (mode === "up") await signUp(email, p); else await signIn(email, p);
          const u = await user(); if (!u) throw new Error("Nu am putut deschide sesiunea.");
          q("#gPass").value = ""; q("#gPass2").value = "";
          await claimSeed();
          done(u);
        } catch (x) { bad(authMessage(x)); }
        finally { b.disabled = false; b.textContent = old; }
      };
      boot();
    });
  }

  /** Fereastra „Cont”: cine e intrat, schimbarea parolei, ieșirea din cont.  opt: { pending:()=>număr de modificări nesalvate } */
  function account(opt) {
    opt = opt || {};
    uiCss();
    const old = document.getElementById("scvAcct"); if (old) old.remove();
    const d = document.createElement("div"); d.className = "scv-acct"; d.id = "scvAcct";
    d.innerHTML = `<div class="g-card" role="dialog" aria-modal="true" aria-label="Cont">
<h2>Cont</h2><p class="g-mut">Ești intrat cu <b id="aWho"></b>. Datele sunt aceleași pe telefon și pe laptop.</p>
<form id="aForm"><label for="aNp1">Parolă nouă (cel puțin 8 caractere)</label><input id="aNp1" type="password" autocomplete="new-password" minlength="8" required>
<label for="aNp2">Repetă parola nouă</label><input id="aNp2" type="password" autocomplete="new-password" minlength="8" required>
<div id="aErr" class="g-err" hidden></div><div id="aOk" class="g-ok" hidden>Parola a fost schimbată.</div>
<button class="g-btn g-g" type="submit">Schimbă parola</button></form>
<div class="a-row"><button class="g-btn g-g" type="button" id="aOut">Ieși din cont</button><button class="g-btn" type="button" id="aClose">Închide</button></div></div>`;
    document.body.appendChild(d);
    const q = s => d.querySelector(s), er = q("#aErr"), okb = q("#aOk");
    q("#aWho").textContent = (me && me.email) || "";
    const close = () => { d.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    d.addEventListener("click", e => { if (e.target === d) close(); });
    q("#aClose").onclick = close;
    q("#aForm").onsubmit = async e => {
      e.preventDefault(); er.hidden = true; okb.hidden = true;
      const a = q("#aNp1").value, b = q("#aNp2").value;
      if (a.length < 8) { er.textContent = "Parola trebuie să aibă cel puțin 8 caractere."; er.hidden = false; return; }
      if (a !== b) { er.textContent = "Cele două parole nu sunt la fel."; er.hidden = false; return; }
      try { await changePassword(a); q("#aNp1").value = ""; q("#aNp2").value = ""; okb.hidden = false; }
      catch (x) { er.textContent = authMessage(x); er.hidden = false; }
    };
    q("#aOut").onclick = async () => {
      if (opt.pending && opt.pending()) { er.textContent = "Mai sunt date nesalvate. Așteaptă „salvat ✓” și încearcă din nou."; er.hidden = false; return; }
      await signOut(); location.reload();
    };
  }

  /** Butonul rotund „Cont” din antetul aplicației. */
  function accountButton(opt) {
    uiCss();
    const b = document.createElement("button"); b.type = "button"; b.className = "scv-acctbtn"; b.id = "acct"; b.setAttribute("aria-label", "Cont");
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
    b.onclick = () => account(opt);
    return b;
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

  window.SCV = { base: BASE, sb, user, gate, account, accountButton, signIn, signUp, signOut, changePassword, dbState, claimSeed, authMessage, store, saveFile, loadScript, needXl, LS, isNet };
})();

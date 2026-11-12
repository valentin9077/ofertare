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

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const sessionBack = new Set();   // anunțați când intrarea în cont a fost reconfirmată după o pornire fără semnal

  /**
   * Contul curent: {id, email, offline} sau null dacă nu e nimeni intrat.
   * Dacă verificarea durează (semnal slab) și omul a mai fost intrat pe acest aparat, pornim imediat cu datele păstrate aici
   * (offline: true); verificarea continuă în fundal.
   */
  async function user(wait) {
    const c = LS.get("scv-me");
    const p = sb.auth.getSession().then(r => r, e => ({ data: { session: null }, error: e }));
    const known = c && c.id;
    let r = known ? await Promise.race([p, sleep(wait == null ? (navigator.onLine === false ? 300 : 2500) : wait).then(() => null)]) : await p;
    if (r === null) {
      const off = me = { id: c.id, email: c.email, offline: true };
      p.then(x => {
        const s = x && x.data && x.data.session;
        if (s && s.user && me === off) { me = { id: s.user.id, email: s.user.email, offline: false }; sessionBack.forEach(f => { try { f(); } catch (e) { } }); }
      });
      return me;
    }
    const s = r && r.data && r.data.session;
    if (s && s.user) {
      me = { id: s.user.id, email: s.user.email, offline: false };
      LS.set("scv-me", { id: me.id, email: me.email });
      return me;
    }
    if (known && (isRetryable(r && r.error) || navigator.onLine === false)) {
      me = { id: c.id, email: c.email, offline: true };
      return me;
    }
    if (known) LS.del("scv-me");   // sesiunea nu mai există (ieșire din cont sau parolă schimbată de pe alt aparat)
    me = null;
    return null;
  }

  /** Semnalul a revenit: cerem imediat reînnoirea intrării, fără minutul de pauză pe care biblioteca îl ține după o încercare eșuată. */
  async function revive() {
    try { if (navigator.onLine !== false && sb.auth && sb.auth.lastRefreshFailure) sb.auth.lastRefreshFailure = null; } catch (e) { }
    return user();
  }

  /* ---------- Împăcarea a trei versiuni ale aceluiași document (ce era pe server când am pornit, ce am schimbat aici, ce e acum pe server).
     Regula: ce s-a schimbat doar într-un loc se păstrează; dacă același lucru s-a schimbat în ambele locuri, rămâne ce s-a făcut pe acest aparat. */
  const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
  const keyed = a => Array.isArray(a) && a.length > 0 && a.every(x => isObj(x) && x.id != null) && new Set(a.map(x => x.id)).size === a.length;
  function merge3(base, local, remote) {
    if (same(local, remote)) return local;
    if (same(base, local)) return remote;
    if (same(base, remote)) return local;
    if (isObj(local) && isObj(remote)) {
      const b = isObj(base) ? base : {}, out = {};
      new Set([...Object.keys(local), ...Object.keys(remote)]).forEach(k => {
        const inL = k in local, inR = k in remote, inB = k in b;
        if (inL && inR) out[k] = merge3(b[k], local[k], remote[k]);
        else if (inL) { if (!inB || !same(b[k], local[k])) out[k] = local[k]; }
        else if (!inB || !same(b[k], remote[k])) out[k] = remote[k];
      });
      return out;
    }
    if (keyed(local) && keyed(remote)) {
      const B = new Map((keyed(base) ? base : []).map(x => [x.id, x])), L = new Map(local.map(x => [x.id, x])), R = new Map(remote.map(x => [x.id, x])), out = [];
      local.forEach(x => { if (R.has(x.id)) out.push(merge3(B.get(x.id), x, R.get(x.id))); else if (!B.has(x.id) || !same(B.get(x.id), x)) out.push(x); });
      remote.forEach(x => { if (!L.has(x.id) && (!B.has(x.id) || !same(B.get(x.id), x))) out.push(x); });
      return out;
    }
    return local;
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
.scv-gate{position:fixed;inset:0;z-index:1000;overflow:auto;background:var(--bg,#F2F4F7);color:var(--ink,#0E1726);font:16px/1.4 var(--f,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif)}
.scv-gate *,.scv-acct *{box-sizing:border-box}
.scv-gate .g-in{width:100%;max-width:440px;margin:0 auto;padding:44px 18px 40px}
.g-plate{display:flex;gap:14px;align-items:center;margin:0 4px 24px}
.g-plate i{display:none}
.g-plate img{width:58px;height:58px;border-radius:15px;flex:none;box-shadow:0 6px 16px rgba(14,23,38,.16)}
.g-plate b{display:block;font-size:27px;line-height:1.05;font-weight:800;letter-spacing:-.025em}
.g-plate span{display:block;color:var(--mut,#6B7686);font-size:14px;font-weight:500;margin-top:5px;line-height:1.3}
.g-card{background:var(--surface,#fff);border-radius:22px;padding:20px 18px;margin:0 0 14px;box-shadow:0 1px 2px rgba(14,23,38,.06)}
.g-card h2{font-size:21px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px;line-height:1.2}
.g-card p{margin:0 0 12px}
.g-mut{color:var(--mut,#6B7686);font-size:14px}
.g-card label{display:block;font-size:13px;font-weight:600;color:var(--mut,#6B7686);margin:14px 0 5px}
.g-card input{display:block;width:100%;min-height:52px;padding:12px 14px;border:1px solid var(--line,#E3E7ED);border-radius:14px;background:var(--surface,#fff);color:inherit;font:inherit;font-size:17px}
.g-card input:focus{outline:none;border-color:var(--navy2,#17406E);box-shadow:0 0 0 3px rgba(23,64,110,.14)}
.g-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;padding:0 18px;border-radius:999px;background:var(--navy,#0E2A4A);color:#fff;border:0;font:inherit;font-weight:700;font-size:16px;cursor:pointer;text-align:center;margin-top:16px}
.g-btn.g-g{background:var(--surface,#fff);color:var(--ink,#0E1726);box-shadow:inset 0 0 0 1px var(--line,#E3E7ED)}
.g-btn[disabled]{opacity:.55;cursor:default}
.g-link{background:none;border:none;color:var(--link,#1B5FBF);font:inherit;font-weight:600;cursor:pointer;padding:8px 0}
.g-err{background:var(--neg-bg,#FFE2DD);color:var(--neg,#C5352A);padding:11px 14px;border-radius:14px;font-weight:600;font-size:14.5px;margin-top:14px}
.g-ok{background:var(--pos-bg,#DDF3E5);color:var(--pos,#157F40);padding:11px 14px;border-radius:14px;font-weight:600;font-size:14.5px;margin-top:14px}
.g-note{background:var(--warn-bg,#FFEFC8);color:var(--warn,#8A5F00);padding:13px 15px;border-radius:18px;font-size:15px;margin-bottom:14px}
.scv-gate [hidden],.scv-acct [hidden]{display:none!important}
.scv-acct{position:fixed;inset:0;z-index:1001;background:rgba(14,23,38,.45);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:28px 14px;color:var(--ink,#0E1726);font:16px/1.4 var(--f,system-ui,sans-serif)}
.scv-acct .g-card{width:100%;max-width:430px;margin:0;border-radius:26px;box-shadow:0 20px 50px rgba(14,23,38,.25)}
.a-row{display:flex;gap:10px}.a-row .g-btn{flex:1}
.h-list{max-height:52vh;overflow:auto;margin:12px 0 0;border-top:1px solid var(--line2,#EEF1F5)}
.h-it{padding:12px 0;border-bottom:1px solid var(--line2,#EEF1F5)}
.h-it b{display:block;font-weight:700}
.h-it .a-row .g-btn{margin-top:9px;min-height:42px;font-size:14.5px}
.scv-acctbtn{flex:none;display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:50%;background:var(--navy,#0E2A4A);color:#fff;cursor:pointer;padding:0}
.scv-acctbtn svg{width:21px;height:21px;display:block}`;
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
<div class="g-plate"><i></i><img src="icon-192.png" alt="" width="58" height="58"><div><b>${escH(opt.name || "SCV")}</b><span>${escH(opt.sub || "acces doar pentru proprietar")}</span></div></div>
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

  /**
   * Fereastra „Copii automate”: baza de date păstrează singură, în fiecare zi în care se schimbă ceva, felul în care arăta
   * fiecare document la începutul zilei. De aici se pot descărca sau pune înapoi.
   * opt: { app, label(path) → nume pe românește (sau null ca să nu apară), restore(path, data) }
   */
  async function history(opt) {
    uiCss();
    const old = document.getElementById("scvHist"); if (old) old.remove();
    const d = document.createElement("div"); d.className = "scv-acct"; d.id = "scvHist";
    d.innerHTML = `<div class="g-card" role="dialog" aria-modal="true" aria-label="Copii automate"><h2>Copii automate</h2>
<p class="g-mut">În fiecare zi în care schimbi ceva, baza de date păstrează singură o copie cu felul în care arătau datele la începutul zilei. De aici poți reveni la o zi mai veche.</p>
<div id="hList" class="h-list"><p class="g-mut" style="margin:10px 0">Se încarcă…</p></div><div id="hErr" class="g-err" hidden></div>
<button class="g-btn" type="button" id="hClose">Închide</button></div>`;
    document.body.appendChild(d);
    const q = x => d.querySelector(x);
    const close = () => d.remove();
    q("#hClose").onclick = close;
    d.addEventListener("click", e => { if (e.target === d) close(); });
    const say = t => { q("#hList").innerHTML = '<p class="g-mut" style="margin:10px 0">' + t + "</p>"; };
    let rows;
    try {
      const r = await fresh(sb.from("docs_history").select("id,path,day,op").eq("app", opt.app)).order("id", { ascending: false }).limit(300);
      if (r.error) throw r.error;
      rows = r.data;
    } catch (e) { say(isNet(e) || navigator.onLine === false ? "Nu am internet acum. Încearcă din nou mai târziu." : "Copiile automate nu sunt pornite încă."); return; }
    const items = rows.map(r => ({ r, name: opt.label ? opt.label(r.path) : r.path })).filter(x => x.name);
    if (!items.length) { say("Nu există încă nicio copie. Prima apare după prima zi în care schimbi ceva."); return; }
    const ro = day => String(day).slice(0, 10).split("-").reverse().join(".");
    q("#hList").innerHTML = items.map(x => `<div class="h-it" data-id="${x.r.id}"><div><b>${escH(x.name)}</b><span class="g-mut">${x.r.op === "D" ? "șters în " : "cum era la începutul zilei de "}${ro(x.r.day)}</span></div><div class="a-row"><button class="g-btn g-g" type="button" data-h="dl">Descarcă</button><button class="g-btn g-g" type="button" data-h="re">Pune înapoi</button></div></div>`).join("");
    q("#hList").onclick = async e => {
      const b = e.target.closest("button[data-h]"); if (!b) return;
      const id = +b.closest(".h-it").dataset.id, x = items.find(i => i.r.id === id), er = q("#hErr"); er.hidden = true;
      if (b.dataset.h === "re" && !b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Sigur? Apasă din nou"; b.classList.remove("g-g"); return; }
      b.disabled = true;
      try {
        const r = await sb.from("docs_history").select("data").eq("id", id).single();
        if (r.error) throw r.error;
        if (b.dataset.h === "dl") await saveFile("copie " + x.name.replace(/[\\/:*?"<>|]/g, "") + " " + ro(x.r.day) + ".json", JSON.stringify(r.data.data, null, 1), "application/json");
        else { await opt.restore(x.r.path, r.data.data); close(); }
      } catch (z) { er.textContent = isNet(z) ? "Nu am internet acum." : "Nu a mers: " + ((z && z.message) || z); er.hidden = false; }
      finally { b.disabled = false; }
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
   *
   * Cum lucrează:
   *  - fiecare modificare se păstrează întâi pe aparat, apoi se trimite în baza de date;
   *  - fără semnal, aplicația pornește imediat cu datele păstrate pe aparat; când revine semnalul, ÎNTÂI ia ce s-a schimbat
   *    pe server (de pe alt aparat), împacă cele două versiuni și abia apoi trimite – nimic făcut pe alt aparat nu se pierde.
   */
  function store(app, opt) {
    opt = opt || {};
    const uid = me.id, ckey = "scv-cache-" + app + "-" + uid, useCache = opt.cache !== false;
    const dirty = new Map();
    const srv = {};                       // ultima versiune cunoscută de pe server, pe document
    let cache = (useCache && LS.get(ckey)) || {};
    cache.docs = cache.docs || {}; cache.ts = cache.ts || {}; cache.pend = cache.pend || []; cache.base = cache.base || {};
    let lastTs = "";
    const bump = t => { if (t && (!lastTs || Date.parse(t) > Date.parse(lastTs))) lastTs = t; };
    let flushing = false, timer = null, retry = null, started = false, online = true, authTold = false, authTries = 0;
    const status = (t, w) => { if (opt.onStatus) opt.onStatus(t, !!w); };
    const isAuthErr = e => !!e && !isNet(e) && (e.code === "42501" || e.code === "PGRST301" || e.code === "PGRST303" || e.status === 401 || /jwt|permission denied/i.test(String(e.message || "")));
    const authLost = () => { if (!authTold && opt.onAuthLost) { authTold = true; opt.onAuthLost(); } };
    const baseOf = p => p in srv ? srv[p] : cache.base[p];
    const newer = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return x > y || (x === y && a > b); };
    let pulling = null;
    const saveCache = () => {
      if (!useCache) return;
      cache.pend = [...dirty.keys()];
      Object.keys(cache.base).forEach(p => { if (!dirty.has(p)) delete cache.base[p]; });
      if (!LS.set(ckey, cache)) LS.set(ckey, { docs: {}, ts: cache.ts, pend: [], base: {} });
    };
    /* Modificările rămase netrimise de data trecută (aplicația a fost închisă fără semnal). */
    const pendingFromCache = remote => {
      (cache.pend || []).forEach(p => {
        if (!(p in cache.docs)) return;
        let snap = cache.docs[p];
        if (remote) { if (p in remote) snap = merge3(cache.base[p], snap, remote[p]); remote[p] = snap; cache.docs[p] = snap; }
        dirty.set(p, { get: () => snap });
      });
    };
    const fetchAll = () => fresh(sb.from("docs").select("path,data,updated_at").eq("app", app)).then(r => r.error ? { err: r.error } : { rows: r.data }, e => ({ err: e }));

    /* Rânduri venite de pe server după pornire: ce nu e în lucru aici se înlocuiește; ce e în lucru se împacă. */
    function applyRows(rows) {
      let changed = false;
      rows.forEach(row => {
        bump(row.updated_at);
        const p = row.path;
        if (cache.ts[p] && !newer(row.updated_at, cache.ts[p])) return;   // același rând sau unul mai vechi decât ce avem deja
        cache.ts[p] = row.updated_at; changed = true;
        if (dirty.has(p)) {
          let local; try { local = dirty.get(p).get(); } catch (e) { local = undefined; }
          const base = baseOf(p);
          srv[p] = clone(row.data); cache.base[p] = srv[p];
          if (local === undefined) return;
          const merged = merge3(base, clone(local), row.data);
          if (!same(merged, local)) {
            dirty.set(p, { get: () => merged });
            if (useCache) cache.docs[p] = merged;
            if (opt.onRemote) opt.onRemote(p, clone(merged));
          }
          return;
        }
        srv[p] = clone(row.data);
        if (useCache) cache.docs[p] = row.data;
        if (opt.onRemote) opt.onRemote(p, row.data);
      });
      if (changed) saveCache();
    }

    async function load() {
      const hasCache = useCache && Object.keys(cache.docs).length > 0;
      /* fără date păstrate pe aparat nu avem cu ce porni: mai așteptăm puțin confirmarea contului (semnal slab) */
      if (me.offline && !hasCache && navigator.onLine !== false) await user(8000);
      const net = me.offline ? null : fetchAll();
      let first;
      if (!net) first = { err: new Error("Failed to fetch") };
      else if (hasCache) first = await Promise.race([net, sleep(navigator.onLine === false ? 0 : 2500).then(() => null)]);
      else first = await net;
      if (first && first.rows) {
        const docs = {}, ts = {};
        first.rows.forEach(r => { docs[r.path] = r.data; ts[r.path] = r.updated_at; bump(r.updated_at); srv[r.path] = clone(r.data); });
        pendingFromCache(docs);
        dirty.forEach((v, p) => { if (p in srv) cache.base[p] = srv[p]; });
        cache.docs = useCache ? clone(docs) : {}; cache.ts = ts; saveCache();
        online = true;
        if (dirty.size) kick(0);
        return { docs, offline: false };
      }
      const netDown = first === null || me.offline || isNet(first.err) || navigator.onLine === false;
      if (hasCache && netDown) {
        pendingFromCache(null);
        Object.values(cache.ts).forEach(bump);
        online = false;
        if (first === null) net.then(x => {
          if (x.rows) { applyRows(x.rows); online = true; if (dirty.size) kick(0); else status("la zi ✓"); }
          else status("fără internet – lucrezi pe datele păstrate pe acest aparat", true);
        });
        return { docs: clone(cache.docs), offline: true, waiting: first === null, error: first && first.err };
      }
      throw (first && first.err && !me.offline ? first.err : new Error("Fără internet și fără date păstrate pe acest aparat."));
    }

    function kick(ms) { clearTimeout(timer); timer = setTimeout(flush, ms); }

    function put(path, getter, delay) {
      if (!dirty.has(path)) { const b = path in srv ? srv[path] : (useCache ? cache.docs[path] : undefined); if (b !== undefined) cache.base[path] = clone(b); }
      dirty.set(path, { get: getter });
      if (useCache) { try { cache.docs[path] = clone(getter()); } catch (e) { } saveCache(); }
      if (online && !me.offline) status("se salvează…"); else status("fără internet – se salvează când revine", true);
      kick(delay == null ? (opt.delay == null ? 250 : opt.delay) : delay);
    }

    /* Aduce ce s-a schimbat pe server. Întoarce null dacă a mers, altfel eroarea. */
    function pull() {
      if (!pulling) pulling = pullNow().finally(() => { pulling = null; });
      return pulling;
    }
    async function pullNow() {
      if (me.offline) { const u = await revive(); if (!u) { authLost(); return new Error("Sesiune expirată"); } if (u.offline) return new Error("Failed to fetch"); }
      let r;
      try {
        const since = lastTs ? new Date(Date.parse(lastTs) - 5000).toISOString() : "1970-01-01T00:00:00Z";
        r = await fresh(sb.from("docs").select("path,data,updated_at").eq("app", app).gt("updated_at", since));
      } catch (e) { return e; }
      if (r.error) return r.error;
      applyRows(r.data);
      const was = online; online = true; authTold = false;
      if (!was && !dirty.size) status("la zi ✓");
      return null;
    }

    async function poll() {
      if (flushing) return;
      const err = await pull();
      if (err) { if (isAuthErr(err)) { const u = await revive(); if (!u) authLost(); } return; }
      if (dirty.size && !flushing) kick(0);
    }

    async function flush() {
      if (flushing) return;
      clearTimeout(timer); clearTimeout(retry);
      flushing = true;
      let fail = null;
      try {
        /* după o pauză fără semnal: întâi luăm și împăcăm ce s-a schimbat pe server, abia apoi trimitem */
        if (!online || me.offline) fail = await pull();
        else if (pulling) { try { await pulling; } catch (e) { } }
        if (!fail) for (const [path, ent] of [...dirty]) {
          const cur = dirty.get(path); if (!cur) continue;
          let data;
          try { data = clone(cur.get()); } catch (e) { dirty.delete(path); continue; }
          const r = await sb.from("docs").upsert({ owner: uid, app, path, data }, { onConflict: "owner,app,path" }).select("updated_at").single();
          if (r.error) { fail = r.error; break; }
          cache.ts[path] = r.data.updated_at; bump(r.data.updated_at); srv[path] = data;
          if (dirty.get(path) === cur) dirty.delete(path); else cache.base[path] = data;
        }
      } catch (e) { fail = e; }
      flushing = false;
      saveCache();
      if (fail) {
        online = false;
        const net = isNet(fail) || navigator.onLine === false;
        if (!net && isAuthErr(fail)) {
          status("se reconectează…", true);
          const u = await revive();
          if (!u) { authLost(); retry = setTimeout(flush, 5000); }
          else retry = setTimeout(flush, authTries++ < 2 ? 400 : 5000);
        } else {
          status(net ? "fără internet – se salvează când revine" : "NESALVAT – reîncerc", true);
          retry = setTimeout(flush, 5000);
        }
      } else {
        online = true; authTold = false; authTries = 0;
        if (dirty.size) kick(50); else status("salvat ✓");
      }
    }

    async function remove(path) {
      dirty.delete(path); delete cache.docs[path]; delete cache.ts[path]; delete cache.base[path]; delete srv[path]; saveCache();
      const r = await sb.from("docs").delete().eq("app", app).eq("path", path);
      if (r.error) throw r.error;
    }

    const wake = () => { if (dirty.size) flush(); else poll(); };
    function start() {
      if (started) return; started = true;
      setInterval(() => { if (document.visibilityState === "visible") poll(); }, opt.poll || 20000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") poll(); else if (dirty.size) flush(); });
      window.addEventListener("online", () => { revive().then(wake); });
      window.addEventListener("pagehide", () => { if (dirty.size) flush(); });
      sessionBack.add(wake);
      if (opt.warnUnload) window.addEventListener("beforeunload", e => { if (dirty.size) { e.preventDefault(); e.returnValue = ""; } });
    }

    /** După ce omul a intrat din nou în cont (sesiunea expirase): reluăm trimiterea. */
    function resume() { authTold = false; authTries = 0; wake(); }

    return { load, put, remove, poll, start, flush, resume, pending: () => dirty.size, isOnline: () => online };
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

  window.SCV = { base: BASE, sb, user, revive, merge3, gate, account, accountButton, history, signIn, signUp, signOut, changePassword, dbState, claimSeed, authMessage, store, saveFile, loadScript, needXl, LS, isNet };
})();

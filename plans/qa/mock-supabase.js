/* Mock Supabase pentru teste locale: baza „docs” în localStorage (cheia mock-db). */
(function () {
  const KEY = "mock-db";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { docs: [], hist: [] }; } catch (e) { return { docs: [], hist: [] }; } };
  const saveDb = d => localStorage.setItem(KEY, JSON.stringify(d));
  const USER = { id: "test-user", email: "test@scv.ro" };
  let tick = Date.now();
  const nowIso = () => new Date(++tick).toISOString();
  function Q(table) {
    const q = { table, filters: [], op: "select", payload: null, cols: "*", single: false, ord: null, lim: null, ret: false };
    const api = {
      select(c) { if (q.op === "select") q.cols = c || "*"; else q.ret = true; return api; },
      eq(k, v) { q.filters.push(r => r[k] === v); return api; },
      neq(k, v) { q.filters.push(r => r[k] !== v); return api; },
      gt(k, v) { q.filters.push(r => String(r[k]) > String(v)); return api; },
      order(k, o) { q.ord = [k, o && o.ascending === false ? -1 : 1]; return api; },
      limit(n) { q.lim = n; return api; },
      single() { q.single = true; return api; },
      insert(p) { q.op = "insert"; q.payload = p; return api; },
      update(p) { q.op = "update"; q.payload = p; return api; },
      upsert(p) { q.op = "upsert"; q.payload = p; return api; },
      delete() { q.op = "delete"; return api; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); }
    };
    function run() {
      const db = load(); const t = table === "docs" ? db.docs : db.hist;
      const match = r => q.filters.every(f => f(r));
      let out = [];
      if (q.op === "select") out = t.filter(match);
      else if (q.op === "insert") { const row = Object.assign({}, q.payload, { updated_at: nowIso() }); if (t.some(r => r.app === row.app && r.path === row.path)) return { data: null, error: { code: "23505", message: "duplicate" } }; t.push(row); out = [row]; }
      else if (q.op === "update") { t.filter(match).forEach(r => { Object.assign(r, q.payload, { updated_at: nowIso() }); out.push(r); }); }
      else if (q.op === "upsert") { const p = q.payload; let r = t.find(x => x.app === p.app && x.path === p.path); if (r) Object.assign(r, p, { updated_at: nowIso() }); else { r = Object.assign({}, p, { updated_at: nowIso() }); t.push(r); } out = [r]; }
      else if (q.op === "delete") { const keep = t.filter(r => !match(r)); out = t.filter(match); if (table === "docs") db.docs = keep; else db.hist = keep; }
      saveDb(db);
      if (q.ord) out = out.slice().sort((a, b) => (a[q.ord[0]] > b[q.ord[0]] ? 1 : -1) * q.ord[1]);
      if (q.lim) out = out.slice(0, q.lim);
      out = JSON.parse(JSON.stringify(out));
      return { data: q.single ? (out[0] || null) : out, error: null };
    }
    return api;
  }
  window.supabase = {
    createClient() {
      return {
        auth: {
          getSession: async () => ({ data: { session: { user: USER } }, error: null }),
          signInWithPassword: async () => ({ data: { user: USER, session: { user: USER } }, error: null }),
          signUp: async () => ({ data: { user: USER }, error: null }),
          signOut: async () => ({ error: null }),
          updateUser: async () => ({ data: { user: USER }, error: null }),
          onAuthStateChange() { return { data: { subscription: { unsubscribe() { } } } }; }
        },
        rpc: async (n) => ({ data: n === "scv_state" ? true : 0, error: null }),
        from: t => Q(t)
      };
    }
  };
})();

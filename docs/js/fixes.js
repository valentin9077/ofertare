'use strict';
/*
 * Fixuri post-boot pentru sincronizarea online.
 * - Supabase are coloana public.oferte.id de tip uuid.
 * - Versiunea inițială crea ID-uri scurte cu Math.random(), iar upsert-ul ofertelor pica.
 * - Aici migrăm ofertele locale la UUID real, fără să schimbăm ID-urile interne ale categoriilor/articolelor.
 */
(function(){
  if(window.__OFERTARE_FIXES__) return;
  window.__OFERTARE_FIXES__ = true;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const MAP_KEY = 'ofertare.offerIdMap';

  function hasAppState(){
    try{ return typeof S !== 'undefined' && S && Array.isArray(S.offers) && typeof LS !== 'undefined'; }
    catch(e){ return false; }
  }
  function safeJsonGet(key, fallback){
    try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch(e){ return fallback; }
  }
  function isUuid(id){ return typeof id === 'string' && UUID_RE.test(id); }
  function newOfferId(){
    if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    // RFC4122 v4 fallback pentru browsere vechi
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function normalizeOffer(o){
    if(!o || typeof o !== 'object') return null;
    o.beneficiar = Object.assign({firma:'', adresa:'', cif:'', tel:'', email:''}, o.beneficiar || {});
    if(!Array.isArray(o.categorii)) o.categorii = [];
    return o;
  }
  function migrateOfferIds(){
    if(!hasAppState()) return false;
    const idMap = safeJsonGet(MAP_KEY, {});
    const used = new Set();
    let changed = false;

    S.offers = S.offers.map(normalizeOffer).filter(Boolean);
    S.offers.forEach(o => {
      const oldId = String(o.id || '');
      if(!isUuid(oldId)){
        const mapped = oldId && isUuid(idMap[oldId]) && !used.has(idMap[oldId]) ? idMap[oldId] : newOfferId();
        if(oldId) idMap[oldId] = mapped;
        o.id = mapped;
        changed = true;
      }
      if(used.has(o.id)){
        o.id = newOfferId();
        changed = true;
      }
      used.add(o.id);
    });

    if(S.currentId && idMap[S.currentId]) S.currentId = idMap[S.currentId];
    try{ localStorage.setItem(MAP_KEY, JSON.stringify(idMap)); }catch(e){}
    if(changed) LS.set('offers', S.offers);
    return changed;
  }

  // Migrare imediată, inclusiv pentru backup-uri vechi deja salvate local.
  migrateOfferIds();

  // Salvează mereu ofertele cu ID compatibil Supabase.
  if(typeof saveOffers === 'function' && !saveOffers.__ofertareFixed){
    const originalSaveOffers = saveOffers;
    saveOffers = function(){
      migrateOfferIds();
      return originalSaveOffers.apply(this, arguments);
    };
    saveOffers.__ofertareFixed = true;
  }

  // Butonul „Ofertă nouă” din app.js avea id: uid(); îl înlocuim cu UUID.
  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('#btn-new-offer');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    migrateOfferIds();
    const n = Array.isArray(S.offers) ? S.offers.length + 1 : 1;
    const o = {
      id: newOfferId(),
      nr: `2026/${String(n).padStart(3,'0')}`,
      data: todayRO(),
      valabilitate: plusDaysRO(30),
      beneficiar: {firma:'', adresa:'', cif:'', tel:'', email:''},
      obiect: S.settings.obiect,
      avans: S.settings.avans,
      categorii: []
    };
    S.offers.push(o);
    saveOffers();
    openOffer(o.id);
  }, true);

  // Adaugă câmp separat pentru email beneficiar, altfel exista în print dar nu putea fi completat în editor.
  function enhanceBeneficiaryEmailField(){
    const o = typeof getOffer === 'function' ? getOffer() : null;
    if(!o || !o.beneficiar || document.querySelector('#b-email')) return;
    const telField = document.querySelector('#b-tel')?.closest('.field');
    if(!telField) return;
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `<label>Email beneficiar</label><input id="b-email" value="${esc(o.beneficiar.email || '')}">`;
    telField.after(wrap);
    const input = document.querySelector('#b-email');
    input.addEventListener('input', () => { o.beneficiar.email = input.value; saveOffers(); });
  }
  if(typeof renderEditor === 'function' && !renderEditor.__ofertareFixed){
    const originalRenderEditor = renderEditor;
    renderEditor = function(){
      const ret = originalRenderEditor.apply(this, arguments);
      enhanceBeneficiaryEmailField();
      return ret;
    };
    renderEditor.__ofertareFixed = true;
  }

  function patchSync(){
    if(!window.Sync || Sync.__ofertareFixed) return;

    Sync.pushOffers = function(){
      if(!this.online()) return;
      migrateOfferIds();
      this._deb('o', async () => {
        syncDot('busy');
        try{
          const rows = (S.offers || []).map(o => ({
            id: o.id,
            user_id: USER.id,
            data: o,
            updated_at: isoNow()
          }));
          if(!rows.length){ syncDot('ok'); return; }
          const {error} = await sb.from('oferte').upsert(rows, {onConflict:'id'});
          if(error){ console.warn('pushOffers', error); syncDot('err'); return; }
          syncDot('ok');
        }catch(err){ console.warn('pushOffers', err); syncDot('err'); }
      });
    };

    Sync.deleteOffer = async function(id){
      if(!this.online() || !isUuid(id)) return;
      try{ await sb.from('oferte').delete().eq('id', id).eq('user_id', USER.id); }
      catch(e){ console.warn('deleteOffer', e); }
    };

    Sync.pullAll = async function(){
      syncDot('busy');
      migrateOfferIds();
      const localOffers = (S.offers || []).slice();
      const [st, ca, of] = await Promise.all([
        sb.from('settings').select('data').eq('user_id', USER.id).maybeSingle(),
        sb.from('catalog').select('data').eq('user_id', USER.id).maybeSingle(),
        sb.from('oferte').select('id,data,updated_at').eq('user_id', USER.id).order('updated_at', {ascending:true})
      ]);
      if(st.error || ca.error || of.error){ syncDot('err'); throw (st.error || ca.error || of.error); }

      if(st.data && st.data.data) S.settings = Object.assign({}, DEFAULT_SETTINGS, st.data.data);
      if(ca.data && Array.isArray(ca.data.data) && ca.data.data.length) S.catalog = ca.data.data;
      else await sb.from('catalog').upsert({user_id:USER.id, data:S.catalog, updated_at:isoNow()});

      const byId = new Map();
      localOffers.forEach(o => { if(o && o.id) byId.set(o.id, normalizeOffer(o)); });
      (of.data || []).forEach(r => {
        const remote = normalizeOffer(r.data || {});
        if(!remote) return;
        remote.id = isUuid(remote.id) ? remote.id : r.id;
        byId.set(remote.id, remote);
      });
      S.offers = Array.from(byId.values()).filter(Boolean);
      migrateOfferIds();

      LS.set('settings', S.settings);
      LS.set('catalog', S.catalog);
      LS.set('offers', S.offers);
      syncDot('ok');

      // Dacă telefonul are oferte locale și contul online este gol/parțial, le urcăm după login.
      Sync.pushSettings();
      Sync.pushCatalog();
      Sync.pushOffers();
    };

    Sync.__ofertareFixed = true;
  }

  patchSync();
  window.addEventListener('online', () => { migrateOfferIds(); patchSync(); });
})();

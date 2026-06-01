'use strict';
/* ===================== Ofertare Instalații — logica aplicației ===================== */

/* ---------- Stocare ---------- */
const LS = {
  get(k, d){ try{ const v = localStorage.getItem('ofertare.'+k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ localStorage.setItem('ofertare.'+k, JSON.stringify(v)); }
};

const DEFAULT_SETTINGS = {
  co: 'SCV AQUA PREMIUM INSTAL SRL',
  slogan: 'SMART SOLUTIONS FOR THE FUTURE',
  cif: 'RO47989333',
  reg: 'J23/2461/2023',
  adresa: 'Str. Amurgului 43, Bl.3, Et.1, Ap.7, Popești-Leordeni, Ilfov',
  tel: '0737 757 673',
  email: 'simpteavalentin@yahoo.com',
  iban: 'RO52BTRLRONCRT0CW5784401',
  banca: 'Banca Transilvania',
  tva: 21,
  tvaNote: 'Plătitor TVA 21% — TVA la încasare | art. 282 Cod Fiscal',
  obiect: 'Montaj instalație: traseu țevi încălzire în pardoseală, instalații sanitare, termice și canalizare interioară. Execuție conform normativelor tehnice în vigoare de către personal specializat.',
  avans: 30,
  modalitate: 'Transfer bancar / Cash',
  penalitati: '0,1% / zi de întârziere',
  garantie: '24 luni',
  termen: 'Stabilit prin contract',
  valabZile: '30 zile calendaristice',
  normSumar: 'I9, I13, GP 043, NP 059',
  regimTVA: 'La încasare — art. 282 CF',
  notaTabel: '* Prețurile se referă exclusiv la manoperă. Materialele sunt puse la dispoziție de beneficiar. TVA la încasare conf. art. 282 Cod Fiscal. Factura se emite după semnarea contractului.',
  normative: [
    ['I9','Normativ instalații sanitare interioare — rețele apă rece/caldă și canalizare în clădiri'],
    ['I13','Normativ instalații de încălzire centrală — distribuție, corpuri de încălzire, pardoseală'],
    ['GP 043','Ghid de proiectare și execuție instalații sanitare în clădiri de locuit'],
    ['NP 059','Normativ privind proiectarea și execuția instalațiilor termice cu apă caldă'],
    ['SR 1343','Standard național — necesarul de apă pentru alimentarea clădirilor'],
    ['SR 1797','Standard național — instalații de încălzire centrală, condiții tehnice de execuție']
  ],
  excluderi: [
    'Rețele exterioare: fosă septică, puț forat, branșament apă rece și gaz natural',
    'Materiale sanitare și termice: robineți, radiatoare, obiecte sanitare, centrală termică, pompe de căldură',
    'Lucrări de construcție, desfacere și refacere finisaje (gresie, faianță, tencuieli)',
    'Probe și certificări oficiale impuse de autorități (ISCIR, ANRE, ISU) — dacă sunt solicitate',
    'Proiectare tehnică, verificare proiect și diriginție de șantier'
  ]
};

/* ---------- Stare ---------- */
let S = {
  settings: Object.assign({}, DEFAULT_SETTINGS, LS.get('settings', {})),
  catalog: LS.get('catalog', null),
  offers: LS.get('offers', []),
  currentId: null
};
if (!S.catalog) {
  S.catalog = (window.CATALOG_SEED || []).map(a => Object.assign({aliases: []}, a));
  LS.set('catalog', S.catalog);
}
function saveCatalog(){ LS.set('catalog', S.catalog); if(window.Sync) Sync.pushCatalog(); }
function saveOffers(){ LS.set('offers', S.offers); if(window.Sync) Sync.pushOffers(); }
function saveSettings(){ LS.set('settings', S.settings); if(window.Sync) Sync.pushSettings(); }

/* ---------- Utilitare ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9);
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fmt(n){
  n = Number(n)||0;
  return n.toLocaleString('ro-RO',{minimumFractionDigits:2, maximumFractionDigits:2});
}
function todayRO(){ const d=new Date(); const p=x=>String(x).padStart(2,'0'); return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()}`; }
function plusDaysRO(days){ const d=new Date(); d.setDate(d.getDate()+days); const p=x=>String(x).padStart(2,'0'); return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()}`; }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),1900); }

function normalize(s){
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[ø"]/g,' ').replace(/[^a-z0-9\/ ]/g,' ')
    .replace(/\s+/g,' ').trim();
}
// echivalente dimensiuni instalatii (toll / DN / De)
const DIMMAP = [['1 1/2','d40'],['1 1/4','d32'],['2 1/2','d65'],['1/2','d15'],['3/4','d20'],['5/4','d32'],['6/4','d40']];
function dimTokens(s){
  let t = ' '+normalize(s)+' ', out=new Set();
  DIMMAP.forEach(([f,d])=>{ if(t.includes(' '+f+' ')||t.includes(f+'"')) out.add(d); });
  (t.match(/d[en]?\s?(\d{2,3})/g)||[]).forEach(m=>{ out.add('d'+m.replace(/\D/g,'')); });
  (t.match(/\bdn\s?(\d{2,3})\b/g)||[]).forEach(m=>{ out.add('d'+m.replace(/\D/g,'')); });
  return out;
}

/* ---------- Navigare tab-uri ---------- */
function showTab(tab){
  $$('#tabbar button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  ['oferte','editor','catalog','setari'].forEach(v=>{ $('#view-'+v).hidden = (v!==tab); });
  if(tab==='oferte') renderOffers();
  if(tab==='catalog') renderCatalog();
  if(tab==='setari') renderSettings();
}
$('#tabbar').addEventListener('click', e=>{ const b=e.target.closest('button'); if(b) showTab(b.dataset.tab); });

/* ===================== OFERTE (listă) ===================== */
function renderOffers(){
  const el = $('#offers-list');
  if(!S.offers.length){ el.innerHTML = '<div class="empty">Nicio ofertă încă.<br>Apasă <b>➕ Ofertă nouă</b> ca să începi.</div>'; return; }
  el.innerHTML = S.offers.slice().reverse().map(o=>{
    const t = offerTotals(o);
    return `<div class="card" data-open="${o.id}" style="cursor:pointer">
      <div class="row"><span class="pill">${esc(o.nr||'fără nr')}</span>
        <span class="muted">${esc(o.data||'')}</span><span class="spacer"></span>
        <button class="btn danger sm" data-del="${o.id}">🗑</button></div>
      <div style="font-weight:600;margin-top:6px">${esc(o.beneficiar.firma||'Beneficiar necompletat')}</div>
      <div class="muted">${esc(o.beneficiar.adresa||'')}</div>
      <div class="row" style="margin-top:6px"><span class="muted">${o.categorii.length} categorii</span>
        <span class="spacer"></span><b style="color:var(--blue)">${fmt(t.total)} RON</b></div>
    </div>`;
  }).join('');
}
$('#offers-list').addEventListener('click', e=>{
  const del = e.target.closest('[data-del]');
  if(del){ e.stopPropagation(); if(confirm('Ștergi această ofertă?')){ if(window.Sync) Sync.deleteOffer(del.dataset.del); S.offers=S.offers.filter(o=>o.id!==del.dataset.del); saveOffers(); renderOffers(); } return; }
  const op = e.target.closest('[data-open]');
  if(op){ openOffer(op.dataset.open); }
});

$('#btn-new-offer').addEventListener('click', ()=>{
  const n = S.offers.length+1;
  const o = {
    id: uid(),
    nr: `2026/${String(n).padStart(3,'0')}`,
    data: todayRO(), valabilitate: plusDaysRO(30),
    beneficiar:{firma:'',adresa:'',cif:'',tel:'',email:''},
    obiect: S.settings.obiect,
    avans: S.settings.avans,
    categorii: []
  };
  S.offers.push(o); saveOffers(); openOffer(o.id);
});

function getOffer(){ return S.offers.find(o=>o.id===S.currentId); }
function openOffer(id){ S.currentId=id; showTab('editor'); renderEditor(); }

/* ---------- Calcule ---------- */
function catValoare(c){ return c.items.reduce((s,it)=>s + (Number(it.cant)||0)*(Number(it.pret)||0), 0); }
function offerTotals(o){
  const sub = o.categorii.reduce((s,c)=>s+catValoare(c),0);
  const tva = sub * (Number(S.settings.tva)||0)/100;
  return { sub, tva, total: sub+tva };
}

/* ===================== EDITOR OFERTĂ ===================== */
function renderEditor(){
  const o = getOffer();
  if(!o){ $('#editor-body').innerHTML='<div class="empty">Selectează o ofertă din tab-ul <b>Oferte</b>.</div>'; return; }
  const t = offerTotals(o);
  $('#editor-body').innerHTML = `
    <div class="row"><button class="btn gray sm" id="ed-back">← Oferte</button>
      <span class="pill">${esc(o.nr)}</span><span class="spacer"></span>
      <button class="btn sec sm" id="ed-import">📥 Import listă</button></div>

    <div class="card" style="margin-top:10px">
      <div class="grid2">
        <div class="field"><label>Nr. ofertă</label><input id="f-nr" value="${esc(o.nr)}"></div>
        <div class="field"><label>Data</label><input id="f-data" value="${esc(o.data)}"></div>
        <div class="field"><label>Valabilitate până la</label><input id="f-valab" value="${esc(o.valabilitate)}"></div>
        <div class="field"><label>Avans (%)</label><input id="f-avans" type="number" value="${esc(o.avans)}"></div>
      </div>
      <h2 class="sec-title">Date beneficiar</h2>
      <div class="grid2">
        <div class="field"><label>Solicitant / Firmă</label><input id="b-firma" value="${esc(o.beneficiar.firma)}"></div>
        <div class="field"><label>Adresa / Șantier</label><input id="b-adresa" value="${esc(o.beneficiar.adresa)}"></div>
        <div class="field"><label>CIF / CNP</label><input id="b-cif" value="${esc(o.beneficiar.cif)}"></div>
        <div class="field"><label>Tel / Email</label><input id="b-tel" value="${esc(o.beneficiar.tel)}"></div>
      </div>
      <div class="field"><label>Obiectul ofertei</label><textarea id="f-obiect">${esc(o.obiect)}</textarea></div>
    </div>

    <h2 class="sec-title">Categorii și articole</h2>
    <div id="cats"></div>
    <button class="btn sec block" id="add-cat">➕ Adaugă categorie</button>

    <div style="height:120px"></div>
    <div class="totbar">
      <div class="r"><span>Subtotal manoperă (fără TVA)</span><b>${fmt(t.sub)} RON</b></div>
      <div class="r"><span>TVA ${esc(S.settings.tva)}% (la încasare)</span><b>${fmt(t.tva)} RON</b></div>
      <div class="r big"><span>TOTAL CU TVA</span><span>${fmt(t.total)} RON</span></div>
      <div class="row" style="margin-top:8px">
        <button class="btn block" id="btn-print-offer" style="flex:1">🧾 Ofertă PDF</button>
        <button class="btn sec block" id="btn-print-list" style="flex:1">📋 Listă cantități PDF</button>
      </div>
    </div>`;

  // top fields binding
  bindInput('#f-nr', v=>o.nr=v); bindInput('#f-data', v=>o.data=v); bindInput('#f-valab', v=>o.valabilitate=v);
  bindInput('#f-avans', v=>o.avans=v, true); bindInput('#f-obiect', v=>o.obiect=v);
  bindInput('#b-firma', v=>o.beneficiar.firma=v); bindInput('#b-adresa', v=>o.beneficiar.adresa=v);
  bindInput('#b-cif', v=>o.beneficiar.cif=v); bindInput('#b-tel', v=>o.beneficiar.tel=v);

  $('#ed-back').onclick = ()=>showTab('oferte');
  $('#ed-import').onclick = ()=>startImport();
  $('#add-cat').onclick = ()=>{ o.categorii.push({id:uid(), nume:'Categorie nouă', items:[]}); saveOffers(); renderCats(); };
  $('#btn-print-offer').onclick = ()=>printOffer(o,'summary');
  $('#btn-print-list').onclick = ()=>printOffer(o,'detail');
  renderCats();
}
function bindInput(sel, fn, recalc){
  const el = $(sel); if(!el) return;
  el.addEventListener('input', ()=>{ fn(el.value); saveOffers(); if(recalc) refreshTotals(); });
}
function refreshTotals(){
  const o=getOffer(); if(!o) return; const t=offerTotals(o);
  const bar=$('.totbar'); if(!bar) return;
  bar.querySelectorAll('.r b')[0].textContent = fmt(t.sub)+' RON';
  bar.querySelectorAll('.r b')[1].textContent = fmt(t.tva)+' RON';
  bar.querySelector('.r.big span:last-child').textContent = fmt(t.total)+' RON';
}

function renderCats(){
  const o=getOffer(); const wrap=$('#cats'); if(!wrap) return;
  if(!o.categorii.length){ wrap.innerHTML='<div class="empty">Nicio categorie. Adaugă una mai jos sau <b>importă o listă</b>.</div>'; return; }
  wrap.innerHTML = o.categorii.map(c=>{
    const rows = c.items.map(it=>{
      const val=(Number(it.cant)||0)*(Number(it.pret)||0);
      return `<div class="line" data-cat="${c.id}" data-item="${it.id}">
        <input class="den-in" value="${esc(it.denumire)}" data-k="denumire">
        <input class="um-in num" value="${esc(it.um)}" data-k="um">
        <input class="cant-in num" type="number" step="any" value="${esc(it.cant)}" data-k="cant">
        <input class="pret-in num" type="number" step="any" value="${esc(it.pret)}" data-k="pret" placeholder="preț">
        <span class="val">${fmt(val)}</span>
        <button class="x" data-del-item>✕</button>
      </div>`;
    }).join('');
    return `<div class="cat-block" data-cat="${c.id}">
      <div class="head">
        <input value="${esc(c.nume)}" data-cat-name>
        <span class="subtotal">${fmt(catValoare(c))} RON</span>
        <button class="btn gray sm" data-add-item>＋ articol</button>
        <button class="x" data-del-cat>🗑</button>
      </div>
      ${rows}
    </div>`;
  }).join('');
}

document.addEventListener('input', e=>{
  const line = e.target.closest('.line');
  if(!line && !e.target.closest('[data-cat-name]')) return;
  if(line){
    const o=getOffer(); const c=o.categorii.find(x=>x.id===line.dataset.cat);
    const it=c.items.find(x=>x.id===line.dataset.item);
    it[e.target.dataset.k] = e.target.value; saveOffers();
    line.querySelector('.val').textContent = fmt((Number(it.cant)||0)*(Number(it.pret)||0));
    line.closest('.cat-block').querySelector('.subtotal').textContent = fmt(catValoare(c))+' RON';
    refreshTotals(); return;
  }
  const cn = e.target.closest('[data-cat-name]');
  if(cn){ const o=getOffer(); const c=o.categorii.find(x=>x.id===e.target.closest('.cat-block').dataset.cat); c.nume=e.target.value; saveOffers(); }
});
document.addEventListener('click', e=>{
  const ai=e.target.closest('[data-add-item]');
  if(ai){ const c=getOffer().categorii.find(x=>x.id===ai.closest('.cat-block').dataset.cat); openCatalogPicker(c); return; }
  const dc=e.target.closest('[data-del-cat]');
  if(dc){ const o=getOffer(); o.categorii=o.categorii.filter(x=>x.id!==dc.closest('.cat-block').dataset.cat); saveOffers(); renderCats(); refreshTotals(); return; }
  const di=e.target.closest('[data-del-item]');
  if(di){ const o=getOffer(); const c=o.categorii.find(x=>x.id===di.closest('.line').dataset.cat); c.items=c.items.filter(x=>x.id!==di.closest('.line').dataset.item); saveOffers(); renderCats(); refreshTotals(); return; }
});

/* ===================== CATALOG ===================== */
let catFilter='';
$('#cat-search').addEventListener('input', e=>{ catFilter=e.target.value; renderCatalog(); });
$('#btn-add-art').addEventListener('click', ()=>editArticle(null));
function filteredCatalog(){
  const q=normalize(catFilter);
  if(!q) return S.catalog;
  const terms=q.split(' ');
  return S.catalog.filter(a=>{ const hay=normalize(a.denumire+' '+a.categorie+' '+a.grup+' '+(a.descriere||'')); return terms.every(t=>hay.includes(t)); });
}
function renderCatalog(){
  const list=filteredCatalog();
  $('#cat-count').textContent = `${list.length} / ${S.catalog.length} articole`;
  const el=$('#catalog-list');
  el.innerHTML = list.slice(0,400).map(a=>`
    <div class="cat-item" data-edit="${a.id}">
      <div class="info"><div class="den">${esc(a.denumire)}</div>
        <div class="meta">${esc(a.grup)} · ${esc(a.um)} ${a.descriere?'· '+esc(a.descriere.slice(0,60)):''}</div></div>
      <div class="price">${a.pret!=null?fmt(a.pret)+' RON':'—'}</div>
    </div>`).join('') + (list.length>400?'<div class="muted" style="text-align:center">…caută ca să vezi mai multe</div>':'');
}
$('#catalog-list').addEventListener('click', e=>{ const it=e.target.closest('[data-edit]'); if(it) editArticle(it.dataset.edit); });

function editArticle(id){
  const a = id ? S.catalog.find(x=>x.id===id) : {id:uid(), grup:'Sanitare', categorie:'', denumire:'', descriere:'', um:'buc', pret:null, aliases:[]};
  openModal(id?'Editează articol':'Articol nou', `
    <div class="field"><label>Denumire</label><input id="m-den" value="${esc(a.denumire)}"></div>
    <div class="grid2">
      <div class="field"><label>Grup</label><input id="m-grup" value="${esc(a.grup)}"></div>
      <div class="field"><label>U.M.</label><input id="m-um" value="${esc(a.um)}"></div>
    </div>
    <div class="field"><label>Categorie</label><input id="m-cat" value="${esc(a.categorie)}"></div>
    <div class="field"><label>Preț manoperă (RON / U)</label><input id="m-pret" type="number" step="any" value="${a.pret==null?'':a.pret}"></div>
    <div class="field"><label>Descriere</label><textarea id="m-desc">${esc(a.descriere||'')}</textarea></div>
  `, [
    id?{label:'🗑 Șterge', cls:'danger', fn:()=>{ S.catalog=S.catalog.filter(x=>x.id!==id); saveCatalog(); closeModal(); renderCatalog(); toast('Articol șters'); }}:null,
    {label:'Salvează', cls:'', fn:()=>{
      a.denumire=$('#m-den').value.trim(); a.grup=$('#m-grup').value.trim(); a.um=$('#m-um').value.trim();
      a.categorie=$('#m-cat').value.trim(); const p=$('#m-pret').value; a.pret = p===''?null:Number(p);
      a.descriere=$('#m-desc').value.trim();
      if(!a.denumire){ toast('Pune o denumire'); return; }
      if(!id) S.catalog.push(a);
      saveCatalog(); closeModal(); renderCatalog(); toast('Salvat');
    }}
  ].filter(Boolean));
}

/* ---------- Catalog picker (adaugă în ofertă) ---------- */
function openCatalogPicker(cat){
  let q='';
  const render = ()=>{
    const terms=normalize(q).split(' ').filter(Boolean);
    const list = S.catalog.filter(a=>{ if(!terms.length) return true; const hay=normalize(a.denumire+' '+a.categorie+' '+a.grup); return terms.every(t=>hay.includes(t)); }).slice(0,60);
    $('#modal-body').innerHTML = `<input class="search" id="pk-search" placeholder="🔎 Caută în catalog..." value="${esc(q)}">
      <div class="muted" style="margin-bottom:6px">Apasă pe un articol ca să-l adaugi. (Poți adăuga mai multe.)</div>` +
      list.map(a=>`<div class="cat-item" data-pick="${a.id}"><div class="info"><div class="den">${esc(a.denumire)}</div>
        <div class="meta">${esc(a.grup)} · ${esc(a.um)}</div></div><div class="price">${a.pret!=null?fmt(a.pret):'—'}</div></div>`).join('') +
      `<button class="btn sec block" id="pk-manual" style="margin-top:8px">➕ Articol manual (gol)</button>`;
    const s=$('#pk-search'); s.focus(); s.oninput=()=>{ q=s.value; render(); };
    $('#pk-manual').onclick=()=>{ cat.items.push({id:uid(),denumire:'',um:'buc',cant:1,pret:null}); saveOffers(); closeModal(); renderCats(); refreshTotals(); };
    $$('#modal-body [data-pick]').forEach(d=>d.onclick=()=>{
      const a=S.catalog.find(x=>x.id===d.dataset.pick);
      cat.items.push({id:uid(), denumire:a.denumire, um:a.um, cant:1, pret:a.pret, srcId:a.id});
      saveOffers(); toast('Adăugat: '+a.denumire.slice(0,30));
      d.style.opacity=.4;
    });
  };
  openModal('Adaugă articol în „'+(cat.nume||'categorie')+'"', '', [
    {label:'Gata', cls:'', fn:()=>{ closeModal(); renderCats(); refreshTotals(); }}
  ]);
  render();
}

/* ===================== IMPORT LISTĂ (Excel) ===================== */
let importCtx=null;
function startImport(){ $('#file-import').value=''; $('#file-import').click(); }
$('#file-import').addEventListener('change', e=>{
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload = ev=>{
    try{
      const wb = XLSX.read(ev.target.result, {type:'array'});
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {header:1, defval:''});
      processImport(rows);
    }catch(err){ alert('Nu am putut citi fișierul. Asigură-te că e Excel (.xlsx/.xls) sau CSV.\n\n'+err.message); }
  };
  reader.readAsArrayBuffer(file);
});

function processImport(rows){
  // detectare coloane
  let head=-1, cDen=-1, cUm=-1, cCant=-1;
  for(let i=0;i<Math.min(rows.length,15);i++){
    const r=rows[i].map(x=>normalize(x));
    r.forEach((v,j)=>{
      if(/denumire|descriere|lucrare|articol/.test(v) && cDen<0){ cDen=j; head=i; }
      if(/^u\.?m\.?$|unitate/.test(v) && cUm<0) cUm=j;
      if(/cant/.test(v) && cCant<0) cCant=j;
    });
    if(head>=0) break;
  }
  if(cDen<0){ // fallback: cea mai lungă coloană text
    const lens={}; rows.forEach(r=>r.forEach((v,j)=>{ lens[j]=(lens[j]||0)+String(v).length; }));
    cDen=Number(Object.keys(lens).sort((a,b)=>lens[b]-lens[a])[0]||0); head=0;
  }
  const items=[];
  for(let i=head+1;i<rows.length;i++){
    const r=rows[i]; if(!r) continue;
    const den=String(r[cDen]||'').trim(); if(den.length<4) continue;
    if(/^subtotal|^total/i.test(den)) continue;
    const um = cUm>=0 ? String(r[cUm]||'').trim() : '';
    let cant = cCant>=0 ? parseFloat(String(r[cCant]).replace(',','.')) : NaN;
    items.push({ denumire:den, um:um||'buc', cant:isNaN(cant)?1:cant });
  }
  if(!items.length){ alert('Nu am găsit articole în fișier. Verifică să existe o coloană de denumire.'); return; }
  // potrivire cu catalogul
  items.forEach(it=> it.matches = matchCatalog(it.denumire));
  importCtx={items};
  showImportPreview();
}

function matchCatalog(text){
  const nt = new Set(normalize(text).split(' ').filter(w=>w.length>2));
  const dt = dimTokens(text);
  const scored = S.catalog.map(a=>{
    // alias exact
    if((a.aliases||[]).some(al=>al===normalize(text))) return {a, score:1};
    const at = new Set(normalize(a.denumire+' '+(a.descriere||'')).split(' ').filter(w=>w.length>2));
    let inter=0; nt.forEach(w=>{ if(at.has(w)) inter++; });
    const jac = inter / (nt.size + at.size - inter || 1);
    const adt = dimTokens(a.denumire+' '+(a.descriere||''));
    let dimOk=0; dt.forEach(d=>{ if(adt.has(d)) dimOk=1; });
    const dimPenalty = (dt.size && adt.size && !dimOk) ? -0.25 : 0;
    return {a, score: jac + dimOk*0.25 + dimPenalty};
  }).sort((x,y)=>y.score-x.score);
  return scored.slice(0,3).filter(m=>m.score>0.05);
}

function showImportPreview(){
  const render=()=>{
    $('#modal-body').innerHTML = `<div class="muted" style="margin-bottom:8px">${importCtx.items.length} articole găsite. Verifică prețul potrivit din catalogul tău (poți schimba):</div>` +
      importCtx.items.map((it,i)=>{
        const m = it.chosen!==undefined ? it.matches[it.chosen] : it.matches[0];
        const conf = m ? (m.score>0.6?'hi':m.score>0.3?'mid':'lo') : 'lo';
        const opts = it.matches.map((mm,k)=>`<option value="${k}" ${ (it.chosen===k||(it.chosen===undefined&&k===0))?'selected':''}>${esc(mm.a.denumire.slice(0,40))} — ${mm.a.pret!=null?fmt(mm.a.pret):'—'}</option>`).join('');
        return `<div class="match-row" data-i="${i}">
          <div class="info" style="flex:1;min-width:0">
            <div class="den" style="font-size:13px">${esc(it.denumire.slice(0,70))}</div>
            <div class="meta muted">cant: ${esc(it.cant)} ${esc(it.um)}</div>
            <select data-choose style="width:100%;margin-top:4px;padding:6px;border:1px solid var(--line);border-radius:6px">
              ${opts}<option value="-1" ${it.chosen===-1?'selected':''}>— fără potrivire (preț gol) —</option></select>
          </div>
          ${m?`<span class="conf ${conf}">${Math.round(m.score*100)}%</span>`:'<span class="conf lo">0%</span>'}
        </div>`;
      }).join('');
    $$('#modal-body [data-choose]').forEach(sel=>sel.onchange=()=>{
      const i=Number(sel.closest('[data-i]').dataset.i); importCtx.items[i].chosen=Number(sel.value); render();
    });
  };
  openModal('Import listă — potrivire prețuri', '', [
    {label:'Anulează', cls:'gray', fn:closeModal},
    {label:'✓ Adaugă în ofertă', cls:'', fn:applyImport}
  ]);
  render();
}
function applyImport(){
  const o=getOffer();
  const cat={id:uid(), nume:'Listă importată ('+todayRO()+')', items:[]};
  importCtx.items.forEach(it=>{
    const ch = it.chosen!==undefined ? it.chosen : 0;
    const m = ch>=0 ? it.matches[ch] : null;
    if(m){ // invata alias-ul
      const a=S.catalog.find(x=>x.id===m.a.id);
      if(a){ a.aliases=a.aliases||[]; const n=normalize(it.denumire); if(!a.aliases.includes(n)) a.aliases.push(n); }
    }
    cat.items.push({ id:uid(), denumire:it.denumire, um:it.um, cant:it.cant, pret: m?m.a.pret:null, srcId:m?m.a.id:null });
  });
  saveCatalog();
  o.categorii.push(cat); saveOffers(); closeModal(); renderCats(); refreshTotals();
  toast('Listă importată: '+importCtx.items.length+' articole');
}

/* ===================== SETĂRI ===================== */
function renderSettings(){
  const s=S.settings;
  $('#setari-body').innerHTML = `
   <div class="card"><h2 class="sec-title" style="margin-top:0">Date firmă (apar pe ofertă)</h2>
    <div class="field"><label>Denumire firmă</label><input id="s-co" value="${esc(s.co)}"></div>
    <div class="field"><label>Slogan</label><input id="s-slogan" value="${esc(s.slogan)}"></div>
    <div class="grid2">
      <div class="field"><label>CIF</label><input id="s-cif" value="${esc(s.cif)}"></div>
      <div class="field"><label>Reg. com.</label><input id="s-reg" value="${esc(s.reg)}"></div>
    </div>
    <div class="field"><label>Adresă</label><input id="s-adresa" value="${esc(s.adresa)}"></div>
    <div class="grid2">
      <div class="field"><label>Telefon</label><input id="s-tel" value="${esc(s.tel)}"></div>
      <div class="field"><label>Email</label><input id="s-email" value="${esc(s.email)}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>IBAN</label><input id="s-iban" value="${esc(s.iban)}"></div>
      <div class="field"><label>Bancă</label><input id="s-banca" value="${esc(s.banca)}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>TVA (%)</label><input id="s-tva" type="number" value="${esc(s.tva)}"></div>
      <div class="field"><label>Avans implicit (%)</label><input id="s-avans" type="number" value="${esc(s.avans)}"></div>
    </div>
    <div class="field"><label>Notă TVA (sus)</label><input id="s-tvanote" value="${esc(s.tvaNote)}"></div>
   </div>
   <div class="card"><h2 class="sec-title" style="margin-top:0">Texte implicite ofertă</h2>
    <div class="field"><label>Obiectul ofertei (implicit)</label><textarea id="s-obiect">${esc(s.obiect)}</textarea></div>
    <div class="field"><label>Garanție</label><input id="s-garantie" value="${esc(s.garantie)}"></div>
    <div class="field"><label>Termen execuție</label><input id="s-termen" value="${esc(s.termen)}"></div>
    <div class="field"><label>Modalitate plată</label><input id="s-modalitate" value="${esc(s.modalitate)}"></div>
    <div class="field"><label>Excluderi (câte una pe rând)</label><textarea id="s-excl" style="min-height:110px">${esc(s.excluderi.join('\n'))}</textarea></div>
   </div>
   <button class="btn block" id="s-save">💾 Salvează setările</button>
   <div class="card" style="margin-top:14px"><h2 class="sec-title" style="margin-top:0">Backup date</h2>
    <div class="muted" style="margin-bottom:8px">Salvează / restaurează tot (catalog + oferte + setări) ca fișier.</div>
    <div class="row"><button class="btn sec sm" id="s-export">⬇️ Exportă backup</button>
      <button class="btn sec sm" id="s-importbk">⬆️ Importă backup</button>
      <button class="btn danger sm" id="s-reset-cat">↺ Resetează catalog</button></div>
   </div>
   <div class="card"><div class="row"><span class="muted" id="s-user"></span><span class="spacer"></span>
     <button class="btn sec sm" id="s-logout">🚪 Ieși din cont</button></div></div>`;
  $('#s-save').onclick=()=>{
    const g=id=>$(id).value;
    Object.assign(s,{co:g('#s-co'),slogan:g('#s-slogan'),cif:g('#s-cif'),reg:g('#s-reg'),adresa:g('#s-adresa'),
      tel:g('#s-tel'),email:g('#s-email'),iban:g('#s-iban'),banca:g('#s-banca'),tva:Number(g('#s-tva')),
      avans:Number(g('#s-avans')),tvaNote:g('#s-tvanote'),obiect:g('#s-obiect'),garantie:g('#s-garantie'),
      termen:g('#s-termen'),modalitate:g('#s-modalitate'),excluderi:g('#s-excl').split('\n').map(x=>x.trim()).filter(Boolean)});
    saveSettings(); updateHeader(); toast('Setări salvate');
  };
  $('#s-export').onclick=exportBackup;
  $('#s-importbk').onclick=importBackup;
  $('#s-reset-cat').onclick=()=>{ if(confirm('Resetezi catalogul la cel inițial? Pierzi modificările din catalog.')){ S.catalog=(window.CATALOG_SEED||[]).map(a=>Object.assign({aliases:[]},a)); saveCatalog(); toast('Catalog resetat'); } };
  if($('#s-user')) $('#s-user').textContent = USER ? ('Cont: '+(USER.email||'')) : 'Mod local (fără cont)';
  if($('#s-logout')) $('#s-logout').onclick = logout;
}
function exportBackup(){
  const data=JSON.stringify({settings:S.settings,catalog:S.catalog,offers:S.offers},null,1);
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  a.download='ofertare-backup-'+todayRO().replace(/\./g,'-')+'.json'; a.click();
}
function importBackup(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange=e=>{ const f=e.target.files[0]; const r=new FileReader();
    r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result);
      if(d.settings) S.settings=Object.assign({},DEFAULT_SETTINGS,d.settings);
      if(d.catalog) S.catalog=d.catalog; if(d.offers) S.offers=d.offers;
      saveSettings(); saveCatalog(); saveOffers(); updateHeader(); renderSettings(); toast('Backup restaurat');
    }catch(err){ alert('Fișier invalid'); } };
    r.readAsText(f); };
  inp.click();
}

/* ===================== MODAL ===================== */
function openModal(title, bodyHTML, buttons){
  $('#modal-title').textContent=title; $('#modal-body').innerHTML=bodyHTML;
  const foot=$('#modal-foot'); foot.innerHTML='';
  (buttons||[]).forEach(b=>{ const btn=document.createElement('button'); btn.className='btn '+(b.cls||'')+' block'; btn.style.flex='1'; btn.textContent=b.label; btn.onclick=b.fn; foot.appendChild(btn); });
  $('#modal').hidden=false;
}
function closeModal(){ $('#modal').hidden=true; }
$('#modal-close').onclick=closeModal;
$('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); });

/* ===================== PRINT / PDF ===================== */
function printOffer(o, mode){
  const s=S.settings; const t=offerTotals(o); const rate=Number(s.tva)||0;
  const head = `
    <div class="ohead">
      <div><div class="co">💧 ${esc(s.co.replace(/ SRL$/,''))}</div><div class="slogan">${esc(s.slogan)}</div></div>
      <div class="right"><div class="co2">${esc(s.co)} | CIF: ${esc(s.cif)}</div>
        ${esc(s.reg)} | ${esc(s.adresa)}<br>Tel: ${esc(s.tel)} | ${esc(s.email)}<br>
        IBAN: ${esc(s.iban)} — ${esc(s.banca)}</div>
    </div>
    <div class="tva-band">${esc(s.tvaNote)}</div>
    <div class="title-band"><span>${mode==='summary'?'OFERTĂ DE PREȚURI':'LISTĂ DE CANTITĂȚI — MANOPERĂ'}</span>
      <span class="meta">Nr. ofertă: <b>${esc(o.nr)}</b> &nbsp; Data: <b>${esc(o.data)}</b><br>Valabilitate până la: <b>${esc(o.valabilitate)}</b></span></div>
    <div class="band">DATE BENEFICIAR</div>
    <table class="kv"><tr><td class="k">Solicitant / Firmă</td><td>${esc(o.beneficiar.firma)}</td></tr>
      <tr><td class="k">Adresa / Șantier</td><td>${esc(o.beneficiar.adresa)}</td></tr>
      <tr><td class="k">CIF / CNP</td><td>${esc(o.beneficiar.cif)}</td></tr>
      <tr><td class="k">Tel / Email</td><td>${esc(o.beneficiar.tel)} ${o.beneficiar.email?'| '+esc(o.beneficiar.email):''}</td></tr></table>
    <div class="band">OBIECTUL OFERTEI</div>
    <div class="obiect">${esc(o.obiect)}</div>`;

  let table;
  if(mode==='summary'){
    const rows = o.categorii.map((c,i)=>{ const val=catValoare(c); const tva=val*rate/100;
      return `<tr><td class="c">${(i+1)*10}</td><td>${esc(c.nume)}</td><td class="c">buc</td><td class="c">1</td>
        <td class="n">${fmt(val)}</td><td class="n">${fmt(val)}</td><td class="n">${fmt(tva)}</td></tr>`; }).join('');
    table = `<table class="items"><thead><tr><th class="n">Nr.</th><th>Cod / Denumire lucrare</th><th>U.M.</th><th>Cant.</th>
        <th class="n">Preț unitar<br>(fără TVA) RON</th><th class="n">Valoare<br>(fără TVA) RON</th><th class="n">TVA ${rate}%<br>RON</th></tr></thead>
      <tbody>${rows}
        <tr class="subtot"><td colspan="5" style="text-align:right">Subtotal manoperă (fără TVA)</td><td class="n">${fmt(t.sub)}</td><td></td></tr>
        <tr class="tva"><td colspan="5" style="text-align:right">TVA ${rate}% (la încasare)</td><td></td><td class="n">${fmt(t.tva)}</td></tr>
      </tbody></table>`;
  } else {
    let body='';
    o.categorii.forEach(c=>{
      body += `<tr class="subtot"><td colspan="7">${esc(c.nume)}</td></tr>`;
      c.items.forEach((it,i)=>{ const val=(Number(it.cant)||0)*(Number(it.pret)||0); const tva=val*rate/100;
        body += `<tr><td class="c">${i+1}</td><td>${esc(it.denumire)}</td><td class="c">${esc(it.um)}</td>
          <td class="n">${esc(it.cant)}</td><td class="n">${it.pret!=null?fmt(it.pret):''}</td><td class="n">${fmt(val)}</td><td class="n">${fmt(tva)}</td></tr>`; });
      body += `<tr class="subtot"><td colspan="5" style="text-align:right">Subtotal ${esc(c.nume).slice(0,40)}</td><td class="n">${fmt(catValoare(c))}</td><td class="n">${fmt(catValoare(c)*rate/100)}</td></tr>`;
    });
    table = `<table class="items"><thead><tr><th class="n">Nr.</th><th>Denumire lucrare</th><th>U.M.</th><th class="n">Cant.</th>
        <th class="n">Preț man.<br>RON/U</th><th class="n">Valoare<br>fără TVA</th><th class="n">TVA ${rate}%</th></tr></thead><tbody>${body}
        <tr class="subtot"><td colspan="5" style="text-align:right">TOTAL manoperă (fără TVA)</td><td class="n">${fmt(t.sub)}</td><td class="n">${fmt(t.tva)}</td></tr></tbody></table>`;
  }

  const totalBand = `<div class="total-band"><span>TOTAL CU TVA</span><span>${fmt(t.sub)} RON &nbsp;→&nbsp; ${fmt(t.total)} RON</span></div>
    <div class="note">${esc(s.notaTabel)}</div>`;

  const avansVal = t.total*(Number(o.avans)||0)/100;
  const extra = mode==='summary' ? `
    <div class="two">
      <div><div class="boxh">CONDIȚII DE PLATĂ</div>
        <table class="kv"><tr><td class="k">Avans la semnare</td><td>${esc(o.avans)}%</td></tr>
          <tr><td class="k">Valoare avans (cu TVA)</td><td>${fmt(avansVal)} RON</td></tr>
          <tr><td class="k">Rest la recepție</td><td>${fmt(t.total-avansVal)} RON</td></tr>
          <tr><td class="k">Modalitate plată</td><td>${esc(s.modalitate)}</td></tr>
          <tr><td class="k">Penalități întârziere</td><td>${esc(s.penalitati)}</td></tr></table></div>
      <div><div class="boxh">GARANȚIE ȘI TERMENE</div>
        <table class="kv"><tr><td class="k">Garanție lucrări</td><td>${esc(s.garantie)}</td></tr>
          <tr><td class="k">Termen execuție</td><td>${esc(s.termen)}</td></tr>
          <tr><td class="k">Valabilitate ofertă</td><td>${esc(s.valabZile)}</td></tr>
          <tr><td class="k">Normative aplicate</td><td>${esc(s.normSumar)}</td></tr>
          <tr><td class="k">Regim TVA</td><td>${esc(s.regimTVA)}</td></tr></table></div>
    </div>
    <div class="band" style="margin-top:8px">NORMATIVE TEHNICE APLICATE</div>
    <table class="kv">${s.normative.map(n=>`<tr><td class="k">${esc(n[0])}</td><td>${esc(n[1])}</td></tr>`).join('')}</table>
    <div class="excl"><b>⚠ OFERTA NU INCLUDE:</b><ul style="margin:4px 0 0 16px;padding:0">${s.excluderi.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="sign"><div><div class="boxh">FURNIZOR</div><div class="l">${esc(s.co)} | ${esc(s.tel)}</div></div>
      <div><div class="boxh">BENEFICIAR</div><div class="l">${esc(o.beneficiar.firma||'Beneficiar')} | Ștampilă | Data</div></div></div>` : '';

  $('#print-area').innerHTML = `<div class="doc">${head}${table}${totalBand}${extra}</div>`;
  document.title = (mode==='summary'?'Oferta_':'Lista_')+(o.nr||'').replace(/\//g,'-');
  setTimeout(()=>{ window.print(); }, 60);
}

/* ===================== SUPABASE / SINCRONIZARE ===================== */
let sb = null, USER = null;
const cfg = window.OFERTARE_CONFIG || {};
function syncDot(state){ const d=$('#sync-dot'); if(d) d.className='sync-dot '+state; }
function isoNow(){ return new Date().toISOString(); }

const Sync = {
  _t:{},
  _deb(key, fn, ms=900){ clearTimeout(this._t[key]); this._t[key]=setTimeout(fn, ms); },
  online(){ return sb && USER && navigator.onLine; },
  pushSettings(){ if(!this.online()) return; this._deb('s', async()=>{ syncDot('busy');
    const {error}=await sb.from('settings').upsert({user_id:USER.id, data:S.settings, updated_at:isoNow()});
    syncDot(error?'err':'ok'); }); },
  pushCatalog(){ if(!this.online()) return; this._deb('c', async()=>{ syncDot('busy');
    const {error}=await sb.from('catalog').upsert({user_id:USER.id, data:S.catalog, updated_at:isoNow()});
    syncDot(error?'err':'ok'); }); },
  pushOffers(){ if(!this.online()) return; this._deb('o', async()=>{ syncDot('busy');
    const rows=S.offers.map(o=>({id:o.id, user_id:USER.id, data:o, updated_at:isoNow()}));
    if(!rows.length){ syncDot('ok'); return; }
    const {error}=await sb.from('oferte').upsert(rows); syncDot(error?'err':'ok'); }); },
  async deleteOffer(id){ if(!this.online()) return; try{ await sb.from('oferte').delete().eq('id',id).eq('user_id',USER.id); }catch(e){} },
  async pullAll(){
    syncDot('busy');
    const [st, ca, of] = await Promise.all([
      sb.from('settings').select('data').eq('user_id',USER.id).maybeSingle(),
      sb.from('catalog').select('data').eq('user_id',USER.id).maybeSingle(),
      sb.from('oferte').select('data').eq('user_id',USER.id)
    ]);
    if(st.error||ca.error||of.error){ syncDot('err'); throw (st.error||ca.error||of.error); }
    if(st.data && st.data.data) S.settings=Object.assign({}, DEFAULT_SETTINGS, st.data.data);
    if(ca.data && Array.isArray(ca.data.data) && ca.data.data.length){ S.catalog=ca.data.data; }
    else { await sb.from('catalog').upsert({user_id:USER.id, data:S.catalog, updated_at:isoNow()}); } // seed prima dată
    if(of.data){ S.offers = of.data.map(r=>r.data).filter(Boolean); }
    LS.set('settings',S.settings); LS.set('catalog',S.catalog); LS.set('offers',S.offers);
    syncDot('ok');
  }
};
window.Sync = Sync;
window.addEventListener('online', ()=>{ if(USER){ Sync.pushSettings(); Sync.pushCatalog(); Sync.pushOffers(); syncDot('ok'); } });
window.addEventListener('offline', ()=>syncDot('off'));

/* ---------- Autentificare ---------- */
let authMode='signin';
function transAuth(m){
  m=(m||'').toLowerCase();
  if(m.includes('invalid login')) return 'Email sau parolă greșite.';
  if(m.includes('already registered')||m.includes('already exists')) return 'Există deja un cont cu acest email. Intră în cont.';
  if(m.includes('password')) return 'Parola trebuie să aibă minim 6 caractere.';
  if(m.includes('email')) return 'Verifică adresa de email.';
  return 'A apărut o problemă. Mai încearcă o dată.';
}
function updateAuthUI(){
  $('#auth-submit').textContent = authMode==='signin'?'Intră în cont':'Creează cont';
  $('#auth-toggle').textContent = authMode==='signin'?'Nu am cont — creează unul':'Am deja cont — intră';
  $('#auth-sub').textContent = authMode==='signin'
    ? 'Intră în contul tău ca să-ți vezi ofertele pe orice dispozitiv.'
    : 'Creează un cont nou (email + parolă, minim 6 caractere).';
  const msg=$('#auth-msg'); msg.textContent=''; msg.className='auth-msg';
}
function bindAuth(){
  $('#auth-toggle').onclick=()=>{ authMode = authMode==='signin'?'signup':'signin'; updateAuthUI(); };
  $('#auth-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#auth-submit').click(); });
  $('#auth-submit').onclick=async()=>{
    const email=$('#auth-email').value.trim(); const pass=$('#auth-pass').value;
    const msg=$('#auth-msg'); msg.className='auth-msg';
    if(!email || pass.length<6){ msg.className='auth-msg err'; msg.textContent='Pune email și o parolă de minim 6 caractere.'; return; }
    $('#auth-submit').disabled=true; msg.textContent='Se procesează...';
    try{
      const res = authMode==='signup'
        ? await sb.auth.signUp({email, password:pass})
        : await sb.auth.signInWithPassword({email, password:pass});
      if(res.error){ msg.className='auth-msg err'; msg.textContent=transAuth(res.error.message); }
      else if(authMode==='signup' && !res.data.session){
        msg.className='auth-msg ok'; msg.textContent='Cont creat! Verifică emailul pentru confirmare, apoi intră.';
        authMode='signin'; setTimeout(updateAuthUI, 4000);
      } else { USER=res.data.user; await afterLogin(); }
    }catch(e){ msg.className='auth-msg err'; msg.textContent='Eroare de rețea. Verifică internetul și mai încearcă.'; }
    $('#auth-submit').disabled=false;
  };
}
function showAuth(){ $('#auth').hidden=false; syncDot('off'); updateAuthUI(); }
async function afterLogin(){
  $('#auth').hidden=true; syncDot('ok');
  try{ await Sync.pullAll(); }catch(e){ console.warn('pull', e); }
  startApp();
}
async function logout(){
  try{ if(sb) await sb.auth.signOut(); }catch(e){}
  USER=null;
  ['settings','catalog','offers'].forEach(k=>localStorage.removeItem('ofertare.'+k));
  location.reload();
}

/* ===================== INIT ===================== */
function updateHeader(){ $('#hdr-co').textContent = S.settings.co ? '· '+S.settings.co.replace(/ SRL$/,'') : ''; }
function startApp(){ updateHeader(); showTab('oferte'); }

async function boot(){
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
  if(!cfg.SUPABASE_URL || !window.supabase){ startApp(); return; } // mod local (fără cont)
  try{
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {auth:{persistSession:true, autoRefreshToken:true}});
    bindAuth();
    const {data:{session}} = await sb.auth.getSession();
    if(session){ USER=session.user; await afterLogin(); }
    else showAuth();
  }catch(e){ console.warn('boot', e); startApp(); } // dacă pică conexiunea, măcar local
}
boot();

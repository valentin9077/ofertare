import { seed, domains } from './data.mjs';

const KEY = 'aquafirm.core.v1';
const domainName = Object.fromEntries(domains);
const pages = [
  ['dash','📊','Dashboard'], ['clients','🏢','Beneficiari'], ['catalog','📚','Catalog'],
  ['import','📥','Import liste'], ['offers','🧾','Oferte'], ['projects','🏗','Proiecte'],
  ['situations','📋','Situații'], ['warranties','🛡','Garanții'], ['expenses','🧾','Cheltuieli'],
  ['profit','📈','Profit'], ['settings','⚙','Setări']
];
let S = load();
let page = 'dash';
let selectedOffer = null;
let draftRows = [];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const id = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const fmt = n => (+n || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = n => fmt(n) + ' RON';
const today = () => new Date().toISOString().slice(0, 10);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9/ ]/g,' ').replace(/\s+/g,' ').trim();
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + (+n || 0)); return x.toISOString().slice(0,10); };
function load(){ try { return Object.assign(structuredClone(seed), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(e){ return structuredClone(seed); } }
function save(){ localStorage.setItem(KEY, JSON.stringify(S)); }
function toast(t){ const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(e.t); e.t = setTimeout(()=>e.classList.remove('show'), 1800); }
function totals(items){ const sub = (items || []).reduce((a,i)=>a+(+i.qty||0)*(+i.price||0),0); const vat = sub * (+S.company.vat || 21) / 100; return { sub, vat, total: sub + vat }; }
function left(d){ return Math.ceil((new Date(d) - new Date(today())) / 86400000); }
function title(t,s){ $('#title').textContent = t; $('#sub').textContent = s || ''; }
function setPage(p){ page = p; render(); }
window.setPage = setPage;

function renderNav(){
  $('#nav').innerHTML = pages.map(p => `<button class='${page===p[0]?'active':''}' onclick='setPage("${p[0]}")'>${p[1]} ${p[2]}</button>`).join('');
}
function render(){ renderNav(); ({dash,clients,catalog,import:importPage,offers,projects,situations,warranties,expenses,profit,settings}[page] || dash)(); }

function dash(){
  title('Dashboard', 'Nucleul aplicației: import → ofertă → proiect → situații → garanții');
  const offerValue = S.offers.reduce((a,o)=>a+totals(o.items).total,0);
  const exp = S.expenses.reduce((a,e)=>a+(+e.total||0),0);
  const due = S.warranties.filter(w=>left(w.expires) <= 90 && left(w.expires) >= 0).length;
  $('#view').innerHTML = `
    <div class='card hero'><div class='label'>Total oferte</div><div class='value'>${money(offerValue)}</div><p>${S.offers.length} oferte · ${S.projects.length} proiecte · ${due} garanții aproape de expirare</p></div>
    <div class='grid'><div class='card'><div class='label'>Beneficiari</div><div class='value'>${S.clients.length}</div></div><div class='card'><div class='label'>Catalog</div><div class='value'>${S.catalog.length}</div></div><div class='card'><div class='label'>Cheltuieli</div><div class='value'>${money(exp)}</div></div><div class='card'><div class='label'>Garanții</div><div class='value'>${S.warranties.length}</div></div></div>
    <div class='card row'><button class='btn' onclick='openImport()'>📥 Import listă</button><button class='btn sec' onclick='newOffer()'>🧾 Ofertă manuală</button><button class='btn sec' onclick='clientForm()'>🏢 Beneficiar</button><button class='btn sec' onclick='productForm()'>📚 Produs</button></div>
  `;
}

function clients(){
  title('Beneficiari', 'CUI, șantier, istoric oferte și proiecte');
  $('#view').innerHTML = `<div class='row'><button class='btn' onclick='clientForm()'>＋ Beneficiar</button></div>` +
    S.clients.map(c => `<div class='card row'><div><b>${esc(c.name)}</b><div class='muted'>CUI ${esc(c.cui)} · ${esc(c.site || 'fără șantier')}</div></div><span class='spacer'></span><span class='pill'>${S.offers.filter(o=>o.clientId===c.id).length} oferte</span><button class='btn sm sec' onclick='clientForm("${c.id}")'>Edit</button></div>`).join('');
}
window.clientForm = function(cid){
  const c = cid ? S.clients.find(x=>x.id===cid) : { id:id(), name:'', cui:'', reg:'', address:'', phone:'', email:'', site:'' };
  modal(cid?'Editează beneficiar':'Beneficiar nou', `<div class='grid2'><div class='field'><label>CUI</label><input id='cf_cui' value='${esc(c.cui)}'></div><div class='field'><label>Denumire</label><input id='cf_name' value='${esc(c.name)}'></div></div><div class='grid2'><div class='field'><label>Reg. Com.</label><input id='cf_reg' value='${esc(c.reg)}'></div><div class='field'><label>Șantier</label><input id='cf_site' value='${esc(c.site)}'></div></div><div class='field'><label>Adresă</label><input id='cf_addr' value='${esc(c.address)}'></div><div class='grid2'><div class='field'><label>Telefon</label><input id='cf_phone' value='${esc(c.phone)}'></div><div class='field'><label>Email</label><input id='cf_email' value='${esc(c.email)}'></div></div><button class='btn' onclick='saveClient("${c.id}", ${cid?1:0})'>Salvează</button>`);
};
window.saveClient = function(cid, old){
  const c = { id:cid, name:$('#cf_name').value.trim(), cui:$('#cf_cui').value.trim(), reg:$('#cf_reg').value.trim(), site:$('#cf_site').value.trim(), address:$('#cf_addr').value.trim(), phone:$('#cf_phone').value.trim(), email:$('#cf_email').value.trim() };
  if(!c.name) return toast('Pune denumirea beneficiarului');
  old ? S.clients = S.clients.map(x=>x.id===cid?c:x) : S.clients.push(c);
  save(); closeModal(); clients(); toast('Beneficiar salvat');
};

function catalog(){
  title('Catalog manoperă', 'Prețurile tale, domenii, pachete și aliasuri');
  $('#view').innerHTML = `<div class='row'><button class='btn' onclick='productForm()'>＋ Produs</button></div><div class='table'><table><thead><tr><th>Cod</th><th>Domeniu</th><th>Denumire</th><th>UM</th><th>Preț</th><th>Cu TVA</th><th></th></tr></thead><tbody>${S.catalog.map(p=>`<tr><td>${esc(p.code)}</td><td>${p.domain}. ${esc(domainName[p.domain])}</td><td><b>${esc(p.name)}</b><div class='muted'>${esc(p.desc)}</div></td><td>${esc(p.unit)}</td><td class='money'>${money(p.price)}</td><td>${money(p.price*(1+S.company.vat/100))}</td><td><button class='btn sm sec' onclick='productForm("${p.id}")'>Edit</button></td></tr>`).join('')}</tbody></table></div>`;
}
window.productForm = function(pid){
  const p = pid ? S.catalog.find(x=>x.id===pid) : { id:id(), code:'', domain:'A', name:'', desc:'', unit:'buc', price:0, type:'componentă', aliases:[] };
  modal(pid?'Editează produs':'Produs nou', `<div class='grid2'><div class='field'><label>Denumire</label><input id='pf_name' value='${esc(p.name)}'></div><div class='field'><label>Cod</label><input id='pf_code' value='${esc(p.code)}'></div></div><div class='grid2'><div class='field'><label>Domeniu</label><select id='pf_domain'>${domains.map(d=>`<option value='${d[0]}' ${p.domain===d[0]?'selected':''}>${d[0]}. ${esc(d[1])}</option>`).join('')}</select></div><div class='field'><label>Preț fără TVA</label><input id='pf_price' type='number' step='0.01' value='${p.price}'></div></div><div class='grid2'><div class='field'><label>UM</label><input id='pf_unit' value='${esc(p.unit)}'></div><div class='field'><label>Tip</label><input id='pf_type' value='${esc(p.type)}'></div></div><div class='field'><label>Aliasuri, separate prin virgulă</label><input id='pf_alias' value='${esc((p.aliases||[]).join(', '))}'></div><div class='field'><label>Descriere</label><textarea id='pf_desc'>${esc(p.desc)}</textarea></div><button class='btn' onclick='saveProduct("${p.id}", ${pid?1:0})'>Salvează</button>`);
};
window.saveProduct = function(pid, old){
  const p = { id:pid, code:$('#pf_code').value, domain:$('#pf_domain').value, name:$('#pf_name').value, desc:$('#pf_desc').value, unit:$('#pf_unit').value || 'buc', price:+$('#pf_price').value || 0, type:$('#pf_type').value, aliases:$('#pf_alias').value.split(',').map(x=>norm(x)).filter(Boolean) };
  if(!p.name) return toast('Pune denumirea produsului');
  old ? S.catalog = S.catalog.map(x=>x.id===pid?p:x) : S.catalog.push(p);
  save(); closeModal(); catalog(); toast('Produs salvat');
};

function importPage(){
  title('Import liste', 'Lista beneficiarului devine ciornă editabilă și apoi ofertă');
  $('#view').innerHTML = `<div class='card'><b>Format actual:</b> text/CSV copiat din Excel. Exemplu: <code>Teava PP-R D63; ml; 45</code>. PDF/poză/XLSX complet se leagă ulterior prin parser backend.</div><button class='btn' onclick='openImport()'>📥 Import nou</button>` + S.imports.slice().reverse().map(i=>`<div class='card'><b>${esc(i.name)}</b><div class='muted'>${i.rows.length} rânduri · ${i.date}</div></div>`).join('');
}
window.openImport = function(){
  modal('Import listă beneficiar', `<div class='field'><label>Beneficiar</label><select id='im_client'>${S.clients.map(c=>`<option value='${c.id}'>${esc(c.name)} — ${esc(c.site||'')}</option>`).join('')}</select></div><div class='field'><label>Nume import</label><input id='im_name' value='Listă beneficiar ${today()}'></div><div class='field'><label>Lipește lista</label><textarea id='im_text' placeholder='Teava PP-R D63; ml; 45\nConducta OL zincat DN25; ml; 5\nMontaj lavoar complet; buc; 3'></textarea></div><button class='btn' onclick='parseImport()'>Potrivește automat</button>`);
};
function matchProduct(text){
  const words = norm(text).split(' ').filter(Boolean);
  let best = null;
  for(const p of S.catalog){
    const hay = norm([p.code,p.name,p.desc,...(p.aliases||[])].join(' '));
    let score = 0;
    words.forEach(w=>{ if(hay.includes(w)) score++; });
    (text.match(/\d{2,3}/g)||[]).forEach(d=>{ if(hay.includes(d)) score += 2; });
    score = score / Math.max(3, words.length + 2);
    if(!best || score > best.score) best = { p, score };
  }
  return best && best.score > .18 ? best : null;
}
window.parseImport = function(){
  const rows = $('#im_text').value.split(/\n+/).map(x=>x.trim()).filter(Boolean).map(line=>{
    const parts = line.split(/\t|;|,/).map(x=>x.trim()).filter(Boolean);
    const original = parts[0] || line;
    const unit = parts.find(p=>/^(ml|buc|mp|mc|kg|set|ans|ora)$/i.test(p)) || 'buc';
    let qty = 1; parts.forEach(p=>{ const n = parseFloat(p.replace(',','.')); if(!isNaN(n) && n > 0) qty = n; });
    const m = matchProduct(original);
    return { id:id(), original, productId:m?.p.id || '', name:m?.p.name || original, domain:m?.p.domain || 'Z', unit:m?.p.unit || unit, qty, price:m?.p.price || 0, status:m ? (m.score>.55?'matched_auto':'needs_review') : 'missing_catalog_item', score:m?.score || 0 };
  });
  draftRows = rows;
  modal('Ciornă editabilă', `<div class='table'><table><thead><tr><th>Beneficiar</th><th>Produs intern</th><th>Domeniu</th><th>UM</th><th>Cant</th><th>Preț</th><th>Total</th><th>Status</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${esc(r.original)}</td><td>${esc(r.name)}</td><td>${r.domain}</td><td>${r.unit}</td><td>${r.qty}</td><td>${money(r.price)}</td><td>${money(r.qty*r.price)}</td><td><span class='pill ${r.status==='matched_auto'?'ok':r.status==='missing_catalog_item'?'bad':'warn'}'>${r.status}</span></td></tr>`).join('')}</tbody></table></div><div class='row' style='margin-top:12px'><button class='btn sec' onclick='closeModal()'>Anulează</button><button class='btn' onclick='draftToOffer()'>Creează ofertă</button></div>`);
};
window.draftToOffer = function(){
  const clientId = $('#im_client')?.value || S.clients[0]?.id || '';
  const client = S.clients.find(c=>c.id===clientId);
  const imp = { id:id(), name:$('#im_name')?.value || 'Import', date:today(), clientId, rows:draftRows };
  S.imports.push(imp);
  const offer = { id:id(), nr:new Date().getFullYear() + '/' + String(S.offers.length+1).padStart(3,'0'), date:today(), valid:addDays(today(),S.company.validDays), clientId, site:client?.site || '', subject:'Montaj instalație conform listă beneficiar', status:'draft', warranty:S.company.warranty, advance:S.company.advance, items:draftRows.map((r,i)=>({ id:id(), line:i+1, ...r })) };
  S.offers.push(offer); selectedOffer = offer.id; save(); closeModal(); page='offers'; render(); toast('Ofertă creată');
};

function offers(){
  title('Oferte', 'Ciornă editabilă + export CSV + PDF final client');
  $('#view').innerHTML = `<div class='row'><button class='btn' onclick='openImport()'>📥 Din import</button><button class='btn sec' onclick='newOffer()'>＋ Manual</button></div><div class='grid2' style='margin-top:14px'><div>${S.offers.slice().reverse().map(offerCard).join('') || '<div class="card">Nicio ofertă.</div>'}</div><div>${selectedOffer ? offerEditor(S.offers.find(o=>o.id===selectedOffer)) : '<div class="card">Selectează o ofertă.</div>'}</div></div>`;
}
function offerCard(o){ const c=S.clients.find(x=>x.id===o.clientId), t=totals(o.items); return `<div class='card row' onclick='selectOffer("${o.id}")'><div><b>Oferta ${esc(o.nr)}</b><div class='muted'>${esc(c?.name||'Fără beneficiar')} · ${esc(o.site||'')}</div></div><span class='spacer'></span><span class='pill ${o.status==='accepted'?'ok':o.status==='sent'?'warn':''}'>${o.status}</span><span class='money'>${money(t.total)}</span></div>`; }
window.selectOffer = id => { selectedOffer=id; offers(); };
window.newOffer = function(){ const c=S.clients[0]; const o={ id:id(), nr:new Date().getFullYear()+'/'+String(S.offers.length+1).padStart(3,'0'), date:today(), valid:addDays(today(),S.company.validDays), clientId:c?.id||'', site:c?.site||'', subject:'Montaj instalație conform proiect', status:'draft', warranty:S.company.warranty, advance:S.company.advance, items:[] }; S.offers.push(o); selectedOffer=o.id; save(); page='offers'; render(); };
function offerEditor(o){ const t=totals(o.items); return `<div class='card'><div class='row'><h2>${esc(o.nr)}</h2><span class='spacer'></span><button class='btn sm sec' onclick='exportCSV("${o.id}")'>Excel CSV</button><button class='btn sm' onclick='printOffer("${o.id}")'>PDF</button></div><div class='field'><label>Status</label><select onchange='offerStatus("${o.id}",this.value)'><option ${o.status==='draft'?'selected':''}>draft</option><option ${o.status==='sent'?'selected':''}>sent</option><option ${o.status==='accepted'?'selected':''}>accepted</option><option ${o.status==='rejected'?'selected':''}>rejected</option></select></div><div class='table'><table><thead><tr><th>Domeniu</th><th>Denumire</th><th>UM</th><th>Cant</th><th>Preț</th><th>Total</th></tr></thead><tbody>${(o.items||[]).map(i=>`<tr><td>${i.domain}</td><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.qty*i.price)}</td></tr>`).join('')}</tbody></table></div><p><b>Subtotal:</b> ${money(t.sub)} · <b>TVA:</b> ${money(t.vat)} · <b>Total:</b> ${money(t.total)}</p></div>`; }
window.offerStatus = function(oid,st){ const o=S.offers.find(x=>x.id===oid); o.status=st; if(st==='accepted') projectFromOffer(o); save(); offers(); };
function projectFromOffer(o){ if(S.projects.some(p=>p.offerId===o.id)) return; const c=S.clients.find(x=>x.id===o.clientId), t=totals(o.items); S.projects.push({ id:id(), offerId:o.id, clientId:o.clientId, name:(c?.site||c?.name||'Proiect')+' — '+o.nr, status:'in_lucru', start:today(), total:t.total, items:o.items.map(i=>({...i, contractedQty:+i.qty||0})) }); toast('Proiect creat'); }
window.exportCSV = function(oid){ const o=S.offers.find(x=>x.id===oid); let csv='Nr;Domeniu;Denumire;UM;Cantitate;Pret fara TVA;Total fara TVA;Total cu TVA\n'; o.items.forEach((i,k)=>csv+=`${k+1};${i.domain}. ${domainName[i.domain]};${i.name};${i.unit};${i.qty};${i.price};${i.qty*i.price};${i.qty*i.price*(1+S.company.vat/100)}\n`); download('lista-'+o.nr.replace('/','-')+'.csv',csv,'text/csv'); };
function download(name,txt,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type})); a.download=name; a.click(); }
window.printOffer = function(oid){ const o=S.offers.find(x=>x.id===oid), c=S.clients.find(x=>x.id===o.clientId)||{}, t=totals(o.items); const groups={}; o.items.forEach(i=>(groups[i.domain]=groups[i.domain]||[]).push(i)); const rows=Object.keys(groups).sort().map(d=>{const x=totals(groups[d]);return `<tr><td>${d}</td><td>${domainName[d]}</td><td>buc</td><td>1</td><td class='yellow'>${fmt(x.sub)}</td><td>${fmt(x.sub)}</td><td>${fmt(x.vat)}</td></tr>`}).join(''); $('#print').innerHTML=`<div class='print'><h2>${esc(S.company.name)}</h2><p>${esc(S.company.address)} | ${esc(S.company.phone)} | ${esc(S.company.email)}</p><div class='title'>OFERTĂ DE PREȚURI <span style='float:right'>Nr. ${esc(o.nr)} · ${o.date}</span></div><table><tr><td>Solicitant</td><td class='yellow'>${esc(c.name)}</td></tr><tr><td>Șantier</td><td class='yellow'>${esc(o.site||c.site||'')}</td></tr><tr><td>CUI</td><td class='yellow'>${esc(c.cui)}</td></tr></table><p>${esc(o.subject)}</p><table><thead><tr><th>Nr</th><th>Domeniu</th><th>UM</th><th>Cant</th><th>Preț fără TVA</th><th>Valoare fără TVA</th><th>TVA</th></tr></thead><tbody>${rows}<tr><td colspan='5'>Subtotal</td><td colspan='2'>${money(t.sub)}</td></tr><tr><td colspan='5'>TVA ${S.company.vat}%</td><td colspan='2'>${money(t.vat)}</td></tr><tr class='total'><td colspan='5'>TOTAL CU TVA</td><td colspan='2'>${money(t.total)}</td></tr></tbody></table></div>`; window.print(); };

function projects(){ title('Proiecte','Oferte acceptate transformate în proiecte'); $('#view').innerHTML = S.projects.map(p=>`<div class='card row'><div><b>${esc(p.name)}</b><div class='muted'>${p.status}</div></div><span class='spacer'></span><span class='money'>${money(p.total)}</span><button class='btn sm sec' onclick='newSituation("${p.id}")'>Situație</button><button class='btn sm' onclick='finishProject("${p.id}")'>Recepție + garanție</button></div>`).join('') || '<div class="card">Acceptă o ofertă ca să apară proiect.</div>'; }
window.newSituation = function(pid){ const p=S.projects.find(x=>x.id===pid); const n=S.situations.filter(s=>s.projectId===pid).length+1; S.situations.push({ id:id(), projectId:pid, number:n, date:today(), status:'draft', items:p.items.map(i=>({ name:i.name, unit:i.unit, contractedQty:i.contractedQty, currentQty:0, price:i.price })) }); save(); page='situations'; render(); };
function situations(){ title('Situații lucrări','Decontat anterior / executat acum / rămas'); $('#view').innerHTML = S.situations.map(s=>`<div class='card'><b>Situația ${s.number}</b><div class='table'><table><thead><tr><th>Articol</th><th>Contractat</th><th>Acum</th><th>Valoare</th></tr></thead><tbody>${s.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.contractedQty} ${i.unit}</td><td>${i.currentQty}</td><td>${money(i.currentQty*i.price)}</td></tr>`).join('')}</tbody></table></div></div>`).join('') || '<div class="card">Nicio situație.</div>'; }
window.finishProject = function(pid){ const p=S.projects.find(x=>x.id===pid); p.status='finalizat'; if(!S.warranties.some(w=>w.projectId===pid)) S.warranties.push({ id:id(), projectId:pid, clientId:p.clientId, projectName:p.name, start:today(), expires:addDays(today(),S.company.warranty*30), events:[] }); save(); projects(); toast('Garanție creată'); };
function warranties(){ title('Garanții','Active, expiră curând, expirate și intervenții'); $('#view').innerHTML = S.warranties.map(w=>{const d=left(w.expires);return `<div class='card row'><div><b>${esc(w.projectName)}</b><div class='muted'>Expiră: ${w.expires}</div></div><span class='spacer'></span><span class='pill ${d<0?'bad':d<=90?'warn':'ok'}'>${d<0?'expirată':d+' zile'}</span></div>`}).join('') || '<div class="card">Nicio garanție.</div>'; }
function expenses(){ title('Cheltuieli','Materiale, combustibil, scule, subcontractori, taxe'); $('#view').innerHTML = `<button class='btn' onclick='expenseForm()'>＋ Cheltuială</button><div class='table'><table><thead><tr><th>Data</th><th>Categorie</th><th>Total</th></tr></thead><tbody>${S.expenses.map(e=>`<tr><td>${e.date}</td><td>${esc(e.cat)}</td><td>${money(e.total)}</td></tr>`).join('')}</tbody></table></div>`; }
window.expenseForm = function(){ modal('Cheltuială nouă', `<div class='field'><label>Categorie</label><input id='ex_cat' value='Materiale'></div><div class='field'><label>Total</label><input id='ex_total' type='number'></div><button class='btn' onclick='saveExpense()'>Salvează</button>`); };
window.saveExpense = function(){ S.expenses.push({ id:id(), date:today(), cat:$('#ex_cat').value, total:+$('#ex_total').value||0 }); save(); closeModal(); expenses(); };
function profit(){ title('Profit','Ofertă vs cheltuieli'); $('#view').innerHTML = `<div class='table'><table><thead><tr><th>Proiect</th><th>Contract</th><th>Cheltuieli</th><th>Profit</th></tr></thead><tbody>${S.projects.map(p=>{const ex=S.expenses.reduce((a,e)=>a+(+e.total||0),0), pr=(+p.total||0)-ex; return `<tr><td>${esc(p.name)}</td><td>${money(p.total)}</td><td>${money(ex)}</td><td>${money(pr)}</td></tr>`}).join('')}</tbody></table></div>`; }
function settings(){ title('Setări','Date firmă, backup, reset'); const c=S.company; $('#view').innerHTML = `<div class='card'><div class='field'><label>Denumire</label><input id='co_name' value='${esc(c.name)}'></div><div class='field'><label>CUI</label><input id='co_cui' value='${esc(c.cui)}'></div><button class='btn' onclick='saveCompany()'>Salvează</button><button class='btn danger' onclick='resetAll()'>Reset</button></div>`; }
window.saveCompany = function(){ S.company.name=$('#co_name').value; S.company.cui=$('#co_cui').value; save(); toast('Salvat'); };
window.resetAll = function(){ if(confirm('Reset complet?')){ localStorage.removeItem(KEY); S=load(); render(); } };
function modal(t,b){ $('#mt').textContent=t; $('#mb').innerHTML=b; $('#modal').classList.add('open'); }
window.closeModal = function(){ $('#modal').classList.remove('open'); };
render();

const API='https://financeos-api-jaiw.onrender.com';
let authToken=localStorage.getItem('financeOS_token')||'';
let currentUser=null;
let db={transactions:[],investments:[],goals:[],catExp:[],catRec:[],subcategories:[]};
let pendingDelId=null,pendingDelGroup=null;
let currentYieldMode='manual';

async function apiFetch(method,path,body){
  setSyncing(true);
  try{
    const headers={'Content-Type':'application/json'};
    if(authToken)headers['Authorization']='Bearer '+authToken;
    const r=await fetch(API+path,{method,headers,body:body?JSON.stringify(body):undefined});
    const text=await r.text();
    const data=text?JSON.parse(text):{};
    if(!r.ok){if(r.status===401){logout();return null;}throw new Error(data.error||'Erro desconhecido');}
    setSyncing(false);return data;
  }catch(e){setSyncing(false,true);throw e;}
}
function setSyncing(on,err=false){
  const d=document.getElementById('syncDot'),l=document.getElementById('syncLabel');
  if(err){d.className='sync-dot error';l.textContent='Erro';}
  else if(on){d.className='sync-dot syncing';l.textContent='Sincronizando...';}
  else{d.className='sync-dot';l.textContent='Sincronizado';}
}
function fmt(v){return'R$ '+parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
// Exibe textos do usuário como texto puro (nunca como HTML).
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// Argumento seguro para onclick="fn(...)".
function jsArg(v){return esc(JSON.stringify(v??''));}
function fmtD(d){if(!d)return'';const[y,m,day]=d.split('-');return`${day}/${m}/${y}`;}
function toast(m,c='var(--accent)'){const t=document.getElementById('toast');t.textContent=m;t.style.background=c;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}
function showAlert(id,msg,type='error'){const el=document.getElementById(id);el.textContent=msg;el.className='auth-alert '+type;}
function hideAlert(id){const el=document.getElementById(id);el.className='auth-alert';el.textContent='';}
function markInvalid(inputId,errId){document.getElementById(inputId).classList.add('invalid');document.getElementById(errId).classList.add('show');}
function clearInvalid(inputId,errId){document.getElementById(inputId).classList.remove('invalid');document.getElementById(errId).classList.remove('show');}

function switchAuthTab(tab){
  document.getElementById('formLogin').style.display=tab==='login'?'block':'none';
  document.getElementById('formRegister').style.display=tab==='register'?'block':'none';
  document.getElementById('tabLogin').className='auth-tab'+(tab==='login'?' active':'');
  document.getElementById('tabRegister').className='auth-tab'+(tab==='register'?' active':'');
  hideAlert('loginAlert');hideAlert('registerAlert');
}
function togglePw(id,btn){const inp=document.getElementById(id);inp.type=inp.type==='password'?'text':'password';btn.textContent=inp.type==='password'?'👁':'🙈';}
function checkPwStrength(pw){
  const bar=document.getElementById('pwStrengthBar'),txt=document.getElementById('pwStrengthText');
  if(!pw){bar.style.width='0';txt.textContent='';return;}
  let score=0;
  if(pw.length>=6)score++;if(pw.length>=10)score++;
  if(/[A-Z]/.test(pw))score++;if(/[0-9]/.test(pw))score++;if(/[^A-Za-z0-9]/.test(pw))score++;
  const levels=[{c:'var(--red)',t:'Muito fraca'},{c:'var(--red)',t:'Fraca'},{c:'var(--amber)',t:'Razoável'},{c:'var(--amber)',t:'Boa'},{c:'var(--green)',t:'Forte'},{c:'var(--green)',t:'Muito forte'}];
  const l=levels[Math.min(score,5)];
  bar.style.cssText=`background:${l.c};width:${((score+1)/6*100)}%;height:4px;border-radius:2px`;
  txt.style.color=l.c;txt.textContent=l.t;
}

async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value;
  hideAlert('loginAlert');
  let valid=true;
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){markInvalid('loginEmail','loginEmailErr');valid=false;}else{clearInvalid('loginEmail','loginEmailErr');}
  if(!password){markInvalid('loginPassword','loginPasswordErr');valid=false;}else{clearInvalid('loginPassword','loginPasswordErr');}
  if(!valid)return;
  const btn=document.getElementById('btnLogin');btn.disabled=true;btn.textContent='Entrando...';
  try{
    const data=await apiFetch('POST','/auth/login',{email,password});
    if(!data){btn.disabled=false;btn.textContent='Entrar →';return;}
    authToken=data.token;currentUser=data.user;
    localStorage.setItem('financeOS_token',authToken);
    localStorage.setItem('financeOS_user',JSON.stringify(currentUser));
    await enterApp();
  }catch(e){
    showAlert('loginAlert',e.message==='Failed to fetch'?'Não foi possível conectar ao servidor.':e.message);
    btn.disabled=false;btn.textContent='Entrar →';
  }
}

async function doRegister(){
  const name=document.getElementById('regName').value.trim();
  const email=document.getElementById('regEmail').value.trim();
  const password=document.getElementById('regPassword').value;
  const password2=document.getElementById('regPassword2').value;
  hideAlert('registerAlert');
  let valid=true;
  if(!name){markInvalid('regName','regNameErr');valid=false;}else{clearInvalid('regName','regNameErr');}
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){markInvalid('regEmail','regEmailErr');valid=false;}else{clearInvalid('regEmail','regEmailErr');}
  if(!password||password.length<6){markInvalid('regPassword','regPasswordErr');valid=false;}else{clearInvalid('regPassword','regPasswordErr');}
  if(password!==password2){markInvalid('regPassword2','regPassword2Err');valid=false;}else{clearInvalid('regPassword2','regPassword2Err');}
  if(!valid)return;
  const btn=document.getElementById('btnRegister');btn.disabled=true;btn.textContent='Criando conta...';
  try{
    const data=await apiFetch('POST','/auth/register',{name,email,password});
    if(!data){btn.disabled=false;btn.textContent='Criar conta';return;}
    authToken=data.token;currentUser=data.user;
    localStorage.setItem('financeOS_token',authToken);
    localStorage.setItem('financeOS_user',JSON.stringify(currentUser));
    await enterApp();
  }catch(e){
    showAlert('registerAlert',e.message);
    btn.disabled=false;btn.textContent='Criar conta';
  }
}

async function enterApp(){
  await loadAll();
  document.getElementById('authScreen').classList.remove('visible');
  document.getElementById('app').style.display='flex';
  document.getElementById('topbarUser').innerHTML=`Olá, <strong>${esc(currentUser.name.split(' ')[0])}</strong>`;
  setCurrentPeriod();
  renderAll();
}
function logout(){
  authToken='';currentUser=null;
  localStorage.removeItem('financeOS_token');localStorage.removeItem('financeOS_user');
  db={transactions:[],investments:[],goals:[],catExp:[],catRec:[],subcategories:[]};
  document.getElementById('app').style.display='none';
  document.getElementById('authScreen').classList.add('visible');
  document.getElementById('loginEmail').value='';document.getElementById('loginPassword').value='';
  document.getElementById('btnLogin').disabled=false;document.getElementById('btnLogin').textContent='Entrar →';
  hideAlert('loginAlert');switchAuthTab('login');
}
async function tryAutoLogin(){
  if(!authToken)return;
  try{const savedUser=localStorage.getItem('financeOS_user');if(savedUser)currentUser=JSON.parse(savedUser);await enterApp();}
  catch(e){logout();}
}

async function loadAll(){
  const[txs,invs,goals,cats,subcats]=await Promise.all([
    apiFetch('GET','/transactions'),apiFetch('GET','/investments'),
    apiFetch('GET','/goals'),apiFetch('GET','/categories'),apiFetch('GET','/subcategories'),
  ]);
  db.transactions=(txs||[]).map(t=>({...t,desc:t.description}));
  db.investments=invs||[];db.goals=goals||[];
  db.catExp=(cats||[]).filter(c=>c.type==='exp');
  db.catRec=(cats||[]).filter(c=>c.type==='rec');
  db.subcategories=subcats||[];
}

// Filtro de período: um campo de ano e outro de mês (valores "AAAA" e "MM").
// Com "Todos os anos" o mês fica desativado, para não misturar o mesmo mês de anos diferentes.
function renderYearOptions(){
  const sel=document.getElementById('yearSel'),cur=sel.value;
  const years=new Set([String(new Date().getFullYear())]);
  db.transactions.forEach(t=>{if(t.date&&/^\d{4}-/.test(t.date))years.add(t.date.slice(0,4));});
  if(cur&&cur!=='all')years.add(cur);
  sel.innerHTML='<option value="all">Todos os anos</option>'+[...years].sort().reverse().map(y=>`<option value="${y}">${y}</option>`).join('');
  sel.value=cur||String(new Date().getFullYear());
  const ms=document.getElementById('monthSel');
  ms.disabled=sel.value==='all';
  if(ms.disabled)ms.value='all';
}
function setCurrentPeriod(){
  const d=new Date(),ys=document.getElementById('yearSel');
  ys.value='';renderYearOptions();ys.value=String(d.getFullYear());
  document.getElementById('monthSel').value=String(d.getMonth()+1).padStart(2,'0');
}
function filterTx(tx){
  const y=document.getElementById('yearSel').value,m=document.getElementById('monthSel').value;
  if(!y||y==='all')return tx;
  return tx.filter(t=>t.date&&t.date.slice(0,4)===y&&(m==='all'||t.date.slice(5,7)===m));
}
function showTab(id,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');btn.classList.add('active');renderAll();
}
function renderAll(){renderYearOptions();renderDashboard();renderTxTable();renderInvestments();renderGoals();renderReports();renderSettings();}

function renderDashboard(){
  const txs=filterTx(db.transactions);
  const rec=txs.filter(t=>t.type==='receita').reduce((s,t)=>s+parseFloat(t.value),0);
  const exp=txs.filter(t=>t.type==='gasto').reduce((s,t)=>s+parseFloat(t.value),0);
  const bal=rec-exp;
  const invTotal=db.investments.reduce((s,i)=>s+parseFloat(i.value||0),0);
  const invYield=db.investments.reduce((s,i)=>s+calcInvYield(i),0);
  document.getElementById('dashCards').innerHTML=`
    <div class="metric"><label>Receitas</label><div class="val pos">${fmt(rec)}</div></div>
    <div class="metric"><label>Gastos</label><div class="val neg">${fmt(exp)}</div></div>
    <div class="metric"><label>Saldo</label><div class="val ${bal>=0?'pos':'neg'}">${fmt(bal)}</div></div>
    <div class="metric"><label>Investido</label><div class="val neutral">${fmt(invTotal)}</div></div>
    <div class="metric"><label>Rendimentos</label><div class="val pos">${fmt(invYield)}</div></div>`;
  renderBarChart('expBars',txs.filter(t=>t.type==='gasto'),true);
  renderBarChart('recBars',txs.filter(t=>t.type==='receita'),false);
  document.getElementById('dashTxTable').innerHTML=buildTxRows(txs.slice(0,5),false);
}
function renderBarChart(id,txs,isExp){
  const map={};txs.forEach(t=>{map[t.category]=(map[t.category]||0)+parseFloat(t.value);});
  const sorted=Object.entries(map).sort((a,b)=>b[1]-a[1]);
  if(!sorted.length){document.getElementById(id).innerHTML='<div class="empty-state">Sem dados</div>';return;}
  const max=sorted[0][1];
  document.getElementById(id).innerHTML=sorted.map(([cat,val])=>`<div class="bar-item"><div class="bar-label">${esc(cat)}</div><div class="bar-track"><div class="bar-fill" style="width:${(val/max*100).toFixed(1)}%;background:${isExp?'var(--red)':'var(--green)'}"></div></div><div class="bar-val">${fmt(val)}</div></div>`).join('');
}
function buildTxRows(txs,actions=true){
  if(!txs.length)return'<div class="empty-state">Nenhuma transação encontrada</div>';
  return`<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th>${actions?'<th></th>':''}</tr></thead><tbody>`+
    txs.map(t=>{
      const isInst=t.installment_total>1;
      const label=t.desc||t.description||'';
      const subcat=t.subcategory?`<span style="font-size:.68rem;color:#c4b5fd"> › ${esc(t.subcategory)}</span>`:'';
      const instBadge=isInst?`<span class="badge badge-inst">${esc(t.installment_current)}/${esc(t.installment_total)}x</span> `:'';
      return`<tr>
        <td style="color:var(--muted);white-space:nowrap">${esc(fmtD(t.date))}</td>
        <td>${instBadge}${esc(label)}${subcat}${t.obs?`<br><span style="font-size:.7rem;color:var(--muted)">${esc(t.obs)}</span>`:''}</td>
        <td><span class="badge badge-cat">${esc(t.category)}</span></td>
        <td><span class="badge ${t.type==='receita'?'badge-rec':'badge-exp'}">${esc(t.type)}</span></td>
        <td style="font-weight:600;color:${t.type==='receita'?'var(--green)':'var(--red)'};white-space:nowrap">${fmt(t.value)}</td>
        ${actions?`<td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="editTx(${jsArg(t.id)})">✏️</button> <button class="btn btn-danger btn-sm" onclick="askDelTx(${jsArg(t.id)},${jsArg(t.installment_group||'')},${parseInt(t.installment_total)||1})">🗑</button></td>`:''}
      </tr>`;
    }).join('')+'</tbody></table>';
}
function renderTxTable(){
  let txs=filterTx(db.transactions);
  const ftype=document.getElementById('fType')?.value||'all';
  const fcat=document.getElementById('fCat')?.value||'all';
  const fsort=document.getElementById('fSort')?.value||'date_desc';
  if(ftype!=='all')txs=txs.filter(t=>t.type===ftype);
  if(fcat!=='all')txs=txs.filter(t=>t.category===fcat);
  txs=[...txs].sort((a,b)=>fsort==='date_desc'?b.date.localeCompare(a.date):fsort==='date_asc'?a.date.localeCompare(b.date):fsort==='val_desc'?b.value-a.value:a.value-b.value);
  const allCats=[...new Set(db.transactions.map(t=>t.category))].sort();
  const fc=document.getElementById('fCat');
  if(fc){const cur=fc.value;fc.innerHTML='<option value="all">Todas categorias</option>'+allCats.map(c=>`<option value="${esc(c)}"${c===cur?' selected':''}>${esc(c)}</option>`).join('');}
  document.getElementById('txTable').innerHTML=buildTxRows(txs,true);
}
function openModal(id){document.getElementById('modal-'+id).classList.add('open');}
function closeModal(id){document.getElementById('modal-'+id).classList.remove('open');}
function updateTxCatOptions(){
  const type=document.getElementById('txType').value;
  const cats=type==='receita'?db.catRec:db.catExp;
  document.getElementById('txCat').innerHTML=cats.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  updateSubcatOptions();
}
function updateSubcatOptions(){
  const catName=document.getElementById('txCat').value;
  const cat=[...db.catExp,...db.catRec].find(c=>c.name===catName);
  const subs=cat?db.subcategories.filter(s=>s.category_id===cat.id):[];
  document.getElementById('txSubcat').innerHTML='<option value="">— nenhuma —</option>'+subs.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
}
function toggleInstallment(){
  const on=document.getElementById('txInstallCheck').checked;
  document.getElementById('installmentFields').style.display=on?'block':'none';
  document.getElementById('noInstallFields').style.display=on?'none':'block';
  if(on){const now=new Date();document.getElementById('txInstallStart').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;updateInstallPreview();}
}
function updateInstallPreview(){
  const n=parseInt(document.getElementById('txInstallTotal').value)||0;
  const val=parseFloat(document.getElementById('txVal').value)||0;
  const start=document.getElementById('txInstallStart').value;
  if(!n||!start||!document.getElementById('txInstallCheck').checked){document.getElementById('installPreview').textContent='';return;}
  const[y,m]=start.split('-').map(Number);
  const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const last=new Date(y,m-1+n-1,1);
  document.getElementById('installPreview').textContent=`${n}x de ${fmt(val/n)} — de ${months[m-1]}/${y} até ${months[last.getMonth()]}/${last.getFullYear()}`;
}
function openTxModal(){
  document.getElementById('txEditId').value='';
  document.getElementById('txModalTitle').textContent='Nova Transação';
  document.getElementById('txType').value='gasto';
  ['txDesc','txVal','txObs'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('txDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('txInstallCheck').checked=false;document.getElementById('txInstallTotal').value=2;
  document.getElementById('installmentFields').style.display='none';document.getElementById('noInstallFields').style.display='block';
  document.getElementById('installPreview').textContent='';
  ['txValErr','txCatErr','txDateErr'].forEach(id=>document.getElementById(id).classList.remove('show'));
  ['txVal','txCat'].forEach(id=>document.getElementById(id).classList.remove('invalid'));
  updateTxCatOptions();openModal('addTx');
}
function editTx(id){
  const t=db.transactions.find(x=>x.id===id);if(!t)return;
  document.getElementById('txEditId').value=id;document.getElementById('txModalTitle').textContent='Editar Transação';
  document.getElementById('txType').value=t.type;updateTxCatOptions();
  document.getElementById('txCat').value=t.category;updateSubcatOptions();
  document.getElementById('txSubcat').value=t.subcategory||'';
  document.getElementById('txDesc').value=t.desc||t.description||'';
  document.getElementById('txVal').value=t.value;document.getElementById('txDate').value=t.date;
  document.getElementById('txObs').value=t.obs||'';
  document.getElementById('txInstallCheck').checked=false;
  document.getElementById('installmentFields').style.display='none';document.getElementById('noInstallFields').style.display='block';
  openModal('addTx');
}
async function saveTx(){
  const value=parseFloat(document.getElementById('txVal').value);
  const type=document.getElementById('txType').value;
  const category=document.getElementById('txCat').value;
  const subcategory=document.getElementById('txSubcat').value||null;
  const description=document.getElementById('txDesc').value.trim()||null;
  const obs=document.getElementById('txObs').value.trim()||null;
  const isInstall=document.getElementById('txInstallCheck').checked;
  let valid=true;
  if(!value||value<=0){markInvalid('txVal','txValErr');valid=false;}else{clearInvalid('txVal','txValErr');}
  if(!category){markInvalid('txCat','txCatErr');valid=false;}else{clearInvalid('txCat','txCatErr');}
  if(!isInstall){const date=document.getElementById('txDate').value;if(!date){document.getElementById('txDateErr').classList.add('show');valid=false;}else{document.getElementById('txDateErr').classList.remove('show');}}
  if(!valid)return;
  const eid=document.getElementById('txEditId').value;
  if(eid){
    const date=document.getElementById('txDate').value;
    try{
      await apiFetch('PATCH',`/transactions/${eid}`,{description,value,date,type,category,subcategory,obs});
      const i=db.transactions.findIndex(x=>x.id===eid);
      if(i>-1)db.transactions[i]={...db.transactions[i],description,desc:description,value,date,type,category,subcategory,obs};
      closeModal('addTx');renderAll();toast('Transação atualizada!');
    }catch(e){toast(e.message,'var(--red)');}
    return;
  }
  if(isInstall){
    const total=parseInt(document.getElementById('txInstallTotal').value)||1;
    const startVal=document.getElementById('txInstallStart').value;
    if(!startVal||total<2){toast('Informe parcelas e mês inicial','var(--red)');return;}
    const[sy,sm]=startVal.split('-').map(Number);
    const parcel=parseFloat((value/total).toFixed(2));
    const group=crypto.randomUUID();
    const rows=[];
    for(let i=0;i<total;i++){
      const d=new Date(sy,sm-1+i,1);
      rows.push({description,value:parcel,date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,type,category,subcategory,obs,installment_total:total,installment_current:i+1,installment_group:group});
    }
    try{
      const r=await apiFetch('POST','/transactions',rows);
      (r||[]).forEach(t=>db.transactions.unshift({...t,desc:t.description}));
      db.transactions.sort((a,b)=>b.date.localeCompare(a.date));
      closeModal('addTx');renderAll();toast(`${total} parcelas criadas!`);
    }catch(e){toast(e.message,'var(--red)');}
  }else{
    const date=document.getElementById('txDate').value;
    try{
      const r=await apiFetch('POST','/transactions',{description,value,date,type,category,subcategory,obs,installment_total:1,installment_current:1});
      if(r&&r[0])db.transactions.unshift({...r[0],desc:r[0].description});
      closeModal('addTx');renderAll();toast('Transação salva!');
    }catch(e){toast(e.message,'var(--red)');}
  }
}
function askDelTx(id,group,total){
  pendingDelId=id;pendingDelGroup=group;
  const isInst=total>1&&group;
  document.getElementById('delTxMsg').textContent=isInst?'Esta transação faz parte de um parcelamento. Excluir só esta parcela ou todas?':'Confirma a exclusão desta transação?';
  document.getElementById('delTxOnly').style.display=isInst?'':'none';
  document.getElementById('delTxAll').textContent=isInst?'Todas as parcelas':'Confirmar exclusão';
  openModal('delTx');
}
async function confirmDelTx(all){
  try{
    if(all&&pendingDelGroup){
      await apiFetch('DELETE',`/transactions/group/${pendingDelGroup}`);
      db.transactions=db.transactions.filter(t=>t.installment_group!==pendingDelGroup);
      toast('Parcelamento excluído','var(--amber)');
    }else{
      await apiFetch('DELETE',`/transactions/${pendingDelId}`);
      db.transactions=db.transactions.filter(t=>t.id!==pendingDelId);
      toast('Transação excluída','var(--amber)');
    }
    closeModal('delTx');renderAll();
  }catch(e){toast(e.message,'var(--red)');}
}

function setYieldMode(mode){
  currentYieldMode=mode;
  document.getElementById('yieldTabManual').className='yield-mode-tab'+(mode==='manual'?' active':'');
  document.getElementById('yieldTabPct').className='yield-mode-tab'+(mode==='pct'?' active':'');
  document.getElementById('yieldTabPctAnual').className='yield-mode-tab'+(mode==='pctAnual'?' active':'');
  document.getElementById('yieldManualFields').style.display=mode==='manual'?'block':'none';
  document.getElementById('yieldPctFields').style.display=mode==='pct'?'block':'none';
  document.getElementById('yieldPctAnualFields').style.display=mode==='pctAnual'?'block':'none';
  calcInvPreview();
}
function calcInvYield(inv){
  if(!inv.yield_mode||inv.yield_mode==='manual')return parseFloat(inv.yield||0);
  const val=parseFloat(inv.value||0);
  const rate=parseFloat(inv.yield_rate||0);
  if(!val||!rate||!inv.date)return parseFloat(inv.yield||0);
  const start=new Date(inv.date+'T12:00:00');
  const now=new Date();
  const months=(now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth());
  if(months<=0)return 0;
  if(inv.yield_mode==='pct')return parseFloat((val*Math.pow(1+rate/100,months)-val).toFixed(2));
  const monthlyRate=Math.pow(1+rate/100,1/12)-1;
  return parseFloat((val*Math.pow(1+monthlyRate,months)-val).toFixed(2));
}
function calcInvPreview(){
  const val=parseFloat(document.getElementById('invVal').value)||0;
  const date=document.getElementById('invDate').value;
  if(!val||!date){document.getElementById('invCalcPreview').style.display='none';document.getElementById('invCalcPreviewAnual').style.display='none';return;}
  const start=new Date(date+'T12:00:00');
  const now=new Date();
  const months=Math.max(0,(now.getFullYear()-start.getFullYear())*12+(now.getMonth()-start.getMonth()));
  if(currentYieldMode==='pct'){
    const rate=parseFloat(document.getElementById('invRateMes').value)||0;
    if(!rate){document.getElementById('invCalcPreview').style.display='none';return;}
    const yld=val*Math.pow(1+rate/100,months)-val;
    const el=document.getElementById('invCalcPreview');
    el.style.display='block';
    el.innerHTML=`📊 ${months} meses — Rendimento: <strong>${fmt(yld)}</strong> | Total: <strong>${fmt(val+yld)}</strong>`;
  }else if(currentYieldMode==='pctAnual'){
    const rate=parseFloat(document.getElementById('invRateAnual').value)||0;
    if(!rate){document.getElementById('invCalcPreviewAnual').style.display='none';return;}
    const monthlyRate=Math.pow(1+rate/100,1/12)-1;
    const yld=val*Math.pow(1+monthlyRate,months)-val;
    const el=document.getElementById('invCalcPreviewAnual');
    el.style.display='block';
    el.innerHTML=`📊 ${months} meses — Rendimento: <strong>${fmt(yld)}</strong> | Total: <strong>${fmt(val+yld)}</strong>`;
  }
}
function openInvModal(){
  document.getElementById('invEditId').value='';document.getElementById('invModalTitle').textContent='Novo Investimento';
  ['invName','invVal','invDate','invYield','invInst','invRateMes','invRateAnual'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('invType').value='Renda Fixa';
  ['invNameErr','invValErr'].forEach(id=>document.getElementById(id).classList.remove('show'));
  ['invName','invVal'].forEach(id=>document.getElementById(id).classList.remove('invalid'));
  document.getElementById('invCalcPreview').style.display='none';document.getElementById('invCalcPreviewAnual').style.display='none';
  setYieldMode('manual');openModal('addInv');
}
function editInv(id){
  const inv=db.investments.find(x=>x.id===id);if(!inv)return;
  document.getElementById('invEditId').value=id;document.getElementById('invModalTitle').textContent='Editar Investimento';
  document.getElementById('invName').value=inv.name;document.getElementById('invType').value=inv.type;
  document.getElementById('invVal').value=inv.value;document.getElementById('invDate').value=inv.date||'';
  document.getElementById('invInst').value=inv.institution||'';
  const mode=inv.yield_mode||'manual';
  setYieldMode(mode);
  if(mode==='manual')document.getElementById('invYield').value=inv.yield||0;
  else if(mode==='pct')document.getElementById('invRateMes').value=inv.yield_rate||'';
  else document.getElementById('invRateAnual').value=inv.yield_rate||'';
  calcInvPreview();openModal('addInv');
}
async function saveInv(){
  const name=document.getElementById('invName').value.trim();
  const type=document.getElementById('invType').value;
  const value=parseFloat(document.getElementById('invVal').value)||0;
  const date=document.getElementById('invDate').value||null;
  const institution=document.getElementById('invInst').value.trim();
  let valid=true;
  if(!name){markInvalid('invName','invNameErr');valid=false;}else{clearInvalid('invName','invNameErr');}
  if(!value){markInvalid('invVal','invValErr');valid=false;}else{clearInvalid('invVal','invValErr');}
  if(!valid)return;
  let yield_val=0,yield_mode=currentYieldMode,yield_rate=null;
  if(yield_mode==='manual')yield_val=parseFloat(document.getElementById('invYield').value)||0;
  else if(yield_mode==='pct')yield_rate=parseFloat(document.getElementById('invRateMes').value)||0;
  else yield_rate=parseFloat(document.getElementById('invRateAnual').value)||0;
  const payload={name,type,value,date,yield:yield_val,yield_mode,yield_rate,institution};
  const eid=document.getElementById('invEditId').value;
  try{
    if(eid){
      await apiFetch('PATCH',`/investments/${eid}`,payload);
      const i=db.investments.findIndex(x=>x.id===eid);if(i>-1)db.investments[i]={...db.investments[i],...payload};
    }else{
      const r=await apiFetch('POST','/investments',payload);if(r&&r[0])db.investments.unshift(r[0]);
    }
    closeModal('addInv');renderAll();toast('Investimento salvo!');
  }catch(e){toast(e.message,'var(--red)');}
}
async function delInv(id){
  if(!confirm('Remover este investimento?'))return;
  try{await apiFetch('DELETE',`/investments/${id}`);db.investments=db.investments.filter(i=>i.id!==id);renderAll();toast('Removido','var(--amber)');}catch(e){toast(e.message,'var(--red)');}
}
function renderInvestments(){
  const total=db.investments.reduce((s,i)=>s+parseFloat(i.value||0),0);
  const yields=db.investments.reduce((s,i)=>s+calcInvYield(i),0);
  const pct=total>0?((yields/total)*100).toFixed(2):0;
  document.getElementById('invSummary').innerHTML=`
    <div class="metric"><label>Total investido</label><div class="val neutral">${fmt(total)}</div></div>
    <div class="metric"><label>Rendimentos totais</label><div class="val pos">${fmt(yields)}</div></div>
    <div class="metric"><label>Patrimônio total</label><div class="val pos">${fmt(total+yields)}</div></div>
    <div class="metric"><label>Rentabilidade</label><div class="val pos">${pct}%</div></div>`;
  if(!db.investments.length){document.getElementById('invList').innerHTML='<div class="empty-state">Nenhum investimento cadastrado</div>';return;}
  document.getElementById('invList').innerHTML=db.investments.map(inv=>{
    const yld=calcInvYield(inv);
    const p=parseFloat(inv.value)>0?((yld/parseFloat(inv.value))*100).toFixed(2):0;
    const modeLabel=inv.yield_mode==='pct'?`${inv.yield_rate}% a.m.`:inv.yield_mode==='pctAnual'?`${inv.yield_rate}% a.a.`:'Manual';
    return`<div class="inv-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div><div class="inv-name">${esc(inv.name)}</div>
        <div style="display:flex;gap:.4rem;margin-top:.3rem;flex-wrap:wrap">
          <span class="inv-tag">${esc(inv.type)}</span>
          ${inv.institution?`<span class="inv-tag">${esc(inv.institution)}</span>`:''}
          <span class="inv-tag" style="color:var(--accent2);border-color:rgba(78,205,196,.3)">📊 ${esc(modeLabel)}</span>
        </div></div>
        <div style="display:flex;gap:.35rem"><button class="btn btn-ghost btn-sm" onclick="editInv(${jsArg(inv.id)})">✏️</button><button class="btn btn-danger btn-sm" onclick="delInv(${jsArg(inv.id)})">🗑</button></div>
      </div>
      <div class="inv-stats">
        <div class="inv-stat"><label>Investido</label><span>${fmt(inv.value)}</span></div>
        <div class="inv-stat"><label>Rendimento</label><span style="color:${yld>=0?'var(--green)':'var(--red)'}">${fmt(yld)}</span></div>
        <div class="inv-stat"><label>Total</label><span>${fmt(parseFloat(inv.value)+yld)}</span></div>
        <div class="inv-stat"><label>Rentab.</label><span style="color:${yld>=0?'var(--green)':'var(--red)'}">${p}%</span></div>
      </div>
      ${inv.date?`<div style="font-size:.7rem;color:var(--muted);margin-top:.6rem">Desde ${fmtD(inv.date)}</div>`:''}
    </div>`;
  }).join('');
}
function renderGoals(){
  if(!db.goals.length){document.getElementById('goalsList').innerHTML='<div class="empty-state">Nenhum objetivo cadastrado</div>';return;}
  document.getElementById('goalsList').innerHTML=db.goals.map(g=>{
    const pct=Math.min((parseFloat(g.current||0)/parseFloat(g.target))*100,100);
    return`<div class="obj-card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="obj-name">${esc(g.name)}</div>
        <div style="display:flex;align-items:center;gap:.5rem">
          <span class="obj-pct">${pct.toFixed(1)}%</span>
          <button class="btn btn-ghost btn-sm" onclick="editGoal(${jsArg(g.id)})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="delGoal(${jsArg(g.id)})">🗑</button>
        </div>
      </div>
      <div class="obj-bar-track"><div class="obj-bar-fill" style="width:${pct}%"></div></div>
      <div class="obj-meta">
        <span>${fmt(g.current||0)} de ${fmt(g.target)}</span>
        <span>Faltam ${fmt(Math.max(0,parseFloat(g.target)-parseFloat(g.current||0)))}</span>
        ${g.deadline?`<span>Prazo: ${esc(fmtD(g.deadline))}</span>`:''}
      </div>
    </div>`;
  }).join('');
}
async function saveGoal(){
  const name=document.getElementById('goalName').value.trim();
  const target=parseFloat(document.getElementById('goalTarget').value)||0;
  const current=parseFloat(document.getElementById('goalCurrent').value)||0;
  const deadline=document.getElementById('goalDeadline').value||null;
  let valid=true;
  if(!name){markInvalid('goalName','goalNameErr');valid=false;}else{clearInvalid('goalName','goalNameErr');}
  if(!target){markInvalid('goalTarget','goalTargetErr');valid=false;}else{clearInvalid('goalTarget','goalTargetErr');}
  if(!valid)return;
  try{const r=await apiFetch('POST','/goals',{name,target,current,deadline});if(r&&r[0])db.goals.push(r[0]);closeModal('addGoal');renderAll();toast('Objetivo salvo!');['goalName','goalTarget','goalCurrent','goalDeadline'].forEach(id=>document.getElementById(id).value='');}catch(e){toast(e.message,'var(--red)');}
}
async function editGoal(id){
  const g=db.goals.find(x=>x.id===id);if(!g)return;
  const nc=prompt('Valor atual (R$):',g.current||0);if(nc===null)return;
  const current=parseFloat(nc)||0;
  try{await apiFetch('PATCH',`/goals/${id}`,{current});const i=db.goals.findIndex(x=>x.id===id);if(i>-1)db.goals[i]={...g,current};renderAll();toast('Objetivo atualizado!');}catch(e){toast(e.message,'var(--red)');}
}
async function delGoal(id){
  if(!confirm('Remover objetivo?'))return;
  try{await apiFetch('DELETE',`/goals/${id}`);db.goals=db.goals.filter(g=>g.id!==id);renderAll();toast('Removido','var(--amber)');}catch(e){toast(e.message,'var(--red)');}
}
function renderReports(){
  const allTx=db.transactions,now=new Date();
  const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const mTx=filterTx(allTx);
  const mRec=mTx.filter(t=>t.type==='receita').reduce((s,t)=>s+parseFloat(t.value),0);
  const mExp=mTx.filter(t=>t.type==='gasto').reduce((s,t)=>s+parseFloat(t.value),0);
  const mBal=mRec-mExp,savRate=mRec>0?((mBal/mRec)*100).toFixed(1):0;

  // ── 12 meses de dados ─────────────────────────────
  const m12=[];
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1),m=d.getMonth(),y=d.getFullYear();
    const txM=allTx.filter(t=>{if(!t.date)return false;const td=new Date(t.date+'T12:00:00');return td.getMonth()===m&&td.getFullYear()===y;});
    m12.push({
      label:months[m]+'/'+String(y).slice(-2),
      rec:txM.filter(t=>t.type==='receita').reduce((s,t)=>s+parseFloat(t.value),0),
      exp:txM.filter(t=>t.type==='gasto').reduce((s,t)=>s+parseFloat(t.value),0)
    });
  }

  // ── GRÁFICO COMBINADO — BARRAS + LINHA DE SALDO ──
  (()=>{
    const W=700,H=280,pad={t:24,r:24,b:56,l:64};
    const cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;
    const maxV=Math.max(...m12.flatMap(e=>[e.rec,e.exp]),1);
    const saldos=m12.map(e=>e.rec-e.exp);
    const minS=Math.min(...saldos,0);
    const maxS=Math.max(...saldos,maxV);
    // usar mesma escala para barras e linha
    const scaleMax=Math.max(maxV,maxS,1);
    const scaleMin=Math.min(minS,0);
    const range=scaleMax-scaleMin||1;
    const toY=v=>pad.t+cH*(1-(v-scaleMin)/range);
    const bw=cW/m12.length;
    const bGap=bw*0.12;
    const bPair=bw-bGap*2;
    const bSingle=Math.floor(bPair/2)-1;
    let bars='',labels='',gridLines='',linePts='',dots='';
    // grid lines
    const gridVals=[0,0.25,0.5,0.75,1].map(p=>scaleMin+range*p);
    gridVals.forEach(v=>{
      const y=toY(v);
      gridLines+=`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${pad.l+cW}" y2="${y.toFixed(1)}" stroke="#2e3354" stroke-width="1"/>`;
      const lbl=Math.abs(v)>=1000?(v/1000).toFixed(1)+'k':v.toFixed(0);
      gridLines+=`<text x="${pad.l-8}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="9" fill="#a0aec0">${lbl}</text>`;
    });
    // zero line highlight
    if(scaleMin<0){
      const zy=toY(0);
      gridLines+=`<line x1="${pad.l}" y1="${zy.toFixed(1)}" x2="${pad.l+cW}" y2="${zy.toFixed(1)}" stroke="#6c63ff" stroke-width="1.5" stroke-dasharray="5,3" opacity=".5"/>`;
    }
    const baseY=toY(Math.max(scaleMin,0));
    m12.forEach((e,i)=>{
      const x=pad.l+i*bw+bGap;
      // barra receita
      const hR=Math.max(0,(e.rec-Math.max(scaleMin,0))/range*cH);
      if(hR>0)bars+=`<rect x="${x.toFixed(1)}" y="${(baseY-hR).toFixed(1)}" width="${bSingle}" height="${hR.toFixed(1)}" fill="#22c55e" rx="2" opacity=".8"/>`;
      // barra gasto
      const hE=Math.max(0,(e.exp-Math.max(scaleMin,0))/range*cH);
      if(hE>0)bars+=`<rect x="${(x+bSingle+1).toFixed(1)}" y="${(baseY-hE).toFixed(1)}" width="${bSingle}" height="${hE.toFixed(1)}" fill="#ef4444" rx="2" opacity=".8"/>`;
      // label mês
      labels+=`<text x="${(x+bSingle).toFixed(1)}" y="${(H-pad.b+16).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#a0aec0">${e.label}</text>`;
      // linha saldo
      const sx=(pad.l+(i+0.5)*bw).toFixed(1);
      const sy=toY(saldos[i]).toFixed(1);
      const col=saldos[i]>=0?'#4ecdc4':'#f87171';
      if(i>0){
        const psx=(pad.l+(i-0.5)*bw).toFixed(1);
        const psy=toY(saldos[i-1]).toFixed(1);
        linePts+=`<line x1="${psx}" y1="${psy}" x2="${sx}" y2="${sy}" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>`;
      }
      dots+=`<circle cx="${sx}" cy="${sy}" r="4" fill="${col}" stroke="#1a1d26" stroke-width="1.5"/>`;
    });
    // legenda
    const ly=H-10;
    const legend=`
      <rect x="${pad.l}" y="${ly-10}" width="10" height="10" fill="#22c55e" rx="2"/>
      <text x="${pad.l+14}" y="${ly}" font-size="10" fill="#e2e8f0">Receitas</text>
      <rect x="${pad.l+75}" y="${ly-10}" width="10" height="10" fill="#ef4444" rx="2"/>
      <text x="${pad.l+89}" y="${ly}" font-size="10" fill="#e2e8f0">Gastos</text>
      <line x1="${pad.l+155}" y1="${ly-5}" x2="${pad.l+170}" y2="${ly-5}" stroke="#4ecdc4" stroke-width="2.5"/>
      <circle cx="${pad.l+162}" cy="${ly-5}" r="3" fill="#4ecdc4"/>
      <text x="${pad.l+174}" y="${ly}" font-size="10" fill="#e2e8f0">Saldo</text>`;
    document.getElementById('rptBarChart').innerHTML=`<h4>Receitas vs Gastos + Saldo — 12 meses</h4><div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:400px;max-width:${W}px">${gridLines}${bars}${linePts}${dots}${labels}${legend}</svg></div>`;
    document.getElementById('rptLineChart').innerHTML='';
  })();

  // ── FLUXO DE CAIXA ───────────────────────────────
  document.getElementById('rptFluxo').innerHTML=`<h4>Fluxo de caixa</h4><div class="rpt-sub">${esc(periodLabel())}</div>
    <div class="trend-item"><span class="trend-month">Receitas</span><span class="trend-val" style="color:var(--green)">${fmt(mRec)}</span></div>
    <div class="trend-item"><span class="trend-month">Gastos</span><span class="trend-val" style="color:var(--red)">${fmt(mExp)}</span></div>
    <div class="trend-item"><span class="trend-month">Saldo</span><span class="trend-val" style="color:${mBal>=0?'var(--green)':'var(--red)'}">${fmt(mBal)}</span></div>
    <div class="trend-item" style="border:none"><span class="trend-month">Taxa de poupança</span><span class="trend-val" style="color:var(--accent2)">${savRate}%</span></div>`;

  // ── DISTRIBUIÇÃO INVESTIMENTOS ────────────────────
  const invMap={};db.investments.forEach(i=>{invMap[i.type]=(invMap[i.type]||0)+parseFloat(i.value||0);});
  const invS=Object.entries(invMap).sort((a,b)=>b[1]-a[1]),invMax=invS[0]?.[1]||1;
  document.getElementById('rptInvRet').innerHTML=`<h4>Distribuição de investimentos</h4>`+(invS.length?invS.map(([c,v])=>`<div class="progress-row"><div class="progress-label">${esc(c)}</div><div class="progress-track"><div class="progress-fill" style="width:${(v/invMax*100).toFixed(1)}%;background:var(--accent)"></div></div><div class="progress-pct">${fmt(v)}</div></div>`).join(''):'<div class="empty-state">Sem dados</div>');

  // ── GRÁFICOS NOVOS ───────────────────────────────
  renderCompare();renderSaldoAcum();renderTopExp();renderSubcat();renderParcelas();

  // ── TENDÊNCIA ANUAL ───────────────────────────────
  const maxVal=Math.max(...m12.flatMap(e=>[e.rec,e.exp]),1);
  document.getElementById('rptTrend').innerHTML=`<h4>Tendência anual — receitas vs gastos</h4>`+m12.map(e=>`<div class="trend-item"><span class="trend-month" style="min-width:65px">${e.label}</span><div style="flex:1;display:flex;flex-direction:column;gap:3px;padding:0 .75rem"><div class="bar-track" style="height:7px"><div class="bar-fill" style="width:${(e.rec/maxVal*100).toFixed(1)}%;background:var(--green)"></div></div><div class="bar-track" style="height:7px"><div class="bar-fill" style="width:${(e.exp/maxVal*100).toFixed(1)}%;background:var(--red)"></div></div></div><div style="display:flex;gap:.75rem;font-size:.75rem;font-weight:600"><span style="color:var(--green)">${fmt(e.rec)}</span><span style="color:var(--red)">${fmt(e.exp)}</span></div></div>`).join('');
}


// ══ RELATÓRIOS — gráficos e utilitários ══════════════
const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MES_CURTO=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CHART={grid:'#2e3354',zero:'#4a5078',axis:'#a0aec0',surface:'#1e2235',accent:'#6c63ff',amber:'#d97706'};
function ymKey(y,m){return`${y}-${String(m).padStart(2,'0')}`;}
function monthKeyOffset(offset){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);return ymKey(d.getFullYear(),d.getMonth()+1);}
function keyLabel(k){const[y,m]=k.split('-');return`${MES_CURTO[parseInt(m)-1]}/${y.slice(2)}`;}
function periodLabel(){
  const y=document.getElementById('yearSel').value,m=document.getElementById('monthSel').value;
  if(!y||y==='all')return'Todo o período';
  return m==='all'?`Ano de ${y}`:`${MESES[parseInt(m)-1]}/${y}`;
}
function signed(v){return(v>=0?'+':'−')+fmt(Math.abs(v));}
function pctTxt(p){const r=Math.round(Math.abs(p));return(r===0?'':p>0?'+':'−')+r.toLocaleString('pt-BR')+'%';}
// Marcas do eixo Y em números "redondos".
function niceTicks(min,max,count=4){
  if(min===max)max=min+1;
  const raw=(max-min)/count,mag=Math.pow(10,Math.floor(Math.log10(raw))),n=raw/mag;
  const step=(n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*mag;
  const lo=Math.floor(min/step)*step,hi=Math.ceil(max/step)*step,ticks=[];
  for(let v=lo;v<=hi+step/2;v+=step)ticks.push(Math.round(v*100)/100);
  return ticks;
}
function fmtTick(v,compact){return v===0?'0':compact?(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+'k':v.toLocaleString('pt-BR',{maximumFractionDigits:0});}
// Largura real do card (em px) para o texto do gráfico não encolher no celular.
function chartWidth(el,fallback){const w=el.clientWidth-40;return w>0?Math.max(260,w):fallback;}
// Tabela com os mesmos números do gráfico (células já escapadas).
function valuesTable(head,rows){return`<details class="rpt-table"><summary>Ver valores</summary><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;}

// Período de comparação: mês anterior, ou o ano anterior. Se o período ainda está
// em andamento, compara só até o dia de hoje nos dois lados (ex.: 1–4 nov vs 1–4 out).
function comparePeriods(){
  const y=document.getElementById('yearSel').value,m=document.getElementById('monthSel').value;
  if(!y||y==='all')return null;
  const Y=parseInt(y),now=new Date(),day=now.getDate(),md=`${String(now.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  if(m!=='all'){
    const M=parseInt(m),pY=M===1?Y-1:Y,pM=M===1?12:M-1,ck=ymKey(Y,M),pk=ymKey(pY,pM);
    const partial=ck===monthKeyOffset(0),upTo=t=>!partial||parseInt(t.date.slice(8,10))<=day;
    const lbl=(mm,yy)=>partial?`1–${day} de ${MESES[mm-1]}/${yy}`:`${MESES[mm-1]}/${yy}`;
    return{cur:t=>t.date.slice(0,7)===ck&&upTo(t),prev:t=>t.date.slice(0,7)===pk&&upTo(t),curLabel:lbl(M,Y),prevLabel:lbl(pM,pY)};
  }
  const partial=Y===now.getFullYear(),inYear=(t,yy)=>t.date.slice(0,4)===String(yy)&&(!partial||t.date.slice(5,10)<=md);
  const lbl=yy=>partial?`${yy} até ${String(day).padStart(2,'0')}/${md.slice(0,2)}`:String(yy);
  return{cur:t=>inYear(t,Y),prev:t=>inYear(t,Y-1),curLabel:lbl(Y),prevLabel:lbl(Y-1)};
}

// ── GASTOS VS PERÍODO ANTERIOR (barras divergentes por categoria) ──
function renderCompare(){
  const el=document.getElementById('rptCompare'),p=comparePeriods();
  const title='<h4>Gastos vs período anterior</h4>';
  if(!p){el.innerHTML=title+'<div class="empty-state">Escolha um ano no topo da página para comparar com o período anterior.</div>';return;}
  const cur={},prev={};
  db.transactions.forEach(t=>{
    if(t.type!=='gasto'||!t.date)return;
    const v=parseFloat(t.value||0),c=t.category||'Sem categoria';
    if(p.cur(t))cur[c]=(cur[c]||0)+v;else if(p.prev(t))prev[c]=(prev[c]||0)+v;
  });
  const sum=o=>Object.values(o).reduce((a,b)=>a+b,0),totCur=sum(cur),totPrev=sum(prev);
  const sub=`<div class="rpt-sub">${esc(p.curLabel)} comparado com ${esc(p.prevLabel)}</div>`;
  if(!totCur&&!totPrev){el.innerHTML=title+sub+'<div class="empty-state">Sem gastos nos dois períodos</div>';return;}
  const dTot=totCur-totPrev;
  const totTxt=totPrev?`${dTot>=0?'▲':'▼'} ${pctTxt(dTot/totPrev*100)} (${signed(dTot)})`:'Sem gastos no período anterior';
  const rows=[...new Set([...Object.keys(cur),...Object.keys(prev)])]
    .map(c=>({c,a:cur[c]||0,b:prev[c]||0,d:(cur[c]||0)-(prev[c]||0)}))
    .filter(r=>Math.abs(r.d)>=0.005).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
  const shown=rows.slice(0,8),rest=rows.length-shown.length,maxAbs=Math.max(...shown.map(r=>Math.abs(r.d)),1);
  const body=shown.map(r=>{
    const w=(Math.abs(r.d)/maxAbs*100).toFixed(1),bar=`<div class="cmp-bar" style="width:${w}%"></div>`;
    const pct=r.b?` (${pctTxt(r.d/r.b*100)})`:' (novo)';
    const tip=`${r.c}\n${p.curLabel}: ${fmt(r.a)}\n${p.prevLabel}: ${fmt(r.b)}\nDiferença: ${signed(r.d)}`;
    return`<div class="cmp-row" data-tip="${esc(tip)}"><div class="cmp-label">${esc(r.c)}</div><div class="cmp-track"><div class="cmp-half neg">${r.d<0?bar:''}</div><div class="cmp-half pos">${r.d>0?bar:''}</div></div><div class="cmp-val">${r.d>0?'▲':'▼'} ${signed(r.d)}${pct}</div></div>`;
  }).join('');
  el.innerHTML=title+sub+
    `<div class="rpt-summary"><span>Total: <strong>${fmt(totCur)}</strong></span><span>${esc(totTxt)}</span></div>`+
    `<div class="rpt-legend"><span><i class="sw" style="background:var(--green)"></i>▼ Gastou menos</span><span><i class="sw" style="background:var(--red)"></i>▲ Gastou mais</span></div>`+
    (body||'<div class="empty-state">Nenhuma categoria mudou</div>')+
    (rest>0?`<div class="rpt-sub rpt-foot">+ ${rest} categoria${rest>1?'s':''} com variação menor</div>`:'');
}

// ── SALDO ACUMULADO (linha, 12 meses) ──
function renderSaldoAcum(){
  const el=document.getElementById('rptSaldoAcum');
  const title='<h4>Saldo acumulado — 12 meses</h4><div class="rpt-sub">Tudo o que entrou menos tudo o que saiu, somado mês a mês desde o primeiro lançamento</div>';
  if(!db.transactions.length){el.innerHTML=title+'<div class="empty-state">Sem dados</div>';return;}
  const keys=[];for(let i=11;i>=0;i--)keys.push(monthKeyOffset(-i));
  const net={};keys.forEach(k=>net[k]=0);let opening=0;
  db.transactions.forEach(t=>{
    if(!t.date)return;
    const k=t.date.slice(0,7),v=parseFloat(t.value||0)*(t.type==='receita'?1:-1);
    if(k<keys[0])opening+=v;else if(k in net)net[k]+=v;
  });
  let acc=opening;const pts=keys.map(k=>{acc+=net[k];return{k,v:acc,net:net[k]};});
  const W=chartWidth(el,640),H=220,pad={t:18,r:16,b:28,l:58},cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;
  const vals=pts.map(p=>p.v),ticks=niceTicks(Math.min(0,...vals),Math.max(0,...vals));
  const lo=ticks[0],hi=ticks[ticks.length-1],range=hi-lo||1,compact=Math.max(Math.abs(lo),Math.abs(hi))>=10000;
  const X=i=>pad.l+i*cW/(pts.length-1),Y=v=>pad.t+cH*(1-(v-lo)/range);
  let grid='',labels='',hov='';
  ticks.forEach(t=>{const y=Y(t).toFixed(1);grid+=`<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="${t===0?CHART.zero:CHART.grid}" stroke-width="1"/><text x="${pad.l-8}" y="${(+y+3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${CHART.axis}">${fmtTick(t,compact)}</text>`;});
  const line=pts.map((p,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const base=Y(Math.min(Math.max(0,lo),hi)).toFixed(1);
  const area=`${line} L${X(pts.length-1).toFixed(1)},${base} L${X(0).toFixed(1)},${base} Z`;
  const colW=cW/(pts.length-1),step=Math.ceil(46/colW); // pula rótulos de mês se não couberem
  pts.forEach((p,i)=>{
    const x=X(i).toFixed(1),y=Y(p.v).toFixed(1);
    if((pts.length-1-i)%step===0)labels+=`<text x="${x}" y="${H-8}" text-anchor="middle" font-size="10" fill="${CHART.axis}">${keyLabel(p.k)}</text>`;
    const tip=`${keyLabel(p.k)}\nSaldo acumulado: ${fmt(p.v)}\nNo mês: ${signed(p.net)}`;
    hov+=`<g class="hov" data-tip="${esc(tip)}"><rect x="${(X(i)-colW/2).toFixed(1)}" y="${pad.t}" width="${colW.toFixed(1)}" height="${cH}" fill="transparent"/><line class="guide" x1="${x}" y1="${pad.t}" x2="${x}" y2="${pad.t+cH}" stroke="${CHART.axis}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="4" fill="${CHART.accent}" stroke="${CHART.surface}" stroke-width="2"/></g>`;
  });
  const last=pts[pts.length-1],ly=Y(last.v)-10<pad.t+4?Y(last.v)+20:Y(last.v)-10;
  const endLbl=`<text x="${(X(pts.length-1)-8).toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="end" font-size="11" font-weight="600" fill="#fff" pointer-events="none">${fmt(last.v)}</text>`;
  const ch=last.v-opening;
  el.innerHTML=title+
    `<div class="rpt-summary"><span>Saldo atual: <strong>${fmt(last.v)}</strong></span><span>Em 12 meses: <strong>${ch>=0?'▲':'▼'} ${signed(ch)}</strong></span></div>`+
    `<svg class="rpt-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo acumulado nos últimos 12 meses">${grid}<path d="${area}" fill="${CHART.accent}" fill-opacity=".1"/><path d="${line}" fill="none" stroke="${CHART.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${hov}${endLbl}${labels}</svg>`+
    valuesTable(['Mês','No mês','Acumulado'],pts.map(p=>[keyLabel(p.k),signed(p.net),fmt(p.v)]));
}

// ── MAIORES GASTOS DO PERÍODO ──
function renderTopExp(){
  const el=document.getElementById('rptTopExp');
  const title=`<h4>Maiores gastos</h4><div class="rpt-sub">${esc(periodLabel())}</div>`;
  const exp=filterTx(db.transactions).filter(t=>t.type==='gasto');
  if(!exp.length){el.innerHTML=title+'<div class="empty-state">Sem gastos no período</div>';return;}
  const tot=exp.reduce((s,t)=>s+parseFloat(t.value||0),0);
  const top=[...exp].sort((a,b)=>parseFloat(b.value)-parseFloat(a.value)).slice(0,5);
  el.innerHTML=title+top.map((t,i)=>{
    const v=parseFloat(t.value||0),share=tot?Math.round(v/tot*100):0;
    const inst=t.installment_total>1?` <span class="badge badge-inst">${esc(t.installment_current)}/${esc(t.installment_total)}x</span>`:'';
    return`<div class="top-row"><span class="top-rank">${i+1}</span><div class="top-main"><div class="top-desc">${esc(t.desc||t.description||t.category)}</div><div class="top-meta">${esc(fmtD(t.date))} · <span class="badge badge-cat">${esc(t.category)}</span>${inst}</div></div><div class="top-val">${fmt(v)}<small>${share}% dos gastos</small></div></div>`;
  }).join('');
}

// ── GASTOS POR SUBCATEGORIA (barras ordenadas) ──
function renderSubcat(){
  const el=document.getElementById('rptSubcat');
  const title=`<h4>Gastos por subcategoria</h4><div class="rpt-sub">${esc(periodLabel())}</div>`;
  const all=filterTx(db.transactions).filter(t=>t.type==='gasto'),exp=all.filter(t=>t.subcategory);
  if(!exp.length){el.innerHTML=title+'<div class="empty-state">Nenhum gasto com subcategoria neste período. As subcategorias são criadas em Configurações.</div>';return;}
  const tot=all.reduce((s,t)=>s+parseFloat(t.value||0),0),map={};
  exp.forEach(t=>{const k=t.category+'\u0000'+t.subcategory;map[k]=(map[k]||0)+parseFloat(t.value||0);});
  let rows=Object.entries(map).map(([k,v])=>{const[cat,sub]=k.split('\u0000');return{cat,sub,v};}).sort((a,b)=>b.v-a.v);
  if(rows.length>8){const tail=rows.slice(7);rows=rows.slice(0,7).concat({cat:`${tail.length} subcategorias`,sub:'Outras',v:tail.reduce((s,r)=>s+r.v,0)});}
  const max=rows[0].v||1;
  el.innerHTML=title+rows.map(r=>{
    const share=tot?Math.round(r.v/tot*100):0;
    return`<div class="sub-row" data-tip="${esc(`${r.sub} (${r.cat})\n${fmt(r.v)} · ${share}% dos gastos do período`)}"><div class="sub-label"><span>${esc(r.sub)}</span><small>${esc(r.cat)}</small></div><div class="progress-track"><div class="progress-fill" style="width:${(r.v/max*100).toFixed(1)}%;background:var(--red)"></div></div><div class="progress-pct">${fmt(r.v)}</div></div>`;
  }).join('');
}

// ── PARCELAS A VENCER (colunas, próximos 12 meses) ──
function renderParcelas(){
  const el=document.getElementById('rptParcelas');
  const title='<h4>Parcelas a vencer</h4><div class="rpt-sub">Compras parceladas a pagar a partir deste mês</div>';
  const nowK=monthKeyOffset(0);
  const fut=db.transactions.filter(t=>t.type==='gasto'&&parseInt(t.installment_total)>1&&t.date&&t.date.slice(0,7)>=nowK);
  if(!fut.length){el.innerHTML=title+'<div class="empty-state">Nenhuma parcela a vencer</div>';return;}
  const keys=[];for(let i=0;i<12;i++)keys.push(monthKeyOffset(i));
  const by={};keys.forEach(k=>by[k]={v:0,n:0});
  fut.forEach(t=>{const b=by[t.date.slice(0,7)];if(b){b.v+=parseFloat(t.value||0);b.n++;}});
  const total=fut.reduce((s,t)=>s+parseFloat(t.value||0),0);
  const groups=new Set(fut.map(t=>t.installment_group||t.id)).size;
  const lastK=fut.map(t=>t.date.slice(0,7)).sort().pop();
  const W=chartWidth(el,420),H=190,pad={t:20,r:8,b:28,l:52},cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;
  const maxV=Math.max(...keys.map(k=>by[k].v),1),ticks=niceTicks(0,maxV,3),hi=ticks[ticks.length-1];
  const compact=hi>=10000,band=cW/keys.length,bw=Math.max(4,Math.min(24,band-6)),baseY=pad.t+cH;
  const maxK=keys.reduce((a,k)=>by[k].v>by[a].v?k:a,keys[0]);
  let grid='',bars='',labels='';
  ticks.forEach(t=>{const y=(pad.t+cH*(1-t/hi)).toFixed(1);grid+=`<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="${CHART.grid}" stroke-width="1"/><text x="${pad.l-8}" y="${(+y+3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${CHART.axis}">${fmtTick(t,compact)}</text>`;});
  const step=Math.ceil(46/band); // pula rótulos de mês se não couberem
  keys.forEach((k,i)=>{
    const {v,n}=by[k],h=v/hi*cH,x=pad.l+i*band+(band-bw)/2,cx=(pad.l+i*band+band/2).toFixed(1);
    if(i%step===0)labels+=`<text x="${cx}" y="${H-8}" text-anchor="middle" font-size="10" fill="${CHART.axis}">${keyLabel(k)}</text>`;
    let mark='';
    if(h>0){
      const y=baseY-h,r=Math.min(4,h,bw/2);
      mark=`<path d="M${x.toFixed(1)},${baseY} L${x.toFixed(1)},${(y+r).toFixed(1)} Q${x.toFixed(1)},${y.toFixed(1)} ${(x+r).toFixed(1)},${y.toFixed(1)} L${(x+bw-r).toFixed(1)},${y.toFixed(1)} Q${(x+bw).toFixed(1)},${y.toFixed(1)} ${(x+bw).toFixed(1)},${(y+r).toFixed(1)} L${(x+bw).toFixed(1)},${baseY} Z" fill="${CHART.amber}"/>`;
      if(k===maxK)mark+=`<text x="${cx}" y="${(y-6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="#fff">R$ ${fmtTick(Math.round(v),v>=10000)}</text>`;
    }
    const tip=`${keyLabel(k)}\n${v?`${fmt(v)} em ${n} parcela${n>1?'s':''}`:'Nenhuma parcela'}`;
    bars+=`<g class="hov" data-tip="${esc(tip)}"><rect x="${(pad.l+i*band).toFixed(1)}" y="${pad.t}" width="${band.toFixed(1)}" height="${cH}" fill="transparent"/>${mark}</g>`;
  });
  el.innerHTML=title+
    `<div class="rpt-summary"><span>A pagar: <strong>${fmt(total)}</strong></span><span><strong>${groups}</strong> parcelamento${groups>1?'s':''}</span><span>Última parcela: <strong>${keyLabel(lastK)}</strong></span></div>`+
    `<svg class="rpt-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Parcelas a vencer nos próximos 12 meses">${grid}${bars}${labels}</svg>`+
    valuesTable(['Mês','Valor','Parcelas'],keys.filter(k=>by[k].v).map(k=>[keyLabel(k),fmt(by[k].v),String(by[k].n)]));
}

// Dica flutuante dos gráficos: qualquer elemento com data-tip.
function initChartTips(){
  const tip=document.createElement('div');tip.id='chartTip';document.body.appendChild(tip);
  const move=e=>{const r=tip.getBoundingClientRect();let x=e.clientX+14,y=e.clientY+14;if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;if(y+r.height>innerHeight-8)y=e.clientY-r.height-14;tip.style.left=x+'px';tip.style.top=y+'px';};
  document.addEventListener('mouseover',e=>{const el=e.target.closest&&e.target.closest('[data-tip]');if(el){tip.textContent=el.getAttribute('data-tip');tip.classList.add('show');move(e);}else tip.classList.remove('show');});
  document.addEventListener('mousemove',e=>{if(tip.classList.contains('show'))move(e);});
  document.addEventListener('mouseleave',()=>tip.classList.remove('show'));
}

function renderSettings(){
  const allCats=[...db.catExp,...db.catRec];
  const makeList=(cats,isExp)=>!cats.length?'<div class="empty-state">Sem categorias</div>':`<table><tbody>`+cats.map(c=>`<tr><td style="color:#fff">${esc(c.name)}</td><td style="text-align:right"><button class="btn btn-danger btn-sm" onclick="delCat(${jsArg(c.id)},'${isExp?'exp':'rec'}')">🗑</button></td></tr>`).join('')+'</tbody></table>';
  document.getElementById('catExpList').innerHTML=makeList(db.catExp,true);
  document.getElementById('catRecList').innerHTML=makeList(db.catRec,false);
  const sf=document.getElementById('subcatFilter'),curSF=sf.value;
  sf.innerHTML='<option value="">Todas as categorias</option>'+allCats.map(c=>`<option value="${esc(c.id)}"${c.id===curSF?' selected':''}>${esc(c.name)} (${db.catExp.find(x=>x.id===c.id)?'gasto':'receita'})</option>`).join('');
  renderSubcatList();
  document.getElementById('newSubcatCat').innerHTML=allCats.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}
function renderSubcatList(){
  const catId=document.getElementById('subcatFilter').value;
  const subs=catId?db.subcategories.filter(s=>s.category_id===catId):db.subcategories;
  const allCats=[...db.catExp,...db.catRec];
  if(!subs.length){document.getElementById('subcatList').innerHTML='<div class="empty-state">Nenhuma subcategoria cadastrada</div>';return;}
  document.getElementById('subcatList').innerHTML=`<table><thead><tr><th>Subcategoria</th><th>Categoria</th><th></th></tr></thead><tbody>`+
    subs.map(s=>{const cat=allCats.find(c=>c.id===s.category_id);return`<tr><td style="color:#fff">${esc(s.name)}</td><td><span class="badge badge-cat">${cat?esc(cat.name):'—'}</span></td><td style="text-align:right"><button class="btn btn-danger btn-sm" onclick="delSubcat(${jsArg(s.id)})">🗑</button></td></tr>`;}).join('')+'</tbody></table>';
}
async function saveCat(type){
  const inputId=type==='exp'?'newCatExpName':'newCatRecName';
  const name=document.getElementById(inputId).value.trim();
  if(!name){toast('Digite o nome','var(--red)');return;}
  try{const r=await apiFetch('POST','/categories',{name,type});if(r&&r[0]){if(type==='exp')db.catExp.push(r[0]);else db.catRec.push(r[0]);}closeModal(type==='exp'?'addCatExp':'addCatRec');renderAll();toast('Categoria criada!');document.getElementById(inputId).value='';}catch(e){toast(e.message,'var(--red)');}
}
async function delCat(id,type){
  if(!confirm('Remover esta categoria?'))return;
  try{await apiFetch('DELETE',`/categories/${id}`);if(type==='exp')db.catExp=db.catExp.filter(c=>c.id!==id);else db.catRec=db.catRec.filter(c=>c.id!==id);db.subcategories=db.subcategories.filter(s=>s.category_id!==id);renderAll();toast('Removida','var(--amber)');}catch(e){toast(e.message,'var(--red)');}
}
async function saveSubcat(){
  const catId=document.getElementById('newSubcatCat').value;
  const name=document.getElementById('newSubcatName').value.trim();
  if(!catId||!name){toast('Preencha categoria e nome','var(--red)');return;}
  try{const r=await apiFetch('POST','/subcategories',{category_id:catId,name});if(r&&r[0])db.subcategories.push(r[0]);closeModal('addSubcat');renderAll();toast('Subcategoria criada!');document.getElementById('newSubcatName').value='';}catch(e){toast(e.message,'var(--red)');}
}
async function delSubcat(id){
  if(!confirm('Remover esta subcategoria?'))return;
  try{await apiFetch('DELETE',`/subcategories/${id}`);db.subcategories=db.subcategories.filter(s=>s.id!==id);renderSubcatList();toast('Removida','var(--amber)');}catch(e){toast(e.message,'var(--red)');}
}
async function changePassword(){
  const current_password=document.getElementById('oldPw').value;
  const new_password=document.getElementById('newPw1').value;
  const confirm_password=document.getElementById('newPw2').value;
  const msg=document.getElementById('pwChangeMsg');
  if(!current_password||!new_password){msg.style.color='var(--red)';msg.textContent='Preencha todos os campos';return;}
  if(new_password.length<6){msg.style.color='var(--red)';msg.textContent='A nova senha deve ter no mínimo 6 caracteres';return;}
  if(new_password!==confirm_password){msg.style.color='var(--red)';msg.textContent='As senhas não conferem';return;}
  try{
    await apiFetch('PATCH','/auth/password',{current_password,new_password});
    msg.style.color='var(--green)';msg.textContent='Senha alterada com sucesso!';
    ['oldPw','newPw1','newPw2'].forEach(id=>document.getElementById(id).value='');
    setTimeout(()=>msg.textContent='',3000);
  }catch(e){msg.style.color='var(--red)';msg.textContent=e.message;}
}
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.modal-bg').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});});
  initChartTips();
  // Redesenha os relatórios ao redimensionar a janela (os gráficos usam a largura real do card).
  let rptResize;window.addEventListener('resize',()=>{clearTimeout(rptResize);rptResize=setTimeout(()=>{if(document.getElementById('tab-reports').classList.contains('active'))renderReports();},150);});
  tryAutoLogin();
});

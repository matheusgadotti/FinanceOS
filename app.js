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
  document.getElementById('topbarUser').innerHTML=`Olá, <strong>${currentUser.name.split(' ')[0]}</strong>`;
  document.getElementById('monthSel').value=new Date().getMonth().toString();
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

function getMonthFilter(){const v=document.getElementById('monthSel').value;return v==='all'?null:parseInt(v);}
function filterTx(tx){const m=getMonthFilter();if(m===null)return tx;return tx.filter(t=>{if(!t.date)return false;return new Date(t.date+'T12:00:00').getMonth()===m;});}
function showTab(id,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');btn.classList.add('active');renderAll();
}
function renderAll(){renderDashboard();renderTxTable();renderInvestments();renderGoals();renderReports();renderSettings();}

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
  document.getElementById(id).innerHTML=sorted.map(([cat,val])=>`<div class="bar-item"><div class="bar-label">${cat}</div><div class="bar-track"><div class="bar-fill" style="width:${(val/max*100).toFixed(1)}%;background:${isExp?'var(--red)':'var(--green)'}"></div></div><div class="bar-val">${fmt(val)}</div></div>`).join('');
}
function buildTxRows(txs,actions=true){
  if(!txs.length)return'<div class="empty-state">Nenhuma transação encontrada</div>';
  return`<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th>${actions?'<th></th>':''}</tr></thead><tbody>`+
    txs.map(t=>{
      const isInst=t.installment_total>1;
      const label=t.desc||t.description||'';
      const subcat=t.subcategory?`<span style="font-size:.68rem;color:#c4b5fd"> › ${t.subcategory}</span>`:'';
      const instBadge=isInst?`<span class="badge badge-inst">${t.installment_current}/${t.installment_total}x</span> `:'';
      return`<tr>
        <td style="color:var(--muted);white-space:nowrap">${fmtD(t.date)}</td>
        <td>${instBadge}${label}${subcat}${t.obs?`<br><span style="font-size:.7rem;color:var(--muted)">${t.obs}</span>`:''}</td>
        <td><span class="badge badge-cat">${t.category}</span></td>
        <td><span class="badge ${t.type==='receita'?'badge-rec':'badge-exp'}">${t.type}</span></td>
        <td style="font-weight:600;color:${t.type==='receita'?'var(--green)':'var(--red)'};white-space:nowrap">${fmt(t.value)}</td>
        ${actions?`<td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="editTx('${t.id}')">✏️</button> <button class="btn btn-danger btn-sm" onclick="askDelTx('${t.id}','${t.installment_group||''}',${t.installment_total||1})">🗑</button></td>`:''}
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
  if(fc){const cur=fc.value;fc.innerHTML='<option value="all">Todas categorias</option>'+allCats.map(c=>`<option value="${c}"${c===cur?' selected':''}>${c}</option>`).join('');}
  document.getElementById('txTable').innerHTML=buildTxRows(txs,true);
}
function openModal(id){document.getElementById('modal-'+id).classList.add('open');}
function closeModal(id){document.getElementById('modal-'+id).classList.remove('open');}
function updateTxCatOptions(){
  const type=document.getElementById('txType').value;
  const cats=type==='receita'?db.catRec:db.catExp;
  document.getElementById('txCat').innerHTML=cats.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  updateSubcatOptions();
}
function updateSubcatOptions(){
  const catName=document.getElementById('txCat').value;
  const cat=[...db.catExp,...db.catRec].find(c=>c.name===catName);
  const subs=cat?db.subcategories.filter(s=>s.category_id===cat.id):[];
  document.getElementById('txSubcat').innerHTML='<option value="">— nenhuma —</option>'+subs.map(s=>`<option value="${s.name}">${s.name}</option>`).join('');
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
        <div><div class="inv-name">${inv.name}</div>
        <div style="display:flex;gap:.4rem;margin-top:.3rem;flex-wrap:wrap">
          <span class="inv-tag">${inv.type}</span>
          ${inv.institution?`<span class="inv-tag">${inv.institution}</span>`:''}
          <span class="inv-tag" style="color:var(--accent2);border-color:rgba(78,205,196,.3)">📊 ${modeLabel}</span>
        </div></div>
        <div style="display:flex;gap:.35rem"><button class="btn btn-ghost btn-sm" onclick="editInv('${inv.id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="delInv('${inv.id}')">🗑</button></div>
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
        <div class="obj-name">${g.name}</div>
        <div style="display:flex;align-items:center;gap:.5rem">
          <span class="obj-pct">${pct.toFixed(1)}%</span>
          <button class="btn btn-ghost btn-sm" onclick="editGoal('${g.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="delGoal('${g.id}')">🗑</button>
        </div>
      </div>
      <div class="obj-bar-track"><div class="obj-bar-fill" style="width:${pct}%"></div></div>
      <div class="obj-meta">
        <span>${fmt(g.current||0)} de ${fmt(g.target)}</span>
        <span>Faltam ${fmt(Math.max(0,parseFloat(g.target)-parseFloat(g.current||0)))}</span>
        ${g.deadline?`<span>Prazo: ${fmtD(g.deadline)}</span>`:''}
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

  // ── GRÁFICO DE BARRAS AGRUPADAS (12 meses) ────────
  (()=>{
    const W=700,H=220,pad={t:20,r:20,b:50,l:60};
    const cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;
    const maxV=Math.max(...m12.flatMap(e=>[e.rec,e.exp]),1);
    const bw=Math.floor(cW/m12.length);
    const gap=4,bPair=bw-gap;
    const bSingle=Math.floor(bPair/2)-1;
    let bars='',labels='',gridLines='';
    // grid
    [0,0.25,0.5,0.75,1].forEach(p=>{
      const y=pad.t+cH*(1-p);
      const v=maxV*p;
      gridLines+=`<line x1="${pad.l}" y1="${y}" x2="${pad.l+cW}" y2="${y}" stroke="#2e3354" stroke-width="1"/>`;
      gridLines+=`<text x="${pad.l-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#a0aec0">${v>=1000?(v/1000).toFixed(0)+'k':v.toFixed(0)}</text>`;
    });
    m12.forEach((e,i)=>{
      const x=pad.l+i*bw+gap/2;
      const hR=e.rec>0?Math.max(2,(e.rec/maxV)*cH):0;
      const hE=e.exp>0?Math.max(2,(e.exp/maxV)*cH):0;
      bars+=`<rect x="${x}" y="${pad.t+cH-hR}" width="${bSingle}" height="${hR}" fill="#22c55e" rx="2" opacity=".85"/>`;
      bars+=`<rect x="${x+bSingle+1}" y="${pad.t+cH-hE}" width="${bSingle}" height="${hE}" fill="#ef4444" rx="2" opacity=".85"/>`;
      labels+=`<text x="${x+bSingle}" y="${H-pad.b+14}" text-anchor="middle" font-size="8.5" fill="#a0aec0">${e.label}</text>`;
    });
    const legend=`<rect x="${pad.l}" y="${H-12}" width="10" height="10" fill="#22c55e" rx="2"/><text x="${pad.l+14}" y="${H-4}" font-size="10" fill="#e2e8f0">Receitas</text><rect x="${pad.l+80}" y="${H-12}" width="10" height="10" fill="#ef4444" rx="2"/><text x="${pad.l+94}" y="${H-4}" font-size="10" fill="#e2e8f0">Gastos</text>`;
    document.getElementById('rptBarChart').innerHTML=`<h4>Receitas vs Gastos — 12 meses</h4><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px">${gridLines}${bars}${labels}${legend}</svg>`;
  })();

  // ── GRÁFICO DE LINHA — SALDO ACUMULADO ───────────
  (()=>{
    const W=700,H=180,pad={t:20,r:20,b:40,l:60};
    const cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;
    const saldos=m12.map(e=>e.rec-e.exp);
    const minS=Math.min(...saldos,0),maxS=Math.max(...saldos,1);
    const range=maxS-minS||1;
    const toY=v=>pad.t+cH*(1-(v-minS)/range);
    const toX=i=>pad.l+(i/(m12.length-1||1))*cW;
    let pts='',dots='',labels='',gridLines='';
    // zero line
    const zeroY=toY(0);
    gridLines+=`<line x1="${pad.l}" y1="${zeroY}" x2="${pad.l+cW}" y2="${zeroY}" stroke="#6c63ff" stroke-width="1" stroke-dasharray="4,3" opacity=".4"/>`;
    [minS,0,maxS].filter((v,i,a)=>a.indexOf(v)===i).forEach(v=>{
      const y=toY(v);
      gridLines+=`<line x1="${pad.l}" y1="${y}" x2="${pad.l+cW}" y2="${y}" stroke="#2e3354" stroke-width="1"/>`;
      gridLines+=`<text x="${pad.l-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#a0aec0">${v>=0?'':'-'}${Math.abs(v)>=1000?(Math.abs(v)/1000).toFixed(0)+'k':Math.abs(v).toFixed(0)}</text>`;
    });
    saldos.forEach((s,i)=>{
      const x=toX(i),y=toY(s);
      if(i>0){const px=toX(i-1),py=toY(saldos[i-1]);pts+=`<line x1="${px}" y1="${py}" x2="${x}" y2="${y}" stroke="${s>=0?'#4ecdc4':'#ef4444'}" stroke-width="2"/>`;}
      dots+=`<circle cx="${x}" cy="${y}" r="3.5" fill="${s>=0?'#4ecdc4':'#ef4444'}" stroke="#1a1d26" stroke-width="1.5"/>`;
      labels+=`<text x="${x}" y="${H-pad.b+14}" text-anchor="middle" font-size="8.5" fill="#a0aec0">${m12[i].label}</text>`;
    });
    document.getElementById('rptLineChart').innerHTML=`<h4>Saldo mensal</h4><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px">${gridLines}${pts}${dots}${labels}</svg>`;
  })();

  // ── FLUXO DE CAIXA ───────────────────────────────
  document.getElementById('rptFluxo').innerHTML=`<h4>Fluxo de caixa</h4>
    <div class="trend-item"><span class="trend-month">Receitas</span><span class="trend-val" style="color:var(--green)">${fmt(mRec)}</span></div>
    <div class="trend-item"><span class="trend-month">Gastos</span><span class="trend-val" style="color:var(--red)">${fmt(mExp)}</span></div>
    <div class="trend-item"><span class="trend-month">Saldo</span><span class="trend-val" style="color:${mBal>=0?'var(--green)':'var(--red)'}">${fmt(mBal)}</span></div>
    <div class="trend-item" style="border:none"><span class="trend-month">Taxa de poupança</span><span class="trend-val" style="color:var(--accent2)">${savRate}%</span></div>`;

  // ── EVOLUÇÃO 6 MESES ─────────────────────────────
  const evo=m12.slice(-6);
  document.getElementById('rptEvo').innerHTML=`<h4>Evolução mensal (6 meses)</h4>`+evo.map(e=>`<div class="trend-item"><span class="trend-month">${e.label}</span><div style="display:flex;gap:1rem"><span class="trend-val" style="color:var(--green)">${fmt(e.rec)}</span><span class="trend-val" style="color:var(--red)">${fmt(e.exp)}</span></div></div>`).join('');

  // ── GASTOS POR CATEGORIA ─────────────────────────
  const expMap={};mTx.filter(t=>t.type==='gasto').forEach(t=>{expMap[t.category]=(expMap[t.category]||0)+parseFloat(t.value);});
  const expS=Object.entries(expMap).sort((a,b)=>b[1]-a[1]),expMax=expS[0]?.[1]||1;
  document.getElementById('rptCatExp').innerHTML=`<h4>Gastos por categoria</h4>`+(expS.length?expS.map(([c,v])=>`<div class="progress-row"><div class="progress-label">${c}</div><div class="progress-track"><div class="progress-fill" style="width:${(v/expMax*100).toFixed(1)}%;background:var(--red)"></div></div><div class="progress-pct">${fmt(v)}</div></div>`).join(''):'<div class="empty-state">Sem dados</div>');

  // ── RECEITAS POR CATEGORIA ────────────────────────
  const recMap={};mTx.filter(t=>t.type==='receita').forEach(t=>{recMap[t.category]=(recMap[t.category]||0)+parseFloat(t.value);});
  const recS=Object.entries(recMap).sort((a,b)=>b[1]-a[1]),recMax=recS[0]?.[1]||1;
  document.getElementById('rptCatRec').innerHTML=`<h4>Receitas por categoria</h4>`+(recS.length?recS.map(([c,v])=>`<div class="progress-row"><div class="progress-label">${c}</div><div class="progress-track"><div class="progress-fill" style="width:${(v/recMax*100).toFixed(1)}%;background:var(--green)"></div></div><div class="progress-pct">${fmt(v)}</div></div>`).join(''):'<div class="empty-state">Sem dados</div>');

  // ── DISTRIBUIÇÃO INVESTIMENTOS ────────────────────
  const invMap={};db.investments.forEach(i=>{invMap[i.type]=(invMap[i.type]||0)+parseFloat(i.value||0);});
  const invS=Object.entries(invMap).sort((a,b)=>b[1]-a[1]),invMax=invS[0]?.[1]||1;
  document.getElementById('rptInvRet').innerHTML=`<h4>Distribuição de investimentos</h4>`+(invS.length?invS.map(([c,v])=>`<div class="progress-row"><div class="progress-label">${c}</div><div class="progress-track"><div class="progress-fill" style="width:${(v/invMax*100).toFixed(1)}%;background:var(--accent)"></div></div><div class="progress-pct">${fmt(v)}</div></div>`).join(''):'<div class="empty-state">Sem dados</div>');

  // ── DONUT — GASTOS VS RECEITAS ────────────────────
  (()=>{
    const total=mRec+mExp;
    if(!total){document.getElementById('rptDonut').innerHTML='<h4>Proporção receitas vs gastos</h4><div class="empty-state">Sem dados</div>';return;}
    const R=70,cx=90,cy=90,stroke=22;
    const pctRec=mRec/total,pctExp=mExp/total;
    const circ=2*Math.PI*R;
    const dRec=circ*pctRec,dExp=circ*pctExp;
    const recArc=`stroke-dasharray="${dRec} ${circ}" stroke-dashoffset="0"`;
    const expArc=`stroke-dasharray="${dExp} ${circ}" stroke-dashoffset="${-dRec}"`;
    const svg=`<svg viewBox="0 0 200 180" style="width:160px;flex-shrink:0">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#22263a" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#22c55e" stroke-width="${stroke}" ${recArc} transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#ef4444" stroke-width="${stroke}" ${expArc} transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
      <text x="${cx}" y="${cy-8}" text-anchor="middle" font-size="11" fill="#a0aec0">Saldo</text>
      <text x="${cx}" y="${cy+10}" text-anchor="middle" font-size="13" font-weight="bold" fill="${mBal>=0?'#22c55e':'#ef4444'}">${fmt(mBal)}</text>
    </svg>`;
    const legend=`<div style="display:flex;flex-direction:column;gap:.6rem;justify-content:center">
      <div><div style="width:10px;height:10px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:.4rem"></div><span style="font-size:.78rem;color:#a0aec0">Receitas</span><div style="font-size:.9rem;font-weight:600;color:#22c55e;margin-left:1rem">${fmt(mRec)} (${(pctRec*100).toFixed(0)}%)</div></div>
      <div><div style="width:10px;height:10px;background:#ef4444;border-radius:50%;display:inline-block;margin-right:.4rem"></div><span style="font-size:.78rem;color:#a0aec0">Gastos</span><div style="font-size:.9rem;font-weight:600;color:#ef4444;margin-left:1rem">${fmt(mExp)} (${(pctExp*100).toFixed(0)}%)</div></div>
    </div>`;
    document.getElementById('rptDonut').innerHTML=`<h4>Proporção receitas vs gastos</h4><div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">${svg}${legend}</div>`;
  })();

  // ── TENDÊNCIA ANUAL ───────────────────────────────
  const maxVal=Math.max(...m12.flatMap(e=>[e.rec,e.exp]),1);
  document.getElementById('rptTrend').innerHTML=`<h4>Tendência anual — receitas vs gastos</h4>`+m12.map(e=>`<div class="trend-item"><span class="trend-month" style="min-width:65px">${e.label}</span><div style="flex:1;display:flex;flex-direction:column;gap:3px;padding:0 .75rem"><div class="bar-track" style="height:7px"><div class="bar-fill" style="width:${(e.rec/maxVal*100).toFixed(1)}%;background:var(--green)"></div></div><div class="bar-track" style="height:7px"><div class="bar-fill" style="width:${(e.exp/maxVal*100).toFixed(1)}%;background:var(--red)"></div></div></div><div style="display:flex;gap:.75rem;font-size:.75rem;font-weight:600"><span style="color:var(--green)">${fmt(e.rec)}</span><span style="color:var(--red)">${fmt(e.exp)}</span></div></div>`).join('');
}


function renderSettings(){
  const allCats=[...db.catExp,...db.catRec];
  const makeList=(cats,isExp)=>!cats.length?'<div class="empty-state">Sem categorias</div>':`<table><tbody>`+cats.map(c=>`<tr><td style="color:#fff">${c.name}</td><td style="text-align:right"><button class="btn btn-danger btn-sm" onclick="delCat('${c.id}','${isExp?'exp':'rec'}')">🗑</button></td></tr>`).join('')+'</tbody></table>';
  document.getElementById('catExpList').innerHTML=makeList(db.catExp,true);
  document.getElementById('catRecList').innerHTML=makeList(db.catRec,false);
  const sf=document.getElementById('subcatFilter'),curSF=sf.value;
  sf.innerHTML='<option value="">Todas as categorias</option>'+allCats.map(c=>`<option value="${c.id}"${c.id===curSF?' selected':''}>${c.name} (${db.catExp.find(x=>x.id===c.id)?'gasto':'receita'})</option>`).join('');
  renderSubcatList();
  document.getElementById('newSubcatCat').innerHTML=allCats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}
function renderSubcatList(){
  const catId=document.getElementById('subcatFilter').value;
  const subs=catId?db.subcategories.filter(s=>s.category_id===catId):db.subcategories;
  const allCats=[...db.catExp,...db.catRec];
  if(!subs.length){document.getElementById('subcatList').innerHTML='<div class="empty-state">Nenhuma subcategoria cadastrada</div>';return;}
  document.getElementById('subcatList').innerHTML=`<table><thead><tr><th>Subcategoria</th><th>Categoria</th><th></th></tr></thead><tbody>`+
    subs.map(s=>{const cat=allCats.find(c=>c.id===s.category_id);return`<tr><td style="color:#fff">${s.name}</td><td><span class="badge badge-cat">${cat?cat.name:'—'}</span></td><td style="text-align:right"><button class="btn btn-danger btn-sm" onclick="delSubcat('${s.id}')">🗑</button></td></tr>`;}).join('')+'</tbody></table>';
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
  tryAutoLogin();
});

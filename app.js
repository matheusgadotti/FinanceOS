const API='https://financeos-api-jaiw.onrender.com';
let authToken=localStorage.getItem('financeOS_token')||'';
let currentUser=null;
let db={transactions:[],investments:[],goals:[],catExp:[],catRec:[],subcategories:[],contribs:[],contribsOk:true,invMoves:[],invMovesOk:true};
let pendingDelId=null,pendingDelGroup=null;

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
  db={transactions:[],investments:[],goals:[],catExp:[],catRec:[],subcategories:[],contribs:[],contribsOk:true,invMoves:[],invMovesOk:true};goalUI.panel={};goalUI.newOpen=false;invUI.panel={};invUI.newOpen=false;
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
  const[txs,invs,goals,cats,subcats,contribs,invMovesRes]=await Promise.all([
    apiFetch('GET','/transactions'),apiFetch('GET','/investments'),
    apiFetch('GET','/goals'),apiFetch('GET','/categories'),apiFetch('GET','/subcategories'),
    apiFetch('GET','/goal-contributions').catch(()=>null), // opcional: a tabela de aportes pode ainda não existir
    apiFetch('GET','/investment-movements').catch(()=>null), // opcional: idem para aportes/resgates de investimentos
  ]);
  db.contribs=contribs||[];db.contribsOk=Array.isArray(contribs);
  db.invMoves=invMovesRes||[];db.invMovesOk=Array.isArray(invMovesRes);
  if(!db.contribsOk||!db.invMovesOk)setSyncing(false);
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
  const inv=invPortfolio(); // só investimentos ativos
  document.getElementById('dashCards').innerHTML=`
    <div class="metric"><label>Receitas</label><div class="val pos">${fmt(rec)}</div></div>
    <div class="metric"><label>Gastos</label><div class="val neg">${fmt(exp)}</div></div>
    <div class="metric"><label>Saldo</label><div class="val ${bal>=0?'pos':'neg'}">${fmt(bal)}</div></div>
    <div class="metric"><label>Investido</label><div class="val neutral">${fmt(inv.net)}</div></div>
    <div class="metric"><label>Rendimentos</label><div class="val ${signClass(inv.yld)}">${signed(inv.yld)}</div></div>`;
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

// ══ INVESTIMENTOS ══════════════════════════════════════
// Tudo na própria página (sem popups). O campo "value" guarda o total líquido aplicado
// (aplicação inicial + aportes − resgates); o backend mantém isso a cada movimentação.
const INV_TYPES=['Renda Fixa','Renda Variável','Fundo Imobiliário','Ações','Cripto','Poupança','Outro'];
const INV_MODES=[['pctAnual','Taxa ao ano'],['pct','Taxa ao mês'],['manual','Valor atual (manual)']];
const invUI={panel:{},confirmMove:null,newOpen:false};
function signClass(v){return v>0.005?'pos':v<-0.005?'neg':'';}
function fmtPctBR(p,sign=false){return(sign&&p>0.005?'+':p<-0.005?'−':'')+Math.abs(p).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';}
function rateTxt(v){return(parseFloat(v)||0).toLocaleString('pt-BR',{maximumFractionDigits:4});}
function invById(id){return db.investments.find(x=>x.id===id);}
function invMoves(id){return db.invMoves.filter(m=>m.investment_id===id);}
// Crescimento por dias corridos: (1+taxa)^(dias/365,25) ao ano ou (1+taxa)^(dias/30,44) ao mês.
function invGrowth(inv,days){
  const r=(parseFloat(inv.yield_rate)||0)/100;
  if(days<=0||!r)return 1;
  return Math.pow(1+r,days/(inv.yield_mode==='pct'?30.4375:365.25));
}
function daysBetween(fromISO,to){return Math.max(0,Math.floor((to-parseISO(fromISO))/DAY_MS));}

// Números de um investimento. Cada aporte rende a partir da própria data; resgates entram como valor negativo.
function invCalc(inv,moves=invMoves(inv.id),at=null){
  const now=at?parseISO(at):(()=>{const d=new Date();d.setHours(12,0,0,0);return d;})();
  const net=r2(parseFloat(inv.value)||0);
  const sumMoves=r2(moves.reduce((s,m)=>s+parseFloat(m.amount),0));
  const initial=r2(net-sumMoves);
  const totalIn=r2(initial+moves.filter(m=>parseFloat(m.amount)>0).reduce((s,m)=>s+parseFloat(m.amount),0));
  const mode=inv.yield_mode||'manual';
  let balance,needsDate=false;
  if(mode==='manual'){balance=r2(net+(parseFloat(inv.yield)||0));}
  else{
    needsDate=!inv.date;
    const upTo=moves.filter(m=>!at||String(m.date).slice(0,10)<=at);
    balance=r2((inv.date?initial*invGrowth(inv,daysBetween(inv.date,now)):initial)+
      upTo.reduce((s,m)=>s+parseFloat(m.amount)*invGrowth(inv,daysBetween(m.date,now)),0));
    if(at)return{balance};
  }
  const yld=r2(balance-net),closed=moves.length>0&&Math.abs(balance)<0.05;
  // Encerrado: percentual sobre tudo que foi aplicado. Ativo: sobre o que ainda está aplicado.
  const base=closed||net<=0.005?totalIn:net,pct=base>0?yld/base*100:0;
  const closedAt=closed?moves.filter(m=>parseFloat(m.amount)<0).map(m=>String(m.date).slice(0,10)).sort().pop():null;
  return{net,initial,totalIn,balance:closed?0:balance,yld,pct,closed,closedAt,needsDate,mode};
}
// ── Imposto de renda e IOF (estimativa) ──
// IR pela tabela regressiva sobre o rendimento: até 180 dias 22,5%; 181 a 360 dias 20%; 361 a 720 dias 17,5%; acima de 720 dias 15%.
// IOF sobre o rendimento em resgates com menos de 30 dias da aplicação (de 96% no 1º dia a 0% no 30º).
// Cada aplicação/aporte conta o prazo desde a própria data; resgates consomem as aplicações mais antigas primeiro.
const IOF_TABLE=[96,93,90,86,83,80,76,73,70,66,63,60,56,53,50,46,43,40,36,33,30,26,23,20,16,13,10,6,3];
const TAX_MODES=[['','Automático'],['regressiva','Tabela regressiva (CDB, Tesouro, LC, fundos)'],['isento','Isento (LCI, LCA, CRI, CRA, poupança)'],['nenhum','Não calcular (ações, FII, cripto)']];
const TAX_LABEL={regressiva:'tabela regressiva',isento:'isento',nenhum:'não calcular'};
function irRate(days){return days<=180?.225:days<=360?.20:days<=720?.175:.15;}
function iofRate(days){return days>=1&&days<30?IOF_TABLE[days-1]/100:0;}
function isoDays(a,b){return Math.max(0,Math.round((parseISO(b)-parseISO(a))/DAY_MS));}
// Regime de imposto: o escolhido pelo usuário ou, se não houver, deduzido do tipo e do nome.
function taxMode(inv){
  if(inv.tax_mode)return inv.tax_mode;
  const n=inv.name||'';
  if(/\b(LCI|LCA|CRI|CRA)\b/i.test(n)||/incentivad|poupan/i.test(n)||inv.type==='Poupança')return'isento';
  return inv.type==='Renda Fixa'?'regressiva':'nenhum';
}
function taxOn(gain,lotDate,at){
  if(!(gain>0))return{ir:0,iof:0};
  const d=isoDays(lotDate,at),iof=gain*iofRate(d);
  return{ir:(gain-iof)*irRate(d),iof};
}
// Monta os lotes (aplicação inicial e aportes) e aplica os resgates nos mais antigos primeiro.
function invTaxSim(inv,c,moves){
  const today=todayISO(),grow=c.mode!=='manual',evs=[];
  if(c.initial>0.005)evs.push({date:inv.date||today,amount:c.initial,ord:0,created:''});
  moves.forEach(m=>evs.push({date:String(m.date).slice(0,10),amount:parseFloat(m.amount),id:m.id,ord:1,created:String(m.created_at||'')}));
  evs.sort((a,b)=>a.date.localeCompare(b.date)||a.ord-b.ord||a.created.localeCompare(b.created));
  const lots=[],paid={};
  for(const ev of evs){
    if(ev.amount>0){lots.push({date:ev.date,p:ev.amount,a:ev.amount});continue;}
    let R=-ev.amount,ir=0,iof=0;
    for(const L of lots){
      if(R<=1e-9)break;if(L.p<=1e-9)continue;
      const V=grow?L.p*invGrowth(inv,isoDays(L.date,ev.date)):L.p,take=Math.min(R,V),prin=L.p*take/V;
      if(grow){const t=taxOn(take-prin,L.date,ev.date);ir+=t.ir;iof+=t.iof;}
      L.p-=prin;R-=take;
    }
    paid[ev.id]={ir:r2(ir),iof:r2(iof)};
  }
  return{lots,paid};
}
// Imposto estimado de um resgate bruto R na data "at".
function invTaxFor(inv,c,sim,R,at){
  if(taxMode(inv)!=='regressiva'||!(R>0)||c.closed)return{ir:0,iof:0};
  let ir=0,iof=0;
  if(c.mode==='manual'){
    // Valor manual: o ganho é repartido entre as aplicações proporcionalmente ao valor de cada uma.
    const live=sim.lots.filter(L=>L.p>0.005),P=live.reduce((s,L)=>s+L.p,0),f=c.balance>0?Math.min(1,R/c.balance):0;
    if(P>0&&c.yld>0)live.forEach(L=>{const t=taxOn(c.yld*f*L.p/P,L.date,at);ir+=t.ir;iof+=t.iof;});
  }else{
    let left=R;
    for(const L of sim.lots){
      if(left<=1e-9)break;if(L.p<=1e-9)continue;
      const V=L.p*invGrowth(inv,isoDays(L.date,at)),take=Math.min(left,V),prin=L.p*take/V;
      const t=taxOn(take-prin,L.date,at);ir+=t.ir;iof+=t.iof;left-=take;
    }
  }
  return{ir:r2(ir),iof:r2(iof)};
}
// Valor bruto a resgatar para receber "netAmt" líquido (busca binária: o imposto cresce junto com o valor).
function invGrossForNet(inv,c,sim,netAmt,at){
  const bal=c.mode==='manual'?c.balance:invCalc(inv,invMoves(inv.id),at).balance;
  const netOf=R=>{const t=invTaxFor(inv,c,sim,R,at);return R-t.ir-t.iof;};
  if(netOf(bal)<netAmt-0.005)return null;
  let lo=netAmt,hi=bal;
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(netOf(mid)<netAmt)lo=mid;else hi=mid;}
  return Math.min(r2(bal),Math.ceil(hi*100-1e-6)/100);
}
function invTaxInfo(inv,c){
  const tm=taxMode(inv),sim=invTaxSim(inv,c,invMoves(inv.id));
  const n=invTaxFor(inv,c,sim,c.balance,todayISO()),now={...n,net:r2(c.balance-n.ir-n.iof)};
  let closed={ir:0,iof:0};
  if(c.closed&&tm==='regressiva'){
    if(c.mode!=='manual')Object.values(sim.paid).forEach(t=>{closed.ir+=t.ir;closed.iof+=t.iof;});
    else{const T=sim.lots.reduce((s,L)=>s+L.a,0);if(T>0&&c.yld>0)sim.lots.forEach(L=>{const t=taxOn(c.yld*L.a/T,L.date,c.closedAt);closed.ir+=t.ir;closed.iof+=t.iof;});}
    closed={ir:r2(closed.ir),iof:r2(closed.iof)};
  }
  return{tm,auto:!inv.tax_mode,sim,now,closed,paid:tm==='regressiva'&&c.mode!=='manual'?sim.paid:{}};
}

// Totais da carteira (só investimentos ativos) — usados também no Dashboard e nos Relatórios.
function invPortfolio(){
  const all=db.investments.map(inv=>{const c=invCalc(inv);return{inv,c,t:invTaxInfo(inv,c)};});
  const active=all.filter(x=>!x.c.closed),closed=all.filter(x=>x.c.closed);
  const sum=(arr,f)=>r2(arr.reduce((s,x)=>s+f(x),0));
  const net=sum(active,x=>x.c.net),balance=sum(active,x=>x.c.balance),yld=sum(active,x=>x.c.yld);
  const netAfterTax=sum(active,x=>x.t.now.net),realized=sum(closed,x=>x.c.yld),realizedTax=sum(closed,x=>x.t.closed.ir+x.t.closed.iof);
  return{all,active,closed,net,balance,yld,pct:net>0?yld/net*100:0,realized,realizedTax,netAfterTax,taxNow:r2(balance-netAfterTax)};
}

function renderInvestments(){
  db.taxColOk=!db.investments.length||db.investments.some(i=>'tax_mode' in i); // coluna da migração 003 existe?
  const p=invPortfolio();
  document.getElementById('invSummary').innerHTML=!p.all.length?'':`
    <div class="metric"><label>Total aplicado</label><div class="val neutral">${fmt(p.net)}</div></div>
    <div class="metric"><label>Patrimônio atual</label><div class="val">${fmt(p.balance)}</div>${p.taxNow>0.005?`<div class="metric-sub">≈ ${fmt(p.netAfterTax)} líquido de IR/IOF</div>`:''}</div>
    <div class="metric"><label>Rendimento</label><div class="val ${signClass(p.yld)}">${signed(p.yld)}</div></div>
    <div class="metric"><label>Rentabilidade</label><div class="val ${signClass(p.yld)}">${fmtPctBR(p.pct,true)}</div></div>
    ${p.closed.length?`<div class="metric"><label>Resultado dos encerrados</label><div class="val ${signClass(p.realized)}">${signed(p.realized)}</div>${p.realizedTax>0.005?`<div class="metric-sub">≈ ${signed(r2(p.realized-p.realizedTax))} líquido</div>`:''}</div>`:''}`;
  document.getElementById('invNotice').innerHTML=db.invMovesOk?'':'<div class="goal-notice">Aportes e resgates ainda não estão ativos no banco de dados. Por enquanto, para colocar mais dinheiro, altere o valor aplicado em ✏️ Editar.</div>';
  document.getElementById('invNew').classList.toggle('open',invUI.newOpen);
  const el=document.getElementById('invList');
  if(!p.all.length){
    el.innerHTML=invUI.newOpen?'':'<div class="empty-state">Nenhum investimento cadastrado.<br><button class="btn btn-primary btn-sm" style="margin-top:.85rem" onclick="toggleNewInv(true)">+ Adicionar o primeiro</button></div>';
    return;
  }
  // Agrupa por tipo, do maior para o menor patrimônio.
  const groups={};p.active.forEach(x=>{(groups[x.inv.type||'Outro']=groups[x.inv.type||'Outro']||[]).push(x);});
  const gl=Object.entries(groups).map(([type,items])=>({type,items:items.sort((a,b)=>b.c.balance-a.c.balance),total:r2(items.reduce((s,x)=>s+x.c.balance,0))})).sort((a,b)=>b.total-a.total);
  let html=gl.map(g=>{
    const share=p.balance>0?Math.max(0,g.total/p.balance*100):0;
    return`<div class="inv-group">
      <div class="inv-group-head"><span class="inv-group-name">${esc(g.type)}</span><span class="inv-group-meta">${fmt(g.total)} · ${share.toLocaleString('pt-BR',{maximumFractionDigits:1})}% da carteira</span></div>
      <div class="inv-share"><div style="width:${share.toFixed(1)}%"></div></div>
      <div class="goal-grid">${g.items.map(invCard).join('')}</div>
    </div>`;
  }).join('');
  if(!p.active.length)html='<div class="empty-state">Todos os investimentos foram resgatados.</div>';
  if(p.closed.length)html+=`<div class="goal-section-title">Encerrados (${p.closed.length})</div><div class="goal-grid">${p.closed.map(invCard).join('')}</div>`;
  el.innerHTML=html;
}

function invCard({inv,c,t}){
  const id=jsArg(inv.id),k=gk(inv.id),panel=invUI.panel[inv.id],moves=invMoves(inv.id);
  let modeTag;
  if(c.mode==='pctAnual')modeTag=`<span class="inv-tag rate">${rateTxt(inv.yield_rate)}% a.a.</span>`;
  else if(c.mode==='pct')modeTag=`<span class="inv-tag rate">${rateTxt(inv.yield_rate)}% a.m.</span>`;
  else if(c.closed)modeTag='';
  else if(inv.value_updated_at){
    const d=daysBetween(inv.value_updated_at,new Date());
    modeTag=`<span class="inv-tag${d>30&&!c.closed?' warn':''}" title="Valor atual informado manualmente">Atualizado ${d===0?'hoje':d===1?'ontem':`há ${d} dias`}</span>`;
  }else modeTag='<span class="inv-tag">Valor manual</span>';
  const since=inv.date?`Desde ${esc(fmtD(inv.date))}`:'';
  const closedTax=r2(t.closed.ir+t.closed.iof),nowTax=r2(t.now.ir+t.now.iof);
  const sub=c.closed?`Encerrado em ${esc(fmtD(c.closedAt))} · resultado bruto <strong>${signed(c.yld)}</strong> (${fmtPctBR(c.pct,true)})${closedTax>0?` · líquido ≈ <strong>${signed(r2(c.yld-closedTax))}</strong>`:''}`:since;
  const taxHint=t.auto?'Definido automaticamente pelo tipo e pelo nome. Altere em ✏️ Editar.':'Imposto de renda';
  const taxTag=t.tm==='isento'?`<span class="inv-tag" title="${taxHint}">Isento de IR</span>`:t.tm==='regressiva'?`<span class="inv-tag" title="${taxHint}">IR regressivo</span>`:'';
  const taxLine=!c.closed&&nowTax>0?`<div class="inv-tax">Resgatando tudo hoje: <strong>≈ ${fmt(t.now.net)}</strong> líquido <span>(IR ${fmt(t.now.ir)}${t.now.iof>0?` + IOF ${fmt(t.now.iof)}`:''})</span></div>`:'';
  const warn=c.needsDate&&!c.closed?`<div class="inv-warn">⚠ Informe a data da aplicação para calcular o rendimento. <button class="link-btn" onclick="invPanel(${id},'edit')">Editar</button></div>`:'';
  const ok=db.invMovesOk;
  return`<div class="goal-card inv-card2${c.closed?' is-closed':''}">
    <div class="goal-head"><div class="goal-name">${esc(inv.name)}</div>${c.closed?'<span class="goal-status idle">Encerrado</span>':''}</div>
    <div class="inv-tags">${inv.institution?`<span class="inv-tag">${esc(inv.institution)}</span>`:''}${modeTag}${taxTag}</div>
    ${c.closed?'':`<div class="inv-stats">
      <div class="inv-stat"><label>Aplicado</label><span>${fmt(c.net)}</span></div>
      <div class="inv-stat"><label>Valor atual</label><span>${fmt(c.balance)}</span></div>
      <div class="inv-stat"><label>Rendimento</label><span class="${signClass(c.yld)}">${c.yld>0.005?'▲ ':c.yld<-0.005?'▼ ':''}${signed(c.yld)}</span></div>
      <div class="inv-stat"><label>Rentab.</label><span class="${signClass(c.yld)}">${fmtPctBR(c.pct,true)}</span></div>
    </div>`}
    ${taxLine}${sub?`<div class="inv-sub">${sub}</div>`:''}${warn}
    <div class="goal-btns">
      ${ok?`<button class="btn btn-primary btn-sm${panel==='in'?' active':''}" onclick="invPanel(${id},'in')">+ Aportar</button>`:''}
      ${ok&&!c.closed?`<button class="btn btn-ghost btn-sm${panel==='out'?' active':''}" onclick="invPanel(${id},'out')"${c.balance>0?'':' disabled'}>− Resgatar</button>`:''}
      ${c.mode==='manual'&&!c.closed?`<button class="btn btn-ghost btn-sm${panel==='update'?' active':''}" onclick="invPanel(${id},'update')">Atualizar valor</button>`:''}
      ${ok?`<button class="btn btn-ghost btn-sm${panel==='history'?' active':''}" onclick="invPanel(${id},'history')">Histórico (${moves.length+1})</button>`:''}
      <span class="goal-btns-right"><button class="btn btn-ghost btn-sm${panel==='edit'?' active':''}" onclick="invPanel(${id},'edit')" title="Editar" aria-label="Editar investimento">✏️</button><button class="btn btn-danger btn-sm${panel==='delete'?' active':''}" onclick="invPanel(${id},'delete')" title="Excluir" aria-label="Excluir investimento">🗑</button></span>
    </div>
    ${panel?`<div class="goal-panel">${invPanelHTML(inv,c,panel,id,k,moves,t)}</div>`:''}
  </div>`;
}

function invPanelHTML(inv,c,panel,id,k,moves,t){
  const key=e=>`onkeydown="invKey(event,${id},()=>${e})"`;
  if(panel==='in'||panel==='out'){
    const isIn=panel==='in',sign=isIn?1:-1,taxed=!isIn&&t.tm==='regressiva',prev=isIn?'':`invMovePreview(${id})`;
    const chips=isIn?[100,500,1000].map(v=>`<button type="button" class="chip" onclick="setInvAmount(${jsArg(k)},${v},false,${id})">+ ${fmt(v)}</button>`).join('')
      :`<button type="button" class="chip" onclick="setInvAmount(${jsArg(k)},${c.balance},true,${id})">Tudo (${fmt(c.balance)}${taxed?' bruto':''})</button>`;
    return`<div class="goal-panel-title">${isIn?'Aportar (colocar mais dinheiro)':'Resgatar (tirar dinheiro)'}</div>
      ${taxed?`<div class="yield-mode-tabs net-tabs" id="imNetTabs-${k}" data-net="0"><button type="button" class="yield-mode-tab active" data-net="0" onclick="invSetNetMode(${jsArg(k)},0,${id})">Valor bruto (sai do investimento)</button><button type="button" class="yield-mode-tab" data-net="1" onclick="invSetNetMode(${jsArg(k)},1,${id})">Valor líquido (cai na conta)</button></div>`:''}
      <div class="goal-chips">${chips}</div>
      <div class="form-row">
        <div class="mfg"><label id="imAmountLabel-${k}">Valor (R$)</label><input type="number" id="imAmount-${k}" step="0.01" min="0.01" inputmode="decimal" placeholder="0,00" oninput="this.dataset.all='';${prev}" ${key(`invMove(${id},${sign})`)}></div>
        <div class="mfg"><label>Data</label><input type="date" id="imDate-${k}" value="${todayISO()}" oninput="${prev}" ${key(`invMove(${id},${sign})`)}></div>
      </div>
      <div class="mfg"><label>Observação <span class="info-tag">opcional</span></label><input type="text" id="imNote-${k}" maxlength="200" placeholder="${isIn?'Ex: aporte mensal':'Ex: resgate para a viagem'}" ${key(`invMove(${id},${sign})`)}></div>
      ${!isIn?`<div class="inv-tax-prev" id="imTax-${k}"></div>`:''}
      ${!isIn?'<div class="goal-hint">Resgatando o valor total, o investimento é encerrado e vai para “Encerrados”, com o resultado final.</div>':''}
      <div class="goal-err" id="imErr-${k}"></div>
      <div class="goal-actions"><button class="btn btn-ghost btn-sm" onclick="invPanel(${id},null)">Cancelar</button><button class="btn ${isIn?'btn-primary':'btn-ghost'} btn-sm" id="imBtn-${k}" onclick="invMove(${id},${sign})">${isIn?'Aportar':'Resgatar'}</button></div>`;
  }
  if(panel==='update'){
    return`<div class="goal-panel-title">Atualizar valor atual</div>
      <div class="goal-hint">Informe quanto o investimento vale hoje (o valor que aparece no app do banco ou da corretora).</div>
      <div class="mfg"><label>Valor atual (R$)</label><input type="number" id="iuValue-${k}" step="0.01" min="0" inputmode="decimal" value="${c.balance.toFixed(2)}" oninput="invUpdatePreview(${id})" ${key(`invSaveValue(${id})`)}></div>
      <div class="goal-hint" id="iuPrev-${k}"></div>
      <div class="goal-err" id="iuErr-${k}"></div>
      <div class="goal-actions"><button class="btn btn-ghost btn-sm" onclick="invPanel(${id},null)">Cancelar</button><button class="btn btn-primary btn-sm" onclick="invSaveValue(${id})">Salvar</button></div>`;
  }
  if(panel==='history'){
    const rows=moves.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.created_at).localeCompare(String(a.created_at))).map(m=>{
      const a=parseFloat(m.amount),mid=jsArg(m.id);
      if(invUI.confirmMove===m.id)return`<div class="hist-row confirm"><span>Excluir ${a>=0?'este aporte':'este resgate'} de ${fmt(Math.abs(a))}?</span><span><button class="btn btn-ghost btn-sm" onclick="confirmInvMove(null)">Não</button> <button class="btn btn-danger btn-sm" onclick="delInvMove(${mid},${id})">Excluir</button></span></div>`;
      const tx=t.paid[m.id],txv=tx?r2(tx.ir+tx.iof):0;
      return`<div class="hist-row"><span class="hist-date">${esc(fmtD(String(m.date).slice(0,10)))}</span><span class="hist-amt">${a>=0?'▲ Aporte':'▼ Resgate'} ${fmt(Math.abs(a))}</span><span class="hist-note">${txv>0?`<span class="hist-tax">IR${tx.iof>0?'+IOF':''} ≈ ${fmt(txv)}</span> `:''}${esc(m.note||'')}</span><button class="hist-del" onclick="confirmInvMove(${mid})" title="Excluir" aria-label="Excluir movimentação">✕</button></div>`;
    }).join('');
    const first=`<div class="hist-row"><span class="hist-date">${inv.date?esc(fmtD(inv.date)):'—'}</span><span class="hist-amt">● Aplicação inicial ${fmt(c.initial)}</span><span class="hist-note"></span><span></span></div>`;
    return`<div class="goal-panel-title">Movimentações</div><div class="goal-hist">${rows}${first}</div>`;
  }
  if(panel==='edit')return invFormHTML('ie'+k,inv,c,id);
  if(panel==='delete'){
    return`<div class="goal-panel-title">Excluir “${esc(inv.name)}”?</div>
      <div class="goal-hint">O investimento e todas as movimentações serão apagados. ${c.closed?'':'Se você só tirou o dinheiro, prefira “− Resgatar”: assim o resultado fica guardado. '}Essa ação não pode ser desfeita.</div>
      <div class="goal-actions"><button class="btn btn-ghost btn-sm" onclick="invPanel(${id},null)">Cancelar</button><button class="btn btn-sm btn-danger-solid" onclick="deleteInv(${id})">Excluir investimento</button></div>`;
  }
  return'';
}

// Formulário de criar/editar (o mesmo nos dois casos). p = prefixo dos ids.
function invFormHTML(p,inv,c,id){
  const edit=!!inv,mode=inv?(inv.yield_mode||'manual'):'pctAnual',hasMoves=edit&&invMoves(inv.id).length>0;
  const types=INV_TYPES.concat(inv&&inv.type&&!INV_TYPES.includes(inv.type)?[inv.type]:[]);
  const v=(x)=>x==null?'':esc(x);
  const submit=edit?`saveInvForm(${jsArg(p)},${id})`:`saveInvForm(${jsArg(p)},null)`;
  const enter=`onkeydown="if(event.key==='Enter'){event.preventDefault();${submit.replace(/"/g,'&quot;')}}${edit?'':`if(event.key==='Escape')toggleNewInv(false)`}"`;
  return`<div class="inv-form" id="${p}Form" data-mode="${mode}">
    <div class="goal-panel-title">${edit?'Editar investimento':'Novo investimento'}</div>
    <div class="mfg"><label>Nome</label><input type="text" id="${p}Name" maxlength="150" placeholder="Ex: Tesouro Selic 2029, CDB Banco X, PETR4..." value="${v(inv&&inv.name)}" oninput="invFormPreview(${jsArg(p)})" ${enter}></div>
    <div class="form-row">
      <div class="mfg"><label>Tipo</label><select id="${p}Type" onchange="invFormPreview(${jsArg(p)})">${types.map(t=>`<option${(inv?inv.type:'Renda Fixa')===t?' selected':''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="mfg"><label>Instituição <span class="info-tag">opcional</span></label><input type="text" id="${p}Inst" maxlength="150" placeholder="Ex: Nubank, XP..." value="${v(inv&&inv.institution)}" ${enter}></div>
    </div>
    <div class="mfg"><label>Imposto de renda</label><select id="${p}Tax" onchange="invFormPreview(${jsArg(p)})">${TAX_MODES.map(([val,l])=>`<option value="${val}"${((inv&&inv.tax_mode)||'')===val?' selected':''}>${l}</option>`).join('')}</select>${db.taxColOk?'':'<div class="goal-hint" style="margin-top:.35rem">Para salvar essa escolha, rode o SQL 003 no Supabase. Até lá, vale o automático.</div>'}</div>
    <div class="form-row">
      <div class="mfg"><label>${hasMoves?'Aplicação inicial (R$)':'Valor aplicado (R$)'}</label><input type="number" id="${p}Value" step="0.01" min="0.01" inputmode="decimal" placeholder="0,00" value="${edit?c.initial.toFixed(2):''}" oninput="invFormPreview(${jsArg(p)})" ${enter}></div>
      <div class="mfg"><label>Data da aplicação</label><input type="date" id="${p}Date" value="${edit?v(inv.date):todayISO()}" oninput="invFormPreview(${jsArg(p)})" ${enter}></div>
    </div>
    ${hasMoves?'<div class="goal-hint" style="margin-top:-.35rem">Aportes e resgates ficam no histórico e não precisam ser somados aqui.</div>':''}
    <div class="mfg"><label>Como acompanhar o rendimento</label>
      <div class="yield-mode-tabs">${INV_MODES.map(([m,l])=>`<button type="button" class="yield-mode-tab${m===mode?' active':''}" data-m="${m}" onclick="invSetMode(${jsArg(p)},'${m}')">${l}</button>`).join('')}</div>
    </div>
    <div class="mfg" id="${p}RateBox"${mode==='manual'?' style="display:none"':''}><label id="${p}RateLabel">${mode==='pct'?'Taxa (% ao mês)':'Taxa (% ao ano)'}</label><input type="number" id="${p}Rate" step="0.0001" min="0" inputmode="decimal" placeholder="${mode==='pct'?'Ex: 0,9':'Ex: 11,25'}" value="${edit&&mode!=='manual'?v(inv.yield_rate):''}" oninput="invFormPreview(${jsArg(p)})" ${enter}></div>
    <div class="mfg" id="${p}CurBox"${mode==='manual'?'':' style="display:none"'}><label>Valor atual hoje (R$) <span class="info-tag">opcional</span></label><input type="number" id="${p}Cur" step="0.01" min="0" inputmode="decimal" placeholder="Igual ao aplicado" value="${edit&&mode==='manual'?c.balance.toFixed(2):''}" data-orig="${edit&&mode==='manual'?c.balance.toFixed(2):''}" oninput="invFormPreview(${jsArg(p)})" ${enter}></div>
    <div class="calc-preview" id="${p}Prev" style="display:none"></div>
    <div class="goal-err" id="${p}Err"></div>
    <div class="goal-actions"><button class="btn btn-ghost btn-sm" onclick="${edit?`invPanel(${id},null)`:'toggleNewInv(false)'}">Cancelar</button><button class="btn btn-primary btn-sm" id="${p}Btn" onclick="${submit}">${edit?'Salvar':'Adicionar investimento'}</button></div>
  </div>`;
}
function invSetMode(p,mode){
  const f=document.getElementById(p+'Form');f.dataset.mode=mode;
  f.querySelectorAll('.yield-mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.m===mode));
  document.getElementById(p+'RateBox').style.display=mode==='manual'?'none':'';
  document.getElementById(p+'CurBox').style.display=mode==='manual'?'':'none';
  document.getElementById(p+'RateLabel').textContent=mode==='pct'?'Taxa (% ao mês)':'Taxa (% ao ano)';
  document.getElementById(p+'Rate').placeholder=mode==='pct'?'Ex: 0,9':'Ex: 11,25';
  invFormPreview(p);
}
// Lê o formulário e devolve o objeto do investimento (ou um erro).
function readInvForm(p,orig){
  const g=s=>document.getElementById(p+s);
  const mode=g('Form').dataset.mode,name=g('Name').value.trim(),initial=r2(parseFloat(g('Value').value)),date=g('Date').value||null;
  const rate=parseFloat(g('Rate').value),curRaw=g('Cur').value;
  const moves=orig?invMoves(orig.id):[],sumMoves=r2(moves.reduce((s,m)=>s+parseFloat(m.amount),0));
  const value=r2((initial||0)+sumMoves);
  const out={name,type:g('Type').value,institution:g('Inst').value.trim(),tax_mode:g('Tax').value||null,value,date,yield_mode:mode,
    yield_rate:mode==='manual'?null:(isNaN(rate)?null:rate),yield:mode==='manual'?(orig&&orig.yield_mode==='manual'?parseFloat(orig.yield)||0:0):0};
  if(mode==='manual'&&curRaw!==''){
    const cur=r2(parseFloat(curRaw));
    if(!(cur>=0))return{error:'O valor atual não pode ser negativo',field:'Cur'};
    out.yield=r2(cur-value);
    if(curRaw!==g('Cur').dataset.orig)out.value_updated_at=todayISO();
  }else if(mode==='manual'&&!orig)out.value_updated_at=todayISO();
  if(!name)return{error:'Dê um nome ao investimento',field:'Name'};
  if(!(initial>0))return{error:'Informe o valor aplicado',field:'Value'};
  if(mode!=='manual'){
    if(!date)return{error:'Informe a data da aplicação — ela é usada para calcular o rendimento',field:'Date'};
    if(!(rate>0))return{error:'Informe a taxa de rendimento',field:'Rate'};
  }
  return{data:out,moves};
}
function invFormPreview(p){
  const prev=document.getElementById(p+'Prev');if(!prev)return;
  const f=document.getElementById(p+'Form'),editId=f.closest('.goal-card')?invUI.editing:null;
  const orig=editId!=null?invById(editId):null,r=readInvForm(p,orig);
  // Mostra no "Automático" qual regime de imposto será usado para esse tipo/nome.
  const sel=document.getElementById(p+'Tax');
  if(sel)sel.options[0].text=`Automático (${TAX_LABEL[taxMode({name:document.getElementById(p+'Name').value,type:document.getElementById(p+'Type').value})]})`;
  if(r.error){prev.style.display='none';return;}
  const pseudo={...r.data,id:orig?orig.id:'__novo__'},c=invCalc(pseudo,r.moves),t=invTaxInfo(pseudo,c);
  const liq=t.now.ir+t.now.iof>0?` · líquido ≈ <strong>${fmt(t.now.net)}</strong>`:'';
  if(r.data.yield_mode!=='manual'){
    const days=daysBetween(r.data.date,new Date());
    prev.innerHTML=`📊 Hoje: <strong>${fmt(c.balance)}</strong> · rendimento ${signed(c.yld)} em ${days} dia${days===1?'':'s'}${liq}`;
  }else prev.innerHTML=`📊 Rendimento: <strong>${signed(c.yld)}</strong> (${fmtPctBR(c.pct,true)})${liq}`;
  prev.style.display='block';
}
async function saveInvForm(p,id){
  const orig=id!=null?invById(id):null,r=readInvForm(p,orig),err=document.getElementById(p+'Err');
  document.querySelectorAll(`#${p}Form input`).forEach(i=>i.classList.remove('invalid'));
  if(r.error){err.textContent=r.error;const f=document.getElementById(p+r.field);if(f){f.classList.add('invalid');f.focus();}return;}
  const btn=document.getElementById(p+'Btn');btn.disabled=true;err.textContent='';
  try{
    if(orig){
      const res=await apiFetch('PATCH',`/investments/${id}`,r.data);
      const i=db.investments.findIndex(x=>x.id===id);if(i>-1)db.investments[i]={...db.investments[i],...(res&&res[0]?res[0]:r.data)};
      invUI.panel[id]=null;invUI.editing=null;renderAll();toast('Investimento atualizado!');
    }else{
      const res=await apiFetch('POST','/investments',r.data);if(res&&res[0])db.investments.unshift(res[0]);
      invUI.newOpen=false;document.getElementById('invNew').innerHTML='';renderAll();toast('Investimento adicionado!');
    }
  }catch(e){err.textContent=e.message;btn.disabled=false;}
}

// ── Ações ──
function toggleNewInv(open){
  invUI.newOpen=open??!invUI.newOpen;
  const box=document.getElementById('invNew');
  box.innerHTML=invUI.newOpen?invFormHTML('in',null,null,null):'';
  renderInvestments();
  if(invUI.newOpen){invFormPreview('in');document.getElementById('inName').focus();box.scrollIntoView({block:'nearest'});}
}
function invPanel(id,type){
  invUI.panel[id]=type&&invUI.panel[id]!==type?type:null;invUI.confirmMove=null;
  invUI.editing=invUI.panel[id]==='edit'?id:null;
  renderInvestments();
  const k=gk(id),t=invUI.panel[id];
  const focus={in:'imAmount-'+k,out:'imAmount-'+k,update:'iuValue-'+k,edit:'ie'+k+'Name'}[t];
  if(focus){const el=document.getElementById(focus);if(el){el.focus();if(el.select)el.select();}}
  if(t==='update')invUpdatePreview(id);
  if(t==='out')invMovePreview(id);
  if(t==='edit')invFormPreview('ie'+k);
}
function invKey(e,id,action){if(e.key==='Enter'){e.preventDefault();action();}else if(e.key==='Escape')invPanel(id,null);}
function setInvAmount(k,v,all,id){
  if(all&&document.getElementById('imNetTabs-'+k))invSetNetMode(k,0,id); // "Tudo" é sempre o valor bruto
  const el=document.getElementById('imAmount-'+k);if(el){el.value=r2(v).toFixed(2);el.dataset.all=all?'1':'';el.classList.remove('invalid');el.focus();}
  invMovePreview(id);
}
// Resgate: o valor digitado é o bruto (sai do investimento) ou o líquido (cai na conta)?
function invSetNetMode(k,net,id){
  const tabs=document.getElementById('imNetTabs-'+k);if(!tabs)return;
  tabs.dataset.net=String(net);
  tabs.querySelectorAll('.yield-mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.net===String(net)));
  document.getElementById('imAmountLabel-'+k).textContent=net?'Valor líquido (R$)':'Valor (R$)';
  document.getElementById('imAmount-'+k).dataset.all='';
  invMovePreview(id);
}
function invMovePreview(id){
  const inv=invById(id),k=gk(id),el=document.getElementById('imTax-'+k);if(!inv||!el)return;
  const c=invCalc(inv),t=invTaxInfo(inv,c);
  if(t.tm!=='regressiva'){el.innerHTML=t.tm==='isento'?'Investimento isento de IR.':'';return;}
  const amt=parseFloat(document.getElementById('imAmount-'+k).value),date=document.getElementById('imDate-'+k).value||todayISO();
  if(!(amt>0)){el.innerHTML='Digite o valor para ver o imposto estimado.';return;}
  const tabs=document.getElementById('imNetTabs-'+k),net=tabs&&tabs.dataset.net==='1';
  let gross=amt;
  if(net){gross=invGrossForNet(inv,c,t.sim,amt,date);if(gross==null){el.innerHTML='Esse valor líquido é maior do que o disponível.';return;}}
  const tx=invTaxFor(inv,c,t.sim,gross,date),iof=tx.iof>0?` · IOF ≈ ${fmt(tx.iof)}`:'';
  el.innerHTML=net?`Resgate bruto ≈ <strong>${fmt(gross)}</strong> · IR ≈ ${fmt(tx.ir)}${iof}`
    :`IR ≈ ${fmt(tx.ir)}${iof} · você recebe ≈ <strong>${fmt(r2(gross-tx.ir-tx.iof))}</strong>`;
}
function confirmInvMove(mid){invUI.confirmMove=mid;renderInvestments();}
function invUpdatePreview(id){
  const inv=invById(id),k=gk(id),c=invCalc(inv),el=document.getElementById('iuPrev-'+k);if(!el)return;
  const v=parseFloat(document.getElementById('iuValue-'+k).value);
  if(isNaN(v)){el.innerHTML='';return;}
  const y=r2(v-c.net),base=c.net>0?c.net:c.totalIn;
  el.innerHTML=`Rendimento: <strong>${signed(y)}</strong> (${fmtPctBR(base>0?y/base*100:0,true)}) sobre ${fmt(c.net)} aplicados`;
}
async function invSaveValue(id){
  const inv=invById(id),k=gk(id),c=invCalc(inv),inp=document.getElementById('iuValue-'+k),err=document.getElementById('iuErr-'+k);
  const v=r2(parseFloat(inp.value));
  if(!(v>=0)){err.textContent='Informe o valor atual';inp.classList.add('invalid');inp.focus();return;}
  const body={yield:r2(v-c.net),value_updated_at:todayISO()};
  try{
    const res=await apiFetch('PATCH',`/investments/${id}`,body);
    const i=db.investments.findIndex(x=>x.id===id);if(i>-1)db.investments[i]={...db.investments[i],...(res&&res[0]?res[0]:body)};
    invUI.panel[id]=null;renderAll();toast('Valor atualizado!');
  }catch(e){err.textContent=e.message;}
}
async function invMove(id,sign){
  const inv=invById(id);if(!inv)return;
  const k=gk(id),amtEl=document.getElementById('imAmount-'+k),err=document.getElementById('imErr-'+k),btn=document.getElementById('imBtn-'+k);
  const date=document.getElementById('imDate-'+k).value||todayISO();
  let amount=r2(parseFloat(amtEl.value));
  if(sign<0){
    // Valor líquido informado: converte para o bruto que sai do investimento.
    const tabs=document.getElementById('imNetTabs-'+k);
    if(tabs&&tabs.dataset.net==='1'&&amtEl.dataset.all!=='1'&&amount>0){
      const c0=invCalc(inv),g=invGrossForNet(inv,c0,invTaxInfo(inv,c0).sim,amount,date);
      if(g==null){err.textContent='Esse valor líquido é maior do que o disponível';amtEl.classList.add('invalid');amtEl.focus();return;}
      amount=g;
    }
    // "Tudo": recalcula o saldo na data escolhida, para o investimento zerar certinho.
    const bal=inv.yield_mode==='manual'?invCalc(inv).balance:invCalc(inv,invMoves(id),date).balance;
    if(amtEl.dataset.all==='1')amount=r2(bal);
    if(amount>bal+0.01){err.textContent=`O valor disponível ${inv.yield_mode==='manual'?'':'nessa data '}é ${fmt(bal)}`;amtEl.classList.add('invalid');amtEl.focus();return;}
  }
  if(!(amount>0)){err.textContent='Informe um valor maior que zero';amtEl.classList.add('invalid');amtEl.focus();return;}
  const note=document.getElementById('imNote-'+k).value.trim()||null;
  btn.disabled=true;err.textContent='';
  try{
    const r=await apiFetch('POST','/investment-movements',{investment_id:id,amount:sign*amount,date,note});
    if(!r)return;
    db.invMoves.unshift(r.movement);
    const i=db.investments.findIndex(x=>x.id===id);if(i>-1&&r.investment)db.investments[i]={...db.investments[i],...r.investment};
    invUI.panel[id]=null;renderAll();
    toast(sign>0?`Aporte de ${fmt(amount)} registrado!`:invCalc(db.investments[i]).closed?'Investimento resgatado e encerrado':`Resgate de ${fmt(amount)} registrado`);
  }catch(e){err.textContent=e.message;btn.disabled=false;}
}
async function delInvMove(mid,id){
  try{
    const r=await apiFetch('DELETE',`/investment-movements/${mid}`);if(!r)return;
    db.invMoves=db.invMoves.filter(m=>m.id!==mid);
    const i=db.investments.findIndex(x=>x.id===id);if(i>-1&&r.investment)db.investments[i]={...db.investments[i],...r.investment};
    invUI.confirmMove=null;renderAll();toast('Movimentação excluída','var(--amber)');
  }catch(e){invUI.confirmMove=null;renderInvestments();toast(e.message,'var(--red)');}
}
async function deleteInv(id){
  try{
    await apiFetch('DELETE',`/investments/${id}`);
    db.investments=db.investments.filter(x=>x.id!==id);db.invMoves=db.invMoves.filter(m=>m.investment_id!==id);delete invUI.panel[id];
    renderAll();toast('Investimento excluído','var(--amber)');
  }catch(e){toast(e.message,'var(--red)');}
}

// ══ OBJETIVOS ══════════════════════════════════════════
// Tudo acontece dentro da página (sem popups): formulário de novo objetivo no topo
// e, em cada card, painéis para guardar, retirar, ver histórico, editar e excluir.
const goalUI={newOpen:false,panel:{},confirmContrib:null}; // panel[id] = 'deposit'|'withdraw'|'history'|'edit'|'delete'
const DAY_MS=864e5,MONTH_DAYS=30.44;
const r2=n=>Math.round(n*100)/100;
function todayISO(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function parseISO(s){return new Date(String(s).slice(0,10)+'T12:00:00');}
function monthYear(d){return`${MES_CURTO[d.getMonth()]}/${d.getFullYear()}`;}
function gk(id){return String(id).replace(/[^\w-]/g,'_');}
function goalById(id){return db.goals.find(x=>x.id===id);}
function goalContribs(id){return db.contribs.filter(c=>c.goal_id===id);}
function timeLeftTxt(days){
  if(days<0){const m=Math.round(-days/MONTH_DAYS);return m>=1?`venceu há ${m} ${m>1?'meses':'mês'}`:`venceu há ${-days} dia${days<-1?'s':''}`;}
  if(days===0)return'vence hoje';
  if(days<=45)return`faltam ${days} dia${days>1?'s':''}`;
  const m=Math.round(days/MONTH_DAYS);return`faltam ${m} meses`;
}

// Números de cada objetivo: progresso, quanto guardar por mês, ritmo real e previsão.
function goalStats(g){
  const target=parseFloat(g.target)||0,current=parseFloat(g.current)||0;
  const remaining=r2(Math.max(0,target-current)),pct=target>0?Math.min(100,current/target*100):0,done=target>0&&current>=target;
  const now=new Date();now.setHours(12,0,0,0);
  const list=goalContribs(g.id);
  // Ritmo = média mensal dos aportes dos últimos 3 meses (ou desde o início do objetivo, se for mais recente).
  // Início = criação do objetivo ou o aporte mais antigo, o que vier primeiro.
  let started=g.created_at?new Date(g.created_at).getTime():now.getTime();
  list.forEach(c=>{started=Math.min(started,parseISO(c.date).getTime());});
  const winStart=new Date(Math.max(now.getTime()-90*DAY_MS,Math.min(started,now.getTime())));
  winStart.setHours(0,0,0,0);
  const span=Math.max(1,(now-winStart)/DAY_MS/MONTH_DAYS);
  const recent=list.filter(c=>parseISO(c.date)>=winStart).reduce((s,c)=>s+parseFloat(c.amount),0);
  const pace=list.length?r2(recent/span):null;
  let daysLeft=null,needed=null;
  if(g.deadline){daysLeft=Math.round((parseISO(g.deadline)-now)/DAY_MS);if(daysLeft>0&&remaining>0)needed=r2(remaining/Math.max(1,daysLeft/MONTH_DAYS));}
  const eta=(!done&&pace>0)?new Date(now.getTime()+remaining/pace*MONTH_DAYS*DAY_MS):null;
  let status;
  if(done)status={k:'done',icon:'✓',label:'Concluído'};
  else if(g.deadline&&daysLeft<0)status={k:'late',icon:'!',label:'Prazo vencido'};
  else if(!list.length)status={k:'idle',icon:'○',label:'Sem aportes'};
  else if(needed!=null)status=pace>=needed*0.95?{k:'ok',icon:'▲',label:'No ritmo'}:{k:'warn',icon:'▼',label:'Abaixo do ritmo'};
  else status={k:'ok',icon:'●',label:'Em andamento'};
  return{target,current,remaining,pct,done,list,pace,daysLeft,needed,eta,status};
}

function renderGoals(){
  const all=db.goals.map(g=>({g,s:goalStats(g)}));
  // Resumo
  const saved=all.reduce((t,x)=>t+x.s.current,0),targets=all.reduce((t,x)=>t+x.s.target,0);
  const doneN=all.filter(x=>x.s.done).length,mk=monthKeyOffset(0);
  const month=db.contribs.filter(c=>String(c.date).slice(0,7)===mk).reduce((t,c)=>t+parseFloat(c.amount),0);
  document.getElementById('goalSummary').innerHTML=!all.length?'':`
    <div class="metric"><label>Guardado nos objetivos</label><div class="val neutral">${fmt(saved)}</div></div>
    <div class="metric"><label>Progresso geral</label><div class="val">${targets?Math.min(100,saved/targets*100).toLocaleString('pt-BR',{maximumFractionDigits:0}):0}%</div><div class="metric-sub">de ${fmt(targets)} em metas</div></div>
    <div class="metric"><label>Aportes neste mês</label><div class="val ${month>=0?'pos':'neg'}">${signed(month)}</div></div>
    <div class="metric"><label>Concluídos</label><div class="val">${doneN} <span class="metric-of">de ${all.length}</span></div></div>`;
  document.getElementById('goalNotice').innerHTML=db.contribsOk?'':'<div class="goal-notice">O histórico de aportes ainda não está ativo no banco de dados. Por enquanto, o valor guardado é alterado em ✏️ Editar.</div>';
  document.getElementById('goalNew').classList.toggle('open',goalUI.newOpen||!all.length);
  const el=document.getElementById('goalsList');
  if(!all.length){el.innerHTML='';return;}
  const active=all.filter(x=>!x.s.done).sort((a,b)=>(a.g.deadline||'9999').localeCompare(b.g.deadline||'9999'));
  const done=all.filter(x=>x.s.done);
  el.innerHTML=(active.length?`<div class="goal-grid">${active.map(goalCard).join('')}</div>`:'<div class="empty-state">Todos os objetivos foram concluídos 🎉 Que tal criar o próximo?</div>')+
    (done.length?`<div class="goal-section-title">Concluídos (${done.length})</div><div class="goal-grid">${done.map(goalCard).join('')}</div>`:'');
  drawGoalCharts();
}

function goalCard({g,s}){
  const id=jsArg(g.id),k=gk(g.id),panel=goalUI.panel[g.id];
  const deadline=g.deadline?`<strong>${esc(fmtD(g.deadline))}</strong> · ${timeLeftTxt(s.daysLeft)}`:'Sem prazo definido';
  const lines=[];
  if(s.done)lines.push(s.current>s.target?`Meta batida, com ${fmt(s.current-s.target)} a mais 🎉`:'Meta batida 🎉');
  else{
    if(s.needed!=null)lines.push(`Guarde <strong>${fmt(s.needed)}/mês</strong> para chegar no prazo`);
    else if(g.deadline&&s.daysLeft<=0)lines.push('Defina um novo prazo em ✏️ Editar');
    if(s.pace!=null)lines.push(s.pace>0?`No seu ritmo (${fmt(s.pace)}/mês), chega em <strong>${monthYear(s.eta)}</strong>`:'Sem aportes nos últimos 3 meses');
  }
  const canContrib=db.contribsOk;
  return`<div class="goal-card${s.done?' is-done':''}">
    <div class="goal-head"><div class="goal-name">${esc(g.name)}</div><span class="goal-status ${s.status.k}">${s.status.icon} ${s.status.label}</span></div>
    <div class="goal-amounts"><span class="goal-current">${fmt(s.current)}</span><span class="goal-target">de ${fmt(s.target)}</span><span class="goal-pct">${s.pct.toLocaleString('pt-BR',{maximumFractionDigits:0})}%</span></div>
    <div class="goal-track" role="progressbar" aria-valuenow="${Math.round(s.pct)}" aria-valuemin="0" aria-valuemax="100"><div class="goal-fill" style="width:${s.pct.toFixed(1)}%"></div></div>
    <div class="goal-info">
      <div>${s.done?'':`Faltam <strong>${fmt(s.remaining)}</strong> · `}${deadline}</div>
      ${lines.map(l=>`<div>${l}</div>`).join('')}
    </div>
    <div class="goal-btns">
      ${canContrib?`<button class="btn btn-primary btn-sm${panel==='deposit'?' active':''}" onclick="goalPanel(${id},'deposit')">+ Guardar</button>
      <button class="btn btn-ghost btn-sm${panel==='withdraw'?' active':''}" onclick="goalPanel(${id},'withdraw')"${s.current>0?'':' disabled'}>− Retirar</button>
      <button class="btn btn-ghost btn-sm${panel==='history'?' active':''}" onclick="goalPanel(${id},'history')">Histórico (${s.list.length})</button>`:''}
      <span class="goal-btns-right"><button class="btn btn-ghost btn-sm${panel==='edit'?' active':''}" onclick="goalPanel(${id},'edit')" title="Editar" aria-label="Editar objetivo">✏️</button><button class="btn btn-danger btn-sm${panel==='delete'?' active':''}" onclick="goalPanel(${id},'delete')" title="Excluir" aria-label="Excluir objetivo">🗑</button></span>
    </div>
    ${panel?`<div class="goal-panel">${goalPanelHTML(g,s,panel,id,k)}</div>`:''}
  </div>`;
}

function goalPanelHTML(g,s,panel,id,k){
  if(panel==='deposit'||panel==='withdraw'){
    const dep=panel==='deposit',sign=dep?1:-1;
    const chips=dep
      ?[100,500,1000].map(v=>[`+ ${fmt(v)}`,v]).concat(s.needed?[[`Valor do mês (${fmt(s.needed)})`,s.needed]]:[]).concat(s.remaining>0?[[`O que falta (${fmt(s.remaining)})`,s.remaining]]:[])
      :[[`Tudo (${fmt(s.current)})`,s.current]];
    return`<div class="goal-panel-title">${dep?'Guardar dinheiro neste objetivo':'Retirar dinheiro deste objetivo'}</div>
      <div class="goal-chips">${chips.map(([l,v])=>`<button type="button" class="chip" onclick="setGoalAmount(${jsArg(k)},${v})">${l}</button>`).join('')}</div>
      <div class="form-row">
        <div class="mfg"><label>Valor (R$)</label><input type="number" id="gpAmount-${k}" step="0.01" min="0.01" inputmode="decimal" placeholder="0,00" onkeydown="goalKey(event,${id},()=>goalContribute(${id},${sign}))"></div>
        <div class="mfg"><label>Data</label><input type="date" id="gpDate-${k}" value="${todayISO()}" onkeydown="goalKey(event,${id},()=>goalContribute(${id},${sign}))"></div>
      </div>
      <div class="mfg"><label>Observação <span class="info-tag">opcional</span></label><input type="text" id="gpNote-${k}" maxlength="200" placeholder="${dep?'Ex: 13º salário':'Ex: emergência no carro'}" onkeydown="goalKey(event,${id},()=>goalContribute(${id},${sign}))"></div>
      <div class="goal-err" id="gpErr-${k}"></div>
      <div class="goal-actions"><button class="btn btn-ghost btn-sm" onclick="goalPanel(${id},null)">Cancelar</button><button class="btn ${dep?'btn-primary':'btn-ghost'} btn-sm" id="gpBtn-${k}" onclick="goalContribute(${id},${sign})">${dep?'Guardar':'Retirar'}</button></div>`;
  }
  if(panel==='history'){
    const list=s.list.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.created_at).localeCompare(String(a.created_at)));
    if(!list.length)return'<div class="goal-panel-title">Histórico</div><div class="goal-empty">Nenhum aporte ainda. Use “+ Guardar” para registrar o primeiro.</div>';
    return`<div class="goal-panel-title">Evolução</div><div class="goal-chart" data-gid="${esc(g.id)}"></div>
      <div class="goal-panel-title" style="margin-top:.75rem">Aportes</div>
      <div class="goal-hist">${list.map(c=>{
        const a=parseFloat(c.amount),cid=jsArg(c.id);
        if(goalUI.confirmContrib===c.id)return`<div class="hist-row confirm"><span>Excluir este aporte de ${signed(a)}?</span><span><button class="btn btn-ghost btn-sm" onclick="confirmContrib(null)">Não</button> <button class="btn btn-danger btn-sm" onclick="delContribution(${cid},${id})">Excluir</button></span></div>`;
        return`<div class="hist-row"><span class="hist-date">${esc(fmtD(String(c.date).slice(0,10)))}</span><span class="hist-amt ${a>=0?'in':'out'}">${a>=0?'▲':'▼'} ${signed(a)}</span><span class="hist-note">${esc(c.note||'')}</span><button class="hist-del" onclick="confirmContrib(${cid})" title="Excluir aporte" aria-label="Excluir aporte">✕</button></div>`;
      }).join('')}</div>`;
  }
  if(panel==='edit'){
    return`<div class="goal-panel-title">Editar objetivo</div>
      <div class="mfg"><label>Nome</label><input type="text" id="geName-${k}" maxlength="150" value="${esc(g.name)}" onkeydown="goalKey(event,${id},()=>saveGoalEdit(${id}))"></div>
      <div class="form-row">
        <div class="mfg"><label>Meta (R$)</label><input type="number" id="geTarget-${k}" step="0.01" min="0.01" inputmode="decimal" value="${esc(g.target)}" onkeydown="goalKey(event,${id},()=>saveGoalEdit(${id}))"></div>
        <div class="mfg"><label>Prazo <span class="info-tag">opcional</span></label><input type="date" id="geDeadline-${k}" value="${esc(g.deadline||'')}" onkeydown="goalKey(event,${id},()=>saveGoalEdit(${id}))"></div>
      </div>
      ${db.contribsOk?'<div class="goal-hint">O valor guardado muda pelos botões “+ Guardar” e “− Retirar”, para manter o histórico certo.</div>':`<div class="mfg"><label>Valor guardado (R$)</label><input type="number" id="geCurrent-${k}" step="0.01" min="0" inputmode="decimal" value="${esc(g.current||0)}"></div>`}
      <div class="goal-err" id="geErr-${k}"></div>
      <div class="goal-actions"><button class="btn btn-ghost btn-sm" onclick="goalPanel(${id},null)">Cancelar</button><button class="btn btn-primary btn-sm" onclick="saveGoalEdit(${id})">Salvar</button></div>`;
  }
  if(panel==='delete'){
    return`<div class="goal-panel-title">Excluir “${esc(g.name)}”?</div>
      <div class="goal-hint">O objetivo e todo o histórico de aportes serão apagados. Essa ação não pode ser desfeita.</div>
      <div class="goal-actions"><button class="btn btn-ghost btn-sm" onclick="goalPanel(${id},null)">Cancelar</button><button class="btn btn-sm btn-danger-solid" onclick="deleteGoal(${id})">Excluir objetivo</button></div>`;
  }
  return'';
}

// Gráfico de evolução do valor guardado (degraus: o valor muda no dia de cada aporte).
function drawGoalCharts(){
  document.querySelectorAll('.goal-chart[data-gid]').forEach(el=>{
    const g=db.goals.find(x=>String(x.id)===el.dataset.gid);if(g)el.innerHTML=goalChartSVG(g,Math.max(240,el.clientWidth||320));
  });
}
function goalChartSVG(g,W){
  const list=goalContribs(g.id).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.created_at).localeCompare(String(b.created_at)));
  const current=parseFloat(g.current)||0,target=parseFloat(g.target)||0;
  const initial=r2(current-list.reduce((t,c)=>t+parseFloat(c.amount),0));
  const now=new Date();now.setHours(12,0,0,0);
  let t0=g.created_at?parseISO(String(g.created_at).slice(0,10)):parseISO(list[0].date);
  if(parseISO(list[0].date)<t0)t0=parseISO(list[0].date);
  const pts=[{d:t0,v:initial}];let acc=initial;
  list.forEach(c=>{acc=r2(acc+parseFloat(c.amount));pts.push({d:parseISO(c.date),v:acc,c});});
  const tEnd=new Date(Math.max(now.getTime(),pts[pts.length-1].d.getTime()));
  const H=150,pad={t:16,r:12,b:22,l:50},cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;
  const ticks=niceTicks(0,Math.max(target,...pts.map(p=>p.v),1),3),hi=ticks[ticks.length-1],compact=hi>=10000;
  const span=Math.max(DAY_MS,tEnd-t0);
  const X=d=>pad.l+(d-t0)/span*cW,Y=v=>pad.t+cH*(1-v/hi);
  let grid='';ticks.forEach(t=>{const y=Y(t).toFixed(1);grid+=`<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="${CHART.grid}" stroke-width="1"/><text x="${pad.l-6}" y="${(+y+3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${CHART.axis}">${fmtTick(t,compact)}</text>`;});
  let path=`M${X(pts[0].d).toFixed(1)},${Y(pts[0].v).toFixed(1)}`;
  pts.slice(1).forEach(p=>{path+=` H${X(p.d).toFixed(1)} V${Y(p.v).toFixed(1)}`;});
  path+=` H${X(tEnd).toFixed(1)}`;
  const area=`${path} V${Y(0).toFixed(1)} H${X(t0).toFixed(1)} Z`;
  const ty=Y(target).toFixed(1);
  const goalLine=target?`<line x1="${pad.l}" y1="${ty}" x2="${W-pad.r}" y2="${ty}" stroke="${CHART.axis}" stroke-width="1" opacity=".6"/><text x="${W-pad.r}" y="${(+ty-5).toFixed(1)}" text-anchor="end" font-size="10" fill="${CHART.axis}">Meta ${fmt(target)}</text>`:'';
  const dots=pts.slice(1).map(p=>{
    const a=parseFloat(p.c.amount),tip=`${fmtD(String(p.c.date).slice(0,10))}\n${signed(a)}${p.c.note?` · ${p.c.note}`:''}\nTotal: ${fmt(p.v)}`;
    return`<g data-tip="${esc(tip)}"><circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="12" fill="transparent"/><circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="4" fill="${CHART.accent}" stroke="${CHART.surface}" stroke-width="2"/></g>`;
  }).join('');
  const dl=d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`;
  const xl=`<text x="${pad.l}" y="${H-6}" font-size="10" fill="${CHART.axis}">${dl(t0)}</text><text x="${W-pad.r}" y="${H-6}" text-anchor="end" font-size="10" fill="${CHART.axis}">${dl(tEnd)}</text>`;
  return`<svg class="rpt-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do valor guardado em ${esc(g.name)}">${grid}<path d="${area}" fill="${CHART.accent}" fill-opacity=".1"/>${goalLine}<path d="${path}" fill="none" stroke="${CHART.accent}" stroke-width="2" stroke-linejoin="round"/>${dots}${xl}</svg>`;
}

// ── Ações ──
function goalPanel(id,type){
  goalUI.panel[id]=type&&goalUI.panel[id]!==type?type:null;goalUI.confirmContrib=null;
  renderGoals();
  const k=gk(id),focus={deposit:'gpAmount-',withdraw:'gpAmount-',edit:'geName-'}[goalUI.panel[id]];
  if(focus){const el=document.getElementById(focus+k);if(el){el.focus();if(el.select)el.select();}}
}
function goalKey(e,id,action){if(e.key==='Enter'){e.preventDefault();action();}else if(e.key==='Escape'){goalPanel(id,null);}}
function setGoalAmount(k,v){const el=document.getElementById('gpAmount-'+k);if(el){el.value=r2(v).toFixed(2);el.classList.remove('invalid');el.focus();}}
function confirmContrib(cid){goalUI.confirmContrib=cid;renderGoals();}

async function goalContribute(id,sign){
  const g=goalById(id);if(!g)return;
  const k=gk(id),amtEl=document.getElementById('gpAmount-'+k),err=document.getElementById('gpErr-'+k),btn=document.getElementById('gpBtn-'+k);
  const amount=r2(parseFloat(amtEl.value));
  if(!(amount>0)){err.textContent='Informe um valor maior que zero';amtEl.classList.add('invalid');amtEl.focus();return;}
  if(sign<0&&amount>(parseFloat(g.current)||0)+0.001){err.textContent=`Você tem ${fmt(g.current)} guardado neste objetivo`;amtEl.classList.add('invalid');amtEl.focus();return;}
  const date=document.getElementById('gpDate-'+k).value||todayISO();
  const note=document.getElementById('gpNote-'+k).value.trim()||null;
  btn.disabled=true;err.textContent='';
  try{
    const r=await apiFetch('POST','/goal-contributions',{goal_id:id,amount:sign*amount,date,note});
    if(!r)return;
    db.contribs.unshift(r.contribution);
    const i=db.goals.findIndex(x=>x.id===id);if(i>-1&&r.goal)db.goals[i]={...db.goals[i],...r.goal};
    goalUI.panel[id]=null;renderGoals();
    toast(sign>0&&goalStats(db.goals[i]).done?'Meta batida! 🎉':sign>0?`${fmt(amount)} guardado!`:`${fmt(amount)} retirado`);
  }catch(e){err.textContent=e.message;btn.disabled=false;}
}
async function delContribution(cid,gid){
  try{
    const r=await apiFetch('DELETE',`/goal-contributions/${cid}`);if(!r)return;
    db.contribs=db.contribs.filter(c=>c.id!==cid);
    const i=db.goals.findIndex(x=>x.id===gid);if(i>-1&&r.goal)db.goals[i]={...db.goals[i],...r.goal};
    goalUI.confirmContrib=null;renderGoals();toast('Aporte excluído','var(--amber)');
  }catch(e){goalUI.confirmContrib=null;renderGoals();toast(e.message,'var(--red)');}
}

function toggleNewGoal(open){
  goalUI.newOpen=open??!goalUI.newOpen;renderGoals();
  if(goalUI.newOpen)document.getElementById('gnName').focus();
}
function setGoalDeadline(months){const d=new Date();d.setMonth(d.getMonth()+months);document.getElementById('gnDeadline').value=d.toISOString().slice(0,10);updateNewGoalHint();}
function updateNewGoalHint(){
  const target=parseFloat(document.getElementById('gnTarget').value)||0,current=parseFloat(document.getElementById('gnCurrent').value)||0;
  const dl=document.getElementById('gnDeadline').value,hint=document.getElementById('gnHint');
  const rem=target-current;
  if(!target||rem<=0||!dl){hint.innerHTML=target&&rem<=0?'Você já tem o valor da meta 🎉':'';return;}
  const days=Math.round((parseISO(dl)-new Date())/DAY_MS);
  hint.innerHTML=days>0?`Para chegar lá até ${esc(fmtD(dl))}, guarde <strong>${fmt(rem/Math.max(1,days/MONTH_DAYS))}/mês</strong>.`:'Escolha uma data no futuro.';
}
async function createGoal(){
  const nameEl=document.getElementById('gnName'),targetEl=document.getElementById('gnTarget'),err=document.getElementById('gnErr');
  const name=nameEl.value.trim(),target=r2(parseFloat(targetEl.value)),current=r2(parseFloat(document.getElementById('gnCurrent').value)||0);
  const deadline=document.getElementById('gnDeadline').value||null;
  [nameEl,targetEl].forEach(e=>e.classList.remove('invalid'));err.textContent='';
  if(!name){nameEl.classList.add('invalid');err.textContent='Dê um nome ao objetivo';nameEl.focus();return;}
  if(!(target>0)){targetEl.classList.add('invalid');err.textContent='Informe o valor da meta';targetEl.focus();return;}
  if(current<0){err.textContent='O valor guardado não pode ser negativo';return;}
  const btn=document.getElementById('gnBtn');btn.disabled=true;
  try{
    const r=await apiFetch('POST','/goals',{name,target,current,deadline});
    if(r&&r[0])db.goals.unshift(r[0]);
    ['gnName','gnTarget','gnCurrent','gnDeadline'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('gnHint').innerHTML='';
    goalUI.newOpen=false;renderGoals();toast('Objetivo criado!');
  }catch(e){err.textContent=e.message;}
  btn.disabled=false;
}
async function saveGoalEdit(id){
  const k=gk(id),err=document.getElementById('geErr-'+k);
  const nameEl=document.getElementById('geName-'+k),targetEl=document.getElementById('geTarget-'+k);
  const name=nameEl.value.trim(),target=r2(parseFloat(targetEl.value)),deadline=document.getElementById('geDeadline-'+k).value||null;
  if(!name){nameEl.classList.add('invalid');err.textContent='Dê um nome ao objetivo';return;}
  if(!(target>0)){targetEl.classList.add('invalid');err.textContent='Informe o valor da meta';return;}
  const body={name,target,deadline};
  const curEl=document.getElementById('geCurrent-'+k);
  if(curEl){const c=r2(parseFloat(curEl.value)||0);if(c<0){err.textContent='O valor guardado não pode ser negativo';return;}body.current=c;}
  try{
    await apiFetch('PATCH',`/goals/${id}`,body);
    const i=db.goals.findIndex(x=>x.id===id);if(i>-1)db.goals[i]={...db.goals[i],...body};
    goalUI.panel[id]=null;renderGoals();toast('Objetivo atualizado!');
  }catch(e){err.textContent=e.message;}
}
async function deleteGoal(id){
  try{
    await apiFetch('DELETE',`/goals/${id}`);
    db.goals=db.goals.filter(g=>g.id!==id);db.contribs=db.contribs.filter(c=>c.goal_id!==id);delete goalUI.panel[id];
    renderGoals();toast('Objetivo excluído','var(--amber)');
  }catch(e){toast(e.message,'var(--red)');}
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
  const invMap={};invPortfolio().active.forEach(({inv,c})=>{invMap[inv.type]=(invMap[inv.type]||0)+c.balance;}); // valor atual dos ativos
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
function signed(v){return(v>0.005?'+':v<-0.005?'−':'')+fmt(Math.abs(v));}
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
  // Popups (ex.: Adicionar transação) fecham só pelo Cancelar ou ao salvar — clicar fora não fecha, para não perder o que foi digitado.
  initChartTips();
  // Redesenha os relatórios ao redimensionar a janela (os gráficos usam a largura real do card).
  let rptResize;window.addEventListener('resize',()=>{clearTimeout(rptResize);rptResize=setTimeout(()=>{if(document.getElementById('tab-reports').classList.contains('active'))renderReports();},150);});
  tryAutoLogin();
});

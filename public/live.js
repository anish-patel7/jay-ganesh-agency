/* Jay Ganesh Agency — live portal. Talks to the server API, which stores
 * everything in the organiser's Google Sheet. */
const view=document.getElementById('view'),conn=document.getElementById('conn'),logoutBtn=document.getElementById('logout');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rupee=n=>'₹'+(Number(n)||0).toLocaleString('en-IN');
const when=s=>s?new Date(s).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}):'—';
let status=null,me=null,tab='overview';

async function api(path,opts={}){
  const res=await fetch(path,{credentials:'same-origin',...opts,headers:{'Content-Type':'application/json','X-JGA-Request':'1',...(opts.headers||{})}});
  let data={};try{data=await res.json()}catch{}
  if(!res.ok){const err=new Error(data.error||`Request failed (${res.status})`);err.status=res.status;throw err}
  return data;
}

function showConn(){
  if(!status){conn.className='chip bad';conn.textContent='Server offline';return}
  if(status.sheetsConnected){conn.className='chip ok';conn.textContent='Google Sheet connected'}
  else if(status.error){conn.className='chip bad';conn.textContent='Sheet not connected'}
  else{conn.className='chip warn';conn.textContent='Setup pending'}
}

function loginView(message,kind='err'){
  logoutBtn.hidden=true;
  const setupNote=status&&!status.sheetsConnected?`<div class="msg err"><b>Google Sheet is not connected yet.</b><br>${esc(status.error||'Set SERVER_ENABLED, GOOGLE_SHEETS_ID and GOOGLE_SERVICE_ACCOUNT_JSON on the server.')}</div>`:'';
  const adminNote=status&&!status.adminConfigured?`<div class="msg err">Admin login is not set up yet (ADMIN_MOBILE and ADMIN_PASSWORD).</div>`:'';
  view.innerHTML=`<section class="card login">
    <h1>Log in</h1><p>Main Admin: use your admin mobile number and password.</p>
    ${setupNote}${adminNote}
    <form id="lf" autocomplete="on">
      <label for="m">Mobile number</label><input id="m" name="mobile" inputmode="numeric" maxlength="10" pattern="[6-9][0-9]{9}" autocomplete="username" required>
      <label for="p">Password / PIN</label><input id="p" name="password" type="password" autocomplete="current-password" required>
      <button class="primary" type="submit">Log in</button>
    </form>
    ${message?`<div class="msg ${kind}">${esc(message)}</div>`:''}
  </section>`;
  document.getElementById('lf').onsubmit=async ev=>{
    ev.preventDefault();const btn=ev.target.querySelector('button');btn.disabled=true;btn.textContent='Logging in…';
    try{
      const mobile=document.getElementById('m').value.trim(),password=document.getElementById('p').value;
      const r=await api('/api/auth/login',{method:'POST',body:JSON.stringify({mobile,password})});
      if(r.role!=='admin'){await api('/api/auth/logout',{method:'POST'}).catch(()=>{});return loginView('Logged in, but only the Main Admin area is live right now. Customer and leader screens are coming next.','info')}
      await boot();
    }catch(err){loginView(err.status===429?'Too many attempts. Please wait 15 minutes and try again.':err.status===401?'Wrong mobile number or password.':err.message)}
  };
}

async function adminView(){
  logoutBtn.hidden=false;
  view.innerHTML=`<nav class="tabs">${[['overview','Overview'],['registrations','Registrations'],['customers','Customers'],['groups','Groups']].map(([k,l])=>`<button data-t="${k}" class="${tab===k?'on':''}">${l}</button>`).join('')}</nav><div id="pane"><p class="empty">Loading from Google Sheet…</p></div>`;
  view.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{tab=b.dataset.t;adminView()});
  const pane=document.getElementById('pane');
  try{
    if(!status.sheetsConnected){pane.innerHTML=`<div class="msg err"><b>Google Sheet is not connected.</b> ${esc(status.error||'')}</div>`;return}
    if(tab==='overview'){
      const [r,c,g]=await Promise.all([api('/api/admin/registrations'),api('/api/customers'),api('/api/groups')]);
      const pending=r.requests.filter(x=>x.status==='Pending Approval').length;
      pane.innerHTML=`<div class="stats">
        <div class="stat"><span>Pending registrations</span><b>${pending}</b></div>
        <div class="stat"><span>Customers</span><b>${c.customers.length}</b></div>
        <div class="stat"><span>Groups</span><b>${g.groups.length}</b></div>
        <div class="stat"><span>Monthly EMI total</span><b>${rupee(c.customers.reduce((s,x)=>s+Number(x.emi||0),0))}</b></div></div>
        <section class="card"><h2>System status</h2><ul class="checklist">
          <li class="y">✔ Google Sheet connected — all worksheets created</li>
          <li class="y">✔ Main Admin login working</li>
          <li class="${status.operationsAllowed?'y':'n'}">${status.operationsAllowed?'✔ Registrations & payments open':'✖ Registrations & payments closed (OPERATIONS_ENABLED / POLICY_APPROVED are false)'}</li>
          <li class="${status.legalClearanceConfigured?'y':'n'}">${status.legalClearanceConfigured?'✔ Ordering enabled':'✖ Ordering disabled (FIREWORKS_LEGAL_CLEARANCE is false)'}</li>
        </ul></section>`;
    }
    if(tab==='registrations'){
      const {requests}=await api('/api/admin/registrations');
      const rows=[...requests].reverse();
      pane.innerHTML=`<section class="card"><h2>Registration requests</h2>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Name</th><th>Mobile</th><th>Reference</th><th>EMI</th><th>Status</th><th>Received</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}${x.comments?`<br><small>${esc(x.comments)}</small>`:''}</td><td>${esc(x.mobile)}</td><td>${esc(x.reference)}</td><td>${rupee(x.emi)}</td><td>${esc(x.status)}</td><td>${when(x.createdAt)}</td><td>${x.status==='Pending Approval'?`<button class="ghost ok-btn" data-a="approve" data-id="${esc(x.id)}">Approve</button> <button class="ghost bad-btn" data-a="reject" data-id="${esc(x.id)}">Reject</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No registration requests yet.</p>'}</section>`;
      pane.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{
        const action=b.dataset.a;let body={};
        if(action==='reject'){const reason=prompt('Reason for rejecting (optional):');if(reason===null)return;body={reason}}
        else if(!confirm('Approve this registration and create the customer?'))return;
        b.disabled=true;
        try{const r=await api(`/api/admin/registrations/${encodeURIComponent(b.dataset.id)}/${action}`,{method:'POST',body:JSON.stringify(body)});if(r.customerId)alert(`Approved. Customer ID: ${r.customerId}`);adminView()}catch(err){alert(err.message);b.disabled=false}
      });
    }
    if(tab==='customers'){
      const {customers}=await api('/api/customers');
      pane.innerHTML=`<section class="card"><h2>Customers</h2>${customers.length?`<div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Mobile</th><th>Reference</th><th>EMI</th><th>Group</th><th>Status</th></tr></thead><tbody>${customers.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${esc(x.mobile)}</td><td>${esc(x.reference)}</td><td>${rupee(x.emi)}</td><td>${esc(x.groupId||'—')}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No customers yet. Approved registrations appear here.</p>'}</section>`;
    }
    if(tab==='groups'){
      const {groups}=await api('/api/groups');
      pane.innerHTML=`<section class="card"><h2>Groups</h2>${groups.length?`<div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Leader</th><th>Reference</th></tr></thead><tbody>${groups.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${esc(x.leaderCustomerId||'—')}</td><td>${esc(x.reference)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No groups yet.</p>'}</section>`;
    }
  }catch(err){if(err.status===401)return loginView('Your session expired. Please log in again.');pane.innerHTML=`<div class="msg err">${esc(err.message)}</div>`}
}

logoutBtn.onclick=async()=>{await api('/api/auth/logout',{method:'POST'}).catch(()=>{});me=null;loginView('You have been logged out.','info')};

async function boot(){
  try{status=await api('/api/status')}catch{status=null}
  showConn();
  if(!status){view.innerHTML='<div class="msg err">Cannot reach the server. If it was asleep, wait 30 seconds and refresh.</div>';return}
  try{me=await api('/api/me')}catch{me=null}
  if(me&&me.role==='admin')return adminView();
  loginView();
}
boot();

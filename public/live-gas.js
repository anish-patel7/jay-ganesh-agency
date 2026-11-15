/* Jay Ganesh Agency: production-path UI for Vercel -> private API -> Apps Script.
   No Google URLs, server secrets, or passwords are stored in this source. */
const view=document.getElementById('view'),conn=document.getElementById('conn'),logoutBtn=document.getElementById('logout');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rupee=v=>'₹'+Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const when=v=>v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}):'—';
let me=null,server=null,section='overview',authScreen='login',message='',pendingRegistration=false;
const statusTag=s=>`<span class="badge-status ${s==='Verified'?'verified':s==='Awaiting Leader'||s==='Leader Verified'||s==='Awaiting Admin'?'pending':''}">${esc(s)}</span>`;
async function api(action,fields={}){
 const r=await fetch('/api/handler',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-JGA-Request':'1'},body:JSON.stringify({action,...fields})});
 let d={};try{d=await r.json()}catch{}
 if(!r.ok){let e=new Error(d.error||'Request could not be completed');e.status=r.status;throw e}return d;
}
function error(e){return `<p class="msg err">${esc(e.message||e)}</p>`}
function notify(text,kind='info'){message=`<div class="msg ${kind}">${esc(text)}</div>`;render()}
function formData(f){return Object.fromEntries(new FormData(f).entries())}
function stat(label,value){return `<div class="stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
function table(headers,rows){if(!rows.length)return '<p class="empty">No records yet.</p>';return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}
function row(...cells){return `<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`}
function wrap(content){view.innerHTML=content;logoutBtn.hidden=!me;}
function setTabs(tabs){return `<nav class="tabs">${tabs.map(([id,label])=>`<button data-tab="${esc(id)}" class="${section===id?'on':''}">${esc(label)}</button>`).join('')}</nav>`}
function attachTabs(){view.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{section=b.dataset.tab;render()})}
function attachForm(id,onSubmit){const f=document.getElementById(id);if(!f)return;f.onsubmit=async ev=>{ev.preventDefault();const btn=f.querySelector('[type="submit"]');if(btn)btn.disabled=true;try{await onSubmit(formData(f))}catch(e){const old=f.querySelector('.form-error');if(old)old.remove();f.insertAdjacentHTML('beforeend',`<div class="form-error">${error(e)}</div>`)}finally{if(btn)btn.disabled=false}}}
function auth(){
  const login=authScreen==='login';wrap(`<div class="choice"><button data-auth="login" class="${login?'active':''}">Customer / Admin Login</button><button data-auth="register" class="${!login?'active':''}">New Customer Registration</button></div>
  <section class="card login" style="margin-top:0"><h1>${login?'Login':'Register for Diwali 2027'}</h1>
  <p>${login?'Use your registered mobile and 4-digit PIN. Main Admin uses a separate strong password.':'Registration requires approval from Main Admin. One mobile number may register once.'}</p>
  ${server&&!server.sheetsConnected?'<div class="msg err">Google Sheet connection is not ready. Ask Main Admin to finish setup.</div>':''}
  ${message}${login?`<form id="loginForm"><label>Registered mobile number</label><input name="mobile" inputmode="numeric" autocomplete="username" pattern="[6-9][0-9]{9}" maxlength="10" required><label>4-digit PIN or Admin password</label><input name="password" type="password" autocomplete="current-password" required><button class="primary" type="submit">Login</button></form><p class="note">Forgot your PIN? Contact the Main Admin for identity-checked reset.</p>`:
  `<form id="registerForm"><label>Full name</label><input name="name" maxlength="100" required><label>Mobile number</label><input name="mobile" maxlength="10" pattern="[6-9][0-9]{9}" inputmode="numeric" required><label>Reference person</label><input name="reference" maxlength="100" required><label>Monthly EMI (multiples of ₹100)</label><input name="emi" type="number" min="100" max="1000000" step="100" required><label>Create 4-digit PIN</label><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="new-password" required><label>Confirm PIN</label><input name="confirmPin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="new-password" required><label>Comments (optional)</label><textarea name="comments" maxlength="300"></textarea><label class="checkline"><input name="terms" type="checkbox" required> I agree to the organizer's approved terms and disclaimer.</label><p class="note ${server&&server.registrationOpen?'success-text':'warn-text'}">${server&&server.registrationOpen?'Registration is open. Main Admin approval is required after submission.':'Registration is currently closed. Contact the organizer for approved terms and reopening.'} No money is transferred by this website.</p><button class="primary" type="submit" ${server&&!server.registrationOpen?'disabled':''}>Submit Registration</button></form>`}
  </section>`);
  view.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>{authScreen=b.dataset.auth;message='';auth()});
  attachForm('loginForm',async v=>{const d=await api('login',{mobile:v.mobile,password:v.password});me=d;section='overview';message='';render()});
  attachForm('registerForm',async v=>{if(v.pin!==v.confirmPin)throw Error('PIN and Confirm PIN must match');const d=await api('registration',{name:v.name,mobile:v.mobile,reference:v.reference,emi:Number(v.emi),pin:v.pin,comments:v.comments,acceptedTerms:v.terms==='on'});authScreen='login';message=`<div class="msg info">Registration received (${esc(d.registrationId)}). Main Admin approval is required before login.</div>`;auth()});
}
function navAdmin(){return setTabs([['overview','Overview'],['registrations','Registrations'],['customers','Customers'],['groups','Groups'],['payments','Group Collections'],['security','PIN Reset'],['settings','Settings']])}
async function admin(){
 wrap(navAdmin()+`<div id="pane"><p class="empty">Reading Google Sheets…</p></div>`);attachTabs();const p=document.getElementById('pane');
 try{
 if(section==='overview'){
  const [r,c,g,b]=await Promise.all([api('admin.registrations'),api('admin.customers'),api('admin.groups'),api('admin.collections')]);
  p.innerHTML=`<div class="stats">${stat('Pending registrations',r.requests.filter(x=>x.status==='Pending Approval').length)}${stat('Customers',c.customers.length)}${stat('Groups',g.groups.length)}${stat('Monthly group EMI',rupee(g.groups.reduce((s,x)=>s+x.totalMonthlyEmi,0)))}${stat('Collections awaiting approval',b.collections.filter(x=>x.status==='Awaiting Admin').length)}</div>
  <section class="card"><h2>Admin workflow</h2><p class="hint">You verify <b>only each Group Leader’s combined collection</b>, never individual customer installments. The leader must first acknowledge each member payment.</p><p class="note">Registration: <b>${server&&server.registrationOpen?'Open':'Closed'}</b> · Payment entries: <b>${server&&server.paymentEntriesOpen?'Open':'Closed'}</b>. Main Admin can change these in <b>Settings</b>.</p><p class="note">Orders, refunds and final monetary credit rules are not activated in this integration.</p></section>`;
 }
 if(section==='settings'){
  const d=await api('admin.settings');
  const config=[
   ['registrationTermsConfirmed','Registration terms and privacy approved','Confirm only when approved customer registration terms and privacy notice are available to applicants.'],
   ['registrationEnabled','Customer registration','Controls new registrations. Also restricted to 09–30 November 2026.'],
   ['paymentPolicyConfirmed','Payment/refund/incomplete-EMI rules approved','Confirm only after payment terms, refund and incomplete-EMI rules, and relevant legal requirements are approved. This does not activate orders.'],
   ['paymentEntriesEnabled','Customer payment entries','Allows customers to record payments already made, within 09 November 2026 – 31 July 2027. The website itself does not collect money.'],
   ['groupCollectionsEnabled','Group Leader collection processing','Allows leaders to acknowledge member payments and submit group totals. Admin can still verify existing pending totals while this is paused.']
  ];
  const statusText=(enabled,open)=>enabled?(open?'On / currently active':'On / blocked by policy or date'):'Off';
  p.innerHTML=`<section class="card"><h2>Main Admin Settings</h2><p class="hint">Changes are saved to the <b>Settings</b> Google Sheet, take effect on the server immediately, and are recorded in Audit_Log. Only Main Admin can make changes.</p>
  <p class="note">Registrations allowed: <b>${d.registrationOpen?'Yes':'No'}</b> (${esc(d.registrationWindow)}). Payment entries allowed: <b>${d.paymentEntriesOpen?'Yes':'No'}</b> (${esc(d.paymentWindow)}).</p>
  <p class="note">Orders and refunds are not implemented, and cannot be switched on here.</p></section>
  <div class="grid2">${config.map(([key,label,desc])=>{
   const effective=key==='registrationEnabled'?d.registrationOpen:key==='paymentEntriesEnabled'?d.paymentEntriesOpen:key==='groupCollectionsEnabled'?d.groupCollectionsOpen:d[key];
   return `<section class="card"><h3>${esc(label)}</h3><p class="note">${esc(desc)}</p><p><b>${statusText(d[key],effective)}</b></p><button class="${d[key]?'ghost danger':'primary small'}" data-setting="${esc(key)}" data-enabled="${d[key]?'true':'false'}">Turn ${d[key]?'OFF':'ON'}</button></section>`;
  }).join('')}</div>`;
  p.querySelectorAll('[data-setting]').forEach(b=>b.onclick=async()=>{
   const key=b.dataset.setting,enabled=b.dataset.enabled!=='true';
   const isPolicy=key==='registrationTermsConfirmed'||key==='paymentPolicyConfirmed';
   const promptText=isPolicy&&enabled?
    (key==='registrationTermsConfirmed'?'Confirm you have independently approved registration terms and a privacy notice, and made them available to customers.':'Confirm payment, refund and incomplete-EMI rules plus relevant legal requirements have been independently reviewed and approved.'):
    `Turn ${enabled?'ON':'OFF'} ${config.find(c=>c[0]===key)[1]}?`;
   if(!confirm(promptText))return;
   b.disabled=true;
   try{await api('admin.updateSetting',{key,enabled,acknowledged:isPolicy&&enabled});server=await api('status');render()}
   catch(e){alert(e.message);b.disabled=false}
  });
 }
 if(section==='registrations'){
  const d=await api('admin.registrations');p.innerHTML=`<section class="card"><h2>Registration requests</h2>${table(['Name / mobile','Reference','Monthly EMI','Status','Action'],[...d.requests].reverse().map(x=>row(`<b>${esc(x.name)}</b><br><span class="note">${esc(x.mobile)}</span>`,esc(x.reference),rupee(x.emi),statusTag(x.status),x.status==='Pending Approval'?`<button class="ghost" data-approve="${esc(x.id)}">Approve</button> <button class="ghost danger" data-reject="${esc(x.id)}">Reject</button>`:'—')))}</section>`;
  p.querySelectorAll('[data-approve]').forEach(b=>b.onclick=async()=>{if(!confirm('Approve this registration and create a permanent Customer ID?'))return;try{const r=await api('admin.approve',{id:b.dataset.approve});alert('Approved: '+r.customerId);render()}catch(e){alert(e.message)}});
  p.querySelectorAll('[data-reject]').forEach(b=>b.onclick=async()=>{const reason=prompt('Reason for rejecting the registration?');if(reason===null)return;try{await api('admin.reject',{id:b.dataset.reject,reason});render()}catch(e){alert(e.message)}});
 }
 if(section==='customers'){
  const d=await api('admin.customers');p.innerHTML=`<section class="card"><h2>Customers</h2><p class="note">Individual payments are verified by their Group Leader; no member payment Verify buttons appear here.</p>${table(['Customer ID','Name','Mobile','Assigned Group','Status'],d.customers.map(x=>row(esc(x.id),esc(x.name),esc(x.mobile),esc(x.groupId||'Not assigned'),statusTag(x.status))))}</section>`;
 }
 if(section==='groups'){
  const [g,c]=await Promise.all([api('admin.groups'),api('admin.customers')]);
  const customers=c.customers,groups=g.groups;
  p.innerHTML=`<section class="card"><h2>Groups (aggregated monthly EMI only)</h2>${table(['Group','Members','Group monthly EMI','Verified collection','Leader'],groups.map(x=>row(`<b>${esc(x.name)}</b><br>${esc(x.id)}`,esc(x.members),rupee(x.totalMonthlyEmi),rupee(x.verifiedCash),esc(x.leaderCustomerId||'Not appointed'))))}</section>
  <div class="grid2"><section class="card"><h2>Create group</h2><form id="groupForm"><label>Group name</label><input name="name" required><label>Reference</label><input name="reference"><button class="primary" type="submit">Create Group</button></form></section>
  <section class="card"><h2>Assign customer</h2><form id="assignForm"><label>Customer</label><select name="customerId" required>${customers.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} (${esc(x.mobile)})</option>`).join('')}</select><label>Group</label><select name="groupId" required>${groups.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><button type="submit" class="primary">Assign</button></form></section>
  <section class="card"><h2>Appoint Group Leader</h2><p class="note">Assign the customer to their group first. Appointing a leader ends their previous login session.</p><form id="leaderForm"><label>Group</label><select name="groupId" required>${groups.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><label>Leader (approved customer)</label><select name="customerId" required>${customers.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} (${esc(x.id)})</option>`).join('')}</select><button class="primary" type="submit">Appoint Leader</button></form></section></div>`;
  attachForm('groupForm',async v=>{await api('admin.groupCreate',v);render()});attachForm('assignForm',async v=>{await api('admin.assign',v);render()});attachForm('leaderForm',async v=>{await api('admin.appointLeader',v);render()});
 }
 if(section==='payments'){
  const d=await api('admin.collections');p.innerHTML=`<section class="card"><h2>Group Leader collections</h2><p class="hint">Only group totals are shown here. Confirm receipt of the <b>full group amount</b> in cash or your bank account before verifying.</p>
   ${table(['Group','Collection amount','Payments combined','Remittance','Status','Review'],[...d.collections].reverse().map(x=>row(`${esc(x.groupName)}<br><span class="note">${esc(x.id)}</span>`,`<b>${rupee(x.amount)}</b>`,esc(x.paymentCount),`${esc(x.remittanceMethod)}<br>${esc(x.remittanceReference)}`,statusTag(x.status),x.status==='Awaiting Admin'?`<button class="ghost" data-verify="${esc(x.id)}">Verify total</button> <button class="ghost danger" data-rejectbatch="${esc(x.id)}">Reject</button>`:'—')))}</section>`;
  p.querySelectorAll('[data-verify]').forEach(b=>b.onclick=async()=>{if(!confirm('Have you independently received and reconciled the entire group amount?'))return;try{await api('admin.verifyCollection',{id:b.dataset.verify});render()}catch(e){alert(e.message)}});
  p.querySelectorAll('[data-rejectbatch]').forEach(b=>b.onclick=async()=>{const reason=prompt('Why is this group collection rejected?');if(reason===null)return;try{await api('admin.rejectCollection',{id:b.dataset.rejectbatch,reason});render()}catch(e){alert(e.message)}});
 }
 if(section==='security'){
  p.innerHTML=`<section class="card"><h2>Reset customer 4-digit PIN</h2><p class="note">Check the customer's identity outside the website before resetting. A temporary PIN is displayed once; the customer must change it after login. Every reset is audited.</p><form id="resetForm"><label>Registered mobile</label><input name="mobile" pattern="[6-9][0-9]{9}" inputmode="numeric" maxlength="10" required><label>Identity verification details / reason (minimum 10 characters)</label><textarea name="reason" minlength="10" maxlength="200" required></textarea><label class="checkline"><input name="identityVerified" type="checkbox" required> I have independently confirmed this customer's identity.</label><button class="primary" type="submit">Issue temporary PIN</button></form></section>`;
  attachForm('resetForm',async v=>{if(!confirm('Reset this customer’s PIN after identity verification?'))return;const d=await api('admin.resetPin',{mobile:v.mobile,reason:v.reason,identityVerified:v.identityVerified==='on'});alert('Temporary PIN (shown once): '+d.temporaryPin+'\nCustomer must change it on next login. Share securely.');render()});
 }
 }catch(e){p.innerHTML=error(e)}
}
function navCustomer(){return setTabs([['overview','Overview'],['record','Record Payment'],['history','My Payments'],['pin','Change PIN']])}
async function customer(){wrap(navCustomer()+`<div id="pane"><p class="empty">Loading your account…</p></div>`);attachTabs();const p=document.getElementById('pane');
 try{
  if(me.mustChangePin&&section!=='pin'){section='pin';return customer()}
  if(section==='pin'){
    p.innerHTML=`<section class="card"><h2>${me.mustChangePin?'Change your temporary PIN before continuing':'Change your PIN'}</h2><form id="pinForm"><label>Current 4-digit PIN</label><input name="currentPin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required><label>New 4-digit PIN</label><input name="newPin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required><label>Confirm new PIN</label><input name="confirm" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required><button class="primary" type="submit">Save PIN</button></form></section>`;
    attachForm('pinForm',async v=>{if(v.newPin!==v.confirm)throw Error('PINs do not match');await api('changePin',{currentPin:v.currentPin,newPin:v.newPin});await api('logout');me=null;authScreen='login';message='<div class="msg info">PIN changed. Please log in with the new PIN.</div>';auth()});return;
  }
  const d=await api('customer.dashboard'),c=d.customer;
  if(section==='overview')p.innerHTML=`<div class="stats">${stat('Customer ID',c.id)}${stat('Monthly EMI',rupee(c.emi))}${stat('First installment',rupee(c.emi*1.5))}${stat('Verified cash',rupee(d.verifiedCash))}${stat('Eligible credit so far',rupee(d.availableCredit))}</div><section class="card"><h2>${esc(c.name)}</h2><p>Group: ${d.group?esc(d.group.name):'Awaiting assignment'}</p><p class="note">Only payments confirmed through the Group Leader’s combined collection count toward verified EMI. Packing charge is excluded from order credit. The bonus is not automatic.</p><p class="note">Total planned cash payments: ${rupee(c.emi*9.5)} across nine installments.</p><button id="recordGo" class="primary small">Record a Payment</button></section>`;
  if(section==='overview')document.getElementById('recordGo').onclick=()=>{section='record';customer()};
  if(section==='record'){
    p.innerHTML=`<section class="card"><h2>Record a customer payment</h2><p class="hint">This form only reports money you already paid to your Group Leader. It does not transfer money. Your entry starts as <b>Awaiting Leader</b>.</p>
      <p class="note ${server&&server.paymentEntriesOpen?'success-text':'warn-text'}">${server&&server.paymentEntriesOpen?'Payment entries are open.':'Payment entries are currently closed by Main Admin or the date window.'}</p><form id="paymentForm"><label>EMI installment</label><select name="installment">${Array.from({length:9},(_,i)=>`<option value="${i+1}">${i+1} — ${i===0?'First installment':'Regular installment'} (${rupee(c.emi*(i===0?1.5:1))})</option>`).join('')}</select><label>Amount paid (₹)</label><input name="amount" type="number" min="0.01" step="0.01" required><label>Payment method</label><select name="mode"><option>Cash</option><option>Online</option></select><label>Payment reference / receipt (optional)</label><input name="reference" maxlength="120"><button class="primary" type="submit" ${server&&!server.paymentEntriesOpen?'disabled':''}>Submit Payment Entry</button></form></section>`;
    attachForm('paymentForm',async v=>{await api('customer.payment',{installment:Number(v.installment),amount:Number(v.amount),mode:v.mode,reference:v.reference});alert('Payment entry submitted. Awaiting your Group Leader.');section='history';customer()});
  }
  if(section==='history')p.innerHTML=`<section class="card"><h2>My payment entries</h2><p class="note">A customer submission is NOT a verified EMI until the Main Admin verifies its entire group collection.</p>${table(['Date','Installment','Amount','Method','Reference','Status'],[...d.payments].reverse().map(x=>row(when(x.createdAt),esc(x.installment),rupee(x.amount),esc(x.mode),esc(x.reference),statusTag(x.status))))}</section>`;
 }catch(e){p.innerHTML=error(e)}
}
function navLeader(){return setTabs([['overview','My Group'],['review','Member Payments'],['submit','Submit Group Collection'],['pin','Change PIN']])}
async function leader(){wrap(navLeader()+`<div id="pane"><p class="empty">Loading your group…</p></div>`);attachTabs();const p=document.getElementById('pane');
 try{
 if(me.mustChangePin&&section!=='pin'){section='pin';return leader()}
 if(section==='pin'){p.innerHTML=`<section class="card"><h2>Change PIN</h2><form id="pinForm"><label>Current 4-digit PIN</label><input name="currentPin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required><label>New 4-digit PIN</label><input name="newPin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required><label>Confirm new PIN</label><input name="confirm" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required><button class="primary" type="submit">Save PIN</button></form></section>`;attachForm('pinForm',async v=>{if(v.newPin!==v.confirm)throw Error('PINs do not match');await api('changePin',{currentPin:v.currentPin,newPin:v.newPin});await api('logout');me=null;message='<div class="msg info">PIN updated. Please log in again.</div>';auth()});return}
 const d=await api('leader.queue'),g=d.group;
 if(section==='overview')p.innerHTML=`<div class="stats">${stat('Group',g.name)}${stat('Members',g.members)}${stat('Group monthly EMI',rupee(g.totalMonthlyEmi))}${stat('Verified group collections',rupee(g.verifiedCash))}</div><section class="card"><h2>Assigned members</h2>${table(['Customer ID','Name','Monthly EMI'],d.members.map(c=>row(esc(c.id),esc(c.name),rupee(c.emi))))}</section>`;
 if(section==='review'){
  p.innerHTML=`<section class="card"><h2>Member payment verification</h2><p class="note">Check each member's cash or online receipt. Only acknowledged entries can be included in a combined group collection.</p>${table(['Member','Installment','Amount','Method / reference','Status','Action'],[...d.payments].reverse().map(x=>row(esc(x.memberName),esc(x.installment),rupee(x.amount),`${esc(x.mode)}<br>${esc(x.reference)}`,statusTag(x.status),x.status==='Awaiting Leader'?`<button class="ghost" data-ack="${esc(x.id)}">Acknowledge</button> <button class="ghost danger" data-reject="${esc(x.id)}">Reject</button>`:'—')))}</section>`;
  p.querySelectorAll('[data-ack]').forEach(b=>b.onclick=async()=>{if(!confirm('Have you received and checked this payment?'))return;try{await api('leader.ackPayment',{id:b.dataset.ack});render()}catch(e){alert(e.message)}});
  p.querySelectorAll('[data-reject]').forEach(b=>b.onclick=async()=>{const reason=prompt('Reason for rejection?');if(reason===null)return;try{await api('leader.rejectPayment',{id:b.dataset.reject,reason});render()}catch(e){alert(e.message)}});
 }
 if(section==='submit'){
  const eligible=d.payments.filter(x=>x.status==='Leader Verified');p.innerHTML=`<section class="card"><h2>Submit combined group collection</h2><p class="hint">Select member payments you have acknowledged and remit the <b>exact combined amount</b> to the Main Admin. Only one group total is presented for Main Admin verification.</p><form id="batchForm">${eligible.length?`<label>Include acknowledged member payments</label><div id="eligible">${eligible.map(x=>`<label class="checkline"><input type="checkbox" class="batchCheck" name="paymentIds" value="${esc(x.id)}" data-amount="${esc(x.amount)}" checked> ${esc(x.memberName)} · EMI ${esc(x.installment)} · ${rupee(x.amount)}</label>`).join('')}</div><p><b>Combined amount: <span id="batchTotal">—</span></b></p><label>Remittance method to Main Admin</label><select name="remittanceMethod"><option>Cash</option><option>Online</option></select><label>Remittance reference (optional)</label><input name="remittanceReference" maxlength="150"><button class="primary" type="submit">Submit Group Collection</button>`:'<p class="empty">No acknowledged member payments ready to submit.</p>'}</form></section><section class="card"><h2>Previous group submissions</h2>${table(['Date','Total','Payments','Status'],[...d.collections].reverse().map(x=>row(when(x.createdAt),rupee(x.amount),esc(x.paymentCount),statusTag(x.status))))}</section>`;
  const updateTotal=()=>{const total=[...p.querySelectorAll('.batchCheck:checked')].reduce((s,n)=>s+Number(n.dataset.amount),0);const target=p.querySelector('#batchTotal');if(target)target.textContent=rupee(total)};
  p.querySelectorAll('.batchCheck').forEach(x=>x.onchange=updateTotal);updateTotal();
  attachForm('batchForm',async v=>{const ids=[...p.querySelectorAll('.batchCheck:checked')].map(x=>x.value);if(!ids.length)throw Error('Choose one or more payments');const total=[...p.querySelectorAll('.batchCheck:checked')].reduce((s,n)=>s+Number(n.dataset.amount),0);if(!confirm('Have you remitted '+rupee(total)+' to Main Admin?'))return;await api('leader.collection',{paymentIds:ids,remittanceMethod:v.remittanceMethod,remittanceReference:v.remittanceReference});alert('Group collection submitted for Main Admin verification.');render()});
 }
 }catch(e){p.innerHTML=error(e)}
}
async function render(){logoutBtn.hidden=!me;if(!me)return auth();if(me.role==='admin')return admin();if(me.role==='leader')return leader();return customer()}
logoutBtn.onclick=async()=>{try{await api('logout')}catch{}me=null;section='overview';message='<div class="msg info">Logged out.</div>';auth()};
async function boot(){try{server=await api('status');conn.className='chip '+(server.sheetsConnected?'ok':'bad');conn.textContent=server.sheetsConnected?'Google Sheet connected':'Setup pending'}catch(e){conn.className='chip bad';conn.textContent='Connection unavailable';server=null}
 try{me=await api('me')}catch{me=null}
 render();}
boot();

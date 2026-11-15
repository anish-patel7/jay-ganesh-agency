/**
 * JAY GANESH AGENCY – PRIVATE GOOGLE SHEETS DATA GATEWAY
 * Apps Script V8. Bind this project to the organizer's Google Sheet.
 * Deploy as a Web App: execute as Me; access Anyone. Requests MUST be sent
 * through the private Vercel Function with API_SHARED_SECRET.
 * Keep financial/order operations disabled pending independent review.
 * IMPORTANT: Sheets is NOT a transactional database.
 */
const TZ = 'Asia/Kolkata';
const HEADERS = {
  Registration_Requests:['id','name','mobile','reference','emi','comments','acceptedTerms','status','createdAt','reviewedAt','reviewedBy','pinSalt','pinHash'],
  Customers:['id','name','mobile','reference','emi','groupId','bonusApproved','status','createdAt'],
  Direct_Order_Contacts:['id','name','mobile','createdAt'],
  Groups:['id','name','leaderCustomerId','reference','createdAt'],
  Group_Memberships:['id','customerId','groupId','startedAt','endedAt','reason','changedBy'],
  EMI_Schedule:['id','customerId','installment','dueAmount','dueDate'],
  Payments:['id','customerId','orderId','kind','installment','amount','mode','recipientId','status','submittedBy','createdAt','verifiedAt','verifiedBy','reference','leaderApprovedBy','leaderApprovedAt','leaderRejectedAt','batchId'],
  Transfers:['id','fromId','toId','amount','mode','status','submittedBy','createdAt','verifiedAt','verifiedBy','notes','kind','groupId','period'],
  Transfer_Allocations:['id','transferId','paymentId','amount'],
  Pricing_Master:['id','name','advertised','scheme','active','updatedAt'],
  Orders:['id','accountId','customerId','kind','type','status','listCount','createdAt','lockedAt','financialStatus','updatedAt'],
  Order_Boxes:['id','orderId','pricingId','quantity'],
  Order_Uploads:['id','orderId','driveFileId','filename','originalFilename','advertisedListValue','status','approvedBy','approvedAt','createdAt'],
  Order_Adjustments:['id','orderId','field','previousValue','newValue','reason','actorId','createdAt'],
  Refunds:['id','paymentId','customerId','amount','status','reason','createdAt','reviewedAt'],
  Audit_Log:['id','actor','action','entity','entityId','before','after','reason','createdAt'],
  Settings:['key','value','updatedAt','updatedBy'],
  Auth_Users:['id','mobile','passwordSalt','passwordHash','role','customerId','active','createdAt','authRev','mustChangePassword'],
  Customer_Summary:['customerId','name','monthlyEmi','paidCash','contributions','bonus','credit','remainingCash','updatedAt'],
  Group_Summary:['groupId','name','members','totalMonthlyEmi','verifiedCash','transfersConfirmed','updatedAt'],
  Group_Collections:['id','groupId','leaderId','amount','paymentIds','remittanceMethod','remittanceReference','status','createdAt','verifiedAt','verifiedBy','rejectedAt','rejectedBy','reason'],
  Login_Attempts:['key','failures','lockedUntil','updatedAt']
};
const BOXES = [[4000,2000,'Standard ₹4,000'],[6000,3000,'Standard ₹6,000'],[8000,4000,'Standard ₹8,000'],[10000,5000,'Standard ₹10,000'],[12000,6000,'Standard ₹12,000'],[15000,7500,'New Arrival Fancy'],[20000,10000,'Standard ₹20,000'],[30000,15000,'Diwali Special (Fully Fancy & Out)']];

function prop(k){ return PropertiesService.getScriptProperties().getProperty(k)||''; }
function fail(message,code){const e=new Error(message);e.code=code||'BAD_REQUEST';throw e;}
function uid(prefix){return prefix+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,14).toUpperCase();}
function stamp(){return new Date().toISOString();}
function dateIST(){return Utilities.formatDate(new Date(),TZ,'yyyy-MM-dd');}
function isMobile(x){return /^[6-9][0-9]{9}$/.test(String(x||''));}
function isPin(x){return /^[0-9]{4}$/.test(String(x||''));}
function money(x){let n=Number(x);if(!Number.isFinite(n)||n<=0||n>10000000||Math.round(n*100)!==n*100)fail('Invalid payment amount');return Math.round(n*100)/100;}
function safe(s,max){return String(s===undefined?'':s).trim().slice(0,max||200);}
function asText(x){return (typeof x==='string'&&/^[=+\-@]/.test(x))?"'"+x:x;}
function sheet(name){const ss=SpreadsheetApp.openById(prop('SPREADSHEET_ID'));const s=ss.getSheetByName(name);if(!s)fail('Missing worksheet '+name,'SETUP');return s;}
function all(name){const s=sheet(name),end=s.getLastRow();if(end<2)return [];const keys=HEADERS[name],data=s.getRange(2,1,end-1,keys.length).getValues();return data.map((a,i)=>Object.assign({__row:i+2},Object.fromEntries(keys.map((k,n)=>[k,a[n]===null?'':a[n]])))).filter(x=>String(x[keys[0]])!=='');}
function one(name,id,key){return all(name).find(x=>String(x[key||'id'])===String(id))||null;}
function put(name,data){const s=sheet(name);s.appendRow(HEADERS[name].map(k=>asText(data[k]===undefined?'':data[k])));return data;}
function change(name,id,values,key){const s=sheet(name),row=one(name,id,key);if(!row)fail('Record not found','NOT_FOUND');const next=Object.assign({},row,values);s.getRange(row.__row,1,1,HEADERS[name].length).setValues([HEADERS[name].map(k=>asText(next[k]===undefined?'':next[k]))]);return next;}
function audit(actor,action,entity,entityId,before,after,reason){put('Audit_Log',{id:uid('AUD'),actor,action,entity,entityId,before:JSON.stringify(before||{}).slice(0,2000),after:JSON.stringify(after||{}).slice(0,2000),reason:reason||'',createdAt:stamp()});}
function locked(fn){const l=LockService.getScriptLock();l.waitLock(20000);try{return fn();}finally{l.releaseLock();}}
function preflight(){if(!prop('SPREADSHEET_ID')||!prop('API_SHARED_SECRET')||!prop('PIN_PEPPER'))fail('Configuration incomplete','SETUP');}
// Website controls live in the existing Settings worksheet, not in Vercel environment variables.
// Old Script Properties are read ONLY as migration defaults until the Admin saves each setting.
// All customer-facing operations are checked again server-side on each request.
function settingEnabled(key,legacyDefault){const r=one('Settings',key,'key');return r?String(r.value)==='true':legacyDefault;}
function openWindow(start,end){const d=dateIST();return d>=start&&d<=end;}
function siteSettings(){
 const legacyPolicy=prop('POLICY_APPROVED')==='true',legacyEnabled=prop('OPERATIONS_ENABLED')==='true';
 // Read Settings in one Sheets request instead of opening the worksheet five times.
 const saved=Object.fromEntries(all('Settings').map(x=>[String(x.key),String(x.value)==='true']));
 const enabled=(key,fallback)=>Object.prototype.hasOwnProperty.call(saved,key)?saved[key]:fallback;
 const rTerms=enabled('registrationTermsConfirmed',legacyPolicy);
 const pPolicy=enabled('paymentPolicyConfirmed',legacyPolicy);
 const registrationEnabled=enabled('registrationEnabled',legacyEnabled);
 const paymentEntriesEnabled=enabled('paymentEntriesEnabled',legacyEnabled);
 const groupCollectionsEnabled=enabled('groupCollectionsEnabled',legacyEnabled);
 // No fixed date windows: Main Admin's Live/Stop switches decide (with policy approvals).
 const registrationWithinDates=true;
 const paymentWithinDates=true;
 return {
  registrationTermsConfirmed:rTerms,paymentPolicyConfirmed:pPolicy,
  registrationEnabled,paymentEntriesEnabled,groupCollectionsEnabled,
  registrationWithinDates,paymentWithinDates,
  registrationOpen:rTerms&&registrationEnabled&&registrationWithinDates,
  paymentEntriesOpen:pPolicy&&paymentEntriesEnabled&&paymentWithinDates,
  groupCollectionsOpen:pPolicy&&groupCollectionsEnabled,
  registrationWindow:'Controlled by Main Admin',paymentWindow:'Controlled by Main Admin',
  ordersEnabled:false,refundsEnabled:false,fireworksLegalClearance:prop('FIREWORKS_LEGAL_CLEARANCE')==='true'
 };
}
function allowRegistration(){const s=siteSettings();if(!s.registrationOpen)fail('Registration currently closed. Main Admin has stopped registration.','CLOSED');}
function allowPayment(){const s=siteSettings();if(!s.paymentEntriesOpen)fail('Payment submissions currently closed. Main Admin has stopped payment entries.','CLOSED');}
function allowGroupCollection(){if(!siteSettings().groupCollectionsOpen)fail('Group collection processing currently paused by Main Admin','CLOSED');}
function adminSettings(req){getActor(req,'admin');return siteSettings();}
function updateAdminSetting(req){getActor(req,'admin');
 const keys=['registrationTermsConfirmed','paymentPolicyConfirmed','registrationEnabled','paymentEntriesEnabled','groupCollectionsEnabled'];
 const key=String(req.key||'');if(!keys.includes(key)||typeof req.enabled!=='boolean')fail('Invalid setting');
 if(req.enabled&&['registrationTermsConfirmed','paymentPolicyConfirmed'].includes(key)&&req.acknowledged!==true)fail('Confirm that the applicable customer terms and policies have been independently approved');
 return locked(()=>{
  const current=siteSettings();
  if(req.enabled&&key==='registrationEnabled'&&!current.registrationTermsConfirmed)fail('Approve and publish registration terms and privacy notice before enabling registration','CONFLICT');
  if(req.enabled&&['paymentEntriesEnabled','groupCollectionsEnabled'].includes(key)&&!current.paymentPolicyConfirmed)fail('Approve incomplete-EMI/refund/payment rules and applicable legal requirements first','CONFLICT');
  const existing=one('Settings',key,'key');const before=existing?String(existing.value):String(current[key]);const value=String(req.enabled);
  if(existing)change('Settings',key,{value,updatedAt:stamp(),updatedBy:'admin'},'key');
  else put('Settings',{key,value,updatedAt:stamp(),updatedBy:'admin'});
  audit('admin','settings.update','Settings',key,{value:before},{value},'Changed from Main Admin dashboard');
  return siteSettings();
 });
}
function publicCustomer(x){return {id:String(x.id),name:String(x.name),mobile:String(x.mobile),reference:String(x.reference),groupId:String(x.groupId||''),status:String(x.status),emi:Number(x.emi||0)};}
function ownCustomer(actor){const c=one('Customers',actor.customerId);if(!c||c.status!=='Approved')fail('Customer not active','FORBIDDEN');return c;}
function roleOf(customerId){return all('Groups').some(g=>g.leaderCustomerId===customerId)?'leader':'customer';}
function getActor(req,role){const a=req.actor;if(!a||!a.mobile||!a.authRev)fail('Sign in required','UNAUTHORIZED');
  if(a.role==='admin'){
    if(a.mobile!==prop('ADMIN_MOBILE')||String(a.authRev)!==String(prop('ADMIN_REV')||'1'))fail('Session expired','UNAUTHORIZED');
    if(role&&role!=='admin')fail('Access denied','FORBIDDEN');return a;
  }
  const u=one('Auth_Users',a.mobile,'mobile');if(!u||u.active!==true&&String(u.active)!=='true'||String(u.authRev)!==String(a.authRev)||u.customerId!==a.customerId)fail('Session expired','UNAUTHORIZED');
  const realRole=roleOf(u.customerId);if(a.role!==realRole)fail('Role changed. Sign in again.','UNAUTHORIZED');
  if(role&&role!==realRole&&!(role==='customer'&&realRole==='leader'))fail('Access denied','FORBIDDEN');
  if(String(u.mustChangePassword)==='true'&&!req.allowPinChange)fail('Change your temporary PIN first','PIN_CHANGE_REQUIRED');
  return a;
}
function hex(bytes){return bytes.map(b=>('0'+(b<0?b+256:b).toString(16)).slice(-2)).join('');}
function pinDigest(pin,salt){let input=salt+'|'+pin+'|'+prop('PIN_PEPPER');let d=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,input);for(let i=0;i<900;i++)d=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,d);return hex(d);}
function hashPin(pin){if(!isPin(pin))fail('PIN must have exactly four digits');const salt=Utilities.getUuid()+'-'+Utilities.getUuid();return {salt,hash:pinDigest(pin,salt)};}
function equals(a,b){a=String(a||'');b=String(b||'');let v=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)v|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return v===0;}
function attemptKey(m){return 'mobile:'+m;}
function checkAttempt(m){const x=one('Login_Attempts',attemptKey(m),'key');if(x&&Date.parse(x.lockedUntil||'')>Date.now())fail('Too many attempts. Try again later.','RATE_LIMIT');}
function registerFailure(m){const key=attemptKey(m),x=one('Login_Attempts',key,'key'),count=Number(x&&x.failures||0)+1,patch={failures:count>=5?0:count,lockedUntil:count>=5?new Date(Date.now()+30*60000).toISOString():'',updatedAt:stamp()};if(x)change('Login_Attempts',key,patch,'key');else put('Login_Attempts',Object.assign({key},patch));}
function clearFailure(m){const x=one('Login_Attempts',attemptKey(m),'key');if(x)change('Login_Attempts',attemptKey(m),{failures:0,lockedUntil:'',updatedAt:stamp()},'key');}
function login(req){return locked(()=>{const mobile=safe(req.mobile,10),password=String(req.password||req.pin||'');if(!isMobile(mobile))fail('Wrong mobile number or PIN / password','UNAUTHORIZED');checkAttempt(mobile);
  if(mobile===prop('ADMIN_MOBILE')){
    const salt=prop('ADMIN_PASSWORD_SALT'),hash=prop('ADMIN_PASSWORD_HASH');const ok=salt&&hash&&password.length>=14&&equals(pinDigest(password,salt),hash);
    if(!ok){registerFailure(mobile);fail('Wrong mobile number or PIN / password','UNAUTHORIZED');}
    clearFailure(mobile);return {role:'admin',mobile,authRev:prop('ADMIN_REV')||'1'};
  }
  const u=one('Auth_Users',mobile,'mobile');if(!u||String(u.active)!=='true'||!isPin(password)||!equals(pinDigest(password,u.passwordSalt),u.passwordHash)){
    registerFailure(mobile);fail('Wrong mobile number or PIN / password','UNAUTHORIZED');}
  const c=one('Customers',u.customerId);if(!c||c.status!=='Approved')fail('Account pending approval','FORBIDDEN');
  clearFailure(mobile);return {role:roleOf(u.customerId),mobile,customerId:u.customerId,authRev:String(u.authRev||'1'),mustChangePin:String(u.mustChangePassword)==='true'};
});}
function register(req){allowRegistration();return locked(()=>{
 const name=safe(req.name,100),mobile=safe(req.mobile,10),ref=safe(req.reference,100),emi=Number(req.emi),pin=String(req.pin||'');
 if(name.length<2||!isMobile(mobile)||!ref||!(emi>0&&emi%100===0&&emi<=1000000)||!isPin(pin)||req.acceptedTerms!==true)fail('Check registration fields, 4-digit PIN, EMI and terms');
 if(mobile===prop('ADMIN_MOBILE')||all('Customers').some(x=>x.mobile===mobile)||all('Registration_Requests').some(x=>x.mobile===mobile&&x.status!=='Rejected'))fail('Mobile number already registered','CONFLICT');
 const h=hashPin(pin),r={id:uid('REG'),name,mobile,reference:ref,emi,comments:safe(req.comments,300),acceptedTerms:'true',status:'Pending Approval',createdAt:stamp(),pinSalt:h.salt,pinHash:h.hash};
 put('Registration_Requests',r);audit('customer-registration','registration.create','Registration_Requests',r.id,null,{mobile,name},'');return {registrationId:r.id,status:r.status};
});}
function approve(req){getActor(req,'admin');return locked(()=>{
 const r=one('Registration_Requests',req.id);if(!r||r.status!=='Pending Approval')fail('Registration no longer pending','CONFLICT');
 if(all('Customers').some(x=>x.mobile===r.mobile))fail('Customer already exists','CONFLICT');
 const id=uid('JGA'),now=stamp();put('Customers',{id,name:r.name,mobile:r.mobile,reference:r.reference,emi:r.emi,groupId:'',bonusApproved:'false',status:'Approved',createdAt:now});
 const h=r.pinSalt&&r.pinHash?{salt:r.pinSalt,hash:r.pinHash}:hashPin(String(Math.floor(Math.random()*10000)).padStart(4,'0'));
 put('Auth_Users',{id:uid('USR'),mobile:r.mobile,passwordSalt:h.salt,passwordHash:h.hash,role:'customer',customerId:id,active:'true',createdAt:now,authRev:'1',mustChangePassword:(!r.pinSalt||!r.pinHash)?'true':'false'});
 for(let i=1;i<=9;i++)put('EMI_Schedule',{id:uid('EMI'),customerId:id,installment:i,dueAmount:Number(r.emi)*(i===1?1.5:1),dueDate:i===1?'2026-11-30':Utilities.formatDate(new Date(2026,10+i,0),TZ,'yyyy-MM-dd')});
 change('Registration_Requests',r.id,{status:'Approved',reviewedAt:now,reviewedBy:'admin',pinSalt:'',pinHash:''});
 audit('admin','registration.approve','Customers',id,null,{mobile:r.mobile},'');return {customerId:id};
});}
function reject(req){getActor(req,'admin');return locked(()=>{const r=one('Registration_Requests',req.id);if(!r||r.status!=='Pending Approval')fail('Not pending','CONFLICT');change('Registration_Requests',r.id,{status:'Rejected',reviewedAt:stamp(),reviewedBy:'admin',pinSalt:'',pinHash:''});audit('admin','registration.reject','Registration_Requests',r.id,null,{mobile:r.mobile},safe(req.reason,200));return {rejected:true};});}
function createGroup(req){getActor(req,'admin');return locked(()=>{const name=safe(req.name,100);if(name.length<2)fail('Group name required');const g={id:uid('GRP'),name,leaderCustomerId:'',reference:safe(req.reference,100),createdAt:stamp()};put('Groups',g);audit('admin','group.create','Groups',g.id,null,g,'');return {group:g};});}
function assign(req){getActor(req,'admin');return locked(()=>{
 const c=one('Customers',req.customerId),g=one('Groups',req.groupId);if(!c||!g)fail('Unknown customer or group','NOT_FOUND');const before=c.groupId||'';if(before&&before!==g.id){const previous=one('Groups',before);if(previous&&previous.leaderCustomerId===c.id)fail('Replace this group leader before moving the customer','CONFLICT');}
 if(before===g.id)return {customerId:c.id,groupId:g.id};
 change('Customers',c.id,{groupId:g.id});const mem=all('Group_Memberships').filter(x=>x.customerId===c.id&&!x.endedAt);for(const m of mem)change('Group_Memberships',m.id,{endedAt:stamp()});
 put('Group_Memberships',{id:uid('MEM'),customerId:c.id,groupId:g.id,startedAt:stamp(),endedAt:'',reason:'Admin assignment',changedBy:'admin'});
 audit('admin','group.assign','Customers',c.id,{groupId:before},{groupId:g.id},'');return {customerId:c.id,groupId:g.id};
});}
function appoint(req){getActor(req,'admin');return locked(()=>{
 const g=one('Groups',req.groupId),c=one('Customers',req.customerId);if(!g||!c||c.groupId!==g.id)fail('Leader must be a member of this group');
 change('Groups',g.id,{leaderCustomerId:c.id});const a=one('Auth_Users',c.mobile,'mobile');if(a)change('Auth_Users',c.mobile,{authRev:String(Number(a.authRev||1)+1)},'mobile');
 if(g.leaderCustomerId){const prior=one('Customers',g.leaderCustomerId),user=prior&&one('Auth_Users',prior.mobile,'mobile');if(user)change('Auth_Users',prior.mobile,{authRev:String(Number(user.authRev||1)+1)},'mobile');}
 audit('admin','group.leader','Groups',g.id,{leaderCustomerId:g.leaderCustomerId},{leaderCustomerId:c.id},'');return {groupId:g.id,leaderCustomerId:c.id};
});}
function groupSummary(){const customers=all('Customers'),payments=all('Payments');return all('Groups').map(g=>{const members=customers.filter(c=>c.groupId===g.id);return {id:g.id,name:g.name,leaderCustomerId:g.leaderCustomerId,reference:g.reference,members:members.length,totalMonthlyEmi:members.reduce((s,c)=>s+Number(c.emi||0),0),verifiedCash:payments.filter(p=>p.status==='Verified'&&members.some(c=>c.id===p.customerId)).reduce((s,p)=>s+Number(p.amount||0),0)};});}
function groupOfLeader(actor){const c=ownCustomer(actor),g=all('Groups').find(x=>x.leaderCustomerId===c.id);if(!g)fail('Not a current Group Leader','FORBIDDEN');return g;}
function customerDashboard(req){const a=getActor(req,'customer'),c=ownCustomer(a),p=all('Payments').filter(x=>x.customerId===c.id);const verified=p.filter(x=>x.status==='Verified').reduce((sum,x)=>sum+Number(x.amount),0);const pack=Number(c.emi)*0.5;const firstPaid=p.filter(x=>x.status==='Verified'&&Number(x.installment)===1).reduce((sum,x)=>sum+Number(x.amount),0);const contribution=Math.max(0,verified-Math.min(pack,firstPaid));const fullyPaid=Array.from({length:9},(_,i)=>p.filter(x=>x.status==='Verified'&&Number(x.installment)===i+1).reduce((sum,x)=>sum+Number(x.amount),0)>=Number(c.emi)*(i===0?1.5:1)-0.001).every(Boolean);const bonus=fullyPaid&&c.bonusApproved==='true';return {customer:publicCustomer(c),payments:p.map(paymentView),verifiedCash:verified,verifiedContributions:contribution,bonusApproved:bonus,availableCredit:contribution+(bonus?Number(c.emi):0),group:c.groupId?all('Groups').find(x=>x.id===c.groupId)||null:null};}
function paymentView(p){return {id:p.id,customerId:p.customerId,installment:Number(p.installment),amount:Number(p.amount),mode:p.mode,reference:p.reference,status:p.status,createdAt:p.createdAt};}
function submitPayment(req){allowPayment();const a=getActor(req,'customer');return locked(()=>{
 const c=ownCustomer(a);if(!c.groupId)fail('Wait for Main Admin to assign your group','CONFLICT');const g=one('Groups',c.groupId);if(!g||!g.leaderCustomerId)fail('Group Leader has not been appointed','CONFLICT');
 const installment=Number(req.installment),amount=money(req.amount),mode=safe(req.mode,20),reference=safe(req.reference,120);
 if(!Number.isInteger(installment)||installment<1||installment>9||!['Cash','Online'].includes(mode))fail('Invalid installment or mode');
 const due=Number(c.emi)*(installment===1?1.5:1),used=all('Payments').filter(x=>x.customerId===c.id&&Number(x.installment)===installment&&!['Leader Rejected','Rejected'].includes(x.status)).reduce((s,x)=>s+Number(x.amount),0);
 if(Math.round((used+amount)*100)>Math.round(due*100))fail('Amount exceeds remaining installment amount','CONFLICT');
 const p={id:uid('PAY'),customerId:c.id,orderId:'',kind:'EMI',installment,amount,mode,recipientId:g.leaderCustomerId,status:c.id===g.leaderCustomerId?'Leader Self-Declared':'Awaiting Leader',submittedBy:c.id,createdAt:stamp(),reference,leaderApprovedBy:'',leaderApprovedAt:'',leaderRejectedAt:'',batchId:''};put('Payments',p);
 audit(c.id,'payment.submit','Payments',p.id,null,{amount,installment,mode,status:p.status},'');return {payment:paymentView(p)};
});}
function leaderQueue(req){
 const a=getActor(req,'leader'),g=groupOfLeader(a);
 const members=all('Customers').filter(c=>c.groupId===g.id);
 const memberById=Object.fromEntries(members.map(c=>[String(c.id),c]));
 const payments=all('Payments').filter(p=>Object.prototype.hasOwnProperty.call(memberById,String(p.customerId)));
 // Compute group total from the rows already fetched, not another groupSummary() read.
 const group={id:g.id,name:g.name,leaderCustomerId:g.leaderCustomerId,reference:g.reference,
  members:members.length,totalMonthlyEmi:members.reduce((s,c)=>s+Number(c.emi||0),0),
  verifiedCash:payments.filter(p=>p.status==='Verified').reduce((s,p)=>s+Number(p.amount||0),0)};
 return {group,members:members.map(publicCustomer),leaderCustomerId:a.customerId,
  payments:payments.map(p=>Object.assign(paymentView(p),{memberName:memberById[String(p.customerId)].name||'',isOwnPayment:String(p.customerId)===String(a.customerId)})),
  collections:all('Group_Collections').filter(x=>x.groupId===g.id).map(collectionView)};
}
function reviewPayment(req,approve){allowGroupCollection();const a=getActor(req,'leader');return locked(()=>{
 const g=groupOfLeader(a),p=one('Payments',req.id),c=p&&one('Customers',p.customerId);if(!p||!c||c.groupId!==g.id||!['Awaiting Leader','Leader Self-Declared'].includes(p.status))fail('This payment is not awaiting your review','CONFLICT');
 if(String(p.customerId)===String(a.customerId))fail('You cannot approve your own payment. Add it to a group collection and let Main Admin verify the combined remittance.','FORBIDDEN');
 const next=approve?'Leader Verified':'Leader Rejected';change('Payments',p.id,{status:next,leaderApprovedBy:approve?a.customerId:'',leaderApprovedAt:approve?stamp():'',leaderRejectedAt:approve?'':stamp()});
 audit(a.customerId,'payment.'+(approve?'acknowledge':'reject'),'Payments',p.id,{status:p.status},{status:next},safe(req.reason,150));return {status:next};
});}
function collectionView(b){return {id:b.id,groupId:b.groupId,leaderId:b.leaderId,amount:Number(b.amount),paymentCount:String(b.paymentIds||'').split(',').filter(Boolean).length,remittanceMethod:b.remittanceMethod,remittanceReference:b.remittanceReference,status:b.status,createdAt:b.createdAt};}
function createCollection(req){allowGroupCollection();const a=getActor(req,'leader');return locked(()=>{
 const g=groupOfLeader(a),members=all('Customers').filter(c=>c.groupId===g.id).map(c=>c.id),ids=Array.isArray(req.paymentIds)?req.paymentIds.map(String):[];
 if(!ids.length||ids.length>100||new Set(ids).size!==ids.length)fail('Select acknowledged payments');
 // Member payments require independent leader acknowledgement; leader's own payment
 // may only be self-declared and is verified ONLY as part of the Admin-approved total.
 const eligible=all('Payments').filter(p=>ids.includes(p.id)&&members.includes(p.customerId)&&(
   p.status==='Leader Verified'||(String(p.customerId)===String(a.customerId)&&['Leader Self-Declared','Awaiting Leader'].includes(p.status))));
 if(eligible.length!==ids.length)fail('Payment selection changed; refresh','CONFLICT');
 const method=safe(req.remittanceMethod,20),reference=safe(req.remittanceReference,150);if(!['Cash','Online'].includes(method))fail('Choose remittance method');
 const amount=Math.round(eligible.reduce((sum,p)=>sum+Number(p.amount),0)*100)/100;
 const b={id:uid('COL'),groupId:g.id,leaderId:a.customerId,amount,paymentIds:ids.join(','),remittanceMethod:method,remittanceReference:reference,status:'Awaiting Admin',createdAt:stamp()};put('Group_Collections',b);
 for(const p of eligible)change('Payments',p.id,{status:'In Group Submission',batchId:b.id});audit(a.customerId,'collection.submit','Group_Collections',b.id,null,{groupId:g.id,amount,paymentIds:ids},'');return {collection:collectionView(b)};
});}
function adminCollections(req){getActor(req,'admin');const groups=groupSummary(),rows=all('Group_Collections');return {collections:rows.map(b=>Object.assign(collectionView(b),{groupName:(groups.find(g=>g.id===b.groupId)||{}).name||b.groupId}))};}
function adminOverview(req){
 getActor(req,'admin');const registrations=all('Registration_Requests'),customers=all('Customers'),groups=all('Groups'),collections=all('Group_Collections');
 const groupIds=new Set(groups.map(g=>String(g.id)));
 return {pendingRegistrations:registrations.filter(x=>x.status==='Pending Approval').length,
  customers:customers.length,groups:groups.length,
  monthlyGroupEmi:customers.filter(c=>groupIds.has(String(c.groupId))).reduce((s,c)=>s+Number(c.emi||0),0),
  pendingCollections:collections.filter(x=>x.status==='Awaiting Admin').length};
}
function reviewCollection(req,approved){getActor(req,'admin');return locked(()=>{
 const b=one('Group_Collections',req.id);if(!b||b.status!=='Awaiting Admin')fail('This collection is not awaiting verification','CONFLICT');
 const ids=String(b.paymentIds).split(',').filter(Boolean),ps=all('Payments').filter(p=>ids.includes(p.id));
 if(ps.length!==ids.length||ps.some(p=>p.batchId!==b.id||p.status!=='In Group Submission'))fail('Payment rows do not match collection; stop for reconciliation','CONFLICT');
 const sum=Math.round(ps.reduce((s,p)=>s+Number(p.amount),0)*100)/100;if(sum!==Number(b.amount))fail('Collection total mismatch; stop for reconciliation','CONFLICT');
 if(approved){for(const p of ps)change('Payments',p.id,{status:'Verified',verifiedAt:stamp(),verifiedBy:'admin'});change('Group_Collections',b.id,{status:'Verified',verifiedAt:stamp(),verifiedBy:'admin'});}
 else{for(const p of ps)change('Payments',p.id,{status:String(p.customerId)===String(b.leaderId)?'Leader Self-Declared':'Leader Verified',batchId:''});change('Group_Collections',b.id,{status:'Rejected',rejectedAt:stamp(),rejectedBy:'admin',reason:safe(req.reason,200)});}
 audit('admin',approved?'collection.verify':'collection.reject','Group_Collections',b.id,{status:b.status},{status:approved?'Verified':'Rejected',amount:b.amount},safe(req.reason,200));return {status:approved?'Verified':'Rejected'};
});}
function resetPin(req){getActor(req,'admin');return locked(()=>{if(req.identityVerified!==true||safe(req.reason,200).length<10)fail('Confirm identity and write a reason (at least 10 characters)');
 const u=one('Auth_Users',req.mobile,'mobile');if(!u)fail('User not found','NOT_FOUND');const candidate=String(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,8),16)%10000).padStart(4,'0'),h=hashPin(candidate);
 change('Auth_Users',u.mobile,{passwordSalt:h.salt,passwordHash:h.hash,authRev:String(Number(u.authRev||'1')+1),mustChangePassword:'true'},'mobile');clearFailure(u.mobile);
 audit('admin','pin.reset','Auth_Users',u.id,null,{mobile:u.mobile},safe(req.reason,200));return {temporaryPin:candidate};
});}
function changePin(req){req.allowPinChange=true;const a=getActor(req);if(a.role==='admin')fail('Use strong Admin password setup; do not use a 4-digit PIN','FORBIDDEN');return locked(()=>{
 const u=one('Auth_Users',a.mobile,'mobile');if(!equals(pinDigest(String(req.currentPin),u.passwordSalt),u.passwordHash)||!isPin(req.newPin))fail('Incorrect old PIN or invalid new PIN','UNAUTHORIZED');const h=hashPin(String(req.newPin));change('Auth_Users',a.mobile,{passwordSalt:h.salt,passwordHash:h.hash,authRev:String(Number(u.authRev||1)+1),mustChangePassword:'false'},'mobile');audit(a.customerId,'pin.change','Auth_Users',u.id,null,{updated:true},'');return {changed:true};
});}
function currentUser(req){req.allowPinChange=true;const a=getActor(req);return {role:a.role,mobile:a.mobile,customerId:a.customerId||'',mustChangePin:!!a.mustChangePin};}
function adminRegistrations(req){getActor(req,'admin');return {requests:all('Registration_Requests').map(x=>({id:x.id,name:x.name,mobile:x.mobile,reference:x.reference,emi:Number(x.emi||0),comments:x.comments,status:x.status,createdAt:x.createdAt}))};}
function customerList(req){getActor(req,'admin');return {customers:all('Customers').map(publicCustomer)};}
function groupList(req){getActor(req,'admin');return {groups:groupSummary()};}
function status(){preflight();SpreadsheetApp.openById(prop('SPREADSHEET_ID')).getName();const configured=!!prop('ADMIN_PASSWORD_HASH');return Object.assign({sheetsConnected:true,adminConfigured:configured,backend:'Google Apps Script',note:'Money is not collected by this website. Orders and refunds remain disabled.'},siteSettings());}
function run(action,req){preflight();req.allowPinChange=action==='me'||action==='changePin';switch(action){
 case 'status':return status();
 case 'login':return login(req);
 case 'me':return currentUser(req);
 case 'registration':return register(req);
 case 'admin.overview':return adminOverview(req);
 case 'admin.settings':return adminSettings(req);
 case 'admin.updateSetting':return updateAdminSetting(req);
 case 'admin.registrations':return adminRegistrations(req);
 case 'admin.approve':return approve(req);
 case 'admin.reject':return reject(req);
 case 'admin.customers':return customerList(req);
 case 'admin.groups':return groupList(req);
 case 'admin.groupCreate':return createGroup(req);
 case 'admin.assign':return assign(req);
 case 'admin.appointLeader':return appoint(req);
 case 'admin.collections':return adminCollections(req);
 case 'admin.verifyCollection':return reviewCollection(req,true);
 case 'admin.rejectCollection':return reviewCollection(req,false);
 case 'admin.resetPin':return resetPin(req);
 case 'customer.dashboard':return customerDashboard(req);
 case 'customer.payment':return submitPayment(req);
 case 'leader.queue':return leaderQueue(req);
 case 'leader.ackPayment':return reviewPayment(req,true);
 case 'leader.rejectPayment':return reviewPayment(req,false);
 case 'leader.collection':return createCollection(req);
 case 'changePin':return changePin(req);
 default:fail('Operation unavailable','NOT_FOUND');
}}
function doGet(){return ContentService.createTextOutput('Jay Ganesh Agency data gateway. No public access.');}
function doPost(e){let answer;try{const req=JSON.parse(e&&e.postData&&e.postData.contents||'{}');const expected=prop('API_SHARED_SECRET');if(!expected||expected.length<32||!equals(req.sharedSecret,expected))fail('Unauthorized','UNAUTHORIZED');answer={ok:true,data:run(String(req.action||''),req)};}catch(err){const allowed=['UNAUTHORIZED','BAD_REQUEST','FORBIDDEN','CONFLICT','CLOSED','NOT_FOUND','RATE_LIMIT','SETUP','PIN_CHANGE_REQUIRED'];const code=allowed.includes(err.code)?err.code:'SERVER_ERROR';if(code==='SERVER_ERROR')console.error('JGA internal error',err&&err.stack||err);answer={ok:false,error:code==='SERVER_ERROR'?'Service error; contact administrator':err.message,code};}return ContentService.createTextOutput(JSON.stringify(answer)).setMimeType(ContentService.MimeType.JSON);}
/** Run from Apps Script editor ONCE after setting Script Properties. */
function initializeJayGanesh(){preflight();const p=PropertiesService.getScriptProperties();const pass=prop('ADMIN_PASSWORD');if(pass&&pass.length<14)throw new Error('ADMIN_PASSWORD must contain at least 14 characters');
  locked(()=>{const ss=SpreadsheetApp.openById(prop('SPREADSHEET_ID'));for(const name of Object.keys(HEADERS)){
    let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);
    const expected=HEADERS[name],head=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),expected.length)).getDisplayValues()[0];
    if(!head.some(Boolean)){sh.getRange(1,1,1,expected.length).setValues([expected]);sh.setFrozenRows(1);}
    else{const have=head.slice(0,sh.getLastColumn());if(have.length>expected.length||have.some((h,i)=>h!==expected[i]))throw new Error('Header mismatch in '+name+'; STOP and check migration before proceeding');if(have.length<expected.length)sh.getRange(1,1,1,expected.length).setValues([expected]);}
  }
  if(sheet('Pricing_Master').getLastRow()===1)for(let i=0;i<BOXES.length;i++)put('Pricing_Master',{id:'BOX-'+(i+1),name:BOXES[i][2],advertised:BOXES[i][0],scheme:BOXES[i][1],active:'true',updatedAt:stamp()});
  if(pass){const salt=Utilities.getUuid()+'-'+Utilities.getUuid(),hash=pinDigest(pass,salt);p.setProperties({ADMIN_PASSWORD_SALT:salt,ADMIN_PASSWORD_HASH:hash,ADMIN_REV:prop('ADMIN_REV')||'1'});p.deleteProperty('ADMIN_PASSWORD');}
  });
  console.log('Initialized '+Object.keys(HEADERS).length+' worksheets. Admin configured: '+!!prop('ADMIN_PASSWORD_HASH'));
}

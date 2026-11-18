import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SECRET='x'.repeat(48),SESS='y'.repeat(48),MOBILE='9876543210';
function sandbox(){
 const props=new Map(Object.entries({SPREADSHEET_ID:'TEST_SHEET',API_SHARED_SECRET:SECRET,PIN_PEPPER:'test_pepper_a_private_64_char_secret',ADMIN_MOBILE:MOBILE,ADMIN_PASSWORD:'strong admin password test 2027',OPERATIONS_ENABLED:'true',POLICY_APPROVED:'true',FIREWORKS_LEGAL_CLEARANCE:'false'}));
 const sheets=new Map();
 class Sheet{
  constructor(name){this.name=name;this.rows=[]}
  getLastRow(){return this.rows.length}
  getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length))}
  getRange(startRow,startCol,nRows=1,nCols=1){const self=this;return {
   getValues(){return Array.from({length:nRows},(_,i)=>Array.from({length:nCols},(_,j)=>self.rows[startRow-1+i]?.[startCol-1+j]??''))},
   getDisplayValues(){return this.getValues().map(r=>r.map(String))},
   setValues(rows){for(let i=0;i<rows.length;i++){let target=startRow-1+i;while(self.rows.length<=target)self.rows.push([]);for(let j=0;j<rows[i].length;j++)self.rows[target][startCol-1+j]=rows[i][j]}return this}
  }}
  appendRow(a){this.rows.push(a.map(v=>typeof v==='string'&&/^[0-9]{1,15}$/.test(v)?Number(v):v));return this}
  setFrozenRows(){}
 }
 const spreadsheet={getSheetByName(name){return sheets.get(name)||null},insertSheet(name){let s=new Sheet(name);sheets.set(name,s);return s},getName(){return 'Jay Ganesh Test'}};
 const Utilities={base64Decode:b=>Array.from(Buffer.from(b,'base64')).map(n=>n>127?n-256:n),newBlob:(bytes,type,name)=>({bytes,type,name}),getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'SHA_256'},computeDigest:(_,data)=>Array.from(crypto.createHash('sha256').update(Buffer.from(typeof data==='string'?data:Uint8Array.from(data.map(n=>n<0?n+256:n)))).digest()),formatDate:(d,tz,format)=>d.toISOString().slice(0,10)};
 const files=new Map();const DriveApp={createFolder(name){return {getId:()=>'FOLDER1',getName:()=>name,getUrl:()=>'u',createFile(blob){const id='DRV'+files.size;files.set(id,blob);return {getId:()=>id,setDescription(){}}}}},getFolderById(id){if(id!=='FOLDER1')throw Error('no');return this.createFolder('x')}};
 const context=vm.createContext({DriveApp,PropertiesService:{getScriptProperties(){return {getProperty(k){return props.get(k)||''},setProperties(v){Object.entries(v).forEach(([k,val])=>props.set(k,val))},deleteProperty(k){props.delete(k)}}}},SpreadsheetApp:{openById(id){if(id!=='TEST_SHEET')throw Error('Bad sheet');return spreadsheet}},Utilities,LockService:{getScriptLock(){return {waitLock(){},releaseLock(){}}}},ContentService:{MimeType:{JSON:'JSON'},createTextOutput(text){return {text,setMimeType(){return this}}}},Date,Math,JSON,String,Number,Array,Set,Object,Boolean,Error,console});
 vm.runInContext(fs.readFileSync(path.join(root,'appsscript/Code.gs'),'utf8'),context);
 context.initializeJayGanesh();
 function send(action,data={},actor=null,secret=SECRET){const r=context.doPost({postData:{contents:JSON.stringify({action,...data,sharedSecret:secret,actor})}});return JSON.parse(r.text)}
 function success(action,data={},actor=null){const r=send(action,data,actor);assert.equal(r.ok,true,JSON.stringify(r));return r.data}
 return {context,props,sheets,send,success,files};
}

const asUser=l=>({role:l.role,mobile:l.mobile,customerId:l.customerId,authRev:l.authRev});
const PW='strong admin password test 2027';
const reg=(s,mobile,extra={})=>s.send('registration',{name:'Dup Tester',mobile,pin:'0427',emi:1000,reference:'Ref',acceptedTerms:true,...extra});
test('Sheets stores mobiles as numbers: duplicate registrations are still blocked',()=>{
 const s=sandbox(),admin=asUser(s.success('login',{mobile:MOBILE,password:PW}));
 const first=reg(s,'9123456780');assert.equal(first.ok,true);
 assert.equal(typeof s.sheets.get('Registration_Requests').rows[1][2],'number','sheet really stores the mobile as a number');
 for(const m of ['9123456780','+91 91234 56780','091234-56780','919123456780']){const r=reg(s,m);assert.equal(r.code,'CONFLICT',m);assert.match(r.error,/waiting for Main Admin approval/);}
 assert.equal(reg(s,MOBILE).code,'CONFLICT','admin mobile cannot register');
 const cid=s.success('admin.approve',{id:first.data.registrationId},admin).customerId;assert.ok(cid);
 const again=reg(s,'9123456780');assert.equal(again.code,'CONFLICT');assert.match(again.error,/already registered/);
 const login=s.success('login',{mobile:'+91 91234 56780',pin:'0427'});assert.equal(login.customerId,cid,'login accepts +91 format');
});
test('rejected registration frees the number; existing duplicate rows cannot both be approved',()=>{
 const s=sandbox(),admin=asUser(s.success('login',{mobile:MOBILE,password:PW}));
 const a=reg(s,'9000000001');s.success('admin.reject',{id:a.data.registrationId,reason:'Wrong details given'},admin);
 assert.equal(reg(s,'9000000001').ok,true,'can register again after rejection');
 // simulate two duplicate rows that were saved before this fix
 const sh=s.sheets.get('Registration_Requests'),row=sh.rows[sh.rows.length-1];const copy=[...row];copy[0]='REG-OLD-DUP';sh.rows.push(copy);
 const pend=s.success('admin.registrations',{},admin).requests.filter(x=>x.status==='Pending Approval');assert.equal(pend.length,2);
 assert.equal(s.send('admin.approve',{id:pend[0].id},admin).code,'CONFLICT','both pending: approve only one, reject the other');
 s.success('admin.reject',{id:pend[1].id,reason:'Duplicate registration'},admin);
 assert.ok(s.success('admin.approve',{id:pend[0].id},admin).customerId);
 assert.equal(s.success('admin.customers',{},admin).customers.length,1,'only one customer for the number');
});
test('group change: reason required, blocked with open payments or for a leader, history kept',()=>{
 const s=sandbox(),admin=asUser(s.success('login',{mobile:MOBILE,password:PW}));
 s.success('admin.updateSetting',{key:'paymentPolicyConfirmed',enabled:true,acknowledged:true},admin);s.success('admin.updateSetting',{key:'paymentEntriesEnabled',enabled:true},admin);
 const ids=['9100000001','9100000002'].map(m=>s.success('admin.approve',{id:reg(s,m).data.registrationId},admin).customerId);
 const g1=s.success('admin.groupCreate',{name:'North Group'},admin).group,g2=s.success('admin.groupCreate',{name:'South Group'},admin).group;
 s.success('admin.assign',{customerId:ids[0],groupId:g1.id},admin);s.success('admin.assign',{customerId:ids[1],groupId:g1.id},admin);
 assert.equal(s.send('admin.assign',{customerId:ids[0],groupId:g1.id},admin).code,'CONFLICT','already in that group');
 assert.equal(s.send('admin.assign',{customerId:ids[0],groupId:g2.id},admin).code,'BAD_REQUEST','reason needed to change');
 s.success('admin.appointLeader',{groupId:g1.id,customerId:ids[1]},admin);
 const cust=asUser(s.success('login',{mobile:'9100000001',pin:'0427'}));s.success('customer.payment',{installment:1,amount:1500,mode:'Cash'},cust);
 const blocked=s.send('admin.assign',{customerId:ids[0],groupId:g2.id,reason:'Moved to another area'},admin);assert.equal(blocked.code,'CONFLICT');assert.match(blocked.error,/still being processed/);
 assert.equal(s.send('admin.assign',{customerId:ids[1],groupId:g2.id,reason:'Moved to another area'},admin).code,'CONFLICT','leader must be replaced first');
 const leader=asUser(s.success('login',{mobile:'9100000002',pin:'0427'}));const p=s.success('leader.queue',{},leader).payments[0];s.success('leader.rejectPayment',{id:p.id,reason:'Entered by mistake'},leader);
 assert.equal(s.success('admin.assign',{customerId:ids[0],groupId:g2.id,reason:'Moved to another area'},admin).groupId,g2.id);
 const mem=s.sheets.get('Group_Memberships').rows.slice(1).filter(r=>r[1]===ids[0]);assert.equal(mem.length,2,'old and new membership kept');assert.ok(mem[0][4],'old membership ended');
 assert.ok(s.sheets.get('Audit_Log').rows.some(r=>r.includes('group.change')));
});
test('Group Leader records EMI for own group members only; it flows into the group collection',()=>{
 const s=sandbox(),admin=asUser(s.success('login',{mobile:MOBILE,password:PW}));
 const ids=['9200000001','9200000002','9200000003'].map(m=>s.success('admin.approve',{id:reg(s,m).data.registrationId},admin).customerId);
 const g1=s.success('admin.groupCreate',{name:'East Group'},admin).group,g2=s.success('admin.groupCreate',{name:'West Group'},admin).group;
 s.success('admin.assign',{customerId:ids[0],groupId:g1.id},admin);s.success('admin.assign',{customerId:ids[1],groupId:g1.id},admin);s.success('admin.assign',{customerId:ids[2],groupId:g2.id},admin);
 s.success('admin.appointLeader',{groupId:g1.id,customerId:ids[0]},admin);
 const leader=asUser(s.success('login',{mobile:'9200000001',pin:'0427'}));
 const pay=x=>s.send('leader.recordPayment',{installment:1,amount:1500,mode:'Cash',...x},leader);
 s.success('admin.updateSetting',{key:'paymentEntriesEnabled',enabled:false},admin);
 assert.equal(pay({customerId:ids[1]}).code,'CLOSED','payments stopped by admin');
 s.success('admin.updateSetting',{key:'paymentPolicyConfirmed',enabled:true,acknowledged:true},admin);for(const k of ['paymentEntriesEnabled','groupCollectionsEnabled'])s.success('admin.updateSetting',{key:k,enabled:true},admin);
 assert.equal(pay({customerId:ids[2]}).code,'FORBIDDEN','member of another group');
 assert.equal(pay({customerId:ids[0]}).code,'CONFLICT','own EMI uses Record my payment');
 assert.equal(pay({customerId:ids[1],amount:2000}).code,'CONFLICT','more than installment 1 (1.5 x 1000)');
 const r=s.success('leader.recordPayment',{customerId:ids[1],installment:1,amount:1500,mode:'Cash',reference:'Cash at shop'},leader);assert.equal(r.status,'Leader Verified');
 assert.equal(pay({customerId:ids[1]}).code,'CONFLICT','installment already fully paid');
 const cust=asUser(s.success('login',{mobile:'9200000002',pin:'0427'}));
 assert.equal(s.send('leader.recordPayment',{customerId:ids[1],installment:2,amount:100,mode:'Cash'},cust).code,'FORBIDDEN','customers cannot use it');
 const mine=s.success('customer.dashboard',{},cust).payments[0];assert.equal(mine.recordedByLeader,true);
 const q=s.success('leader.queue',{},leader);s.success('leader.collection',{paymentIds:[q.payments[0].id],remittanceMethod:'Cash'},leader);
 const col=s.success('admin.collections',{},admin).collections[0];s.success('admin.verifyCollection',{id:col.id},admin);
 assert.equal(s.success('customer.dashboard',{},cust).verifiedCash,1500,'verified after Main Admin verifies the collection');
 assert.ok(s.sheets.get('Audit_Log').rows.some(r=>r.includes('payment.leaderRecord')));
});

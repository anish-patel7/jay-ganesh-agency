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
  appendRow(a){this.rows.push([...a]);return this}
  setFrozenRows(){}
 }
 const spreadsheet={getSheetByName(name){return sheets.get(name)||null},insertSheet(name){let s=new Sheet(name);sheets.set(name,s);return s},getName(){return 'Jay Ganesh Test'}};
 const Utilities={getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'SHA_256'},computeDigest:(_,data)=>Array.from(crypto.createHash('sha256').update(Buffer.from(typeof data==='string'?data:Uint8Array.from(data.map(n=>n<0?n+256:n)))).digest()),formatDate:(d,tz,format)=>d.toISOString().slice(0,10)};
 const context=vm.createContext({PropertiesService:{getScriptProperties(){return {getProperty(k){return props.get(k)||''},setProperties(v){Object.entries(v).forEach(([k,val])=>props.set(k,val))},deleteProperty(k){props.delete(k)}}}},SpreadsheetApp:{openById(id){if(id!=='TEST_SHEET')throw Error('Bad sheet');return spreadsheet}},Utilities,LockService:{getScriptLock(){return {waitLock(){},releaseLock(){}}}},ContentService:{MimeType:{JSON:'JSON'},createTextOutput(text){return {text,setMimeType(){return this}}}},Date,Math,JSON,String,Number,Array,Set,Object,Boolean,Error,console});
 vm.runInContext(fs.readFileSync(path.join(root,'appsscript/Code.gs'),'utf8'),context);
 context.initializeJayGanesh();
 function send(action,data={},actor=null,secret=SECRET){const r=context.doPost({postData:{contents:JSON.stringify({action,...data,sharedSecret:secret,actor})}});return JSON.parse(r.text)}
 function success(action,data={},actor=null){const r=send(action,data,actor);assert.equal(r.ok,true,JSON.stringify(r));return r.data}
 return {context,props,sheets,send,success};
}
function asUser(login){return {role:login.role,mobile:login.mobile,customerId:login.customerId,authRev:login.authRev}}
function signup(s,name,mobile,pin='0427',emi=500){return s.success('registration',{name,mobile,pin,emi,reference:'Reference person',acceptedTerms:true})}
function approved(s,regId,admin){return s.success('admin.approve',{id:regId},admin).customerId}
test('registration to consolidated group verification; no individual Admin verify',()=>{
 const s=sandbox(),admin=asUser(s.success('login',{mobile:MOBILE,password:'strong admin password test 2027'}));
 assert.equal(s.props.has('ADMIN_PASSWORD'),false,'bootstrap admin plaintext deleted');
 assert.equal(s.send('status',{},null,'bad_secret').code,'UNAUTHORIZED');
 assert.equal(s.send('registration',{name:'Spoof',mobile:'9123456789'},null,'bad_secret').ok,false);
 const memberReg=signup(s,'Member','9876500001');const leaderReg=signup(s,'Leader','9876500002','0284',1000);
 assert.equal(s.send('login',{mobile:'9876500001',pin:'0427'}).ok,false,'cannot login before approval');
 const memberId=approved(s,memberReg.registrationId,admin),leaderId=approved(s,leaderReg.registrationId,admin);
 const member=asUser(s.success('login',{mobile:'9876500001',pin:'0427'}));
 assert.equal(member.customerId,memberId);
 const g=s.success('admin.groupCreate',{name:'Group 1'},admin).group;
 s.success('admin.assign',{groupId:g.id,customerId:memberId},admin);s.success('admin.assign',{groupId:g.id,customerId:leaderId},admin);
 s.success('admin.appointLeader',{groupId:g.id,customerId:leaderId},admin);
 const leader=asUser(s.success('login',{mobile:'9876500002',pin:'0284'}));
 assert.equal(leader.role,'leader');
 const groups=s.success('admin.groups',{},admin).groups;
 assert.equal(groups.length,1);assert.equal(groups[0].totalMonthlyEmi,1500);
 const payment=s.success('customer.payment',{installment:2,amount:500,mode:'Cash',reference:'Paid to group leader'},member).payment;
 assert.equal(payment.status,'Awaiting Leader');
 assert.equal(s.success('customer.dashboard',{},member).verifiedCash,0,'unverified customer entry must not count');
 assert.equal(s.send('leader.ackPayment',{id:payment.id},member).code,'FORBIDDEN','member cannot approve own entry');
 assert.equal(s.success('leader.ackPayment',{id:payment.id},leader).status,'Leader Verified');
 const batch=s.success('leader.collection',{paymentIds:[payment.id],remittanceMethod:'Cash',remittanceReference:'Cash handed to organizer'},leader).collection;
 assert.equal(batch.amount,500);
 const adminCollections=s.success('admin.collections',{},admin).collections;
 assert.equal(adminCollections.length,1);
 assert.equal(adminCollections[0].paymentCount,1);
 assert.equal(adminCollections[0].amount,500);
 assert.equal(adminCollections[0].paymentIds,undefined,'do not expose member IDs to Main Admin collection table');
 assert.equal(s.success('customer.dashboard',{},member).verifiedCash,0,'queued group batch must not count');
 assert.equal(s.send('admin.verifyCollection',{id:batch.id},leader).code,'FORBIDDEN','group leader must not verify batch');
 assert.equal(s.success('admin.verifyCollection',{id:batch.id},admin).status,'Verified');
 const dashboard=s.success('customer.dashboard',{},member);
 assert.equal(dashboard.verifiedCash,500);
 assert.equal(dashboard.verifiedContributions,500,'second installment has no packing charge');
 assert.equal(s.send('admin.verifyCollection',{id:batch.id},admin).code,'CONFLICT','cannot verify a batch twice');
 assert.equal(s.send('admin.payments',{id:payment.id},admin).code,'NOT_FOUND','no individual admin EMI approval route');
 const reset=s.success('admin.resetPin',{mobile:member.mobile,identityVerified:true,reason:'Checked identity in person'},admin);
 assert.match(reset.temporaryPin,/^[0-9]{4}$/);
 assert.equal(s.send('customer.dashboard',{},member).code,'UNAUTHORIZED','reset invalidates old sessions');
 const temp=asUser(s.success('login',{mobile:member.mobile,pin:reset.temporaryPin}));
 assert.equal(s.send('customer.dashboard',{allowPinChange:true},temp).code,'PIN_CHANGE_REQUIRED','client cannot bypass forced PIN change');
 s.success('changePin',{currentPin:reset.temporaryPin,newPin:'0099'},temp);
 assert.equal(s.send('login',{mobile:member.mobile,pin:reset.temporaryPin}).ok,false);
 assert.equal(s.success('login',{mobile:member.mobile,pin:'0099'}).role,'customer');
 
});

test('locked payment submission is rejected when policies are off',()=>{
 const s=sandbox();s.props.set('OPERATIONS_ENABLED','false');
 const r=s.send('registration',{name:'Any',mobile:'9876500011',pin:'1234',emi:500,reference:'Ref',acceptedTerms:true});
 assert.equal(r.code,'CLOSED');
});

test('5 incorrect PIN attempts lock the mobile for 30 minutes',()=>{
 const s=sandbox(),admin=asUser(s.success('login',{mobile:MOBILE,password:'strong admin password test 2027'}));
 const id=signup(s,'Customer','9876500012').registrationId;approved(s,id,admin);
 for(let i=0;i<5;i++)assert.equal(s.send('login',{mobile:'9876500012',pin:'8888'}).code,'UNAUTHORIZED');
 assert.equal(s.send('login',{mobile:'9876500012',pin:'0427'}).code,'RATE_LIMIT');
});

test('rejecting group batch restores acknowledged items without credit',()=>{
 const s=sandbox(),admin=asUser(s.success('login',{mobile:MOBILE,password:'strong admin password test 2027'}));
 const memberId=approved(s,signup(s,'Member','9876500031').registrationId,admin);
 const leaderId=approved(s,signup(s,'Leader','9876500032','4321').registrationId,admin);
 const g=s.success('admin.groupCreate',{name:'Demo Group'},admin).group;
 for(const id of [memberId,leaderId])s.success('admin.assign',{customerId:id,groupId:g.id},admin);
 s.success('admin.appointLeader',{groupId:g.id,customerId:leaderId},admin);
 const member=asUser(s.success('login',{mobile:'9876500031',pin:'0427'}));
 const leader=asUser(s.success('login',{mobile:'9876500032',pin:'4321'}));
 const payment=s.success('customer.payment',{installment:1,amount:750,mode:'Online'},member).payment;
 s.success('leader.ackPayment',{id:payment.id},leader);
 const batch=s.success('leader.collection',{paymentIds:[payment.id],remittanceMethod:'Online'},leader).collection;
 s.success('admin.rejectCollection',{id:batch.id,reason:'Remittance not received'},admin);
 const queue=s.success('leader.queue',{},leader);
 assert.equal(queue.payments.find(x=>x.id===payment.id).status,'Leader Verified');
 assert.equal(s.success('customer.dashboard',{},member).verifiedCash,0);
});

test('Vercel bridge checks Origin, issues signed HttpOnly cookie, rejects role forgery',async()=>{
 const s=sandbox();
 const old={...process.env};process.env.GAS_WEB_APP_URL='https://script.google.com/macros/s/ABC_abc1234/exec';process.env.GAS_SHARED_SECRET=SECRET;process.env.SESSION_SECRET=SESS;process.env.NODE_ENV='production';
 const fetch0=global.fetch;global.fetch=async(url,options)=>new Response(s.context.doPost({postData:{contents:options.body}}).text,{status:200});
 try{
   const {default:handler}=await import('../api/handler.js');
   function invoke(action,fields={},cookie='',origin='https://example.vercel.app'){
     const headers={'host':'example.vercel.app','origin':origin,'content-type':'application/json','x-jga-request':'1'};if(cookie)headers.cookie=cookie;
     return new Promise(resolve=>{let text='';const hs={};const res={statusCode:0,setHeader(name,value){hs[name.toLowerCase()]=value},end(s){text=s;resolve({status:this.statusCode,headers:hs,data:JSON.parse(text)})}};Promise.resolve(handler({method:'POST',headers,body:{action,...fields}},res)).catch(e=>resolve({error:e.message}))});
   }
   assert.equal((await invoke('status',{},'','https://evil.example')).status,403);
   const bad=await invoke('login',{mobile:MOBILE,password:'wrong password'});assert.equal(bad.status,401);
   const login=await invoke('login',{mobile:MOBILE,password:'strong admin password test 2027'});assert.equal(login.status,200);
   assert.match(login.headers['set-cookie'],/HttpOnly/);assert.match(login.headers['set-cookie'],/SameSite=Strict/);assert.match(login.headers['set-cookie'],/Secure/);
   const cookie=login.headers['set-cookie'].split(';')[0];
   assert.equal((await invoke('admin.groups',{},cookie)).status,200);
   assert.equal((await invoke('admin.groups',{},cookie.replace('=', '=CORRUPTED'))).status,401);
   const reg=signup(s,'Customer','9876500044').registrationId;const admin=asUser(s.success('login',{mobile:MOBILE,password:'strong admin password test 2027'}));approved(s,reg,admin);
   const customer=await invoke('login',{mobile:'9876500044',password:'0427'});
   const cCookie=customer.headers['set-cookie'].split(';')[0];
   assert.equal((await invoke('admin.groups',{actor:{role:'admin',mobile:MOBILE,authRev:'1'}},cCookie)).status,403);
   assert.equal((await invoke('me',{},cCookie)).data.role,'customer');
 }finally{global.fetch=fetch0;process.env=old}
});

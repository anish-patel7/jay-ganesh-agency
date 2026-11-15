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
function setup(){
 const s=sandbox(),admin=asUser(s.success('login',{mobile:MOBILE,password:PW}));
 const reg=s.success('registration',{name:'Order Customer',mobile:'9876500011',pin:'0427',emi:1000,reference:'Ref',acceptedTerms:true});
 const lreg=s.success('registration',{name:'Order Leader',mobile:'9876500012',pin:'0284',emi:1000,reference:'Ref',acceptedTerms:true});
 const cid=s.success('admin.approve',{id:reg.registrationId},admin).customerId,lid=s.success('admin.approve',{id:lreg.registrationId},admin).customerId;
 const g=s.success('admin.groupCreate',{name:'Group A'},admin).group;s.success('admin.assign',{groupId:g.id,customerId:cid},admin);s.success('admin.assign',{groupId:g.id,customerId:lid},admin);s.success('admin.appointLeader',{groupId:g.id,customerId:lid},admin);
 const cust=asUser(s.success('login',{mobile:'9876500011',pin:'0427'})),leader=asUser(s.success('login',{mobile:'9876500012',pin:'0284'}));
 return {s,admin,cust,leader,cid};
}
function payVerified(s,admin,cust,leader,amounts){
 for(const [inst,amt] of amounts){s.success('customer.payment',{installment:inst,amount:amt,mode:'Cash'},cust)}
 const q=s.success('leader.queue',{},leader);for(const p of q.payments.filter(x=>x.status==='Awaiting Leader'))s.success('leader.ackPayment',{id:p.id},leader);
 const ok=s.success('leader.queue',{},leader).payments.filter(x=>x.status==='Leader Verified').map(x=>x.id);
 const col=s.success('leader.collection',{paymentIds:ok,remittanceMethod:'Cash'},leader);
 const cols=s.success('admin.collections',{},admin).collections.filter(c=>c.status==='Awaiting Admin');for(const c of cols)s.success('admin.verifyCollection',{id:c.id},admin);
}
test('orders stay closed until Main Admin confirms clearance and switches Order collection Live',()=>{
 const {s,admin,cust}=setup();
 assert.equal(s.send('order.create',{},cust).code,'CLOSED');
 assert.equal(s.send('admin.updateSetting',{key:'ordersEnabled',enabled:true},admin).code,'CONFLICT','needs clearance first');
 assert.equal(s.send('admin.updateSetting',{key:'orderPolicyConfirmed',enabled:true},admin).code,'BAD_REQUEST','needs explicit acknowledgement');
 s.success('admin.updateSetting',{key:'orderPolicyConfirmed',enabled:true,acknowledged:true},admin);
 const st=s.success('admin.updateSetting',{key:'ordersEnabled',enabled:true},admin);assert.equal(st.ordersOpen,true);
 s.success('order.create',{},cust);assert.equal(s.send('order.create',{},cust).code,'CONFLICT','one order per customer');
 s.success('admin.updateSetting',{key:'ordersEnabled',enabled:false},admin);
 assert.equal(s.send('order.saveDraft',{orderId:'x',type:'Only Box',listCount:0,boxes:[]},cust).code,'CLOSED');
});
test('box order uses scheme price, must use full credit, extra payment before approval, admin correction logged',()=>{
 const {s,admin,cust,leader}=setup();
 s.success('admin.updateSetting',{key:'paymentPolicyConfirmed',enabled:true,acknowledged:true},admin);
 for(const k of ['paymentEntriesEnabled','groupCollectionsEnabled'])s.success('admin.updateSetting',{key:k,enabled:true},admin);
 s.success('admin.updateSetting',{key:'orderPolicyConfirmed',enabled:true,acknowledged:true},admin);s.success('admin.updateSetting',{key:'ordersEnabled',enabled:true},admin);
 // EMI 1000: installment 1 = 1500 (500 packing) + installments 2..3 = 1000 each -> credit 3000
 payVerified(s,admin,cust,leader,[[1,1500],[2,1000],[3,1000]]);
 let mine=s.success('order.mine',{},cust);assert.equal(mine.account.availableCredit,3000);
 const {orderId}=s.success('order.create',{},cust);
 // BOX-1 advertised 4000 -> scheme 2000: under credit, cannot lock
 s.success('order.saveDraft',{orderId,type:'Only Box',listCount:0,boxes:[{pricingId:'BOX-1',quantity:1}]},cust);
 mine=s.success('order.mine',{},cust);assert.equal(mine.order.financial.discountedOrderValue,2000);assert.equal(mine.order.financial.unusedCredit,1000);assert.equal(mine.order.financial.financialStatus,'Under-credit');
 assert.equal(s.send('order.lock',{orderId},cust).code,'CONFLICT');
 // BOX-1 + BOX-2 = 2000+3000 = 5000 -> extra 2000
 s.success('order.saveDraft',{orderId,type:'Only Box',listCount:0,boxes:[{pricingId:'BOX-1',quantity:1},{pricingId:'BOX-2',quantity:1}]},cust);
 mine=s.success('order.mine',{},cust);assert.equal(mine.order.financial.extraPayable,2000);
 s.success('order.lock',{orderId},cust);
 assert.equal(s.send('order.saveDraft',{orderId,type:'Only Box',listCount:0,boxes:[]},cust).code,'CONFLICT','locked');
 assert.equal(s.send('admin.approveOrder',{orderId},admin).code,'CONFLICT','extra not yet paid');
 s.success('admin.recordExtra',{orderId,amount:2000,mode:'Cash'},admin);
 assert.equal(s.send('admin.correctOrder',{orderId,pricingId:'BOX-2',quantity:2,reason:'short'},admin).code,'BAD_REQUEST');
 s.success('admin.correctOrder',{orderId,pricingId:'BOX-2',quantity:2,reason:'Customer asked by phone, verified'},admin);
 let o=s.success('admin.orders',{},admin).orders[0];assert.equal(o.financial.finalOutstanding,3000);
 assert.equal(s.send('admin.approveOrder',{orderId},admin).code,'CONFLICT');
 s.success('admin.recordExtra',{orderId,amount:3000,mode:'Online',reference:'UPI'},admin);
 assert.equal(s.success('admin.approveOrder',{orderId},admin).status,'Finalized');
 assert.ok(s.sheets.get('Order_Adjustments').rows.length===2,'adjustment row recorded');
 assert.ok(s.sheets.get('Audit_Log').rows.some(r=>r.includes('order.approve')));
 assert.equal(s.success('leader.orders',{},leader).orders.length,1,'leader sees group member orders');
});
test('PDF list: valid PDF only, stored in Drive, priced by admin, then lockable',()=>{
 const {s,admin,cust,leader}=setup();
 s.success('admin.updateSetting',{key:'orderPolicyConfirmed',enabled:true,acknowledged:true},admin);s.success('admin.updateSetting',{key:'ordersEnabled',enabled:true},admin);
 const {orderId}=s.success('order.create',{},cust);
 assert.equal(s.send('order.upload',{orderId,filename:'a.pdf',declaredListValue:100,fileBase64:Buffer.from('%PDF-1.4 x').toString('base64')},cust).code,'BAD_REQUEST','Only Box rejects PDF');
 s.success('order.saveDraft',{orderId,type:'Only List',listCount:1,boxes:[]},cust);
 assert.equal(s.send('order.upload',{orderId,filename:'a.pdf',declaredListValue:100,fileBase64:Buffer.from('hello').toString('base64')},cust).code,'BAD_REQUEST','not a PDF');
 assert.equal(s.send('order.upload',{orderId,filename:'my list.pdf',fileBase64:Buffer.from('%PDF-1.4 test').toString('base64')},cust).code,'BAD_REQUEST','list value required');
 s.success('order.upload',{orderId,filename:'my list.pdf',declaredListValue:12000,fileBase64:Buffer.from('%PDF-1.4 test').toString('base64')},cust);
 assert.equal(s.files.size,1);assert.equal(s.send('order.upload',{orderId,filename:'b.pdf',declaredListValue:5000,fileBase64:Buffer.from('%PDF-1.4 t').toString('base64')},cust).code,'CONFLICT','max lists');
 let mine=s.success('order.mine',{},cust);assert.equal(mine.order.uploads[0].url,undefined,'customer gets no Drive link');assert.equal(mine.order.financial.pricingPending,true);assert.equal(mine.order.uploads[0].declaredListValue,12000);assert.equal(mine.order.financial.estimatedOrderValue,6000,'estimate = 50% of stated value');
 s.success('order.lock',{orderId},cust);
 const ao=s.success('admin.orders',{},admin).orders[0];assert.ok(ao.uploads[0].url.includes('drive.google.com'));
 assert.equal(s.send('admin.approveOrder',{orderId},admin).code,'CONFLICT','pricing pending');
 s.success('admin.priceList',{uploadId:ao.uploads[0].id,advertisedListValue:0},admin);
 assert.equal(s.success('admin.approveOrder',{orderId},admin).status,'Finalized','no credit, zero value list approved');
});

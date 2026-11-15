import {google} from 'googleapis';

/** Google Sheets is a record store for a low-traffic, single-writer deployment.
 * It is NOT a transactional ledger. Before real money is handled, arrange
 * independent audit, backups, reconciliations and concurrency review.
 */
export const HEADERS={
 Registration_Requests:['id','name','mobile','reference','emi','comments','acceptedTerms','status','createdAt','reviewedAt','reviewedBy'],
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
 Group_Summary:['groupId','name','members','totalMonthlyEmi','verifiedCash','transfersConfirmed','updatedAt']
};
/** Service-account credentials: either the whole JSON key pasted into the
 * GOOGLE_SERVICE_ACCOUNT_JSON environment variable (easiest on Render), or a
 * file path in GOOGLE_APPLICATION_CREDENTIALS. */
export function googleAuth(scopes){
 const raw=process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
 if(raw&&raw.trim()){let credentials;try{credentials=JSON.parse(raw)}catch{throw Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON')}if(credentials.private_key)credentials.private_key=credentials.private_key.replace(/\\n/g,'\n');return new google.auth.GoogleAuth({credentials,scopes})}
 return new google.auth.GoogleAuth({scopes});
}
function colLetter(n){let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s}
export class SheetStore{
 constructor({sheets,spreadsheetId}){this.sheets=sheets;this.id=spreadsheetId;this.pending=Promise.resolve()}
 static async connect(){const auth=googleAuth(['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive.file']);const client=await auth.getClient();return new SheetStore({sheets:google.sheets({version:'v4',auth:client}),spreadsheetId:process.env.GOOGLE_SHEETS_ID})}
 async setup(){const {data}=await this.sheets.spreadsheets.get({spreadsheetId:this.id,fields:'sheets(properties(title))'});const names=new Set((data.sheets||[]).map(x=>x.properties.title));const missing=Object.keys(HEADERS).filter(x=>!names.has(x));if(missing.length)await this.sheets.spreadsheets.batchUpdate({spreadsheetId:this.id,requestBody:{requests:missing.map(title=>({addSheet:{properties:{title}}}))}});for(const sheet of Object.keys(HEADERS)){const r=await this.sheets.spreadsheets.values.get({spreadsheetId:this.id,range:`'${sheet}'!1:1`});const existing=(r.data.values||[])[0]||[],expected=HEADERS[sheet];if(!existing.length)await this.sheets.spreadsheets.values.update({spreadsheetId:this.id,range:`'${sheet}'!A1`,valueInputOption:'RAW',requestBody:{values:[expected]}});else if(existing.length<expected.length&&existing.every((h,i)=>h===expected[i]))await this.sheets.spreadsheets.values.update({spreadsheetId:this.id,range:`'${sheet}'!A1`,valueInputOption:'RAW',requestBody:{values:[expected]}});else if(existing.length!==expected.length||!existing.every((h,i)=>h===expected[i]))throw Error(`Unexpected worksheet columns in ${sheet}; review migration manually`)}}
 async list(name){const cols=HEADERS[name];if(!cols)throw Error(`Unknown worksheet: ${name}`);const r=await this.sheets.spreadsheets.values.get({spreadsheetId:this.id,range:`'${name}'!A2:${colLetter(cols.length-1)}`});return (r.data.values||[]).map((values,index)=>({__row:index+2,...Object.fromEntries(cols.map((c,i)=>[c,values[i]??'']))})).filter(o=>o[cols[0]]!=='')}
 async find(name,id,key='id'){return (await this.list(name)).find(x=>String(x[key])===String(id))||null}
 async insert(name,obj){const cols=HEADERS[name];if(!cols)throw Error('Unknown worksheet');const values=cols.map(c=>obj[c]===undefined?'':String(obj[c]));await this.sheets.spreadsheets.values.append({spreadsheetId:this.id,range:`'${name}'!A:${colLetter(cols.length-1)}`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[values]}});return obj}
 async update(name,id,patch,key='id'){const rows=await this.list(name),old=rows.find(o=>String(o[key])===String(id));if(!old)throw Error(`${name}: record not found`);const next={...old,...patch};const cols=HEADERS[name];await this.sheets.spreadsheets.values.update({spreadsheetId:this.id,range:`'${name}'!A${old.__row}:${colLetter(cols.length-1)}${old.__row}`,valueInputOption:'RAW',requestBody:{values:[cols.map(c=>next[c]===undefined?'':String(next[c]))]}});delete next.__row;return next}
 async replaceSheet(name,items){const cols=HEADERS[name];if(!cols)throw Error('Unknown worksheet');await this.sheets.spreadsheets.values.clear({spreadsheetId:this.id,range:`'${name}'!A:${colLetter(cols.length-1)}`});await this.sheets.spreadsheets.values.update({spreadsheetId:this.id,range:`'${name}'!A1`,valueInputOption:'RAW',requestBody:{values:[cols,...items.map(o=>cols.map(c=>String(o[c]??'')))]}})}
 /** Serialize writes in this Node process; use exactly one server instance. */
 serial(fn){const next=this.pending.catch(()=>{}).then(fn);this.pending=next.catch(()=>{});return next}
}

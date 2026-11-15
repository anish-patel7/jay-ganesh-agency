/** Vercel server-only bridge. NEVER put GAS_SHARED_SECRET or SESSION_SECRET in frontend files. */
import crypto from 'node:crypto';
const COOKIE='jga_session', MAX_AGE=12*60*60;
const PUBLIC_ACTIONS=new Set(['status','login','registration','logout']);
const ACTIONS=new Set(['status','login','registration','logout','me','admin.overview','admin.settings','admin.updateSetting','admin.registrations','admin.approve','admin.reject','admin.customers','admin.groups','admin.groupCreate','admin.assign','admin.appointLeader','admin.collections','admin.verifyCollection','admin.rejectCollection','admin.resetPin','customer.dashboard','customer.payment','leader.queue','leader.ackPayment','leader.rejectPayment','leader.collection','changePin','order.mine','order.create','order.saveDraft','order.upload','order.lock','leader.orders','admin.orders','admin.priceList','admin.correctOrder','admin.recordExtra','admin.approveOrder']);
const codeStatus={UNAUTHORIZED:401,FORBIDDEN:403,BAD_REQUEST:400,CONFLICT:409,CLOSED:423,NOT_FOUND:404,RATE_LIMIT:429,SETUP:503,PIN_CHANGE_REQUIRED:403,SERVER_ERROR:502};
function json(res,code,obj){res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.end(JSON.stringify(obj));}
function digest(s){return crypto.createHmac('sha256',process.env.SESSION_SECRET||'').update(s).digest('base64url');}
function token(payload){const part=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url');return part+'.'+digest(part);}
function readToken(req){const cookies=String(req.headers.cookie||'').split(';').map(x=>x.trim());const item=cookies.find(x=>x.startsWith(COOKIE+'='));if(!item)return null;const raw=item.slice(COOKIE.length+1),parts=raw.split('.');if(parts.length!==2||parts[0].length>2048)return null;const expect=digest(parts[0]),given=parts[1];if(expect.length!==given.length||!crypto.timingSafeEqual(Buffer.from(expect),Buffer.from(given)))return null;try{const p=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));if(!p||!Number.isInteger(p.exp)||p.exp<=Math.floor(Date.now()/1000)||!['admin','customer','leader'].includes(p.role)||!p.mobile||!p.authRev)return null;return p}catch{return null}}
function cookie(value,maxAge){return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;}
function bodyOf(req){if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body))return req.body;let raw=req.body||'{}';if(Buffer.isBuffer(raw))raw=raw.toString('utf8');if(typeof raw!=='string'||raw.length>4500000)throw Object.assign(new Error('Request too large'),{status:413});const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid JSON object');return parsed;}
function validOrigin(req){const origin=req.headers.origin;if(!origin)return false;try{const o=new URL(origin);return o.protocol==='https:'&&o.host===req.headers.host}catch{return false}}
function validConfig(){const url=process.env.GAS_WEB_APP_URL||'';return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)&&String(process.env.GAS_SHARED_SECRET||'').length>=32&&String(process.env.SESSION_SECRET||'').length>=32;}
async function callAppsScript(action,args={},actor=null){const payload={action,...args,sharedSecret:process.env.GAS_SHARED_SECRET};if(actor)payload.actor={role:actor.role,mobile:actor.mobile,customerId:actor.customerId||'',authRev:actor.authRev};
  const r=await fetch(process.env.GAS_WEB_APP_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow',signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw Object.assign(new Error('Apps Script unavailable; check deployment permissions'),{status:502});
  const content=await r.text();if(content.length>500000)throw Object.assign(new Error('Backend response too large'),{status:502});
  let result;try{result=JSON.parse(content)}catch{throw Object.assign(new Error('Apps Script returned HTML instead of JSON. Check Web app URL and access settings.'),{status:502})}
  if(!result.ok)throw Object.assign(new Error(result.error||'Backend operation failed'),{status:codeStatus[result.code]||502});return result.data;
}
export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Use POST'});
  if(!validOrigin(req)||req.headers['x-jga-request']!=='1'||!String(req.headers['content-type']||'').includes('application/json'))return json(res,403,{error:'Blocked cross-site or invalid request'});
  if(!validConfig())return json(res,503,{error:'Apps Script connection is not configured on Vercel'});
  try{
    const b=bodyOf(req),action=String(b.action||'');if(!ACTIONS.has(action))return json(res,404,{error:'Operation not available'});
    // Only PDF uploads may be large (about 3 MB); everything else stays small.
    {const size=JSON.stringify(b).length;if(size>(action==='order.upload'?4300000:32000))return json(res,413,{error:action==='order.upload'?'PDF must be smaller than 3 MB':'Request too large'})}
    if(action==='logout'){res.setHeader('Set-Cookie',cookie('',0));return json(res,200,{ok:true})}
    const actor=readToken(req);
    if(!PUBLIC_ACTIONS.has(action)&&!actor)return json(res,401,{error:'Please log in'});
    // Prevent browsers from supplying a role, identity, or shared secret.
    const {action:ignored,actor:ignoredActor,sharedSecret:ignoredSecret,...fields}=b;
    // Do not pass through unexpected top-level properties for anonymous operations.
    const data=await callAppsScript(action,fields,actor);
    if(action==='login'){
      if(!['admin','customer','leader'].includes(data.role)||!data.mobile||!data.authRev)throw Object.assign(new Error('Invalid login response'),{status:502});
      const signed={role:data.role,mobile:data.mobile,customerId:data.customerId||'',authRev:String(data.authRev),exp:Math.floor(Date.now()/1000)+MAX_AGE};
      res.setHeader('Set-Cookie',cookie(token(signed),MAX_AGE));
      return json(res,200,{role:data.role,customerId:data.customerId||'',mustChangePin:!!data.mustChangePin});
    }
    return json(res,200,data);
  }catch(err){const s=err.status||((err instanceof SyntaxError)?400:502);const msg=s===502?'Connection failed. Verify Apps Script deployment and try again.':err.message;return json(res,s,{error:msg});}
}

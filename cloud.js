/* Personal cloud sync v1 — local-first, conflict-safe, no destructive writes.
   Only finished 20-shot combines sync. Drafts remain local.
   Historical records upload only after explicit "Enable sync" confirmation. */
(function(){
'use strict';
const c=window.WEDGE_CLOUD_CONFIG||{};
const AUTH_STORE='wedge-cloud-auth-v1', META_PREFIX='wedge-cloud-meta-v1:';
const state={auth:null,email:'',status:'',error:'',busy:false,working:false,scheduled:null,conflicts:[],lastSync:null};
const ready=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.url||'')&&String(c.publishableKey||'').startsWith('sb_publishable_');
function renderIfVisible(){if(typeof ui!=='undefined'&&ui.view==='settings')render();}
function note(message,error){state.status=error?'':message;state.error=error?message:'';renderIfVisible();}
function readMeta(){const id=state.auth?.user_id;if(!id)return {enabled:false,items:{}};try{let value=JSON.parse(localStorage.getItem(META_PREFIX+id));if(value&&value.items&&typeof value.items==='object')return value;}catch(e){}return {enabled:false,items:{}};}
function saveMeta(meta){if(!state.auth)return;try{localStorage.setItem(META_PREFIX+state.auth.user_id,JSON.stringify(meta));}catch(e){note('Sync settings could not be saved on this device. Keep your JSON backup.',true);}}
function keepAuth(){try{if(state.auth)localStorage.setItem(AUTH_STORE,JSON.stringify(state.auth));else localStorage.removeItem(AUTH_STORE);}catch(e){}}
function restoreAuth(){try{const a=JSON.parse(localStorage.getItem(AUTH_STORE));if(a?.access_token&&a?.refresh_token&&a?.user_id&&a?.email)state.auth=a;}catch(e){}}
async function api(path,method,body,authenticated,extra){
 if(!ready())throw Error('Cloud configuration is not available.');
 const headers={'apikey':c.publishableKey,...extra};
 if(body!==undefined&&body!==null)headers['Content-Type']='application/json';
 if(authenticated!==false)headers['Authorization']='Bearer '+await token();
 const response=await fetch(c.url.replace(/\/$/,'')+path,{method:method||'GET',headers,body:body===undefined||body===null?undefined:JSON.stringify(body)});
 const raw=await response.text();let val=null;try{val=raw?JSON.parse(raw):null;}catch(e){}
 if(!response.ok)throw Error(val?.msg||val?.error_description||val?.message||val?.hint||'Cloud request failed ('+response.status+').');
 return val;
}
async function token(){
 if(!state.auth)throw Error('Sign in to sync first.');
 if(Date.now()+60000<state.auth.expiresAt)return state.auth.access_token;
 const v=await api('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:state.auth.refresh_token},false);
 if(!v?.access_token||!v?.refresh_token)throw Error('Your sign-in expired. Please sign in again.');
 state.auth={access_token:v.access_token,refresh_token:v.refresh_token,expiresAt:Date.now()+(Number(v.expires_in)||3600)*1000,
  user_id:v.user?.id||state.auth.user_id,email:v.user?.email||state.auth.email};
 keepAuth();return state.auth.access_token;
}
function snapshot(s){
 return JSON.stringify({
  id:s.id,createdAt:s.createdAt??null,completedAt:s.completedAt??null,preset:s.preset,min:s.min,max:s.max,
  shots:(s.shots||[]).map(x=>({index:x.index,target:x.target,club:x.club||'Unspecified',left:x.left,right:x.right,long:x.long,short:x.short})),
  ball:s.ball||'',wind:s.wind||'',surface:s.surface||'',notes:s.notes||''
 });
}
function eligible(s){return s&&typeof s.id==='string'&&s.id.length>=3&&Array.isArray(s.shots)&&s.shots.length===20&&!s.id.startsWith('cloud-conflict-');}
function validated(row){
 const s=validateImport({sessions:[row]});
 return s.length?s[0]:null;
}
async function readRemote(){
 const items=[];
 for(let offset=0;offset<10000;offset+=500){
  const rows=await api('/rest/v1/wedge_personal_sessions?select=session_id,payload,updated_at&owner_id=eq.'+
   encodeURIComponent(state.auth.user_id)+'&order=updated_at.asc&limit=500&offset='+offset);
  if(!Array.isArray(rows))throw Error('Cloud returned an unexpected response.');
  items.push(...rows);if(rows.length<500)break;
 }
 return items;
}
async function insertLocal(s){
 const payload={owner_id:state.auth.user_id,session_id:s.id,payload:s};
 const result=await api('/rest/v1/wedge_personal_sessions','POST',payload,true,{'Prefer':'return=representation'});
 if(!Array.isArray(result)||result.length!==1)throw Error('Cloud did not confirm the new combine.');
 return result[0];
}
async function updateLocal(s,remote){
 const filter='&owner_id=eq.'+encodeURIComponent(state.auth.user_id)+'&session_id=eq.'+
  encodeURIComponent(s.id)+'&updated_at=eq.'+encodeURIComponent(remote.updated_at);
 const result=await api('/rest/v1/wedge_personal_sessions?select=session_id,updated_at'+filter,
  'PATCH',{payload:s},true,{'Prefer':'return=representation'});
 if(!Array.isArray(result)||result.length!==1)return null;return result[0];
}
async function doSync(upload){
 if(state.working||!state.auth||!ready())return;
 state.working=true;state.busy=true;state.error='';renderIfVisible();
 let downloaded=0,uploaded=0,updated=0,conflicts=[];
 try{
  const meta=readMeta(),remoteRows=await readRemote(),remote=new Map(remoteRows.map(r=>[r.session_id,r]));
  let changedLocal=false;
  // Process a snapshot of all completed combines on THIS device; no drafts.
  for(const s of [...data.sessions].filter(eligible)){
   const cloud=remote.get(s.id),localHash=snapshot(s),base=meta.items[s.id];
   if(!cloud){
    if(upload&&meta.enabled){
     // First-time upload is insert-only. Never overwrite a row if a race creates one.
     try{
      const result=await insertLocal(s);
      meta.items[s.id]={fingerprint:localHash,remoteUpdatedAt:result.updated_at};
      uploaded++;
     }catch(e){if(/409|duplicate|conflict/i.test(e.message))conflicts.push(s.id);else throw e;}
    }
    continue;
   }
   const remoteHash=snapshot(cloud.payload);
   if(!validated(cloud.payload)){conflicts.push(s.id);continue;}
   if(!base){
    if(localHash===remoteHash)meta.items[s.id]={fingerprint:remoteHash,remoteUpdatedAt:cloud.updated_at};
    else conflicts.push(s.id); // Never decide silently between two different versions.
    continue;
   }
   const localChanged=localHash!==base.fingerprint,remoteChanged=remoteHash!==base.fingerprint;
   if(localChanged&&remoteChanged){conflicts.push(s.id);continue;}
   if(remoteChanged&&!localChanged){
    const clean=validated(cloud.payload);
    const index=data.sessions.findIndex(x=>x.id===s.id);
    if(index>=0){
      data.sessions[index]={...s,...clean,teamMemberId:s.teamMemberId,teamSyncStatus:s.teamSyncStatus};
      changedLocal=true;downloaded++;
    }
    meta.items[s.id]={fingerprint:snapshot(data.sessions[index]),remoteUpdatedAt:cloud.updated_at};
   }else if(localChanged&&upload&&meta.enabled){
    const saved=await updateLocal(s,cloud);
    if(!saved){conflicts.push(s.id);continue;}
    meta.items[s.id]={fingerprint:localHash,remoteUpdatedAt:saved.updated_at};updated++;
   }else if(!localChanged&&!remoteChanged){
    meta.items[s.id]={fingerprint:localHash,remoteUpdatedAt:cloud.updated_at};
   }
  }
  // Pull cloud sessions not already present. Never remove local sessions.
  const localIds=new Set(data.sessions.map(s=>s.id));
  for(const row of remoteRows){
   if(localIds.has(row.session_id))continue;
   const clean=validated(row.payload);
   if(!clean){conflicts.push(row.session_id);continue;}
   data.sessions.push(clean);localIds.add(clean.id);changedLocal=true;downloaded++;
   meta.items[clean.id]={fingerprint:snapshot(clean),remoteUpdatedAt:row.updated_at};
  }
  if(changedLocal&&!persist())throw Error('Downloaded sessions could not be saved locally. Export a backup immediately.');
  saveMeta(meta);
  state.conflicts=conflicts;state.lastSync=new Date().toISOString();
  if(conflicts.length)note('Sync found '+conflicts.length+' differing combine(s). Neither copy was overwritten. Export a JSON backup before resolving these records.',true);
  else note(uploaded+' uploaded · '+downloaded+' downloaded · '+updated+' updated. All other sessions unchanged.',false);
 }catch(e){note('Cloud sync stopped safely: '+e.message+' Your local records have not been deleted.',true);}
 finally{state.working=false;state.busy=false;renderIfVisible();}
}
async function enable(){
 if(!state.auth)return;
 const n=data.sessions.filter(eligible).length;
 if(!confirm('Enable private cloud sync for '+state.auth.email+'? This will upload up to '+n+
 ' completed combines currently saved on this device. It will NOT delete them. Only use your own account on this device.'))return;
 const meta=readMeta();meta.enabled=true;saveMeta(meta);await doSync(true);
}
async function sendCode(){
 const email=String(document.getElementById('cloud-email')?.value||'').trim().toLowerCase();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){note('Enter a valid email.',true);return;}
 state.busy=true;renderIfVisible();
 try{await api('/auth/v1/otp','POST',{email,create_user:true},false);state.email=email;note('Check your email for the one-time sign-in code.',false);}
 catch(e){note(e.message,true);}
 finally{state.busy=false;renderIfVisible();}
}
async function verify(){
 const pin=String(document.getElementById('cloud-code')?.value||'').trim();
 if(!/^\d{6,8}$/.test(pin)){note('Enter the numeric code from your email.',true);return;}
 state.busy=true;renderIfVisible();
 try{
  const result=await api('/auth/v1/verify','POST',{email:state.email,token:pin,type:'email'},false);
  if(!result?.access_token||!result?.refresh_token||!result?.user?.id)throw Error('Email verification could not be completed.');
  state.auth={access_token:result.access_token,refresh_token:result.refresh_token,user_id:result.user.id,
   email:result.user.email||state.email,expiresAt:Date.now()+(Number(result.expires_in)||3600)*1000};
  keepAuth();state.email='';
  note('Signed in. Your local sessions have not been uploaded yet.',false);
  await doSync(false); // Safe pull only until user explicitly enables uploads.
 }catch(e){note(e.message,true)}
 finally{state.busy=false;renderIfVisible();}
}
function signOut(){
 if(!confirm('Sign out of cloud sync on this device? Your local combines stay saved.'))return;
 state.auth=null;state.email='';state.error='';state.status='Signed out. All local combines remain.';keepAuth();renderIfVisible();
}
function schedule(){
 if(!state.auth||!readMeta().enabled||state.working)return;
 if(state.scheduled)clearTimeout(state.scheduled);
 state.scheduled=setTimeout(()=>{state.scheduled=null;doSync(true);},1800);
}
function render(){
 if(!ready())return '<div class="panel"><h2>☁️ Cloud sync</h2><p class="hint">Cloud connection is not configured yet. Personal practice stays offline.</p></div>';
 const meta=readMeta(),n=data.sessions.filter(eligible).length;
 let body='';
 if(!state.auth){
  body='<p class="hint">Use the same email on your iPhone, iPad, and laptop. Your combines stay private.</p>'+
  (state.email?'<div class="field"><label>Code sent to '+esc(state.email)+'</label><input id="cloud-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="6-digit code"></div>'+
    '<div class="inline" style="margin-top:12px"><button class="btn dark" data-cloud-action="verify">Verify code</button><button class="btn ghost" data-cloud-action="other-email">Different email</button></div>':
   '<div class="field"><label>Your email</label><input id="cloud-email" type="email" autocomplete="email" placeholder="your@email.com"></div>'+
    '<button class="btn dark" style="margin-top:12px" data-cloud-action="send-code">Email sign-in code →</button>');
 }else{
  body='<p class="hint">Signed in as <b>'+esc(state.auth.email)+'</b> · '+n+' completed combines on this device.</p>'+
   (meta.enabled?'<div class="notice">✓ Automatic personal syncing enabled for this device. Your history stays local too.</div>'+
    '<div class="inline" style="margin-top:12px"><button class="btn dark" data-cloud-action="sync">↻ Sync now</button><button class="btn ghost" data-cloud-action="signout">Sign out</button></div>':
    '<p class="hint">You can safely download existing cloud combines now. Enable upload when you are ready to back up this device’s completed sessions.</p>'+
    '<div class="inline"><button class="btn dark" data-cloud-action="enable">Enable sync on this device</button><button class="btn ghost" data-cloud-action="sync">↓ Check cloud</button><button class="btn ghost" data-cloud-action="signout">Sign out</button></div>');
 }
 return '<div class="panel" style="margin-bottom:18px"><h2>☁️ Personal cloud sync</h2>'+body+
 (state.busy?'<p class="hint" role="status">Connecting…</p>':'')+
 (state.error?'<div class="notice error" role="alert" style="margin-top:12px">'+esc(state.error)+'</div>':'')+
 (state.status?'<p class="hint" role="status" style="margin-top:12px">'+esc(state.status)+'</p>':'')+
 '<p class="footnote">Only completed combines sync, not unfinished drafts. Conflicting edits are never silently overwritten. Keep exporting your JSON backups.</p></div>';
}
function action(name){
 if(state.busy)return;
 if(name==='send-code')return sendCode();
 if(name==='verify')return verify();
 if(name==='other-email'){state.email='';note('',false);return}
 if(name==='enable')return enable();
 if(name==='sync')return doSync(readMeta().enabled);
 if(name==='signout')return signOut();
}
async function init(){
 restoreAuth();
 if(state.auth){await doSync(readMeta().enabled);}
}
if(typeof window.addEventListener==='function'){
 window.addEventListener('online',()=>{if(state.auth)doSync(readMeta().enabled);});
 window.addEventListener('visibilitychange',()=>{if(typeof document!=='undefined'&&!document.hidden&&state.auth)doSync(readMeta().enabled);});
}
if(typeof window.setInterval==='function')window.setInterval(()=>{
 if(state.auth&&!state.working&&typeof document!=='undefined'&&!document.hidden)doSync(readMeta().enabled);
},120000);
window.WedgeCloud={init,render,action,schedule,sync:()=>doSync(readMeta().enabled),isEnabled:()=>!!state.auth&&readMeta().enabled};
})();
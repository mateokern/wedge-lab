/* Personal cloud sync v1 — local-first, conflict-safe, no destructive writes.
   Only finished 20-shot combines sync. Drafts remain local.
   Historical records upload only after explicit "Enable sync" confirmation. */
(function(){
'use strict';
const c=window.WEDGE_CLOUD_CONFIG||{};
const AUTH_STORE='wedge-cloud-auth-v1', META_PREFIX='wedge-cloud-meta-v1:';
const state={auth:null,email:'',status:'',error:'',busy:false,working:false,scheduled:null,conflicts:[],lastSync:null};
const ready=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.url||'')&&String(c.publishableKey||'').startsWith('sb_publishable_');
function renderIfVisible(){if(typeof ui!=='undefined'&&ui.view==='settings'&&typeof window.render==='function')window.render();}
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
  ball:s.ball||'',wind:s.wind||'',surface:s.surface||'',notes:s.notes||'',
  ...(s.preset==='ladder'&&Array.isArray(s.ladderClubs)?{ladderClubs:s.ladderClubs}:{})
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
 try{await api('/auth/v1/otp','POST',{email,create_user:true},false);state.email=email;note('Check your inbox for a secure sign-in link. If using the iPhone Home Screen app, copy the link from the email and paste it here without opening it.',false);}
 catch(e){note(e.message,true);}
 finally{state.busy=false;renderIfVisible();}
}

async function signInWithPassword(){
 const email=String(document.getElementById('cloud-password-email')?.value||'').trim().toLowerCase();
 const password=String(document.getElementById('cloud-password')?.value||'');
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||!password){note('Enter your email and password.',true);return;}
 // Do not persist or log passwords. Only the secured Supabase Auth endpoint receives them.
 const field=document.getElementById('cloud-password');if(field)field.value='';
 state.busy=true;state.error='';renderIfVisible();
 try{
  const session=await api('/auth/v1/token?grant_type=password','POST',{email,password},false);
  await completeSignIn(session);
 }catch(e){note('Password sign-in failed: '+e.message,true);}
 finally{state.busy=false;renderIfVisible();}
}
async function setPassword(){
 if(!state.auth)return;
 const password=String(document.getElementById('cloud-new-password')?.value||'');
 const confirmation=String(document.getElementById('cloud-confirm-password')?.value||'');
 if(password.length<12){note('Use a unique password with at least 12 characters.',true);return;}
 if(password!==confirmation){note('The two passwords do not match.',true);return;}
 const first=document.getElementById('cloud-new-password'),second=document.getElementById('cloud-confirm-password');
 if(first)first.value='';if(second)second.value='';
 state.busy=true;state.error='';renderIfVisible();
 try{
  const user=await api('/auth/v1/user','PUT',{password},true);
  if(!user?.id)throw Error('Supabase did not confirm the password update.');
  note('Password saved! You can now sign in on any device using your email and password.',false);
 }catch(e){note('Could not set password: '+e.message+' If reauthentication is required, sign in again in Safari.',true);}
 finally{state.busy=false;renderIfVisible();}
}
async function completeSignIn(result){
 if(!result?.access_token||!result?.refresh_token||!result?.user?.id||!result?.user?.email)
  throw Error('The sign-in did not return a valid account session.');
 state.auth={access_token:result.access_token,refresh_token:result.refresh_token,user_id:result.user.id,
  email:result.user.email,expiresAt:Date.now()+(Number(result.expires_in)||3600)*1000};
 keepAuth();state.email='';
 note('Signed in successfully. Your local sessions are still safe. Review the account before enabling uploads.',false);
 await doSync(false); // Download only: never upload local personal history automatically.
}
function parseSignInLink(raw){
 let link;try{link=new URL(String(raw||'').trim());}catch(e){throw Error('Paste the complete link from your Supabase email.');}
 if(link.protocol!=='https:'||link.origin!==new URL(c.url).origin||link.pathname!=='/auth/v1/verify')
  throw Error('That is not a Wedge Lab Supabase sign-in link. Use the full link from your email.');
 const tokenHash=link.searchParams.get('token')||link.searchParams.get('token_hash');
 const type=link.searchParams.get('type');
 if(!tokenHash||tokenHash.length<16||tokenHash.length>2048||!['magiclink','signup','email'].includes(type))
  throw Error('This email link is missing a valid sign-in token or type.');
 return {token_hash:tokenHash,type};
}
async function verifyLink(){
 const pasted=document.getElementById('cloud-link')?.value||'';
 let parsed;try{parsed=parseSignInLink(pasted);}catch(e){note(e.message,true);return;}
 state.busy=true;renderIfVisible();
 try{
  const result=await api('/auth/v1/verify','POST',parsed,false);
  await completeSignIn(result);
 }catch(e){note('This link could not sign you in: '+e.message+' Request a new email link if it expired or was already opened.',true);}
 finally{state.busy=false;renderIfVisible();}
}
async function acceptRedirect(){
 if(!ready()||!window.location?.hash)return false;
 const hash=window.location.hash.replace(/^#/,'');
 const params=new URLSearchParams(hash);
 if(!params.has('access_token')||!params.has('refresh_token'))return false;
 const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');
 const expires_in=Number(params.get('expires_in'))||3600;
 // Clear sensitive tokens from the visible URL and navigation history immediately.
 if(window.history?.replaceState)window.history.replaceState(null,'',window.location.pathname+window.location.search);
 state.busy=true;renderIfVisible();
 try{
  const user=await api('/auth/v1/user','GET',null,false,{'Authorization':'Bearer '+access_token});
  await completeSignIn({access_token,refresh_token,expires_in,user});
  return true;
 }catch(e){note('Email sign-in did not finish: '+e.message+' You can request another link.',true);return false;}
 finally{state.busy=false;renderIfVisible();}
}
async function verify(){
 const pin=String(document.getElementById('cloud-code')?.value||'').trim();
 if(!/^\d{6,8}$/.test(pin)){note('Enter the numeric code from your email.',true);return;}
 state.busy=true;renderIfVisible();
 try{
  const result=await api('/auth/v1/verify','POST',{email:state.email,token:pin,type:'email'},false);
  await completeSignIn(result);
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
  (state.email?'<div class="notice" style="margin-bottom:12px"><b>Link sent to '+esc(state.email)+'.</b> On iPhone Home Screen, long-press the sign-in button in the email, tap <b>Copy Link</b>, then paste below without opening it. This keeps your original saved combines in the app.</div>'+
   '<div class="field"><label for="cloud-link">Paste the sign-in link from your email</label><textarea id="cloud-link" rows="3" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="https://…supabase.co/auth/v1/verify?token=…"></textarea></div>'+
   '<div class="inline" style="margin-top:12px"><button class="btn dark" data-cloud-action="use-link">Sign in with copied link</button><button class="btn ghost" data-cloud-action="other-email">Use another email</button></div>'+
   '<details style="margin-top:15px"><summary class="hint">Have a numeric code instead?</summary><div class="field" style="margin-top:10px"><label for="cloud-code">Email verification code</label><input id="cloud-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="6-digit code"></div><button class="btn ghost" style="margin-top:8px" data-cloud-action="verify">Verify code</button></details>':
   '<div class="field"><label>Your email</label><input id="cloud-email" type="email" autocomplete="email" placeholder="your@email.com"></div>'+
    '<button class="btn dark" style="margin-top:12px" data-cloud-action="send-code">Email sign-in link →</button>'+
    '<p class="footnote">Uses Supabase’s default email links; no custom SMTP template is required. On a desktop browser you can also click the email link if the Supabase redirect is configured.</p>');
 }else{
  body='<p class="hint">Signed in as <b>'+esc(state.auth.email)+'</b> · '+n+' completed combines on this device.</p>'+
   (meta.enabled?'<div class="notice">✓ Automatic personal syncing enabled for this device. Your history stays local too.</div>'+
    '<div class="inline" style="margin-top:12px"><button class="btn dark" data-cloud-action="sync">↻ Sync now</button><button class="btn ghost" data-cloud-action="signout">Sign out</button></div>':
    '<p class="hint">You can safely download existing cloud combines now. Enable upload when you are ready to back up this device’s completed sessions.</p>'+
    '<div class="inline"><button class="btn dark" data-cloud-action="enable">Enable sync on this device</button><button class="btn ghost" data-cloud-action="sync">↓ Check cloud</button><button class="btn ghost" data-cloud-action="signout">Sign out</button></div>');
 }
 if(!state.auth){
  body+='<div class="divider"></div><h3>Sign in with password</h3>'+
    '<p class="hint">Already set a Wedge Lab password? Use it to sign in directly on your iPhone, iPad, or laptop without email links.</p>'+
    '<div class="field"><label for="cloud-password-email">Email</label><input id="cloud-password-email" type="email" autocomplete="username" placeholder="your@email.com"></div>'+
    '<div class="field" style="margin-top:10px"><label for="cloud-password">Password</label><input id="cloud-password" type="password" autocomplete="current-password"></div>'+
    '<button class="btn dark" style="margin-top:12px" data-cloud-action="password-signin">Sign in with password</button>';
 }else{
  body+='<details style="margin-top:18px"><summary class="hint"><b>Set or change your sign-in password</b> (no custom SMTP required)</summary>'+
    '<p class="hint" style="margin-top:10px">Set a unique password after signing in via an email link. Save it in your password manager to sign in easily on other devices.</p>'+
    '<div class="field"><label for="cloud-new-password">New password (12+ characters)</label><input id="cloud-new-password" type="password" minlength="12" autocomplete="new-password"></div>'+
    '<div class="field" style="margin-top:10px"><label for="cloud-confirm-password">Confirm new password</label><input id="cloud-confirm-password" type="password" minlength="12" autocomplete="new-password"></div>'+
    '<button class="btn dark" style="margin-top:12px" data-cloud-action="set-password">Save password</button></details>';
 }
 return '<div class="panel" style="margin-bottom:18px"><h2>☁️ Personal cloud sync</h2>'+body+
 (state.busy?'<p class="hint" role="status">Connecting…</p>':'')+
 (state.error?'<div class="notice error" role="alert" style="margin-top:12px">'+esc(state.error)+'</div>':'')+
 (state.status?'<p class="hint" role="status" style="margin-top:12px">'+esc(state.status)+'</p>':'')+
 '<p class="footnote">Only completed combines sync, not unfinished drafts. Conflicting edits are never silently overwritten. Keep exporting your JSON backups.</p></div>';
}
function action(name){
 if(state.busy)return;
 if(name==='password-signin')return signInWithPassword();
 if(name==='set-password')return setPassword();
 if(name==='send-code')return sendCode();
 if(name==='verify')return verify();
 if(name==='use-link')return verifyLink();
 if(name==='other-email'){state.email='';note('',false);return}
 if(name==='enable')return enable();
 if(name==='sync')return doSync(readMeta().enabled);
 if(name==='signout')return signOut();
}
async function init(){
 restoreAuth();
 if(await acceptRedirect())return;
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
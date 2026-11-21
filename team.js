/* Wedge Lab Team Mode: LIU invitation-only shared combines.
   Solo history remains in the original localStorage key. No existing sessions
   are sent to the cloud unless a player explicitly starts a TEAM combine. */
(function(){
'use strict';
const cfg=window.WEDGE_TEAM_CONFIG||{};
const AUTH_KEY='wedge-team-auth-v1';
const ranges=[['30-75','30–75 yd'],['50-90','50–90 yd'],['90-135','90–135 yd'],['120-155','120–155 yd']];
const state={auth:null,member:null,members:[],sessions:[],range:'30-75',player:'all',
  email:'',notice:'',error:'',busy:false,loaded:false,refreshing:false};
function configReady(){return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(String(cfg.url||''))&&String(cfg.publishableKey||'').length>20;}
function h(value){return esc(value);}
function storeAuth(){try{if(state.auth)localStorage.setItem(AUTH_KEY,JSON.stringify(state.auth));else localStorage.removeItem(AUTH_KEY);}catch(e){}}
function restoreAuth(){try{const a=JSON.parse(localStorage.getItem(AUTH_KEY));if(a&&a.access_token&&a.refresh_token)state.auth=a;}catch(e){}}
function paint(){if(typeof ui!=='undefined'&&ui.view==='team'&&typeof window.render==='function')window.render();}
function message(err){state.error=typeof err==='string'?err:(err?.message||'Something went wrong.');state.notice='';paint();}
async function request(path,method,body,needAuth,extraHeaders){
 if(!configReady())throw Error('Team database is not connected yet.');
 const headers={'apikey':cfg.publishableKey,...(extraHeaders||{})};
 if(body!==undefined&&body!==null)headers['Content-Type']='application/json';
 if(needAuth!==false)headers['Authorization']='Bearer '+await accessToken();
 const response=await fetch(String(cfg.url).replace(/\/$/,'')+path,{method:method||'GET',headers,body:body===undefined||body===null?undefined:JSON.stringify(body)});
 const raw=await response.text();let val=null;
 try{val=raw?JSON.parse(raw):null;}catch(e){val=null;}
 if(!response.ok)throw Error(val?.msg||val?.error_description||val?.message||'Team connection failed ('+response.status+').');
 return val;
}
async function accessToken(){
 if(!state.auth)throw Error('Sign in with your LIU team email first.');
 if(Date.now()+45000<state.auth.expiresAt)return state.auth.access_token;
 const result=await request('/auth/v1/token?grant_type=refresh_token','POST',
  {refresh_token:state.auth.refresh_token},false);
 if(!result?.access_token||!result?.refresh_token)throw Error('Your sign-in expired. Please sign in again.');
 state.auth={access_token:result.access_token,refresh_token:result.refresh_token,
  expiresAt:Date.now()+(Number(result.expires_in)||3600)*1000,
  email:result.user?.email||state.auth.email};
 storeAuth();return state.auth.access_token;
}
async function loadRoster(){
 if(!state.auth)return;
 const myId=await request('/rest/v1/rpc/wedge_team_my_id','POST',{});
 const roster=await request('/rest/v1/wedge_team_members?select=id,display_name&active=eq.true&order=display_name.asc');
 state.members=Array.isArray(roster)?roster:[];
 state.member=state.members.find(p=>p.id===myId)||null;
 if(!state.member){
   state.notice='This email is not on the LIU team roster yet. Ask the team organizer to add it.';
   state.sessions=[];state.loaded=false;return;
 }
 state.loaded=true;
}
async function loadScores(){
 if(!state.member)return;
 let collected=[];
 for(let offset=0;offset<10000;offset+=500){
  const page=await request('/rest/v1/wedge_team_sessions?select=id,member_id,played_at,preset,min_yards,max_yards,shots,score,wind,surface&order=played_at.desc&limit=500&offset='+offset);
  if(!Array.isArray(page))throw Error('Could not read the team results.');
  collected=collected.concat(page);
  if(page.length<500)break;
 }
 state.sessions=collected;
}
async function refresh(){
 if(!configReady()||!state.auth||state.refreshing)return;
 state.refreshing=true;state.error='';
 try{await loadRoster();if(state.member){await loadScores();}}
 catch(e){message(e);}
 finally{state.refreshing=false;paint();}
}
async function init(){
 restoreAuth();if(!configReady()||!state.auth)return;
 await refresh();if(state.member)await syncPending(false);
}
async function sendCode(){
 const email=String(document.getElementById('team-email')?.value||'').trim().toLowerCase();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){message('Enter a valid email address.');return;}
 state.busy=true;state.error='';paint();
 try{
  await request('/auth/v1/otp','POST',{email,create_user:true},false);
  state.email=email;state.notice='Check your inbox for your six-digit sign-in code.';
 }catch(e){message(e);}
 finally{state.busy=false;paint();}
}
async function verifyCode(){
 const code=String(document.getElementById('team-code')?.value||'').trim();
 if(!/^\d{6,8}$/.test(code)){message('Enter the numeric code from your email.');return;}
 state.busy=true;state.error='';
 try{
  const a=await request('/auth/v1/verify','POST',{type:'email',email:state.email,token:code},false);
  if(!a?.access_token||!a?.refresh_token)throw Error('Code could not be verified.');
  state.auth={access_token:a.access_token,refresh_token:a.refresh_token,
   expiresAt:Date.now()+(Number(a.expires_in)||3600)*1000,email:a.user?.email||state.email};
  storeAuth();state.email='';state.notice='';
  await refresh();
  if(state.member)await syncPending(false);
 }catch(e){message(e);}
 finally{state.busy=false;paint();}
}
function signOut(){
 state.auth=null;state.member=null;state.members=[];state.sessions=[];
 state.email='';state.notice='';state.error='';state.loaded=false;storeAuth();paint();
}
function fmtScore(v){return Number.isFinite(Number(v))?Number(v).toFixed(1):'—';}
function presetsOnly(){return state.sessions.filter(s=>s.preset===state.range);}
function computeLeaderboard(){
 const byId=new Map(state.members.map(m=>[m.id,{...m,scores:[]}]));
 for(const s of presetsOnly()){
  const p=byId.get(s.member_id);if(p&&Number.isFinite(Number(s.score)))p.scores.push({score:Number(s.score),at:s.played_at});
 }
 return [...byId.values()].map(p=>{
  const chronological=p.scores.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  return {...p,count:p.scores.length,
   last5:p.scores.length?p.scores.slice(0,5).reduce((a,b)=>a+b.score,0)/Math.min(5,p.scores.length):null};
 }).map(p=>({...p,best:p.scores.length?Math.min(...p.scores.map(s=>s.score)):null}))
 .sort((a,b)=>(a.best??Infinity)-(b.best??Infinity)||(a.last5??Infinity)-(b.last5??Infinity)||a.display_name.localeCompare(b.display_name));
}
function renderLeaderboard(){
 const results=computeLeaderboard();
 return '<div class="panel"><div class="panelhead"><h2>🏆 LIU leaderboard</h2><span class="tag">Lower is better</span></div>'+
 '<div class="field" style="max-width:240px;margin-bottom:14px"><label>Combine distance</label><select id="team-range-filter">'+ranges.map(p=>
 '<option value="'+p[0]+'" '+(state.range===p[0]?'selected':'')+'>'+p[1]+'</option>').join('')+'</select></div>'+
 '<div class="tablewrap"><table class="tinytable"><thead><tr><th>Rank</th><th>Player</th><th class="r">Best</th><th class="r">Last 5 avg</th><th class="r">Combines</th></tr></thead><tbody>'+
 results.map((p,i)=>'<tr><td>'+(p.count?i+1:'—')+'</td><td><b>'+h(p.display_name)+'</b>'+(p.id===state.member?.id?' <span class="tag">You</span>':'')+'</td><td class="r"><b>'+fmtScore(p.best)+'</b></td><td class="r">'+fmtScore(p.last5)+'</td><td class="r">'+p.count+'</td></tr>').join('')+
 '</tbody></table></div><p class="footnote">Ranked by personal-best 20-shot combine for the selected range. Last-five averages are shown separately. Only approved LIU team members can read these results.</p></div>';
}
function renderPlayer(){
 const pid=state.player;
 const matches=presetsOnly().filter(s=>pid==='all'||s.member_id===pid);
 const shots=matches.flatMap(s=>Array.isArray(s.shots)?s.shots:[]);
 const aggregates=stats(shots);
 const who=pid==='all'?'All LIU teammates':state.members.find(m=>m.id===pid)?.display_name||'Player';
 const games=matches.map(s=>({shots:s.shots,completedAt:s.played_at,createdAt:s.played_at})).sort((a,b)=>String(a.completedAt).localeCompare(String(b.completedAt)));
 return '<div class="panel"><div class="panelhead"><h2>📊 Player analysis</h2><span class="tag">'+matches.length+' combines</span></div>'+
 '<div class="field" style="max-width:280px;margin-bottom:16px"><label>See results for</label><select id="team-player-filter"><option value="all" '+(pid==='all'?'selected':'')+'>All teammates</option>'+
 state.members.map(p=>'<option value="'+h(p.id)+'" '+(pid===p.id?'selected':'')+'>'+h(p.display_name)+'</option>').join('')+'</select></div>'+
 '<p class="hint">'+h(who)+' · '+ranges.find(r=>r[0]===state.range)?.[1]+' · All 20 shots counted in analysis</p>'+
 (shots.length?'<div class="kpi-compact">'+statCard('Shots recorded',shots.length,'Across team combines')+
 statCard('Average miss',fmt(aggregates.avg)+' yd','All shots included')+
 statCard('Short shots',fmt(aggregates.shortPct,0)+'%','Carry-distance tendency')+'</div>'+
 '<div class="twocharts"><div><h3>Dispersion</h3>'+scatterPlot(shots)+'</div><div><h3>Accuracy over time</h3>'+trendChart(games,'all')+'</div></div>'+
 '<p class="footnote">Compare players at the same combine distance. Wind, surface, and practice conditions still matter.</p>':
 '<div class="empty"><strong>No team results for this selection yet.</strong>Complete your first team combine to appear here.</div>')+'</div>';
}
function render(){
 if(!configReady())return '<div class="eyebrow">LIU SHARKS · TEAM MODE</div><h1>Wedge Lab, together. 🦈</h1>'+
 '<div class="panel"><h2>Private team competition</h2><p>Team Mode is built, but the shared database has not been connected yet. Your personal practice and saved results are unaffected.</p>'+
 '<div class="notice warn"><b>Organizer setup required:</b> Connect Supabase, run <code>supabase/team_mode.sql</code>, add approved players, set up email OTP, then enter the Supabase Project URL and publishable key in <code>team-config.js</code>. Never put a secret or service-role key in the website.</div>'+
 '<p class="hint">Once connected, teammates will sign in with one email code. No passwords or public registrations, and non-roster accounts cannot access scores.</p></div>';
 if(!state.auth)return '<div class="eyebrow">INVITE-ONLY · LIU GOLF</div><h1>Join the team. 🦈</h1>'+
 '<p class="sub">Enter the email address approved by your team organizer. We will send you a one-time code; no password needed.</p>'+
 '<div class="panel" style="max-width:530px"><h2>Team sign-in</h2>'+
 (state.email?'<div class="field"><label>Code sent to '+h(state.email)+'</label><input id="team-code" type="text" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="6-digit code"></div>'+
 '<div class="inline" style="margin-top:15px"><button class="btn dark" data-team-action="verify" '+(state.busy?'disabled':'')+'>Verify code</button><button class="btn ghost" data-team-action="other-email">Use another email</button></div>':
 '<div class="field"><label>Your approved email</label><input id="team-email" type="email" autocomplete="email" placeholder="you@example.edu"></div>'+
 '<div style="margin-top:15px"><button class="btn dark" data-team-action="send-code" '+(state.busy?'disabled':'')+'>Email me a code →</button></div>')+
 '<p class="footnote">Only people added to the private LIU team roster can see the leaderboard. Any sign-in attempt outside the roster cannot read or post results.</p></div>'+
 renderNotice();
 if(!state.member)return '<div class="eyebrow">LIU SHARKS · TEAM MODE</div><h1>Team access pending</h1><div class="panel"><p>Your signed-in email is '+h(state.auth?.email||'unknown')+'. Ask the organizer to approve it on the team roster.</p><button class="btn ghost" data-team-action="signout">Sign out</button> <button class="btn dark" data-team-action="refresh">Check again</button></div>'+renderNotice();
 const unSynced=data.sessions.filter(s=>s.teamMemberId===state.member.id&&s.teamSyncStatus!=='synced').length;
 return '<div class="eyebrow">LIU SHARKS · TEAM MODE</div><div class="panelhead"><div><h1>Chase the leaderboard. 🏆</h1><p class="sub" style="margin-bottom:0">Playing as <b>'+h(state.member.display_name)+'</b> · private LIU team</p></div><button class="btn ghost tinybtn" data-team-action="signout">Sign out</button></div>'+
 '<div class="team-top"><div class="panel team-intro"><h2>Ready for the next combine?</h2><p>20 random targets, DECADE-style scoring, every shot saved locally and to the team scoreboard.</p>'+
 '<div class="inline"><button class="btn primary" data-team-action="team-start">+ Start LIU team combine</button><button class="btn ghost" data-team-action="refresh">↻ Refresh scores</button></div>'+
 (unSynced?'<div class="notice warn" style="margin-top:15px">'+unSynced+' team combine(s) pending upload. <button class="btn ghost tinybtn" data-team-action="sync">Retry upload</button></div>':'')+
 '</div><div class="panel"><h3>Your team</h3><div class="stat"><label>Approved players</label><div class="n">'+state.members.length+'</div><small>Invitation-only access</small></div><p class="hint" style="margin-top:12px">Your personal history stays in Sessions. Only combines started from Team Mode are shared.</p></div></div>'+
 renderNotice()+renderLeaderboard()+'<div class="spacer"></div>'+renderPlayer();
}
function renderNotice(){
 return (state.error?'<div class="notice error" style="margin:15px 0">'+h(state.error)+'</div>':'')+
 (state.notice?'<div class="notice" style="margin:15px 0">'+h(state.notice)+'</div>':'');
}
async function syncSession(id,quiet){
 const s=data.sessions.find(x=>x.id===id);
 if(!s||!s.teamMemberId||!state.member||s.teamMemberId!==state.member.id)return false;
 if(!Array.isArray(s.shots)||s.shots.length!==20)return false;
 try{
  const payload={id:s.id,member_id:s.teamMemberId,played_at:s.completedAt||new Date().toISOString(),
   preset:s.preset,min_yards:s.min,max_yards:s.max,wind:s.wind||'Unknown',
   surface:s.surface||'Unknown',
   shots:s.shots.map(x=>({target:x.target,left:x.left,right:x.right,long:x.long,short:x.short,club:String(x.club||'Unspecified')}))};
  await request('/rest/v1/wedge_team_sessions?on_conflict=id','POST',payload,true,
   {'Prefer':'resolution=merge-duplicates,return=minimal'});
  s.teamSyncStatus='synced';s.teamUploadedAt=new Date().toISOString();persist();
  if(!quiet){state.notice='Team combine uploaded successfully.';state.error='';}
  return true;
 }catch(e){
  s.teamSyncStatus='pending';persist();if(!quiet)message('Saved on this device but not uploaded: '+e.message);
  return false;
 }
}
async function syncPending(showNotice){
 if(!state.member)return;
 const pending=data.sessions.filter(s=>s.teamMemberId===state.member.id&&s.teamSyncStatus!=='synced');
 let count=0;for(const s of pending){if(await syncSession(s.id,true))count++;}
 if(showNotice){state.notice=count?count+' team combine(s) synced.':pending.length?'Upload unsuccessful. Your local results are safe.':'All your team combines are up to date.';paint();}
 if(count)await loadScores().catch(()=>{});
}
async function deleteTeamSession(s){
 if(!s.teamMemberId)return;
 if(!state.member||s.teamMemberId!==state.member.id){message('Sign in as the player who recorded this team combine to delete it.');go('team');return;}
 try{
  await request('/rest/v1/wedge_team_sessions?id=eq.'+encodeURIComponent(s.id),'DELETE',null,true);
  data.sessions=data.sessions.filter(x=>x.id!==s.id);persist();await loadScores();go('sessions');
 }catch(e){message('Could not remove this team combine. Your local record was kept: '+e.message);go('team');}
}
async function action(name){
 state.error='';state.notice='';
 if(name==='send-code')return sendCode();
 if(name==='verify')return verifyCode();
 if(name==='other-email'){state.email='';paint();return;}
 if(name==='signout')return signOut();
 if(name==='refresh')return refresh();
 if(name==='sync')return syncPending(true);
 if(name==='team-start'){
  if(!state.member){message('Please sign in first.');return;}
  go('start');ui.teamPlay=true;render();return;
 }
}
function onChange(element){
 if(element.id==='team-range-filter'){state.range=element.value;paint();}
 if(element.id==='team-player-filter'){state.player=element.value;paint();}
}
function onFinished(id){syncSession(id,false).then(ok=>{if(ok)loadScores().then(paint).catch(()=>{});else paint();});}
function onEdited(id){const s=data.sessions.find(x=>x.id===id);if(!s||!s.teamMemberId)return;
 s.teamSyncStatus='pending';persist();onFinished(id);}
function enter(){if(state.auth&&configReady()){refresh().then(()=>syncPending(false));}}
window.WedgeTeam={init,render,action,onChange,enter,onFinished,onEdited,deleteTeamSession,
 member:function(){return state.member;}, configured:configReady};
/* Refresh while the Team screen is open; queued offline results retry safely.
   No network polling during personal practice or while the app is hidden. */
if(typeof window.setInterval==='function')window.setInterval(function(){
 if(typeof ui!=='undefined'&&ui.view==='team'&&state.member&&!state.refreshing
    &&(typeof document==='undefined'||document.visibilityState!=='hidden')){
   refresh().then(function(){return syncPending(false);}).catch(function(){});
 }
},60000);
if(typeof window.addEventListener==='function')window.addEventListener('online',function(){
 if(state.member)refresh().then(function(){return syncPending(true);}).catch(function(){});
});
})();
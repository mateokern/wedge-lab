/* Additive personal performance tools. No changes to classic score or saved history. */
const PERFORMANCE_PRESETS=[['30-75',30,75],['50-90',50,90],['90-135',90,135],['120-155',120,155]];
const LADDER_BANDS=[
 {club:'58°',min:30,max:55},
 {club:'54°',min:56,max:82},
 {club:'50°',min:83,max:108},
 {club:'46° PW',min:109,max:133},
 {club:'9 iron',min:134,max:155}
];
function ladderPlan(){
 const pick=(lo,hi)=>lo+Math.floor(Math.random()*(hi-lo+1));
 const pair=(lo,hi)=>{const a=pick(lo,hi-1),b=pick(a+1,hi);return [a,b]};
 const up=LADDER_BANDS.flatMap((b,i)=>{let targets=i===0?[30,pick(39,b.max)]:i===4?[pick(b.min,149),155]:pair(b.min,b.max);return targets.map(target=>({target,club:b.club}));});
 const down=[...LADDER_BANDS].reverse().flatMap((b,i)=>{let targets=i===0?pair(b.min,154).reverse():i===4?[pick(35,b.max),30]:pair(b.min,b.max).reverse();return targets.map(target=>({target,club:b.club}));});
 return [...up,...down];
}
function performanceKey(s){return s.preset==='ladder'?'ladder':String(s.preset)+'/'+s.min+'/'+s.max;}
function performanceDate(s){let t=Date.parse(s.completedAt||s.createdAt||'');return Number.isFinite(t)?t:null;}
function comparableSessions(s){return data.sessions.filter(x=>x.id!==s.id&&performanceKey(x)===performanceKey(s)&&performanceDate(x)!==null&&performanceDate(s)!==null&&performanceDate(x)<performanceDate(s)&&combineScore(x.shots)!==null).sort((a,b)=>performanceDate(b)-performanceDate(a));}
function sessionRating(s){
 const score=combineScore(s.shots),history=comparableSessions(s),recent=history.slice(0,5);
 const pb=score!==null&&history.length>0&&score<Math.min(...history.map(x=>combineScore(x.shots)));
 if(score===null||recent.length<3)return {tone:'neutral',label:'Building baseline',n:recent.length,pb};
 const baseline=mean(recent.map(x=>combineScore(x.shots)));
 const tone=baseline===0?(score===0?'typical':'poor'):score<=baseline*.9?'good':score>baseline*1.1?'poor':'typical';
 return {tone,label:tone==='good'?'Better than usual':tone==='poor'?'Below usual':'Typical',baseline,n:recent.length,pb};
}
function ratingHTML(s,detail=false){
 const r=sessionRating(s);return '<div class="perf-rating '+r.tone+'"><b>'+r.label+'</b>'+(r.pb?' <span class="perf-pb">★ Personal best</span>':'')+(detail?'<div class="hint">'+(r.baseline===undefined?'Needs 3 earlier comparable sessions ('+r.n+' so far).':'Prior '+r.n+' same-range scores averaged '+fmt(r.baseline)+'. Lower is better; green ≥10% better, red >10% worse.')+'</div>':'')+'</div>';
}
function perfScoreChart(sessions){
 const all=sessions.slice(-20),v=all.map(s=>combineScore(s.shots));if(!v.length)return '<div class="hint perf-nochart">No sessions yet</div>';
 const full=sessions.map(s=>combineScore(s.shots)),offset=full.length-v.length;
 const rolling=v.map((_,i)=>mean(full.slice(Math.max(0,offset+i-4),offset+i+1)));
 const values=[...v,...rolling],low=Math.min(...values),high=Math.max(...values),pad=Math.max(2,(high-low)*.15);
 const W=300,H=108,p=20,min=Math.max(0,low-pad),max=high+pad;
 const x=i=>v.length===1?W/2:p+(W-2*p)*i/(v.length-1),y=z=>H-p-(z-min)/(max-min||1)*(H-2*p);
 return '<svg class="perf-chart" viewBox="0 0 300 108" role="img" aria-label="Combine scores, chronological, lower is better"><path d="M20 20H280 M20 54H280 M20 88H280" stroke="#b5d3e2" stroke-opacity=".65" fill="none"/><text x="2" y="15" font-size="9" fill="currentColor">'+fmt(max,0)+'</text><text x="2" y="102" font-size="9" fill="currentColor">'+fmt(min,0)+'</text><polyline points="'+rolling.map((z,i)=>x(i)+','+y(z)).join(' ')+'" fill="none" stroke="#D6A53D" stroke-dasharray="5 3" stroke-width="2"/><polyline points="'+v.map((z,i)=>x(i)+','+y(z)).join(' ')+'" fill="none" stroke="#3189B6" stroke-width="2.5"/>'+v.map((z,i)=>'<circle cx="'+x(i)+'" cy="'+y(z)+'" r="3.7" fill="#3189B6"><title>'+esc(formatDate(all[i].completedAt))+' · '+fmt(z)+'</title></circle>').join('')+'</svg>';
}
function performanceDashboard(){
 const all=data.sessions.filter(s=>combineScore(s.shots)!==null);
 const cards=PERFORMANCE_PRESETS.map(([key,min,max])=>{
  const set=all.filter(s=>s.preset===key&&s.min===min&&s.max===max);
  const dated=set.filter(s=>performanceDate(s)!==null).sort((a,b)=>performanceDate(a)-performanceDate(b));
  const scores=set.map(s=>combineScore(s.shots)),last=dated.slice(-5).map(s=>combineScore(s.shots));
  return '<section class="panel perf-card"><div class="panelhead"><h3>'+namePreset(key,min,max)+'</h3><span class="tag">'+set.length+' combines</span></div><div class="perf-pair"><div><span class="hint">Personal best</span><div class="perf-number">'+(scores.length?fmt(Math.min(...scores)):'—')+'</div></div><div><span class="hint">Last '+(last.length||5)+' avg.</span><div class="perf-number">'+(last.length?fmt(mean(last)):'—')+'</div></div></div>'+perfScoreChart(dated)+'<div class="footnote">Blue: score · Gold: rolling 5 · Oldest → newest</div></section>';
 }).join('');
 const rows=all.flatMap(s=>s.shots),classic=all.filter(s=>s.preset!=='ladder'),classicShots=classic.flatMap(s=>s.shots);
 return '<section class="perf-overview"><div class="panelhead"><h2>My performance</h2><span class="tag">Personal records</span></div><p class="hint">Every range has its own scoring history. Longer combines are never graded against shorter ones.</p><div class="cards">'+statCard('Shots logged',rows.length,'All completed practice')+statCard('Classic combines',classic.length,'All distance ranges')+statCard('Ladder sessions',all.length-classic.length,'Training only')+statCard('Classic avg miss',classicShots.length?fmt(stats(classicShots).avg)+' yd':'—','Mixed yardages; descriptive only')+'</div><div class="perf-grid">'+cards+'</div></section>';
}
function comparisonPlot(shots,extent,club){
 const W=300,H=270,cx=150,cy=135,scale=105/extent;
 const coord=s=>{let o=offsets(s);return [cx+o.x*scale,cy-o.y*scale]};
 let a=stats(shots),ring=extent/2;
 const dots=shots.map(s=>{let [x,y]=coord(s);return '<circle cx="'+x+'" cy="'+y+'" r="3.3" fill="#3189B6" fill-opacity=".7" stroke="#fff" stroke-width=".7"><title>'+s.target+' yd · '+fmt(radial(s))+' yd miss</title></circle>'}).join('');
 const radius=a.n?a.p80*scale:0;
 return '<svg class="perf-chart" viewBox="0 0 300 270" role="img" aria-label="'+esc(club)+' landing dispersion, same scale as other club"><rect x="10" y="10" width="280" height="250" rx="13" fill="#F6FBFF"/><circle cx="150" cy="135" r="105" fill="none" stroke="#c7dce9" stroke-dasharray="4 4"/><circle cx="150" cy="135" r="52.5" fill="none" stroke="#c7dce9" stroke-dasharray="4 4"/><path d="M45 135H255 M150 30V240" stroke="#a6cade"/>'+ (a.n?'<circle cx="150" cy="135" r="'+radius+'" fill="#3189B6" fill-opacity=".1" stroke="#3189B6" stroke-dasharray="3 3"/><path d="M'+(cx+a.meanX*scale-5)+' '+(cy-a.meanY*scale)+'h10 m-5 -5v10" stroke="#163F60" stroke-width="2"/>':'')+dots+'<circle cx="150" cy="135" r="5" fill="#F5C454" stroke="#163F60" stroke-width="1.5"/><text x="150" y="23" text-anchor="middle" font-size="10" fill="#53758A">LONG</text><text x="150" y="254" text-anchor="middle" font-size="10" fill="#53758A">SHORT</text><text x="18" y="129" font-size="9" fill="#53758A">L</text><text x="274" y="129" font-size="9" fill="#53758A">R</text><text x="279" y="247" text-anchor="end" font-size="9" fill="#53758A">±'+extent+' yd</text></svg>';
}
function clubComparison(){
 const rows=data.sessions.filter(s=>s.preset!=='ladder').flatMap(s=>s.shots).filter(s=>s.club&&s.club!=='Unspecified');
 const bins=[...new Set(rows.map(s=>Math.floor(s.target/10)*10))].sort((a,b)=>a-b);
 const bin=Number.isFinite(ui.compareBin)&&bins.includes(ui.compareBin)?ui.compareBin:(bins.find(b=>b===60)??bins[0]??60);
 const inBin=rows.filter(s=>Math.floor(s.target/10)*10===bin);
 const clubs=[...new Set([...practiceClubs(),...rows.map(s=>s.club)])];
 const ranked=clubs.slice().sort((a,b)=>inBin.filter(s=>s.club===b).length-inBin.filter(s=>s.club===a).length);
 const a=clubs.includes(ui.compareA)?ui.compareA:ranked[0],b=clubs.includes(ui.compareB)?ui.compareB:(ranked.find(x=>x!==a)||ranked[0]);
 const sa=inBin.filter(s=>s.club===a),sb=inBin.filter(s=>s.club===b);
 const extent=Math.max(5,Math.ceil(Math.max(0,...[...sa,...sb].map(radial))/5)*5);
 const select=(id,value)=>'<select id="'+id+'">'+clubs.map(c=>'<option value="'+esc(c)+'" '+(c===value?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>';
 const panel=(club,shots)=>{const q=stats(shots);return '<div class="perf-compare-card"><h3>'+esc(club||'Choose club')+'</h3>'+comparisonPlot(shots,extent,club||'Club')+'<div class="perf-number">'+(q.n?fmt(q.avg)+' yd':'—')+'</div><div class="hint">'+q.n+' shots · mean miss'+(q.n?' · 80% inside '+fmt(q.p80)+' yd':'')+'</div><div class="hint">'+(q.n?'Carry bias: '+direction(q.meanY,'short','long'):'No matching shots yet')+'</div></div>';};
 return '<section class="panel perf-comparison"><div class="panelhead"><h2>Club comparison</h2><span class="tag">Same target bucket</span></div><p class="hint">Compare your actual classic-combine shots at the same distance. The plots share a scale; dashed blue rings enclose at least 80% of misses from target. Different conditions and club-selection bias may affect results.</p><div class="perf-controls"><div class="field"><label>Target yardage</label><select id="compare-bin">'+(bins.length?bins:[bin]).map(k=>'<option value="'+k+'" '+(bin===k?'selected':'')+'>'+k+'–'+(k+9)+' yd</option>').join('')+'</select></div><div class="field"><label>Club A</label>'+select('compare-a',a)+'</div><div class="field"><label>Club B</label>'+select('compare-b',b)+'</div></div><div class="perf-compare-grid">'+panel(a,sa)+panel(b,sb)+'</div><p class="footnote">'+(a===b?'Choose two different clubs.':Math.min(sa.length,sb.length)<10?'Small samples: collect at least 10 shots per club before comparing, ideally many more.':'Compare descriptively; this is not a controlled club test.')+'</p></section>';
}
function renderPracticeHome(){
 return '<div class="hero"><div><div class="eyebrow">WEDGE LAB · PRACTICE SMARTER</div><h1>Own your numbers.</h1><p>One target. One shot. A better scoring game.</p><div class="inline"><button class="btn primary" data-go="start">▶ Start practice</button>'+(data.draft?'<button class="btn ghost" data-action="resume">Resume session</button>':'')+'</div></div><div class="hero-mark"><b>✳</b></div></div><div class="columns"><section class="panel"><h2>Classic Combine</h2><p class="hint">20 random targets. Four standard distance ranges or your own custom range.</p><button class="btn dark" data-action="start-classic">Choose combine →</button></section><section class="panel"><h2>Wedge Ladder</h2><p class="hint">30 → 155 → 30 yd. Twenty shots, four planned shots per club.</p><button class="btn ghost" data-action="start-ladder">Play ladder →</button></section></div>';
}

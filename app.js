const LEGACY_STORAGE_KEY = "coach-echecs-dev-v1";
let USERNAME = (localStorage.getItem("coach-echecs-dev-account") || "gone_1950").trim().toLowerCase();
const storageKey = () => LEGACY_STORAGE_KEY + ":" + USERNAME;
let games = [];
let syncInFlight = false;
let gamesPageSize = 100;
let storageReady = Promise.resolve();
let chessDbPromise = null;
const $ = (id) => document.getElementById(id);
const avatarCache=new Map(),avatarPending=new Set();
let coachAudioContext=null;
const soundStorageKey="coach-echecs-piece-sound";
const soundProfiles={chess:{noise:.052,low:155,high:920,body:185,decay:.105},wood:{noise:.078,low:115,high:680,body:138,decay:.145},soft:{noise:.035,low:210,high:1120,body:245,decay:.075}};
function playPieceSound(move={},style){
 const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;
 if(!coachAudioContext)coachAudioContext=new AudioCtx();
 const ctx=coachAudioContext;if(ctx.state==="suspended")ctx.resume();
 const profile=soundProfiles[style||localStorage.getItem(soundStorageKey)||"chess"]||soundProfiles.chess;
 const capture=!!move?.captured,now=ctx.currentTime,duration=profile.decay*(capture?1.35:1);
 const length=Math.max(1,Math.floor(ctx.sampleRate*duration)),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++){const t=i/length;data[i]=(Math.random()*2-1)*Math.pow(1-t,capture?2.2:2.8);}
 const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),noiseGain=ctx.createGain();
 noise.buffer=buffer;filter.type="bandpass";filter.frequency.setValueAtTime(capture?profile.low*1.8:profile.high,now);filter.Q.value=capture?1.15:1.7;
 noiseGain.gain.setValueAtTime(.0001,now);noiseGain.gain.exponentialRampToValueAtTime(profile.noise*(capture?1.3:1),now+.003);noiseGain.gain.exponentialRampToValueAtTime(.0001,now+duration);
 noise.connect(filter);filter.connect(noiseGain);noiseGain.connect(ctx.destination);noise.start(now);noise.stop(now+duration);
 const body=ctx.createOscillator(),bodyGain=ctx.createGain(),bodyFilter=ctx.createBiquadFilter();
 body.type="sine";body.frequency.setValueAtTime(capture?profile.body*.72:profile.body,now);body.frequency.exponentialRampToValueAtTime(profile.body*.52,now+duration*.8);
 bodyFilter.type="lowpass";bodyFilter.frequency.value=profile.low*5;
 bodyGain.gain.setValueAtTime(.0001,now);bodyGain.gain.exponentialRampToValueAtTime(capture?.09:.055,now+.004);bodyGain.gain.exponentialRampToValueAtTime(.0001,now+duration);
 body.connect(bodyFilter);bodyFilter.connect(bodyGain);bodyGain.connect(ctx.destination);body.start(now);body.stop(now+duration);
 if(capture){const tick=ctx.createOscillator(),tickGain=ctx.createGain();tick.type="triangle";tick.frequency.setValueAtTime(profile.high*.9,now);tick.frequency.exponentialRampToValueAtTime(profile.high*.45,now+.045);tickGain.gain.setValueAtTime(.0001,now);tickGain.gain.exponentialRampToValueAtTime(.035,now+.002);tickGain.gain.exponentialRampToValueAtTime(.0001,now+.05);tick.connect(tickGain);tickGain.connect(ctx.destination);tick.start(now);tick.stop(now+.052);}
}
window.CoachSound={
 getStyle(){return localStorage.getItem(soundStorageKey)||"chess";},
 setStyle(style){if(!soundProfiles[style])return;localStorage.setItem(soundStorageKey,style);document.querySelectorAll("[data-sound-style]").forEach(button=>button.classList.toggle("active",button.dataset.soundStyle===style));},
 play(move){try{playPieceSound(move);}catch(error){console.debug("Son du coup indisponible",error);}},
 preview(style){try{this.setStyle(style);playPieceSound({captured:false},style);}catch(error){console.debug("Aperçu sonore indisponible",error);}}
};

function readStoredGames(){
 try{
  const developmentData=localStorage.getItem(storageKey());
  if(developmentData){
   const parsed=JSON.parse(developmentData);
   if(Array.isArray(parsed)&&parsed.length)return parsed;
   // Un ancien écran pouvait créer un profil vide avant la migration.
   // Pour le compte historique, préférer une sauvegarde existante non vide.
   if(USERNAME!=="gone_1950")return Array.isArray(parsed)?parsed:[];
  }
  if(USERNAME==="gone_1950"){
   const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);
   if(legacy){const imported=JSON.parse(legacy);if(Array.isArray(imported)&&imported.length){localStorage.setItem(storageKey(),JSON.stringify(imported));return imported;}}
   const stableData=localStorage.getItem("coach-echecs-v1");
   if(stableData){const imported=JSON.parse(stableData);if(Array.isArray(imported)&&imported.length){localStorage.setItem(storageKey(),JSON.stringify(imported));return imported;}}
  }
  return [];
 }catch(error){console.warn("Lecture de l'historique local impossible",error);return []}
}
function openChessDB(){
 if(!("indexedDB" in window))return Promise.reject(new Error("IndexedDB indisponible"));
 if(chessDbPromise)return chessDbPromise;
 chessDbPromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open("coach-echecs-dev-library",1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains("games")){
    const store=db.createObjectStore("games",{keyPath:["username","id"]});
    store.createIndex("username","username",{unique:false});
   }
   if(!db.objectStoreNames.contains("sync"))db.createObjectStore("sync",{keyPath:"username"});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error("Ouverture du stockage impossible"));
 });
 return chessDbPromise;
}
async function loadIndexedGames(username){
 const db=await openChessDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("games","readonly"),request=tx.objectStore("games").index("username").getAll(username);
  request.onsuccess=()=>resolve((request.result||[]).map(({username:account,...game})=>game));
  request.onerror=()=>reject(request.error);
 });
}
async function persistGamesIndexed(username,list){
 const db=await openChessDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("games","readwrite"),store=tx.objectStore("games");
  for(const game of list){if(game?.id!==undefined&&game?.id!==null)store.put({...game,username,id:String(game.id)});}
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error("Enregistrement interrompu"));
 });
}
async function saveArchiveCheckpoint(username,list,meta){
 const db=await openChessDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(["games","sync"],"readwrite"),store=tx.objectStore("games");
  for(const game of list){if(game?.id!==undefined&&game?.id!==null)store.put({...game,username,id:String(game.id)});}
  tx.objectStore("sync").put({...meta,username});
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error("Sauvegarde interrompue"));
 });
}
async function readSyncMeta(username){
 try{const db=await openChessDB();return await new Promise((resolve,reject)=>{const r=db.transaction("sync","readonly").objectStore("sync").get(username);r.onsuccess=()=>resolve(r.result||{});r.onerror=()=>reject(r.error);});}
 catch{return {};}
}
function saveGames(){
 const snapshot=games.slice(),account=USERNAME;
 persistGamesIndexed(account,snapshot).catch(error=>console.warn("Sauvegarde IndexedDB impossible",error));
 try{if(snapshot.length<=500)localStorage.setItem(storageKey(),JSON.stringify(snapshot));else localStorage.removeItem(storageKey());}
 catch(e){console.warn("Historique trop volumineux pour localStorage ; IndexedDB prend le relais.",e);}
}
async function switchChessAccount(){
 const field=$("chess-account-input"),next=String(field?.value||"").trim().replace(/^@/,"").toLowerCase();
 if(!/^[a-z0-9_-]{2,30}$/.test(next)){setMessage("Saisis le pseudo Chess.com (identifiant du profil, pas le nom affiché).");return;}
 if(syncInFlight){setMessage("La synchronisation actuelle doit se terminer avant de changer de compte.");return;}
 if(next===USERNAME){setMessage("Ce compte est déjà connecté : vérification de son historique…");await syncChessCom();return;}
 // Sauvegarder le compte quitté avant de changer la partition active.
 saveGames();
 USERNAME=next;localStorage.setItem("coach-echecs-dev-account",USERNAME);
 // Ne jamais réutiliser la promesse de chargement du compte précédent.
 games=[];
 storageReady=(async()=>{
  try{
   const indexed=await loadIndexedGames(next);
   if(indexed.length)return indexed.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  }catch(error){console.warn("Lecture IndexedDB du compte "+next+" impossible",error);}
  return readStoredGames();
 })();
 games=await storageReady;
 if(!games.length)games=[];
 const greeting=$("dashboard-greeting-name");if(greeting)greeting.textContent=USERNAME;
 const accountName=$("account-menu-name");if(accountName)accountName.textContent=USERNAME;
 const topAccountName=$("account-name");if(topAccountName)topAccountName.textContent=USERNAME;
 const input=$("chess-account-input");if(input)input.value=USERNAME;
 render();fetchPlayerRatings();window.dispatchEvent(new CustomEvent("coach:account-changed",{detail:{username:USERNAME}}));
 setMessage("Compte "+USERNAME+" sélectionné. "+games.length.toLocaleString("fr-FR")+" parties déjà présentes sur cet appareil. Vérification de l'historique Chess.com…");
 await syncChessCom();
}
function setMessage(message){$("sync-message").textContent=message}
function parsePgn(pgn){
  const chunks=pgn.replace(/\r/g,"").split(/(?=\[Event )/g).filter(x=>x.trim());
  return chunks.map((text,i)=>{
    const headers={}; for(const m of text.matchAll(/^\[([^ ]+)\s+"(.*)"\]$/gm)) headers[m[1]]=m[2];
    if(!headers.White&&!headers.Black)return null;
    return {id:headers.Link||headers.UUID||[headers.Date,headers.White,headers.Black,i].join("-"),date:headers.Date||"",white:headers.White||"?",black:headers.Black||"?",result:headers.Result||"*",timeControl:headers.TimeControl||"Non précisé",eco:headers.ECO||"",opening:headers.Opening||"",pgn:text,whiteElo:headers.WhiteElo||"",blackElo:headers.BlackElo||"",url:headers.Link||""};
  }).filter(Boolean);
}
function normalizeGame(g){
  const p=parsePgn(g.pgn||"")[0]||{};
  const ecoMatch=String(g.eco||"").match(/\b([A-E]\d{2})\b/i);
  const ecoCode=p.eco||(ecoMatch?ecoMatch[1].toUpperCase():"");
  return {...p,id:g.url||p.id||String(Math.random()),date:g.end_time?new Date(g.end_time*1000).toISOString().slice(0,10):p.date,white:g.white?.username||p.white,black:g.black?.username||p.black,result:g.white?.result==="win"?"1-0":g.black?.result==="win"?"0-1":(["agreed","repetition","stalemate","insufficient","50move","timevsinsufficient"].includes(g.white?.result)?"1/2-1/2":p.result),timeControl:g.time_control||p.timeControl,eco:ecoCode,opening:g.pgn?.match(/\[Opening "([^"]+)"/)?.[1]||p.opening,pgn:g.pgn||p.pgn,whiteElo:g.white?.rating||p.whiteElo,blackElo:g.black?.rating||p.blackElo,url:g.url||p.url};
}
function outcome(game){
  const me=USERNAME.toLowerCase(), white=(game.white||"").toLowerCase(), black=(game.black||"").toLowerCase();
  if(game.result==="1/2-1/2")return "draw";
  if((white===me&&game.result==="1-0")||(black===me&&game.result==="0-1"))return "win";
  if((white===me&&game.result==="0-1")||(black===me&&game.result==="1-0"))return "loss";
  return "unknown";
}
function userColor(g){return (g.white||"").toLowerCase()===USERNAME.toLowerCase()?"white":(g.black||"").toLowerCase()===USERNAME.toLowerCase()?"black":"unknown"}
function formatDate(d){if(!d)return "Date inconnue";const [y,m,day]=d.split(".").length===3?d.split("."):d.split("-");return day&&m&&y?new Date(Number(y),Number(m)-1,Number(day)).toLocaleDateString("fr-FR"):"Date inconnue"}
function resultLabel(o){return o==="win"?"Victoire":o==="loss"?"Défaite":o==="draw"?"Nulle":"Résultat inconnu"}
function opponent(g){return (g.white||"").toLowerCase()===USERNAME.toLowerCase()?g.black:g.white}
function openingName(g){const name=(g.opening||"").trim();if(name)return name;const eco=(g.eco||"").trim();return eco?"Code ECO "+eco:""}
function positionWinPercent(cp){const x=Math.max(-1000,Math.min(1000,Number(cp)||0));return 50+50*(2/(1+Math.exp(-0.00368208*x))-1)}
function gameAccuracy(g){
 const moves=(g.analysis?.moves||[]).filter(m=>m.kind!=="book"&&m.color);
 const accuracies=moves.map(m=>{
  let loss=m.winLossPercent===null||m.winLossPercent===undefined?NaN:Number(m.winLossPercent);
  if(!Number.isFinite(loss)){
   if(m.evalWhite===null||m.evalWhite===undefined||m.afterEvalWhite===null||m.afterEvalWhite===undefined)return null;
   const sign=m.color==="w"?1:-1;
   const before=positionWinPercent(Number(m.evalWhite)*sign);
   const after=positionWinPercent(Number(m.afterEvalWhite)*sign);
   loss=Math.max(0,before-after);
  }
  return Math.max(0,Math.min(100,103.1668*Math.exp(-0.04354*Math.max(0,loss))-3.1669));
 }).filter(value=>Number.isFinite(value));
 // Minimum six coups évalués : pas de pourcentage trompeur sur une analyse trop courte.
 if(accuracies.length<6)return null;
 return Math.round(accuracies.reduce((sum,value)=>sum+value,0)/accuracies.length);
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function avatarMarkup(player){const name=String(player||"Adversaire");return '<span class="player-avatar" data-player-avatar="'+escapeHtml(name)+'" aria-hidden="true">♟</span>';}
async function hydratePlayerAvatars(){
 const nodes=[...document.querySelectorAll("[data-player-avatar]")],names=[...new Set(nodes.map(n=>n.dataset.playerAvatar).filter(Boolean))];
 for(const name of names){
  if(avatarCache.has(name)){applyAvatar(name,avatarCache.get(name));continue;}
  if(avatarPending.has(name))continue;
  avatarPending.add(name);
  try{
   const response=await fetch("https://api.chess.com/pub/player/"+encodeURIComponent(name.toLowerCase()),{headers:{"Accept":"application/json"}});
   if(!response.ok)throw new Error("Profil indisponible");
   const profile=await response.json(),url=typeof profile.avatar==="string"&&/^https:\/\//i.test(profile.avatar)?profile.avatar:null;
   avatarCache.set(name,url);applyAvatar(name,url);
  }catch{avatarCache.set(name,null);}
  finally{avatarPending.delete(name);}
 }
}
function applyAvatar(name,url){
 if(!url)return;
 document.querySelectorAll("[data-player-avatar]").forEach(node=>{
  if(node.dataset.playerAvatar!==name||node.querySelector("img"))return;
  const img=document.createElement("img");img.src=url;img.alt="";img.loading="lazy";img.onerror=()=>img.remove();
  node.textContent="";node.appendChild(img);
 });
}
function groupOpenings(source){const groups=new Map();source.forEach(g=>{const name=openingName(g);if(!name)return;const key=name; if(!groups.has(key))groups.set(key,{name,games:[],wins:0,draws:0,losses:0,white:0,black:0});const x=groups.get(key);x.games.push(g);const o=outcome(g);if(o==="win")x.wins++;if(o==="draw")x.draws++;if(o==="loss")x.losses++;if(userColor(g)==="white")x.white++;if(userColor(g)==="black")x.black++});return [...groups.values()].map(x=>({...x,count:x.games.length,score:(x.wins+x.draws/2)/(x.wins+x.draws+x.losses||1)*100})).sort((a,b)=>b.count-a.count)}
function render(){
  const wins=games.filter(g=>outcome(g)==="win").length, draws=games.filter(g=>outcome(g)==="draw").length, losses=games.filter(g=>outcome(g)==="loss").length;
  $("stat-games").textContent=games.length;$("stat-wins").textContent=wins;$("stat-losses").textContent=losses;
  const dashValues={"dash-total-games":games.length,"dash-wins":wins,"dash-losses":losses,"dash-win-rate":games.length?Math.round(wins/games.length*100)+" %":"—"};Object.entries(dashValues).forEach(([id,value])=>{const node=$(id);if(node)node.textContent=String(value);});
  const visibleStats={"games-total-visible":games.length,"games-wins-visible":wins,"games-losses-visible":losses,"games-draws-visible":draws};Object.entries(visibleStats).forEach(([id,value])=>{const node=$(id);if(node)node.textContent=String(value);});
  const greeting=$("dashboard-greeting-name");if(greeting)greeting.textContent=USERNAME;
  $("sync-state").textContent="Version développement · v40";
  const sorted=[...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("recent-games").innerHTML=sorted.length?sorted.slice(0,4).map(recentGameHtml).join(""):'<div class="empty-state">Tes parties apparaîtront ici après l’import.</div>';
  renderGames(sorted);renderBars(wins,draws,losses);renderOpenings();renderTraining();renderProgressStats(wins,draws,losses);hydratePlayerAvatars();
}
function gameHtml(g,index=0){
 const o=outcome(g),accuracy=gameAccuracy(g);
 const hasCompleteAnalysis=!!(g.analysis&&!g.analysis.partial&&Array.isArray(g.analysis.moves));
 const accuracyText=hasCompleteAnalysis?(accuracy!==null&&accuracy!==undefined&&Number.isFinite(Number(accuracy))?Math.round(accuracy)+" %":"—"):(g.analysis?.partial?"En cours…":(g.pgn?(index<5?"En attente…":""):"—"));
 const calculateButton=g.pgn&&index>=5&&!hasCompleteAnalysis?'<button type="button" class="accuracy-calculate-button" data-calculate-accuracy="'+escapeHtml(g.id)+'" '+(g.analysis?.partial&&!g.analysis?.paused?'disabled':'')+'>'+(g.analysis?.partial&&!g.analysis?.paused?'En cours…':'Calculer')+'</button>':'';

 const side=userColor(g),opponentElo=side==="white"?g.blackElo:side==="black"?g.whiteElo:"";
 const elo=value=>value&&Number(value)>0?Number(value).toLocaleString("fr-FR"):"—";
 return '<div class="game-row game-row-expanded"><div class="game-row-info"><div class="player-line">'+avatarMarkup(opponent(g))+'<div class="game-opponent">'+escapeHtml(opponent(g)||"Adversaire")+'</div><span class="game-opponent-elo">'+elo(opponentElo)+'</span></div><div class="game-meta">'+formatDate(g.date)+'</div></div><div class="game-list-accuracy"><span>MA PRÉCISION</span><strong>'+accuracyText+'</strong>'+calculateButton+'</div><span class="game-result '+o+'">'+resultLabel(o)+'</span><button type="button" class="analysis-icon-button" data-open-game="'+escapeHtml(g.id)+'" aria-label="Revoir et analyser cette partie" title="Revoir et analyser cette partie"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7"/></svg></button></div>';
}
function recentGameHtml(g){
 const result=outcome(g);
 const icon=result==="win"?'<span class="recent-result-icon win" role="img" aria-label="Victoire" title="Victoire"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3.2 3.2L15.5 6"/></svg></span>':result==="draw"?'<span class="recent-result-icon draw" role="img" aria-label="Égalité" title="Égalité"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5h10M5 12.5h10"/></svg></span>':result==="loss"?'<span class="recent-result-icon loss" role="img" aria-label="Défaite" title="Défaite"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8"/></svg></span>':'<span class="recent-result-icon unknown" role="img" aria-label="Résultat inconnu" title="Résultat inconnu">·</span>';
 return '<div class="recent-game-row"><div class="recent-game-main"><div class="recent-game-player"><div class="player-line">'+avatarMarkup(opponent(g))+'<div class="recent-game-opponent">'+escapeHtml(opponent(g)||"Adversaire")+'</div></div>'+icon+'</div></div><button type="button" class="recent-review-button" data-open-game="'+escapeHtml(g.id)+'" aria-label="Revoir la partie contre '+escapeHtml(opponent(g)||"Adversaire")+'" title="Revoir cette partie"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7"/></svg></button></div>';
}
function renderGames(sorted){
 const q=($("game-search").value||"").toLowerCase(),f=$("result-filter").value;
 const filtered=sorted.filter(g=>(opponent(g)||"").toLowerCase().includes(q)&&(f==="all"||outcome(g)===f));
 const visible=filtered.slice(0,gamesPageSize);
 $("games-list").innerHTML=filtered.length?visible.map(g=>gameHtml(g,sorted.indexOf(g))).join(""):'<div class="empty-state">Aucune partie ne correspond à ce filtre.</div>';
 if(filtered.length>visible.length)$("games-list").insertAdjacentHTML("beforeend",'<button type="button" class="secondary-button games-load-more" data-games-more="1">Afficher les '+Math.min(100,filtered.length-visible.length)+' suivantes · '+visible.length.toLocaleString("fr-FR")+'/'+filtered.length.toLocaleString("fr-FR")+'</button>');
}
function renderBars(w,d,l){const n=games.length;if(!n){$("result-bars").innerHTML='<p class="muted">Les statistiques apparaîtront après l’import.</p>';return}const known=w+d+l,rows=[["Victoires",w],["Nulles",d],["Défaites",l]];if(known<n)rows.push(["Non classées",n-known]);const total='<div class="results-total"><span>♟ TOTAL DES PARTIES</span><strong>'+n+'</strong></div>';const items=rows.map(([label,v])=>{const pct=v/n*100;return '<div class="bar-item"><span>'+label+'</span><div class="bar-track"><div class="bar-fill" style="width:'+pct+'%"></div></div><strong>'+pct.toLocaleString("fr-FR",{maximumFractionDigits:1})+' %</strong></div>';}).join("");$("result-bars").innerHTML=total+items;}
function renderOpenings(){/* Le répertoire est géré par openings.js, chargé uniquement à l'ouverture de l'onglet. */}

function renderProgressStats(wins,draws,losses){const total=games.length,rate=$("progress-win-rate");if(rate)rate.textContent=total?Math.round(wins/total*100)+" %":"—";const detail=$("progress-win-rate-detail");if(detail)detail.textContent=wins+" victoire(s) sur "+total+" partie(s) importée(s)";const victories=games.filter(g=>outcome(g)==="win").map(g=>{const side=userColor(g),elo=Number(side==="white"?g.blackElo:g.whiteElo);return {elo,opponent:opponent(g)};}).filter(x=>Number.isFinite(x.elo)&&x.elo>0).sort((a,b)=>b.elo-a.elo);const best=$("progress-best-win-elo"),name=$("progress-best-win-opponent");if(best)best.textContent=victories.length?victories[0].elo:"—";if(name)name.textContent=victories.length?victories[0].opponent:"—";}

function renderTraining(){
  const losses=games.filter(g=>outcome(g)==="loss").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const analyzed=games.filter(g=>!g.analysis?.partial&&Array.isArray(g.analysis?.moves)&&gameAccuracy(g)!==null).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const accuracyForGroup=group=>{
    const values=group.map(gameAccuracy).filter(v=>typeof v==="number"&&Number.isFinite(v));
    return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
  };
  const recentCount=Math.min(10,Math.ceil(analyzed.length/2));
  const recent=analyzed.slice(0,recentCount),previous=analyzed.slice(recentCount,recentCount*2);
  const recentAccuracy=recent.length?accuracyForGroup(recent):null;
  const previousAccuracy=previous.length?accuracyForGroup(previous):null;
  const lossNode=$("training-losses");if(lossNode)lossNode.textContent=losses.length;
  const accuracyNode=$("training-accuracy");if(accuracyNode)accuracyNode.textContent=recentAccuracy===null?"—":Math.round(recentAccuracy)+" %";
  const deltaNode=$("training-accuracy-delta"),countNode=$("training-accuracy-count");
  if(deltaNode){
    if(recentAccuracy!==null&&previousAccuracy!==null){
      const delta=Math.round(recentAccuracy-previousAccuracy);
      deltaNode.textContent=(delta>0?"+":"")+delta+" %";
      deltaNode.className=delta>0?"trend-up":delta<0?"trend-down":"trend-neutral";
    }else{deltaNode.textContent="—";deltaNode.className="trend-neutral";}
  }
  if(countNode){
    if(recentAccuracy===null)countNode.textContent="Analyse au moins une partie pour afficher ta précision.";
    else if(previousAccuracy===null)countNode.textContent="Moyenne sur "+recent.length+" partie(s) analysée(s) · une comparaison apparaîtra avec une deuxième partie.";
    else countNode.textContent="Moyenne des "+recent.length+" dernières parties comparée aux "+previous.length+" précédentes.";
  }
  const analyzedMoves=analyzed.flatMap(game=>(game.analysis?.moves||[]).filter(move=>["blunder","mistake","inaccuracy","miss"].includes(move.kind)));
  const priorities=[["blunder","Gaffes","Réduire les grosses pertes de matériel et les menaces adverses."],["mistake","Erreurs","Prendre le temps de vérifier les menaces et les pièces non protégées."],["inaccuracy","Imprécisions","Comparer les coups candidats avant de jouer."],["miss","Occasions manquées","Repérer les tactiques et les coups forcing disponibles."]];
  const focus=priorities.map(([kind,label,advice])=>({kind,label,advice,count:analyzedMoves.filter(move=>move.kind===kind).length})).sort((a,b)=>b.count-a.count)[0];
  const coachSummary=$("coach-plan-summary"),coachBadge=$("coach-plan-badge"),coachContent=$("coach-plan-content");
  if(coachContent){
    if(!analyzed.length){if(coachSummary)coachSummary.textContent="Une analyse de partie est nécessaire pour établir ton profil.";if(coachBadge)coachBadge.textContent="À construire";coachContent.innerHTML='<p class="empty-state compact">Lance une analyse Stockfish depuis Mes parties. Ton coach identifiera ensuite tes erreurs les plus fréquentes et proposera un entraînement ciblé.</p>';}
    else if(!analyzedMoves.length){if(coachSummary)coachSummary.textContent="Les parties analysées ne révèlent pas encore de tendance exploitable.";if(coachBadge)coachBadge.textContent=analyzed.length+" analysée(s)";coachContent.innerHTML='<p class="muted">Continue à analyser tes parties pour affiner ton profil de jeu.</p>';}
    else{if(coachSummary)coachSummary.textContent="Basé sur "+analyzed.length+" partie(s) analysée(s) et "+analyzedMoves.length+" erreur(s) ou occasion(s) manquée(s).";if(coachBadge)coachBadge.textContent="Priorité détectée";coachContent.innerHTML='<div class="coach-focus-card"><span class="coach-focus-icon">♞</span><div><strong>Priorité : '+focus.label.toLowerCase()+'</strong><p>'+focus.advice+'</p><small>'+focus.count+' occurrence(s) dans les parties analysées</small></div></div><div class="coach-plan-actions"><button type="button" class="primary-button" data-goto="puzzles">Travailler avec les puzzles</button><button type="button" class="secondary-button" data-goto="games">Revoir mes parties</button></div>';coachContent.querySelectorAll("[data-goto]").forEach(button=>button.addEventListener("click",()=>document.querySelector('[data-tab="'+button.dataset.goto+'"]')?.click()));}
  }
  $("training-games").innerHTML=losses.length?losses.slice(0,5).map(g=>'<div class="game-row training-game-row"><div><div class="game-opponent">Défaite contre '+escapeHtml(opponent(g)||"Adversaire")+'</div><div class="game-meta">'+formatDate(g.date)+'</div></div><button type="button" class="analysis-icon-button" data-open-game="'+escapeHtml(g.id)+'" aria-label="Analyser cette partie" title="Analyser cette partie"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7"/></svg></button></div>').join(""):'<div class="empty-state">Aucune défaite enregistrée dans les parties importées.</div>';
}
async function fetchPlayerRatings(){
 const accountAtStart=USERNAME;
 const blitzNodes=[$("rating-blitz"),$("dashboard-rating-blitz")].filter(Boolean),rapidNodes=[$("rating-rapid"),$("dashboard-rating-rapid")].filter(Boolean);
 if(!blitzNodes.length&&!rapidNodes.length)return;
 [...blitzNodes,...rapidNodes].forEach(node=>node.textContent="…");
 try{const response=await fetch("https://api.chess.com/pub/player/"+encodeURIComponent(accountAtStart)+"/stats",{headers:{"Accept":"application/json"},cache:"no-store"});if(!response.ok)throw new Error("Profil indisponible");const stats=await response.json();if(USERNAME!==accountAtStart)return;const b=stats.chess_blitz?.last?.rating,r=stats.chess_rapid?.last?.rating;const bv=Number.isFinite(Number(b))?Number(b).toLocaleString("fr-FR"):"—",rv=Number.isFinite(Number(r))?Number(r).toLocaleString("fr-FR"):"—";blitzNodes.forEach(node=>node.textContent=bv);rapidNodes.forEach(node=>node.textContent=rv);}
 catch{if(USERNAME!==accountAtStart)return;[...blitzNodes,...rapidNodes].forEach(node=>node.textContent="—");}
}
async function syncChessCom(){
 if(syncInFlight)return;
 syncInFlight=true;
 const buttons=[$("sync-button"),$("sync-button-games")].filter(Boolean);
 const labelMap=new Map(buttons.map(b=>[b,b.textContent]));
 buttons.forEach(b=>{b.disabled=true;b.textContent="Synchronisation…"});
 const accountAtStart=USERNAME;
 try{
  await storageReady;
  if(USERNAME!==accountAtStart)throw new Error("Le compte actif a changé avant le début de la synchronisation.");
  setMessage("Connexion à l'archive Chess.com de "+accountAtStart+"…");
  const response=await fetch("https://api.chess.com/pub/player/"+encodeURIComponent(accountAtStart)+"/games/archives",{headers:{"Accept":"application/json"},cache:"no-store"});
  if(!response.ok)throw new Error("Chess.com a répondu "+response.status+" lors de la lecture des archives.");
  const archiveData=await response.json(),urls=Array.isArray(archiveData.archives)?archiveData.archives:[];
  if(!urls.length)throw new Error("Chess.com ne renvoie aucune archive pour le pseudo "+accountAtStart+". Vérifie l'identifiant exact du compte.");
  const metaKey=LEGACY_STORAGE_KEY+":sync-meta:"+accountAtStart;
  let syncMeta=await readSyncMeta(accountAtStart);
  if(!syncMeta||!Object.keys(syncMeta).length){
   try{syncMeta=JSON.parse(localStorage.getItem(metaKey)||"{}")||{};}catch{syncMeta={};}
  }
  // Seul un historique marqué par le nouveau protocole, avec le même nombre
  // d'archives ET le même nombre de parties réellement chargées, est fiable.
  // Les anciens marqueurs fullHistory (qui pouvaient valider seulement 10 parties)
  // ne sont volontairement plus considérés comme une preuve d'historique complet.
  const trustedFullHistory=syncMeta.historyVersion===2&&syncMeta.fullHistory===true&&
   Number(syncMeta.verifiedArchiveCount)===urls.length&&
   Number(syncMeta.verifiedGameCount)===games.length&&games.length>0;
  const archivesToCheck=trustedFullHistory?urls.slice(-3):urls;
  const completed=new Set(trustedFullHistory?[]:[]);
  const byId=new Map(games.map(g=>[String(g.id),g]));
  let newCount=0,successfulArchives=0,failedArchives=0,verified=0,processedArchives=0;
  const pendingArchives=archivesToCheck.slice().reverse();
  const concurrency=2;
  for(let offset=0;offset<pendingArchives.length;offset+=concurrency){
   if(USERNAME!==accountAtStart)throw new Error("Le compte actif a changé pendant la synchronisation.");
   const group=pendingArchives.slice(offset,offset+concurrency);
   setMessage("Historique "+accountAtStart+" · "+(offset+1)+"/"+pendingArchives.length+" archives lancées · "+byId.size.toLocaleString("fr-FR")+" parties enregistrées…");
   const results=await Promise.all(group.map(async url=>{
    try{
     const res=await fetch(url,{headers:{"Accept":"application/json"},cache:"no-store"});
     if(!res.ok)throw new Error("HTTP "+res.status);
     const data=await res.json();
     if(!Array.isArray(data.games))throw new Error("Réponse Chess.com sans liste de parties");
     return {url,batch:data.games.map(normalizeGame),error:null};
    }catch(error){return {url,batch:[],error};}
   }));
   for(const result of results){
    if(USERNAME!==accountAtStart)throw new Error("Le compte actif a changé pendant la synchronisation.");
    const {url,batch,error}=result;
    if(error){failedArchives++;console.error("Archive Chess.com non récupérée",accountAtStart,url,error);continue;}
    successfulArchives++;processedArchives++;verified+=batch.length;
    for(const game of batch){
     const key=String(game.id),previous=byId.get(key);
     if(!previous)newCount++;
     const merged={...(previous||{}),...game};
     if(previous?.analysis)merged.analysis=previous.analysis;
     byId.set(key,merged);
    }
    const mergedGames=[...byId.values()].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    const persistedBatch=batch.map(game=>byId.get(String(game.id)));
    const nextMeta={
     historyVersion:2,fullHistory:false,completedArchives:[],lastArchive:url,
     gameCount:mergedGames.length,lastSync:Date.now(),syncMode:"full-scan",
     verifiedArchiveCount:0,verifiedGameCount:0
    };
    await saveArchiveCheckpoint(accountAtStart,persistedBatch,nextMeta);
    games=mergedGames;
    // Ne pas reconstruire tous les écrans à chaque archive : l'import reste en
    // arrière-plan et ne monopolise pas le thread principal pendant la navigation.
    setMessage("Historique "+accountAtStart+" · "+processedArchives+" / "+urls.length+" archives validées · "+games.length.toLocaleString("fr-FR")+" parties sauvegardées.");
   }
  }
  if(!successfulArchives)throw new Error("Aucune archive n'a pu être téléchargée ("+failedArchives+" échec(s)). Vérifie la connexion et réessaie.");
  if(failedArchives>0){
   await saveArchiveCheckpoint(accountAtStart,[],{historyVersion:2,fullHistory:false,completedArchives:[],gameCount:games.length,lastSync:Date.now(),syncMode:"incomplete",verifiedArchiveCount:0,verifiedGameCount:0});
   throw new Error(failedArchives+" archive(s) sur "+urls.length+" n'ont pas pu être récupérées. L'historique reste incomplet : relance la synchronisation pour réessayer.");
  }
  if(USERNAME!==accountAtStart)throw new Error("Le compte actif a changé avant la finalisation.");
  if(!trustedFullHistory){
   const finalMeta={username:accountAtStart,historyVersion:2,fullHistory:true,completedArchives:[],gameCount:games.length,lastSync:Date.now(),syncMode:"complete",verifiedArchiveCount:urls.length,verifiedGameCount:games.length};
   const db=await openChessDB();
   await new Promise((resolve,reject)=>{const tx=db.transaction("sync","readwrite");tx.objectStore("sync").put(finalMeta);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error("Validation de l'historique interrompue"));});
   try{localStorage.setItem(metaKey,JSON.stringify(finalMeta));}catch{}
  }else{
   await saveArchiveCheckpoint(accountAtStart,[],{...syncMeta,historyVersion:2,fullHistory:true,gameCount:games.length,lastSync:Date.now(),verifiedArchiveCount:urls.length,verifiedGameCount:games.length,completedArchives:[]});
  }
  // Une seule mise à jour visuelle après l'import complet, jamais une par archive.
  if(USERNAME===accountAtStart)render();
  window.dispatchEvent(new CustomEvent("coach:games-updated",{detail:{username:accountAtStart,count:games.length}}));
  await fetchPlayerRatings();
  setMessage((trustedFullHistory?"Vérification des archives récentes terminée":"Import complet terminé")+" · "+games.length.toLocaleString("fr-FR")+" parties enregistrées pour "+accountAtStart+" · "+urls.length+" archives vérifiées · "+newCount.toLocaleString("fr-FR")+" nouvelle(s).");
  const state=$("sync-state");if(state)state.textContent="Compte connecté · "+accountAtStart;
 }catch(e){
  setMessage("Synchronisation incomplète : "+e.message+" Les parties déjà sauvegardées sont conservées.");
  console.error("Chess.com sync failed for "+accountAtStart,e);
 }finally{
  buttons.forEach(b=>{b.disabled=false;b.textContent=labelMap.get(b)||"Synchroniser mes parties";});
  syncInFlight=false;
 }
}
function importPgnFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{const added=parsePgn(String(reader.result||""));if(!added.length){setMessage("Je n'ai pas reconnu de parties dans ce fichier PGN.");return}const byId=new Map(games.map(g=>[String(g.id),g]));added.forEach(g=>{const previous=byId.get(String(g.id));const sameGame=previous&&previous.pgn&&g.pgn&&previous.pgn===g.pgn;byId.set(String(g.id),{...(sameGame?previous:{}),...g,...(sameGame&&previous.analysis&&!g.analysis?{analysis:previous.analysis}:{})});});games=[...byId.values()];saveGames();render();setMessage(added.length+" partie(s) importée(s) depuis le fichier PGN.")};reader.onerror=()=>setMessage("Impossible de lire ce fichier.");reader.readAsText(file)}
let openingsModuleLoaded=false;
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
 if(btn.hasAttribute("data-opening-back"))return;
 window.dispatchEvent(new CustomEvent("coach:tab-changing",{detail:{tab:btn.dataset.tab,fromPanel:document.querySelector(".panel.active")?.id||""}}));
 // Nettoyage explicite des états propres aux écrans d'ouverture avant tout changement de page.
 document.querySelectorAll(".opening-study-overlay").forEach(overlay=>overlay.remove());
 $("panel-openings")?.classList.remove("opening-exercise-active");
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===btn));
 const mainTabs=document.querySelector(".tabs");if(mainTabs)mainTabs.classList.toggle("tabs-internal",btn.dataset.tab!=="dashboard");
 document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id==="panel-"+btn.dataset.tab));
 if(btn.dataset.tab==="openings"&&!openingsModuleLoaded){openingsModuleLoaded=true;import("./openings.js").catch(error=>{openingsModuleLoaded=false;console.error(error);$("opening-table").innerHTML='<div class="empty-state">Impossible de charger le module des ouvertures. Réessaie en ouvrant cet onglet.</div>';});}
}));
document.querySelectorAll("[data-goto]").forEach(btn=>btn.addEventListener("click",()=>document.querySelector('[data-tab="'+btn.dataset.goto+'"]')?.click()));
 document.querySelectorAll("[data-sound-style]").forEach(button=>button.addEventListener("click",()=>window.CoachSound?.preview(button.dataset.soundStyle)));window.CoachSound?.setStyle(window.CoachSound.getStyle());
$("sync-button").addEventListener("click",syncChessCom);$("sync-button-games").addEventListener("click",syncChessCom);
$("change-chess-account")?.addEventListener("click",switchChessAccount);
$("chess-account-input")?.addEventListener("keydown",event=>{if(event.key==="Enter")switchChessAccount();});$("pgn-file").addEventListener("change",e=>importPgnFile(e.target.files[0]));$("game-search").addEventListener("input",()=>{gamesPageSize=100;renderGames([...games].sort((a,b)=>(b.date||"").localeCompare(a.date||"")));});$("result-filter").addEventListener("change",()=>{gamesPageSize=100;renderGames([...games].sort((a,b)=>(b.date||"").localeCompare(a.date||"")));});
document.addEventListener("click",e=>{if(e.target.closest("[data-games-more]")){gamesPageSize+=100;renderGames([...games].sort((a,b)=>(b.date||"").localeCompare(a.date||"")));return;}const calculate=e.target.closest("[data-calculate-accuracy]");if(calculate){e.preventDefault();if(calculate.disabled)return;calculate.disabled=true;calculate.textContent="En cours…";window.CoachAnalysis?.analyzeAccuracy?.(calculate.dataset.calculateAccuracy).catch(error=>{console.warn("Calcul de précision impossible",error);calculate.disabled=false;calculate.textContent="Réessayer";});return;}const b=e.target.closest("[data-open-game]");if(!b)return;e.preventDefault();if(window.CoachAnalysis?.openGame){window.CoachAnalysis.openGame(b.dataset.openGame);return;}window.dispatchEvent(new CustomEvent("coach:analyze-game",{detail:{gameId:b.dataset.openGame}}));});
document.addEventListener("click",e=>{if(e.target.closest("[data-games-back]")){$("panel-games")?.classList.remove("reviewing-game");$("game-replay-area").innerHTML="";$("analysis-results").innerHTML="";}});
const accountInput=$("chess-account-input");if(accountInput)accountInput.value=USERNAME;const accountMenuName=$("account-menu-name");if(accountMenuName)accountMenuName.textContent=USERNAME;const topAccountName=$("account-name");if(topAccountName)topAccountName.textContent=USERNAME;
games=[];render();fetchPlayerRatings();
storageReady=(async()=>{
 try{
  const indexed=await loadIndexedGames(USERNAME);
  if(indexed.length){games=indexed.sort((a,b)=>(b.date||"").localeCompare(a.date||""));render();return true;}
 }catch(error){console.warn("Chargement IndexedDB indisponible ; mode de stockage historique utilisé.",error);}
 games=readStoredGames();render();
 if(games.length)persistGamesIndexed(USERNAME,games).catch(error=>console.warn("Migration de l'historique vers IndexedDB impossible",error));
 return true;
})();
storageReady=(async()=>{
 try{
  const indexed=await loadIndexedGames(USERNAME);
  if(indexed.length){
   const byId=new Map(indexed.map(g=>[String(g.id),g]));
   for(const game of games){const previous=byId.get(String(game.id));if(previous?.analysis&&!game.analysis)byId.set(String(game.id),{...game,analysis:previous.analysis});}
   games=[...byId.values()].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
   render();
  }else if(games.length){await persistGamesIndexed(USERNAME,games);}
 }catch(error){console.warn("Chargement IndexedDB indisponible ; mode de stockage historique utilisé.",error);}
 return true;
})();
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load",async()=>{
    try{
      const registration=await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});
      registration.update().catch(()=>{});
    }catch(error){console.warn("Mise à jour hors ligne indisponible",error);}
  });
  let refreshing=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(refreshing)return;
    refreshing=true;
    location.reload();
  });
}


// Interface publique minimale pour le module d'analyse moteur.
window.CoachApp = { getGames: () => games, getUsername: () => USERNAME, accountStorageKey: () => storageKey(), saveGames: () => saveGames(), refresh: () => render() };
const renderBeforeAnalysis = render;
render = function(){ renderBeforeAnalysis(); window.dispatchEvent(new Event("coach:games-updated")); };
render();
setTimeout(()=>storageReady.then(()=>syncChessCom()),450);

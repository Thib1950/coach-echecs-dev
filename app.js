const USERNAME = "gone_1950";
const STORAGE_KEY = "coach-echecs-dev-v1";
let games = [];
const $ = (id) => document.getElementById(id);
const avatarCache=new Map(),avatarPending=new Set();

function readStoredGames(){
 try{
  const developmentData=localStorage.getItem(STORAGE_KEY);
  if(developmentData)return JSON.parse(developmentData);
  // Première ouverture de la version dev : copie les parties de la version stable
  // sans jamais modifier ni supprimer la clé utilisée par l'application stable.
  const stableData=localStorage.getItem("coach-echecs-v1");
  if(stableData){
   const imported=JSON.parse(stableData);
   if(Array.isArray(imported)){localStorage.setItem(STORAGE_KEY,JSON.stringify(imported));return imported;}
  }
  return [];
 }catch{return []}
}
function saveGames(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(games))}catch(e){setMessage("Le stockage du navigateur est plein. Exporte tes parties en PGN pour les conserver.")}}
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
  const greeting=$("dashboard-greeting-name");if(greeting)greeting.textContent=USERNAME;
  $("sync-state").textContent="Version développement · v40";
  const sorted=[...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("recent-games").innerHTML=sorted.length?sorted.slice(0,4).map(recentGameHtml).join(""):'<div class="empty-state">Tes parties apparaîtront ici après l’import.</div>';
  renderGames(sorted);renderBars(wins,draws,losses);renderOpenings();renderTraining();renderProgressStats(wins,draws,losses);hydratePlayerAvatars();
}
function gameHtml(g){
 const o=outcome(g),accuracy=gameAccuracy(g);
 const accuracyText=!g.analysis?.partial?(accuracy!==null&&accuracy!==undefined&&Number.isFinite(Number(accuracy))?Math.round(accuracy)+" %":"—"):(g.pgn?"En cours…":"—");
 const side=userColor(g),opponentElo=side==="white"?g.blackElo:side==="black"?g.whiteElo:"";
 return '<div class="game-row game-row-expanded"><div class="game-row-info"><div class="player-line">'+avatarMarkup(opponent(g))+'<div class="game-opponent">'+escapeHtml(opponent(g)||"Adversaire")+'</div></div><div class="game-meta">'+formatDate(g.date)+'</div></div><div class="game-list-accuracy"><span>MA PRÉCISION</span><strong>'+accuracyText+'</strong></div><span class="game-result '+o+'">'+resultLabel(o)+'</span><button type="button" class="analysis-icon-button" data-open-game="'+escapeHtml(g.id)+'" aria-label="Revoir et analyser cette partie" title="Revoir et analyser cette partie"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7"/></svg></button></div>';
}
function recentGameHtml(g){
 const side=userColor(g),opponentElo=side==="white"?g.blackElo:side==="black"?g.whiteElo:"";
 const accuracy=gameAccuracy(g);
 const accuracyText=!g.analysis?.partial?(accuracy!==null&&accuracy!==undefined&&Number.isFinite(Number(accuracy))?Math.round(accuracy)+" %":"—"):(g.pgn?"En cours…":"—");
 const result=outcome(g);return '<div class="recent-game-row"><div class="recent-game-main"><div class="recent-game-player"><div class="player-line">'+avatarMarkup(opponent(g))+'<div class="recent-game-opponent">'+escapeHtml(opponent(g)||"Adversaire")+'</div></div><span class="recent-game-result '+result+'">'+resultLabel(result)+'</span><div class="recent-game-elo">'+(opponentElo?escapeHtml(opponentElo):"—")+'<small>ELO</small></div></div><div class="recent-game-meta">'+formatDate(g.date)+'</div></div><div class="recent-game-precision"><span>MA PRÉCISION</span><strong>'+accuracyText+'</strong></div><button type="button" class="recent-review-button" data-open-game="'+escapeHtml(g.id)+'" aria-label="Revoir cette partie">↗</button></div>';
}
function renderGames(sorted){const q=($("game-search").value||"").toLowerCase(),f=$("result-filter").value;const filtered=sorted.filter(g=>(opponent(g)||"").toLowerCase().includes(q)&&(f==="all"||outcome(g)===f));$("games-list").innerHTML=filtered.length?filtered.map(gameHtml).join(""):'<div class="empty-state">Aucune partie ne correspond à ce filtre.</div>'}
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
  $("training-games").innerHTML=losses.length?losses.slice(0,5).map(g=>'<div class="game-row training-game-row"><div><div class="game-opponent">Défaite contre '+escapeHtml(opponent(g)||"Adversaire")+'</div><div class="game-meta">'+formatDate(g.date)+'</div></div><button type="button" class="analysis-icon-button" data-open-game="'+escapeHtml(g.id)+'" aria-label="Analyser cette partie" title="Analyser cette partie"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7"/></svg></button></div>').join(""):'<div class="empty-state">Aucune défaite enregistrée dans les parties importées.</div>';
}
async function fetchPlayerRatings(){
 const blitz=$("rating-blitz"),rapid=$("rating-rapid");if(!blitz||!rapid)return;
 blitz.textContent="…";rapid.textContent="…";
 try{const response=await fetch("https://api.chess.com/pub/player/"+USERNAME+"/stats",{headers:{"Accept":"application/json"}});if(!response.ok)throw new Error("Profil indisponible");const stats=await response.json();const b=stats.chess_blitz?.last?.rating,r=stats.chess_rapid?.last?.rating;blitz.textContent=Number.isFinite(Number(b))?Number(b).toLocaleString("fr-FR"):"—";rapid.textContent=Number.isFinite(Number(r))?Number(r).toLocaleString("fr-FR"):"—";}
 catch{blitz.textContent="—";rapid.textContent="—";}
}
async function syncChessCom(){
  const buttons=[$("sync-button"),$("sync-button-games")];buttons.forEach(b=>{b.disabled=true;b.textContent="Synchronisation…"});
  setMessage("Connexion à l'archive publique Chess.com…");
  try{
    const response=await fetch("https://api.chess.com/pub/player/"+USERNAME+"/games/archives",{headers:{"Accept":"application/json"}});
    if(!response.ok)throw new Error("Chess.com a répondu "+response.status);
    const archiveData=await response.json(), urls=(archiveData.archives||[]).slice(-3).reverse();
    if(!urls.length)throw new Error("Aucune archive trouvée pour ce compte.");
    let imported=[];
    for(const url of urls){setMessage("Récupération de "+url.split("/").slice(-2).join("/")+"…");const res=await fetch(url,{headers:{"Accept":"application/json"}});if(!res.ok)continue;const data=await res.json();imported=imported.concat((data.games||[]).map(normalizeGame))}
    if(!imported.length)throw new Error("Aucune partie trouvée dans les trois dernières archives.");
    const byId=new Map(games.map(g=>[String(g.id),g]));imported.forEach(g=>{const previous=byId.get(String(g.id));const sameGame=previous&&previous.pgn&&g.pgn&&previous.pgn===g.pgn;byId.set(String(g.id),{...(sameGame?previous:{}),...g,...(sameGame&&previous.analysis&&!g.analysis?{analysis:previous.analysis}:{})});});games=[...byId.values()].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    saveGames();render();await fetchPlayerRatings();setMessage(imported.length+" parties récupérées ou actualisées. Les données sont conservées sur cet appareil.");$("sync-state").textContent="Version développement · v40";
  }catch(e){setMessage("La synchronisation automatique n'a pas abouti : "+e.message+". Tu peux importer un fichier PGN depuis Chess.com.")}
  finally{buttons.forEach(b=>{b.disabled=false;b.textContent=b.id==="sync-button"?"Synchroniser les parties":"Synchroniser"})}
}
function importPgnFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{const added=parsePgn(String(reader.result||""));if(!added.length){setMessage("Je n'ai pas reconnu de parties dans ce fichier PGN.");return}const byId=new Map(games.map(g=>[String(g.id),g]));added.forEach(g=>{const previous=byId.get(String(g.id));const sameGame=previous&&previous.pgn&&g.pgn&&previous.pgn===g.pgn;byId.set(String(g.id),{...(sameGame?previous:{}),...g,...(sameGame&&previous.analysis&&!g.analysis?{analysis:previous.analysis}:{})});});games=[...byId.values()];saveGames();render();setMessage(added.length+" partie(s) importée(s) depuis le fichier PGN.")};reader.onerror=()=>setMessage("Impossible de lire ce fichier.");reader.readAsText(file)}
let openingsModuleLoaded=false;
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===btn));
 document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id==="panel-"+btn.dataset.tab));
 if(btn.dataset.tab==="openings"&&!openingsModuleLoaded){openingsModuleLoaded=true;import("./openings.js").catch(error=>{openingsModuleLoaded=false;console.error(error);$("opening-table").innerHTML='<div class="empty-state">Impossible de charger le module des ouvertures. Réessaie en ouvrant cet onglet.</div>';});}
}));
document.querySelectorAll("[data-goto]").forEach(btn=>btn.addEventListener("click",()=>document.querySelector('[data-tab="'+btn.dataset.goto+'"]').click()));
$("sync-button").addEventListener("click",syncChessCom);$("sync-button-games").addEventListener("click",syncChessCom);$("pgn-file").addEventListener("change",e=>importPgnFile(e.target.files[0]));$("game-search").addEventListener("input",()=>renderGames([...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""))));$("result-filter").addEventListener("change",()=>renderGames([...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""))));
document.addEventListener("click",e=>{const b=e.target.closest("[data-open-game]");if(!b)return;e.preventDefault();if(window.CoachAnalysis?.openGame){window.CoachAnalysis.openGame(b.dataset.openGame);return;}window.dispatchEvent(new CustomEvent("coach:analyze-game",{detail:{gameId:b.dataset.openGame}}));});
document.addEventListener("click",e=>{if(e.target.closest("[data-games-back]")){$("panel-games")?.classList.remove("reviewing-game");$("game-replay-area").innerHTML="";$("analysis-results").innerHTML="";}});
games=readStoredGames();render();fetchPlayerRatings();
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
window.CoachApp = { getGames: () => games, saveGames: () => saveGames(), refresh: () => render() };
const renderBeforeAnalysis = render;
render = function(){ renderBeforeAnalysis(); window.dispatchEvent(new Event("coach:games-updated")); };
render();

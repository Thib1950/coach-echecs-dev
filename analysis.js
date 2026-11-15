import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const $ = id => document.getElementById(id);
let worker = null, engineReady = null, busy = false, positionRequestId = 0;
let backgroundPauseRequested=false;
const isGamesPanelActive=()=>document.getElementById("panel-games")?.classList.contains("active")===true;
let accuracyQueueRunning=false,accuracyQueueTotal=0,accuracyQueueDone=0,accuracyQueueSkipped=0;
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const user = () => String(window.CoachApp?.getUsername?.() || "").toLowerCase();


function getEngine(){
  if(engineReady)return engineReady;
  engineReady=new Promise((resolve,reject)=>{
    let stage="téléchargement des fichiers Stockfish 19 Lite";
    let settled=false;
    const timer=setTimeout(()=>{
      if(worker){try{worker.terminate();}catch{} worker=null;}
      settled=true;
      reject(new Error("Délai dépassé pendant le "+stage+". Le moteur n'a pas pu être initialisé."));
    },90000);
    const fail=error=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      reject(error instanceof Error?error:new Error(String(error)));
    };
    (async()=>{
      // Précharge explicitement le JS et le WASM via le service worker.
      // Les deux ressources sont ensuite disponibles sous la même origine.
      for(const file of ["stockfish-19-lite-single.js","stockfish-19-lite-single.wasm"]){
        const response=await fetch("./vendor/stockfish/"+file+"?build=25",{cache:"no-store"});
        if(!response.ok){
          const detail=(await response.text()).slice(0,240);
          throw new Error("Téléchargement de "+file+" impossible (HTTP "+response.status+"). "+detail);
        }
      }
      if(settled)return;
      stage="démarrage du Worker WebAssembly";
      worker=new Worker("./vendor/stockfish/stockfish-19-lite-single.js?build=25");
      worker.onmessage=event=>{
        const line=String(event.data||"").trim();
        if(line==="uciok"){
          stage="initialisation UCI (isready)";
          $("engine-status").textContent="Moteur téléchargé · initialisation…";
          worker.postMessage("isready");
        }else if(line==="readyok"){
          if(settled)return;
          settled=true;
          clearTimeout(timer);
          $("engine-status").textContent="Stockfish 19 prêt";
          $("engine-status").classList.add("ready");
          resolve(worker);
        }
      };
      worker.onerror=event=>{
        event.preventDefault?.();
        fail(new Error("Échec du chargement de Stockfish WebAssembly"+(event.message?" : "+event.message:".")));
      };
      worker.onmessageerror=()=>fail(new Error("Stockfish a envoyé une réponse illisible au navigateur."));
      $("engine-status").textContent="Stockfish téléchargé · démarrage du moteur…";
      stage="attente de la réponse UCI (uciok)";
      worker.postMessage("uci");
    })().catch(fail);
  });
  return engineReady;
}

function evalPosition(engine,fen,movetime=650){
  return new Promise((resolve,reject)=>{
    let score=0,bestmove="",pv=[],depth=0,timer=null;
    const handler=event=>{
      const line=String(event.data||"");
      const cp=line.match(/\bscore cp (-?\d+)/);
      const mate=line.match(/\bscore mate (-?\d+)/);
      if(cp)score=Number(cp[1]);
      if(mate)score=Number(mate[1])>0?10000:-10000;
      if(line.startsWith("info ")){
        const d=line.match(/\bdepth (\d+)/);
        if(d)depth=Number(d[1]);
        const pvIndex=line.indexOf(" pv ");
        if(pvIndex>=0)pv=line.slice(pvIndex+4).trim().split(/\s+/).filter(Boolean);
      }
      if(line.startsWith("bestmove")){
        engine.removeEventListener("message",handler);
        clearTimeout(timer);
        bestmove=line.split(/\s+/)[1]||"";
        const whiteToMove=fen.split(" ")[1]!=="b";
        resolve({score,bestmove,pv,depth,scoreWhite:score*(whiteToMove?1:-1)});
      }
    };
    engine.addEventListener("message",handler);
    engine.postMessage("position fen "+fen);
    engine.postMessage("go movetime "+movetime);
    timer=setTimeout(()=>{
      engine.removeEventListener("message",handler);
      reject(new Error("Stockfish n’a pas terminé l’analyse de cette position dans le délai prévu."));
    },20000);
  });
}

function pvToSan(fen,pv,max=8){
  const board=new Chess(fen),out=[];
  for(const uci of (pv||[]).slice(0,max)){
    try{out.push(board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}).san);}
    catch{break;}
  }
  return out;
}
function uciMove(move){ return move.from + move.to + (move.promotion || ""); }
function sanForUci(fen, uci){
  if (!uci || uci === "(none)") return "—";
  const board = new Chess(fen);
  const moves = board.moves({verbose:true});
  const found = moves.find(m => uciMove(m) === uci);
  return found ? found.san : uci;
}
function elapsedText(startedAt){const seconds=Math.floor((Date.now()-startedAt)/1000);return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");}
function winPercent(cp){
  const value=Math.max(-1000,Math.min(1000,Number(cp)||0));
  return 50+50*(2/(1+Math.exp(-0.00368208*value))-1);
}
function moveAccuracyFromWinLoss(loss){
  const value=Math.max(0,Number(loss)||0);
  if(value<=0)return 100;
  return Math.max(0,Math.min(100,103.1668*Math.exp(-0.04354*value)-3.1669));
}
function classify(winLoss,bestMove=false){
  if(bestMove)return {label:"Meilleur coup",kind:"best"};
  if(winLoss<0.5)return {label:"Coup correct",kind:"normal"};
  if(winLoss<2)return {label:"Excellent",kind:"excellent"};
  if(winLoss<5)return {label:"Bon coup",kind:"good"};
  if(winLoss<10)return {label:"Imprécision",kind:"inaccuracy"};
  if(winLoss<20)return {label:"Erreur",kind:"mistake"};
  return {label:"Gaffe",kind:"blunder"};
}
function isBrilliantSacrifice(fen,uci,winLoss,beforeEval,afterEval){
  if(!uci||winLoss>0.01||!beforeEval||!afterEval)return false;
  try{
    const before=new Chess(fen),piece=before.get(uci.slice(0,2));
    const value={p:1,n:3,b:3,r:5,q:9,k:100}[piece?.type]||0;
    if(value<3)return false;
    const after=new Chess(fen);
    after.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
    const target=uci.slice(2,4);
    const capturable=after.moves({verbose:true}).some(move=>move.to===target&&!!move.captured);
    if(!capturable)return false;
    const reply=afterEval.bestmove;
    if(reply&&reply.slice(2,4)===target)return false;
    const moverSign=fen.split(" ")[1]==="w"?1:-1;
    const beforeWin=winPercent(beforeEval.scoreWhite*moverSign);
    const afterWin=winPercent(afterEval.scoreWhite*moverSign);
    return beforeWin<78&&afterWin>42&&afterWin>beforeWin&&(afterEval.scoreWhite*moverSign)>-100;
  }catch{return false;}
}
function gameAccuracyFromMoves(moves){
  // Une précision n'est affichée que si l'échantillon contient assez de coups
  // réellement évalués. Les coups de théorie et les positions incomplètes sont exclus.
  const rows=(moves||[])
    .filter(m=>m.kind!=="book"&&m.winLossPercent!==null&&m.winLossPercent!==undefined&&Number.isFinite(Number(m.winLossPercent)))
    .map(m=>moveAccuracyFromWinLoss(m.winLossPercent))
    .filter(Number.isFinite);
  if(rows.length<6)return null;
  // Moyenne simple et explicable : chaque coup joué compte une fois.
  return Math.round(rows.reduce((sum,value)=>sum+value,0)/rows.length);
}
function resultName(g){
  const white = (g.white || "").toLowerCase() === user();
  const black = (g.black || "").toLowerCase() === user();
  const won = (white && g.result === "1-0") || (black && g.result === "0-1");
  const draw = g.result === "1/2-1/2";
  return won ? "Victoire" : draw ? "Nulle" : "Défaite";
}
function labelGame(g){
  const opponent = (g.white || "").toLowerCase() === user() ? g.black : g.white;
  return (g.date || "Date inconnue") + " · " + (opponent || "Adversaire") + " · " + resultName(g);
}
function refreshGamePicker(){
  const select = $("analysis-game-select");
  if (!select) return;
  const games = (window.CoachApp?.getGames?.() || []).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const previous = select.value;
  select.innerHTML = games.length ? games.map((g,i)=>'<option value="'+esc(g.id)+'">'+esc(labelGame(g))+'</option>').join("") : '<option value="">Aucune partie importée</option>';
  if (games.some(g=>String(g.id)===previous)) select.value = previous;
  $("analyse-game-button").disabled = !games.length || busy;
}
function renderResults(g, report){
  const kinds=["brilliant","excellent","best","great","good","book","inaccuracy","mistake","miss","blunder"];
  const counts=Object.fromEntries(kinds.map(k=>[k,0]));
  report.moves.forEach(m=>{if(counts[m.kind]!==undefined)counts[m.kind]++;});
  const meta={brilliant:["✦","Brillants"],great:["!","Grands coups"],best:["★","Meilleurs coups"],excellent:["◆","Excellents"],good:["✓","Bons coups"],book:["▤","Théorie"],inaccuracy:["?!","Imprécisions"],mistake:["?","Erreurs"],miss:["×","Occasions manquées"],blunder:["‼","Gaffes"]};
  const tiles=kinds.filter(k=>counts[k]>0).map(k=>'<div class="summary-metric '+k+'"><div class="summary-top"><span class="metric-icon">'+meta[k][0]+'</span><strong>'+counts[k]+'</strong></div><span class="metric-label">'+meta[k][1]+'</span></div>').join("");
  window.CoachAnalysisSummaryHTML=tiles?'<div class="analysis-summary">'+tiles+'</div>':"";
  $("analysis-results").innerHTML="";
  if(window.CoachReview?.updateAnalysis)window.CoachReview.updateAnalysis(report.moves,g);
}
function accuracyFromMoves(moves){return gameAccuracyFromMoves(moves);}
function bestMoveFacts(fen,uci){
  if(!uci||uci==="(none)")return {bestCapture:false,bestCheck:false};
  try{
    const board=new Chess(fen),m=board.moves({verbose:true}).find(x=>uciMove(x)===uci);
    if(!m)return {bestCapture:false,bestCheck:false};
    board.move({from:m.from,to:m.to,promotion:m.promotion});
    return {bestCapture:!!m.captured,bestCheck:board.isCheck(),bestMate:board.isCheckmate()};
  }catch{return {bestCapture:false,bestCheck:false};}
}
async function analyseSelectedGame(gameIdOverride,options={}){
  if(busy)return;
  const background=!!options.background,movetime=options.movetime||650;
  const games=window.CoachApp?.getGames?.()||[];
  const id=gameIdOverride===undefined?$("analysis-game-select").value:String(gameIdOverride);
  const game=games.find(g=>String(g.id)===id);
  if(!game){$("analysis-results").innerHTML='<div class="empty-state">Aucune partie sélectionnée.</div>';return;}
  if(!options.force&&game.analysis&&game.analysis.partial===false&&Array.isArray(game.analysis.moves)){
    if(!background){if(window.CoachReview?.open)window.CoachReview.open(game.id);renderResults(game,{moves:game.analysis.moves});$("analysis-progress").hidden=false;$("analysis-progress-fill").style.width="100%";$("analysis-progress-label").textContent="Analyse déjà terminée · résultat conservé.";}
    return;
  }
  if(!background)$("analysis-game-select").value=String(game.id);
  if(!game.pgn){if(!background)$("analysis-results").innerHTML='<div class="empty-state">Le PGN de cette partie n’est pas disponible. Réimporte la partie depuis Chess.com pour l’analyser.</div>';return;}
  busy=true;const startedAt=Date.now();
  if(!background){
    $("analyse-game-button").disabled=true;$("analyse-game-button").textContent="Analyse en cours…";
    $("analysis-progress").hidden=false;$("analysis-progress-fill").style.width="0%";$("analysis-progress-label").textContent="Chargement du moteur Stockfish…";
    $("analysis-results").innerHTML="";if(window.CoachReview?.open)window.CoachReview.open(game.id);
  }
  const report={moves:[],depth:0,covered:0,positions:[],positionDetails:[]};
  let interruptedForNavigation=false;
  try{
    const parsed=new Chess();parsed.loadPgn(game.pgn);
    const history=parsed.history({verbose:true});
    if(!history.length)throw new Error("Aucun coup n'a pu être lu dans le PGN de cette partie.");
    const engine=await getEngine(),replay=new Chess();
    const userSide=(game.white||"").toLowerCase()===user()?"w":"b";
    let beforeEval=await evalPosition(engine,replay.fen(),movetime);
    report.positions.push(beforeEval.scoreWhite);
    for(let i=0;i<history.length;i++){
      const beforeFen=replay.fen(),move=history[i],playedUci=uciMove(move);
      replay.move({from:move.from,to:move.to,promotion:move.promotion});
      const bestSan=sanForUci(beforeFen,beforeEval.bestmove);
      const facts=bestMoveFacts(beforeFen,beforeEval.bestmove);
      const playedBoard=new Chess(beforeFen);playedBoard.move({from:move.from,to:move.to,promotion:move.promotion});
      const detail={
        fen:beforeFen,bestUci:beforeEval.bestmove,pvUci:beforeEval.pv,
        pvSan:pvToSan(beforeFen,beforeEval.pv,8),
        evalWhite:beforeEval.scoreWhite,afterEvalWhite:null,
        color:move.color,ply:i,moveNo:Math.floor(i/2)+1,
        played:move.san,playedUci,best:bestSan,loss:null,label:"Analyse en cours",kind:"good",
        playedCapture:!!move.captured,playedCheck:playedBoard.isCheck(),
        playedMate:playedBoard.isCheckmate(),...facts,depth:beforeEval.depth
      };
      report.positionDetails.push(detail);
      if(move.color===userSide)report.moves.push(detail);
      report.covered=i+1;
      game.analysis={
        date:new Date().toISOString(),moves:report.moves,positions:report.positions,
        positionDetails:report.positionDetails,covered:report.covered,
        accuracy:null,partial:true
      };
      const afterEval=await evalPosition(engine,replay.fen(),movetime);
      const moverSign=move.color==="w"?1:-1;
      const loss=beforeEval.bestmove===playedUci?0:Math.max(0,moverSign*(beforeEval.scoreWhite-afterEval.scoreWhite));
      const winPercentBefore=winPercent(beforeEval.scoreWhite*moverSign);
      const winLossPercent=Math.max(0,winPercentBefore-winPercent(afterEval.scoreWhite*moverSign));
      const afterWinPercent=winPercent(afterEval.scoreWhite*moverSign);
      const isOpeningPhase=i<6&&!!(game.eco||game.opening);
      const quality=(isOpeningPhase&&winLossPercent<5)?{label:"Théorie",kind:"book"}:classify(winLossPercent,playedUci===beforeEval.bestmove);
      if(quality.kind!=="book"&&playedUci===beforeEval.bestmove&&((winPercentBefore<30&&afterWinPercent>=50)||(winPercentBefore>=45&&winPercentBefore<55&&afterWinPercent>=80))){quality.label="Grand coup";quality.kind="great";}
      const previousOpponentMove=report.positionDetails[report.positionDetails.length-1];
      if(quality.kind!=="book"&&move.color===userSide&&previousOpponentMove&&previousOpponentMove.color!==userSide&&previousOpponentMove.winLossPercent>=10&&winLossPercent>=2){quality.label="Occasion manquée";quality.kind="miss";}
      if(quality.kind!=="book"&&playedUci===beforeEval.bestmove&&isBrilliantSacrifice(beforeFen,playedUci,winLossPercent,beforeEval,afterEval)){quality.label="Coup brillant";quality.kind="brilliant";}
      Object.assign(detail,{afterEvalWhite:afterEval.scoreWhite,loss,winPercentBefore,winLossPercent,...quality});
      report.covered=i+1;
      report.depth=Math.max(report.depth,beforeEval.depth||0);
      report.positions.push(afterEval.scoreWhite);
      beforeEval=afterEval;
      game.analysis={
        date:new Date().toISOString(),moves:report.moves,positions:report.positions,
        positionDetails:report.positionDetails,covered:report.covered,
        accuracy:accuracyFromMoves(report.moves),partial:true
      };
      if(move.color===userSide)window.CoachApp.saveGames();
      if(move.color===userSide){
        renderResults(game,report);
        if(background&&report.moves.length%3===0)window.CoachApp.refresh?.();
      }
      if(!background){
        $("analysis-progress-fill").style.width=Math.round((i+1)/history.length*100)+"%";
        $("analysis-progress-label").textContent="Analyse en cours · "+(i+1)+" / "+history.length+" demi-coups · "+elapsedText(startedAt);
      }
      // Dès que l'utilisateur quitte Mes parties, on libère Stockfish pour
      // que l'écran demandé soit prioritaire. Les coups déjà évalués sont conservés.
      if(background&&(backgroundPauseRequested||!isGamesPanelActive())){
        interruptedForNavigation=true;
        break;
      }
    }
    if(interruptedForNavigation){
      game.analysis={date:new Date().toISOString(),moves:report.moves,positions:report.positions,positionDetails:report.positionDetails,covered:report.covered,accuracy:accuracyFromMoves(report.moves),partial:true,paused:true};
      window.CoachApp.saveGames();
      return;
    }
    game.analysis={date:new Date().toISOString(),moves:report.moves,positions:report.positions,positionDetails:report.positionDetails,covered:report.covered,accuracy:accuracyFromMoves(report.moves),partial:false,complete:true,depth:report.depth};
    window.CoachApp.saveGames();
    window.CoachApp.refresh?.();
    if(!background){
      renderResults(game,report);
      if(window.CoachReview?.updateAnalysis)window.CoachReview.updateAnalysis(report.moves,game);
      $("analysis-progress-fill").style.width="100%";
      $("analysis-progress-label").textContent="Analyse terminée · "+elapsedText(startedAt)+" · "+(game.analysis.accuracy===null?"Précision non disponible (moins de 6 coups évaluables).":"Précision estimée : "+game.analysis.accuracy+" %.");
    }else{
      renderResults(game,report);
      window.CoachApp.refresh?.();
      updateAccuracyQueueStatus();
    }
  }catch(error){
    if(!report.covered){
      engineReady=null;if(worker){try{worker.terminate();}catch{}worker=null;}
      if(!background){
        $("analysis-results").innerHTML='<div class="empty-state">'+esc(error.message||"Une erreur est survenue pendant l’analyse.")+'</div>';
        $("engine-status").textContent="Moteur indisponible";
      }
    }else{
      game.analysis={date:new Date().toISOString(),moves:report.moves,positions:report.positions,positionDetails:report.positionDetails,covered:report.covered,accuracy:accuracyFromMoves(report.moves),partial:true};
      window.CoachApp.saveGames();
      window.CoachApp.refresh?.();
      if(!background){
        renderResults(game,report);
        $("analysis-progress-label").textContent="Analyse interrompue après "+report.covered+" demi-coups. Les positions déjà calculées restent disponibles.";
      }
    }
  }finally{
    busy=false;refreshGamePicker();
    if(background)window.CoachApp?.refresh?.();
    if(!background){
      $("analyse-game-button").disabled=false;$("analyse-game-button").textContent="Analyser cette partie";

    }
  }
}
function updateAccuracyQueueStatus(){
 const status=$("accuracy-queue-status"),button=$("accuracy-queue-button");
 const waiting=accuracyQueueIds.length;
 if(status)status.textContent=accuracyQueueRunning
  ?"Précisions : "+accuracyQueueDone+" / "+accuracyQueueTotal+" parties terminées · "+waiting+" en attente"
  :accuracyQueueTotal
   ?"Terminé : "+accuracyQueueDone+" partie(s) analysée(s), "+accuracyQueueSkipped+" ignorée(s)."
   :"Les précisions se calculent automatiquement, une partie après l’autre, dans Mes parties.";
 if(button){button.disabled=false;button.textContent=accuracyQueueRunning?"Calcul en cours…":"Calculer les précisions manquantes";}
}
let accuracyQueueIds=[];
let accuracyQueuePromise=null;
function needsAccuracy(game){
 return !!(game?.pgn&&!(game.analysis&&game.analysis.partial===false&&Array.isArray(game.analysis.moves)));
}
function enqueueAccuracy(gameId,first=false){
 const id=String(gameId);
 if(!accuracyQueueIds.includes(id)){
  if(first)accuracyQueueIds.unshift(id);else accuracyQueueIds.push(id);
 }
}
function startAccuracyQueue(){
 if(accuracyQueuePromise)return accuracyQueuePromise;
 if(!accuracyQueueIds.length||!isGamesPanelActive()||backgroundPauseRequested)return Promise.resolve();
 accuracyQueueRunning=true;updateAccuracyQueueStatus();
 accuracyQueuePromise=(async()=>{
  try{
   while(accuracyQueueIds.length){
    if(backgroundPauseRequested||!isGamesPanelActive())break;
    const id=accuracyQueueIds.shift();
    const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===id);
    if(!game||!needsAccuracy(game))continue;
    while(busy&&!backgroundPauseRequested&&isGamesPanelActive())await new Promise(resolve=>setTimeout(resolve,180));
    if(backgroundPauseRequested||!isGamesPanelActive()){accuracyQueueIds.unshift(id);break;}
    try{
     await analyseSelectedGame(id,{background:true,movetime:320});
     if(backgroundPauseRequested||!isGamesPanelActive()){accuracyQueueIds.unshift(id);break;}
     const latest=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===id);
     if(latest?.analysis?.partial===false&&Array.isArray(latest.analysis.moves))accuracyQueueDone++;
     else accuracyQueueSkipped++;
    }catch(error){
     accuracyQueueSkipped++;
     console.warn("Analyse de précision ignorée",id,error);
    }
    updateAccuracyQueueStatus();
   }
  }finally{
   accuracyQueueRunning=false;accuracyQueuePromise=null;updateAccuracyQueueStatus();
   window.CoachApp?.refresh?.();
  }
 })();
 return accuracyQueuePromise;
}
function scheduleRecentAccuracy(){
 setTimeout(()=>{
  if(!isGamesPanelActive()||backgroundPauseRequested)return;
  const games=(window.CoachApp?.getGames?.()||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  // Automatique uniquement sur les cinq parties les plus récentes.
  const pending=games.slice(0,5).filter(needsAccuracy);
  pending.forEach(game=>enqueueAccuracy(game.id));
  if(pending.length){
   accuracyQueueTotal=Math.max(accuracyQueueTotal,accuracyQueueDone+accuracyQueueSkipped+pending.length);
   updateAccuracyQueueStatus();
   startAccuracyQueue();
  }
 },120);
}
window.addEventListener("coach:games-updated",scheduleRecentAccuracy);
window.addEventListener("coach:account-changed",()=>{
 accuracyQueueIds=[];accuracyQueueDone=0;accuracyQueueSkipped=0;accuracyQueueTotal=0;
 scheduleRecentAccuracy();
});
window.addEventListener("coach:tab-changing",event=>{
 if(event.detail?.tab==="games"){
  backgroundPauseRequested=false;
  scheduleRecentAccuracy();
 }else{
  backgroundPauseRequested=true;
  updateAccuracyQueueStatus();
 }
});
async function analyzeWhenIdle(gameId,options={}){
 while(busy)await new Promise(resolve=>setTimeout(resolve,180));
 return analyseSelectedGame(String(gameId),options);
}
function openGameInCoach(gameId){
  const id=String(gameId??"");
  document.querySelector('[data-tab="games"]')?.click();
  const panel=$("panel-games");
  panel?.classList.add("reviewing-game");
  refreshGamePicker();
  const select=$("analysis-game-select");
  const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===id);
  if(!game){
    $("analysis-results").innerHTML='<div class="empty-state">Cette partie est introuvable dans les données de cet appareil.</div>';
    return false;
  }
  if(select)select.value=id;
  if(window.CoachReview?.open)window.CoachReview.open(id);
  $("games-analysis-workspace")?.scrollIntoView({behavior:"smooth",block:"start"});
  const cached=!!(game.analysis&&!game.analysis.partial&&Array.isArray(game.analysis.moves)&&game.analysis.moves.length);
  if(cached){
    if(window.CoachReview?.updateAnalysis)window.CoachReview.updateAnalysis(game.analysis.moves,game);
    renderResults(game,{moves:game.analysis.moves});
  }else{
    analyzeWhenIdle(id,{background:true,movetime:600});
  }
  return true;
}
window.addEventListener("coach:analyze-game",event=>openGameInCoach(event.detail?.gameId));
$("analyse-game-button").addEventListener("click",()=>analyseSelectedGame(undefined,{force:true}));
window.addEventListener("coach:games-updated",refreshGamePicker);
window.CoachAnalysis={
 openGame:openGameInCoach,
 analyze:gameId=>openGameInCoach(gameId),
 async analyzeAccuracy(gameId){
  enqueueAccuracy(gameId,true);
  const pending=(window.CoachApp?.getGames?.()||[]).filter(needsAccuracy);
  accuracyQueueTotal=Math.max(accuracyQueueTotal,accuracyQueueDone+accuracyQueueSkipped+pending.length);
  updateAccuracyQueueStatus();
  return startAccuracyQueue();
 },
 async analyzePosition(fen){
  const request=++positionRequestId;
  while(busy){
   await new Promise(resolve=>setTimeout(resolve,150));
   if(request!==positionRequestId)throw new Error("Cette analyse a été remplacée par une position plus récente.");
  }
  if(request!==positionRequestId)throw new Error("Cette analyse a été remplacée par une position plus récente.");
  busy=true;
  try{
   const engine=await getEngine(),result=await evalPosition(engine,fen,650);
   if(request!==positionRequestId)throw new Error("Cette analyse a été remplacée par une position plus récente.");
   return {...result,bestSan:sanForUci(fen,result.bestmove),pvSan:pvToSan(fen,result.pv,6)};
  }finally{busy=false;refreshGamePicker();}
 }
};
refreshGamePicker();

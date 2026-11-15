import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const LEGACY_PROGRESS_KEY="coach-echecs-dev-puzzle-progress-v1";
const progressKey=()=>LEGACY_PROGRESS_KEY+":"+String(window.CoachApp?.getUsername?.()||"gone_1950").toLowerCase();
let board=null,solution=[],ply=0,selected=null,orientation="white",hinted=false,solved=false,loading=false,currentPuzzle=null,currentDailyId="",personalized=[],showAllPersonal=false,sessionActive=false,sessionQueue=[],sessionTotal=0,sessionSolved=0,sessionLabel="Session personnalisée",sessionMode="",sessionLives=3,sessionTimeLeft=180,sessionTimer=null,sessionPuzzleIds=[],sessionFinished=false,autoNextTimer=null,dailyDecisionOpen=false,solutionRevealed=false,learnExerciseMode=false,learnBackView="learn-training-choice",learnCurrentView="learn-training-choice",learnCategory="tactics",learnVisibleItems=[];
function stopPuzzleTimer(){if(sessionTimer){clearInterval(sessionTimer);sessionTimer=null;}}
function localDayKey(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function stopAutoNext(){if(autoNextTimer){clearTimeout(autoNextTimer);autoNextTimer=null;}}
function solutionAsSan(){if(!board)return "";const replay=new Chess(board.fen()),moves=[];for(const u of solution.slice(ply)){const m=legalSolutionMove(replay,u);if(!m)break;moves.push(m.san);replay.move({from:m.from,to:m.to,promotion:m.promotion||"q"});}return moves.join(" ");}
function finishPuzzle(){
 solved=true;hinted=false;selected=null;loading=false;markPuzzleSolved();if(sessionActive)sessionSolved++;
 if(sessionMode==="daily"){sessionActive=false;puzzleProgress.dailyDate=localDayKey();puzzleProgress.dailyLives=sessionLives;message("Bravo, tu as réussi le puzzle du jour !");}else message("Puzzle réussi ! Bravo, tu as trouvé la combinaison.");
 render();
 if(sessionMode&&sessionMode!=="daily"){stopAutoNext();autoNextTimer=setTimeout(()=>{autoNextTimer=null;if(!solved||sessionFinished)return;if(sessionMode==="adaptive")loadNextSessionPuzzle();else if(["bank","lives","timed"].includes(sessionMode))loadDaily(true);},2500);}
}
function startPuzzleTimer(){stopPuzzleTimer();sessionTimeLeft=180;sessionTimer=setInterval(()=>{if(!sessionActive||sessionMode!=="timed")return;sessionTimeLeft=Math.max(0,sessionTimeLeft-1);const node=$("puzzle-session-timer");if(node)node.textContent=Math.floor(sessionTimeLeft/60)+":"+String(sessionTimeLeft%60).padStart(2,"0");if(sessionTimeLeft<=0){sessionActive=false;sessionFinished=true;loading=false;stopPuzzleTimer();message("Temps écoulé ! Tu as résolu "+sessionSolved+" puzzle(s) en 3 minutes.");render();}},1000);}
function sessionStatus(){if(sessionMode==="daily"||sessionMode==="lives"){const total=sessionMode==="daily"?5:3;return '<span class="puzzle-hearts" aria-label="'+sessionLives+' essais restants">'+"♥".repeat(Math.max(0,sessionLives))+"♡".repeat(Math.max(0,total-sessionLives))+'</span>';}if(sessionMode==="timed")return '<span class="puzzle-timer-label" id="puzzle-session-timer">'+Math.floor(sessionTimeLeft/60)+":"+String(sessionTimeLeft%60).padStart(2,"0")+'</span>';if(sessionMode==="bank"||sessionMode==="adaptive")return "Série "+sessionSolved;if(sessionActive)return sessionLabel+" · "+sessionSolved;if(sessionFinished)return "Session terminée · "+sessionSolved;return "";}
let puzzleProgress={dailySolved:[],personalSolved:[],bankSolved:[],dailyDate:"",dailyLives:5,attempts:0,wrongMoves:0};
let puzzleFeedbackText="Repère la meilleure suite pour les Blancs ou les Noirs.",puzzleFeedbackClass="feedback-neutral";
function loadPuzzleProgress(){try{const raw=localStorage.getItem(progressKey())||(String(window.CoachApp?.getUsername?.()||"gone_1950").toLowerCase()==="gone_1950"?localStorage.getItem(LEGACY_PROGRESS_KEY):null);const p=JSON.parse(raw||"{}");puzzleProgress={dailySolved:Array.isArray(p.dailySolved)?p.dailySolved:[],personalSolved:Array.isArray(p.personalSolved)?p.personalSolved:[],bankSolved:Array.isArray(p.bankSolved)?p.bankSolved:[],dailyDate:String(p.dailyDate||""),dailyLives:Number.isFinite(Number(p.dailyLives))?Math.max(0,Math.min(5,Number(p.dailyLives))):5,attempts:Number(p.attempts)||0,wrongMoves:Number(p.wrongMoves)||0};}catch{}}
function savePuzzleProgress(){try{localStorage.setItem(progressKey(),JSON.stringify(puzzleProgress));}catch{}renderPuzzleProgress();}
function renderPuzzleProgress(){const node=$("puzzle-progress");const total=puzzleProgress.dailySolved.length+puzzleProgress.personalSolved.length+(puzzleProgress.bankSolved||[]).length;if(node)node.textContent=total+" résolu"+(total>1?"s":"")+" · "+puzzleProgress.attempts+" tentative"+(puzzleProgress.attempts>1?"s":"")+" · "+puzzleProgress.wrongMoves+" erreur"+(puzzleProgress.wrongMoves>1?"s":"");const solved=$("puzzle-hub-solved"),attempts=$("puzzle-hub-attempts"),errors=$("puzzle-hub-errors");if(solved)solved.textContent=String(total);if(attempts)attempts.textContent=String(puzzleProgress.attempts);if(errors)errors.textContent=String(puzzleProgress.wrongMoves);}
function openPuzzleExercise(){const hub=$("puzzle-hub"),exercise=$("puzzle-exercise");if(hub)hub.hidden=true;if(exercise)exercise.hidden=false;$("panel-puzzles")?.classList.add("puzzle-exercise-active");}
function closePuzzleExercise(){if(learnExerciseMode){const exercise=$("learn-training-exercise"),back=$(learnBackView);if(exercise)exercise.hidden=true;if(back)back.hidden=false;learnExerciseMode=false;}else{const hub=$("puzzle-hub"),exercise=$("puzzle-exercise");if(exercise)exercise.hidden=true;if(hub)hub.hidden=false;$("panel-puzzles")?.classList.remove("puzzle-exercise-active");}sessionActive=false;sessionQueue=[];sessionMode="";sessionFinished=false;dailyDecisionOpen=false;solutionRevealed=false;stopPuzzleTimer();stopAutoNext();loading=false;selected=null;board=null;}
function personalKey(game,detail){return String(game.id)+"|"+detail.fen+"|"+detail.bestUci;}
function markPuzzleSolved(){
 const key=currentPuzzle?personalKey(currentPuzzle.game,currentPuzzle.detail):currentDailyId;if(!key)return;
 const list=currentPuzzle?puzzleProgress.personalSolved:sessionMode==="daily"?puzzleProgress.dailySolved:(puzzleProgress.bankSolved||(puzzleProgress.bankSolved=[]));
 if(!list.includes(key)){list.push(key);savePuzzleProgress();}else renderPuzzleProgress();
 renderPersonalized();
}
function uci(move){return move.from+move.to+(move.promotion||"");}
function legalSolutionMove(position,moveUci){
 if(!position||!moveUci)return null;
 return position.moves({verbose:true}).find(move=>uci(move)===moveUci)||null;
}
function loadPosition(pgn,initialPly){
 const game=new Chess();game.loadPgn(pgn);const history=game.history({verbose:true});const position=new Chess();
 history.slice(0,initialPly).forEach(m=>position.move({from:m.from,to:m.to,promotion:m.promotion}));
 return position;
}
function lessonTheme(item){
 const d=item?.detail||{};
 if(d.bestMate||d.bestCheck)return {key:"forcing",label:"Coups forcing",tip:"Après chaque coup adverse, vérifie d’abord les échecs, les prises et les menaces directes. Ces coups limitent les réponses disponibles."};
 if(d.bestCapture)return {key:"tactics",label:"Occasions tactiques",tip:"Avant de choisir un coup naturel, fais le tour des prises possibles et des pièces adverses insuffisamment défendues."};
 if(Number(d.ply)<14)return {key:"opening",label:"Principes d’ouverture",tip:"Développe tes pièces, lutte pour le centre et prépare la sécurité du roi avant de multiplier les coups de pion."};
 if(Number(d.ply)>60)return {key:"endgame",label:"Technique de finale",tip:"En finale, compare l’activité du roi, les pions passés et l’activité de chaque pièce avant de pousser un pion."};
 if(d.kind==="miss")return {key:"opportunity",label:"Occasions manquées",tip:"Quand l’adversaire vient de faire une erreur, cherche immédiatement les coups forcing : échecs, captures et menaces."};
 return {key:"plan",label:"Choix du plan",tip:"Compare les coups candidats : quelle pièce est la moins active, quelle menace adverse dois-tu traiter et quelle amélioration apporte ton coup ?"};
}
function personalLessonMarkup(item,isSolved){
 const d=item.detail||{},theme=lessonTheme(item),next=(item.game.analysis?.positionDetails||[]).find(x=>Number(x.ply)===Number(d.ply)+1);
 let consequence="";
 if(next?.playedCapture){
  try{const replyBoard=new Chess(next.fen),reply=legalSolutionMove(replyBoard,next.playedUci);if(reply?.captured){const names={p:"un pion",n:"un cavalier",b:"un fou",r:"une tour",q:"la dame"};consequence="Dans la suite réelle, l’adversaire a répondu par "+next.played+" et a pris "+(names[reply.captured]||"du matériel")+". ";}}catch{}
 }
 let why="";
 if(d.bestMate)why="L’analyse repère une possibilité de mat forcé que ton coup n’a pas saisie.";
 else if(d.bestCheck)why="La meilleure suite commence par un échec : c’est un coup forcing qui oblige l’adversaire à répondre à la menace sur son roi.";
 else if(d.bestCapture)why="La meilleure suite commence par une prise. Il fallait examiner les possibilités tactiques et les pièces qui pouvaient être gagnées.";
 else if(d.kind==="miss")why="Tu n’as pas pleinement profité de la dernière erreur adverse. Dans ce genre de moment, il faut chercher les coups forcing avant de jouer un coup de développement ou de placement.";
 else why="Stockfish préfère "+(d.best||"un autre coup")+" à ton coup "+(d.played||"joué")+". La ligne principale permet de comparer concrètement les deux décisions ; les données disponibles ne permettent pas d’attribuer avec certitude une intention stratégique à ton coup.";
 const line=Array.isArray(d.pvSan)&&d.pvSan.length?d.pvSan.join(" "):(d.best||"—");
 const loss=Number(d.winLossPercent);
 return '<section class="puzzle-lesson-brief"><div class="puzzle-lesson-heading"><span>ANALYSE DE TON COACH</span><b>'+esc(theme.label)+'</b></div><div class="puzzle-lesson-moves"><div><small>TON COUP</small><strong>'+esc(d.played||"—")+'</strong></div><div><small>MEILLEURE IDÉE</small><strong>'+esc(d.best||"—")+'</strong></div>'+(Number.isFinite(loss)&&loss>=1?'<div><small>IMPACT ESTIMÉ</small><strong>−'+loss.toFixed(1).replace(".",",")+' pts %</strong></div>':"")+'</div><p><strong>Pourquoi le coach le relève :</strong> '+esc(why)+'</p>'+(consequence?'<p>'+esc(consequence)+'</p>':"")+'<p><strong>À retenir :</strong> '+esc(theme.tip)+'</p><div class="puzzle-lesson-line"><small>LIGNE STOCKFISH</small><span>'+esc(line)+'</span></div>'+(isSolved?'<div class="puzzle-lesson-complete">✓ Position travaillée : rejoue cette idée dans tes prochaines parties.</div>':'<div class="puzzle-lesson-instruction">Joue la meilleure suite sur l’échiquier. Le coach te fera parcourir la variante pour comprendre le plan.</div>')+'</section>';
}
function adaptiveCandidates(items){
 const open=items.filter(item=>!puzzleProgress.personalSolved.includes(item.id));
 const counts=new Map();open.forEach(item=>{const key=lessonTheme(item).key;counts.set(key,(counts.get(key)||0)+1);});
 const severity={blunder:4,mistake:3,miss:2,inaccuracy:1};
 return open.sort((a,b)=>(counts.get(lessonTheme(b).key)||0)-(counts.get(lessonTheme(a).key)||0)||(severity[b.detail.kind]||0)-(severity[a.detail.kind]||0)||(Number(b.detail.winLossPercent)||0)-(Number(a.detail.winLossPercent)||0));
}
async function startAdaptive(){
 sessionMode="bank";sessionLabel="Série";sessionActive=true;sessionFinished=false;sessionQueue=[];sessionPuzzleIds=[];sessionTotal=0;sessionSolved=0;sessionLives=3;stopPuzzleTimer();stopAutoNext();
 message("Trouve la meilleure suite. Après chaque réussite, un nouveau problème te sera proposé.");await loadDaily(true);
}
function render(){
 if(!board)return;
 const files=orientation==="white"?"abcdefgh":"hgfedcba",ranks=orientation==="white"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
 const legal=selected?board.moves({square:selected,verbose:true}):[],targets=new Map(legal.map(m=>[m.to,m.captured?"capture":"move"]));
 const hintMove=hinted?legalSolutionMove(board,solution[ply]):null;let cells="";
 ranks.forEach(rank=>[...files].forEach(file=>{const sq=file+rank,p=board.get(sq),light=((rank-1+(file.charCodeAt(0)-97))%2)===1;let cls="puzzle-square "+(light?"light":"dark")+(selected===sq?" selected":"")+(targets.get(sq)==="capture"?" puzzle-capture":"")+(hintMove?.from===sq?" hint-from":"");const dot=targets.get(sq)==="move"?'<i class="puzzle-dot"></i>':"";cells+='<button type="button" class="'+cls+'" data-puzzle-square="'+sq+'" aria-label="'+sq+'">'+(p?'<img src="https://lichess1.org/assets/piece/cburnett/'+p.color+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':"")+dot+'</button>';}));
 const sideToMove=board.turn()==="w"?"Aux Blancs":"Aux Noirs",status=solved?(sessionMode==="daily"?"Puzzle du jour réussi":"Puzzle réussi !"):sessionFinished?"Session terminée":puzzleFeedbackClass==="feedback-wrong"?"Faux":"À toi de jouer",session=sessionStatus();
 const dailyOptions=sessionMode==="daily"&&sessionLives===0&&!solved&&!hinted&&!solutionRevealed?'<div class="puzzle-daily-options"><button type="button" class="secondary-button" data-daily-hint>Afficher un indice</button><button type="button" class="primary-button" data-daily-solution>Afficher la solution</button></div>':"";
 const solutionLine=solutionRevealed?'<div class="puzzle-solution-reveal"><strong>Solution</strong><span>'+esc(solutionAsSan())+'</span></div>':"";
 const sessionHtml=session?'<div class="puzzle-session-status">'+session+'</div>':"";
 const panel='<aside class="puzzle-side puzzle-side-minimal"><div class="puzzle-turn-indicator '+(board.turn()==="w"?"white-turn":"black-turn")+'"><span class="turn-dot"></span><strong>'+sideToMove+'</strong></div><div class="puzzle-result-state '+(solved?"is-correct":puzzleFeedbackText.startsWith("Faux")?"is-wrong":"")+'"><strong>'+status+'</strong><p id="puzzle-feedback" aria-live="polite" class="'+puzzleFeedbackClass+'">'+esc(puzzleFeedbackText.replace(/^Faux[.!]?\s*/i, ""))+'</p></div>'+sessionHtml+'<div class="puzzle-side-actions">'+(dailyOptions||(!solved&&!sessionFinished?'<button type="button" class="secondary-button" id="puzzle-hint">💡 Indice</button>':""))+'</div>'+solutionLine+'</aside>';
 let modal="";
 if(dailyDecisionOpen)modal='<div class="puzzle-end-overlay"><div class="puzzle-end-card"><span class="eyebrow">PUZZLE DU JOUR</span><h3>Plus aucun cœur</h3><p>Tu as utilisé tes cinq essais. Souhaites-tu un indice sur la pièce à jouer ou voir toute la solution ?</p><div class="puzzle-end-actions"><button type="button" class="secondary-button" data-daily-hint>Afficher un indice</button><button type="button" class="primary-button" data-daily-solution>Voir la solution</button></div></div></div>';
 if(sessionFinished&&sessionMode==="lives")modal='<div class="puzzle-end-overlay"><div class="puzzle-end-card"><span class="eyebrow">MODE SURVIE</span><h3>Fin de la série</h3><p>Tu as perdu tes trois essais. Ton score était de '+sessionSolved+' puzzle(s) réussi(s).</p><div class="puzzle-end-actions"><button type="button" class="primary-button" data-session-restart>Recommencer à zéro</button><button type="button" class="secondary-button" data-puzzle-back>Retour aux puzzles</button></div></div></div>';
 if(sessionFinished&&sessionMode==="timed")modal='<div class="puzzle-end-overlay"><div class="puzzle-end-card"><span class="eyebrow">DÉFI CHRONOMÉTRÉ</span><h3>Temps écoulé</h3><p>Tu as résolu '+sessionSolved+' puzzle(s).</p><button type="button" class="primary-button" data-session-restart>Recommencer</button></div></div>';
 const boardArea=$(learnExerciseMode?"learn-training-board-area":"puzzle-board-area");if(!boardArea)return;
 const backButton='<div class="puzzle-side-back"><button type="button" class="secondary-button" data-puzzle-back>'+(learnExerciseMode?"← Retour à mon entraînement":"← Retour aux puzzles")+'</button></div>';
 boardArea.innerHTML='<div class="puzzle-board-wrap"><div class="puzzle-board">'+cells+'</div></div>'+panel+backButton+modal;
}
function message(text){puzzleFeedbackText=String(text??"");puzzleFeedbackClass=/^Faux[.!]?/i.test(puzzleFeedbackText)?"feedback-wrong":/^(Bravo|Bien joué)/i.test(puzzleFeedbackText)?"feedback-correct":"feedback-neutral";const node=$("puzzle-feedback");if(!node)return;node.textContent=puzzleFeedbackText;node.classList.remove("feedback-wrong","feedback-correct","feedback-neutral");node.classList.add(puzzleFeedbackClass);}

const localPuzzleBuckets=[1200,1300,1400,1500,1600,1700];
const localPuzzleCache=new Map();
async function getLocalPuzzleBucket(rating){
 const band=localPuzzleBuckets.includes(rating)?rating:1200;
 if(localPuzzleCache.has(band))return localPuzzleCache.get(band);
 const promise=fetch(new URL("./data/puzzles/r"+band+".json",import.meta.url),{cache:"force-cache"})
  .then(response=>{if(!response.ok)throw new Error("Données de puzzles indisponibles (HTTP "+response.status+").");return response.json();})
  .then(rows=>{if(!Array.isArray(rows)||!rows.length)throw new Error("La banque locale de puzzles est vide.");return rows;})
  .catch(error=>{localPuzzleCache.delete(band);throw error;});
 localPuzzleCache.set(band,promise);
 return promise;
}
function puzzleFromLocalRow(row){
 if(!Array.isArray(row)||row.length<5)throw new Error("Format de puzzle invalide.");
 const [id,fen,moves,rating,themes]=row;
 const sequence=String(moves||"").trim().split(/\s+/).filter(Boolean);
 if(!fen||sequence.length<2)throw new Error("Puzzle incomplet.");
 const test=new Chess(fen);
 for(const u of sequence){
  const move=legalSolutionMove(test,u);
  if(!move)throw new Error("La combinaison contient un coup illégal.");
  test.move({from:move.from,to:move.to,promotion:move.promotion||"q"});
 }
 return {id:String(id),fen,solution:sequence,rating:Number(rating)||1400,themes:String(themes||"").split(/\s+/).filter(Boolean)};
}
async function loadLocalDailyPuzzle(randomize=false,excluded=[]){
 const bands=randomize?[1200,1300,1400,1500,1600,1700]:[1700];
 const today=new Date(),day=Math.floor(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())/86400000);
 const band=randomize?bands[Math.floor(Math.random()*bands.length)]:1700;
 const rows=await getLocalPuzzleBucket(band);
 // Shuffle a short sample and skip any corrupt row rather than failing the whole session.
 const startAt=randomize?Math.floor(Math.random()*rows.length):Math.abs((day*2654435761)%rows.length);
 let lastError=null;
 for(let n=0;n<Math.min(80,rows.length);n++){
  try{const candidate=puzzleFromLocalRow(rows[(startAt+n)%rows.length]);if(!excluded.includes(candidate.id))return candidate;}
  catch(error){lastError=error;}
 }
 throw lastError||new Error("Aucun puzzle exploitable dans cette banque.");
}
async function loadDaily(randomize=false){
 if(loading)return;loading=true;currentPuzzle=null;if(!sessionMode){sessionActive=false;sessionQueue=[];sessionTotal=0;sessionSolved=0;sessionFinished=false;stopPuzzleTimer();}board=null;
 $("puzzle-board-area").innerHTML='<div class="empty-state">Chargement de la banque tactique…</div>';
 message("Chargement des puzzles intégrés à l’application…");
 try{
  const data=await loadLocalDailyPuzzle(randomize,sessionMode?sessionPuzzleIds:[]);
  solution=data.solution;currentDailyId=data.id;if(sessionMode&&sessionMode!=="daily"){sessionPuzzleIds.push(data.id);sessionTotal++;}
  board=new Chess(data.fen);selected=null;hinted=false;solved=false;dailyDecisionOpen=false;solutionRevealed=false;
  const setupMove=legalSolutionMove(board,solution[0]);
  if(!setupMove)throw new Error("Le coup de préparation n’est pas légal dans la position.");
  board.move({from:setupMove.from,to:setupMove.to,promotion:setupMove.promotion||"q"});
  ply=1;
  if(!solution[ply]||!legalSolutionMove(board,solution[ply]))throw new Error("Le camp au trait ne correspond pas à la combinaison.");
  // L'orientation est toujours celle du joueur qui doit résoudre, après le coup adverse.
  orientation=board.turn()==="w"?"white":"black";
  puzzleProgress.attempts++;savePuzzleProgress();
  $("puzzle-title").textContent="Puzzle tactique · "+data.id;
  $("puzzle-rating").textContent=data.rating+" Elo";
  $("puzzle-themes").textContent="Thèmes : "+data.themes.join(" · ");
  const alreadySolved=sessionMode==="daily"&&puzzleProgress.dailySolved.includes(currentDailyId);
  const dailyExhausted=sessionMode==="daily"&&puzzleProgress.dailyDate===localDayKey()&&puzzleProgress.dailyLives===0&&!alreadySolved;
  if(alreadySolved){solved=true;sessionActive=false;message("Bravo ! Tu as déjà réussi le puzzle du jour. Reviens demain pour un nouveau défi.");}
  else if(dailyExhausted){sessionLives=0;sessionFinished=true;sessionActive=false;dailyDecisionOpen=true;message("Tu as déjà utilisé tes cinq vies aujourd’hui. Choisis un indice ou affiche la solution.");}
  else message(sessionMode==="daily"?"Un seul défi aujourd’hui, niveau 1700 Elo. Prends le temps de calculer avant ton premier coup : repère les échecs, les prises et les menaces. Tu disposes de cinq vies.":"Trouve la combinaison. Tu peux demander un indice si nécessaire.");
  render();renderPersonalized();renderPuzzleProgress();
 }catch(error){
  $("puzzle-title").textContent="Puzzle indisponible";
  $("puzzle-board-area").innerHTML='<div class="empty-state">Impossible de charger la banque locale : '+esc(error.message)+'. Réessaie dans un instant.</div>';
  message("Le chargement local des exercices a échoué.");
 }finally{loading=false;}
}

function personalCandidates(){
 const games=window.CoachApp?.getGames?.()||[],out=[];
 for(const game of games){
  const username=String(window.CoachApp?.getUsername?.()||"").toLowerCase();const side=(game.white||"").toLowerCase()===username?"w":(game.black||"").toLowerCase()===username?"b":"";
  if(!side)continue;
  for(const detail of game.analysis?.positionDetails||[]){
   if(detail.color!==side||!detail.fen||!detail.bestUci||detail.bestUci===detail.playedUci)continue;
   if(!["inaccuracy","mistake","blunder","miss"].includes(detail.kind))continue;
   out.push({game,detail,id:personalKey(game,detail)});
  }
 }
 const priority={blunder:4,mistake:3,miss:2,inaccuracy:1};
 return out.sort((a,b)=>(priority[b.detail.kind]||0)-(priority[a.detail.kind]||0)||(Number(b.detail.winLossPercent)||0)-(Number(a.detail.winLossPercent)||0));
}
function renderPersonalized(){
 const root=$("personal-puzzle-list"),count=$("personal-puzzle-count");renderLearnPersonalLists();if(!root||!count)return;
 personalized=personalCandidates();
 count.textContent=personalized.length+" position"+(personalized.length>1?"s":"");
 if(!personalized.length){
  root.innerHTML='<div class="empty-state compact">Aucun exercice pour le moment. Lance l’analyse Stockfish de tes parties : les erreurs et occasions manquées deviendront des puzzles à résoudre.</div>';
  return;
 }
 root.innerHTML=personalized.slice(0,showAllPersonal?personalized.length:8).map((item,i)=>{
  const g=item.game,d=item.detail,username=String(window.CoachApp?.getUsername?.()||"").toLowerCase(),opponent=(g.white||"").toLowerCase()===username?g.black:g.white;
  const date=g.date?new Date(g.date+"T12:00:00").toLocaleDateString("fr-FR"):"Date inconnue";
  const done=puzzleProgress.personalSolved.includes(item.id);
  return '<div class="personal-puzzle-row"><div class="personal-puzzle-info"><strong>'+esc(d.label||"Coup à revoir")+(done?' <span class="puzzle-solved-mark">✓ Résolu</span>':'')+'</strong><span>Contre '+esc(opponent||"Adversaire")+' · '+date+'</span><small>Tu as joué '+esc(d.played||"—")+' · meilleure suite : '+esc(d.best||"—")+'</small></div><button type="button" class="secondary-button" data-personal-puzzle="'+i+'">'+(done?"Refaire":"S’entraîner")+'</button></div>';
 }).join("");
 if(personalized.length>8){const more=document.createElement("button");more.type="button";more.className="text-button personal-puzzle-more";more.dataset.personalPuzzleMore="";more.textContent=showAllPersonal?"Réduire la liste":"Voir toutes les positions ("+personalized.length+")";root.appendChild(more);}
}
function renderLearnPersonalLists(){
 personalized=personalCandidates();
 const categories={
  endgame:personalized.filter(item=>lessonTheme(item).key==="endgame"||Number(item.detail.ply)>60),
  tactics:personalized.filter(item=>["forcing","tactics","opportunity"].includes(lessonTheme(item).key)||item.detail.bestCapture||item.detail.bestCheck||item.detail.bestMate||item.detail.kind==="miss"),
  traps:personalized.filter(item=>Number(item.detail.ply)<18&&["blunder","mistake","inaccuracy"].includes(item.detail.kind))
 };
 Object.entries(categories).forEach(([key,items])=>{const node=$("learn-count-"+key);if(node)node.textContent=items.length+" position"+(items.length>1?"s":"");});
 const errors=personalized.filter(item=>["blunder","mistake","inaccuracy"].includes(item.detail.kind));
 const renderRows=(items,rootId,buttonAttr)=>{const root=$(rootId);if(!root)return;root.innerHTML=items.length?items.slice(0,30).map((item,i)=>{const g=item.game,d=item.detail,username=String(window.CoachApp?.getUsername?.()||"").toLowerCase(),opponent=(g.white||"").toLowerCase()===username?g.black:g.white,date=g.date?new Date(g.date+"T12:00:00").toLocaleDateString("fr-FR"):"Date inconnue",priority=d.kind==="blunder"?"Gaffe":d.kind==="mistake"?"Erreur":d.kind==="inaccuracy"?"Imprécision":"Occasion manquée";return '<div class="personal-puzzle-row learn-personal-row"><div class="personal-puzzle-info"><strong>'+esc(priority)+' · '+esc(d.label||"Position à revoir")+'</strong><span>Contre '+esc(opponent||"Adversaire")+' · '+date+'</span><small>Ton coup : '+esc(d.played||"—")+' · Meilleure suite : '+esc(d.best||"—")+'</small></div><button type="button" class="secondary-button" '+buttonAttr+'="'+i+'">Travailler</button></div>';}).join(""):'<div class="empty-state compact">Aucune position de ce type dans tes parties analysées pour le moment. Continue à analyser tes parties : le coach alimentera cette rubrique automatiquement.</div>';};
 const category=categories[learnCategory]||categories.tactics;
 renderRows(errors,"learn-errors-list","data-learn-error-puzzle");
 learnVisibleItems=category;
 const errorCount=$("learn-errors-count");if(errorCount)errorCount.textContent=errors.length+" position(s)";
 const feedback=$("learn-training-feedback");if(feedback)feedback.textContent="Choisis un module pour lancer un exercice tiré de tes parties analysées.";
}
function startPersonalPuzzle(item,fromSession=false,fromLearn=false){
 if(!item?.detail?.fen||!item.detail.bestUci)return;
 if(fromLearn){
  learnExerciseMode=true;learnBackView=learnCurrentView;
  ["learn-hub","learn-training-choice","learn-errors-view","learn-training-exercise","learn-opening-choice","learn-opening-detected","learn-opening-explorer"].forEach(id=>{const node=$(id);if(node)node.hidden=id!=="learn-training-exercise";});
 }else{document.querySelector('[data-tab="puzzles"]')?.click();openPuzzleExercise();}
 if(!fromSession){sessionActive=false;sessionQueue=[];sessionTotal=0;sessionSolved=0;sessionMode="";stopPuzzleTimer();stopAutoNext();}
 currentPuzzle=item;board=new Chess(item.detail.fen);const pv=Array.isArray(item.detail.pvUci)?item.detail.pvUci:[];solution=[];const pvBoard=new Chess(item.detail.fen);for(const u of pv.slice(0,8)){const move=legalSolutionMove(pvBoard,u);if(!move)break;solution.push(u);pvBoard.move({from:move.from,to:move.to,promotion:move.promotion||"q"});}if(!solution.length)solution=[item.detail.bestUci];puzzleProgress.attempts++;savePuzzleProgress();ply=0;selected=null;hinted=false;solved=false;loading=false;
 orientation=board.turn()==="w"?"white":"black";
 if(!fromLearn){$("puzzle-title").textContent="À toi de corriger ce coup";$("puzzle-rating").textContent="Ton analyse";$("puzzle-themes").textContent="Partie contre "+((item.game.white||"").toLowerCase()===String(window.CoachApp?.getUsername?.()||"").toLowerCase()?item.game.black:item.game.white)+" · "+(item.detail.label||"Position à revoir");}
 else {const title=$("learn-exercise-title");if(title)title.textContent=learnCurrentView==="learn-errors-view"?"Corrige cette erreur":"À toi de jouer : "+lessonTheme(item).label;}
 message("Rejoue la meilleure suite de Stockfish et comprends pourquoi ton coup a laissé passer une meilleure idée.");
 render();
}

function startDailyPuzzle(){
 sessionMode="daily";sessionActive=true;sessionFinished=false;sessionSolved=0;sessionTotal=1;sessionQueue=[];sessionPuzzleIds=[];sessionLives=puzzleProgress.dailyDate===localDayKey()?puzzleProgress.dailyLives:5;dailyDecisionOpen=false;solutionRevealed=false;stopPuzzleTimer();stopAutoNext();openPuzzleExercise();loadDaily(false);
}
function startPuzzleMode(mode){
 sessionMode=mode;sessionActive=true;sessionFinished=false;sessionSolved=0;sessionTotal=0;sessionQueue=[];sessionPuzzleIds=[];sessionLives=3;dailyDecisionOpen=false;solutionRevealed=false;stopAutoNext();
 sessionLabel=mode==="lives"?"Survie · 3 vies":"Défi chronométré · 3 minutes";
 if(mode==="timed")startPuzzleTimer();else stopPuzzleTimer();openPuzzleExercise();loadDaily(true);
}
let lastErrorReviewId="";
function startErrorReviewSession(){
 personalized=personalCandidates();
 const errors=personalized.filter(item=>["blunder","mistake","inaccuracy"].includes(item.detail.kind));
 if(!errors.length){showLearnSubviewForErrors();return;}
 const shuffled=errors.slice().sort(()=>Math.random()-.5);
 if(shuffled.length>1&&shuffled[0].id===lastErrorReviewId){const swap=1+Math.floor(Math.random()*(shuffled.length-1));[shuffled[0],shuffled[swap]]=[shuffled[swap],shuffled[0]];}
 const selected=shuffled.slice(0,Math.min(5,shuffled.length));lastErrorReviewId=selected[0].id;
 learnCurrentView="learn-errors-view";learnExerciseMode=true;learnBackView="learn-errors-view";
 ["learn-hub","learn-training-choice","learn-errors-view","learn-training-exercise","learn-opening-choice","learn-opening-detected","learn-opening-explorer"].forEach(id=>{const node=$(id);if(node)node.hidden=id!=="learn-training-exercise";});
 sessionMode="adaptive";sessionLabel="Révision de tes erreurs";sessionActive=true;sessionFinished=false;sessionQueue=selected.slice(1);sessionTotal=selected.length;sessionSolved=0;sessionPuzzleIds=[];stopPuzzleTimer();stopAutoNext();
 startPersonalPuzzle(selected[0],true,true);
 message("Position 1 / "+sessionTotal+" · retrouve le meilleur coup dans une de tes parties.");
}
function showLearnSubviewForErrors(){
 ["learn-hub","learn-training-choice","learn-errors-view","learn-training-exercise","learn-opening-choice","learn-opening-detected","learn-opening-explorer"].forEach(id=>{const node=$(id);if(node)node.hidden=id!=="learn-errors-view";});
 renderLearnPersonalLists();
}
function startPuzzleSession(){
 sessionLabel="Suite de problèmes";
 const available=personalized.filter(item=>!puzzleProgress.personalSolved.includes(item.id));
 if(!available.length){sessionActive=false;sessionQueue=[];sessionTotal=0;sessionSolved=0;sessionMode="";message("Aucune position nouvelle pour le moment. Analyse quelques parties avec Stockfish pour créer ta première session personnalisée.");return;}
 sessionMode="adaptive";sessionFinished=false;stopPuzzleTimer();
 sessionQueue=available.slice(0,5);sessionTotal=sessionQueue.length;sessionSolved=0;sessionActive=true;
 loadNextSessionPuzzle();
}
function loadNextSessionPuzzle(){
 if(sessionQueue.length){const item=sessionQueue.shift();startPersonalPuzzle(item,true,learnExerciseMode);message(sessionLabel+" · position "+(sessionSolved+1)+" / "+sessionTotal+". Étudie l’explication, puis joue la meilleure suite.");return;}
 sessionActive=false;currentPuzzle=null;board=null;selected=null;solved=false;
 const area=$(learnExerciseMode?"learn-training-board-area":"puzzle-board-area");
 if(area)area.innerHTML='<div class="empty-state">Séance terminée. Tu as retravaillé '+sessionSolved+" position"+(sessionSolved>1?"s":"")+" sur "+sessionTotal+'. Tu peux relancer une séance pour revoir d’autres erreurs.</div><div class="puzzle-side-back"><button type="button" class="secondary-button" data-puzzle-back>← Retour</button></div>';
 message("Séance terminée !");renderPersonalized();
}
function play(square){
 if(!board||solved||loading||sessionFinished)return;const piece=board.get(square);
 if(!selected){if(piece&&piece.color===board.turn()){selected=square;render();}return;}
 if(piece&&piece.color===board.turn()){selected=square;render();return;}
 const move=board.moves({square:selected,verbose:true}).find(m=>m.to===square);if(!move){selected=null;message("Coup impossible : choisis une case indiquée par un point.");render();return;}
 const played=uci(move),expectedMove=legalSolutionMove(board,solution[ply]),expected=expectedMove?uci(expectedMove):"";
 if(played!==expected){selected=null;puzzleProgress.wrongMoves++;savePuzzleProgress();
  if(sessionMode==="lives"||sessionMode==="daily"){sessionLives=Math.max(0,sessionLives-1);if(sessionMode==="daily"){puzzleProgress.dailyDate=localDayKey();puzzleProgress.dailyLives=sessionLives;}if(sessionLives===0){sessionActive=false;sessionFinished=true;dailyDecisionOpen=sessionMode==="daily";stopPuzzleTimer();}message("Faux. Ce n'est pas le bon coup. Réessaye.");if(sessionMode==="daily")savePuzzleProgress();}
  else message("Faux. Ce n'est pas le bon coup. Réessaye.");
  render();return;
 }
 const playedMove=board.move({from:move.from,to:move.to,promotion:move.promotion||"q"});window.CoachSound?.play(playedMove);ply++;selected=null;hinted=false;
 if(ply>=solution.length){finishPuzzle();return;}
 loading=true;message("Bien joué ! L’adversaire réfléchit…");render();
 window.setTimeout(()=>{if(!board||solved)return;const reply=solution[ply];try{const replyMove=board.move({from:reply.slice(0,2),to:reply.slice(2,4),promotion:reply[4]});window.CoachSound?.play(replyMove);ply++;}catch{loading=false;finishPuzzle();return;}loading=false;hinted=false;if(ply>=solution.length)finishPuzzle();else message("Réponse de l’adversaire jouée. À toi de trouver la suite !");render();},560);
}
document.addEventListener("click",event=>{
 const mode=event.target.closest("[data-puzzle-mode]");
 if(mode){if(mode.dataset.puzzleMode==="daily")startDailyPuzzle();else if(mode.dataset.puzzleMode==="lives"||mode.dataset.puzzleMode==="timed")startPuzzleMode(mode.dataset.puzzleMode);else{openPuzzleExercise();if(mode.dataset.puzzleMode==="session"||mode.dataset.puzzleMode==="mistakes")startPuzzleSession();else if(mode.dataset.puzzleMode==="adaptive")startAdaptive();}return;}
 if(event.target.closest("[data-puzzle-back]")){closePuzzleExercise();return;}
 if(event.target.closest("[data-start-puzzle-session]")){startPuzzleSession();return;}
 const learnCategoryButton=event.target.closest("[data-learn-training-category]");if(learnCategoryButton){learnCategory=learnCategoryButton.dataset.learnTrainingCategory;renderLearnPersonalLists();document.querySelectorAll("[data-learn-training-category]").forEach(node=>node.classList.toggle("active",node===learnCategoryButton));const available=learnVisibleItems||[],unsolved=available.filter(item=>!puzzleProgress.personalSolved.includes(item.id)),chosen=unsolved[0]||available[0],feedback=$("learn-training-feedback");if(chosen){startPersonalPuzzle(chosen,false,true);}else if(feedback){feedback.textContent="Aucune position de ce thème n’a encore été repérée dans tes parties analysées. Analyse quelques parties supplémentaires et ce module se remplira automatiquement.";}return;}
 const learnPersonal=event.target.closest("[data-learn-personal-puzzle]");if(learnPersonal){startPersonalPuzzle(learnVisibleItems[Number(learnPersonal.dataset.learnPersonalPuzzle)],false,true);return;}
 const learnError=event.target.closest("[data-learn-error-puzzle]");if(learnError){const errors=personalized.filter(item=>["blunder","mistake","inaccuracy"].includes(item.detail.kind));startPersonalPuzzle(errors[Number(learnError.dataset.learnErrorPuzzle)],false,true);return;}
 if(event.target.closest("[data-session-restart]")){if(sessionMode==="lives"||sessionMode==="timed")startPuzzleMode(sessionMode);return;}
 if(event.target.closest("[data-daily-hint]")){dailyDecisionOpen=false;hinted=true;message("Indice : la pièce à jouer est en surbrillance. À toi de retrouver sa destination.");render();return;}
 if(event.target.closest("[data-daily-solution]")){dailyDecisionOpen=false;solutionRevealed=true;message("Voici la suite gagnante de cette position.");render();return;}
 const square=event.target.closest("[data-puzzle-square]");if(square){play(square.dataset.puzzleSquare);return;}
 if(event.target.closest("#puzzle-hint")){if(solution[ply]){hinted=true;message("Indice : observe la pièce en surbrillance, sans révéler sa destination.");render();}return;}
 const more=event.target.closest("[data-personal-puzzle-more]");if(more){showAllPersonal=!showAllPersonal;renderPersonalized();return;}
  const personal=event.target.closest("[data-personal-puzzle]");if(personal){startPersonalPuzzle(personalized[Number(personal.dataset.personalPuzzle)]);return;}
  if(event.target.closest("#puzzle-reload")){startAdaptive();}
});
window.addEventListener("coach:tab-changing",event=>{if(event.detail?.tab!=="puzzles"||event.detail?.fromPanel==="panel-puzzles")closePuzzleExercise();});
window.addEventListener("coach:games-updated",renderPersonalized);
window.addEventListener("coach:learn-personal-view",event=>{learnCurrentView=event.detail?.view||"learn-training-choice";renderLearnPersonalLists();});
window.addEventListener("coach:launch-error-session",startErrorReviewSession);
window.addEventListener("coach:account-changed",()=>{closePuzzleExercise();loadPuzzleProgress();renderPuzzleProgress();renderPersonalized();});
loadPuzzleProgress();renderPuzzleProgress();renderPersonalized();

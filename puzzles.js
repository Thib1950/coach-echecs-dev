import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const PROGRESS_KEY="coach-echecs-dev-puzzle-progress-v1";
let board=null,solution=[],ply=0,selected=null,orientation="white",hinted=false,solved=false,loading=false,currentPuzzle=null,currentDailyId="",personalized=[],showAllPersonal=false,sessionActive=false,sessionQueue=[],sessionTotal=0,sessionSolved=0;
let puzzleProgress={dailySolved:[],personalSolved:[],attempts:0,wrongMoves:0};
let puzzleFeedbackText="Repère la meilleure suite pour les Blancs ou les Noirs.",puzzleFeedbackClass="feedback-neutral";
function loadPuzzleProgress(){try{const p=JSON.parse(localStorage.getItem(PROGRESS_KEY)||"{}");puzzleProgress={dailySolved:Array.isArray(p.dailySolved)?p.dailySolved:[],personalSolved:Array.isArray(p.personalSolved)?p.personalSolved:[],attempts:Number(p.attempts)||0,wrongMoves:Number(p.wrongMoves)||0};}catch{}}
function savePuzzleProgress(){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(puzzleProgress));}catch{}renderPuzzleProgress();}
function renderPuzzleProgress(){const node=$("puzzle-progress");const total=puzzleProgress.dailySolved.length+puzzleProgress.personalSolved.length;if(node)node.textContent=total+" résolu"+(total>1?"s":"")+" · "+puzzleProgress.attempts+" tentative"+(puzzleProgress.attempts>1?"s":"")+" · "+puzzleProgress.wrongMoves+" erreur"+(puzzleProgress.wrongMoves>1?"s":"");const solved=$("puzzle-hub-solved"),attempts=$("puzzle-hub-attempts"),errors=$("puzzle-hub-errors");if(solved)solved.textContent=String(total);if(attempts)attempts.textContent=String(puzzleProgress.attempts);if(errors)errors.textContent=String(puzzleProgress.wrongMoves);}
function openPuzzleExercise(){const hub=$("puzzle-hub"),exercise=$("puzzle-exercise");if(hub)hub.hidden=true;if(exercise)exercise.hidden=false;$("panel-puzzles")?.classList.add("puzzle-exercise-active");}
function closePuzzleExercise(){const hub=$("puzzle-hub"),exercise=$("puzzle-exercise");if(exercise)exercise.hidden=true;if(hub)hub.hidden=false;$("panel-puzzles")?.classList.remove("puzzle-exercise-active");}
function personalKey(game,detail){return String(game.id)+"|"+detail.fen+"|"+detail.bestUci;}
function markPuzzleSolved(){const key=currentPuzzle?personalKey(currentPuzzle.game,currentPuzzle.detail):currentDailyId;if(!key)return;const list=currentPuzzle?puzzleProgress.personalSolved:puzzleProgress.dailySolved;if(!list.includes(key)){list.push(key);savePuzzleProgress();}else renderPuzzleProgress();renderPersonalized();}
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
function render(){
 if(!board)return;
 const files=orientation==="white"?"abcdefgh":"hgfedcba",ranks=orientation==="white"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
 const legal=selected?board.moves({square:selected,verbose:true}):[],targets=new Map(legal.map(m=>[m.to,m.captured?"capture":"move"]));
 let cells="";
 ranks.forEach(rank=>[...files].forEach(file=>{const sq=file+rank,p=board.get(sq),light=((rank-1+(file.charCodeAt(0)-97))%2)===1;let cls="puzzle-square "+(light?"light":"dark")+(selected===sq?" selected":"")+(targets.get(sq)==="capture"?" puzzle-capture":"");const dot=targets.get(sq)==="move"?'<i class="puzzle-dot"></i>':"";cells+='<button type="button" class="'+cls+'" data-puzzle-square="'+sq+'" aria-label="'+sq+'">'+(p?'<img src="https://lichess1.org/assets/piece/cburnett/'+p.color+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':"")+dot+'</button>';}));
 const sessionAction=sessionActive&&solved?'<button type="button" class="primary-button" data-session-next>'+(sessionQueue.length?"Puzzle suivant →":"Terminer la session")+'</button>':"";
 let hintArrow="";
 if(hinted&&legalSolutionMove(board,solution[ply])){
  const hintMove=legalSolutionMove(board,solution[ply]),from=hintMove.from,to=hintMove.to;
  const coord=sq=>{const file=sq.charCodeAt(0)-97,rank=Number(sq[1]);const col=orientation==="white"?file:7-file,row=orientation==="white"?8-rank:rank-1;return {x:col*100+50,y:row*100+50};};
  const a=coord(from),b=coord(to);
  hintArrow='<svg class="puzzle-hint-arrow" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="puzzleHintHead" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#f5b942" stroke-width="1.4"/></marker></defs><line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#f5b942" stroke-width="13" stroke-linecap="round" opacity=".94" marker-end="url(#puzzleHintHead)"/></svg>';
 }
 const sideToMove=board.turn()==="w"?"Trait aux Blancs":"Trait aux Noirs";
  const panel='<aside class="puzzle-side"><div class="puzzle-turn-indicator '+(board.turn()==="w"?"white-turn":"black-turn")+'"><span class="turn-dot"></span>'+sideToMove+'</div><strong>'+(solved?"Problème résolu !":currentPuzzle?"Position issue de ta partie":"À toi de jouer")+'</strong><p>'+(solved?(currentPuzzle?"Dans ta partie, tu avais joué "+currentPuzzle.detail.played+". Le meilleur coup était "+(currentPuzzle.detail.best||"celui que tu viens de trouver")+".":"Bravo, tu as trouvé la suite tactique."):(hinted&&legalSolutionMove(board,solution[ply])?"Indice : joue "+legalSolutionMove(board,solution[ply]).from+" vers "+legalSolutionMove(board,solution[ply]).to+".":"Trouve le meilleur coup. Les points indiquent les déplacements légaux."))+'</p><div class="puzzle-feedback-stage"><p id="puzzle-feedback" aria-live="polite" class="'+puzzleFeedbackClass+'">'+esc(puzzleFeedbackText)+'</p></div><small>'+(sessionActive?"Session personnalisée · "+sessionSolved+" / "+sessionTotal+" réussis":currentPuzzle?"Exercice construit à partir de ton analyse Stockfish.":"Ton objectif : trouver toute la combinaison, pas seulement le premier coup.")+'</small><div class="puzzle-side-actions"><button type="button" class="secondary-button" id="puzzle-hint">Indice</button><button type="button" class="primary-button" id="puzzle-reload">Puzzle suivant</button><button type="button" class="secondary-button" data-start-puzzle-session>Session personnalisée</button></div>'+sessionAction+'</aside>';
 $("puzzle-board-area").innerHTML='<div class="puzzle-board-wrap"><div class="puzzle-board">'+cells+'</div>'+hintArrow+'</div>'+panel;
}
function message(text){puzzleFeedbackText=String(text??"");puzzleFeedbackClass=/^Faux\s*!/i.test(puzzleFeedbackText)?"feedback-wrong":/^(Bravo|Bien joué)/i.test(puzzleFeedbackText)?"feedback-correct":"feedback-neutral";const node=$("puzzle-feedback");if(!node)return;node.textContent=puzzleFeedbackText;node.classList.remove("feedback-wrong","feedback-correct","feedback-neutral");node.classList.add(puzzleFeedbackClass);}

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
async function loadLocalDailyPuzzle(randomize=false){
 const bands=[1200,1300,1400,1500,1600,1700];
 const day=Math.floor(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate())/86400000);
 const band=bands[randomize?Math.floor(Math.random()*bands.length):day%bands.length];
 const rows=await getLocalPuzzleBucket(band);
 // Shuffle a short sample and skip any corrupt row rather than failing the whole session.
 const startAt=randomize?Math.floor(Math.random()*rows.length):Math.abs((day*2654435761)%rows.length);
 let lastError=null;
 for(let n=0;n<Math.min(24,rows.length);n++){
  try{return puzzleFromLocalRow(rows[(startAt+n)%rows.length]);}
  catch(error){lastError=error;}
 }
 throw lastError||new Error("Aucun puzzle exploitable dans cette banque.");
}
async function loadDaily(randomize=false){
 if(loading)return;loading=true;currentPuzzle=null;sessionActive=false;sessionQueue=[];sessionTotal=0;sessionSolved=0;board=null;
 $("puzzle-board-area").innerHTML='<div class="empty-state">Chargement de la banque tactique…</div>';
 message("Chargement des puzzles intégrés à l’application…");
 try{
  const data=await loadLocalDailyPuzzle(randomize);
  solution=data.solution;currentDailyId=data.id;
  board=new Chess(data.fen);selected=null;hinted=false;solved=false;
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
  message(puzzleProgress.dailySolved.includes(currentDailyId)?"Tu as déjà résolu ce puzzle. Tu peux le refaire pour t’entraîner.":"Puzzle chargé. À toi de trouver la combinaison !");
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
  const side=(game.white||"").toLowerCase()==="gone_1950"?"w":(game.black||"").toLowerCase()==="gone_1950"?"b":"";
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
 const root=$("personal-puzzle-list"),count=$("personal-puzzle-count");if(!root||!count)return;
 personalized=personalCandidates();
 count.textContent=personalized.length+" position"+(personalized.length>1?"s":"");
 if(!personalized.length){
  root.innerHTML='<div class="empty-state compact">Aucun exercice pour le moment. Lance l’analyse Stockfish de tes parties : les erreurs et occasions manquées deviendront des puzzles à résoudre.</div>';
  return;
 }
 root.innerHTML=personalized.slice(0,showAllPersonal?personalized.length:8).map((item,i)=>{
  const g=item.game,d=item.detail,opponent=(g.white||"").toLowerCase()==="gone_1950"?g.black:g.white;
  const date=g.date?new Date(g.date+"T12:00:00").toLocaleDateString("fr-FR"):"Date inconnue";
  const done=puzzleProgress.personalSolved.includes(item.id);
  return '<div class="personal-puzzle-row"><div class="personal-puzzle-info"><strong>'+esc(d.label||"Coup à revoir")+(done?' <span class="puzzle-solved-mark">✓ Résolu</span>':'')+'</strong><span>Contre '+esc(opponent||"Adversaire")+' · '+date+'</span><small>Tu as joué '+esc(d.played||"—")+' · meilleure suite : '+esc(d.best||"—")+'</small></div><button type="button" class="secondary-button" data-personal-puzzle="'+i+'">'+(done?"Refaire":"S’entraîner")+'</button></div>';
 }).join("");
 if(personalized.length>8){const more=document.createElement("button");more.type="button";more.className="text-button personal-puzzle-more";more.dataset.personalPuzzleMore="";more.textContent=showAllPersonal?"Réduire la liste":"Voir toutes les positions ("+personalized.length+")";root.appendChild(more);}
}
function startPersonalPuzzle(item,fromSession=false){
 if(!item?.detail?.fen||!item.detail.bestUci)return;
 openPuzzleExercise();
 if(!fromSession){sessionActive=false;sessionQueue=[];sessionTotal=0;sessionSolved=0;}
 currentPuzzle=item;board=new Chess(item.detail.fen);solution=[item.detail.bestUci];puzzleProgress.attempts++;savePuzzleProgress();ply=0;selected=null;hinted=false;solved=false;loading=false;
 orientation=board.turn()==="w"?"white":"black";
 $("puzzle-title").textContent="À toi de corriger ce coup";
 $("puzzle-rating").textContent="Ton analyse";
 $("puzzle-themes").textContent="Partie contre "+((item.game.white||"").toLowerCase()==="gone_1950"?item.game.black:item.game.white)+" · "+(item.detail.label||"Position à revoir");
 message("Retrouve le meilleur coup dans cette position de ta partie.");
 render();
 document.querySelector('[data-tab="puzzles"]')?.click();
}

function startPuzzleSession(){
 const available=personalized.filter(item=>!puzzleProgress.personalSolved.includes(item.id));
 if(!available.length){sessionActive=false;sessionQueue=[];sessionTotal=0;sessionSolved=0;message("Aucune position nouvelle pour le moment. Analyse quelques parties avec Stockfish pour créer ta première session personnalisée.");return;}
 sessionQueue=available.slice(0,5);sessionTotal=sessionQueue.length;sessionSolved=0;sessionActive=true;
 loadNextSessionPuzzle();
}
function loadNextSessionPuzzle(){
 if(sessionQueue.length){const item=sessionQueue.shift();startPersonalPuzzle(item,true);message("Session personnalisée · position "+(sessionSolved+1)+" / "+sessionTotal+". Trouve le meilleur coup.");return;}
 sessionActive=false;currentPuzzle=null;board=null;selected=null;solved=false;
 $("puzzle-board-area").innerHTML='<div class="empty-state">Session terminée. Tu as résolu '+sessionSolved+" position"+(sessionSolved>1?"s":"")+" sur "+sessionTotal+'. Tu peux lancer une nouvelle session après avoir analysé d’autres parties.</div>';
 message("Bravo, ta session est terminée !");renderPersonalized();
}
function play(square){
 if(!board||solved||loading)return;const piece=board.get(square);
 if(!selected){if(piece&&piece.color===board.turn()){selected=square;render();}return;}
 if(piece&&piece.color===board.turn()){selected=square;render();return;}
 const move=board.moves({square:selected,verbose:true}).find(m=>m.to===square);if(!move){selected=null;message("Coup impossible : choisis une case indiquée par un point.");render();return;}
 const played=uci(move),expectedMove=legalSolutionMove(board,solution[ply]),expected=expectedMove?uci(expectedMove):"";
 if(played!==expected){selected=null;puzzleProgress.wrongMoves++;savePuzzleProgress();message("Faux ! Ce n’est pas le bon coup. Réessaie, la position n’a pas changé.");render();return;}
 board.move({from:move.from,to:move.to,promotion:move.promotion||"q"});ply++;selected=null;
 if(ply>=solution.length){solved=true;markPuzzleSolved();if(sessionActive)sessionSolved++;message(currentPuzzle?"Bravo ! Tu as trouvé le meilleur coup de cette position.":"Bravo ! Tu as terminé toute la combinaison.");render();return;}
 loading=true;message("Bien joué ! L’adversaire réfléchit…");render();
 window.setTimeout(()=>{
  if(!board||solved)return;
  const reply=solution[ply];try{board.move({from:reply.slice(0,2),to:reply.slice(2,4),promotion:reply[4]});ply++;}catch{solved=true;}
  loading=false;
  if(ply>=solution.length){solved=true;markPuzzleSolved();if(sessionActive)sessionSolved++;message("Bravo ! Tu as terminé toute la combinaison.");}
  else message("Réponse de l’adversaire jouée. À toi de trouver la suite !");
  render();
 },560);
}
document.addEventListener("click",event=>{
 const mode=event.target.closest("[data-puzzle-mode]");
 if(mode){openPuzzleExercise();if(mode.dataset.puzzleMode==="session"||mode.dataset.puzzleMode==="mistakes")startPuzzleSession();else loadDaily(mode.dataset.puzzleMode==="adaptive");return;}
 if(event.target.closest("[data-puzzle-back]")){closePuzzleExercise();return;}
 if(event.target.closest("[data-start-puzzle-session]")){startPuzzleSession();return;}
 if(event.target.closest("[data-session-next]")){loadNextSessionPuzzle();return;}
 const square=event.target.closest("[data-puzzle-square]");if(square){play(square.dataset.puzzleSquare);return;}
 if(event.target.closest("#puzzle-hint")){if(solution[ply]){hinted=true;message("Indice affiché sur le panneau du puzzle.");render();}return;}
 const more=event.target.closest("[data-personal-puzzle-more]");if(more){showAllPersonal=!showAllPersonal;renderPersonalized();return;}
  const personal=event.target.closest("[data-personal-puzzle]");if(personal){startPersonalPuzzle(personalized[Number(personal.dataset.personalPuzzle)]);return;}
  if(event.target.closest("#puzzle-reload"))loadDaily(true);
});
window.addEventListener("coach:games-updated",renderPersonalized);
loadPuzzleProgress();renderPuzzleProgress();renderPersonalized();

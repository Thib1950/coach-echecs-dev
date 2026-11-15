import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const PROGRESS_KEY="coach-echecs-dev-puzzle-progress-v1";
let board=null,solution=[],ply=0,selected=null,orientation="white",hinted=false,solved=false,loading=false,currentPuzzle=null,currentDailyId="",personalized=[],showAllPersonal=false,sessionActive=false,sessionQueue=[],sessionTotal=0,sessionSolved=0;
let puzzleProgress={dailySolved:[],personalSolved:[],attempts:0,wrongMoves:0};
function loadPuzzleProgress(){try{const p=JSON.parse(localStorage.getItem(PROGRESS_KEY)||"{}");puzzleProgress={dailySolved:Array.isArray(p.dailySolved)?p.dailySolved:[],personalSolved:Array.isArray(p.personalSolved)?p.personalSolved:[],attempts:Number(p.attempts)||0,wrongMoves:Number(p.wrongMoves)||0};}catch{}}
function savePuzzleProgress(){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(puzzleProgress));}catch{}renderPuzzleProgress();}
function renderPuzzleProgress(){const node=$("puzzle-progress");if(!node)return;const total=puzzleProgress.dailySolved.length+puzzleProgress.personalSolved.length;node.textContent=total+" résolu"+(total>1?"s":"")+" · "+puzzleProgress.attempts+" tentative"+(puzzleProgress.attempts>1?"s":"")+" · "+puzzleProgress.wrongMoves+" erreur"+(puzzleProgress.wrongMoves>1?"s":"");}
function personalKey(game,detail){return String(game.id)+"|"+detail.fen+"|"+detail.bestUci;}
function markPuzzleSolved(){const key=currentPuzzle?personalKey(currentPuzzle.game,currentPuzzle.detail):currentDailyId;if(!key)return;const list=currentPuzzle?puzzleProgress.personalSolved:puzzleProgress.dailySolved;if(!list.includes(key)){list.push(key);savePuzzleProgress();}else renderPuzzleProgress();renderPersonalized();}
function uci(move){return move.from+move.to+(move.promotion||"");}
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
 if(hinted&&solution[ply]){
  const from=solution[ply].slice(0,2),to=solution[ply].slice(2,4);
  const coord=sq=>{const file=sq.charCodeAt(0)-97,rank=Number(sq[1]);const col=orientation==="white"?file:7-file,row=orientation==="white"?8-rank:rank-1;return {x:col*100+50,y:row*100+50};};
  const a=coord(from),b=coord(to);
  hintArrow='<svg class="puzzle-hint-arrow" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="puzzleHintHead" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#f5b942" stroke-width="1.4"/></marker></defs><line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#f5b942" stroke-width="13" stroke-linecap="round" opacity=".94" marker-end="url(#puzzleHintHead)"/></svg>';
 }
 const sideToMove=board.turn()==="w"?"Trait aux Blancs":"Trait aux Noirs";
  const panel='<aside class="puzzle-side"><div class="puzzle-turn-indicator '+(board.turn()==="w"?"white-turn":"black-turn")+'"><span class="turn-dot"></span>'+sideToMove+'</div><strong>'+(solved?"Problème résolu !":currentPuzzle?"Position issue de ta partie":"À toi de jouer")+'</strong><p>'+(solved?(currentPuzzle?"Dans ta partie, tu avais joué "+currentPuzzle.detail.played+". Le meilleur coup était "+(currentPuzzle.detail.best||"celui que tu viens de trouver")+".":"Bravo, tu as trouvé la suite tactique."):(hinted&&solution[ply]?"Indice : cherche à jouer "+solution[ply].slice(0,2)+" vers "+solution[ply].slice(2,4)+".":"Trouve le meilleur coup. Les points indiquent les déplacements légaux."))+'</p><small>'+(sessionActive?"Session personnalisée · "+sessionSolved+" / "+sessionTotal+" réussis":currentPuzzle?"Exercice construit à partir de ton analyse Stockfish.":"Ton objectif : trouver toute la combinaison, pas seulement le premier coup.")+'</small>'+sessionAction+'</aside>';
 $("puzzle-board-area").innerHTML='<div class="puzzle-board-wrap"><div class="puzzle-board">'+cells+'</div>'+hintArrow+'</div>'+panel;
}
function message(text){$("puzzle-feedback").textContent=text;}
async function loadDaily(){
 if(loading)return;loading=true;currentPuzzle=null;sessionActive=false;sessionQueue=[];sessionTotal=0;sessionSolved=0;board=null;$("puzzle-board-area").innerHTML='<div class="empty-state">Chargement du puzzle du jour…</div>';message("Connexion à la base publique de puzzles Lichess…");
 try{
  const response=await fetch("https://lichess.org/api/puzzle/daily",{headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Lichess a répondu HTTP "+response.status);
  const data=await response.json();solution=data.puzzle?.solution||[];currentDailyId=String(data.puzzle?.id||"");if(!solution.length||!data.game?.pgn)throw new Error("Le puzzle reçu est incomplet.");
  board=loadPosition(data.game.pgn,Number(data.puzzle.initialPly)||0);ply=0;selected=null;hinted=false;solved=false;orientation=board.turn()==="w"?"white":"black";puzzleProgress.attempts++;savePuzzleProgress();
  $("puzzle-title").textContent="Puzzle du jour · "+data.puzzle.id;
  $("puzzle-rating").textContent=(data.puzzle.rating||"—")+" Elo";
  $("puzzle-themes").textContent="Thèmes : "+(data.puzzle.themes||[]).join(" · ");
  message(puzzleProgress.dailySolved.includes(currentDailyId)?"Tu as déjà résolu le puzzle du jour. Tu peux le refaire pour t’entraîner.":"Puzzle chargé. À toi de trouver la combinaison !");
  render();renderPersonalized();renderPuzzleProgress();
 }catch(error){$("puzzle-title").textContent="Puzzle indisponible";$("puzzle-board-area").innerHTML='<div class="empty-state">Impossible de charger le puzzle : '+esc(error.message)+'. Vérifie ta connexion puis réessaie.</div>';message("Le problème tactique n’a pas pu être chargé.");}
 finally{loading=false;}
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
 const move=board.moves({square:selected,verbose:true}).find(m=>m.to===square);if(!move){selected=null;render();return;}
 const played=uci(move),expected=solution[ply];
 if(played!==expected){selected=null;puzzleProgress.wrongMoves++;savePuzzleProgress();message("Ce coup est légal, mais il ne résout pas le problème. Cherche une autre idée.");render();return;}
 board.move({from:move.from,to:move.to,promotion:move.promotion||"q"});ply++;selected=null;
 if(ply>=solution.length){solved=true;markPuzzleSolved();if(sessionActive)sessionSolved++;message(currentPuzzle?"Bien joué ! Tu as trouvé le coup que Stockfish recommandait dans ta partie.":"Bravo ! Tu as trouvé toute la combinaison.");render();return;}
 const reply=solution[ply];try{board.move({from:reply.slice(0,2),to:reply.slice(2,4),promotion:reply[4]});ply++;}catch{solved=true;}
 if(ply>=solution.length){solved=true;markPuzzleSolved();if(sessionActive)sessionSolved++;message("Bravo ! Tu as trouvé toute la combinaison.");}else message("Bien joué. La réponse adverse est jouée : trouve le prochain coup.");
 render();
}
document.addEventListener("click",event=>{
 if(event.target.closest("[data-start-puzzle-session]")){startPuzzleSession();return;}
 if(event.target.closest("[data-session-next]")){loadNextSessionPuzzle();return;}
 const square=event.target.closest("[data-puzzle-square]");if(square){play(square.dataset.puzzleSquare);return;}
 if(event.target.closest("#puzzle-hint")){if(solution[ply]){hinted=true;message("Indice affiché sur le panneau du puzzle.");render();}return;}
 const more=event.target.closest("[data-personal-puzzle-more]");if(more){showAllPersonal=!showAllPersonal;renderPersonalized();return;}
  const personal=event.target.closest("[data-personal-puzzle]");if(personal){startPersonalPuzzle(personalized[Number(personal.dataset.personalPuzzle)]);return;}
  if(event.target.closest("#puzzle-reload"))loadDaily();
});
window.addEventListener("coach:games-updated",renderPersonalized);
loadPuzzleProgress();renderPuzzleProgress();renderPersonalized();
loadDaily();

import { Chess } from "./chess-lib.js";
const $=id=>document.getElementById(id);
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
let lesson=null;
function sortedIssues(){
 const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===$("analysis-game-select")?.value);
 return (game?.analysis?.moves||[]).filter(m=>m.kind!=="good").sort((a,b)=>b.loss-a.loss);
}
function attachLessonButtons(){
 const cards=$("analysis-results")?.querySelectorAll(".analysis-move");
 if(!cards?.length)return;
 cards.forEach((card,i)=>{
  if(card.querySelector(".lesson-launch"))return;
  const button=document.createElement("button");
  button.className="lesson-launch";button.textContent="Faire cette leçon →";
  button.addEventListener("click",()=>openLesson(sortedIssues()[i]));
  card.querySelector("div")?.appendChild(button);
 });
}
function openLesson(move){
 if(!move?.fen||!move?.bestUci){$("lesson-area").innerHTML='<div class="empty-state">Relance l’analyse de cette partie pour préparer cette leçon.</div>';return;}
 lesson={move,fen:move.fen,selected:null,done:false};
 draw("Sélectionne une pièce puis sa case d’arrivée.");
 $("lesson-area").scrollIntoView({behavior:"smooth",block:"start"});
}
function draw(message){
 const m=lesson.move,board=new Chess(lesson.fen).board(),rows=m.color==="w"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cols=m.color==="w"?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
 let squares="";
 rows.forEach(r=>cols.forEach(f=>{
  const sq=String.fromCharCode(97+f)+(8-r),p=board[r][f];
  squares+='<button type="button" class="chess-square '+(((r+f)%2)?"light":"dark")+(lesson.selected===sq?" selected":"")+'" data-square="'+sq+'">'+(p?'<span class="piece">'+glyph[p.color+p.type]+'</span>':'')+'</button>';
 }));
 $("lesson-area").innerHTML='<article class="lesson-card"><div class="lesson-heading"><div><p class="eyebrow">LEÇON PERSONNALISÉE</p><h3>À toi de trouver le meilleur coup</h3><p>Tu joues les '+(m.color==="w"?"Blancs":"Noirs")+'. Dans ta partie, tu avais joué '+m.played+'.</p></div><span class="move-tag '+m.kind+'">'+m.label+'</span></div><div class="lesson-layout"><div class="chess-board">'+squares+'</div><div class="lesson-side"><strong>Quelle est la meilleure suite ?</strong><div class="lesson-feedback">'+message+'</div><button type="button" class="secondary-button" id="lesson-best">Afficher le meilleur coup</button><button type="button" class="text-button" id="lesson-close">Fermer la leçon</button></div></div></article>';
 $("lesson-area").querySelectorAll("[data-square]").forEach(b=>b.addEventListener("click",()=>playSquare(b.dataset.square)));
 $("lesson-best").addEventListener("click",showBest);
 $("lesson-close").addEventListener("click",()=>{$("lesson-area").innerHTML="";lesson=null;});
}
function playSquare(sq){
 if(!lesson||lesson.done)return;
 const b=new Chess(lesson.fen),p=b.get(sq),side=lesson.move.color;
 if(!lesson.selected){if(p?.color===side){lesson.selected=sq;draw("Choisis maintenant la case d’arrivée.");}return;}
 if(p?.color===side){lesson.selected=sq;draw("Pièce sélectionnée. Choisis sa destination.");return;}
 const from=lesson.selected,move=b.moves({square:from,verbose:true}).find(x=>x.to===sq);
 if(!move){lesson.selected=null;draw("Ce coup n’est pas légal. Essaie une autre destination.");return;}
 const uci=move.from+move.to+(move.promotion||"");
 if(uci===lesson.move.bestUci){
  const playedMove=b.move({from:move.from,to:move.to,promotion:move.promotion});window.CoachSound?.play(playedMove);lesson.fen=b.fen();lesson.done=true;
  draw("Bravo ! C’est le meilleur coup indiqué par Stockfish : "+lesson.move.best+". Tu as trouvé la correction.");
 }else{lesson.selected=null;draw("Coup légal, mais ce n’est pas le meilleur. Cherche les échecs, les captures et les menaces.");}
}
function showBest(){
 const u=lesson.move.bestUci,b=new Chess(lesson.fen);
 try{const playedMove=b.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||"q"});window.CoachSound?.play(playedMove);lesson.fen=b.fen();lesson.done=true;draw("Le meilleur coup était "+lesson.move.best+". Observe la position obtenue et demande-toi ce qu’il menace.");}
 catch{draw("Le meilleur coup n’a pas pu être affiché dans cette position.");}
}
window.CoachLessons={openForGameMove(gameId,moveIndex){
 const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===String(gameId));
 const move=game?.analysis?.moves?.[Number(moveIndex)];
 if(!move){$("lesson-area").innerHTML='<div class="empty-state">Analyse d’abord cette partie pour créer les exercices.</div>';return;}
 openLesson(move);
}};
window.addEventListener("coach:account-changed",()=>{lesson=null;if($("lesson-area"))$("lesson-area").innerHTML="";});
const target=$("analysis-results");
if(target)new MutationObserver(attachLessonButtons).observe(target,{childList:true,subtree:true});
attachLessonButtons();

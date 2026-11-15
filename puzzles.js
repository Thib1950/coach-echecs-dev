import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
let board=null,solution=[],ply=0,selected=null,orientation="white",hinted=false,solved=false,loading=false;
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
 const panel='<aside class="puzzle-side"><strong>'+(solved?"Problème résolu !":"À toi de jouer")+'</strong><p>'+(solved?"Bravo, tu as trouvé la suite tactique.":hinted&&solution[ply]?"Indice : cherche à jouer "+solution[ply].slice(0,2)+" vers "+solution[ply].slice(2,4)+".":"Trouve le meilleur coup. Les points indiquent les déplacements légaux.")+'</p><small>Ton objectif : trouver toute la combinaison, pas seulement le premier coup.</small></aside>';
 $("puzzle-board-area").innerHTML='<div class="puzzle-board">'+cells+'</div>'+panel;
}
function message(text){$("puzzle-feedback").textContent=text;}
async function loadDaily(){
 if(loading)return;loading=true;board=null;$("puzzle-board-area").innerHTML='<div class="empty-state">Chargement du puzzle du jour…</div>';message("Connexion à la base publique de puzzles Lichess…");
 try{
  const response=await fetch("https://lichess.org/api/puzzle/daily",{headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Lichess a répondu HTTP "+response.status);
  const data=await response.json();solution=data.puzzle?.solution||[];if(!solution.length||!data.game?.pgn)throw new Error("Le puzzle reçu est incomplet.");
  board=loadPosition(data.game.pgn,Number(data.puzzle.initialPly)||0);ply=0;selected=null;hinted=false;solved=false;orientation=board.turn()==="w"?"white":"black";
  $("puzzle-title").textContent="Puzzle du jour · "+data.puzzle.id;
  $("puzzle-rating").textContent=(data.puzzle.rating||"—")+" Elo";
  $("puzzle-themes").textContent="Thèmes : "+(data.puzzle.themes||[]).join(" · ");
  message("Puzzle chargé. À toi de trouver la combinaison !");
  render();
 }catch(error){$("puzzle-title").textContent="Puzzle indisponible";$("puzzle-board-area").innerHTML='<div class="empty-state">Impossible de charger le puzzle : '+esc(error.message)+'. Vérifie ta connexion puis réessaie.</div>';message("Le problème tactique n’a pas pu être chargé.");}
 finally{loading=false;}
}
function play(square){
 if(!board||solved||loading)return;const piece=board.get(square);
 if(!selected){if(piece&&piece.color===board.turn()){selected=square;render();}return;}
 if(piece&&piece.color===board.turn()){selected=square;render();return;}
 const move=board.moves({square:selected,verbose:true}).find(m=>m.to===square);if(!move){selected=null;render();return;}
 const played=uci(move),expected=solution[ply];
 if(played!==expected){selected=null;message("Ce coup est légal, mais il ne résout pas le problème. Cherche une autre idée.");render();return;}
 board.move({from:move.from,to:move.to,promotion:move.promotion||"q"});ply++;selected=null;
 if(ply>=solution.length){solved=true;message("Bravo ! Tu as trouvé toute la combinaison.");render();return;}
 const reply=solution[ply];try{board.move({from:reply.slice(0,2),to:reply.slice(2,4),promotion:reply[4]});ply++;}catch{solved=true;}
 if(ply>=solution.length){solved=true;message("Bravo ! Tu as trouvé toute la combinaison.");}else message("Bien joué. La réponse adverse est jouée : trouve le prochain coup.");
 render();
}
document.addEventListener("click",event=>{
 const square=event.target.closest("[data-puzzle-square]");if(square){play(square.dataset.puzzleSquare);return;}
 if(event.target.closest("#puzzle-hint")){if(solution[ply]){hinted=true;message("Indice affiché sur le panneau du puzzle.");render();}return;}
 if(event.target.closest("#puzzle-reload"))loadDaily();
});
loadDaily();

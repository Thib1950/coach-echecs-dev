import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let active=null,moves=[],index=0,analysisMoves=[],activeAnalysisMove=null,variationIndex=0;
let ecoOpeningPromise=null;
let freeBoard=null,freeStartFen="",freeSelected=null,freeRedo=[],freeAnalysis=null,freeAnalysisError="",freeLastMove="",freeAnalysisSeq=0;
const manualHighlights=new Set();
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
function arrow(from,to,color,dashed=false){
 if(!from||!to)return "";
 const x1=(from.charCodeAt(0)-96)*12.5-6.25,y1=(8-Number(from[1]))*12.5+6.25;
 const x2=(to.charCodeAt(0)-96)*12.5-6.25,y2=(8-Number(to[1]))*12.5+6.25;
 return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="1.35" stroke-linecap="round" opacity=".95" '+(dashed?'stroke-dasharray="3 2"':'')+' marker-end="url(#'+(dashed?'playedArrow':'bestArrow')+')" />';
}
function formatEval(cp){
 if(cp==null||!Number.isFinite(Number(cp)))return "—";
 cp=Number(cp);if(Math.abs(cp)>=9990)return cp>0?"+M":"−M";
 const value=(cp/100).toFixed(1);return cp>0?"+"+value:value.replace("-","−");
}
function frenchOpeningName(name){return String(name||"").replace(/London System/gi,"Système de Londres").replace(/Jobava London/gi,"Londres Jobava").replace(/French Defense/gi,"Défense française").replace(/Sicilian Defense/gi,"Défense sicilienne").replace(/Caro-Kann Defense/gi,"Défense Caro-Kann").replace(/King's Indian Defense/gi,"Défense est-indienne").replace(/Queen's Gambit/gi,"Gambit dame").replace(/King's Gambit/gi,"Gambit roi").replace(/Ruy Lopez/gi,"Partie espagnole").replace(/Italian Game/gi,"Partie italienne").replace(/Advanced Variation/gi,"Variante d’avance").replace(/Variation/gi,"Variante").replace(/Defense/gi,"Défense").replace(/Opening/gi,"Ouverture");}
function ensureOpeningName(game){
 if(!game||String(game.opening||"").trim()||game.displayOpening||!game.eco)return;
 if(game._openingLookup)return;game._openingLookup=true;
 if(!ecoOpeningPromise)ecoOpeningPromise=Promise.all(["a","b","c","d","e"].map(async letter=>{const response=await fetch("https://raw.githubusercontent.com/lichess-org/chess-openings/master/"+letter+".tsv");if(!response.ok)throw new Error("Base ECO indisponible");return response.text();})).then(files=>{const map={};for(const file of files)for(const line of file.split(/\r?\n/)){const [eco,name]=line.split("\t");if(eco&&name&&eco.toLowerCase()!=="eco"&&!map[eco])map[eco]=name;}return map;});
 ecoOpeningPromise.then(map=>{const name=map[String(game.eco).toUpperCase()];if(name){game.displayOpening=frenchOpeningName(name);if(active===game)render();}}).catch(()=>{});
}
function coachMessage(detail){
 if(!detail)return {title:"Position en cours",body:"Je vérifie les possibilités de cette position. Le meilleur coup et son idée apparaîtront ici.",tip:""};
 const userSide=((active?.white||"").toLowerCase()===String(window.CoachApp?.getUsername?.()||"").toLowerCase()?"w":"b");
 const openingName=frenchOpeningName(active?.opening||active?.displayOpening||"").trim();
 if(openingName&&Number(detail.ply)<=5){
  const name=openingName.toLowerCase();let idea="Cette ouverture cherche à développer rapidement les pièces, contrôler le centre et préparer la mise en sécurité du roi.";
  if(name.includes("française"))idea="Les Noirs contestent le centre avec …d5 et cherchent à miner le duo de pions blancs e4–d4. Le fou c8 peut être un peu enfermé : il faudra le libérer au bon moment.";
  else if(name.includes("sicilienne"))idea="Les Noirs répondent de façon asymétrique à 1.e4 : ils contestent le centre depuis l’aile dame et cherchent un jeu dynamique, souvent avec une colonne c semi-ouverte.";
  else if(name.includes("caro-kann"))idea="Les Noirs soutiennent …d5 avec …c6 pour construire un centre solide et libérer leur fou de cases blanches avant de développer.";
  else if(name.includes("espagnole"))idea="Les Blancs développent le fou en b5 pour exercer une pression sur le cavalier c6, défenseur du pion e5, tout en préparant un centre solide.";
  else if(name.includes("italienne"))idea="Les Blancs développent rapidement le fou vers c4, visent la case f7 et préparent le roque ainsi qu’une présence centrale avec d3 ou c3.";
  else if(name.includes("londres"))idea="Les Blancs construisent un développement solide avec les pions d4 et e3, puis placent le fou de cases noires en f4. Le plan est simple : roquer et préparer e4.";
  else if(name.includes("gambit dame"))idea="Les Blancs proposent le pion c4 pour détourner le pion d5 et construire un centre fort avec e4. La pression porte surtout sur le centre et la colonne c.";
  else if(name.includes("est-indienne"))idea="Les Noirs laissent les Blancs occuper le centre, puis le contestent avec …e5 ou …c5. Ils cherchent souvent une attaque sur l’aile roi.";
  return {title:"Idée de l’ouverture",body:"Ton adversaire joue "+openingName+". "+idea,tip:""};
 }

 if(detail.contextOpponent){const opponentLoss=Math.max(0,Number(detail.opponentMove?.loss)||0);const opponentText=opponentLoss<2?"Son coup est précis et maintient l’équilibre.":opponentLoss<10?"Son coup manque un peu de précision : tu peux chercher à améliorer ta position.":opponentLoss<20?"Son coup est une imprécision qui te laisse une occasion de prendre l’initiative.":"Son coup est une erreur : profite-en pour reprendre l’initiative.";return {title:"Après le coup adverse",body:opponentText+(detail.best?" La réponse conseillée ici est "+detail.best+".":" Cherche une réponse qui développe tes pièces et protège ton roi."),tip:""};}
 if(detail.color!==userSide){return {title:"Coup adverse",body:"Ton adversaire vient de jouer "+(detail.played||"un coup")+".",tip:""};}
 if(detail.loss===null||detail.loss===undefined){const openingTip=(active&&userSide==="b"&&detail.ply===1)?historicalCounterOpening():null;return {title:openingTip?"Ta meilleure réponse historique":"À toi de jouer",body:openingTip?("Contre ce premier coup, dans tes parties avec les Noirs, ton meilleur résultat vient de "+openingTip.name+" : "+openingTip.rate+" % de victoires sur "+openingTip.count+" partie(s)."):(detail.best?"Le moteur recommande "+detail.best+". Cherche ce coup sur l’échiquier, puis regarde l’idée derrière le développement.":"Trouve un coup qui développe tes pièces et contrôle le centre."),tip:""};}
 const loss=Math.max(0,Number(detail.loss)||0);
 const bestBoard=new Chess(detail.fen);
 const bestMove=bestBoard.moves({verbose:true}).find(m=>m.from+m.to+(m.promotion||"")===detail.bestUci);
 let idea="";
 if(bestMove){
  const names={p:"pion",n:"cavalier",b:"fou",r:"tour",q:"dame",k:"roi"};
  const pieceName=names[bestMove.piece]||"pièce";
  const target=bestBoard.get(bestMove.to);
  if(detail.bestMate)idea="Ce coup mène au mat : il n’y a plus de défense suffisante.";
  else if(detail.bestCheck)idea="Tu donnes échec et tu obliges le roi adverse à répondre immédiatement.";
  else if(bestMove.captured)idea="Tu prends le "+(names[bestMove.captured]||"pièce adverse")+" en "+bestMove.to+". Cette prise gagne du matériel sans laisser de compensation suffisante.";
  else{
   const after=new Chess(detail.fen);after.move({from:bestMove.from,to:bestMove.to,promotion:bestMove.promotion});
   const fenParts=after.fen().split(" ");fenParts[1]=detail.color;
   let threats=[];
   try{const sameSide=new Chess(fenParts.join(" "));threats=sameSide.moves({square:bestMove.to,verbose:true}).filter(m=>m.captured);}catch{}
   const threat=threats[0];
   if(threat){
    const targetName=names[threat.captured]||"pièce";
    idea="Depuis "+bestMove.to+", ton "+pieceName+" attaque le "+targetName+" adverse en "+threat.to+". Tu crées une menace concrète.";
   }else if(bestMove.piece==="n")idea="Le cavalier s’installe en "+bestMove.to+", une case active d’où il contrôle plusieurs cases centrales et peut préparer une attaque.";
   else if(bestMove.piece==="b")idea="Le fou se place en "+bestMove.to+" pour améliorer sa diagonale et exercer une pression à distance.";
   else if(bestMove.piece==="r")idea="La tour rejoint "+bestMove.to+" pour mieux contrôler la colonne et soutenir tes pièces.";
   else if(bestMove.piece==="q")idea="La dame rejoint "+bestMove.to+" pour coordonner l’attaque et soutenir les menaces sur le roi adverse.";
   else if(bestMove.piece==="p")idea="Cette poussée en "+bestMove.to+" gagne de l’espace et ouvre des lignes à tes pièces.";
   else idea="Ce déplacement en "+bestMove.to+" améliore la coordination de tes pièces et renforce la sécurité de ton roi.";
  }
 }
 if(!idea)idea="Ce coup améliore ta position et évite la perte de matériel ou d’activité que provoquerait une autre décision.";
 const played=detail.played||"ton coup";
 let concreteReply="";
 if(loss>=15&&detail.playedUci&&detail.playedUci!==detail.bestUci){
  try{
   const afterPlayed=new Chess(detail.fen),pm=afterPlayed.moves({verbose:true}).find(m=>m.from+m.to+(m.promotion||"")===detail.playedUci);
   if(pm){
    afterPlayed.move({from:pm.from,to:pm.to,promotion:pm.promotion});
    const names={p:"pion",n:"cavalier",b:"fou",r:"tour",q:"dame",k:"roi"},values={p:1,n:3,b:3,r:5,q:9,k:100};
    const replies=afterPlayed.moves({verbose:true}).filter(m=>m.captured).sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0));
    if(replies.length){const reply=replies[0];concreteReply=" Concrètement, après ce coup, l’adversaire peut jouer "+reply.san+" et prendre ton "+(names[reply.captured]||"pièce")+" en "+reply.to+".";}
    else concreteReply=" La position devient moins favorable après ce coup, mais aucune prise tactique immédiate n’a été identifiée dans la réponse directe.";
   }
  }catch{}
 }
 // Même pendant la théorie, le coach explique le coup et son idée au lieu de répéter le nom de l’ouverture.
 let body;
 if(loss<15){
  body=detail.bestUci===detail.playedUci?"Très bon choix. "+idea:"Tu as joué "+played+". "+idea;
 }else{
  body="Ton coup "+played+" laisse une réponse plus forte à l’adversaire. "+idea+concreteReply;
 }
 return {title:loss<=0.01?"Coup parfait":loss<15?"Meilleur coup":detail.label||"À corriger",body,tip:"Les cases encadrées montrent la pièce à déplacer et sa destination."};
}
function historicalCounterOpening(){
 try{
  const games=window.CoachApp?.getGames?.()||[],current=new Chess();current.loadPgn(active?.pgn||"");const first=current.history({verbose:true})[0];if(!first||first.color!=="w")return null;const key=first.from+first.to+(first.promotion||"");const groups=new Map();
  for(const game of games){
   if((game.black||"").toLowerCase()!==String(window.CoachApp?.getUsername?.()||"").toLowerCase()||!game.pgn)continue;
   const board=new Chess();board.loadPgn(game.pgn);const firstMove=board.history({verbose:true})[0];
   if(!firstMove||firstMove.color!=="w"||firstMove.from+firstMove.to+(firstMove.promotion||"")!==key)continue;
   const name=frenchOpeningName(game.opening||game.displayOpening||"");if(!name)continue;
   if(!groups.has(name))groups.set(name,{name,w:0,d:0,l:0,count:0});
   const g=groups.get(name);g.count++;if(game.result==="0-1")g.w++;else if(game.result==="1/2-1/2")g.d++;else if(game.result==="1-0")g.l++;
  }
  const ranked=[...groups.values()].filter(g=>g.count>=2&&g.w+g.d+g.l>0).map(g=>({...g,rate:Math.round(g.w/(g.w+g.d+g.l)*100)})).sort((a,b)=>b.rate-a.rate||b.count-a.count);
  return ranked[0]||null;
 }catch{return null;}
}
function currentDetail(){
 if(freeBoard||index===0)return null;
 return activeAnalysisMove||active?.analysis?.positionDetails?.[index-1]||null;
}
function render(){
 if(!active)return;
 const detail=currentDetail();
 let board;
 const pv=detail?.pvUci||[];
 try{
  if(freeBoard)board=new Chess(freeBoard.fen());
  else if(detail&&variationIndex>0){
   board=new Chess(detail.fen);
   for(const uci of pv.slice(0,variationIndex))board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
  }else{
   board=new Chess();
   for(let i=0;i<index;i++){const m=moves[i];board.move({from:m.from,to:m.to,promotion:m.promotion});}
  }
 }catch{board=new Chess();}
 const lastPv=variationIndex>0?pv[variationIndex-1]:null;
 const pvSquares=lastPv?[lastPv.slice(0,2),lastPv.slice(2,4)]:[];

 const orientation=(active&&(active.black||"").toLowerCase()===String(window.CoachApp?.getUsername?.()||"").toLowerCase())?"black":"white";
 const selectedSquares=freeSelected?[freeSelected]:[];
 const legalMoves=freeBoard&&freeSelected?freeBoard.moves({square:freeSelected,verbose:true}):[];
 const legalTargets=new Map(legalMoves.map(m=>[m.to,m.captured?"capture":"move"]));
 const moveDetail=!freeBoard?(activeAnalysisMove||(index>0?(active?.analysis?.positionDetails?.[index-1]||null):null)):null;
 const moveBadge=moveDetail?(()=>{const symbol=({brilliant:"✦",great:"!",best:"★",excellent:"◆",good:"✓",book:"▤",inaccuracy:"?!",mistake:"?",miss:"×",blunder:"‼"}[moveDetail.kind]||"·");const label=moveDetail.label||"Bon coup";return {symbol,label,kind:moveDetail.kind,square:moveDetail.playedUci?.slice(2,4)};})():null;
 const ranks=orientation==="white"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
 const files=orientation==="white"?["a","b","c","d","e","f","g","h"]:["h","g","f","e","d","c","b","a"];
 let cells="";
 ranks.forEach((rank,r)=>files.forEach((file,f)=>{
  const square=file+rank,p=board.get(square),light=((rank-1+(file.charCodeAt(0)-97))%2)===1;
  const classes=["replay-square",light?"light":"dark"];
  const tacticalHighlight=!freeBoard&&detail&&variationIndex===0&&(detail.bestCheck||detail.bestCapture||detail.playedCheck||detail.playedCapture||["brilliant","great","miss"].includes(detail.kind));
  if(tacticalHighlight&&detail.bestUci?.slice(0,2)===square)classes.push("coach-highlight-from");
  if(tacticalHighlight&&detail.bestUci?.slice(2,4)===square)classes.push("coach-highlight");
  if(pvSquares.includes(square))classes.push("pv-highlight");
  if(manualHighlights.has(square))classes.push("manual-highlight");
  if(selectedSquares.includes(square))classes.push("free-selected");
  if(legalTargets.has(square))classes.push(legalTargets.get(square)==="capture"?"legal-capture":"legal-target");
  const rankLabel=f===0?'<span class="board-coordinate rank-coordinate">'+rank+'</span>':"";
  const fileLabel=r===7?'<span class="board-coordinate file-coordinate">'+file.toUpperCase()+'</span>':"";
  const badge=moveBadge&&moveBadge.square===square?'<span class="move-quality '+moveBadge.kind+'" title="'+esc(moveBadge.label)+'">'+moveBadge.symbol+'</span>':"";
  cells+='<div class="'+classes.join(" ")+'" data-square="'+square+'">'+(p?'<img class="chess-piece-image" src="https://lichess1.org/assets/piece/cburnett/'+(p.color==="w"?"w":"b")+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':"")+rankLabel+fileLabel+badge+'</div>';
 }));
 let arrows="";
 const arrowDetail=freeBoard?(freeAnalysis&&!freeAnalysisError?{bestUci:freeAnalysis.bestmove,playedUci:freeLastMove,kind:"good"}:null):(variationIndex===0?detail:null);
 if(arrowDetail){
  const best=arrowDetail.bestUci,played=arrowDetail.playedUci;
  const colors={brilliant:"#42b7ff",great:"#54a9f5",best:"#72cf79",excellent:"#82c96b",good:"#82c96b",book:"#aeb8c4",inaccuracy:"#f0c34e",mistake:"#f39a42",blunder:"#ef5b62",miss:"#df75c8"};
  const playedColor=colors[arrowDetail.kind]||"#f39a42";
  const bestColor="#72cf79";
  arrows='<svg class="board-arrows '+(orientation==="black"?"rotated":"")+'" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="bestArrow" markerWidth="3.6" markerHeight="3.6" refX="2.8" refY="1.8" orient="auto"><path d="M0,0 L3.6,1.8 L0,3.6 z" fill="'+bestColor+'"/></marker><marker id="playedArrow" markerWidth="3.6" markerHeight="3.6" refX="2.8" refY="1.8" orient="auto"><path d="M0,0 L3.6,1.8 L0,3.6 z" fill="'+playedColor+'"/></marker></defs>'+arrow(best?.slice(0,2),best?.slice(2,4),bestColor)+(played&&played!==best?arrow(played.slice(0,2),played.slice(2,4),playedColor,true):"")+'</svg>';
 }
 const last=index?moves[index-1]:null;
 ensureOpeningName(active);
 const openingLabel=frenchOpeningName(active?.opening||active?.displayOpening||"").trim()||(active?.eco?"Ouverture en cours d’identification":"Ouverture non identifiée");
 const label=freeBoard?"Mode libre · "+freeBoard.turn().toUpperCase()+" joue":openingLabel;
 const cp=freeBoard?(freeAnalysis?.scoreWhite??null):(variationIndex?null:(detail?.evalWhite??active?.analysis?.positions?.[Math.min(index,(active?.analysis?.positions?.length||1)-1)]??null));
 const clamped=Math.max(-1000,Math.min(1000,Number(cp)||0));
 const whitePct=100/(1+Math.exp(-0.00368208*clamped));
 const evalMarkup='<div class="eval-column"><strong class="eval-score">'+formatEval(cp)+'</strong><div class="eval-bar-track" aria-label="Évaluation du point de vue des Blancs"><div class="eval-black" style="height:'+(100-whitePct)+'%"></div><div class="eval-white" style="height:'+whitePct+'%"></div></div><small class="eval-perspective">Blancs</small></div>';
 const pvLine=(detail?.pvSan||[]).map((san,i)=>'<button type="button" class="pv-step '+(variationIndex===i+1?"active":"")+'" data-pv-step="'+(i+1)+'"><span class="pv-index">'+(i+1)+'</span><strong>'+esc(san)+'</strong></button>').join("");
 const pvPanel=detail&&pvLine?'<div class="pv-panel"><div class="pv-heading"><strong>Suite possible</strong><span>Touche un coup pour suivre la ligne</span></div><div class="pv-moves"><button type="button" class="pv-step '+(variationIndex===0?"active":"")+'" data-pv-step="0">Départ</button>'+pvLine+'</div></div>':"";
 const lastMoveDetail=active?.analysis?.positionDetails?.[index-1]||null;
 const responseDetail=active?.analysis?.positionDetails?.[index]||null;
 const userSide=((active?.white||"").toLowerCase()===String(window.CoachApp?.getUsername?.()||"").toLowerCase()?"w":"b");
 const coachDetail=!freeBoard&&index>0?(activeAnalysisMove||(lastMoveDetail?.color!==userSide&&responseDetail?{...responseDetail,contextOpponent:true,opponentMove:lastMoveDetail}:lastMoveDetail)):null;
 const coach=coachMessage(coachDetail);
 const freeCoachText=freeAnalysis?(freeAnalysisError?freeAnalysisError+" Dernière recommandation : "+(freeAnalysis.bestSan||"un coup actif")+".":"Stockfish conseille "+(freeAnalysis.bestSan||"un coup actif")+" pour la suite de la position."):(freeAnalysisError||"Analyse de la position en cours…");
 const coachPanel='<aside class="review-side"><section class="coach-card"><div class="coach-avatar" aria-hidden="true">♞</div><div class="coach-identity"><strong>Ton coach</strong><span>'+(freeBoard?"Analyse en direct":"Analyse du coup")+'</span></div><div class="coach-message"><strong>'+esc(freeBoard?(freeAnalysis?"Position analysée":"Analyse en cours"): (coachDetail?coach.title:"Choisis un coup"))+'</strong>'+(freeBoard?'<p>'+esc(freeCoachText)+'</p>':(coachDetail?'<p>'+esc(coach.body)+'</p>':'<p>Avance dans la partie pour afficher l’explication du coup et la meilleure idée.</p>'))+'</div></section></aside>';
 const controls=freeBoard
  ?'<div class="replay-controls free-navigation"><div class="replay-nav-group"><button class="icon-nav" data-free-reset="1" title="Revenir à la position de départ" aria-label="Revenir à la position de départ">|◀</button><button class="icon-nav" data-free-undo="1" '+(freeBoard.history().length?"":"disabled")+' title="Annuler le coup" aria-label="Annuler le coup">◀</button><button class="icon-nav" data-free-redo="1" '+(freeRedo.length?"":"disabled")+' title="Rejouer le coup annulé" aria-label="Rejouer le coup annulé">▶</button></div><button class="review-free-exit" data-free-exit="1">Reprendre la relecture</button></div>'
  :'<div class="replay-controls"><div class="replay-nav-group"><button class="icon-nav" data-review-start="1" title="Revenir au début" aria-label="Revenir au début"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14M19 6 8 12l11 6z"/></svg></button><button class="icon-nav" data-review-step="-1" '+(index===0?"disabled":"")+' title="Coup précédent" aria-label="Coup précédent"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><button class="icon-nav" data-review-step="1" '+(index===moves.length?"disabled":"")+' title="Coup suivant" aria-label="Coup suivant"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button><button class="icon-nav" data-review-end="1" title="Aller à la fin" aria-label="Aller à la fin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v14M5 6l11 6-11 6z"/></svg></button></div><button class="review-free-start" data-free-start="1">Tester cette position</button></div>';
 const clearButton=manualHighlights.size?'<button type="button" class="clear-highlights" data-clear-highlights="1">Effacer les surbrillances</button>':'';
 $("game-replay-area").innerHTML='<article class="surface replay-card" id="active-game-review"><div class="surface-heading"><div><p class="eyebrow">RELECTURE DE TA PARTIE</p><p class="muted">'+esc(active.date||"Partie")+' · '+esc(active.white||"Blancs")+' – '+esc(active.black||"Noirs")+'</p></div><span class="engine-badge '+(active?.analysis?.partial?"loading":analysisMoves.length?"ready":"")+'">'+(active?.analysis?.partial?"Analyse en cours":analysisMoves.length?"Analyse disponible":"Relecture")+'</span></div><p class="review-position-label">'+esc(label)+' · '+(freeBoard?"position libre":index+' / '+moves.length+' demi-coups')+'</p><div class="replay-layout"><div class="replay-board-column"><div class="replay-board-wrap">'+evalMarkup+'<div class="replay-board">'+cells+arrows+'</div></div>'+controls+clearButton+pvPanel+'</div>'+coachPanel+'</div>'+(window.CoachAnalysisSummaryHTML||"")+'</article>';
 $("game-replay-area").querySelectorAll(".chess-piece-image").forEach(img=>img.addEventListener("error",()=>{const fallback=document.createElement("span");fallback.className="piece";fallback.textContent=img.alt;img.replaceWith(fallback);},{once:true}));

}
function open(id){
 window.CoachAnalysisSummaryHTML="";
 document.querySelector('[data-tab="games"]')?.click();
 $("panel-games")?.classList.add("reviewing-game");
 const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===String(id));
 if(!game){$("game-replay-area").innerHTML='<div class="empty-state">Partie introuvable dans les données de cet appareil.</div>';return false;}
 if(!game.pgn){$("game-replay-area").innerHTML='<div class="empty-state">Le PGN de cette partie est absent. Réimporte-la pour la rejouer.</div>';return false;}
 try{const c=new Chess();c.loadPgn(game.pgn);moves=c.history({verbose:true});if(!moves.length)throw new Error("Aucun coup lisible dans le PGN.");active=game;index=0;analysisMoves=game.analysis?.moves||[];activeAnalysisMove=null;variationIndex=0;freeBoard=null;freeSelected=null;freeRedo=[];freeAnalysis=null;freeAnalysisError="";freeLastMove="";freeAnalysisSeq++;manualHighlights.clear();const s=$("analysis-game-select");if(s)s.value=String(game.id);$("analysis-results").innerHTML='<div class="empty-state compact">La relecture est prête. Parcours les coups, puis lance l’analyse moteur pour obtenir les meilleurs coups.</div>';$("lesson-area").innerHTML="";render();$("active-game-review")?.scrollIntoView({behavior:"smooth",block:"start"});return true;}
 catch(e){$("game-replay-area").innerHTML='<div class="empty-state">Impossible de lire cette partie : '+esc(e.message)+'</div>';return false;}
}
function setAnalysis(list,game){
 if(game)active=game;
 analysisMoves=list||[];
 activeAnalysisMove=null;variationIndex=0;freeBoard=null;freeSelected=null;freeRedo=[];freeAnalysis=null;freeAnalysisError="";freeLastMove="";freeAnalysisSeq++;manualHighlights.clear();
 if(active)active.analysis=active.analysis||{};
 if(active)index=0;
 render();
}
function showAnalysisMove(move){
 activeAnalysisMove=move;index=move.ply;variationIndex=0;freeBoard=null;freeSelected=null;freeRedo=[];freeAnalysis=null;freeAnalysisError="";freeLastMove="";freeAnalysisSeq++;render();
 $("active-game-review")?.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function playMoveSound(direction,capture=false){window.CoachSound?.play({captured:capture});}
async function analyzeFreePosition(){
 if(!freeBoard)return;const seq=++freeAnalysisSeq;freeAnalysisError=freeAnalysis?"Stockfish actualise l’évaluation…":"Stockfish analyse la position…";render();
 try{if(!window.CoachAnalysis?.analyzePosition)throw new Error("Le moteur d’analyse n’est pas disponible.");const result=await window.CoachAnalysis.analyzePosition(freeBoard.fen());if(seq!==freeAnalysisSeq||!freeBoard)return;freeAnalysis=result;freeAnalysisError="";}
 catch(error){if(seq!==freeAnalysisSeq)return;freeAnalysisError=error.message||"L’analyse de cette position a échoué.";}
 if(seq===freeAnalysisSeq&&freeBoard)render();
}
function handleFreeSquare(square){
 const sq=square.dataset.square,piece=freeBoard.get(sq);
 if(!freeSelected){
  if(piece&&piece.color===freeBoard.turn()){freeSelected=sq;render();}
  return;
 }
 if(piece&&piece.color===freeBoard.turn()){freeSelected=sq;render();return;}
 const legal=freeBoard.moves({square:freeSelected,verbose:true}).find(m=>m.to===sq);
 if(!legal){freeSelected=null;render();return;}
 try{freeBoard.move({from:freeSelected,to:sq,promotion:"q"});freeRedo=[];freeSelected=null;freeLastMove=legal.from+legal.to+(legal.promotion||"");playMoveSound(1,!!legal.captured);analyzeFreePosition();}
 catch{freeSelected=null;render();}
}
document.addEventListener("click",e=>{
 const pvStep=e.target.closest("[data-pv-step]");
 if(pvStep&&currentDetail()&&!freeBoard){variationIndex=Math.max(0,Math.min((currentDetail()?.pvUci||[]).length,Number(pvStep.dataset.pvStep)||0));render();return;}
 if(e.target.closest("[data-free-start]")){
  const displayed=new Chess();if(currentDetail()&&variationIndex>0){displayed.load(currentDetail().fen);for(const uci of (currentDetail().pvUci||[]).slice(0,variationIndex))displayed.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});}
  else{for(let i=0;i<index;i++){const m=moves[i];displayed.move({from:m.from,to:m.to,promotion:m.promotion});}}
  freeStartFen=displayed.fen();freeBoard=displayed;freeSelected=null;freeRedo=[];freeAnalysis=null;freeAnalysisError="";freeLastMove="";analyzeFreePosition();return;
 }
 if(e.target.closest("[data-free-undo]")&&freeBoard){const undone=freeBoard.undo();if(undone)freeRedo.push({from:undone.from,to:undone.to,promotion:undone.promotion});freeSelected=null;freeLastMove="";analyzeFreePosition();return;}
 if(e.target.closest("[data-free-reset]")&&freeBoard){freeBoard=new Chess(freeStartFen);freeRedo=[];freeSelected=null;freeLastMove="";analyzeFreePosition();return;}
 if(e.target.closest("[data-free-redo]")&&freeBoard&&freeRedo.length){const m=freeRedo.pop();freeBoard.move(m);freeSelected=null;freeLastMove=m.from+m.to+(m.promotion||"");analyzeFreePosition();return;}
 if(e.target.closest("[data-free-exit]")){freeBoard=null;freeRedo=[];freeSelected=null;freeAnalysis=null;freeAnalysisError="";freeLastMove="";freeAnalysisSeq++;render();return;}
 if(e.target.closest("[data-clear-highlights]")){manualHighlights.clear();render();return;}
 const square=e.target.closest(".replay-square[data-square]");
 if(square&&active){if(freeBoard){handleFreeSquare(square);return;}const name=square.dataset.square;if(manualHighlights.has(name))manualHighlights.delete(name);else manualHighlights.add(name);render();return;}
 const step=e.target.closest("[data-review-step]");
 if(step&&active&&!freeBoard){const next=Math.max(0,Math.min(moves.length,index+Number(step.dataset.reviewStep)));if(next!==index){activeAnalysisMove=null;variationIndex=0;index=next;playMoveSound(Number(step.dataset.reviewStep));render();}return;}
 if(e.target.closest("[data-review-start]")&&active&&!freeBoard){if(index!==0){activeAnalysisMove=null;variationIndex=0;index=0;playMoveSound(-1);render();}return;}
 if(e.target.closest("[data-review-end]")&&active&&!freeBoard){if(index!==moves.length){activeAnalysisMove=null;variationIndex=0;index=moves.length;playMoveSound(1);render();}}
});
function updateAnalysis(list,game){
 if(game)active=game;
 analysisMoves=list||[];
 render();
}
window.CoachReview={open,setAnalysis,updateAnalysis,showAnalysisMove};
window.addEventListener("coach:review-game",event=>open(event.detail?.gameId));
window.addEventListener("coach:account-changed",()=>{active=null;moves=[];index=0;analysisMoves=[];activeAnalysisMove=null;variationIndex=0;freeBoard=null;freeSelected=null;freeRedo=[];freeAnalysis=null;freeAnalysisError="";freeLastMove="";freeAnalysisSeq++;render();});

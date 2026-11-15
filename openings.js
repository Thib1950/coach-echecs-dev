import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id),USER="gone_1950";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let database=[],dbError="",groups=[],currentKey=null,exercise=null;
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const FR=[[/London System/gi,"Système de Londres"],[/Jobava London/gi,"Londres Jobava"],[/Sicilian Defense/gi,"Défense sicilienne"],[/King's Pawn Game/gi,"Partie du pion roi"],[/Queen's Pawn Game/gi,"Partie du pion dame"],[/Four Knights Game/gi,"Partie des quatre cavaliers"],[/King's Pawn Game/gi,"Partie du pion roi"],[/Queen's Pawn Game/gi,"Partie du pion dame"],[/Four Knights Game/gi,"Partie des quatre cavaliers"],[/French Defense/gi,"Défense française"],[/Caro-Kann Defense/gi,"Défense Caro-Kann"],[/King's Indian Defense/gi,"Défense est-indienne"],[/Queen's Gambit/gi,"Gambit dame"],[/King's Gambit/gi,"Gambit roi"],[/Ruy Lopez/gi,"Partie espagnole"],[/Italian Game/gi,"Partie italienne"],[/Scotch Game/gi,"Partie écossaise"],[/English Opening/gi,"Ouverture anglaise"],[/Scandinavian Defense/gi,"Défense scandinave"],[/Alekhine's Defense/gi,"Défense Alekhine"],[/Pirc Defense/gi,"Défense Pirc"],[/Dutch Defense/gi,"Défense hollandaise"],[/Slav Defense/gi,"Défense slave"],[/Nimzo-Indian Defense/gi,"Défense nimzo-indienne"],[/Grünfeld Defense/gi,"Défense Grünfeld"],[/Benoni Defense/gi,"Défense Benoni"],[/Reti Opening/gi,"Ouverture Réti"],[/Opening/gi,"Ouverture"],[/Defense/gi,"Défense"],[/Gambit/gi,"Gambit"],[/Advanced Variation/gi,"Variante d’avance"],[/Variation/gi,"Variante"],[/Attack/gi,"Attaque"],[/Accepted/gi,"accepté"],[/Declined/gi,"refusé"],[/Exchange/gi,"d'échange"],[/Classical/gi,"classique"],[/System/gi,"système"]];
function frenchName(name){let s=name||"Ouverture non classée";for(const [re,to] of FR)s=s.replace(re,to);return s;}
function familyName(name){return frenchName(String(name||"Ouverture non classée").split(/\s*[:–—]\s*/)[0].trim());}
function gameMoves(game){try{const c=new Chess();c.loadPgn(game.pgn||"");return c.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||""));}catch{return [];}}
function parseLine(pgn){try{const c=new Chess();c.loadPgn(pgn);return c.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||""));}catch{return [];}}
function validEco(v){return (String(v||"").match(/\b([A-E]\d{2})\b/i)||[])[1]?.toUpperCase()||"";}
function outcome(g){const w=(g.white||"").toLowerCase()===USER,b=(g.black||"").toLowerCase()===USER;if(g.result==="1/2-1/2")return "draw";if((w&&g.result==="1-0")||(b&&g.result==="0-1"))return "win";if((w&&g.result==="0-1")||(b&&g.result==="1-0"))return "loss";return "unknown";}
function sideOf(g){return (g.white||"").toLowerCase()===USER?"white":"black";}
function performance(games){const decided=games.filter(g=>["win","loss"].includes(outcome(g)));return decided.length?Math.round(decided.filter(g=>outcome(g)==="win").length/decided.length*100):null;}
function sanLine(uci){const c=new Chess(),out=[];for(let i=0;i<uci.length;i++){const m=c.moves({verbose:true}).find(x=>x.from+x.to+(x.promotion||"")===uci[i]);if(!m)break;c.move({from:m.from,to:m.to,promotion:m.promotion});out.push((i%2===0?(Math.floor(i/2)+1)+". ":"")+m.san);}return out.join(" ");}
async function loadDatabase(){
 const cached=localStorage.getItem("coach-echecs-openings-db-v1");
 if(cached){try{database=JSON.parse(cached).map(item=>({...item,display:frenchName(item.name),family:familyName(item.name)}));return;}catch{}}
 try{
  const letters=["a","b","c","d","e"];
  const files=await Promise.all(letters.map(async letter=>{const res=await fetch("https://raw.githubusercontent.com/lichess-org/chess-openings/master/"+letter+".tsv");if(!res.ok)throw new Error("Base des ouvertures indisponible");return await res.text();}));
  const all=[];
  for(const file of files)for(const row of file.split(/\r?\n/)){const [eco,name,pgn]=row.split("\t");if(!eco||!name||!pgn||eco.toLowerCase()==="eco")continue;const moves=parseLine(pgn);if(moves.length)all.push({eco,name,display:frenchName(name),family:familyName(name),moves,pgn});}
  database=all;try{localStorage.setItem("coach-echecs-openings-db-v1",JSON.stringify(database));}catch{}
 }catch(e){dbError=e.message||"Dictionnaire indisponible";}
}
function classify(game){
 const moves=gameMoves(game);let best=null;
 for(const item of database){if(!item.moves.length||item.moves.length>moves.length)continue;let ok=true;for(let i=0;i<item.moves.length;i++)if(item.moves[i]!==moves[i]){ok=false;break;}if(ok&&(!best||item.moves.length>best.moves.length))best=item;}
 if(best)return best;
 const header=(game.opening||"").trim(),eco=validEco(game.eco);
 if(header)return {eco,name:header,display:frenchName(header),family:familyName(header),moves:[],pgn:""};
 if(eco){const item=database.filter(x=>x.eco===eco).sort((a,b)=>b.moves.length-a.moves.length)[0];if(item)return item;}
 return {eco:"",name:"Ouverture non classée",display:"Ouverture non identifiée",family:"Ouverture non identifiée",moves:[],pgn:""};
}
function buildGroups(){
 const map=new Map(),games=window.CoachApp?.getGames?.()||[];
 for(const game of games){
  const op=classify(game);if(op.family==="Ouverture non identifiée")continue;const key=op.family;
  if(!map.has(key))map.set(key,{key,family:op.family,games:[],variants:new Map(),white:0,black:0,wins:0,draws:0,losses:0});
  const group=map.get(key);group.games.push(game);const side=sideOf(game);group[side]++;
  const result=outcome(game);if(result==="win")group.wins++;if(result==="draw")group.draws++;if(result==="loss")group.losses++;
  const variantName=op.display===op.family?"Ligne principale":op.display;
  if(!group.variants.has(variantName))group.variants.set(variantName,{name:variantName,count:0,book:op.moves?.length?op:null,games:[]});
  const variant=group.variants.get(variantName);variant.count++;variant.games.push(game);if(op.moves?.length&&(!variant.book||op.moves.length>variant.book.moves.length))variant.book=op;
 }
 groups=[...map.values()].sort((a,b)=>b.games.length-a.games.length);
}
function render(){
 buildGroups();const filter=$("opening-color-filter")?.value||"all",totalGames=(window.CoachApp?.getGames?.()||[]).filter(game=>filter==="all"||sideOf(game)===filter).length;
 const rows=groups.map(g=>{const games=g.games.filter(x=>filter==="all"||sideOf(x)===filter);return {...g,shown:games.length,shownGames:games,w:games.filter(x=>outcome(x)==="win").length,d:games.filter(x=>outcome(x)==="draw").length,l:games.filter(x=>outcome(x)==="loss").length,white:games.filter(x=>sideOf(x)==="white").length,black:games.filter(x=>sideOf(x)==="black").length,winRate:performance(games)};}).filter(g=>g.shown).sort((a,b)=>b.shown-a.shown||a.family.localeCompare(b.family,"fr"));
 $("opening-table").innerHTML=rows.length?rows.map(g=>{const decided=g.w+g.d+g.l,points=(g.w+g.d/2)/(decided||1),status=decided<3?"À confirmer":points<.45?"À travailler":points>=.6?"Bon repère":"À consolider";const statusClass=decided>=3&&points<.45?"needs-work":decided>=3&&points>=.6?"solid":"neutral";return '<div class="opening-family-row"><div class="opening-family-main"><strong>'+esc(g.family)+'</strong><small>Blancs : '+g.white+' partie(s) · Noirs : '+g.black+' partie(s)</small></div><div class="opening-family-status"><span class="opening-status '+statusClass+'">'+status+'</span></div><div class="opening-family-stats"><b>'+g.shown+' partie(s)</b><small>'+Math.round(g.shown/(totalGames||1)*100)+' % des parties</small><small class="opening-win-rate">'+(g.winRate===null?"—":g.winRate+" % de victoires")+'</small></div><div class="opening-family-actions"><button type="button" class="opening-family-button" data-opening-family="'+esc(g.key)+'">Étudier</button><button type="button" class="opening-family-button secondary" data-opening-family-exercise="'+esc(g.key)+'">Exercice</button></div></div>';}).join(""):'<div class="empty-state">'+(dbError?"Les noms d'ouvertures n'ont pas pu être chargés. Vérifie ta connexion puis rouvre cet onglet.":"Aucune ouverture reconnue dans tes parties importées.")+'</div>';
 $("opening-table").querySelectorAll("[data-opening-family-exercise]").forEach(button=>button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();const group=groups.find(x=>x.key===button.dataset.openingFamilyExercise);if(group)startExercise(group);}));
 if(currentKey){const g=groups.find(x=>x.key===currentKey);if(g)renderDetail(g);}
}
function renderDetail(g){
 currentKey=g.key;exercise=null;
 const variants=[...g.variants.values()].map(v=>({...v,winRate:performance(v.games)})).sort((a,b)=>(a.winRate??101)-(b.winRate??101)||b.count-a.count);
 const variantsHtml=variants.map((v,i)=>{const w=v.games.filter(x=>outcome(x)==="win").length,d=v.games.filter(x=>outcome(x)==="draw").length,l=v.games.filter(x=>outcome(x)==="loss").length;return '<div class="opening-variant-row"><div><strong>'+esc(v.name)+'</strong><small>'+v.count+' partie(s) · V/N/D : '+w+'/'+d+'/'+l+' · '+(v.winRate===null?"—":v.winRate+" % de victoires")+' · '+esc(v.book?.eco||"Variante issue de tes parties")+'</small></div><div class="opening-variant-actions"><button type="button" data-opening-preview="'+i+'">Étudier la ligne</button></div></div><div class="opening-variant-preview" id="opening-preview-'+i+'" hidden></div>';}).join("");
 $("opening-detail").innerHTML='<article class="surface opening-detail-card"><div class="surface-heading"><div><p class="eyebrow">OUVERTURE À TRAVAILLER</p><h3>'+esc(g.family)+'</h3><p class="muted">'+g.games.length+' partie(s) dans ton historique · '+g.white+' avec les Blancs · '+g.black+' avec les Noirs</p></div><button class="text-button" id="close-opening-detail">Fermer ✕</button></div><div class="opening-variants"><div class="opening-variants-heading"><h4>Variantes repérées dans tes parties</h4><button type="button" class="opening-family-button" id="opening-family-exercise">Exercice sur cette ouverture</button></div>'+variantsHtml+'</div><div id="opening-practice"></div></article>';
 $("close-opening-detail").addEventListener("click",()=>{$("opening-detail").innerHTML="";currentKey=null;exercise=null;});
 $("opening-family-exercise").addEventListener("click",()=>startExercise(g));
 
 $("opening-detail").querySelectorAll("[data-opening-preview]").forEach(button=>button.addEventListener("click",()=>startLineStudy(variants[Number(button.dataset.openingPreview)],Number(button.dataset.openingPreview))));
 $("opening-detail").scrollIntoView({behavior:"smooth",block:"start"});
}
function renderVariantPreview(variant,index){
 const root=$("opening-preview-"+index);if(!root)return;
 const line=(variant.book?.moves?.length?variant.book.moves:gameMoves(variant.games[0]||{})).slice(0,8);
 if(!line.length){root.hidden=false;root.innerHTML='<p class="muted">Aucune suite de coups exploitable pour cette variante.</p>';return;}
 const board=new Chess();for(const uci of line){try{board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});}catch{break;}}
 const files="abcdefgh",glyphs={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
 let cells="";for(let rank=8;rank>=1;rank--)for(let f=0;f<8;f++){const file=files[f],piece=board.get(file+rank),light=((rank-1+f)%2)===1;cells+='<div class="opening-preview-square '+(light?"light":"dark")+'">'+(piece?'<img src="https://lichess1.org/assets/piece/cburnett/'+piece.color+piece.type.toUpperCase()+'.svg" alt="'+glyphs[piece.color+piece.type]+'">':"")+'</div>';}
 root.hidden=false;root.innerHTML='<div class="opening-preview-board">'+cells+'</div><div class="opening-preview-info"><strong>Position après '+Math.ceil(line.length/2)+' coups</strong><p>'+esc(sanLine(line))+'</p><small>Observe le placement des pièces et la structure de pions caractéristiques de cette ligne.</small></div>';
}
function startLineStudy(variant,index){
 const preview=$("opening-preview-"+index);if(!preview)return;
 const line=(variant.book?.moves?.length?variant.book.moves:gameMoves(variant.games[0]||{})).slice(0,24);
 if(!line.length){preview.hidden=false;preview.innerHTML='<p class="muted">Aucune suite de coups exploitable pour cette variante.</p>';return;}
 const game=variant.games[0]||{},userSide=sideOf(game)==="black"?"b":"w";
 let board=new Chess(),ply=0,selected=null,feedback="Suis la flèche pour jouer le prochain coup de la ligne.";
 const autoReply=()=>{while(ply<line.length&&board.turn()!==userSide){const u=line[ply];try{board.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});ply++;}catch{break;}}};
 autoReply();
 const overlay=document.createElement("div");overlay.className="opening-study-overlay";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");document.body.appendChild(overlay);
 const close=()=>overlay.remove();
 const draw=()=>{
  const files=userSide==="w"?"abcdefgh":"hgfedcba",ranks=userSide==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  let cells="";ranks.forEach(rank=>[...files].forEach(file=>{const sq=file+rank,p=board.get(sq),light=((rank-1+(file.charCodeAt(0)-97))%2)===1;let cls="opening-square "+(light?"light":"dark")+(selected===sq?" selected":"");cells+='<button type="button" class="'+cls+'" data-study-square="'+sq+'" aria-label="'+sq+'">'+(p?'<img class="chess-piece-image" src="https://lichess1.org/assets/piece/cburnett/'+p.color+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':"")+'</button>';}));
  const next=ply<line.length?line[ply]:null;
  const orient=sq=>{let file=sq.charCodeAt(0)-97,rank=Number(sq[1])-1;if(userSide==="b"){file=7-file;rank=7-rank;}return {x:file*12.5+6.25,y:(7-rank)*12.5+6.25};};
  let arrowSvg="";if(next){const a=orient(next.slice(0,2)),b=orient(next.slice(2,4));arrowSvg='<svg class="opening-study-arrows" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="studyArrowHead" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0 0L4 2L0 4Z" fill="#8de06c"/></marker></defs><line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#8de06c" stroke-width="1.8" stroke-linecap="round" marker-end="url(#studyArrowHead)" opacity=".95"/></svg>';}
  overlay.innerHTML='<div class="opening-study-page"><header class="opening-study-top"><div><p class="eyebrow">ENTRAÎNEMENT DU RÉPERTOIRE</p><h2>'+esc(variant.name)+'</h2><p class="muted">'+esc(game.opening||game.displayOpening||"Ligne issue de ton répertoire")+'</p></div><button type="button" class="secondary-button" data-study-close>← Retour aux ouvertures</button></header><div class="opening-study-content"><div class="opening-study-board-wrap"><div class="opening-study-board">'+cells+'</div>'+arrowSvg+'</div><aside class="opening-study-side"><span class="engine-badge ready">'+(ply>=line.length?"Ligne terminée":"À toi de jouer")+'</span><h3>'+(ply>=line.length?"Bravo, ligne terminée !":"Joue le coup indiqué")+'</h3><p>'+esc(ply>=line.length?"Tu as parcouru toute la variante. Recommence pour la mémoriser.":feedback)+'</p><div class="opening-study-progress"><strong>'+ply+' / '+line.length+'</strong><span>demi-coups parcourus</span></div><button type="button" class="primary-button" data-study-restart>Recommencer la ligne</button></aside></div></div>';
  overlay.querySelectorAll(".chess-piece-image").forEach(img=>img.addEventListener("error",()=>{const fallback=document.createElement("span");fallback.className="piece";fallback.textContent=img.alt;img.replaceWith(fallback);},{once:true}));
 };
 overlay.addEventListener("click",event=>{
  if(event.target.closest("[data-study-close]")){close();return;}
  if(event.target.closest("[data-study-restart]")){board=new Chess();ply=0;selected=null;feedback="Suis la flèche pour jouer le prochain coup de la ligne.";autoReply();draw();return;}
  const square=event.target.closest("[data-study-square]");if(!square||ply>=line.length||board.turn()!==userSide)return;
  const sq=square.dataset.studySquare,piece=board.get(sq);
  if(!selected){if(piece&&piece.color===userSide){selected=sq;draw();}return;}
  if(piece&&piece.color===userSide){selected=sq;draw();return;}
  const legal=board.moves({square:selected,verbose:true}).find(m=>m.to===sq);if(!legal){selected=null;draw();return;}
  const played=legal.from+legal.to+(legal.promotion||"");if(played!==line[ply]){feedback="Ce coup ne suit pas la ligne. Regarde la flèche et essaie à nouveau.";selected=null;draw();return;}
  board.move({from:legal.from,to:legal.to,promotion:legal.promotion||"q"});ply++;selected=null;feedback="Bien joué. Observe la réponse adverse, puis suis la prochaine flèche.";autoReply();draw();
 });
 draw();
}
function exercisePositions(group,side){
 const out=[];
 for(const game of group.games){
  if(sideOf(game)!==(side==="w"?"white":"black")||!game.pgn)continue;
  try{
   const parsed=new Chess();parsed.loadPgn(game.pgn);const history=parsed.history({verbose:true}),board=new Chess();
   for(let i=0;i<Math.min(history.length,14);i++){
    if(i>=1&&board.turn()===side)out.push({fen:board.fen(),game,ply:i});
    const move=history[i];board.move({from:move.from,to:move.to,promotion:move.promotion});
   }
  }catch{}
 }
 return out;
}
async function startExercise(group){
 currentKey=group.key;
 const filter=$("opening-color-filter").value,white=group.games.filter(g=>sideOf(g)==="white").length,black=group.games.length-white;
 let side=filter==="white"?"w":filter==="black"?"b":(white>=black?"w":"b");
 let candidates=exercisePositions(group,side);if(!candidates.length){side=side==="w"?"b":"w";candidates=exercisePositions(group,side);}
 const root=$("opening-detail");
 if(!candidates.length){
  root.innerHTML='<article class="surface opening-detail-card"><div class="surface-heading"><div><p class="eyebrow">ENTRAÎNEMENT PERSONNALISÉ</p><h3>'+esc(group.family)+'</h3></div><button type="button" class="text-button" id="close-opening-exercise">Retour</button></div><p class="muted">Je n’ai pas trouvé de position exploitable dans tes parties pour cette ouverture.</p></article>';
  root.querySelector("#close-opening-exercise").onclick=()=>renderDetail(group);return;
 }
 let currentIndex=Math.floor(Math.random()*candidates.length),board=null,selected=null,best=null,busy=false,finished=false;
 let feedback="Le coach prépare une position issue de tes parties et cherche le meilleur coup avec Stockfish.";
 const close=()=>renderDetail(group);
 const draw=()=>{
  if(!board)return;
  const files=side==="w"?["a","b","c","d","e","f","g","h"]:["h","g","f","e","d","c","b","a"],ranks=side==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  const legal=selected?board.moves({square:selected,verbose:true}):[],targets=new Map(legal.map(m=>[m.to,m.captured?"capture":"move"]));let cells="";
  ranks.forEach((rank,r)=>files.forEach((file,f)=>{
   const sq=file+rank,p=board.get(sq),light=((rank-1+(file.charCodeAt(0)-97))%2)===1,classes=["opening-square",light?"light":"dark"];
   if(selected===sq)classes.push("selected");if(targets.has(sq))classes.push(targets.get(sq)==="capture"?"capture-target":"legal-target");
   const coords=(f===0?'<span class="opening-rank-coordinate">'+rank+'</span>':"")+(r===7?'<span class="opening-file-coordinate">'+file.toUpperCase()+'</span>':"");
   cells+='<button type="button" class="'+classes.join(" ")+'" data-opening-square="'+sq+'" aria-label="'+sq+'">'+(p?'<img class="chess-piece-image" src="https://lichess1.org/assets/piece/cburnett/'+(p.color==="w"?"w":"b")+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':"")+coords+(targets.has(sq)&&targets.get(sq)==="move"?'<i class="opening-legal-dot"></i>':"")+'</button>';
  }));
  const candidate=candidates[currentIndex];
  root.innerHTML='<article class="surface opening-detail-card opening-exercise-screen"><div class="surface-heading"><div><p class="eyebrow">EXERCICE SUR TES PARTIES</p><h3>'+esc(group.family)+'</h3><p class="muted">'+esc(candidate.game.date||"Partie importée")+' · Position après '+candidate.ply+' demi-coups</p></div><button type="button" class="text-button" data-exercise-close>Retour aux ouvertures</button></div><div class="opening-practice-layout"><div class="opening-practice-board">'+cells+'</div><aside class="opening-practice-coach"><div class="coach-avatar">♞</div><p class="eyebrow">TON COACH</p><h4>'+esc(group.family)+'</h4><strong>'+(busy?"Analyse de la position…":finished?"Bien joué !":"Trouve le meilleur coup")+'</strong><p>'+esc(feedback)+'</p><small>Position tirée de ton historique. Les points indiquent les cases où tu peux jouer.</small><button type="button" data-exercise-next '+(busy?"disabled":"")+'>'+(finished?"Exercice suivant":"Nouvelle position")+'</button></aside></div></article>';
  root.querySelectorAll(".chess-piece-image").forEach(img=>img.addEventListener("error",()=>{const fallback=document.createElement("span");fallback.className="piece";fallback.textContent=img.alt;img.replaceWith(fallback);},{once:true}));
 };
 const loadPosition=async()=>{
  const candidate=candidates[currentIndex];board=new Chess(candidate.fen);selected=null;best=null;finished=false;busy=true;feedback="Le moteur analyse cette position pour choisir un exercice pertinent.";draw();
  try{
   if(!window.CoachAnalysis?.analyzePosition)throw new Error("Le moteur d’analyse n’est pas encore disponible. Réessaie après avoir lancé une analyse de partie.");
   best=await window.CoachAnalysis.analyzePosition(candidate.fen);
   feedback=best.bestSan&&best.bestSan!=="—"?"À toi de trouver le meilleur coup. Le moteur a préparé sa recommandation.":"Trouve un coup actif pour améliorer ta position.";
  }catch(error){feedback=error.message||"L’analyse de cette position a échoué.";}
  busy=false;draw();
 };
 root.onclick=async event=>{
  if(event.target.closest("[data-exercise-close]")){close();return;}
  if(event.target.closest("[data-exercise-next]")){if(!busy){currentIndex=(currentIndex+1)%candidates.length;await loadPosition();}return;}
  const button=event.target.closest("[data-opening-square]");if(!button||busy||finished||!best)return;
  const square=button.dataset.openingSquare,piece=board.get(square);
  if(!selected){if(piece&&piece.color===side){selected=square;draw();}return;}
  if(piece&&piece.color===side){selected=square;draw();return;}
  const move=board.moves({square:selected,verbose:true}).find(m=>m.to===square);if(!move){selected=null;draw();return;}
  const uci=move.from+move.to+(move.promotion||"");board.move({from:move.from,to:move.to,promotion:move.promotion||"q"});selected=null;busy=true;feedback="Je vérifie ton coup avec Stockfish…";draw();
  try{
   const after=await window.CoachAnalysis.analyzePosition(board.fen()),sign=side==="w"?1:-1,loss=Math.max(0,sign*(best.scoreWhite-after.scoreWhite));
   if(uci===best.bestmove||loss<=35){finished=true;feedback="Excellent ! "+(best.bestSan||"Ce coup")+(best.bestSan?" est le meilleur choix ou une très bonne alternative.":" améliore la position.")+" Tu peux passer à une autre position.";}
   else{board.undo();feedback="Ce coup est légal, mais Stockfish trouve une réponse plus forte. Essaie encore en cherchant "+(best.bestSan||"un coup plus actif")+". La position est rétablie.";}
  }catch(error){board.undo();feedback="Je n’ai pas pu vérifier ce coup : "+(error.message||"erreur du moteur")+". Essaie à nouveau.";}
  busy=false;draw();
 };
 await loadPosition();
}
document.addEventListener("click",event=>{
 const exerciseButton=event.target.closest("[data-opening-family-exercise]");
 if(exerciseButton){event.preventDefault();const g=groups.find(x=>x.key===exerciseButton.dataset.openingFamilyExercise);if(g)startExercise(g);return;}
 const button=event.target.closest("[data-opening-family]");if(button){const g=groups.find(x=>x.key===button.dataset.openingFamily);if(g)renderDetail(g);}
});
$("opening-color-filter")?.addEventListener("change",render);
window.addEventListener("coach:games-updated",()=>{if($("panel-openings")?.classList.contains("active"))render();});
loadDatabase().then(render);render();

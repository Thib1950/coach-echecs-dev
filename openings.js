import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id),currentUser=()=>String(window.CoachApp?.getUsername?.()||"").toLowerCase();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let database=[],dbError="",groups=[],currentKey=null,exercise=null,showAllOpenings=false;
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const FR=[[/London System/gi,"Système de Londres"],[/Jobava London/gi,"Londres Jobava"],[/Sicilian Defense/gi,"Défense sicilienne"],[/King's Pawn Game/gi,"Partie du pion roi"],[/Queen's Pawn Game/gi,"Partie du pion dame"],[/Four Knights Game/gi,"Partie des quatre cavaliers"],[/King's Pawn Game/gi,"Partie du pion roi"],[/Queen's Pawn Game/gi,"Partie du pion dame"],[/Four Knights Game/gi,"Partie des quatre cavaliers"],[/French Defense/gi,"Défense française"],[/Caro-Kann Defense/gi,"Défense Caro-Kann"],[/King's Indian Defense/gi,"Défense est-indienne"],[/Queen's Gambit/gi,"Gambit dame"],[/King's Gambit/gi,"Gambit roi"],[/Ruy Lopez/gi,"Partie espagnole"],[/Italian Game/gi,"Partie italienne"],[/Scotch Game/gi,"Partie écossaise"],[/English Opening/gi,"Ouverture anglaise"],[/Scandinavian Defense/gi,"Défense scandinave"],[/Alekhine's Defense/gi,"Défense Alekhine"],[/Pirc Defense/gi,"Défense Pirc"],[/Dutch Defense/gi,"Défense hollandaise"],[/Slav Defense/gi,"Défense slave"],[/Nimzo-Indian Defense/gi,"Défense nimzo-indienne"],[/Grünfeld Defense/gi,"Défense Grünfeld"],[/Benoni Defense/gi,"Défense Benoni"],[/Reti Opening/gi,"Ouverture Réti"],[/Opening/gi,"Ouverture"],[/Defense/gi,"Défense"],[/Gambit/gi,"Gambit"],[/Advanced Variation/gi,"Variante d’avance"],[/Variation/gi,"Variante"],[/Attack/gi,"Attaque"],[/Accepted/gi,"accepté"],[/Declined/gi,"refusé"],[/Exchange/gi,"d'échange"],[/Classical/gi,"classique"],[/System/gi,"système"]];
function frenchName(name){let s=name||"Ouverture non classée";for(const [re,to] of FR)s=s.replace(re,to);return s;}
let strategicIdeasByEco=new Map();
function parseCsvRows(source){
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<source.length;i++){const ch=source[i];
  if(quoted){if(ch==='"'&&source[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
  else if(ch==='"')quoted=true;
  else if(ch===","){row.push(field);field="";}
  else if(ch==="\n"){row.push(field);if(row.some(value=>value.trim()))rows.push(row);row=[];field="";}
  else if(ch!=="\r")field+=ch;
 }
 if(field.length||row.length){row.push(field);rows.push(row);}return rows;
}
async function loadStrategicIdeas(){
 const key="coach-echecs-dev-strategic-ideas-v1";
 try{
  const cached=localStorage.getItem(key);
  if(cached){const rows=JSON.parse(cached);if(Array.isArray(rows)){strategicIdeasByEco=new Map(rows.map(item=>[item.eco,item]));return;}}
  const response=await fetch("https://raw.githubusercontent.com/Maahi420/chess-openings-data/main/data/openings.csv",{cache:"force-cache"});
  if(!response.ok)throw new Error("Référentiel stratégique indisponible");
  const rows=parseCsvRows(await response.text()),headers=rows.shift()||[],index=Object.fromEntries(headers.map((name,i)=>[name,i]));
  const selected=rows.map(row=>({eco:row[index.eco],kind:row[index.kind],name:row[index.name],description:row[index.description],white_ideas:row[index.white_ideas],black_ideas:row[index.black_ideas]})).filter(item=>item.eco&&item.white_ideas&&item.black_ideas);
  const families=selected.filter(item=>item.kind==="family");
  strategicIdeasByEco=new Map(families.map(item=>[item.eco,item]));
  try{localStorage.setItem(key,JSON.stringify(families));}catch{}
 }catch(error){console.info("Les explications stratégiques détaillées ne sont pas disponibles hors ligne.",error);}
}
function openingPlanFor(game,color){
 const opening=classify(game||{}),name=String(opening.family||opening.name||"").toLowerCase();
 const plans=[
  [/london|londres/,"Blancs : fou en f4, centre solide et petit roque.","Noirs : contester d4 avec ...c5 ou ...e5 et développer rapidement."],
  [/italian|italienne/,"Blancs : viser f7, puis préparer c3 et d4 pour ouvrir le centre.","Noirs : défendre e5, développer les pièces et chercher ...d5 au bon moment."],
  [/spanish|espagnol|ruy lopez/,"Blancs : mettre la pression sur c6, défenseur du pion e5.","Noirs : consolider e5 et libérer le jeu avec ...d5 ou ...f5."],
  [/sicilian|sicilienne/,"Blancs : contrôler d5 et préparer l’attaque au centre ou à l’aile roi.","Noirs : contrôler d4, ouvrir la colonne c et contre-attaquer à l’aile dame."],
  [/french|française/,"Blancs : construire le centre e5–d4 et gagner de l’espace.","Noirs : attaquer la base d4 avec ...c5 et libérer le fou c8."],
  [/caro.?kann/,"Blancs : gagner de l’espace et préparer l’ouverture du centre.","Noirs : soutenir ...d5 avec une structure solide et développer le fou c8."],
  [/queen.?s gambit|gambit dame/,"Blancs : faire pression sur d5 et prendre de l’espace au centre.","Noirs : tenir d5 ou rendre le pion pour développer les pièces."],
  [/king.?s indian|est.?indienne/,"Blancs : occuper le centre et limiter les ruptures ...e5 et ...c5.","Noirs : laisser le centre avancer puis le frapper avec ...e5 ou ...c5."],
  [/english|anglaise/,"Blancs : contrôler d5 depuis le flanc et préparer b4 ou d4.","Noirs : contester c4 et préparer une rupture centrale ...d5."],
  [/scandinavian|scandinave/,"Blancs : développer avec tempo sur la dame et contrôler le centre.","Noirs : récupérer le temps de développement et viser d4."],
  [/slav|slave/,"Blancs : développer en gardant la pression sur d5.","Noirs : soutenir d5 et libérer le fou c8."],
  [/nimzo/,"Blancs : profiter de la paire de fous et contrôler le centre.","Noirs : clouer le cavalier c3 et provoquer une faiblesse de pions."],
  [/grunfeld|grünfeld/,"Blancs : bâtir un grand centre de pions.","Noirs : attaquer le centre blanc à distance avec les fous et ...c5."],
  [/dutch|hollandaise/,"Blancs : exploiter les cases affaiblies autour du roi noir.","Noirs : contrôler e4 et lancer une attaque à l’aile roi."],
  [/reti|réti/,"Blancs : contrôler le centre à distance avant de choisir une poussée.","Noirs : occuper le centre et gagner de l’espace."],
 ];
 const found=plans.find(([re])=>re.test(name));
 return found?(color==="w"?found[1]:found[2]):(color==="w"?"Plan : développer les pièces, contrôler le centre et préparer une rupture de pions.":"Plan : contester le centre, terminer le développement et viser une rupture de pions.");
}

function familyName(name){return frenchName(String(name||"Ouverture non classée").split(/\s*[:–—]\s*/)[0].trim());}
function gameMoves(game){try{const c=new Chess();c.loadPgn(game.pgn||"");return c.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||""));}catch{return [];}}
function parseLine(pgn){try{const c=new Chess();c.loadPgn(pgn);return c.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||""));}catch{return [];}}
function validEco(v){return (String(v||"").match(/\b([A-E]\d{2})\b/i)||[])[1]?.toUpperCase()||"";}
function outcome(g){const user=currentUser(),w=(g.white||"").toLowerCase()===user,b=(g.black||"").toLowerCase()===user;if(g.result==="1/2-1/2")return "draw";if((w&&g.result==="1-0")||(b&&g.result==="0-1"))return "win";if((w&&g.result==="0-1")||(b&&g.result==="1-0"))return "loss";return "unknown";}
function sideOf(g){return (g.white||"").toLowerCase()===currentUser()?"white":"black";}
function performance(games){const decided=games.filter(g=>["win","loss"].includes(outcome(g)));return decided.length?Math.round(decided.filter(g=>outcome(g)==="win").length/decided.length*100):null;}
function sanLine(uci){const c=new Chess(),out=[];for(let i=0;i<uci.length;i++){const m=c.moves({verbose:true}).find(x=>x.from+x.to+(x.promotion||"")===uci[i]);if(!m)break;c.move({from:m.from,to:m.to,promotion:m.promotion});out.push((i%2===0?(Math.floor(i/2)+1)+". ":"")+m.san);}return out.join(" ");}
async function loadDatabase(){
 const cached=localStorage.getItem("coach-echecs-dev-openings-db-v1");
 if(cached){try{database=JSON.parse(cached).map(item=>({...item,display:frenchName(item.name),family:familyName(item.name)}));return;}catch{}}
 try{
  const letters=["a","b","c","d","e"];
  const files=await Promise.all(letters.map(async letter=>{const res=await fetch("https://raw.githubusercontent.com/lichess-org/chess-openings/master/"+letter+".tsv");if(!res.ok)throw new Error("Base des ouvertures indisponible");return await res.text();}));
  const all=[];
  for(const file of files)for(const row of file.split(/\r?\n/)){const [eco,name,pgn]=row.split("\t");if(!eco||!name||!pgn||eco.toLowerCase()==="eco")continue;const moves=parseLine(pgn);if(moves.length)all.push({eco,name,display:frenchName(name),family:familyName(name),moves,pgn});}
  database=all;try{localStorage.setItem("coach-echecs-dev-openings-db-v1",JSON.stringify(database));}catch{}
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
const LEARNING_PREFIX="coach-echecs-dev-opening-learning-v2";
const learningKey=()=>LEARNING_PREFIX+":"+currentUser();
let learning={};
function loadLearning(){try{learning=JSON.parse(localStorage.getItem(learningKey())||"{}");if(!learning||typeof learning!=="object")learning={};}catch{learning={};}}
function saveLearning(){try{localStorage.setItem(learningKey(),JSON.stringify(learning));}catch{}}
function learningStats(key){return learning[key]||{reps:0,errors:0,dueAt:0,streak:0};}
function targetPlyCount(stats){const reps=Number(stats?.reps)||0;return reps<2?8:reps<4?12:reps<6?14:reps<8?18:24;}
function recordLearning(candidate,correct,hadError=false){
 const key=candidate.learningKey||candidate.key,old=learningStats(key),now=Date.now(),next={...old};
 if(correct){next.reps=(Number(old.reps)||0)+1;next.streak=(Number(old.streak)||0)+1;const days=hadError?1:[1,3,7,14,30][Math.min(next.reps-1,4)];next.dueAt=now+days*86400000;}
 else{next.errors=(Number(old.errors)||0)+1;next.streak=0;next.reps=Math.max(0,(Number(old.reps)||0)-1);next.dueAt=now+10*60*1000;}
 next.lastResult=correct?"ok":"error";next.updatedAt=now;learning[key]=next;saveLearning();
}
function chooseCandidate(candidates,previousKey=""){
 if(!candidates.length)return 0;
 const now=Date.now(),weights=candidates.map(candidate=>{
  const p=learningStats(candidate.learningKey||candidate.key),due=!p.dueAt||p.dueAt<=now?2.2:Math.max(.08,1/(1+(p.dueAt-now)/86400000));
  const difficulty=1+(Number(p.errors)||0)*1.5,mastery=1/(1+(Number(p.reps)||0)*.85);
  return Math.max(.02,due*difficulty*mastery*(candidate.key===previousKey ? .08 : 1));
 });
 const total=weights.reduce((a,b)=>a+b,0);let roll=Math.random()*total;
 for(let i=0;i<weights.length;i++){roll-=weights[i];if(roll<=0)return i;}
 return 0;
}

function renderExplorer(query=""){
 const root=$("opening-explorer-list");if(!root)return;
 const q=String(query||"").trim().toLocaleLowerCase("fr");
 const families=new Map();
 for(const item of database){const key=item.family||familyName(item.name);if(!families.has(key))families.set(key,[]);families.get(key).push(item);}
 const rows=[...families.entries()].filter(([name,items])=>!q||name.toLocaleLowerCase("fr").includes(q)||items.some(x=>x.display.toLocaleLowerCase("fr").includes(q)||x.eco.toLowerCase().includes(q))).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0],"fr")).slice(0,60);
 root.innerHTML=rows.length?rows.map(([name,items],i)=>'<button type="button" class="opening-explorer-family" data-explorer-family="'+i+'"><span><strong>'+esc(name)+'</strong><small>'+items.length+' ligne(s) de référence</small></span><b>Voir les variantes →</b></button>').join(""):'<div class="empty-state">Aucune ouverture ne correspond à cette recherche.</div>';
 root._families=rows;$("opening-explorer-lines").innerHTML="";
}
function renderExplorerLines(index){
 const root=$("opening-explorer-list"),rows=root?._families||[],entry=rows[index];if(!entry)return;
 const [name,items]=entry,lines=items.slice().sort((a,b)=>b.moves.length-a.moves.length).slice(0,18);
 $("opening-explorer-lines").innerHTML='<div class="opening-explorer-lines-heading"><h3>'+esc(name)+'</h3><p class="muted">'+lines.length+' variantes de la base de référence</p></div>'+lines.map((item,i)=>'<div class="opening-variant-row"><div><strong>'+esc(item.display)+'</strong><small>'+esc(item.eco)+' · '+item.moves.length+' demi-coups</small></div><div class="opening-variant-actions"><button type="button" data-explorer-study="'+i+'">Étudier la ligne</button></div></div>').join("");
 $("opening-explorer-lines")._lines=lines;
}
function showLearnSubview(view){
 ["learn-hub","learn-opening-choice","learn-opening-detected","learn-opening-explorer"].forEach(id=>{const node=$(id);if(node)node.hidden=id!==view;});
 if(view==="learn-opening-detected")render();
 if(view==="learn-opening-explorer")renderExplorer($("opening-explorer-search")?.value||"");
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
 buildGroups();const filter=document.querySelector("[data-opening-color].active")?.dataset.openingColor||"all",totalGames=(window.CoachApp?.getGames?.()||[]).filter(game=>filter==="all"||sideOf(game)===filter).length;
 const visibleGroups=showAllOpenings?groups:groups.slice(0,12);const rows=visibleGroups.map(g=>{const games=g.games.filter(x=>filter==="all"||sideOf(x)===filter);return {...g,shown:games.length,shownGames:games,w:games.filter(x=>outcome(x)==="win").length,d:games.filter(x=>outcome(x)==="draw").length,l:games.filter(x=>outcome(x)==="loss").length,white:games.filter(x=>sideOf(x)==="white").length,black:games.filter(x=>sideOf(x)==="black").length,winRate:performance(games)};}).filter(g=>g.shown).sort((a,b)=>b.shown-a.shown||a.family.localeCompare(b.family,"fr"));
 $("opening-table").innerHTML=rows.length?rows.map(g=>{const decided=g.w+g.d+g.l,points=(g.w+g.d/2)/(decided||1),status=decided<3?"À confirmer":points<.45?"À travailler":points>=.6?"Bon repère":"À consolider";const statusClass=decided>=3&&points<.45?"needs-work":decided>=3&&points>=.6?"solid":"neutral";return '<div class="opening-family-row"><div class="opening-family-main"><strong>'+esc(g.family)+'</strong><small>Blancs : '+g.white+' partie(s) · Noirs : '+g.black+' partie(s)</small></div><div class="opening-family-status"><span class="opening-status '+statusClass+'">'+status+'</span></div><div class="opening-family-stats"><b>'+g.shown+' partie(s)</b><small>'+Math.round(g.shown/(totalGames||1)*100)+' % des parties</small><small class="opening-win-rate">'+(g.winRate===null?"—":g.winRate+" % de victoires")+'</small></div><div class="opening-family-actions"><button type="button" class="opening-family-button" data-opening-family="'+esc(g.key)+'">Étudier</button><button type="button" class="opening-family-button secondary" data-opening-family-exercise="'+esc(g.key)+'">Exercice</button></div></div>';}).join(""):'<div class="empty-state">'+(dbError?"Les noms d'ouvertures n'ont pas pu être chargés. Vérifie ta connexion puis rouvre cet onglet.":"Aucune ouverture reconnue dans tes parties importées.")+'</div>';
 if(groups.length>12){const toggle=document.createElement("button");toggle.type="button";toggle.className="opening-show-all-button";toggle.textContent=showAllOpenings?"Réduire la liste":"Afficher les "+groups.length+" ouvertures";toggle.addEventListener("click",()=>{showAllOpenings=!showAllOpenings;render();});$("opening-table").appendChild(toggle);}
 $("opening-table").querySelectorAll("[data-opening-family-exercise]").forEach(button=>button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();const group=groups.find(x=>x.key===button.dataset.openingFamilyExercise);if(group)startExercise(group);}));
 $("opening-table").querySelectorAll("[data-opening-family]").forEach(button=>button.addEventListener("click",event=>{event.preventDefault();const group=groups.find(x=>x.key===button.dataset.openingFamily);if(group){event.stopPropagation();renderDetail(group);}}));
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
 const game=variant.games[0]||{},bookLine=variant.book?.moves||[],playedLine=gameMoves(game),sourceLine=bookLine.length>=8?bookLine:playedLine,line=sourceLine.slice(0,24);
 if(!line.length){preview.hidden=false;preview.innerHTML='<p class="muted">Aucune suite de coups exploitable pour cette variante.</p>';return;}
 const userSide=sideOf(game)==="black"?"b":"w";
 let board=new Chess(),ply=0,selected=null,busy=false,feedback="Suis la flèche pour jouer le prochain coup de la ligne.";
 const autoReply=()=>{while(ply<line.length&&board.turn()!==userSide){const u=line[ply];try{const played=board.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});window.CoachSound?.play(played);ply++;}catch{break;}}};
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
 overlay.addEventListener("click",async event=>{
  if(event.target.closest("[data-study-close]")){close();return;}
  if(event.target.closest("[data-study-restart]")){if(busy)return;board=new Chess();ply=0;selected=null;feedback="Suis la flèche pour jouer le prochain coup de la ligne.";autoReply();draw();return;}
  const square=event.target.closest("[data-study-square]");if(!square||busy||ply>=line.length||board.turn()!==userSide)return;
  const sq=square.dataset.studySquare,piece=board.get(sq);
  if(!selected){if(piece&&piece.color===userSide){selected=sq;draw();}return;}
  if(piece&&piece.color===userSide){selected=sq;draw();return;}
  const legal=board.moves({square:selected,verbose:true}).find(m=>m.to===sq);if(!legal){selected=null;draw();return;}
  const played=legal.from+legal.to+(legal.promotion||"");if(played!==line[ply]){feedback="Faux ! Ce coup ne suit pas la ligne. Regarde la flèche et réessaie.";selected=null;draw();return;}
  const playedMove=board.move({from:legal.from,to:legal.to,promotion:legal.promotion||"q"});window.CoachSound?.play(playedMove);ply++;selected=null;feedback="Bien joué ! L’adversaire réfléchit…";busy=true;draw();await new Promise(resolve=>setTimeout(resolve,560));autoReply();busy=false;feedback=ply>=line.length?"Bravo, tu as terminé toute la séquence !":"La réponse adverse est jouée. À toi de continuer.";draw();
 });
 draw();
}
function exercisePositions(group,side){
 const unique=new Map();
 for(const game of group.games){
  if(sideOf(game)!==(side==="w"?"white":"black")||!game.pgn)continue;
  try{
   const parsed=new Chess();parsed.loadPgn(game.pgn);
   const history=parsed.history({verbose:true});
   if(history.length<4)continue;
   const opening=classify(game),openingName=opening.display||opening.name||group.family;
   const playedLine=history.map(m=>m.from+m.to+(m.promotion||""));
   const theoretical=opening.moves?.length>=8?opening.moves:playedLine;
   const line=theoretical.slice(0,Math.min(history.length,theoretical.length,24));
   if(line.length<4)continue;
   const learningKey=[group.key,openingName,side,line.slice(0,8).join(".")].join("|"),key=learningKey+"::"+line.join(".");
   const stats=learningStats(learningKey),target=targetPlyCount(stats),progressiveLine=line.slice(0,target);
   if(progressiveLine.length<4)continue;
   if(!unique.has(key))unique.set(key,{key,learningKey,fen:new Chess().fen(),game,ply:0,line:progressiveLine,fullLine:line,openingLength:progressiveLine.length,openingName,learning:stats});
  }catch{}
 }
 return [...unique.values()];
}
async function startExercise(group){
 await strategicIdeasPromise;
 currentKey=group.key;
 $("panel-openings")?.classList.add("opening-exercise-active");
 const backTab=$("[data-opening-back]");if(backTab)backTab.hidden=false;
 const filter=$("opening-color-filter")?.value||"all",white=group.games.filter(g=>sideOf(g)==="white").length,black=group.games.length-white;
 let side=filter==="white"?"w":filter==="black"?"b":(white>=black?"w":"b");
 let candidates=exercisePositions(group,side);if(!candidates.length){side=side==="w"?"b":"w";candidates=exercisePositions(group,side);}
 const root=$("opening-detail");
 if(!candidates.length){
  root.innerHTML='<article class="surface opening-detail-card"><p class="muted">Je n’ai pas trouvé de séquence assez complète dans tes parties pour construire cet exercice.</p><button type="button" class="text-button" id="close-opening-exercise">← Retour</button></article>';
  root.querySelector("#close-opening-exercise").onclick=()=>{$("panel-openings")?.classList.remove("opening-exercise-active");const back=$("[data-opening-back]");if(back)back.hidden=true;renderDetail(group);};return;
 }
 let currentIndex=chooseCandidate(candidates),board=null,selected=null,phase="guide",guidePly=0,practicePly=0,busy=false,finished=false,feedback="",candidateFailed=false;
 const files="abcdefgh",pieceNames={p:"pion",n:"cavalier",b:"fou",r:"tour",q:"dame",k:"roi"};
 const close=()=>{$("panel-openings")?.classList.remove("opening-exercise-active");const back=$("[data-opening-back]");if(back)back.hidden=true;renderDetail(group);};
 const candidate=()=>candidates[currentIndex];
 const moveFor=(position,moveUci)=>position.moves({verbose:true}).find(m=>m.from+m.to+(m.promotion||"")===moveUci);
 const describeMove=(position,move,moveIndex)=>{
  const piece=position.get(move.from),actor=move.color===side?"Tu":"L’adversaire";
  if(move.san.includes("#"))return actor+" fait mat : le roi n’a plus de case sûre.";
  if(move.san.includes("+"))return actor+" donne échec et force une réponse du roi.";
  if(move.flags?.includes("k")||move.flags?.includes("q"))return actor+" roque : roi à l’abri, tours connectées.";
  if(move.captured)return actor+" échange pour supprimer un défenseur ou modifier les pions.";
  if(piece?.type==="p"&&["d4","e4","d5","e5"].includes(move.to))return actor+" prend de l’espace et contrôle le centre.";
  if(piece?.type==="p"&&["c4","f4","c5","f5"].includes(move.to))return actor+" contrôle le centre depuis le flanc et prépare une rupture.";
  if(piece?.type==="n")return actor+" installe le cavalier sur une case active : il contrôle le centre et gêne les pièces adverses.";
  if(piece?.type==="b")return actor+" ouvre une diagonale : pression à distance sur le centre ou un défenseur.";
  if(piece?.type==="r")return actor+" place la tour sur une colonne utile pour attaquer les pions.";
  if(piece?.type==="q")return actor+" coordonne les menaces sans exposer sa dame aux attaques.";
  if(piece?.type==="k")return actor+" met le roi en sécurité ou le rapproche de la finale.";
  return actor+" améliore la pièce et prépare une nouvelle menace.";
 };
 const describeForCoach=(position,move,moveIndex)=>{
  const explanation=describeMove(position,move,moveIndex),plan=moveIndex===0?openingPlanFor(candidate().game,side):"";
  return explanation+(plan?" "+plan:"");
 };
 const squareCenter=sq=>{
  const file=sq.charCodeAt(0)-97,rank=Number(sq[1])-1;
  const col=side==="w"?file:7-file,row=side==="w"?7-rank:rank;
  return {x:col*100+50,y:row*100+50};
 };
 const arrowFor=move=>{
  if(!move)return "";
  const a=squareCenter(move.slice(0,2)),b=squareCenter(move.slice(2,4)),piece=board?.get(move.slice(0,2));
  const center=["d4","e4","d5","e5"].map(squareCenter);
  let target=center.sort((x,y)=>Math.hypot(x.x-b.x,x.y-b.y)-Math.hypot(y.x-b.x,y.y-b.y))[0];
  if(piece?.type==="n"){
   const candidates=[];for(const [df,dr] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]){const file=move.charCodeAt(2)-97+df,rank=Number(move[3])+dr;if(file>=0&&file<8&&rank>=1&&rank<=8)candidates.push(String.fromCharCode(97+file)+rank);}
   const useful=candidates.filter(s=>["d4","e4","d5","e5","c4","f4","c5","f5"].includes(s));if(useful.length)target=squareCenter(useful[0]);
  }
  return '<svg class="opening-exercise-arrow" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="openingArrowGold" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5Z" fill="#f6c85f"/></marker><marker id="openingArrowBlue" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5Z" fill="#55c7ed"/></marker></defs><line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#f6c85f" stroke-width="7" stroke-linecap="round" marker-end="url(#openingArrowGold)"/><line x1="'+b.x+'" y1="'+b.y+'" x2="'+target.x+'" y2="'+target.y+'" stroke="#55c7ed" stroke-width="5" stroke-linecap="round" stroke-dasharray="11 8" opacity=".95" marker-end="url(#openingArrowBlue)"/></svg>';
 };
 const draw=()=>{
  if(!board)return;
  const ranks=side==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8],boardFiles=side==="w"?[..."abcdefgh"]:[..."hgfedcba"];
  const legal=selected?board.moves({square:selected,verbose:true}):[],targets=new Map(legal.map(m=>[m.to,m.captured?"capture":"move"]));let cells="";
  ranks.forEach((rank,r)=>boardFiles.forEach((file,f)=>{
   const sq=file+rank,p=board.get(sq),light=((rank-1+(file.charCodeAt(0)-97))%2)===1,classes=["opening-square",light?"light":"dark"];
   if(selected===sq)classes.push("selected");if(targets.has(sq))classes.push(targets.get(sq)==="capture"?"capture-target":"legal-target");
   const coords=(f===0?'<span class="opening-rank-coordinate">'+rank+'</span>':"")+(r===7?'<span class="opening-file-coordinate">'+file.toUpperCase()+'</span>':"");
   cells+='<button type="button" class="'+classes.join(" ")+'" data-opening-square="'+sq+'" aria-label="'+sq+'">'+(p?'<img class="chess-piece-image" src="https://lichess1.org/assets/piece/cburnett/'+(p.color==="w"?"w":"b")+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':"")+coords+(targets.has(sq)&&targets.get(sq)==="move"?'<i class="opening-legal-dot"></i>':"")+'</button>';
  }));
  const line=candidate().line,activeMove=phase==="guide"?line[guidePly]:null;
  let coachTitle="",coachText="",actionLabel="",status="";
  if(phase==="guide"){
   const move=activeMove?moveFor(board,activeMove):null;
   status="ÉTAPE 1 · DÉMONSTRATION GUIDÉE";
   coachTitle=guidePly>=line.length?"Démonstration terminée":"L’idée du coup";
   coachText=feedback||(move?describeForCoach(board,move,guidePly)+" À jouer : "+move.san+".":"La séquence est terminée. Rejoue-la sans aide.");
   actionLabel=guidePly>=line.length?"Rejouer sans les flèches":"";
  }else{
   status="ÉTAPE 2 · À TOI DE JOUER";
   coachTitle=finished?"Séquence maîtrisée !":"Reproduis la ligne sans aide";
   coachText=finished?"Bravo, tu as retrouvé toute la séquence de cette ouverture. Tu peux passer à une autre position.":(feedback||"Joue les coups que tu viens d’observer. Les réponses adverses seront jouées automatiquement.");
   actionLabel=finished?"Nouvelle position":"";
  }
  root.innerHTML='<article class="surface opening-detail-card opening-exercise-screen"><div class="opening-practice-layout"><div class="opening-practice-board-wrap"><div class="opening-practice-board">'+cells+'</div>'+(phase==="guide"?arrowFor(activeMove):"")+'</div><aside class="opening-practice-coach"><p class="eyebrow">'+status+'</p><h4>'+esc(group.family)+'</h4><strong>'+esc(coachTitle)+'</strong><span class="move-quality book opening-quality-badge">▤ COUP DE THÉORIE</span><p>'+esc(coachText)+'</p><small>'+(phase==="guide"?"Flèche dorée : coup joué · Flèche bleue : case stratégique.":"Rejoue depuis le début · "+practicePly+" / "+line.length+" demi-coups")+'</small>'+(actionLabel?'<button type="button" data-exercise-action>'+(finished?"Nouvelle position":actionLabel)+'</button>':"")+'<button type="button" class="opening-exercise-return" data-exercise-close>← Retour aux ouvertures</button></aside></div></article>';
  root.querySelectorAll(".chess-piece-image").forEach(img=>img.addEventListener("error",()=>{const fallback=document.createElement("span");fallback.className="piece";fallback.textContent=img.alt;img.replaceWith(fallback);},{once:true}));
 };
 const playAutomaticReplies=()=>{const notes=[];while(guidePly<candidate().line.length&&board.turn()!==side){const reply=moveFor(board,candidate().line[guidePly]);if(!reply)break;notes.push(describeForCoach(board,reply,guidePly));const replyMove=board.move({from:reply.from,to:reply.to,promotion:reply.promotion||"q"});window.CoachSound?.play(replyMove);guidePly++;}if(notes.length)feedback="Réponse adverse : "+notes.join(" ");};
 const playPracticeReplies=()=>{while(practicePly<candidate().line.length&&board.turn()!==side){const reply=moveFor(board,candidate().line[practicePly]);if(!reply)break;const replyMove=board.move({from:reply.from,to:reply.to,promotion:reply.promotion||"q"});window.CoachSound?.play(replyMove);practicePly++;}};
 const beginPosition=()=>{
  board=new Chess();selected=null;phase="guide";guidePly=0;practicePly=0;busy=false;finished=false;candidateFailed=false;feedback="";playAutomaticReplies();draw();
 };
 root.onclick=async event=>{
  if(event.target.closest("[data-exercise-close]")){close();return;}
  if(event.target.closest("#close-opening-exercise")){close();return;}
  if(event.target.closest("[data-exercise-action]")){
   if(busy)return;
   if(phase==="guide"){
    const line=candidate().line;
    if(guidePly>=line.length){phase="practice";board=new Chess();selected=null;practicePly=0;finished=false;feedback="À toi de rejouer toute l’ouverture depuis le premier coup, sans flèches.";playPracticeReplies();draw();return;}
    return;
   }
   if(finished){const previous=candidate().key;currentIndex=chooseCandidate(candidates,previous);beginPosition();return;}
  }
  if(phase==="guide"){
   if(guidePly>=candidate().line.length)return;
   const button=event.target.closest("[data-opening-square]");if(!button)return;
   const square=button.dataset.openingSquare,piece=board.get(square);
   if(!selected){if(piece&&piece.color===side){selected=square;feedback="Choisis la case d’arrivée indiquée par la flèche.";draw();}return;}
   if(piece&&piece.color===side){selected=square;draw();return;}
   const move=board.moves({square:selected,verbose:true}).find(m=>m.to===square);if(!move){selected=null;draw();return;}
   const expected=candidate().line[guidePly],played=move.from+move.to+(move.promotion||"");
   if(played!==expected){selected=null;feedback="Pas ce coup. Suis précisément la flèche et réessaie.";draw();return;}
   const ownIdea=describeForCoach(board,move,guidePly);const playedMove=board.move({from:move.from,to:move.to,promotion:move.promotion||"q"});window.CoachSound?.play(playedMove);guidePly++;selected=null;
   let replyIdea="";while(guidePly<candidate().line.length&&board.turn()!==side){const reply=moveFor(board,candidate().line[guidePly]);if(!reply)break;replyIdea=describeForCoach(board,reply,guidePly);const replyMove=board.move({from:reply.from,to:reply.to,promotion:reply.promotion||"q"});window.CoachSound?.play(replyMove);guidePly++;}
   feedback="Ton idée : "+ownIdea+(replyIdea?" Réponse adverse : "+replyIdea:"")+(guidePly>=candidate().line.length?" La démonstration est terminée.":" Observe maintenant la nouvelle position.");
   draw();return;
  }
  if(phase!=="practice"||busy||finished)return;
  const button=event.target.closest("[data-opening-square]");if(!button)return;
  const square=button.dataset.openingSquare,piece=board.get(square);
  if(!selected){if(piece&&piece.color===side){selected=square;draw();}return;}
  if(piece&&piece.color===side){selected=square;draw();return;}
  const move=board.moves({square:selected,verbose:true}).find(m=>m.to===square);if(!move){selected=null;draw();return;}
  const played=move.from+move.to+(move.promotion||""),expected=candidate().line[practicePly];
  if(played!==expected){if(!candidateFailed){recordLearning(candidate(),false);candidateFailed=true;}selected=null;feedback="Pas tout à fait. Cette position sera reproposée plus souvent pour la mémoriser.";draw();return;}
  const playedMove=board.move({from:move.from,to:move.to,promotion:move.promotion||"q"});window.CoachSound?.play(playedMove);practicePly++;selected=null;
  if(practicePly>=candidate().line.length){finished=true;recordLearning(candidate(),true,candidateFailed);feedback="Bravo ! Tu as reproduit toute la ligne. Ta prochaine révision est programmée selon tes résultats.";draw();return;}
  if(board.turn()!==side){busy=true;window.setTimeout(()=>{if(!board||phase!=="practice"){busy=false;return;}playPracticeReplies();busy=false;if(practicePly>=candidate().line.length){finished=true;recordLearning(candidate(),true,candidateFailed);feedback="Bravo ! Tu as reproduit toute la ligne. Ta prochaine révision est programmée selon tes résultats.";}else feedback="Bien joué. À toi de jouer le prochain coup.";draw();},420);}
  else{feedback="Bien joué. Continue la séquence.";draw();}
 };
 beginPosition();
}

document.addEventListener("click",event=>{
 const moduleButton=event.target.closest("[data-learn-module]");
 if(moduleButton?.dataset.learnModule==="openings"){showLearnSubview("learn-opening-choice");return;}
 const back=event.target.closest("[data-learn-back]");
 if(back){showLearnSubview(back.closest("#learn-opening-choice")?"learn-hub":"learn-opening-choice");return;}
 const viewButton=event.target.closest("[data-learn-opening-view]");
 if(viewButton){showLearnSubview(viewButton.dataset.learnOpeningView==="explorer"?"learn-opening-explorer":"learn-opening-detected");return;}
 const explorerFamily=event.target.closest("[data-explorer-family]");
 if(explorerFamily){renderExplorerLines(Number(explorerFamily.dataset.explorerFamily));return;}
 const explorerStudy=event.target.closest("[data-explorer-study]");
 if(explorerStudy){const item=$("opening-explorer-lines")._lines?.[Number(explorerStudy.dataset.explorerStudy)];if(item){const game={pgn:item.pgn,white:currentUser(),black:"Bibliothèque",opening:item.name,eco:item.eco};startLineStudy({name:item.display,games:[game],book:item},"explorer");}return;}
 const exerciseButton=event.target.closest("[data-opening-family-exercise]");
 if(exerciseButton){event.preventDefault();const g=groups.find(x=>x.key===exerciseButton.dataset.openingFamilyExercise);if(g)startExercise(g);return;}
 const button=event.target.closest("[data-opening-family]");if(button){const g=groups.find(x=>x.key===button.dataset.openingFamily);if(g)renderDetail(g);}
});
$("opening-color-filter")?.addEventListener("change",render);
$("opening-explorer-search")?.addEventListener("input",event=>renderExplorer(event.target.value));

window.addEventListener("coach:games-updated",()=>{if($("panel-openings")?.classList.contains("active"))render();});
document.querySelectorAll("[data-opening-color]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-opening-color]").forEach(item=>item.classList.toggle("active",item===button));render();}));
window.addEventListener("coach:account-changed",()=>{document.querySelectorAll(".opening-study-overlay").forEach(node=>node.remove());$("panel-openings")?.classList.remove("opening-exercise-active");$("opening-detail").innerHTML="";loadLearning();currentKey=null;showAllOpenings=false;showLearnSubview("learn-hub");render();});
const strategicIdeasPromise=loadStrategicIdeas();
loadLearning();loadDatabase().then(()=>{render();renderExplorer();});render();

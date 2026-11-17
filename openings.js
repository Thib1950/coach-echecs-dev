import { Chess } from "./chess-lib.js";
const $=id=>document.getElementById(id),currentUser=()=>String(window.CoachApp?.getUsername?.()||"").toLowerCase();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let database=[],dbError="",databaseLoadPromise=null,groups=[],currentKey=null,exercise=null,showAllOpenings=false;
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
const classificationCache=new Map();
function classify(game){
 const id=String(game.id||game.url||"")+"|"+String(game.eco||"")+"|"+String(game.opening||"");
 const cached=classificationCache.get(id);if(cached)return cached;
 const header=(game.opening||"").trim(),eco=validEco(game.eco);
 // Les PGN Chess.com contiennent presque toujours ECO et/ou Opening.
 // Utiliser ces métadonnées évite de rejouer chaque PGN et de comparer
 // ses coups à toute la bibliothèque à chaque affichage.
 if(header){const result={eco,name:header,display:frenchName(header),family:familyName(header),moves:[],pgn:""};classificationCache.set(id,result);return result;}
 if(eco){
  const candidates=database.filter(x=>x.eco===eco).sort((a,b)=>b.moves.length-a.moves.length);
  if(candidates.length){const result=candidates[0];classificationCache.set(id,result);return result;}
  const result={eco,name:"Code "+eco,display:"Code "+eco,family:"Code "+eco,moves:[],pgn:""};classificationCache.set(id,result);return result;
 }
 const moves=gameMoves(game);let best=null;
 for(const item of database){if(!item.moves.length||item.moves.length>moves.length)continue;let ok=true;for(let i=0;i<item.moves.length;i++)if(item.moves[i]!==moves[i]){ok=false;break;}if(ok&&(!best||item.moves.length>best.moves.length))best=item;}
 const result=best||{eco:"",name:"Ouverture non classée",display:"Ouverture non identifiée",family:"Ouverture non identifiée",moves:[],pgn:""};
 classificationCache.set(id,result);return result;
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
 ["learn-hub","learn-training-choice","learn-errors-view","learn-training-exercise","learn-opening-choice","learn-opening-detected","learn-opening-explorer"].forEach(id=>{const node=$(id);if(node)node.hidden=id!==view;});
 if(view==="learn-opening-detected")render();
 if(view==="learn-training-choice"||view==="learn-errors-view")window.dispatchEvent(new CustomEvent("coach:learn-personal-view",{detail:{view}}));
 if(view==="learn-opening-explorer"){
  const root=$("opening-explorer-list");
  if(!database.length&&!dbError){
   if(!databaseLoadPromise)databaseLoadPromise=loadDatabase();
   root.innerHTML='<div class="empty-state">Chargement du répertoire d’ouvertures…</div>';
   databaseLoadPromise.then(()=>{if($("learn-opening-explorer")?.hidden===false)renderExplorer($("opening-explorer-search")?.value||"");});
  }else renderExplorer($("opening-explorer-search")?.value||"");
 }
}
function isRecognizedOpening(op){
 const raw=String(op?.name||op?.display||op?.family||"").trim().toLowerCase();
 // "Formation" et les codes ECO seuls ne désignent pas une ouverture identifiable.
 if(!raw||/^formation(?:\\b|[\\s:–—-])/i.test(raw)||/^code\\s+[a-e]\\d{2}$/i.test(raw))return false;
 const generic=new Set(["opening","ouverture","unknown","unclassified","not classified","not identified","unidentified opening","ouverture non identifiée","ouverture non classée","autre","other","game","chess"]);
 return !generic.has(raw);
}
function buildGroups(){
 const map=new Map(),games=window.CoachApp?.getGames?.()||[];
 for(const game of games){
  const op=classify(game);if(!isRecognizedOpening(op))continue;const key=op.family;
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
 const rows=groups.map(g=>{const games=g.games.filter(x=>filter==="all"||sideOf(x)===filter);const w=games.filter(x=>outcome(x)==="win").length,d=games.filter(x=>outcome(x)==="draw").length,l=games.filter(x=>outcome(x)==="loss").length,decided=w+d+l;const adjustedWinRate=decided?((w+2)/(decided+4))*100:null;const frequency=Math.log1p(games.length);const priority=adjustedWinRate===null? -1:((100-adjustedWinRate)/100)*frequency;return {...g,shown:games.length,shownGames:games,w,d,l,white:games.filter(x=>sideOf(x)==="white").length,black:games.filter(x=>sideOf(x)==="black").length,winRate:performance(games),adjustedWinRate,priority};}).filter(g=>g.shown).sort((a,b)=>b.priority-a.priority||b.shown-a.shown||a.family.localeCompare(b.family,"fr"));const visibleGroups=showAllOpenings?rows:rows.slice(0,12);
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
function openingStrategicPlan(game,side){
 const opening=classify(game||{}),entry=opening.eco?strategicIdeasByEco.get(opening.eco):null;
 const raw=String(entry?.[side==="w"?"white_ideas":"black_ideas"]||"").replace(/[\r\n]+/g," ").replace(/\s+/g," ").trim();
 return raw?(raw.length>300?raw.slice(0,297)+"…":raw):openingPlanFor(game,side);
}
function openingMoveExplanation(position,move,game,side){
 const piece=position.get(move.from),actor=move.color===side?"Ton camp":"L’adversaire",to=move.to;
 if(move.san.includes("#"))return actor+" termine par "+move.san+" : le roi adverse est mat.";
 if(move.san.includes("+"))return actor+" joue "+move.san+" et met le roi adverse en échec. La réponse devient prioritaire.";
 if(move.flags?.includes("k")||move.flags?.includes("q"))return actor+" roque. Le roi se met à l’abri et la tour rejoint le jeu.";
 if(move.captured){
  const names={p:"un pion",n:"un cavalier",b:"un fou",r:"une tour",q:"la dame"};
  return actor+" joue "+move.san+" et prend "+(names[move.captured]||"une pièce")+". Ce coup modifie les échanges et la structure de pions.";
 }
 if(piece?.type==="p"){
  const file=to.charCodeAt(0)-97,rank=Number(to[1]),step=move.color==="w"?1:-1;
  const controls=[[file-1,rank+step],[file+1,rank+step]].filter(([f,r])=>f>=0&&f<8&&r>=1&&r<=8).map(([f,r])=>String.fromCharCode(97+f)+r);
  const central=["d4","e4","d5","e5"].includes(to);
  let text="Le pion avance de "+move.from+" vers "+to+". ";
  text+=central?"Il prend de l’espace et participe directement au contrôle du centre. ":"Il soutient les cases "+controls.join(" et ")+". ";
  const bishops=[];
  for(let f=0;f<8;f++)for(let r=1;r<=8;r++){
   const sq=String.fromCharCode(97+f)+r,b=position.get(sq);
   if(b?.type!=="b"||b.color!==move.color)continue;
   const bf=sq.charCodeAt(0)-97,br=Number(sq[1]);
   if(Math.abs(bf-(move.from.charCodeAt(0)-97))===1&&Math.abs(br-Number(move.from[1]))===1)bishops.push(sq);
  }
  if(bishops.length)text+="En quittant "+move.from+", il libère aussi la diagonale du fou "+bishops[0]+".";
  return text.trim();
 }
 if(piece?.type==="n"){
  const f=to.charCodeAt(0)-97,r=Number(to[1]),targets=[];
  for(const [df,dr] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]){
   const x=f+df,y=r+dr;if(x>=0&&x<8&&y>=1&&y<=8)targets.push(String.fromCharCode(97+x)+y);
  }
  const center=targets.filter(s=>["d4","e4","d5","e5","c4","f4","c5","f5"].includes(s));
  return "Le cavalier se développe en "+to+". Depuis cette case, il gagne de l’influence sur "+(center.length?center.join(", "):"les cases autour du centre")+", tout en préparant la coordination des pièces.";
 }
 if(piece?.type==="b")return "Le fou se place en "+to+" et agit sur une diagonale. Il peut viser le centre ou exercer une pression sur les cases faibles de l’adversaire.";
 if(piece?.type==="r")return "La tour rejoint "+to+". Elle se prépare à occuper une colonne ouverte ou semi-ouverte et à soutenir les pièces actives.";
 if(piece?.type==="q")return "La dame se place en "+to+". Elle coordonne les menaces, mais doit rester à l’abri des tempos de développement adverses.";
 if(piece?.type==="k")return "Le roi se déplace en "+to+". Ce coup prépare sa sécurité ou son activité selon la structure de pions.";
 return actor+" joue "+move.san+" pour améliorer la coordination des pièces et préparer la suite.";
}
function launchOpeningLearningSession(config){
 const line=(config.line||[]).slice(0,24),side=config.side==="b"?"b":"w",game=config.game||{},title=config.title||"Ligne d’ouverture",family=config.family||"Ton répertoire";
 if(!line.length)return null;
 const userIndices=line.map((_,i)=>((i%2===0?"w":"b")===side?i:-1)).filter(i=>i>=0);
 if(!userIndices.length)return null;
 const overlay=document.createElement("div");overlay.className="opening-study-overlay opening-learning-overlay";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label","Apprentissage des ouvertures");document.body.appendChild(overlay);
 let mode="learn",board=new Chess(),ply=0,practicePly=0,selected=null,finished=false,busy=false,feedback="",failed=false,successRecorded=false;
 const moveFor=(position,uci)=>position.moves({verbose:true}).find(m=>m.from+m.to+(m.promotion||"")===uci);
 const positionAt=index=>{
  const position=new Chess();
  for(let i=0;i<index;i++){const move=moveFor(position,line[i]);if(!move)break;position.move({from:move.from,to:move.to,promotion:move.promotion||"q"});}
  return position;
 };
 const completedSteps=()=>userIndices.filter(i=>i<ply).length;
 const practiceSteps=()=>userIndices.filter(i=>i<practicePly).length;
 const autoPracticeReplies=()=>{
  while(practicePly<line.length&&board.turn()!==side){
   const reply=moveFor(board,line[practicePly]);if(!reply)break;
   const played=board.move({from:reply.from,to:reply.to,promotion:reply.promotion||"q"});window.CoachSound?.play(played);practicePly++;
  }
 };
 const setLearnStep=step=>{
  const safe=Math.max(0,Math.min(userIndices.length,step)),index=safe>=userIndices.length?line.length:userIndices[safe];
  mode="learn";board=positionAt(index);ply=index;practicePly=0;selected=null;finished=false;busy=false;feedback="";draw();
 };
 const beginPractice=()=>{
  mode="practice";board=new Chess();practicePly=0;selected=null;finished=false;busy=false;failed=false;successRecorded=false;feedback="Retrouve les coups de ton camp. Les réponses adverses seront jouées automatiquement.";autoPracticeReplies();draw();
 };
 const close=()=>{overlay.remove();config.onClose?.();};
 const squareCenter=sq=>{
  let file=sq.charCodeAt(0)-97,rank=Number(sq[1])-1;if(side==="b"){file=7-file;rank=7-rank;}
  return {x:file*12.5+6.25,y:(7-rank)*12.5+6.25};
 };
 const arrowFor=move=>{
  if(!move)return "";
  const a=squareCenter(move.slice(0,2)),b=squareCenter(move.slice(2,4));
  return '<svg class="opening-study-arrows" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="openingLearningArrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0 0L4 2L0 4Z" fill="#f2b84b"/></marker></defs><line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#f2b84b" stroke-width="1.9" stroke-linecap="round" marker-end="url(#openingLearningArrow)"/></svg>';
 };
 const draw=()=>{
  const ranks=side==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8],files=side==="w"?"abcdefgh":"hgfedcba";
  const legal=mode==="practice"&&selected?board.moves({square:selected,verbose:true}):[],targets=new Map(legal.map(m=>[m.to,m.captured?"capture":"move"]));
  let cells="";
  ranks.forEach((rank,r)=>[...files].forEach((file,f)=>{
   const sq=file+rank,p=board.get(sq),light=((rank-1+(file.charCodeAt(0)-97))%2)===1,classes=["opening-square",light?"light":"dark"];
   if(selected===sq)classes.push("selected");if(targets.has(sq))classes.push(targets.get(sq)==="capture"?"capture-target":"legal-target");
   const coords=(f===0?'<span class="opening-rank-coordinate">'+rank+'</span>':"")+(r===7?'<span class="opening-file-coordinate">'+file.toUpperCase()+'</span>':"");
   cells+='<button type="button" class="'+classes.join(" ")+'" data-opening-learning-square="'+sq+'" aria-label="'+sq+'">'+(p?'<img class="chess-piece-image" src="https://lichess1.org/assets/piece/cburnett/'+p.color+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':"")+coords+(targets.has(sq)&&targets.get(sq)==="move"?'<i class="opening-legal-dot"></i>':"")+'</button>';
  }));
  const step=mode==="learn"?completedSteps():practiceSteps(),total=userIndices.length,percent=Math.max(0,Math.min(100,Math.round(step/total*100)));
  const activeMove=mode==="learn"&&ply<line.length?moveFor(board,line[ply]):null;
  const moveExplanation=activeMove?openingMoveExplanation(board,activeMove,game,side):"La séquence est terminée. Tu peux maintenant la rejouer sans aide.";
  let plan="Observe le développement des pièces, le contrôle du centre et la sécurité du roi.";
  try{plan=openingStrategicPlan(game,side)||plan;}catch(error){console.warn("Conseil stratégique indisponible",error);}
  const isLearn=mode==="learn",isComplete=isLearn&&ply>=line.length;
  const status=isLearn?"APPRENTISSAGE GUIDÉ":"EXERCICE SANS AIDE";
  const panelTitle=isLearn?(isComplete?"Séquence expliquée":"Pourquoi ce coup ?"):(finished?"Séquence maîtrisée !":"À toi de jouer");
  const panelText=isLearn?moveExplanation:(finished?"Bravo, tu as retrouvé toute la séquence.":feedback||"Retrouve la suite que tu viens d’étudier. Les explications restent masquées pendant cet exercice.");
  const replyNote=isLearn&&feedback?'<p class="opening-learning-reply">'+esc(feedback)+'</p>':"";
  const planMarkup=isLearn?'<div class="opening-learning-plan"><small>PLAN DE L’OUVERTURE</small><p>'+esc(plan)+'</p></div>':"";
  const practiceAction=finished&&config.onNext?'<button type="button" class="primary-button opening-learning-next" data-opening-learning-next-position>Nouvelle position</button>':'<button type="button" class="primary-button opening-learning-next" data-opening-learning-restart>'+(finished?"Rejouer l’exercice":"Recommencer")+'</button>';
  const controls=isLearn
   ?'<div class="opening-learning-actions"><button type="button" class="secondary-button opening-learning-previous" data-opening-learning-previous '+(step===0?'disabled':'')+'>← Précédent</button><button type="button" class="primary-button opening-learning-next" data-opening-learning-next>'+(isComplete?"Commencer l’exercice":"Continuer")+'</button></div>'
   :'<div class="opening-learning-actions"><button type="button" class="secondary-button opening-learning-book" data-opening-learning-book>📖 Revoir les explications</button>'+practiceAction+'</div>';
  overlay.innerHTML='<div class="opening-study-page opening-learning-page"><header class="opening-study-top opening-learning-top"><div class="opening-learning-heading"><p class="eyebrow">'+status+'</p><h2>'+(isLearn?"Explications":"Exercice")+'</h2><p class="muted">'+esc(title)+' · '+esc(family)+'</p></div><button type="button" class="opening-learning-close" data-opening-session-close aria-label="Fermer">×</button></header><div class="opening-learning-progress"><div class="opening-learning-progress-meta"><strong>'+(isLearn?"Séquence d’apprentissage":"Mémorisation sans aide")+'</strong><span>'+step+' / '+total+' coups</span></div><div class="opening-learning-progress-track"><span style="width:'+percent+'%"></span></div></div><main class="opening-study-content opening-learning-content"><div class="opening-study-board-wrap opening-learning-board-wrap"><div class="opening-study-board">'+cells+'</div>'+(isLearn?arrowFor(activeMove):"")+'</div><aside class="opening-study-side opening-learning-side"><span class="engine-badge ready">'+(isLearn?(isComplete?"PRÊT POUR L’EXERCICE":"COUP "+Math.min(step+1,total)+" · À OBSERVER"):"MODE MÉMORISATION")+'</span><h3>'+esc(panelTitle)+'</h3><p>'+esc(panelText)+'</p>'+replyNote+planMarkup+controls+'</aside></main><div class="opening-learning-mobile-footer">'+controls+'</div></div>';
  overlay.querySelectorAll(".chess-piece-image").forEach(img=>img.addEventListener("error",()=>{const fallback=document.createElement("span");fallback.className="piece";fallback.textContent=img.alt;img.replaceWith(fallback);},{once:true}));
 };
 const advanceGuide=()=>{
  if(ply>=line.length){beginPractice();return;}
  const move=moveFor(board,line[ply]);if(!move){ply=line.length;draw();return;}
  const played=board.move({from:move.from,to:move.to,promotion:move.promotion||"q"});window.CoachSound?.play(played);ply++;
  const replies=[];
  while(ply<line.length&&board.turn()!==side){
   const reply=moveFor(board,line[ply]);if(!reply)break;
   const replyMove=board.move({from:reply.from,to:reply.to,promotion:reply.promotion||"q"});window.CoachSound?.play(replyMove);replies.push(reply.san);ply++;
  }
  feedback=replies.length?"Après ton coup, l’adversaire répond "+replies.join(", ")+". Observe la nouvelle position.":"Observe la conséquence de ton coup sur la position.";
  draw();
 };
 const restartPractice=()=>beginPractice();
 overlay.addEventListener("click",event=>{
  if(event.target.closest("[data-opening-session-close]")){close();return;}
  if(event.target.closest("[data-opening-learning-previous]")){
   if(mode!=="learn")return;setLearnStep(Math.max(0,completedSteps()-1));return;
  }
  if(event.target.closest("[data-opening-learning-next]")){
   if(mode!=="learn")return;if(ply>=line.length)beginPractice();else advanceGuide();return;
  }
  if(event.target.closest("[data-opening-learning-book]")){setLearnStep(0);return;}
  if(event.target.closest("[data-opening-learning-next-position]")){const next=config.onNext;close();next?.();return;}
  if(event.target.closest("[data-opening-learning-restart]")){restartPractice();return;}
  if(mode!=="practice"||busy||finished)return;
  const button=event.target.closest("[data-opening-learning-square]");if(!button)return;
  const square=button.dataset.openingLearningSquare,piece=board.get(square);
  if(!selected){if(piece&&piece.color===side){selected=square;draw();}return;}
  if(piece&&piece.color===side){selected=square;draw();return;}
  const move=board.moves({square:selected,verbose:true}).find(m=>m.to===square);if(!move){selected=null;draw();return;}
  const played=move.from+move.to+(move.promotion||""),expected=line[practicePly];
  if(played!==expected){
   if(!failed){failed=true;config.onFailure?.();}
   selected=null;feedback="Ce n’est pas le coup attendu. Cherche encore la bonne suite.";draw();return;
  }
  const playedMove=board.move({from:move.from,to:move.to,promotion:move.promotion||"q"});window.CoachSound?.play(playedMove);practicePly++;selected=null;
  if(practicePly>=line.length){
   finished=true;if(!successRecorded){successRecorded=true;config.onSuccess?.(failed);}
   feedback="Bravo ! Tu as reproduit toute la séquence. Tu peux revoir les explications avec le bouton livre.";draw();return;
  }
  if(board.turn()!==side){busy=true;window.setTimeout(()=>{
   if(!overlay.isConnected||mode!=="practice"){busy=false;return;}
   autoPracticeReplies();busy=false;
   if(practicePly>=line.length){finished=true;if(!successRecorded){successRecorded=true;config.onSuccess?.(failed);}feedback="Bravo ! Tu as reproduit toute la séquence.";}
   else feedback="Bien joué. Continue la séquence.";
   draw();
  },420);}else{feedback="Bien joué. Continue la séquence.";draw();}
 });
 try{setLearnStep(0);}
 catch(error){overlay.remove();throw error;}
 return overlay;
}
function startLineStudy(variant,index){
 const game=variant.games?.[0]||{},bookLine=variant.book?.moves||[],playedLine=gameMoves(game),sourceLine=bookLine.length>=8?bookLine:playedLine,line=sourceLine.slice(0,24);
 if(!line.length){const preview=$("opening-preview-"+index);if(preview){preview.hidden=false;preview.innerHTML='<p class="muted">Aucune suite de coups exploitable pour cette variante.</p>';}return;}
 const userSide=sideOf(game)==="black"?"b":"w";
 launchOpeningLearningSession({line,side:userSide,title:variant.name||variant.display||"Ligne d’ouverture",family:game.opening||game.displayOpening||"Variante de ton répertoire",game,onClose:()=>{}});
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
async function startExercise(group,previousKey=""){
 await strategicIdeasPromise;
 const root=$("opening-detail");
 if(!group?.games?.length)return;
 currentKey=group.key;
 const filter=$("opening-color-filter")?.value||"all",white=group.games.filter(g=>sideOf(g)==="white").length,black=group.games.length-white;
 let side=filter==="white"?"w":filter==="black"?"b":(white>=black?"w":"b");
 try{
  let candidates=exercisePositions(group,side);
  if(!candidates.length){side=side==="w"?"b":"w";candidates=exercisePositions(group,side);}
  if(!candidates.length){
   if(root){
    root.innerHTML='<article class="surface opening-detail-card"><p class="muted">Je n’ai pas trouvé de séquence exploitable dans les parties de cette ouverture. Choisis une autre ligne ou vérifie les parties associées.</p><button type="button" class="text-button" id="close-opening-exercise">← Retour</button></article>';
    root.querySelector("#close-opening-exercise")?.addEventListener("click",()=>renderDetail(group));
   }else window.alert("Aucune séquence exploitable n’a été trouvée pour cette ouverture.");
   return;
  }
  const candidateIndex=chooseCandidate(candidates,previousKey),item=candidates[candidateIndex];
  const overlay=launchOpeningLearningSession({
   line:item.line,side,title:item.openingName||group.family,family:group.family,game:item.game,
   onFailure:()=>recordLearning(item,false),
   onSuccess:hadError=>recordLearning(item,true,hadError),
   onNext:()=>startExercise(group,item.key),
   onClose:()=>{$("panel-openings")?.classList.remove("opening-exercise-active");const back=$("[data-opening-back]");if(back)back.hidden=true;renderDetail(group);}
  });
  if(!overlay)throw new Error("La séquence d’ouverture ne contient aucun coup jouable.");
  $("panel-openings")?.classList.add("opening-exercise-active");
  const backTab=$("[data-opening-back]");if(backTab)backTab.hidden=false;
 }catch(error){
  console.error("Impossible de lancer l’exercice d’ouverture",error);
  document.querySelectorAll(".opening-study-overlay").forEach(node=>node.remove());
  $("panel-openings")?.classList.remove("opening-exercise-active");
  const back=$("[data-opening-back]");if(back)back.hidden=true;
  if(root){
   root.innerHTML='<article class="surface opening-detail-card"><p class="muted">L’exercice n’a pas pu démarrer correctement. Tu peux réessayer sans perdre tes données.</p><button type="button" class="primary-button" id="retry-opening-exercise">Réessayer</button><button type="button" class="text-button" id="close-opening-exercise">← Retour</button></article>';
   root.querySelector("#retry-opening-exercise")?.addEventListener("click",()=>startExercise(group,previousKey));
   root.querySelector("#close-opening-exercise")?.addEventListener("click",()=>renderDetail(group));
  }else window.alert("L’exercice n’a pas pu démarrer. Réessaie depuis le détail de l’ouverture.");
 }
}

document.addEventListener("click",event=>{
 const moduleButton=event.target.closest("[data-learn-module]");
 if(moduleButton?.dataset.learnModule==="openings"){showLearnSubview("learn-opening-choice");return;}
 if(moduleButton?.dataset.learnModule==="training"){showLearnSubview("learn-training-choice");return;}
 if(moduleButton?.dataset.learnModule==="errors"){window.dispatchEvent(new CustomEvent("coach:launch-error-session"));return;}
 const back=event.target.closest("[data-learn-back]");
 if(back){const parent=back.closest(".learn-subview")?.id;showLearnSubview(["learn-opening-choice","learn-training-choice","learn-errors-view"].includes(parent)?"learn-hub":"learn-opening-choice");return;}
 const viewButton=event.target.closest("[data-learn-opening-view]");
 if(viewButton){showLearnSubview(viewButton.dataset.learnOpeningView==="explorer"?"learn-opening-explorer":"learn-opening-detected");return;}
 const explorerFamily=event.target.closest("[data-explorer-family]");
 if(explorerFamily){renderExplorerLines(Number(explorerFamily.dataset.explorerFamily));return;}
 const explorerStudy=event.target.closest("[data-explorer-study]");
 if(explorerStudy){const item=$("opening-explorer-lines")._lines?.[Number(explorerStudy.dataset.explorerStudy)];if(item){const game={pgn:item.pgn,white:currentUser(),black:"Bibliothèque",opening:item.name,eco:item.eco};startLineStudy({name:item.display,games:[game],book:item},"explorer");}return;}
 const exerciseButton=event.target.closest("[data-opening-family-exercise]");
 if(exerciseButton){event.preventDefault();event.stopPropagation();const g=groups.find(x=>x.key===exerciseButton.dataset.openingFamilyExercise);if(g)startExercise(g).catch(error=>{console.error("Erreur de lancement de l’exercice",error);document.querySelectorAll(".opening-study-overlay").forEach(node=>node.remove());$("panel-openings")?.classList.remove("opening-exercise-active");window.alert("Impossible de préparer cet exercice. Réessaie dans quelques instants.");});return;}
 const button=event.target.closest("[data-opening-family]");if(button){const g=groups.find(x=>x.key===button.dataset.openingFamily);if(g)renderDetail(g);}
});
$("opening-color-filter")?.addEventListener("change",render);
$("opening-explorer-search")?.addEventListener("input",event=>renderExplorer(event.target.value));

window.addEventListener("coach:games-updated",()=>{if($("panel-openings")?.classList.contains("active"))render();});
document.querySelectorAll("[data-opening-color]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-opening-color]").forEach(item=>item.classList.toggle("active",item===button));render();}));
window.addEventListener("coach:account-changed",()=>{document.querySelectorAll(".opening-study-overlay").forEach(node=>node.remove());$("panel-openings")?.classList.remove("opening-exercise-active");$("opening-detail").innerHTML="";loadLearning();currentKey=null;showAllOpenings=false;showLearnSubview("learn-hub");render();});
const strategicIdeasPromise=loadStrategicIdeas();
loadLearning();loadDatabase().then(()=>{render();renderExplorer();});render();

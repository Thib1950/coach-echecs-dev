// chess.js is loaded with ordered CDN fallbacks. Some in-app browsers block
// jsDelivr's transformed ESM endpoint even when the page itself is reachable.
let chessModule=null;
const chessSources=[
  "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm",
  "https://unpkg.com/chess.js@1.4.0/dist/esm/chess.js",
  "https://esm.sh/chess.js@1.4.0?bundle"
];
const chessLoadErrors=[];
for(const source of chessSources){
  try{
    chessModule=await import(source);
    if(typeof chessModule.Chess==="function")break;
    chessModule=null;
    chessLoadErrors.push(source+": export Chess introuvable");
  }catch(error){
    chessLoadErrors.push(source+": "+(error?.message||String(error)));
  }
}
if(!chessModule?.Chess){
  throw new Error("Impossible de charger le moteur de règles d'échecs. Vérifie la connexion du navigateur. "+chessLoadErrors.join(" | "));
}
export const Chess=chessModule.Chess;

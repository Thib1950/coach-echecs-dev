const CACHE="coach-echecs-dev-shell-v46";
const FILES=["./","./index.html","./styles.css","./app.js","./analysis.js","./review.js","./lesson.js","./openings.js","./puzzles.js","./curriculum.js","./engine-worker.js","./manifest.webmanifest","./favicon.svg"];

// Le moteur est servi sous une URL de même origine. Le service worker récupère
// les fichiers officiels Stockfish 19 Lite Single depuis le paquet npm, puis
// les conserve dans le cache local : pas d'importScripts cross-origin.
const ENGINE_FILES={
  "stockfish-19-lite-single.js":[
    "https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-lite-single.js",
    "https://unpkg.com/stockfish@19.0.1/bin/stockfish-19-lite-single.js"
  ],
  "stockfish-19-lite-single.wasm":[
    "https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-lite-single.wasm",
    "https://unpkg.com/stockfish@19.0.1/bin/stockfish-19-lite-single.wasm"
  ]
};

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("coach-echecs-dev-shell-")&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function loadEngineAsset(request,name){
  const cache=await caches.open(CACHE);
  const localUrl=new URL("./vendor/stockfish/"+name,self.registration.scope);
  const cached=await cache.match(localUrl.href);
  if(cached)return cached;
  let lastError=null;
  for(const url of ENGINE_FILES[name]){
    try{
      const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"force-cache"});
      if(!response.ok)throw new Error("HTTP "+response.status+" depuis "+url);
      if(response.type==="opaque")throw new Error("Réponse opaque : le navigateur ne peut pas lire le moteur.");
      const localResponse=new Response(await response.arrayBuffer(),{status:200,headers:{
        "Content-Type":name.endsWith(".wasm")?"application/wasm":"text/javascript; charset=utf-8",
        "Cache-Control":"public, max-age=31536000"
      }});
      await cache.put(localUrl.href,localResponse.clone());
      return localResponse;
    }catch(error){lastError=error;}
  }
  return new Response("Impossible de télécharger Stockfish 19 Lite : "+(lastError?.message||"réseau indisponible"),{
    status:502,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}
  });
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  const engineName=Object.keys(ENGINE_FILES).find(name=>url.pathname.endsWith("/vendor/stockfish/"+name));
  if(engineName){
    event.respondWith(loadEngineAsset(request,engineName));
    return;
  }

  // Réseau d'abord pour l'application ; cache en secours hors connexion.
  event.respondWith((async()=>{
    try{
      const response=await fetch(request,{cache:"no-store"});
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(request,response.clone());
      }
      return response;
    }catch(error){
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==="navigate"){
        const fallback=await caches.match("./index.html");
        if(fallback)return fallback;
      }
      throw error;
    }
  })());
});

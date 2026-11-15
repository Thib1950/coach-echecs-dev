// Build ASM-JS de Stockfish 19 : pas de WebAssembly à télécharger.
// Cela évite l'échec "Aborted(Load failed)" rencontré sur Safari/iPad
// pendant le chargement du fichier .wasm. Le moteur fonctionne dans un Worker.
const ENGINE_URL = "https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-asm.js";

self.postMessage("ENGINE_LOG Téléchargement du moteur Stockfish…");
try {
  importScripts(ENGINE_URL);
  self.postMessage("ENGINE_LOG Script Stockfish chargé · attente de la réponse UCI…");
} catch (error) {
  self.postMessage("ENGINE_FATAL Échec du téléchargement/exécution de " + ENGINE_URL + " — " + (error && error.message ? error.message : String(error)));
}

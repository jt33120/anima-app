// Stub de test pour le paquet `server-only` (aliasé dans vitest.config.ts).
// En prod/bundle, `server-only` jette si importé côté client ; en environnement de test node,
// on le neutralise pour pouvoir exercer les modules serveur (ex. lib/safety/appliquer-barriere).
export {};

# 📋 Aggiornamenti — HaxBall 2

Versione più recente sempre in cima. Ad ogni modifica aggiornare `VERSION` in `js/config.js`.

---

## v2.18.0 — Fix doppio tocco pallavolo (definitivo)

### 🔧 Fix
- **Doppio tocco** (`server.js` → `vTick`, `js/modes/volley/game.js` → `vUpdate`): il Set `kickedThisTick` era stato perso durante i rewrite successivi alla v2.14. Riaggiunto in entrambi i posti. Il check post-tick (per palle veloci che attraversano il player) ora salta esplicitamente i player che hanno già tirato nello step 1 dello stesso tick, eliminando il doppio conteggio.
- Nel client il guard usa il confronto `vBall.vx/vy !== prev` per rilevare se `vApplyInput` ha tirato, senza modificare la firma di `vDoKick`.

---

## v2.17.0 — Fix late-join: schermo nero

### 🔧 Fix
- **`hidePrematch()` mancante nel late-join** (`js/network-core.js` → case `start` con `lateJoin:true`): il codice impostava `game.style.display = 'flex'` e chiudeva il menu con `closeMenu()`, ma non chiamava `hidePrematch()`. La funzione `showPrematch` nasconde HUD e barra controlli con `visibility:hidden`; senza `hidePrematch()` il canvas girava ma l'utente vedeva ancora la schermata prematch vuota. Aggiunta la chiamata per entrambe le modalità (calcio e pallavolo).
- **`netMode = 'guest'` anticipato** prima di `startLoop()`/`vStartLoop()`: prima veniva impostato dopo l'avvio del loop, causando un frame in cui `sendGuestInput` non inviava input perché `netMode !== 'guest'`.
- **`wsRoom` impostato per il late-joiner**: chi entrava a partita avviata non aveva `wsRoom` settato, impedendo operazioni successive (es. leave corretto).
- **`vReset(false)` + `vUpdateHUD()`** aggiunti per pallavolo: inizializza lo stato visivo (palla, HUD timer/score) senza resettare score/time.

---

## v2.16.0 — Fix critico: doppia dichiarazione V_CONFIG → schermo nero

### 🔧 Fix
- **`V_CONFIG` dichiarata due volte**: `js/state.js` conteneva una seconda definizione `let V_CONFIG = {...}` aggiunta erroneamente nelle sessioni precedenti. Poiché `js/modes/volley/config.js` la dichiara già con `let`, il browser lanciava `SyntaxError: Identifier 'V_CONFIG' has already been declared` — bloccando tutto il JavaScript al caricamento. Causa dello schermo nero su qualsiasi partita. Rimossa da `state.js`; aggiunto commento che indica la posizione corretta.
- **Stesso problema per `V_CONFIG_META`**: rimossa da `state.js`.
- **`VERSION` aggiornata a `2.16.0`** in `js/config.js` (le versioni 2.9–2.15 non avevano mai modificato il file su disco).

---

## v2.15.0 — Fix firma vDoKick, doppio tocco, tentativi V_CONFIG

### 🔧 Fix
- **Firma `vDoKick(p, advanced)`**: parametro `advanced` reso esplicito; rimosso riferimento a `vControlMode` globale dentro la funzione.
- **Doppio tocco per tiro**: aggiunto `_vKickedThisTick` Set in training e `kickedThisTick` nel server — il check post-tick per palle veloci salta i player che hanno già tirato nello stesso frame.

---

## v2.14.0 — Fix doppio tocco pallavolo

### 🔧 Fix
- Tiro contato due volte per tick (pre-tick + post-tick). Aggiunto `kickedThisTick` Set.

---

## v2.13.0 — vAdvanced per-player, V_CONFIG live server-side

### 🔧 Fix
- **`vAdvanced` per-player** (`server.js`): `p.vAdvanced` invece di `room.vAdvanced`. Due dispositivi con modalità diverse non si sovrascrivono più.
- **`vmode` inviato all'avvio** (`js/modes/volley/game.js` → `startVolleyGame`).

### ✨ Novità
- **`V_CONFIG` live server-side**: `room.vconfig`, handler `set_vconfig`, broadcast `vconfig`. Pannello Variabili invia `set_vconfig` per le variabili volley.
- **`vconfig` applicato su `created`/`joined`/`start`** (`js/network-core.js`).

---

## v2.12.0 — Snapshot interpolation player remoti

### ✨ Novità
- Buffer 5 snapshot per player remoti, render a `now - INTERP_DELAY_MS (50ms)`.
- `snapshotBuffer` / `vSnapshotBuffer` in `state.js`.
- `interpolateRemotePlayers` / `vInterpolateRemotePlayers` in sync.js.
- Buffer svuotato a gol/reset.
- Correzione prediction locale: `alpha = min(0.12, dist * 0.015)`.

---

## v2.11.0 — Fix tocchi avversario, modalità avanzata online, animazioni

### 🔧 Fix
- **Tocchi avversario azzerati al tiro** (`vIncrementTouch`, `server.js` → `vTick`).
- **Modalità avanzata online** (`js/menu.js`): toggle invia `vmode` al server.

### ✨ Novità
- BASE: tiro continuo ogni frame con AZIONE premuta.
- Rallentamento con AZIONE (`topSpd * 0.45`) in entrambe le modalità.
- Animazione: cerchio giallo sul player (immediato in base, crescente con carica in avanzata). Rimossa freccia.

---

## v2.10.0 — Nessuna collisione player↔palla

### 🔧 Fix
- Rimossa `vPlayerBallCollide` / `vPlayerBallCollideSrv`.
- `vDoKick` tira solo se `dist < p.r + V_BR`.

---

## v2.9.0 — Solo AZIONE muove la palla, reset tocchi corretto

### 🔧 Fix
- Nessun impulso al contatto fisico. Solo AZIONE muove la palla.
- Reset tocchi entrambe squadre al cambio lato.
- `vApplyInputSrv` ritorna `true` se ha tirato.

---

## v2.8.0 — Fix fisica pallavolo, controlli avanzati, V_CONFIG, fix chat doppia

### ✨ Novità
- Modalità avanzata: carica con AZIONE, anello animazione.
- `V_CONFIG` e `V_CONFIG_META` in `js/modes/volley/config.js`.
- Pannello Variabili mostra variabili per modalità.
- `vControlMode` salvato in `localStorage`.

### 🔧 Fix
- Chat doppia online risolta.
- Rimossa meccanica cattura/offset.

---

## v2.7.0 — Nuova modalità: Pallavolo 🏐

### ✨ Novità
- Modalità completa: `config.js`, `physics.js`, `draw.js`, `sync.js`, `game.js`.
- Gravità progressiva, muretto centrale, regola 3 tocchi, punto al pavimento.
- Server-side con `vTick`, costanti `V_` duplicate nel server.
- Mode picker in lobby e allenamento.
- Routing modalità in `network-core.js` via `currentGameMode`.

---

## v2.6.1 — CONFIG isolata per stanza

### 🔧 Fix
- `CONFIG_DEFAULT` immutabile; ogni room ha `room.config = {...CONFIG_DEFAULT}`.

---

## v2.6.0 — CONFIG live con slider

### ✨ Novità
- Pannello Variabili con slider live, `set_config` host-only, `CONFIG_META` in `state.js`.

---

## v2.5.0 — Kick-start movimento

### ✨ Novità
- Velocità immediata alla pressione direzionale (`P_START = 1.4`).

---

## v2.4.0 — Fix nero late-join, accelerazione graduale, selezione modalità

---

## v2.3.0 — Fix nero, AFK, lobby realtime, prediction toggle, tasti P/ESC

---

## v2.2.0 — Fine partita, crea stanza con nome/password, lista stanze

---

## v2.1.0 — Fix allenamento, join in-game, codice stanza nel menu

---

## v2.0.0 — Allenamento client-side, join in-game, UX lobby

---

## v1.9.0 — Timestep fisso, palla fluida, frizione dead reckoning

---

## v1.8.0 — Velocità player aumentata

---

## v1.7.0 — Server completamente autoritativo, rimossa client prediction

---

## v1.6.0 — Fix rubber-banding

---

## v1.5.0 — Dead reckoning + lerp adattivo, broadcast 60Hz

---

## v1.4.0 — Ottimizzazione pacchetti rete (bitmask input, state compatto, meta separato)

---

## v1.3.0 — Stato iniziale documentato

# 📋 Aggiornamenti — HaxBall 2

Questo file tiene traccia delle modifiche e delle nuove funzionalità introdotte nelle varie versioni del progetto. Ogni volta che viene rilasciata una nuova versione, aggiungere una nuova sezione in cima a questo file (ordine cronologico inverso: la versione più recente sempre in alto).

---

## v2.0.0 — Allenamento client-side, join in-game, UX lobby e fix vari

### ✨ Novità
- **Modalità allenamento completamente client-side** (`js/game.js`): la fisica, i gol e il timer vengono ora simulati localmente senza toccare il server. Funziona offline, restart immediato.
- **Join durante la partita** (`server.js`, `js/network.js`): un giocatore può connettersi a una stanza anche a partita già iniziata. Entra automaticamente come spettatore, riceve lo stato corrente, e appare un messaggio in chat per tutti. L'host può spostarlo in una squadra dal menu.
- **Host va subito in prematch** (`js/lobby.js`, `js/network.js`): dopo aver creato la stanza, l'host non aspetta più nella schermata principale ma viene portato direttamente nel menu pre-partita. Il codice stanza appare come messaggio di sistema in chat.
- **Chat si apre con Invio** (`js/input.js`): premere Enter durante il gioco apre la chat. Se la chat è già aperta, Enter invia il messaggio (già funzionava).
- **Player più veloci**: `P_SPEED` da 2.0 a 2.3, `P_ACCEL` da 0.40 a 0.42 (`js/config.js`, `server.js`).

### 🔧 Fix
- **Fix /afk** (`js/network.js`): il player locale ora viene nascosto correttamente (`x=-9999`) quando va AFK, e il team viene ripristinato correttamente al ritorno. Prima il player rimaneva visibile come fantasma in alto a sinistra e non riusciva più a muoversi dopo il secondo toggle.
- **Host può spostare se stesso** (`js/prematch.js`): rimosso il blocco `r.id !== myPlayerId` per l'host nel roster del prematch.

---

## v1.9.0 — Timestep fisso, palla fluida, frizione corretta

### 🔧 Fix
- **Timestep fisso per dead reckoning** (`js/game.js`): introdotto accumulatore `physAccum` con tick fissi da 16.67ms. Su monitor a 120/144Hz il dead reckoning girava 2x più veloce del server (causando avanzamento eccessivo + snap all'indietro ad ogni pacchetto). Ora: a 60Hz → 1 tick/frame; a 120Hz → alterna 0/1 tick; a 30fps → 2 tick. Comportamento identico su qualsiasi refresh rate.
- **Palla fluida sui tiri** (`js/network.js` → `applyRemoteState`): rimosso snap basato su velocità alta (`bspd > 4`). Ora snap solo su salto di velocità (`velJump > 1.5`, indica bounce/kick appena avvenuto) o distanza > 40px. Durante il volo libero lerp leggero 0.35 per correggere la deriva minima del dead reckoning. Prima lo snap continuo su ogni pacchetto causava micro-jitter visibile.
- **Frizione rimossa dai player nel dead reckoning** (`js/network.js` → `tickRemotePhysics`): i player remoti non decelerano più nel gap tra pacchetti. Lato server stanno ricevendo input continuo e non frenano davvero; applicare `P_FRIC` localmente causava undershoot costante. La frizione reale arriva con il prossimo state. La palla mantiene `B_FRIC` (rallenta da sola come sul server).

---

## v1.8.0 — Fluidità palla + velocità player

### ✨ Novità
- **Player più veloci**: `P_SPEED` da 1.65 a 2.0, `KICK_MAX` da 12 a 14 (`js/config.js`, `server.js`). Non impatta il lag: la fisica è server-side, i pacchetti sono gli stessi.

### 🔧 Fix
- **Palla fluida sui tiri veloci** (`js/network.js` → `applyRemoteState`): rimosso il lerp limitante sulla palla. Ora se la velocità della palla è >4 o la distanza >60px viene fatto snap diretto alla posizione server; il dead reckoning la tiene già al posto giusto tra i pacchetti, quindi lo snap è impercettibile. Sotto soglia lerp 0.95 (quasi snap).

---

## v1.7.0 — Rimozione client prediction, server completamente autoritativo

### 🔧 Fix
- **Rimossa client prediction sul giocatore locale** (`js/game.js`): `applyInput` non viene più chiamato sul proprio player nel loop guest. La prediction causava posizioni visive non reali (il giocatore sembrava andare più veloce delle collisioni effettive).
- **Dead reckoning esteso a tutti** (`js/network.js` → `tickRemotePhysics`): ora muove tutti i player (incluso il locale) e la palla con l'ultima velocità nota tra un pacchetto e l'altro. Il server corregge ad ogni pacchetto (60Hz) tramite lerp adattivo.
- **`applyRemoteState` corregge tutti** (`js/network.js`): rimossa l'eccezione `myPlayerId`. Il server è l'unica fonte di verità per le posizioni.
- Lerp adattivo leggermente più aggressivo (L max 0.9 invece di 0.85).

## v1.6.0 — Fix rubber-banding + dead reckoning corretto

### 🔧 Fix
- **Rimosso il rubber-banding sul giocatore locale** (`js/network.js` → `applyRemoteState`): il giocatore locale ora viene escluso dalla correzione server-state. Prima veniva tirato indietro verso la posizione server (in ritardo del ping), causando il "tu laggi mentre gli altri sono fluidi".
- **Dead reckoning solo sui remoti** (`js/network.js` → `tickRemotePhysics`): la palla non veniva più mossa due volte (rimossa la duplicazione del movimento in `tickRemotePhysics`). Solo i giocatori remoti vengono predetti tra un pacchetto e l'altro.

---

## v1.5.0 — Ottimizzazione fluidità: dead reckoning + lerp adattivo

### ✨ Novità
- **Dead reckoning** (`js/network.js` → `tickRemotePhysics`): i giocatori remoti vengono mossi ogni frame con la loro ultima velocità nota, rendendoli fluidi a 60fps tra i pacchetti server (invece di saltare ogni 33ms).
- **Lerp adattivo** (`js/network.js` → `applyRemoteState`): il fattore di interpolazione ora dipende dalla distanza tra posizione locale e server. Distanza piccola → lerp leggero (quasi invisibile); distanza grande → convergenza rapida. Snap diretto sopra 80px (respawn/gol).
- **Broadcast server a 60Hz** (`server.js`): da 30Hz a 60Hz per minimizzare il drift tra predizione client e stato reale.
- Dead reckoning agganciato al loop `update` solo in modalità `guest` (`js/game.js`).

---

## v1.4.0 — Ottimizzazione pacchetti di rete

### ✨ Novità / Modifiche
- **Input bitmask** (`js/network.js`, `server.js`): i 5 booleani di input (up/dn/lt/rt/kick) ora viaggiano come un singolo intero bitmask `b`. Rimossi `pid` e `ts` dal payload (il server conosce già il pid dalla connessione WS).
- **Input inviato solo sui cambi** (`js/network.js` → `sendGuestInput`): se il bitmask non cambia rispetto al frame precedente, nessun messaggio viene inviato. Da 60 msg/s a pochi al secondo in idle.
- **Ping separato ogni 2s** (`js/network.js`, `server.js`): il timestamp per il calcolo del ping è stato spostato in un messaggio `ping`/`pong` dedicato inviato ogni 2 secondi, non più agganciato ad ogni frame di input.
- **State compatto** (`server.js` → `serializeState`): rimossi `ts`, `afk`, `skins`, `score`, `timeLeft`, `gameOver` dallo state. I player ora sono array posizionali `[x,y,vx,vy,charge,held]` senza `id`/`team` ripetuti. Posizioni arrotondate a interi, velocità a 2 decimali. Dimensione: ~70-90 byte contro i ~350-450 byte precedenti.
- **Evento `meta`** (`server.js`, `js/network.js`): score/timer/gameOver ora viaggiano in un messaggio separato inviato solo quando cambiano (≈1 volta/s per il timer, raramente per score/gameOver).
- **`team_change` minimale** (`server.js`, `js/network.js`): il server manda solo `{pid, team}` invece del roster completo. Il client aggiorna localmente la singola entry.
- **`host_change`** (`server.js`, `js/network.js`): nuovo evento dedicato al cambio host, invia solo `{hostId}` invece di tutto il roster.
- **Rimosso `ts` dalla chat** (`server.js`, `js/network.js`): non veniva usato dal renderer.
- **Fix `movePlayerToTeam`** (`js/prematch.js`): usava `channel.send` di Supabase (codice morto). Ora usa correttamente `wsSend`.

---

## v1.3.0 — Stato iniziale documentato

> ⚠️ Nota: questa è la prima fotografia "completa" del progetto registrata in questo changelog. Da qui in avanti, ogni nuova versione dovrà elencare solo le **differenze** rispetto a quella precedente. Di seguito è descritto lo stato attuale di tutte le funzionalità presenti nel codice, con indicazione di dove si trovano.

### 🌐 Multiplayer online (Supabase Realtime)
- Creazione stanza con codice a 6 caratteri e gestione canali broadcast (`js/lobby.js`, `js/network.js`)
- Ingresso in una stanza tramite codice (`js/lobby.js`)
- Sincronizzazione stato partita host → guest (posizioni, palla, punteggio, timer) (`js/network.js`, funzione `serializeState`/`applyRemoteState`)
- Invio input dei giocatori guest verso l'host (`sendGuestInput`, `js/network.js`)
- Calcolo e visualizzazione del ping (`js/lobby.js`, badge `#ping` in `index.html`)

### 🛋️ Sala d'attesa / Pre-match
- Schermata "stanza creata" con codice da condividere e stato giocatori connessi (`index.html` → `#card-wait`, `js/lobby.js`)
- Menu unificato pre-partita / in-partita con roster a 3 colonne (Rossi / Spettatori / Blu) (`js/prematch.js`, `css/game-menu.css`)
- L'host (👑) può spostare i giocatori tra le squadre toccando giocatore + colonna (`movePlayerToTeam`, `onPmPlayerTap` in `js/prematch.js`)
- Menu contestuale admin: trasferisci ruolo host / kick giocatore (tasto destro o pressione prolungata su mobile) (`js/prematch.js`, `js/network.js` → `adminKick`, `adminTransfer`)
- Avvio partita da parte dell'host con broadcast a tutti i partecipanti (`hostStartMatch`, `js/prematch.js`)
- Possibilità di tornare alla sala d'attesa dopo una partita (`backToPrematch`)

### 🎮 Modalità di gioco
- **Allenamento (solo)**: modalità single-player senza rete (`startTraining`, `js/game.js`)
- **Host / Guest**: partite online 1 contro 1 o più (in base ai giocatori in roster)
- Reset partita (gol singolo / restart completo) con relativo broadcast (`reset`, `goal`, `js/game.js`)
- Fine partita con messaggio vittoria/pareggio (`endGame`, `js/game.js`)

### ⚽ Motore fisico
- Movimento giocatori con accelerazione, attrito e rimbalzo sui bordi campo (`applyInput`, `js/physics.js`)
- Collisioni cerchio-cerchio tra giocatori e tra giocatore/palla (`circleCollide`, `js/physics.js`)
- Sistema di "carica tiro": tenendo premuto il tasto calcio si accumula potenza, mostrata con una freccia direzionale animata (`doKick`, `drawShotArrow` in `js/draw.js`)
- Fisica della palla con attrito, rimbalzo e rilevamento goal (`update`, `js/game.js`)
- Effetti particellari su tiri ed esultanze gol (`spawnP`, `goalBurst`, `js/particles.js`)

### 🖥️ Interfaccia e HUD
- HUD compatto con punteggio, timer, badge modalità rete (TRAIN/HOST/GUEST) e ping (`css/game.css`, `index.html` → `#hud`)
- Barra messaggi di gioco (gol, fine partita, ecc.) (`#msg-bar`)
- Effetto "flash" dorato sullo schermo al momento del gol (`#goal-flash`)
- Selettore vista/zoom campo con 10 livelli (0-9), richiamabile da tastiera (tasti numerici) o dal menu impostazioni (`js/views.js`, `css/game-menu.css`)
- Indicatore "vista" a comparsa temporanea in alto a destra (`#view-badge`)

### 💬 Chat in-game
- Overlay chat apribile/chiudibile con tasto dedicato (`toggleChat`, `js/prematch.js`)
- Invio messaggi e visualizzazione in tempo reale (`sendChatMsg`, `pushChatMsg`, `renderChat` in `js/network.js`)
- Notifica "toast" quando arriva un messaggio con chat chiusa (`showChatToast`, `js/network.js`)
- Sanificazione HTML dei messaggi (`escHtml`, `js/network.js`)

### 📱 Controlli touch (mobile)
- Joystick virtuale per il movimento (`#joy-area`, `js/input.js`)
- Tasto/area "TIRO" con indicatore ad arco della carica del tiro (`#kick-area`, `drawKickArc`, `js/input.js`)
- Rilevamento automatico dispositivi touch e posizionamento layer controlli (`isTouchDev`, `positionTouchLayer`)
- Blocco pinch-zoom e gesture indesiderate su iOS (`js/input.js`, `css/base.css`)

### 🏠 Lobby iniziale
- Inserimento nickname con salvataggio automatico in `localStorage` (`js/lobby.js`)
- Generazione codice stanza alfanumerico univoco (`genCode`, `js/lobby.js`)
- Tre percorsi: crea stanza, entra con codice, allenamento in solitaria
- Indicatore versione mostrato in basso nella lobby (`$('lobby-version')`)

### ⚙️ Configurazione
- Tutte le costanti di gioco centralizzate in `js/config.js`
- Numero di versione corrente: **1.3.0** (`js/config.js`)

---

## Come aggiornare questo file

Per ogni nuova versione, aggiungere in cima una sezione con questo formato:

```
## vX.Y.Z — Titolo breve della release

### ✨ Novità
- Descrizione modifica (file coinvolti)

### 🔧 Modifiche / Fix
- Descrizione modifica (file coinvolti)
```


> ⚠️ Nota: questa è la prima fotografia "completa" del progetto registrata in questo changelog. Da qui in avanti, ogni nuova versione dovrà elencare solo le **differenze** rispetto a quella precedente. Di seguito è descritto lo stato attuale di tutte le funzionalità presenti nel codice, con indicazione di dove si trovano.

### 🌐 Multiplayer online (Supabase Realtime)
- Creazione stanza con codice a 6 caratteri e gestione canali broadcast (`js/lobby.js`, `js/network.js`)
- Ingresso in una stanza tramite codice (`js/lobby.js`)
- Sincronizzazione stato partita host → guest (posizioni, palla, punteggio, timer) (`js/network.js`, funzione `serializeState`/`applyRemoteState`)
- Invio input dei giocatori guest verso l'host (`sendGuestInput`, `js/network.js`)
- Calcolo e visualizzazione del ping (`js/lobby.js`, badge `#ping` in `index.html`)

### 🛋️ Sala d'attesa / Pre-match
- Schermata "stanza creata" con codice da condividere e stato giocatori connessi (`index.html` → `#card-wait`, `js/lobby.js`)
- Menu unificato pre-partita / in-partita con roster a 3 colonne (Rossi / Spettatori / Blu) (`js/prematch.js`, `css/game-menu.css`)
- L'host (👑) può spostare i giocatori tra le squadre toccando giocatore + colonna (`movePlayerToTeam`, `onPmPlayerTap` in `js/prematch.js`)
- Menu contestuale admin: trasferisci ruolo host / kick giocatore (tasto destro o pressione prolungata su mobile) (`js/prematch.js`, `js/network.js` → `adminKick`, `adminTransfer`)
- Avvio partita da parte dell'host con broadcast a tutti i partecipanti (`hostStartMatch`, `js/prematch.js`)
- Possibilità di tornare alla sala d'attesa dopo una partita (`backToPrematch`)

### 🎮 Modalità di gioco
- **Allenamento (solo)**: modalità single-player senza rete (`startTraining`, `js/game.js`)
- **Host / Guest**: partite online 1 contro 1 o più (in base ai giocatori in roster)
- Reset partita (gol singolo / restart completo) con relativo broadcast (`reset`, `goal`, `js/game.js`)
- Fine partita con messaggio vittoria/pareggio (`endGame`, `js/game.js`)

### ⚽ Motore fisico
- Movimento giocatori con accelerazione, attrito e rimbalzo sui bordi campo (`applyInput`, `js/physics.js`)
- Collisioni cerchio-cerchio tra giocatori e tra giocatore/palla (`circleCollide`, `js/physics.js`)
- Sistema di "carica tiro": tenendo premuto il tasto calcio si accumula potenza, mostrata con una freccia direzionale animata (`doKick`, `drawShotArrow` in `js/draw.js`)
- Fisica della palla con attrito, rimbalzo e rilevamento goal (`update`, `js/game.js`)
- Effetti particellari su tiri ed esultanze gol (`spawnP`, `goalBurst`, `js/particles.js`)

### 🖥️ Interfaccia e HUD
- HUD compatto con punteggio, timer, badge modalità rete (TRAIN/HOST/GUEST) e ping (`css/game.css`, `index.html` → `#hud`)
- Barra messaggi di gioco (gol, fine partita, ecc.) (`#msg-bar`)
- Effetto "flash" dorato sullo schermo al momento del gol (`#goal-flash`)
- Selettore vista/zoom campo con 10 livelli (0-9), richiamabile da tastiera (tasti numerici) o dal menu impostazioni (`js/views.js`, `css/esc-menu.css`, `css/game-menu.css`)
- Indicatore "vista" a comparsa temporanea in alto a destra (`#view-badge`)

### 💬 Chat in-game
- Overlay chat apribile/chiudibile con tasto dedicato o tasto `T` (`toggleChat`, `js/prematch.js`)
- Invio messaggi via broadcast Supabase e visualizzazione in tempo reale (`sendChatMsg`, `pushChatMsg`, `renderChat` in `js/network.js`)
- Notifica "toast" quando arriva un messaggio con chat chiusa (`showChatToast`, `js/network.js`)
- Sanificazione HTML dei messaggi per evitare injection (`escHtml`, `js/network.js`)

### 📱 Controlli touch (mobile)
- Joystick virtuale per il movimento (`#joy-area`, `js/input.js`)
- Tasto/area "TIRO" con indicatore ad arco della carica del tiro (`#kick-area`, `drawKickArc`, `js/input.js`)
- Rilevamento automatico dispositivi touch e posizionamento layer controlli (`isTouchDev`, `positionTouchLayer`, `js/state.js` / `js/input.js`)
- Blocco pinch-zoom e gesture indesiderate su iOS (`js/input.js`, `css/base.css`)

### 🏠 Lobby iniziale
- Inserimento nickname con salvataggio automatico in `localStorage` (`js/lobby.js`)
- Generazione codice stanza alfanumerico univoco (`genCode`, `js/lobby.js`)
- Tre percorsi: crea stanza, entra con codice, allenamento in solitaria (`index.html` → `#lobby`)
- Indicatore versione mostrato in basso nella lobby, preso da `VERSION` in `js/config.js` (`$('lobby-version')`)

### ⚙️ Configurazione
- Tutte le costanti di gioco (dimensioni campo, velocità, fisica del tiro, durata partita, livelli di zoom) centralizzate in `js/config.js`
- Numero di versione corrente: **1.3.0** (`js/config.js`)

---

## Come aggiornare questo file

Per ogni nuova versione, aggiungere in cima una sezione con questo formato:

```
## vX.Y.Z — Titolo breve della release

### ✨ Novità
- Descrizione modifica (file coinvolti)

### 🔧 Modifiche / Fix
- Descrizione modifica (file coinvolti)
```

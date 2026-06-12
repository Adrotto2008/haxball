# 📋 Aggiornamenti — HaxBall 2

Questo file tiene traccia delle modifiche e delle nuove funzionalità introdotte nelle varie versioni del progetto. Ogni volta che viene rilasciata una nuova versione, aggiungere una nuova sezione in cima a questo file (ordine cronologico inverso: la versione più recente sempre in alto).

---

## v1.3.0 — Versione attuale

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

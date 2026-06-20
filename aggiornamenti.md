# 📋 Aggiornamenti — HaxBall 2

Questo file tiene traccia delle modifiche e delle nuove funzionalità introdotte nelle varie versioni del progetto. Ogni volta che viene rilasciata una nuova versione, aggiungere una nuova sezione in cima a questo file (ordine cronologico inverso: la versione più recente sempre in alto).

---

## v2.12.0 — Fluidità player remoti: snapshot interpolation (calcio + pallavolo)

### ✨ Novità
- **Snapshot interpolation per i player remoti** (`js/modes/soccer/sync.js`, `js/modes/volley/sync.js`, `js/state.js`): i player remoti non vengono più mossi con dead reckoning + lerp correttivo aggressivo. Ogni pacchetto server viene inserito in un buffer (`snapshotBuffer` / `vSnapshotBuffer`, max 5 elementi, max 200ms). Ad ogni frame il renderer interpola linearmente tra i due snapshot adiacenti a `renderTime = now - INTERP_DELAY_MS` (default 50ms). Se il buffer non ha abbastanza dati la posizione viene congelata all'ultimo snapshot noto — nessuna estrapolazione. Questo elimina il ciclo overshoot → snap → overshoot causato dal lerp 0.6–0.9 frame-per-frame.
- **`INTERP_DELAY_MS = 50`** (`js/state.js`): costante facilmente modificabile. Abbassare a 33ms su reti stabili, alzare a 80ms con molto jitter.
- **`interpolateRemotePlayers(now)`** (`js/modes/soccer/sync.js`): nuova funzione chiamata ad ogni frame nel loop di render prima di `draw()`. Calcola il `renderTime`, cerca i due snapshot adiacenti, interpola `x, y`. Non tocca `vx, vy` (non usati per il rendering visivo).
- **`vInterpolateRemotePlayers(now)`** (`js/modes/volley/sync.js`): equivalente per la pallavolo.
- **Buffer svuotato al gol/respawn** (`applyRemoteState`, `vApplyRemoteState`): quando `gc` passa da 0 a un valore alto (gol), il buffer viene azzerato e i player remoti ricevono uno snap diretto alla posizione server, evitando interpolazioni attraverso il teleport di respawn.
- **Buffer svuotato al reset** (`js/modes/soccer/game.js` → `reset`, `js/modes/volley/game.js` → `vReset`): `snapshotBuffer = []` / `vSnapshotBuffer = []` ad ogni reset partita.

### 🔧 Modifiche
- **`tickRemotePhysics` / `vTickRemotePhysics` ridotti** (`sync.js` soccer e volley): ora gestiscono solo (a) il player locale con prediction e (b) il dead reckoning della palla. I player remoti non vengono più spostati qui.
- **`applyRemoteState` / `vApplyRemoteState` pulite**: rimosso il blocco `dist > 80 → snap` / `dist > 1 → lerp` per i player remoti. Rimane solo la correzione leggera per il player locale (prediction). La posizione visiva dei remoti è ora determinata esclusivamente da `interpolateRemotePlayers`.
- **Loop soccer / volley** (`game.js`, `volley/game.js`): `interpolateRemotePlayers` / `vInterpolateRemotePlayers` chiamati ad ogni frame prima di `draw()` / `vDraw()`, solo in modalità multiplayer (`netMode !== 'train'`).
- La palla mantiene il dead reckoning esistente (B_FRIC applicato correttamente, jitter meno percettibile e non dipende da input umani).

---

## v2.12.0 — Fluidita player remoti e locali: snapshot interpolation + prediction migliorata

### Problema risolto
- **Micro-jitter sui player remoti**: il vecchio sistema estrapolava la posizione con `tickRemotePhysics` (senza `P_FRIC`, a differenza del server) e poi correggeva con lerp aggressivo (0.6-0.9/frame). Questo generava un ciclo overshoot → snap correttivo → overshoot continuo, peggiorato dal jitter di rete del server su Render free tier.
- **Sensazione "scivolosa" del player locale**: la correzione server arrivava con un lerp fisso (12%) indipendente dalla distanza, dando una sensazione di input lag variabile.

### Novita
- **Snapshot interpolation per player remoti** (`js/state.js`, `js/modes/soccer/sync.js`, `js/modes/volley/sync.js`): sostituito dead reckoning + lerp correttivo con un buffer di snapshot a 5 elementi. I player remoti vengono posizionati interpolando linearmente tra due snapshot reali a `renderTime = now - 50ms`. Se mancano snapshot adiacenti il player viene congelato all'ultima posizione nota (niente estrapolazione).
- **`INTERP_DELAY_MS = 50`** in `state.js`: costante facilmente modificabile (33ms su server veloci, 80ms con molto jitter).
- **`snapshotBuffer` / `vSnapshotBuffer`** in `state.js`: buffer per calcio e pallavolo, max 5 elementi, purge automatico degli snapshot > 200ms.
- **`interpolateRemotePlayers(now)`** in `soccer/sync.js`, **`vInterpolateRemotePlayers(now)`** in `volley/sync.js`: chiamate una volta per frame nel loop `update()`. Coprono anche il caso buffer vuoto (inizio partita) e buffer con un solo elemento.
- **Correzione prediction locale piu morbida** (`soccer/sync.js`, `volley/sync.js`): il fattore alpha e ora `min(0.12, dist * 0.015)` invece di un fisso 0.12. Distanze piccole (< 1px) non producono correzione, distanze grandi convergono piu velocemente senza snap bruschi.
- **Gol / respawn**: al passaggio `goalCD` da 0 a valore > 0 il buffer viene svuotato e si usa snap diretto per tutti i player, evitando interpolazione attraverso il teleport.
- **`snapshotBuffer = []` nel `reset()`** di entrambe le modalita: il buffer viene ripulito a ogni reset/inizio partita.

### Invariato
- Palla: dead reckoning con `B_FRIC`/`V_B_GRAV` corretto + snap su velJump o distanza > 40px.
- Server: nessuna modifica.
- Input: nessuna modifica.

---

 — Pallavolo: fix tocchi avversario, modalità avanzata online, animazioni e comportamento base

### 🔧 Fix
- **Tocchi avversario si azzerano correttamente** (`js/modes/volley/physics.js` → `vIncrementTouch`, `server.js` → `vTick`): quando una squadra tocca la palla, i tocchi dell'avversario tornano a 0 (recupera i suoi 3 tocchi). Prima si azzeravano solo al cambio lato fisico della palla.
- **Modalità avanzata funziona online** (`js/menu.js`): il toggle «Controlli avanzati» ora invia `vmode` al server via WebSocket. Il server aggiorna `room.vAdvanced` e la trasmette a tutti. Prima `vControlMode` era client-only e il server non sapeva mai che modalità usare.

### ✨ Novità comportamento
- **BASE — tiro continuo mentre AZIONE è premuto** (`js/modes/volley/physics.js` → `vApplyInput`, `server.js` → `vApplyInputSrv`): non è più solo il rising edge ma ogni frame con AZIONE premuto. Se tieni premuto e la palla ti entra dentro, parte subito.
- **Rallentamento con AZIONE premuto** in entrambe le modalità (server e client): `topSpd = V_P_SPEED_MAX * 0.45` quando `pressing`, indipendentemente dalla modalità.

### 🎨 Animazioni
- **AVANZATA — freccia carica sul player** (`js/modes/volley/draw.js` → `_vDrawShotArrow`): replica `drawShotArrow` del calcio. Freccia gialla che punta verso la palla con lunghezza proporzionale alla carica, più anello tratteggiato attorno al player. Rimosso l'anello tratteggiato attorno alla *palla*.
- **BASE — cerchio pieno immediato sul player** (`js/modes/volley/draw.js` → `vDrawPlayer`): quando AZIONE è premuto appare subito un cerchio giallo solido attorno al player + un secondo cerchio esterno pulsante. Nessuna freccia, nessuna carica progressiva.
- Rimossa animazione precedente sulla palla in modalità avanzata.

---

## v2.10.0 — Pallavolo: nessuna collisione player↔palla, tiro solo con palla dentro il player

### 🔧 Fix
- **Nessuna collisione fisica tra player e palla** (`js/modes/volley/physics.js`, `server.js`): rimossa completamente `vPlayerBallCollide` e `vPlayerBallCollideSrv`. La palla attraversa i player liberamente senza interazioni fisiche. Solo le collisioni player↔player rimangono.
- **Tiro condizionato alla sovrapposizione** (`js/modes/volley/physics.js` → `vDoKick`, `server.js` → `vDoKickSrv`): AZIONE tira la palla **solo se** `dist(player, palla) < player.r + ball.r`, cioè solo quando la palla si trova fisicamente dentro/sovrapposta al player. Se la palla è fuori, AZIONE non fa nulla.
- **`vUpdate` training pulito** (`js/modes/volley/game.js`): rimosso il loop di separazione geometrica che non c'è più.

---

## v2.9.0 — Fisica pallavolo: solo AZIONE muove la palla, reset tocchi corretto

### 🔧 Fix
- **La palla NON viene più spinta dal contatto fisico** in nessuna delle due modalità (`js/modes/volley/physics.js`, `server.js`): `vPlayerBallCollide` esegue solo separazione geometrica pura (evita compenetrazione e trasferisce la componente di avvicinamento per evitare blocchi contro muri). Nessun impulso, nessun tocco automatico. Il commento nella vecchia versione era fuorviante: in modalità base il contatto spingeva, ora non più in nessuna modalità.
- **AZIONE è l'unico modo per muovere la palla**, in entrambe le modalità:
  - **BASE**: rising edge di AZIONE (primo frame in cui si preme) → tiro immediato con forza fissa (~45% del range `V_KICK_MIN`…`V_KICK_MAX`). `js/modes/volley/physics.js` → `vApplyInput`, `server.js` → `vApplyInputSrv`.
  - **AVANZATA**: tieni AZIONE per caricare, rilascia per tirare con forza proporzionale alla carica. Comportamento identico al calcio. `js/modes/volley/physics.js` → `vApplyInput`/`vDoKick`, `server.js` → `vApplyInputSrv`/`vDoKickSrv`.
- **Reset tocchi al cambio lato corretto** (`js/modes/volley/physics.js` → `vCheckSideChange`, `server.js` → `vTick`): quando la palla attraversa la rete, i tocchi di **entrambe** le squadre vengono azzerati. Questo significa che non appena il nemico tocca la palla (e questa cambia lato), i propri tocchi tornano a 3, come da regola pallavolo.
- **`vUpdate` training aggiornato** (`js/modes/volley/game.js`): ordine corretto — `vApplyInput` (gestisce AZIONE + movimento) → `vPlayerBallCollide` (solo separazione geometrica) → `vCircleCollide` player↔player → `vTickBall` → check pavimento → `vCheckSideChange`.
- **Server `vTick` riscritto pulito** (`server.js`): `vApplyInputSrv` ora ritorna `true` se ha effettuato un tiro, e `vTick` usa quel valore per incrementare `room.vTouches[team]` e chiamare `vHandlePoint` se necessario. Eliminata tutta la logica duplicata e le IIFE inutili presenti nella versione precedente.
- **Messaggio ingame aggiornato** (`js/modes/volley/game.js`): il testo di hint ora recita `AZIONE (Ctrl/Spazio/0) per tirare` invece del vecchio riferimento alla cattura/rilascio.

---

## v2.8.0 — Fix fisica pallavolo + controlli avanzati + pannello variabili per modalità + fix chat doppia

### ✨ Novità
- **Palla pallavolo non si attacca più al player**: rimossa completamente la meccanica di cattura/offset. Il contatto fisico spinge direttamente la palla tramite `vPlayerBallCollide` con impulso velocità relativa × `V_HIT_R` + bonus fisso `V_HIT_BONUS`. La palla attraversa il player normalmente.
- **Colpo base più potente**: `V_HIT_BONUS = 6.0` garantisce un impulso minimo in direzione centrifuga ad ogni contatto, anche se il player è fermo. Il tocco conta solo se la velocità di avvicinamento supera 0.5 px/tick.
- **Modalità controlli avanzati** (impostazioni → Pallavolo): toggle `⚙️ Controlli avanzati` visibile solo quando la modalità attiva è pallavolo. In modalità avanzata: tieni AZIONE per caricare il tiro, rilascia per tirare (stessa meccanica del calcio con `V_KICK_MIN/MAX/CHG_F`). La carica è visualizzata da un anello tratteggiato giallo attorno al player e dalla palla che pulsa.
- **Pannello variabili per modalità**: il tab «🎛️ Variabili» mostra le variabili specifiche della modalità attiva (calcio: `CONFIG_META`, pallavolo: `V_CONFIG_META`). Le variabili volley sono modificabili localmente (non richiedono sync server). Label chiara in cima al pannello.
- **`V_CONFIG` live**: oggetto separato da `CONFIG` per le variabili pallavolo, modificabile in-game via slider/number input.
- **`vControlMode`** salvato in `localStorage` (`hax_vcontrol`): persiste tra sessioni.

### 🔧 Fix
- **Chat doppio messaggio risolto**: `sendChatMsg` non fa più `pushChatMsg` localmente quando online — il server rimanda il messaggio a tutti incluso il mittente, che viene già mostrato dal case `chat` in `network-core.js` con `isSelf=true`.
- **Rimossi tutti i riferimenti a `capturedBy`/`offset`** da `game.js`, `draw.js`, `sync.js` e `physics.js` (la cattura non esiste più).
- **`vMkBall`** non include più `capturedBy`/`offset`.
- **`vBuildPlayers`** aggiunge `charge: 0` ai player volley (necessario per modalità avanzata).
- **`menu.js` riscritto** per supportare: pannello variabili per modalità, toggle vcontrol, restart corretto per entrambe le modalità in ESC menu.
- **`vcontrol-row`** nell'HTML è nascosto di default e mostrato solo in-game pallavolo.
- **`.cfg-mode-label`** aggiunto al CSS del menu.

---

## v2.7.0 — Nuova modalità: Pallavolo 🏐

### ✨ Novità
- **Modalità Pallavolo completa** (`js/modes/volley/`): nuova cartella con 5 file che specchiano l'architettura di `modes/soccer/`.
  - `config.js` — costanti con prefisso `V_` (nessuna collisione con il calcio): dimensioni, fisica palla, rete, muretto, cattura/rilancio, tocchi.
  - `physics.js` — fisica pura: movimento player, gravità progressiva palla, collisione muretto (AABB vs cerchio), cattura/offset, rilancio con forza **inversa** alla distanza (palla vicina al centro = rilancio potente), contatore tocchi per squadra.
  - `draw.js` — rendering campo sabbia, rete con pali e filo, muretto centrale, palla pallavolo con sezioni colorate e trail, player con alone cattura, indicatori tocchi rimanenti.
  - `sync.js` — dead reckoning e `applyRemoteState` adattati per lo stato "catturato" (serializza `capturedBy`/`offset`).
  - `game.js` — stato partita, loop RAF dedicato (`vLoop`/`vStartLoop`/`vStopLoop`), gol con respawn, fine partita, `startVolleyGame`/`startVolleyTraining`.
- **Muretto centrale fisico**: rettangolo 8×(campo/8)px a `W/2`, base al pavimento. Ha collisione con la palla (rimbalzo `V_B_BOUNCE_WALL`, reset gravità se colpito sopra) ma — come i muri esterni — **non conta come tocco squadra**. I player non collide con esso (solo con la rete invisibile a `V_NET_X`).
- **Forza di rilancio inversa**: `force = V_RELEASE_MAX - t*(V_RELEASE_MAX-V_RELEASE_MIN)` dove `t = dist/V_CATCH_R`. Palla vicina al centro del player → rilancio più potente; palla al bordo zona cattura → rilancio più debole.
- **Gravità progressiva sulla palla**: ogni tick `ball.vy += ball.grav`, `ball.grav` sale da `0.015` a `0.06` con rampa `0.0008`. Si azzera al rimbalzo sul soffitto/muretto e al rilancio.
- **Regola dei 3 tocchi**: ogni rilancio riuscito incrementa `vTouches[team]`; al 4° tocco è punto per la squadra avversaria. I contatori si azzerano quando la palla cambia metà campo o dopo ogni punto.
- **Supporto server-side** (`server.js`): aggiunto `vTick` con fisica pallavolo 1:1 al client (gravità, muretto, cattura, rilancio, tocchi, punto al pavimento). Costanti `V_` duplicate nel server. `startMatch` sceglie `tick` o `vTick` in base a `room.mode`. `mkVolleyBall`, `vResetPositions`, `vSerializeState`, `vHandlePoint` aggiunti.
- **Mode picker** (`index.html`): bottone "🏐 Pallavolo" aggiunto in entrambi i mode picker (crea stanza + allenamento).
- **Routing modalità** (`js/network-core.js`): variabile `currentGameMode` introdotta; tutti i messaggi `start`, `state`, `goal`, `game_over`, `restarted`, `pm_update`, `team_change`, `player_left` ora smistano verso le funzioni volley o soccer in base alla modalità attiva.
- **Lobby** (`js/lobby.js`): `btn-train-go` avvia `startVolleyTraining()` se selezionata pallavolo; `showLobby` chiama `vStopLoop()` oltre a `stopLoop()`; `btn-restart` in train gestisce entrambe le modalità; `currentGameMode` resettato a `'soccer'` al ritorno in lobby.

### 🔧 Fix / Dettagli implementativi
- `startGame` (calcio) chiama `vStopLoop()` prima di avviare il loop; `startTraining` idem.
- `startVolleyGame` chiama `stopLoop()` prima di avviare `vStartLoop()`.
- `vUpdate` in train: ordine corretto — `vApplyInput` → `vTryCapture`+`vPlayerBallCollide` (solo se non catturata) → `vCircleCollide` player↔player → `vUpdateCapture` → `vTickBall` → check pavimento → `vCheckSideChange`.
- `vGoal` resetta posizione di tutti i player (non solo la palla).
- `vHandleGameOverLocal` resetta correttamente `vGameOver=false` e lo stato completo dopo 3 secondi.
- `vTouches` serializzato nello state broadcast (`touches: [n0, n1]`) per sincronizzare gli indicatori HUD sui client.

---

## v2.6.1 — Fix: config isolata per stanza

### 🔧 Fix critico
- **CONFIG per-room** (`server.js`): il `CONFIG` globale è stato reso immutabile (`CONFIG_DEFAULT`) e usato solo come template. Ogni room riceve `room.config = { ...CONFIG_DEFAULT }` alla creazione. Le modifiche via `set_config` aggiornano solo `room.config`, non toccano le altre stanze. `applyInput`, `doKick` e `tick` ricevono `cfg = room.config` come parametro invece di leggere un globale. L'endpoint `/admin/config` modifica solo il template per le room *future*, non quelle esistenti.

---

## v2.6.0 — CONFIG live: variabili fisiche modificabili in tempo reale

### ✨ Novità
- **Tab "🎛️ Variabili" nel menu** (`index.html`, `js/menu.js`, `css/menu.css`): nuovo pannello con slider + campo numerico per ogni variabile fisica. Visibile a tutti, modificabile solo dall'host. Le modifiche si applicano istantaneamente a tutti i client senza ricaricare nulla.
- **CONFIG live server-side** (`server.js`): le costanti fisiche sono ora un oggetto `let CONFIG = {...}` mutabile. L'handler `set_config` (solo host) applica la patch e la broadcasta a tutta la room. Endpoint HTTP `POST /admin/config` con `ADMIN_TOKEN` per modifiche esterne (curl, script). Protetto da `process.env.ADMIN_TOKEN`.
- **CONFIG live client-side** (`js/state.js`): oggetto `CONFIG` specchio del server, con `CONFIG_META` (label, min, max, step) per ogni variabile usata dal pannello. Aggiornato automaticamente alla ricezione di `config`, `created`, `joined`, `start`.
- **physics.js e sync.js leggono da CONFIG** (`js/modes/soccer/physics.js`, `js/modes/soccer/sync.js`): tutte le costanti fisiche (`P_START`, `P_FRIC`, `B_FRIC`, ecc.) vengono lette da `CONFIG.xxx` invece delle `const`. Ogni cambio dell'host agisce al frame successivo.

### 📦 Rete
- `set_config` manda solo la patch (un oggetto con 1 chiave): ~30-50 byte per modifica, solo quando l'host sposta uno slider. Nessun polling.
- Il server valida ogni chiave (solo quelle presenti in `CONFIG`) e ogni valore (numero, range 0-10000) prima di applicare.

---

## v2.5.0 — Kick-start movimento + pulizia costanti

### ✨ Novità
- **Kick-start movimento** (`js/modes/soccer/physics.js`, `server.js`): quando premi un tasto direzionale, se la velocità in quella direzione è sotto `P_START`, viene impostata istantaneamente a `P_START` (1.4 px/frame). Questo elimina la sensazione di "partire da fermo": il player risponde immediatamente con una velocità base, poi `P_ACCEL` continua ad accumularla fino a `P_SPEED_MAX`. Cambiare direzione dà subito velocità nella nuova direzione senza dover aspettare che la vecchia decelerazione finisca.

### 🔧 Fix / Pulizia
- **Costanti unificate** (`js/modes/soccer/config.js`, `server.js`): `P_START`, `P_SPEED_MAX`, `P_ACCEL`, `P_FRIC` ora hanno la stessa struttura e valori identici su client e server. Rimossi commenti obsoleti e il vecchio valore `P_START = 5` che non veniva mai usato. `P_SPEED` mantenuto come alias per compatibilità con codice legacy.

---

## v2.4.0 — Fix nero late-join, movimento con rampa, modalità di gioco

### 🔧 Fix
- **Nero late-join definitivo** (`js/network-core.js`): quando si entra in una partita già avviata, ora vengono inizializzati esplicitamente `ball = mkBall()` e `players = buildPlayers(roster)` prima di chiamare `startLoop()`, e `$('game').display = 'flex'` viene impostato prima di `startLoop`. Questo previene crash silenziosi di `draw()` che lasciavano il canvas nero.
- **`netMode = 'guest'`** impostato esplicitamente nel late-join: senza questo `sendGuestInput` non veniva mai chiamato e il player non poteva muoversi nemmeno dopo essere stato spostato dall'host.

### ✨ Novità
- **Movimento con accelerazione graduale** (`js/modes/soccer/config.js`, `server.js`): i player ora partono lenti e accelerano fino alla velocità massima (`P_SPEED_MAX = 3.8`). `P_ACCEL` ridotto a 0.22 (ci vogliono ~12 frame per arrivare a velocità di crociera), `P_FRIC = 0.78` (leggermente più alta per bilanciare). La velocità di crociera rimane simile a prima (~2.6), ma cambiare direzione brusca ora richiede un breve momento di decelerazione/riaccelero.
- **Selezione modalità** (`index.html`, `js/lobby.js`, `css/lobby.css`): la card "Crea stanza" ora include un selettore modalità (attualmente solo ⚽ Calcio). La modalità scelta viene inviata al server nel payload `create`. Aggiunta anche la card `#card-train-mode` per la selezione modalità in allenamento. Nuovo `mode-picker` CSS riutilizzabile.

---

## v2.3.0 — Fix multipli: nero, AFK, lobby realtime, prediction toggle, tasti

### 🔧 Fix
- **Nero schermo definitivo** (`js/menu.js`): `showPrematch` ora porta `game` a `display:flex` ma nasconde HUD/ctrl-bar con `visibility:hidden`. Il canvas è sempre nel DOM e il loop di render gira. `hidePrematch()` ripristina la visibilità quando si avvia la partita o si torna alla lobby. Il click sul backdrop in prematch non chiude più il menu (solo in-game).
- **Nero late-joiner** (`js/menu.js`, `js/modes/soccer/game.js`): stesso fix: il canvas è visibile anche in prematch, quindi il late-joiner non vede nero al primo pacchetto.
- **AFK lampeggio/colore sbagliato** (`server.js`): quando vai AFK, il server ora aggiorna subito anche `c.team = -1` nel record del client. Così `syncRoster` manda il team corretto e il client non disegna più il player con il colore della squadra precedente.
- **Host vede roster in tempo reale** (`js/network-core.js`): `pm_update` chiama sempre `renderPmRoster()` se il menu è aperto, non solo in-game. Ora l'host vede le persone entrare in prematch senza aggiornare.
- **Nome nella chat disconnessione** (`server.js`, `js/network-core.js`): `player_left` ora include `name` (preso dal record client prima della rimozione). Il client mostra il nome invece dell'ID.
- **Tasti P/Invio disabilitati in lobby** (`js/input.js`): aggiunto early-return se `inLobby` è true. Nessun shortcut di gioco si attiva mentre scrivi il codice o il nickname.
- **Click backdrop menu in prematch** (`js/menu.js`): `closeMenu` sul click esterno scatta solo se `game` è visibile come schermata di gioco vera, non in prematch.

### ✨ Novità
- **Toggle prediction locale** (`js/state.js`, `js/modes/soccer/sync.js`, `js/menu.js`, `index.html`, `css/menu.css`): nuova impostazione nelle Impostazioni del menu. Abilitata: il tuo player risponde all'input subito (prediction + correzione server). Disabilitata: server completamente autoritativo (dead reckoning puro). Preferenza salvata in `localStorage`. Default: ON.

---

## v2.2.0 — Nero schermo fix, fine partita, crea stanza, lista stanze, AFK fix

### 🔧 Fix critici
- **Nero schermo permanente** (`js/modes/soccer/game.js`): il problema era che `visibilitychange` non basta — il browser non solo throttla rAF in background ma a volte lo stoppa del tutto. La soluzione corretta è disaccoppiare update e render: ora `draw()` viene chiamata **sempre** ad ogni frame, mentre `update()` (fisica/input) viene saltata quando la scheda non è visibile. Questo evita il canvas nero al ritorno e anche l'accumulo di `dt` gigante.
- **AFK** (`js/admin.js`): quando esci dall'AFK torni spettatore (`team=-1`), non più alla squadra precedente. Il player fisico resta parcheggiato a `x=-9999`, l'host può spostarlo dal menu. Il messaggio in chat è broadcastato a tutti dal server.
- **`stopLoop` / `startLoop`** (`js/modes/soccer/game.js`): introdotte funzioni esplicite che gestiscono `_rafId` con `cancelAnimationFrame` per evitare loop doppi.

### ✨ Novità
- **Fine partita → torna al menu P** (`js/modes/soccer/game.js`): quando la partita finisce, dopo 3 secondi tutti i client tornano automaticamente al menu pre-partita. L'host può avviare una nuova partita senza ricaricare.
- **Crea stanza con nome e password** (`js/lobby.js`, `server.js`, `index.html`): il flow di creazione ora mostra una card con campo nome stanza e campo password opzionale. Il server memorizza nome e password per ogni room.
- **Lista stanze pubblica** (`js/lobby.js`, `server.js`, `css/lobby.css`): nuovo bottone "🏠 Lista stanze" apre una card con tutte le stanze attive (nome, codice, numero giocatori, lucchetto se con password, etichetta "in corso"). Cliccando "Entra" viene richiesta la password se necessaria. La lista usa una connessione WS temporanea con messaggio `list_rooms` — nessun polling, nessuna richiesta HTTP extra, chiude subito dopo la risposta.
- **Verifica password** (`server.js`): il server rifiuta i `join` con password errata inviando `{type:'error', msg:'Password errata'}`.

### 📦 Rete
- La lista stanze usa una connessione WS separata che si chiude dopo il primo messaggio: zero overhead sulle connessioni di gioco esistenti.
- `list_rooms` risponde con un solo pacchetto contenente tutte le stanze: nessun polling, la lista è sempre fresca al click.

---

## v2.1.0 — Fix allenamento, join in-game, codice stanza, tasti

### 🔧 Fix
- **Allenamento: palla funzionante** (`js/game.js`): aggiunta la chiamata `circleCollide(p, ball, B_HIT_R)` dopo `applyInput` in modalità train. Prima la palla non veniva spinta perché `physics.js` usa `ball` globale (non un parametro) e la collisione non veniva mai eseguita. Aggiunti anche i `goalBurst` sui gol.
- **Join in-game: no palla fantasma** (`js/network.js`): il messaggio `start` con `lateJoin:true` non chiama più `startGame` (che resettava palla/score/timer). Invece ricostruisce solo i player locali e avvia il loop se non era già attivo. L'host ora vede il nuovo arrivato grazie al `pm_update` che aggiorna anche `players[]` in-game.
- **Codice stanza nel menu** (`js/network.js`, `index.html`, `css/game-menu.css`): il codice compare nell'header del menu prematch/in-game in giallo evidenziato, non più in chat. Viene nascosto quando si torna alla lobby.
- **ESC chiude chat, non apre menu** (`js/input.js`): ESC ora chiude la chat se è aperta, o chiude il menu se è aperto. Non apre più nulla.
- **P apre il menu di gioco** (`js/input.js`): il tasto menu è stato spostato da ESC a P. Aggiornato anche il testo hint nella barra controlli.

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

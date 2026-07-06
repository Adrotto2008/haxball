# 📋 Aggiornamenti — HaxBall 2

Versione più recente sempre in cima. Ad ogni modifica aggiornare `VERSION` in `js/config.js`.

---

## v2.34.0 — Admin: pausa/stop partita (+ /pause /stop) — Pallavolo: battute speciali /a /q /z

Due funzionalità nuove su richiesta. Riletti `server.js`, `js/network-core.js`, `js/menu.js`, `js/chat.js`, `js/state.js`, `index.html` e i file `js/modes/{soccer,volley}/game.js` + `js/modes/volley/physics.js` prima di ogni modifica.

### ⏸️ Admin: pausa e fine partita
- **Pausa** (toggle): l'host può mettere in pausa/riprendere la partita in corso dal bottone ⏸ nel menu (Esc/P → "Pausa partita") oppure scrivendo **`/pause`** in chat. Lato server, `tick()`/`vTick()` ritornano subito quando `room.paused` è vero (nessuna fisica, nessun broadcast di stato) finché l'host non riattiva. Il server notifica tutti i client col messaggio dedicato `paused`; i client congelano `update()`/`vUpdate()` (e smettono di interpolare i player remoti, così lo stato resta fermo esattamente com'era, invece di continuare a interpolare verso l'ultimo snapshot) finché non arriva `paused:false`.
- **Fine partita immediata**: l'host può terminare subito la partita col punteggio attuale dal bottone ⏹ nel menu oppure con **`/stop`** in chat. Riusa lo stesso flusso di fine-partita già esistente (`endMatch` → broadcast `game_over`), quindi il comportamento a schermo (schermata risultato, ritorno alla sala d'attesa dopo 3s) è identico a una partita finita normalmente per tempo/punteggio.
- Entrambi i comandi sono host-only (verificato sia lato chat/menu sia — di nuovo, per sicurezza — lato server) e disabilitati in allenamento (non ha senso mettere in pausa se si gioca da soli).

### 🏐 Battute speciali pallavolo (`/a` `/q` `/z`)
- Tre traiettorie di battuta preimpostate, utilizzabili **solo durante la fase di battuta** e **solo da un giocatore della squadra che deve servire** in quel momento (verificato sia lato chat/client sia lato server prima di applicarle):
  - **`/a`** — battuta tesa e potente, arco basso (potenza massima, poca elevazione).
  - **`/q`** — battuta a parabola alta (elevazione forte, arriva dall'alto).
  - **`/z`** — battuta corta e morbida (arco breve, appena oltre la rete).
- Il comando applica direttamente la velocità preimpostata alla palla (bypassando il tiro fisico normale, ma con la stessa contabilità di un tocco: chiude la fase di battuta, conta come primo tocco della squadra, aggiorna `vLastToucher` per la regola del doppio tocco introdotta in v2.33.0).
- Implementato in modo autoritativo lato server (`vApplyServeVariant()` in `server.js`, nuovo messaggio `vserve`) e specularmente lato client per l'allenamento (`vApplyServeVariantLocal()` in `js/modes/volley/physics.js`), così i comandi funzionano anche da soli in allenamento.

### 📁 File modificati
- `server.js` — campo room `paused`; handler messaggi `pause`/`stop`/`vserve`; `vApplyServeVariant()`; guardia `room.paused` in `tick()`/`vTick()`; reset `paused` in `startMatch()`/`restart`/`back_prematch`
- `js/state.js` — nuova variabile globale `matchPaused`
- `js/network-core.js` — case `paused` (freeze/unfreeze UI), reset `matchPaused` su `start`/`restarted`
- `js/modes/soccer/game.js` — `update()`/`loop()` rispettano `matchPaused`
- `js/modes/volley/game.js` — `vUpdate()`/`vLoop()` rispettano `matchPaused`
- `js/modes/volley/physics.js` — `vApplyServeVariantLocal()` (battute speciali in allenamento)
- `js/chat.js` — comandi `/pause`, `/stop`, `/a`, `/q`, `/z`
- `js/menu.js` — bottoni ⏸ Pausa / ⏹ Termina nel menu in-game (host-only), `_updatePauseBtnLabel()`
- `index.html` — bottoni `esc-pause`/`esc-stop`

---

## v2.33.0 — Fix trasferimento admin su disconnessione + regola doppio tocco pallavolo

Due fix indipendenti su richiesta. Riletti `server.js`, `js/network-core.js`, `js/admin.js`, `js/menu.js`, `js/lobby.js` e i file `js/modes/volley/{physics,game}.js` prima di ogni modifica.

### 🐛 Fix — l'host che si disconnette non passava correttamente i poteri admin
- **Il problema**: quando l'host lasciava la stanza (chiusura connessione, non `transfer` esplicito dal menu), `server.js` riassegnava correttamente `room.hostPid` al client rimasto da più tempo nella room (`[...room.clients.values()][0]`, corretto perché una `Map` mantiene l'ordine di inserimento) — ma non inviava mai il messaggio `host_change`, solo `pm_update` (dentro `syncRoster`). Il client aggiornava silenziosamente `isHost`/`hostId` da `pm_update`, ma il bottone "▶ Inizia partita" e l'hint admin nel menu sala d'attesa vengono impostati da `openMenu()`, richiamata solo dall'handler dedicato `host_change` — non da `pm_update`. Risultato: il nuovo host diventava admin lato server, ma nella UI il bottone restava nascosto e non poteva effettivamente avviare la partita.
- **Fix**: `ws.on('close', ...)` in `server.js` ora invia anche `bcastAll(room,{type:'host_change',hostId:room.hostPid})` quando l'host cambia per disconnessione, riusando lo stesso messaggio già gestito correttamente dal client per il trasferimento volontario (`adminTransfer` in `admin.js`). Nessuna modifica lato client necessaria: l'handler `host_change` in `network-core.js` già riapre/aggiorna il menu con `isHost` corretto.
- La scelta del nuovo host ("il più vecchio presente") era già corretta prima di questo fix — il bug era solo nella propagazione dell'informazione al client.

### 🏐 Regola doppio tocco pallavolo (fallo di doppio tocco consecutivo)
- **Prima**: `vTouches` contava solo i tocchi consecutivi per SQUADRA (max 3, `V_TEAM_MAX_TOUCHES`), ma non teneva traccia di quale giocatore avesse toccato per ultimo. Con più di un giocatore per squadra, lo stesso giocatore poteva colpire la palla due (o più) volte di fila senza alcuna penalità.
- **Ora**: se una squadra ha più di un giocatore attivo in campo, lo stesso giocatore non può toccare la palla due volte consecutive — deve alternarsi con un compagno (tocco A, tocco compagno, tocco A di nuovo → valido; tocco A, tocco A → fallo, punto immediato all'avversario). Con un solo giocatore in squadra la regola non si applica, dato che non c'è nessuno con cui alternarsi. Il limite di 3 tocchi totali per squadra resta invariato e si applica insieme alla nuova regola.
- Implementato in modo autoritativo lato server (`vTick` in `server.js`, nuovi campi room `vLastToucherId`/`vLastToucherTeam`, resettati ad ogni nuovo scambio in `vResetPositions`) e specularmente lato client per l'allenamento (`vDoKick` in `js/modes/volley/physics.js`, nuova variabile `vLastToucher` in `js/modes/volley/game.js`, resettata in `vGoal()`/`vReset()`) — coerenza fisica mantenuta tra i due path, come da principio guida del progetto.

### 📁 File modificati
- `server.js` — `ws.on('close', ...)` (broadcast `host_change`), `mkRoom()`/`vResetPositions()` (nuovi campi `vLastToucherId`/`vLastToucherTeam`), `vTick()` (regola doppio tocco)
- `js/modes/volley/physics.js` — `vDoKick()` (regola doppio tocco)
- `js/modes/volley/game.js` — nuova variabile `vLastToucher`, reset in `vGoal()`/`vReset()`

---

## v2.32.0 — Migrazione server Render: Virginia → Frankfurt

La region del servizio Render era **Virginia (US East)**: per utenti in Italia la sola tratta transatlantica pesava 100-150ms+ di RTT, piu' di qualsiasi ottimizzazione software fatta nelle sessioni precedenti (v2.30.0/v2.31.0 nascondono il ritardo, non lo eliminano). Creato un nuovo servizio Render in region **Frankfurt (EU Central)**, stesso repo/build/start command, nessuna env var aggiuntiva necessaria (solo `PORT`, automatica, e l'opzionale `ADMIN_TOKEN`, non impostata nemmeno sul vecchio servizio).

- `js/network-core.js`: `WS_URL` di produzione aggiornato da `wss://haxball-9dkw.onrender.com` a `wss://haxball-1.onrender.com`
- Nessun altro file referenzia l'URL del vecchio servizio (verificato anche `README.md`)
- Il vecchio servizio su Virginia puo' restare attivo qualche giorno come fallback, poi va eliminato dalla dashboard Render

### 📁 File modificati
- `js/network-core.js` — `WS_URL`

---

## v2.31.0 — Rifinitura fluidità: ping adattivo + estrapolazione remoti

Seguito diretto di v2.30.0, su richiesta di ridurre ulteriormente il lag percepito. Qui le due ottimizzazioni lasciate volutamente fuori dalla sessione precedente perché più delicate (comportamentali, non solo di banda), più due piccole rifiniture correlate. Riletti `js/state.js`, `js/network-core.js`, `server.js` e i due `sync.js` prima di ogni modifica.

### 🎯 `INTERP_DELAY_MS` adattivo sul ping reale
- `js/state.js`: `INTERP_DELAY_MS` da `const` a `let` (default 80ms), più due bound `INTERP_DELAY_MIN=60` / `INTERP_DELAY_MAX=200`.
- `js/network-core.js`, handler `pong`: ad ogni pong ricalcola `INTERP_DELAY_MS = clamp(round(pingMs*0.7)+40, 60, 200)`. Ping basso → remoti più vicini al tempo reale; ping alto → più margine in automatico, senza dover configurare nulla.
- **EMA sul ping**: `pingMs = pingMs*0.7 + sample*0.3` invece del valore istantaneo grezzo — un singolo pacchetto lento isolato non fa più saltare `INTERP_DELAY_MS` su e giù.
- **Ping ogni 1s** invece di 2s, così l'adattamento reagisce ai cambi di rete con un ritardo massimo di ~1s invece di ~2s. Costo in banda trascurabile (un messaggio piccolissimo in più al secondo); verificato lato server che l'handler `ping`→`pong` non abbia rate limit.

### 🏃 Estrapolazione player remoti quando il buffer va a secco
- Prima (v2.30.0 e prima): se `renderTime` superava l'ultimo snapshot disponibile (rete lenta/jitter), il player remoto si congelava di scatto sull'ultima posizione nota.
- Ora, in `interpolateRemotePlayers()` (calcio) e `vInterpolateRemotePlayers()` (pallavolo): si stima la velocità dagli **ultimi due snapshot reali** nel buffer (delta posizione / delta tempo — nessun vx/vy aggiuntivo trasmesso, coerente con il taglio del payload di v2.30.0) e si estrapola la posizione in avanti per una finestra breve (**max 150ms**). Oltre la finestra il player resta fermo alla posizione estrapolata raggiunta.
- Guardie: l'estrapolazione parte solo se i due snapshot usati per stimare la velocità sono abbastanza ravvicinati (`0 < dtSnap < 100ms`) — altrimenti (avvio partita, primo snapshot, gap anomalo) si torna al comportamento di freeze secco di prima, per non inventare velocità da dati inaffidabili.

### 📁 File modificati
- `js/state.js` — `INTERP_DELAY_MS` (`const`→`let`), nuovi `INTERP_DELAY_MIN`/`MAX`
- `js/network-core.js` — handler `pong` (EMA + calcolo adattivo), intervallo ping 2s→1s
- `js/modes/soccer/sync.js` — `interpolateRemotePlayers()` (estrapolazione)
- `js/modes/volley/sync.js` — `vInterpolateRemotePlayers()` (estrapolazione)

### ⚠️ Ancora aperto (non ancora azione richiesta)
- Region del server su Render — verificabile solo dalla dashboard, non dal filesystem: se non è già su Frankfurt/EU, per utenti in Italia pesa più di ogni ottimizzazione software.
- Limite strutturale del WebSocket/TCP (head-of-line blocking): fuori scopo per questo progetto, richiederebbe un trasporto UDP-like (es. WebRTC DataChannel non affidabile).

---

## v2.30.0 — Ottimizzazione rete: pacchetti più piccoli, broadcast più fluido

Sessione di audit dell'architettura di rete (connessione WS, ciclo partita, formato pacchetti) a partire da un'analisi esterna che aveva lavorato solo sul codice incollato (senza filesystem): riletti tutti i file coinvolti (`server.js`, `network-core.js`, `state.js`, `js/modes/{soccer,volley}/{sync,game}.js`) per verificare ogni punto prima di applicarlo. Obiettivo: meno byte per pacchetto, meno banda sprecata, movimento remoto più fluido.

### 📦 Pacchetti più leggeri
- **vx/vy dei player tolti dal payload di stato** (`serializeState`/`vSerializeState` in `server.js`): non venivano mai letti per i player remoti (lo dice il commento in `sync.js`: "non servono per il rendering") e per il player locale solo nel raro caso di snap secco (>80px). L'array per player passa da 6 a 4 elementi (`[x,y,charge,held]`): circa **-33% di byte per player**, 30 volte al secondo per stanza. Aggiornati tutti i punti che leggevano gli indici `[4]`/`[5]` (ora `[2]`/`[3]`) in `js/modes/soccer/sync.js` e `js/modes/volley/sync.js` (goal/respawn, correzione player locale, interpolazione remoti).
- **Spettatori compressi a `0` invece dell'array completo**: uno spettatore restava un elemento statico `[x:-9999,y:-9999,...]` spedito 30 volte/secondo per sempre, mai disegnato né interpolato. Ora `p.team===-1` diventa semplicemente `0` nel payload (**~95% in meno** per quello slot). Aggiunta la guardia `if (!sp) continue;` nei due punti che non l'avevano ancora (blocco reset/gol e correzione player locale in entrambi i `sync.js`); l'interpolazione remoti aveva già il pattern difensivo `if (snap.p[i])`.
- **Broadcast dimezzato**: `BCAST_MS` in `server.js` passa da 60Hz a 30Hz (`1000/30`), senza toccare `TICK_MS` — la fisica resta a 60Hz, cambia solo la frequenza di invio dello stato ai client. Dimezza il traffico in uscita.

### 🎯 Fluidità
- **`INTERP_DELAY_MS`** (`js/state.js`) alzato da 50 a 80ms per compensare l'intervallo maggiore tra snapshot (30Hz ≈ 33ms invece di 60Hz ≈ 16ms): serve margine per avere quasi sempre 2 snapshot adiacenti disponibili anche con jitter di rete.
- **Fix pallavolo — remoti congelati a menu aperto**: `vUpdate()` usciva subito su `escOpen` prima di richiamare `vInterpolateRemotePlayers()`, quindi con il menu P aperto i player remoti restavano fermi (nel calcio invece continuavano a muoversi, perché `loop()` richiama `interpolateRemotePlayers()` separatamente da `update()`). Ora `vLoop()` richiama `vInterpolateRemotePlayers()` subito dopo `vUpdate()`, sempre, come già fa `loop()` per il calcio — comportamento allineato tra le due modalità.
- **Rimossa una chiamata doppia**: `interpolateRemotePlayers()`/`vInterpolateRemotePlayers()` venivano chiamate sia dentro `update()`/`vUpdate()` sia subito dopo in `loop()`/`vLoop()` — la seconda è quella che serve davvero (copre anche il caso menu aperto), la prima era lavoro ripetuto ogni frame a menu chiuso. Rimossa da entrambi gli `update()`.

### ⚠️ Verificato ma non ancora azione richiesta
- **Region del server su Render**: non verificabile da qui (serve la dashboard Render). Se il servizio non è già su Frankfurt/EU, per utenti in Italia la tratta di rete pesa più di qualsiasi ottimizzazione lato codice — vale la pena controllarla.
- Non implementate in questa sessione (proposte solo come rifinitura futura, rischio/beneficio meno chiaro): estrapolazione dei player remoti quando il buffer di snapshot va a secco (oggi si congelano, scelta esplicita), `INTERP_DELAY_MS` adattivo in base al ping.

### 📁 File modificati
- `server.js` — `BCAST_MS`, `serializeState()`, `vSerializeState()`
- `js/state.js` — `INTERP_DELAY_MS`
- `js/modes/soccer/sync.js` — `applyRemoteState()`, `interpolateRemotePlayers()`
- `js/modes/volley/sync.js` — `vApplyRemoteState()`, `vInterpolateRemotePlayers()`
- `js/modes/soccer/game.js` — `update()`
- `js/modes/volley/game.js` — `vUpdate()`, `vLoop()`

---

## v2.29.0 — Fix regola battuta pallavolo: serve chi fa punto, non chi lo subisce

### 🐛 Fix
- **Regola battuta invertita**: dopo un punto, il serve andava alla squadra che aveva SUBITO il punto (l'avversaria di chi segnava) invece che a chi lo aveva appena fatto — comportamento sbagliato rispetto alla regola reale della pallavolo (side-out: chi vince lo scambio serve). Corretto sia lato client allenamento (`vGoal()` in `js/modes/volley/game.js`) sia lato server multiplayer (`vHandlePoint()` in `server.js`): ora `vServeTeam`/`nextServeTeam` = `scoringTeam`.

### 📁 File modificati
- `js/modes/volley/game.js` — `vGoal()`
- `server.js` — `vHandlePoint()`

---

## v2.28.0 — Audit di sicurezza e fisica: XSS stanza, config live ovunque, cleanup

Sessione di audit completo (letti client, server, CSS, README) a partire da una revisione esterna: verificati tutti i punti trovati (quasi tutti confermati, uno già risolto in v2.27.0), più alcuni bug aggiuntivi trovati durante la verifica.

### 🔒 Sicurezza
- **XSS stanza (il più serio)**: `r.code` non passava per `escHtml()` in `renderRoomsList()` (sia nell'attributo `data-code` che nel testo) e il server non validava mai il `code` mandato dal client in `create` — chiunque poteva creare una stanza con `code` contenente HTML/script arbitrario, iniettato senza escape a chi apriva "Lista stanze". Fix: escape lato client + `CODE_RE` lato server che accetta solo l'alfabeto sicuro già usato da `genCode()`.
- **`ADMIN_TOKEN`** non è più `'hax-admin-dev'` in chiaro come fallback: se la env var manca, il server genera un token casuale a ogni avvio e lo stampa nei log (endpoint `/admin/config` altrimenti compromissibile da chiunque conoscesse il default).
- **Validazione server assente**: nickname, nome stanza, password, chat e skin arrivavano al server senza alcun limite di lunghezza (i `maxlength` erano solo lato client, bypassabili con messaggi WS grezzi). Aggiunto `clampStr()` con cap coerenti applicati in `create`/`join`/`chat`/`skin`.
- **`escHtml()`** ora escapa anche `"`/`'`, non solo `<`/`>`/`&`: alcuni usi (avatar in `auth.js`) finiscono dentro attributi HTML dove le virgolette contano.

### 🐛 Fix fisica (CONFIG/V_CONFIG live)
- **Allenamento calcio**: la fisica della palla in `update()` (`js/modes/soccer/game.js`) leggeva costanti statiche (`B_HIT_R`, `B_FRIC`, `B_BOUNCE`, `BR`) invece di `CONFIG.*`/`ball.r` — cambiare i raggi/attrito/rimbalzo da Variabili non aveva alcun effetto sulla palla in allenamento (il movimento giocatore invece era già corretto). Ora legge tutto da `CONFIG` e `ball.r`, come già faceva `tickRemotePhysics()` in multiplayer.
- **Distanza di tiro (`doKick`)**: sia client (`physics.js`) sia server (`server.js`) usavano `PR+BR` fissi invece di `p.r+ball.r` — cambiare i raggi non cambiava mai la vera portata del tiro, nemmeno in multiplayer. Corretto in entrambi. Anche la freccia di carica (`drawShotArrow`) e lo spawn delle particelle su tiro usavano lo stesso calcolo fisso (`KICK_DIST` in `config.js`, con un `+12` hardcoded che duplicava `CONFIG.KICK_DIST_X`): rimossa la costante, ora calcolata live ovunque.
- **Pallavolo — `vDoKick`/`vUpdateKickCooldown`** (client, prediction locale) usavano `V_BR` fisso mentre il server (`vDoKickSrv`) usa correttamente `ball.r`: disallineamento prediction/server quando si cambia il raggio palla. Allineato a `vBall.r`.
- **Pallavolo — `vTickRemotePhysics`** (prediction multiplayer, `sync.js`) usava `V_B_FRIC` statico invece di `V_CONFIG.V_B_FRIC` live, oltre a `V_BR` fisso per tutti i rimbalzi. Corretto.
- **Pallavolo — `vTickBall`/`vBallCollidePost`** (allenamento, `physics.js`) usavano `V_BR` fisso per le pareti laterali e il muretto centrale, **e mancava del tutto il rimbalzo sulla parete superiore** (in allenamento la palla poteva uscire dal campo verso l'alto senza rimbalzare; multiplayer — sia prediction che server — ce l'ha sempre avuta). Aggiunta la parete mancante e allineati tutti i raggi a `vBall.r`.
- **AFK in pallavolo**: `toggleAfk()` (`admin.js`) spostava fuori campo solo l'entità in `players` (calcio), mai in `vPlayers` — durante una partita di pallavolo il proprio avatar restava visibile in campo (solo sul proprio client, finché non arrivava il prossimo `state` dal server: il server era già corretto). Ora mode-aware.
- **Touch**: mancava il listener `touchcancel` — se il sistema interrompeva il touch (notifica, gesture OS), joystick/tasto tiro potevano restare incollati. Aggiunto, condivide la logica con `touchend`.

### ✅ Verificato ma già risolto (falso positivo residuo dall'audit)
- Il raggio fisso in `mkBall()`/`buildPlayers()`/`vMkBall()`/`vBuildPlayers()` era già stato risolto in v2.27.0 (letto da `CONFIG`/`V_CONFIG` con fallback): confermato nel codice attuale, nessuna azione necessaria.

### 🧹 Pulizia (codice morto)
- Rimossa `goal(team)` in `js/modes/soccer/game.js`: non era mai chiamata (allenamento e multiplayer hanno ciascuno la propria logica gol inline, con `goalCD` diversi — 90 vs 140 — lasciati invariati per non alterare il comportamento).
- Rimossa `_vDrawShotArrow()` in `js/modes/volley/draw.js`: sostituita dagli anelli pulsanti in `vDrawPlayer()` fin dalla v2.11.0, ma la funzione era rimasta orfana.
- Rimossi `V_HIT_R`/`V_HIT_BONUS` (slider "Moltiplicatore colpo"/"Impulso bonus colpo" che dalla v2.9–2.10 non facevano più nulla: nessun codice li leggeva, il server li scartava già dal patch) e `V_KICK_DIST_X` (dichiarata ma mai referenziata) da `js/modes/volley/config.js`.
- `.auth-form` deduplicata in `css/lobby.css` (stessa identica regola ripetuta due volte).

### 📄 Altro
- `.idea/` aggiunto a `.gitignore` (portava in giro `workspace.xml` con percorsi locali e uno `shelved.patch` obsoleto).
- `WS_URL` (`network-core.js`) ora punta automaticamente a `ws://localhost:3000` quando l'host è `localhost`/`127.0.0.1`, senza dover modificare il file per testare in locale.
- **README aggiornato**: correggeva ancora "Supabase Realtime" come trasporto multiplayer (in realtà server Node.js/WebSocket da diverse versioni), non menzionava affatto `auth.js` né `js/modes/volley/` nella struttura del progetto, e affermava che una nuova modalità non richiede di toccare i file core — falso, `network-core.js`/`menu.js` hanno diramazioni per-modalità. Aggiunta anche una sezione Setup (env var `ADMIN_TOKEN`, tabelle Supabase/RLS).

### ⚠️ Richiede azione
- Su Render, se non è già impostata, considera di impostare esplicitamente la env var `ADMIN_TOKEN` a un valore stabile: senza, ogni riavvio del server genera un nuovo token casuale (solo nei log), quindi l'endpoint `/admin/config` resta protetto ma il token non è persistente tra un deploy e l'altro.

---

## v2.27.0 — Trovata e risolta la VERA causa del preset "solo estetico"

### ✅ Battuta pallavolo confermata risolta (v2.26.0)

### 🔍 Causa reale del bug preset (mai trovata prima)
Le versioni precedenti (v2.24.0–v2.26.0) avevano tutte cercato di risolvere il problema lato *sincronizzazione* (round-trip col server, applicazione ottimistica, ecc.), ma il vero difetto era altrove: le funzioni che costruiscono player e palla lato client — `vBuildPlayers()`, `vMkBall()` (pallavolo) e `buildPlayers()`, `mkBall()` (calcio), tutte in `js/modes/*/game.js` — creavano gli oggetti con il **raggio hardcoded** (`r: V_PR`, `r: V_BR`, `r: PR`, `r: BR`, costanti fisse definite in `config.js`), invece di leggere i valori **live** da `V_CONFIG.V_PR`/`V_CONFIG.V_BR` o `CONFIG.P_RADIUS`/`CONFIG.B_RADIUS`. Un preset che modifica questi raggi veniva sincronizzato correttamente nell'oggetto config, ma non si rifletteva mai sui player/palla creati a inizio partita, perché quelle funzioni ignoravano l'oggetto config e usavano sempre i valori di fabbrica. L'aggiornamento visivo scattava solo quando l'host toccava manualmente lo slider di un raggio, perché SOLO in quel caso il codice esistente (`applyVConfigPatch`/handler `vconfig`) applica esplicitamente `p.r = nuovoRaggio` a tutti i player già creati.

### 🔧 Fix
- `vBuildPlayers()` e `vMkBall()` (`js/modes/volley/game.js`) ora leggono `V_CONFIG.V_PR`/`V_CONFIG.V_BR` (con fallback alle costanti solo se `V_CONFIG` non è ancora pronto).
- `buildPlayers()` e `mkBall()` (`js/modes/soccer/game.js`) ora leggono `CONFIG.P_RADIUS`/`CONFIG.B_RADIUS` allo stesso modo.
- Nessun'altra modifica necessaria: l'ordine dei messaggi era già corretto (`Object.assign(CONFIG/V_CONFIG, msg.config/vconfig)` avviene sempre prima della chiamata a `startGame`/`startVolleyGame` sia per host che guest, quindi ora i valori del preset sono già presenti in `CONFIG`/`V_CONFIG` nel momento in cui i player/la palla vengono costruiti).

### 📁 File modificati
- `js/modes/volley/game.js` — `vBuildPlayers()`, `vMkBall()`
- `js/modes/soccer/game.js` — `buildPlayers()`, `mkBall()`

### ⚠️ Deploy
Questi sono fix client-only (nessuna modifica a `server.js` in questa versione): attivi subito, non serve deploy su Render.

---

## v2.26.0 — Fix critico: la v2.25.0 aveva la direzione della restrizione INVERTITA + muro rete disattivato per tutto il campo

### ❌ Cosa c'era di sbagliato nella v2.25.0
La v2.25.0 introduceva due bug nuovi, opposti a quelli che doveva risolvere:
1. **Linea di restrizione invertita**: le costanti `V_SERVE_RESTRICT_X_L`/`X_R` erano scritte con la logica giusta nei commenti ma la clamp era applicata alla squadra sbagliata con il segno sbagliato — di fatto permettevano a chi NON doveva battere di **oltrepassare la rete ed entrare nel campo avversario** fino a 70px oltre il centro, invece di tenerlo indietro. Per questo la squadra che non batteva poteva arrivare comunque al centro senza che la riga tratteggiata la fermasse.
2. **Muro della rete disattivato per l'intero campo avversario**: per far raggiungere la palla a chi batte, la v2.25.0 disattivava completamente il muro della rete (`netBlocked`) per la squadra che batte, invece di limitarsi a farla toccare la palla. Risultato: chi batteva poteva camminare in tutto il campo avversario, anche fino in fondo.

### ✅ Fix (analisi rifatta da zero)
- **La palla ferma sulla rete è GIÀ raggiungibile senza disattivare il muro**: quando un player è appoggiato al muro della rete (`V_NET_X`), il centro del suo corpo dista `p.r` dal centro della palla (che sta esattamente su `V_NET_X`) — sempre meno del raggio di tiro `p.r + V_BR`. Quindi **il muro della rete torna a essere SEMPRE bloccato per entrambe le squadre**, esattamente come nel gioco normale: non serve più nessuna eccezione, e chi batte non può più sconfinare nel campo avversario.
- **Direzione della restrizione corretta**: chi NON batte viene ora tenuto sul PROPRIO lato della rete, ad almeno 70px di distanza da essa (fuori dal raggio di tiro), e MAI oltre la rete. Riscritta `vApplyServeRestriction`/`vApplyServeRestrictionSrv` con logica esplicita per squadra (non più la formula ambigua `V_NET_X ± margin` che aveva causato l'inversione), per evitare lo stesso errore in futuro.
- Fix applicato identicamente in `server.js` (multiplayer), `js/modes/volley/physics.js` (motore condiviso client/training/prediction).

### 🔧 Fix — preset (rinforzato)
La logica di invio/conferma introdotta in v2.24.0 era corretta ma dipendeva interamente dal round-trip col server. Rinforzata con:
- **Applicazione locale immediata (ottimistica)**: i valori del preset vengono ora scritti subito in `CONFIG`/`V_CONFIG` lato host, prima ancora della risposta del server, così la UI (pannello Variabili) è già corretta senza aspettare la rete.
- **Failsafe 3 secondi**: se la conferma dal server (`config`/`vconfig`) non arriva mai per qualsiasi motivo, il bottone "Inizia partita" si sblocca comunque dopo 3s (i valori locali sono già applicati, quindi è sicuro).
- **Fix caricamento lista preset**: se il login Supabase si risolve DOPO che l'host ha già aperto la card "Crea stanza", la select dei preset ora si ripopola automaticamente non appena la sessione risulta valida, invece di restare vuota fino al prossimo click su "Crea stanza".

### ⚠️ Promemoria deploy server (invariato dalla v2.25.0)
`server.js` gira su Render: le modifiche a questo file non hanno effetto in multiplayer online finché non vengono fatti `git push` + deploy completato su Render. I fix di questa versione riguardano sia `server.js` sia file client puri (`js/network-core.js`, `js/auth.js`, `js/modes/volley/physics.js`) — questi ultimi funzionano già senza deploy, ma per il comportamento in multiplayer online (battuta) serve comunque il deploy di `server.js`.

### 📁 File modificati
- `server.js` — `vApplyInputSrv` (rimossa eccezione muro rete), `vApplyServeRestrictionSrv` (direzione corretta), `mkVolleyBall` (commento aggiornato)
- `js/modes/volley/physics.js` — `vApplyInput` (rimossa eccezione muro rete), `vApplyServeRestriction` (direzione corretta)
- `js/network-core.js` — applicazione locale immediata preset + failsafe 3s
- `js/auth.js` — ripopolamento select preset dopo risoluzione sessione

---

## v2.25.0 — Redesign restrizione battuta (palla al centro, rete come vero muro), fix definitivo preset

### ⚠️ NOTA IMPORTANTE — deploy server
`server.js` gira su Render (deploy da `origin` GitHub, branch `main`). Le modifiche a questo file **non hanno alcun effetto in multiplayer online finché non vengono commit+push** e Render non rifà il deploy. Se dopo aver aggiornato il codice locale i problemi lato server persistono online, verificare prima di tutto che il push sia stato fatto e che il deploy su Render sia completato (dashboard Render → stato ultimo deploy). In allenamento (solo client) i fix sono invece immediati perché non serve il server.

### 🔧 Fix — pallavolo, battuta
- **Design precedente sbagliato**: la v2.24.0 aveva provato a fixare la restrizione con una "seconda applicazione dopo le collisioni", ma il difetto di fondo era nel design stesso: la linea di restrizione era a 33%/67% del campo (lontana dalla rete) invece che sulla rete, e la palla veniva posizionata al 25%/75% del campo (dentro la metà campo di chi batte) invece che sulla linea centrale. Risultato: sembrava tutto "vicino al centro" ma non era realmente ancorato alla rete, e la linea tratteggiata non corrispondeva a un vincolo fisico solido.
- **Nuovo design**: la palla è ora sempre posizionata esattamente su `V_NET_X` (la rete/linea bianca centrale) a inizio partita e dopo ogni punto, sia lato server (`mkVolleyBall`) sia lato client/allenamento (`vReset`, `vGoal`). Il muro della rete (`V_NET_X`), che normalmente blocca entrambe le squadre, ora **si disattiva selettivamente per la squadra che deve battere** durante la fase di battuta (`netBlocked = !(servePhase && p.team === serveTeam)` in `vApplyInputSrv`/`vApplyInput`), così solo lei può attraversarlo e raggiungere la palla. La squadra avversaria resta invece bloccata a una linea di sicurezza 70px più indietro della rete (`vApplyServeRestrictionSrv`/`vApplyServeRestriction`), non più superabile nemmeno con l'aiuto di un compagno di squadra (riapplicata dopo le collisioni player-player, fix già presente dalla v2.24.0 e mantenuto).
- Implementato identicamente su `server.js` (multiplayer) e `js/modes/volley/{physics.js,game.js}` (allenamento/client).

### 🔧 Fix — preset non applicato
- Il fix v2.24.0 (invio immediato + blocco bottone "Inizia" finché non arriva conferma `config`/`vconfig` dal server) è corretto nella logica ma **richiede che `server.js` sia effettivamente deployato su Render** per avere effetto — la parte server (applicazione della patch, broadcast di conferma) non può funzionare se il server in esecuzione è ancora la versione precedente. Vedi nota sul deploy sopra. Nessuna ulteriore modifica di codice necessaria qui oltre al deploy; verificato che il flusso client (`js/network-core.js`, `js/menu.js`, `js/lobby.js`) sia coerente.

### 📁 File modificati
- `server.js` — `mkVolleyBall` (palla su `V_NET_X`), `vApplyInputSrv` (parametro `servePhase`/`serveTeam`, muro rete selettivo), `V_SERVE_RESTRICT_X_L/R` ricalcolate rispetto a `V_NET_X` con margine fisso
- `js/modes/volley/physics.js` — `vApplyInput` (muro rete selettivo), `V_SERVE_RESTRICT_X_L/R` ricalcolate
- `js/modes/volley/game.js` — `vGoal`/`vReset` posizionano la palla su `V_NET_X`

---

## v2.24.0 — Fix restrizione battuta superabile, fix preset applicato solo esteticamente

### 🔧 Fix
- Restrizione battuta pallavolo superabile tramite spinta di un compagno di squadra: ora riapplicata anche dopo le collisioni player-player (server.js vTick e game.js vUpdate training).
- Preset non applicato correttamente all'avvio partita: causa una race condition con timeout fisso di 400ms. Ora il preset viene inviato subito e il bottone Inizia partita resta disabilitato finché il server non conferma.

### 📁 File modificati
- server.js
- js/modes/volley/game.js
- js/network-core.js
- js/menu.js
- js/lobby.js

---

## v2.23.1 — Fix critico: schermo nero, menu P non funzionante, hotkey F1/F2 → Q/E

### 🔧 Fix
- **Causa root dello schermo nero / menu P non apribile**: in `lobby.js`, la chiamata `buildViewPicker()` a livello top-level (eseguita subito al caricamento dello script, non dentro una funzione) cercava l'elemento `#view-picker` nel DOM. La v2.23.0 aveva rimosso quell'elemento dall'HTML statico spostandolo nella generazione dinamica di `renderSettingsPanel()` (creato solo quando si apre la tab ⚙️ Impostazioni). Risultato: `buildViewPicker()` falliva con `TypeError` su `null.innerHTML`, e poiché l'errore avveniva in codice top-level di `lobby.js` (l'ultimo script con la logica dei bottoni della lobby), **interrompeva l'esecuzione dell'intero file**: nessun listener veniva agganciato ai bottoni "Crea stanza"/"Allenamento"/ecc., schermo nero, tasto P morto. Fix: rimesso `<div id="view-picker"></div>` come contenitore statico dentro `#gm-panel-settings` in `index.html`, così esiste fin dal caricamento della pagina indipendentemente da quale tab sia aperta.
- **Hotkey rapidi F1/F2 sostituiti con Q/E**: F1/F2 sono spesso intercettati dal browser/sistema operativo (apertura guida, ecc.) e scomodi da raggiungere durante il gioco. Nuovi default: `Q` = toggle prediction locale, `E` = toggle modalità avanzata pallavolo. Restano comunque liberamente rimappabili dal pannello Impostazioni (sezione "Comandi rapidi"). Chi aveva già salvato impostazioni in precedenza mantiene i propri tasti finché non li rimappa o usa "Ripristina default".

### 📝 Dove si trovano le impostazioni account
In-game (o in allenamento), premi **P** per aprire il menu → tab **⚙️ Impostazioni**. Lì si trovano: vista campo, prediction locale (per-modalità), modalità controlli pallavolo, griglia tasti rimappabili (clic sul pulsante poi premi il nuovo tasto, Esc per annullare) e i comandi rapidi (Q/E di default). Tutto si salva automaticamente in locale e, se loggati, viene sincronizzato sul proprio account Supabase.

---

## v2.23.0 — Impostazioni account (tasti + preferenze), fix rallentamento volley, sistema battuta server-authoritative, hotkey rapidi

### ✨ Novità
- **Impostazioni account complete** (`userSettings` in `state.js`, persistito in `localStorage` come `hax_settings` e, se loggati, sincronizzato su Supabase `profiles.settings`):
  - **Tasti personalizzabili**: movimento (su/giù/sx/dx), tiro/AZIONE (3 alternative), apertura menu, apertura chat (2 alternative). Rebind in-game cliccando il pulsante e premendo il nuovo tasto (Esc per annullare). Pannello in Menu → tab ⚙️ Impostazioni, sezione "Tasti — movimento e tiro".
  - **Prediction locale per-modalità**: preferenza separata per calcio e pallavolo (`userSettings.soccer.localPrediction` / `userSettings.volley.localPrediction`), non più un singolo toggle globale.
  - **Modalità controlli volley persistita**: `userSettings.volley.advancedControl` (base/avanzata) salvata e ripristinata automaticamente.
  - **Comandi rapidi (hotkey) configurabili**: `F1` = toggle prediction locale, `F2` = toggle modalità avanzata pallavolo. Personalizzabili dalla stessa griglia tasti, sezione "Comandi rapidi". Funzionano solo in-game con menu e chat chiusi; mostrano un messaggio di conferma in chat di sistema e aggiornano live i checkbox del pannello impostazioni se aperto.
  - **Reset ai default**: bottone ↺ nel pannello impostazioni per ripristinare tutti i tasti.
  - **Sync su Supabase**: se l'utente è loggato, ogni modifica a tasti/preferenze viene salvata in `profiles.settings` (richiede la colonna `settings jsonb` sulla tabella, vedi sezione ⚠️ sotto). Al login, le impostazioni salvate vengono caricate e sostituiscono quelle locali (merge con i default per eventuali nuove chiavi).

- **Sistema battuta pallavolo (server-authoritative)**:
  - All'inizio della partita batte sempre la squadra **rossa (sinistra)**. Dopo ogni punto, la battuta passa alla squadra che ha **subito** il punto.
  - Durante la fase di battuta, la squadra che **non** sta battendo viene respinta da una linea di restrizione (33%/67% del campo) e non può avvicinarsi al centro/rete.
  - La fase di battuta termina automaticamente non appena la squadra che batte tocca la palla (`vDoKick` riuscito sul team che serve).
  - Stato sincronizzato via messaggio dedicato `v_serve` (oltre che incluso nello `state` regolare) così i client mostrano subito chi deve servire, anche per i late-join.
  - **Indicatore visivo**: linea tratteggiata pulsante sul punto di restrizione + badge "🏐 BATTUTA ROSSI/BLU" sopra al campo durante la fase di battuta (`vDrawField`/`_vDrawServeRestriction` in `draw.js`).
  - Implementato sia lato server (`server.js`: `vApplyServeRestrictionSrv`, `vResetPositions`, `vHandlePoint`) sia lato client per l'allenamento e la prediction locale (`physics.js`: `vApplyServeRestriction`, `game.js`, `sync.js`).

### 🔧 Fix
- **Bug rallentamento pallavolo (e calcio) quando si tiene premuto AZIONE**: il cap della velocità massima ridotta (45% quando si preme AZIONE) veniva applicato **solo dopo** il ciclo di accelerazione/attrito del frame successivo, non immediatamente. Risultato: se il player era già alla velocità massima e premeva AZIONE, continuava a scivolare per inerzia prima di rallentare visibilmente. Fix: aggiunto un clamp immediato della velocità corrente al `topSpd` ridotto, applicato **subito** quando `pressing/charging` diventa vero, sia lato client (`physics.js` calcio e volley) sia lato server (`server.js`, funzioni `applyInput` e `vApplyInputSrv`). La fisica predittiva client (`sync.js`, `vTickRemotePhysics`/`tickRemotePhysics`) eredita automaticamente il fix chiamando le stesse funzioni.

### 📁 File modificati
- `js/config.js` — dichiarazione esplicita di `currentGameMode` (prima implicita, causava `ReferenceError` al primo load)
- `js/state.js` — `userSettings`, `SETTINGS_DEFAULT`, `_loadSettings()`, `_saveSettings()`
- `js/input.js` — keybind dinamici da `userSettings.keybinds`, gestione hotkey `handleHotkey()`
- `js/menu.js` — `renderSettingsPanel()` espanso con griglia tasti, rebind, hotkey, preset; `_renderKeybindGrid()`, `_startRebind()`
- `js/auth.js` — `authSyncSettings()`, `authLoadSettings()`
- `js/network-core.js` — gestione messaggio `v_serve`, propagazione stato battuta su `start`/`state`; rimossa dichiarazione duplicata di `currentGameMode`
- `js/modes/volley/physics.js` — fix cap velocità, `vApplyServeRestriction()`, linee di restrizione
- `js/modes/volley/game.js` — stato `vServeTeam`/`vServePhase`, logica battuta in `vGoal()`/`vReset()`/training loop
- `js/modes/volley/sync.js` — restrizione battuta applicata anche in prediction locale multiplayer
- `js/modes/volley/draw.js` — indicatore visivo linea di restrizione + badge battuta
- `js/modes/soccer/physics.js` — stesso fix cap velocità (preventivo, stesso pattern di bug)
- `js/modes/soccer/game.js` — sync `currentGameMode`/`useLocalPrediction` su `startGame()`
- `server.js` — `vApplyServeRestrictionSrv()`, `vResetPositions()` con `nextServeTeam`, `vHandlePoint()`, messaggio `v_serve`, `p.vAdvanced` per-player, fix cap velocità calcio e volley
- `css/menu.css` — stili `.keybind-grid`, `.kb-row`, `.kb-btn`, `.kb-listening`
- `index.html` — pannello impostazioni ora popolato dinamicamente da `renderSettingsPanel()`; hint hotkey in `#ctrl-bar`

### ⚠️ Richiede azione su Supabase (opzionale, solo per sync impostazioni multi-dispositivo)
Senza questa modifica le impostazioni funzionano comunque in locale (`localStorage`); la sync su Supabase fallisce silenziosamente (warning in console) finché la colonna non esiste.
```sql
alter table public.profiles
  add column if not exists settings jsonb;
```

---

## v2.22.1 — Fix auth: nickname card, stato login chiaro, RLS profili

### 🔧 Fix
- **Card nickname ancora visibile dopo login**: causa radice era doppia. Primo: `_renderAuthCard()` nascondeva `card-nickname` solo se `authUser && authProfile`; se il profilo non esisteva (RLS mancante), la condizione era falsa e la card restava. Secondo: il timing async del check sessione arrivava dopo il render iniziale. Entrambi risolti: la condizione è ora solo `authUser` (senza richiedere profilo), e `_renderAuthCard()` gestisce il caso "utente loggato senza profilo" con un avviso.
- **Registrazione: violazione policy su insert profiles**: la tabella `profiles` non aveva RLS policies per INSERT/SELECT/UPDATE. `authRegister` ora usa `upsert` invece di `insert` (meno fragile) e non blocca sul fallimento del profilo (solo warn in console), così l'utente risulta comunque autenticato. Aggiunte istruzioni SQL per creare le policy mancanti.
- **Partita con nome "Giocatore"**: `getNick()` in `lobby.js` ora controlla `authUser` (non solo `authProfile`) come condizione; usa il nickname dal profilo, o in fallback ricava il nome dall'email fittizia (`nick@haxball2.local → nick`). Non torna più a "Giocatore" se loggato.
- **UI stato login non chiaro**: aggiunto badge verde `✅ Login effettuato` sopra nome e avatar quando loggato; campi email/password completamente assenti; solo nome, avatar e bottone Esci visibili.

### ⚠️ Richiede azione su Supabase
Eseguire nel SQL editor di Supabase:
```sql
create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);
```

---

## v2.22.0 — Login con nickname, sicurezza password, preset stanze, fix palla volley

### ✨ Novità
- **Login/Registrazione con nickname** (non email): il form mostra solo Nickname + Password. Internamente viene derivata un'email fittizia `nickname_sanitized@haxball2.local` per soddisfare il requisito email di Supabase Auth. Il nickname funge quindi da username unico: se due utenti scelgono lo stesso nickname (normalizzato), Supabase restituisce "User already registered".
- **Nota sicurezza password** nel form di auth: `🔒 La password è cifrata con bcrypt — non viene mai salvata in chiaro`. Supabase usa bcrypt tramite GoTrue/pgcrypto. Le password non sono mai leggibili nel database.
- **Card nickname nascosta quando loggato**: `#card-nickname` viene messa `display:none` in `_renderAuthCard()` quando l'utente è loggato; riappare al logout. Il nome proviene dal profilo.
- **Sistema Preset**: salva/carica/elimina configurazioni di gioco.
  - **Salva** (in-game): tab Variabili del menu → sezione gialla "Salva preset" con input nome + bottone ⭐ (visibile solo host loggato).
  - **Carica** (lobby): alla apertura "Crea stanza", se loggato e con preset salvati, appare un selector giallo con i preset. Selezionandone uno, il mode picker si aggiorna automaticamente. Al click "Crea", la config del preset viene applicata alla stanza appena creata via `set_config`/`set_vconfig` (con 400ms di ritardo per garantire che la stanza esista).
  - **Elimina**: bottone 🗑️ accanto al selector nella card "Crea stanza".
  - Richiede tabella `presets` su Supabase (SQL fornito nella documentazione): `id`, `user_id`, `name`, `mode`, `config` (jsonb), `created_at`. RLS abilitata: ogni utente vede solo i propri preset.

### 🔧 Fix
- **Palla pallavolo non cambiava visivamente** con `V_BR` modificato: `vDrawBall()` usava la costante `V_BR` invece di `vBall.r`. Ora usa `vBall.r` che viene aggiornato live da `applyVConfigPatch`.
- **Font avatar proporzionale al raggio player** (calcio e pallavolo): la dimensione del font del testo/emoji nel cerchio del player ora scala con `p.r` tramite `Math.round(p.r * factor)` con `min=8`. A raggio default produce la stessa size di prima; cresce/diminuisce correttamente con raggi grandi/piccoli.

---

## v2.21.2 — Fix auth card: form visibile immediatamente

### 🔧 Fix
- **Causa reale della card vuota**: se `window.supabase.createClient(...)` al top-level di `auth.js` lancia un errore (CDN lento, blocco AdBlock, rete), **l'intera esecuzione del file si blocca silenziosamente** — nessuna funzione viene definita, `_renderAuthCard()` non esiste, la card resta vuota.
- **Soluzione**: init di Supabase racchiuso in `try/catch` con fallback `_supabase = null`. `_renderAuthCard()` viene chiamata **in modo sincrono** come primo statement eseguito — non dipende da Supabase, mostra il form immediatamente. Il check sessione avviene dopo, in background con `.then()` (niente `async/await` a top-level che potrebbe sospendere l'esecuzione).
- Handler dei bottoni convertiti da `async function` a funzioni sincrone con `.then().catch()` — più robusti contro errori asincroni non catturati.
- Rimosse tutte le dipendenze da `async` a top-level.

---

## v2.21.1 — Fix definitivo auth card vuota

### 🔧 Fix
- **Auth card sempre vuota**: `auth.js` era caricato prima di `state.js` e `lobby.js`, quindi quando tentava di renderizzare la card, né `mySkin` né `escHtml` esistevano ancora, causando un errore silenzioso che lasciava la card grigia/vuota. Soluzione: `auth.js` spostato come **ultimissimo script** (dopo `lobby.js`), eseguito a fine `<body>` quando DOM e tutte le variabili sono già definiti. Rimosso `DOMContentLoaded` (inutile a fine body). Rimossa la chiamata ridondante a `_renderAuthCard()` in `lobby.js`.

---

## v2.21.0 — Raggio player e palla modificabile in-game + fix auth card

### ✨ Novità
- **Raggio player e palla nelle Variabili** (calcio e pallavolo): l'host può cambiare la dimensione dei player (`P_RADIUS` / `V_PR`) e della palla (`B_RADIUS` / `V_BR`) dal pannello 🎛️ Variabili. Il cambio si propaga in tempo reale a tutti i client e al server — i `p.r` e `ball.r` vengono aggiornati live in `applyConfigPatch`/`applyVConfigPatch` (server) e nei `case 'config'`/`'vconfig'` di `network-core.js` (client). La fisica server (bounds, kick, kickCooldown) usa `ball.r` e `p.r` invece delle costanti hardcoded `BR`/`V_BR`.
- `CONFIG_DEFAULT` e `V_CONFIG_DEFAULT` nel server includono ora `P_RADIUS:18`, `B_RADIUS:11`, `V_PR:20`, `V_BR:10`.
- `buildPlayers` nel server accetta `cfg`/`vcfg` e usa il raggio dalla config della room.
- `mkBall(cfg)` e `mkVolleyBall(vcfg)` usano il raggio dalla config.

### 🔧 Fix
- **Auth card invisibile**: prima correzione tentata (non sufficiente).

---

## v2.20.0 — Autenticazione opzionale Supabase

### ✨ Novità
- **`js/auth.js`**: client Supabase inizializzato con URL e anon key. Espone `authLogin`, `authRegister`, `authLogout`, `authGetProfile`, `authCurrent`, `authSaveAvatar`. Al caricamento pagina verifica la sessione esistente (`getSession`) e ripristina profilo/avatar automaticamente.
- **Card auth in lobby** (`index.html` + `css/lobby.css`): card compatta sopra quella del nickname con due stati: non loggato (form email+password) e loggato (avatar + nome + esci).
- **Nickname bloccato (readonly)** quando loggato.
- **Avatar come `mySkin`**: emoji/stringa salvata in `profiles.avatar` e usata come skin.
- **`getNick()` aggiornato** (`js/lobby.js`): usa `authProfile.nickname` se loggato.
- SDK Supabase via CDN (`@supabase/supabase-js@2` da jsdelivr).

---

## v2.19.0 — Fix definitivo doppio tocco: kickCooldown per-player

### 🔧 Fix
- **Doppio (o triplo) tocco mentre la palla attraversa il player** (`js/modes/volley/physics.js`, `server.js`): la causa reale non era il check post-tick ma il fatto che in modalità base, ogni frame in cui la palla rimane dentro il raggio del player con AZIONE premuta, `vDoKick` veniva chiamata e contava un tocco. Se la palla ci metteva 3 frame ad attraversare → 3 tocchi.
- **Soluzione**: aggiunto `p.kickCooldown` (bool) su ogni player. `vDoKick`/`vDoKickSrv` impostano `kickCooldown = true` dopo aver tirato. Il flag si azzera solo quando la distanza `player↔palla` torna sopra `p.r + V_BR` (palla uscita dal raggio). Finché la palla è dentro e ha già tirato, ignora qualsiasi altra chiamata. Garantisce esattamente **un tocco per ogni ingresso della palla nel player**.
- Rimosso il check post-tick per palle veloci (era un palliativo che introduceva altri edge case). Il cooldown gestisce correttamente anche le palle veloci: se la palla entra ed esce in un singolo frame, al frame successivo il cooldown è già azzerato.
- `kickCooldown: false` inizializzato in `buildPlayers`, `vBuildPlayers`, `vResetPositions` e `vGoal`.
- `vUpdateKickCooldown(p)` aggiornato ogni frame nel loop training per i player che non stanno premendo AZIONE.

---

## v2.18.0 — Fix doppio tocco pallavolo (kickedThisTick)

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

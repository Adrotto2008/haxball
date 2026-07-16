# 📋 Aggiornamenti — HaxBall 2

Versione più recente sempre in cima. Ad ogni modifica aggiornare `VERSION` in `js/config.js`.

---

## v2.47.0 — Nuova modalità: 🎯 Sniper (implementazione completa)

Prima implementazione completa della terza modalità di gioco, a partire dallo spec caricato (`sniper.md`): 5 file dedicati sotto `js/modes/sniper/` con prefisso `S_`, integrazione in tutti i file condivisi, fisica server-autoritativa in multiplayer.

### 🎯 La modalità
- Campo identico per forma a calcio/pallavolo (1020×600, FL 40px di margine), ma senza porta unica: **3 mini-porte per lato** (alte 60px, centrate a 3 altezze diverse), ciascuna con 2 pali fisici circolari con cui la palla collide e rimbalza.
- Nessuna gravità (vista dall'alto come il calcio). Palla molto scattante: attrito quasi nullo (`S_B_FRIC=0.999`) e rimbalzo molto elastico (`S_B_BOUNCE=0.93`) sia sui muri pieni sia sui pali — rimbalza a lungo, molto diversa dal pallone "pesante" del calcio.
- **Zone di movimento**: due righe verticali "cyan" (non muri fisici per la palla, solo per i giocatori) dividono il campo in tre fasce — zona rossi, zona condivisa centrale, zona blu. Normalmente ogni squadra può avanzare fino alla riga avversaria (`S_NET_R`/`S_NET_L`); durante la **rimessa** dopo un gol (`sKickoff`), la squadra che NON deve ripartire resta confinata alla propria riga, molto più indietro, finché l'altra squadra non colpisce la palla con forza (soglia `Math.hypot(vx,vy) > 2.0`).
- A differenza della pallavolo (dove serve chi ha segnato), la rimessa sniper segue la convenzione **calcio**: riparte chi ha *subito* il gol.
- Tiro identico al calcio come meccanica (carica tenendo AZIONE, rilascio per tirare, stessa formula forza min→max) ma con una differenza voluta dallo spec: **nessun rallentamento della velocità massima durante la carica** (nel calcio si scende a `P_SPEED_MAX*0.45`, qui resta sempre al massimo).
- Collisioni palla↔player e player↔player passive come nel calcio (nella pallavolo non esistono, solo tocco esplicito).

### 📐 Decisioni prese in autonomia rispetto allo spec originale
- **Payload di stato ottimizzato**: lo spec proponeva un formato `sSerializeState` con `vx/vy` per player incluso; seguito invece il formato attuale (già ottimizzato in v2.30.0) di calcio/pallavolo — niente `vx/vy` (mai letti dal rendering), spettatori compressi a `0`. Coerenza di banda con le altre 2 modalità, nessuna perdita funzionale.
- **`S_P_WALL_BOUNCE`**: non elencata nello spec tra le variabili del pannello host, ma necessaria per il rimbalzo dei giocatori sui bordi campo — aggiunta a `S_CONFIG`/`S_CONFIG_DEFAULT` (default 0.4) ma volutamente esclusa da `S_CONFIG_META` (nessuno slider), per non introdurre una costante fissa nel codice fisico (stessa ragione di `P_WALL_BOUNCE`/`V_P_WALL_BOUNCE`).
- **Riapplicazione dei limiti di zona dopo le collisioni player↔player**: non esplicitata nell'ordine del tick dello spec, ma aggiunta seguendo lo stesso pattern già necessario in pallavolo (`vApplyServeRestrictionSrv` richiamata due volte) — senza, una spinta fra compagni di squadra potrebbe superare la riga cyan per un frame prima della correzione.
- **Freccia di mira** (`sDrawShotArrow`): non esplicitamente elencata ma inclusa perché lo spec chiede fedeltà visiva al calcio, che la prevede — utile anzi di più qui, vista la precisione richiesta per centrare una porta larga 60px.

### 🧹 Parità cross-modalità: bug preesistenti nel pattern a 2 modalità, emersi aggiungendo la terza
Diversi punti del codice condiviso distinguevano correttamente calcio/pallavolo ma non erano scritti per generalizzare a N modalità. Estesi tutti allo stesso schema:
- `js/modes/soccer/game.js` (`startGame`, `startTraining`) e `js/modes/volley/game.js` (`startVolleyGame`): fermavano solo il loop dell'altra modalità (`vStopLoop()`/`stopLoop()`), non quello sniper — un loop RAF sniper sarebbe rimasto attivo in sottofondo passando a calcio/pallavolo. Aggiunto `sStopLoop()`.
- `js/admin.js` (`toggleAfk`), `js/chat.js` (`/pause`, `/stop`): puntavano all'array player o al flag `running` sbagliato quando la modalità attiva non era calcio né pallavolo.
- `js/input.js` (hotkey `Q`, toggle prediction), `js/menu.js` (toggle prediction nel pannello impostazioni), `js/state.js`/`js/auth.js` (`SETTINGS_DEFAULT`, merge impostazioni locali/cloud): il sistema di preferenze "prediction locale" distingueva solo `volley`/`soccer` — sniper cadeva silenziosamente nel bucket calcio. Aggiunto bucket `sniper` dedicato in `SETTINGS_DEFAULT` e in tutti i punti che lo leggono/scrivono.
- `js/auth.js` (`_populatePresetSelect`): i preset salvati in modalità sniper mostravano l'icona ⚽ invece di 🎯.

### 📁 File creati
- `js/modes/sniper/config.js` — costanti fisiche, campo/porte/pali, `S_CONFIG` live, `S_CONFIG_META` (pannello host)
- `js/modes/sniper/physics.js` — movimento, tiro, collisioni, limiti di zona, pali, muri con aperture
- `js/modes/sniper/draw.js` — campo/porte/pali (stile dedicato), player/palla/freccia (fedeli al calcio)
- `js/modes/sniper/game.js` — stato partita, update loop, gol, reset, build player/palla, avvio training/multiplayer
- `js/modes/sniper/sync.js` — interpolazione snapshot player remoti, applica stato dal server, dead reckoning + prediction locale

### 📁 File modificati
- `index.html` — pulsante Sniper nei due mode-picker (crea stanza, allenamento); tag script dei 5 file sniper dopo pallavolo, prima di lobby.js
- `js/config.js` — VERSION, commento `currentGameMode`
- `js/state.js` — `sSnapshotBuffer`/`sRemoteState`; bucket `sniper` in `SETTINGS_DEFAULT`, `_loadSettings`, `_saveSettings`, sync all'avvio
- `js/input.js` — hotkey toggle prediction riconosce anche sniper
- `js/admin.js` — `toggleAfk()` punta a `sPlayers` in modalità sniper
- `js/chat.js` — `/pause` `/stop` controllano anche `sRunning`
- `js/auth.js` — merge `sniper` nelle impostazioni cloud; icona 🎯 nei preset sniper
- `js/lobby.js` — `showLobby()` ferma il loop sniper; `btn-train-go` avvia `startSniperTraining()`; `btn-restart` gestisce il reset training sniper
- `js/menu.js` — `renderSettingsPanel()`/toggle prediction e `renderConfigPanel()` (variabili, slider live, salvataggio preset) riconoscono la modalità sniper; `esc-restart` gestisce il reset training sniper
- `js/network-core.js` — nuovo case `'sconfig'`; sniper integrato in `created`, `joined`, `pm_update`, `start` (normale e late-join), `restarted`, `state`, `meta`, `goal`, `game_over`, `team_change`, `player_left`
- `js/modes/soccer/game.js`, `js/modes/volley/game.js` — fermano anche il loop sniper all'avvio (vedi sezione parità sopra)
- `server.js` — `S_CONFIG_DEFAULT`, costanti fisse campo/porte; fisica sniper server-side completa (`sSApplyInput`, `sApplyZoneLimitSrv`, `sSCheckWalls`, `sSCheckPoles`, ecc.); `sTick`; `mkSniperBall`, `sResetPositions`, `sSerializeState`, `sHandleGoal`; `buildPlayers`/`mkRoom`/`initRoomBall`/`startMatch` estesi con il ramo sniper; handler `set_sconfig`; sniper in `create`/`join`/`restart`

### ⚠️ Deploy
Modifica server-side inclusa (`server.js`): la modalità Sniper in multiplayer online richiede `git push` + deploy Render. Allenamento in locale e menu/UI sono già attivi al reload del client.

### 🔜 Non ancora testato
Implementazione completa ma non ancora giocata: consigliato un giro di test in allenamento (mira sulle 3 porte, rimbalzi sui pali, rimessa dopo gol) e poi in multiplayer reale prima di considerarla stabile.

---

## v2.46.0 — Pallavolo avanzata: animazione di carica "ad arco che si forma", identica al calcio

Su richiesta ("fai che nella pallavolo nella modalita' avanzata il colpo caricato [...] si carica nel tempo come nel calcio [...] fai la stessa animazione che il cerchio si forma mentre tieni premuto").

### 🔍 Cosa c'era gia' e cosa mancava
- La carica nel tempo in modalita' AVANZATA **esisteva gia'**, identica al calcio: `p.charge` cresce di 1 ogni frame tenendo premuto AZIONE fino a `V_KICK_CHG_F` (50 frame, stesso valore del calcio), e la forza del colpo al rilascio dipende da quella frazione (`V_KICK_MIN` → `V_KICK_MAX`) — sia lato client (`vApplyInput`/`vDoKick`) sia lato server (`vApplyInputSrv`/`vDoKickSrv`).
- Quello che mancava era la resa VISIVA: l'animazione precedente in `vDrawPlayer()` disegnava due anelli SEMPRE completi (0→2π fin da subito), solo piu' opachi/spessi man mano che la carica saliva — non comunicava un vero "riempimento" nel tempo, dando l'impressione che il colpo fosse gia' pronto al massimo appena premuto, anche se la fisica sotto non lo era.

### ✅ Il fix
- Sostituita con la stessa identica animazione del calcio (`drawPlayer()` in `js/modes/soccer/draw.js`): un arco parziale che parte da vuoto (appena premuto AZIONE) e cresce in senso orario partendo dall'alto fino a giro completo (carica massima) — un vero indicatore di progresso circolare, non piu' un'aura statica.
- In modalita' BASE (dove il tiro parte subito, senza attesa) l'arco appare gia' pieno appena si preme, coerente con l'assenza di una vera fase di carica da mostrare in quella modalita'.

### 📁 File modificati
- `js/modes/volley/draw.js` — `vDrawPlayer()`: nuova animazione ad arco di carica (sezione "ANIMAZIONI AZIONE")

---

## v2.45.0 — Fix regressione: il tiro nel calcio era diventato inaffidabile (KICK_DIST_X=0 rotto dal fix v2.42.0)

Su segnalazione ("non funziona il tiro, continuo a non poter toccare il pallone [...] e' come se lo toccassi prima").

### 🐛 Il bug — effetto collaterale del fix v2.42.0
- v2.42.0 aveva portato `KICK_DIST_X` (margine di tiro) a **0**, per far scattare il tiro solo a vero contatto invece che fino a 12px prima. Sensato in teoria, ma ha reso il tiro **inaffidabile**:
- La collisione passiva palla↔player (`circleCollide`, sempre attiva ogni tick indipendentemente da AZIONE) risolve ogni sovrapposizione spingendo la palla esattamente a distanza `p.r+ball.r` dal player — MAI realmente dentro quel raggio nel momento in cui `doKick()` la controlla (che usa le posizioni di fine tick precedente, dato che il tiro scatta al RILASCIO di AZIONE dopo la carica).
- Per il rumore di virgola mobile intrinseco in quella spinta (divisione per 2, `Math.hypot`), la distanza risultante e' quasi sempre di un pelo sopra o sotto il valore esatto in modo imprevedibile: con soglia ESATTA (margine 0), il confronto `d > soglia` falliva a caso, e il tiro non scattava quasi mai — "come se la toccassi prima" era letteralmente quello che succedeva: la palla veniva sempre respinta a distanza limite dalla collisione passiva PRIMA che il tiro vero potesse registrare un tocco valido.

### ✅ Il fix
- `KICK_DIST_X` di default riportato a **2** (non piu' 0, ma nemmeno i 12 originali) in `server.js` e `js/state.js`. Questo margine minimo assorbe il rumore di virgola mobile della collisione passiva senza reintrodurre il problema originale (tiro che scattava con la palla visibilmente staccata dal player).
- La freccia di tiro (`SHOT_ARROW_VISUAL_MARGIN`, v2.43.0) resta invariata: era gia' scorporata da `KICK_DIST_X` e non era la causa di questo problema.

### 📁 File modificati
- `server.js` — `CONFIG_DEFAULT.KICK_DIST_X` 0→2; commento `doKick()` aggiornato con la causa reale
- `js/state.js` — `CONFIG.KICK_DIST_X` 0→2
- `js/modes/soccer/physics.js` — commento `doKick()` aggiornato con la causa reale

### ⚠️ Deploy
Modifica server-side inclusa (`server.js`): serve `git push` + deploy Render perche' il fix abbia effetto in multiplayer online. Le modifiche client sono attive subito al reload.

---

## v2.44.0 — Fix: la regola del tocco singolo in battuta (v2.41.0) non scattava mai per le battute dei ROSSI

Su segnalazione ("non funziona bene il fatto che [...] tocchi due volte nella battuta [...] a volte non funziona").

### 🐛 Il bug — trovato e confermato
- I comandi di battuta `/a` `/q` `/z` **teletrasportano** la palla dal centro rete alla posizione del battitore (per poi lanciarla verso l'alto) — un salto istantaneo di posizione, non un vero movimento fisico.
- Il rilevamento "la palla ha attraversato la rete" (che decide quando disattivare la regola del tocco singolo, impostando `vServeRallyLive`/`room.vServeRallyLive = true`) confronta pero' solo la coordinata X della palla prima/dopo ogni tick, senza distinguere un vero movimento da un teletrasporto.
- La palla ferma sul centro rete (`x = V_NET_X` esatto) veniva sempre classificata come "lato blu" per via del confronto rigoroso `x < V_NET_X` (mai vero esattamente sul centro). Quindi: quando battevano i **BLU**, il teletrasporto della battuta li spostava sullo stesso lato gia' registrato (blu) — nessun falso cambio lato, la regola funzionava. Quando battevano i **ROSSI**, il teletrasporto li spostava sul lato opposto (rosso) rispetto a quello registrato (blu) — il salto veniva scambiato per un vero attraversamento della rete, `vServeRallyLive` diventava `true` **subito dopo il lancio, prima ancora del vero colpo di battuta**: da quel momento la regola del tocco singolo era gia' disattivata, e un secondo tocco veniva giudicato con le regole normali (fino a 3 tocchi), non come fallo.
- Dato che ogni partita inizia sempre con la battuta dei ROSSI (`vServeTeam:0`), il bug si presentava sistematicamente al primo scambio di ogni partita, poi a fasi alterne a seconda di chi vinceva il punto precedente (chi fa punto serve dopo) — esattamente il comportamento "a volte funziona, a volte no" segnalato.

### ✅ Il fix
- Subito dopo il teletrasporto della battuta, `vApplyServeVariantLocal()` (client) e `vApplyServeVariant()` (server) risincronizzano immediatamente `vBallLastSide`/`room.vBallLastSide` con la posizione reale appena assegnata alla palla. Il prossimo controllo di cambio lato non vede piu' un salto artificiale: `vServeRallyLive` resta correttamente `false` finche' la palla non attraversa DAVVERO la rete in volo, per entrambe le squadre, in modo simmetrico.

### 🧹 Pulizia minore correlata
- `vGoal()` (client, allenamento) non azzerava `p.kickCooldown` dopo un punto, a differenza di `vReset()` che lo fa gia': allineato per coerenza (nessun impatto pratico osservabile, la palla riparte lontana dai player, ma teneva lo stato piu' pulito).

### ⚠️ Se il problema persiste
Questo fix risolve il caso confermato (la regola disattivata silenziosamente per meta' delle battute). Se dopo il deploy capita ancora che un punto venga assegnato/mostrato ma il campo non si resetti, servirebbe sapere: allenamento o multiplayer, quale squadra serviva, e se il punto arriva dal tocco singolo in battuta o da un'altra regola (doppio tocco/3 tocchi) — aiuterebbe a isolare un eventuale secondo problema distinto da questo.

### 📁 File modificati
- `js/modes/volley/physics.js` — `vApplyServeVariantLocal()`: risincronizza `vBallLastSide` dopo il teletrasporto
- `server.js` — `vApplyServeVariant()`: risincronizza `room.vBallLastSide` dopo il teletrasporto
- `js/modes/volley/game.js` — `vGoal()`: azzera anche `p.kickCooldown`

### ⚠️ Deploy
Modifica server-side inclusa (`server.js`): serve `git push` + deploy Render perche' il fix abbia effetto in multiplayer online. Le modifiche client sono attive subito al reload.

---

## v2.43.0 — Fix regressione: freccia di tiro sparita nel calcio (effetto collaterale del fix v2.42.0)

Su segnalazione ("nel calcio non spunta piu' la freccia di dove tiri, appunto per questo [il fix precedente], e' meno evidente ma c'e' sempre [il tiro]").

### 🐛 Il problema
- Il fix v2.42.0 (`KICK_DIST_X` default 12→0, per far scattare il tiro solo a contatto reale) era corretto per la fisica, ma `drawShotArrow()` in `js/modes/soccer/draw.js` usava la STESSA soglia (`CONFIG.KICK_DIST_X`) anche per decidere quando mostrare la freccia di direzione/carica del tiro. Risultato: la freccia, che prima appariva con un margine di anticipo (12px) mentre ci si avvicinava alla palla, ora appare solo esattamente a contatto — molto meno utile come guida visiva mentre ci si avvicina.

### ✅ Il fix
- `drawShotArrow()` ora usa una soglia **separata e puramente estetica** (`SHOT_ARROW_VISUAL_MARGIN = 12`, lo stesso valore di anticipo che c'era prima), indipendente da `CONFIG.KICK_DIST_X`. La freccia torna a comparire con un margine di anticipo come prima del v2.42.0, ma il tiro vero continua a richiedere un overlap reale (nessuna reintroduzione della tolleranza sul tiro, resta corretta come fixata in v2.42.0).

### 📁 File modificati
- `js/modes/soccer/draw.js` — `drawShotArrow()`: soglia di visibilita' scorporata da `CONFIG.KICK_DIST_X`

---

## v2.42.0 — Fix reali su richiesta: collisioni palla in multiplayer, tiro anticipato nel calcio, linea di battuta piu' visibile

Su richiesta ("le cose che hai fatto non sono fatte bene [...] vedo la palla che fluttua sulla rete al posto di appoggiarsi [...] in calcio se inseguo la palla la tocco prima di toccarla veramente"). A differenza delle sessioni precedenti, qui non si tratta di nuove regole ma di **bug reali** trovati rileggendo `server.js`, entrambi i `physics.js` e entrambi i `sync.js` da zero.

### 🐛 BUG PRINCIPALE — la palla in multiplayer non collideva affatto con la rete/muretto centrale
- **Causa**: `vTickRemotePhysics()` (`js/modes/volley/sync.js`), il path che muove la palla in dead-reckoning/prediction lato client durante una partita multiplayer, non chiamava mai `vBallCollidePost()` — a differenza di `vTickBall()` (allenamento) e `vTickBallSrv()` (server), che l'hanno sempre chiamata. Violava il principio di parita' fisica del progetto.
- **Effetto visibile**: la palla passava attraverso il muretto/rete localmente (nessun rimbalzo, nessun appoggio) finche' non arrivava la correzione dal prossimo stato del server, che la "risistemava" di scatto sulla posizione vera (gia' appoggiata) — percepito esattamente come "la palla fluttua sulla rete invece di appoggiarsi". **Fix**: aggiunta la chiamata mancante, stessa posizione nel ciclo fisico di `vTickBall()`/`vTickBallSrv()`.
- **Bug gemello nel calcio**: `tickRemotePhysics()` (`js/modes/soccer/sync.js`) non applicava mai la collisione fisica passiva palla↔player (quella sempre attiva, non il tiro con AZIONE) che invece il server applica ad ogni tick a tutti i player (`circleCollide(p,ball,cfg.B_HIT_R)` in `tick()`). Stesso sintomo: la palla poteva attraversare i player nella prediction locale prima della correzione server. Aggiunta la chiamata mancante per coerenza.

### 🐛 Fix — la palla "fluttuava"/vibrava anche quando si appoggiava davvero sulla rete (pallavolo)
- Anche a collisione presente, un urto debole (palla che si posa in cima al muretto, non una vera schiacciata) veniva comunque rimbalzato al 30% della velocita' (`V_B_BOUNCE`) e la gravita' la spingeva subito dentro di nuovo il frame dopo: risultato, una serie di micro-rimbalzi visibili all'infinito invece di un appoggio stabile.
- **Fix**: sotto una soglia di urto minima (`V_POST_REST_THRESHOLD = 0.6`), la componente di velocita' entrante viene annullata invece di rimbalzata (appoggio inelastico) — urti forti (vere schiacciate) continuano a rimbalzare normalmente. Applicato identicamente in `vBallCollidePost()` (client) e `vBallCollidePostSrv()` (server).

### 🐛 Fix — calcio: il tiro scattava fino a 12px PRIMA del tocco reale
- `KICK_DIST_X` (default 12, non esposto nel pannello Variabili) veniva sommato al raggio combinato player+palla nella soglia di tiro (`doKick()`, sia client sia server): il tiro poteva scattare con la palla ancora visibilmente separata dal player — esattamente "la tocco prima di toccarla veramente".
- **Fix**: default portato a **0** (il tiro richiede overlap reale) in `server.js` e `js/state.js`. Aggiunta anche una voce nel pannello Variabili ("Margine extra tiro", 0–30) cosi' un host che vuole un po' di tolleranza (es. per compensare lag) puo' reimpostarla, invece di essere un valore nascosto e non regolabile come prima.

### 🎮 Linea di restrizione battuta ancora piu' visibile
- Prima: solo una sottile linea tratteggiata pulsante — facile da non notare a colpo d'occhio, specie con due margini ora diversi tra le due squadre (v2.41.0).
- Ora: una **fascia colorata semi-trasparente** riempie l'intera zona vietata (dalla linea fino alla rete) su ENTRAMBI i lati, col colore della squadra a cui e' vietata, piu' un'etichetta 🚫 in alto su ciascuna linea. La zona/limite e' ora inequivocabile per entrambe le squadre, non solo un tratteggio sottile.

### 📁 File modificati
- `js/modes/volley/sync.js` — `vTickRemotePhysics()`: aggiunta chiamata mancante a `vBallCollidePost()`
- `js/modes/soccer/sync.js` — `tickRemotePhysics()`: aggiunta collisione fisica palla↔player mancante
- `js/modes/volley/physics.js` — `vBallCollidePost()`: appoggio inelastico per urti deboli (no piu' micro-rimbalzi)
- `server.js` — `vBallCollidePostSrv()`: stesso fix appoggio inelastico; `CONFIG_DEFAULT.KICK_DIST_X` 12→0; commenti `doKick()`
- `js/state.js` — `CONFIG.KICK_DIST_X` 12→0; nuova voce in `CONFIG_META` ("Margine extra tiro")
- `js/modes/soccer/physics.js` — commento esplicativo `doKick()`
- `js/modes/volley/draw.js` — `_vDrawServeRestriction()`: fascia colorata + etichette 🚫, oltre alla linea tratteggiata gia' presente

### ⚠️ Deploy
Modifiche server-side incluse (`server.js`): serve `git push` + deploy Render perche' i fix abbiano effetto in multiplayer online. Le modifiche client (`sync.js`, `physics.js`, `draw.js`, `state.js`) sono attive subito al reload del browser.

---

## v2.41.0 — Pallavolo: battuta a tocco singolo + margini asimmetrici

Su richiesta: "quando uno deve fare la battuta, non può fare più di un tocco senò è punto dell'avversario" e "durante la battuta [...] quello che batte ha un'area del campo ancora più piccola [...] mentre chi non batte ha la linea più vicina al centro".

### 🚫 Tocco singolo obbligatorio in battuta
- Nuovo stato `vServeRallyLive` (client: `game.js`/`physics.js`; server: `room.vServeRallyLive`): parte `false` ad ogni nuova battuta, diventa `true` la prima volta che la palla attraversa la rete verso il campo avversario (stesso punto in cui gia' si azzeravano i tocchi al cambio lato).
- Finche' `vServeRallyLive` e' `false`, la squadra che deve servire (`vServeTeam`) puo' toccare la palla **una sola volta**: un secondo tocco suo prima che il servizio abbia effettivamente passato la rete e' un fallo con punto immediato all'avversario — regola distinta e piu' severa del normale limite di 3 tocchi a scambio, che resta invariato per il resto del punto.
- Non copre solo il "vero" colpo di battuta: se il servizio rimbalza sul muretto centrale e torna sul campo di chi ha servito, un secondo tocco della stessa squadra e' comunque fallo (il servizio non e' mai "passato").
- Il lancio della battuta (`/a /q /z`, `vApplyServeVariantLocal`/`vApplyServeVariant`) resta — come già prima — un non-tocco: non incrementa `vTouches` e non influenza questa regola.

### 🎮 Margini di restrizione asimmetrici (battitore vs ricevitore)
- Prima (v2.40.0): un solo margine di 70px dalla rete, identico per entrambe le squadre durante la battuta.
- Ora: due margini distinti — `V_SERVE_RESTRICT_MARGIN_SERVER = 140` per chi batte (area di campo piu' piccola, linea spinta piu' indietro rispetto a prima) e `V_SERVE_RESTRICT_MARGIN_RECEIVER = 40` per chi non batte (puo' avvicinarsi alla rete piu' di prima). Il margine applicato a ciascun player dipende da chi sta servendo in quel momento (`p.team === serveTeam`), quindi non e' piu' precalcolabile in due costanti fisse per team come prima.
- Indicatore visivo aggiornato di conseguenza: `_vDrawServeRestriction()` ora disegna le due linee a distanze diverse dalla rete invece che simmetriche.

### 📁 File modificati
- `js/modes/volley/physics.js` — `vIncrementTouch()`: regola tocco singolo in battuta; `vCheckSideChange()`: imposta `vServeRallyLive=true` al cambio lato; `vApplyServeRestriction()`: margine dinamico battitore/ricevitore con le nuove costanti `V_SERVE_RESTRICT_MARGIN_SERVER`/`RECEIVER`
- `js/modes/volley/game.js` — nuova variabile `vServeRallyLive`, resettata in `vGoal()` e `vReset()`
- `js/modes/volley/draw.js` — `_vDrawServeRestriction()`: due linee a margini diversi in base a chi serve
- `server.js` — stessa logica autoritativa: `room.vServeRallyLive` (in `mkRoom`, `vResetPositions`, aggiornato in `vTick` al cambio lato); regola tocco singolo nel blocco tocchi di `vTick`; `vApplyServeRestrictionSrv()` con margine dinamico

---

## v2.40.0 — Pallavolo: rete leggermente più alta + battuta obbligatoria per entrambe le squadre

Su richiesta ("nella pallavolo fai che la rete è leggermente più alta, proprio di poco, e che uno può battere solo usando i servizi").

### 🏐 Rete leggermente più alta
- `V_POST_H` (altezza del muretto/rete centrale) aumentata del +15% rispetto al valore precedente (1/8 dell'altezza campo), tramite un nuovo moltiplicatore esplicito `V_NET_HEIGHT_MULT = 1.15` invece di cambiare il divisore originale — più facile da ritoccare in futuro. Applicato in modo identico su client e server (parità fisica): stesso muretto, stessa collisione palla, stesso limite di attraversamento per i player.

### 🚫 Battuta obbligatoria: la restrizione ora vale anche per chi deve servire
- **Prima**: durante la fase di battuta, solo la squadra che NON doveva servire era tenuta lontana dalla rete (margine 70px); chi doveva battere poteva camminare fino alla rete e toccare direttamente la palla ferma sulla linea centrale, saltando di fatto la battuta vera e propria (i comandi `/a /q /z`).
- **Ora**: `vApplyServeRestriction()` (client) e `vApplyServeRestrictionSrv()` (server) applicano il margine di 70px a ENTRAMBE le squadre durante `vServePhase`/`room.vServePhase`, non solo a chi non batte. La palla ferma sulla rete non è più raggiungibile da nessuno semplicemente avvicinandosi: l'unico modo di rimetterla in gioco è una battuta vera (`/a` `/q` `/z`), che la fa comparire vicino al battitore indipendentemente dalla sua posizione in campo — quindi il flusso di battuta resta invariato per chi usa i comandi, cambia solo il fatto che non si può più bypassarli.
- Indicatore visivo aggiornato di conseguenza: `_vDrawServeRestriction()` ora disegna DUE linee tratteggiate (una per lato, ciascuna del colore della squadra che non può oltrepassarla) invece di una sola.
- Nessun impatto sulla validazione dei comandi `/a /q /z` (`chat.js`): già corretta, verifica solo che il player appartenga a `vServeTeam`, indipendente dalla posizione.

### 📁 File modificati
- `js/modes/volley/config.js` — nuovo `V_NET_HEIGHT_MULT` (1.15), `V_POST_H` moltiplicato
- `server.js` — stesso `V_NET_HEIGHT_MULT`/`V_POST_H` (parità fisica); `vApplyServeRestrictionSrv()`: rimossa l'eccezione per la squadra che batte
- `js/modes/volley/physics.js` — `vApplyServeRestriction()`: rimossa l'eccezione per la squadra che batte; commenti aggiornati
- `js/modes/volley/draw.js` — `_vDrawServeRestriction()`: disegna la linea di restrizione per entrambe le squadre invece che per una sola

---

## v2.39.0 — Rimbalzo player configurabile + audit bug su tutto il progetto

Su richiesta ("miglioralo, rendi migliore il movement e dopo cerca dei bug nel codice riguardo a tutto"). Riletti TUTTI i file rimasti non ancora letti nella sessione precedente: `input.js`, `helpers.js`, `particles.js`, `views.js`, `roster.js`, `admin.js`, `chat.js`, `lobby.js`, `network-core.js`, `auth.js`, entrambi i `draw.js`, `index.html` — oltre a rileggere `server.js` e i `game.js` già noti con occhio specifico da bug-hunt.

### 🏃 Movimento — rimbalzo player contro muri/rete ora configurabile
- Il coefficiente di rimbalzo quando un player tocca il bordo del campo (o, in pallavolo, la rete centrale) era un numero fisso `-.4` scritto letteralmente in 6 punti diversi (calcio client+server, pallavolo client+server × muro e rete). Non era mai stato esposto come variabile, a differenza di quasi tutti gli altri coefficienti fisici del progetto.
- Aggiunte **`P_WALL_BOUNCE`** (calcio) e **`V_P_WALL_BOUNCE`** (pallavolo), default `0.4` (comportamento invariato di default), regolabili in tempo reale dal pannello Variabili come tutte le altre. Sostituiti tutti e 6 i punti hardcoded nei 4 path fisici (server autoritativo ×2, client training/prediction ×2).

### 🐛 Bug più importante — "Pausa dopo gol" inefficace in TUTTE le partite calcio multiplayer
- **`resetPositions()`** in `server.js` (chiamata sia dopo ogni gol sia all'avvio partita) impostava incondizionatamente `room.goalCD=90`, un valore hardcoded **diverso anche dal default stesso di `GOAL_CD` (140)**. Il problema: `handleGoal()` imposta correttamente `room.goalCD=room.config.GOAL_CD` (il valore configurato dall'host) **un'istruzione prima** di chiamare `resetPositions(room,false)` — che subito dopo lo sovrascriveva col valore fisso. Risultato: lo slider host "Pausa dopo gol" nel calcio non ha **mai** avuto alcun effetto reale in una partita multiplayer, qualunque valore venisse impostato. La pallavolo non aveva questo bug: `vResetPositions()` legge già correttamente `vcfg.V_GOAL_CD` — proprio il confronto con l'equivalente pallavolo (corretto) ha reso evidente che quello del calcio era un bug e non una scelta voluta. **Fix**: `resetPositions()` ora legge `room.config.GOAL_CD` come la sua controparte pallavolo.
- **Stessa classe di bug, impatto minore (solo allenamento/training, corretto anche lì per coerenza)**: in allenamento (calcio e pallavolo), diverse funzioni di reset leggevano le costanti fisse `MATCH_TIME`/`GOAL_CD`/`V_MATCH_TIME`/`V_GOAL_CD` invece dei valori live `CONFIG.MATCH_TIME`/`CONFIG.GOAL_CD`/`V_CONFIG.V_MATCH_TIME`/`V_CONFIG.V_GOAL_CD` — quindi cambiare "Durata partita" o "Pausa dopo gol/punto" dal pannello Variabili in allenamento (dove non c'è un server a correggere il valore) non aveva alcun effetto reale sul timer o sulla pausa dopo gol. Corretto in `resetLocal()`/`reset()`/`update()` (calcio) e `vReset()`/`vGoal()`/`vHandleGameOverLocal()` (pallavolo), più i due pulsanti "Riavvia" duplicati in `lobby.js` e `menu.js` che facevano lo stesso reset inline per la pallavolo.
- **Stessa classe di bug, impatto trascurabile (multiplayer, guest)**: l'handler `'goal'` in `network-core.js` impostava un valore ottimistico locale (`goalCD=140` calcio, `V_GOAL_CD` bare pallavolo) invece di leggere `CONFIG`/`V_CONFIG` — corretto per coerenza anche se la differenza durava al massimo un broadcast di stato (~33ms), già corretta automaticamente subito dopo.

### 🐛 Indicatore di carica tiro desincronizzato (solo calcio)
- `drawShotArrow()` e `drawPlayer()` in `js/modes/soccer/draw.js` calcolavano la percentuale di carica del tiro (`p.charge/KICK_CHG_F`) leggendo la costante fissa `KICK_CHG_F` (=50) invece di `CONFIG.KICK_CHG_F` (il valore live, configurabile dall'host come "Frame carica tiro"). Se l'host personalizzava questo valore, l'indicatore visivo (anello attorno al player, freccia di tiro) mostrava "carica al 100%" nel momento sbagliato, mentre la fisica reale (già corretta, legge `CONFIG.KICK_CHG_F`) continuava a caricare. Bug solo visivo, nessun impatto sulla fisica reale. Corretto anche un terzo punto identico nell'indicatore touch (`update()` in `game.js`, chiamata a `drawKickArc`). La pallavolo non aveva questo bug (già corretta).

### 🧹 Robustezza minore
- **`team_change`** (server, spostamento host di un player fra squadre/spettatori a partita in corso): resettava posizione e velocità ma non `charge`/`held`/`kickCooldown` — in un caso limite (player spostato mentre stava caricando un tiro) poteva lasciare uno stato di carica "congelato" che riprendeva da dove si era interrotto una volta rientrato in campo. Ora azzerati insieme al resto, come già avviene dopo ogni gol.
- **`pm_update`** (client, aggiunta di un giocatore pallavolo apparso a partita già iniziata): l'oggetto player creato non inizializzava `charge`/`kickCooldown` (il ramo calcio equivalente lo fa già). Impatto pratico nullo (sovrascritto dal prossimo `state` entro un frame), corretto per coerenza.
- **Codice morto rimosso**: il `Set` `kickedThisTick` in `vTick()` (server) veniva creato e popolato ad ogni tick ma non era mai letto da nessuna parte — rimosso.

### ✅ Verificato, nessun problema trovato
- `input.js`, `helpers.js`, `particles.js`, `views.js`, `roster.js`, `admin.js`, `chat.js`, `auth.js`: nessun bug identificato in questa lettura.
- Ordine di caricamento script in `index.html`: coerente, nessuna dipendenza violata.
- Regola doppio tocco, restrizione battuta, sistema pausa/stop: rivisti, già corretti dalle sessioni precedenti.

### 📁 File modificati
- `server.js` — `CONFIG_DEFAULT.P_WALL_BOUNCE`/`V_CONFIG_DEFAULT.V_P_WALL_BOUNCE` (nuovi, default 0.4); `applyInput()`/`vApplyInputSrv()` usano il rimbalzo configurabile; **`resetPositions()`: fix `goalCD` hardcoded → `room.config.GOAL_CD`**; `team_change`: reset `charge`/`held`/`kickCooldown`; rimosso `kickedThisTick` (dead code)
- `js/state.js` — `CONFIG.P_WALL_BOUNCE` + voce `CONFIG_META`
- `js/modes/volley/config.js` — const `V_P_WALL_BOUNCE`, `V_CONFIG.V_P_WALL_BOUNCE`, voce `V_CONFIG_META`
- `js/modes/soccer/config.js` — const `P_WALL_BOUNCE` (documentazione)
- `js/modes/soccer/physics.js` — `applyInput()`: rimbalzo configurabile
- `js/modes/volley/physics.js` — `vApplyInput()`: rimbalzo configurabile (muro + rete)
- `js/modes/soccer/draw.js` — `drawShotArrow()`/`drawPlayer()`: fix `KICK_CHG_F` → `CONFIG.KICK_CHG_F`
- `js/modes/soccer/game.js` — fix `GOAL_CD`/`MATCH_TIME`/`KICK_CHG_F` hardcoded in `update()`, `resetLocal()`, `reset()`
- `js/modes/volley/game.js` — fix `V_GOAL_CD`/`V_MATCH_TIME` hardcoded in `vGoal()`, `vHandleGameOverLocal()`, `vReset()`
- `js/lobby.js` — fix `V_MATCH_TIME` hardcoded nel pulsante Riavvia (allenamento pallavolo)
- `js/menu.js` — fix `V_MATCH_TIME` hardcoded nel pulsante Riavvia del menu di pausa (allenamento pallavolo)
- `js/network-core.js` — fix `goalCD`/`V_GOAL_CD` hardcoded nell'handler `'goal'`; `pm_update`: inizializza `charge`/`kickCooldown` per player pallavolo aggiunti dinamicamente

---

## v2.38.0 — Fix accelerazione/decelerazione player (calcio + pallavolo)

Analisi completa su richiesta ("migliora il movimento di tutti, giocatori e palla, in tutte le modalità — assicurati che accelerazione e decelerazione esistano e funzionino, rendendole realistiche e configurabili"). Riletti tutti i file del progetto: `js/config.js`, `js/state.js`, `js/modes/{soccer,volley}/config.js`, `js/modes/{soccer,volley}/physics.js`, `js/modes/{soccer,volley}/sync.js`, `js/modes/{soccer,volley}/game.js`, `server.js`, `js/menu.js`, `js/input.js`.

### 🐛 Il bug — l'accelerazione dei player era di fatto inerte
- **Sintomo**: `P_ACCEL`/`V_P_ACCEL` esistevano già come variabili configurabili (pannello Variabili, host-only), ma non avevano alcun effetto pratico: tenendo premuta una direzione, la velocità del player restava sempre bloccata attorno al solo kick-start (`P_START`≈1.4), senza mai avvicinarsi al tetto massimo `P_SPEED_MAX`=10 — indipendentemente da quanto a lungo si teneva premuto il tasto.
- **Causa**: l'attrito (`P_FRIC`=0.78) veniva applicato **incondizionatamente ad ogni frame**, anche sull'asse in cui si stava attivamente accelerando. Ad ogni frame la sequenza era: (1) se sotto `P_START` → snap istantaneo a `P_START` ("kick-start"), (2) `+= P_ACCEL` (+0.01, minuscolo), (3) attrito `×0.78` applicato comunque. Il risultato del passo 3 scendeva quasi sempre di nuovo sotto `P_START`, quindi al frame successivo scattava di nuovo lo snap del passo 1: la velocità oscillava per sempre fra ~1.41 e ~1.10, mai oltre — un ciclo infinito che annullava completamente la rampa di accelerazione. La decelerazione al rilascio invece **funzionava già correttamente** (l'attrito lì non ha nulla contro cui "lottare"): il bug riguardava solo la fase di accelerazione attiva.
- Bug identico e replicato in tutti e 3 i path fisici di entrambe le modalità (bug "storico", presente probabilmente fin dall'introduzione della rampa): `applyInput()`/`vApplyInputSrv()` in `server.js` (autoritativo), `applyInput()` in `js/modes/soccer/physics.js` e `vApplyInput()` in `js/modes/volley/physics.js` (allenamento + prediction locale, richiamate anche da `sync.js`).

### ✅ Il fix — attrito e accelerazione non si contendono più lo stesso asse
- Per ciascun asse (verticale/orizzontale), la logica ora è: **se l'input è premuto** → kick-start istantaneo a `P_START` (invariato, risposta immediata) **poi** rampa vera di `P_ACCEL` per frame fino al tetto corrente (`P_SPEED_MAX`, ridotto proporzionalmente durante la carica del tiro come già prima); **se l'input NON è premuto** → solo in quel caso l'attrito `P_FRIC` decelera gradualmente verso zero. Le due fasi non si sovrappongono più sullo stesso asse: l'accelerazione ora costruisce velocità realmente, e la decelerazione al rilascio (già corretta) resta invariata e diventa finalmente percepibile su un range di velocità reale invece che su un valore quasi costante.
- Il cap sul modulo della velocità (per il movimento diagonale, e la riduzione immediata quando si inizia a caricare un tiro) resta invariato: si applica dopo l'aggiornamento per asse, esattamente come prima.
- **Ricalibrato il default di `P_ACCEL`/`V_P_ACCEL`: da 0.01 (inefficace) a 0.2** — con questo valore e `P_FRIC`=0.78 invariato, un player raggiunge il top speed (`P_SPEED_MAX`=10) in circa 0.7s da fermo, e si ferma da piena velocità in circa 0.3-0.4s al rilascio: una curva di accelerazione/decelerazione percepibile e "realistica" per un gioco sportivo arcade, non istantanea né immobile. Resta **interamente configurabile** dall'host in tempo reale dal pannello Variabili (calcio e pallavolo separatamente), nessun cambiamento ai range degli slider (`P_ACCEL`/`V_P_ACCEL`: min 0, max 1, step 0.005 — il nuovo default ci rientra comodamente).
- **Palla**: nessun bug analogo trovato. La palla non si autopropelle (nessun "input" proprio): ha solo attrito (`B_FRIC`/`V_B_FRIC`, decadimento esponenziale ad ogni frame — già corretto e realistico per un rotolamento/aria), rimbalzi (`B_BOUNCE`/`V_B_BOUNCE`) e gravità (pallavolo). Attrito applicato incondizionatamente ogni frame in tutti e 3 i path (server/client training/dead-reckoning) senza alcuna logica di kick-start a contendersi il valore: funzionava già come previsto, nessuna modifica necessaria.

### 📁 File modificati
- `server.js` — `CONFIG_DEFAULT.P_ACCEL` e `V_CONFIG_DEFAULT.V_P_ACCEL` (0.01→0.2); `applyInput()` (calcio) e `vApplyInputSrv()` (pallavolo): logica movimento per asse riscritta (accelerazione senza attrito concorrente, attrito solo sull'asse senza input)
- `js/modes/soccer/physics.js` — `applyInput()`: stessa riscrittura (allenamento + prediction locale)
- `js/modes/volley/physics.js` — `vApplyInput()`: stessa riscrittura (allenamento + prediction locale)
- `js/state.js` — `CONFIG.P_ACCEL` default (0.01→0.2)
- `js/modes/soccer/config.js` — const `P_ACCEL` (0.01→0.2) + commento esplicativo aggiornato
- `js/modes/volley/config.js` — const `V_P_ACCEL` e `V_CONFIG.V_P_ACCEL` default (0.01→0.2) + commento

---

## v2.37.0 — Indicatore palla fuori schermo (pallavolo)

Riletto `js/modes/volley/draw.js` prima della modifica.

### 🏐 Piccolo indicatore quando la palla vola oltre il bordo superiore
- Da quando (v2.36.0) la palla non ha piu' collisione col soffitto, poteva sparire completamente dallo schermo durante le battute/schiacciate piu' alte, senza modo di sapere da che parte sarebbe ricaduta.
- Aggiunto un piccolo indicatore triangolare pulsante sul bordo superiore del campo, posizionato alla stessa coordinata X della palla (agganciato ai bordi del campo se la X e' vicina ai muri laterali), visibile solo quando la palla e' effettivamente sopra il bordo visibile. Sotto al triangolo un numero (`↑123`) indica di quanto la palla e' sopra il bordo, come riferimento di quanto manca prima che ricada in vista.
- Puramente visivo lato client: nessuna modifica alla fisica o allo stato di gioco.

### 📁 File modificati
- `js/modes/volley/draw.js` — nuova funzione `_vDrawOffscreenBallIndicator()`, chiamata da `vDraw()` subito dopo `vDrawBall()`

---

## v2.36.0 — Pallavolo: il soffitto blocca solo i player, non la palla

Riletti `server.js`, `js/modes/volley/physics.js` e `js/modes/volley/sync.js` prima della modifica.

### 🏐 La palla ora puo' volare altissima, fuori schermo
- **Prima**: la palla rimbalzava contro il bordo superiore del campo (`V_FL.t`) esattamente come contro i muri laterali, quindi non poteva mai salire oltre una certa altezza visibile.
- **Ora**: rimossa la collisione palla↔soffitto in tutti i punti dove la fisica della palla viene simulata (server autoritativo, allenamento, prediction/dead-reckoning multiplayer). La palla puo' quindi volare ben oltre il bordo superiore visibile, uscendo di schermo verso l'alto — l'unica direzione in cui puo' andare quasi all'infinito. Non serve un limite artificiale: la gravita' (gia' esistente, con la rampa che aumenta fino a `V_B_GRAV_MAX`) la fa comunque sempre rallentare e ricadere prima o poi, semplicemente il tragitto puo' portarla momentaneamente fuori dall'area visibile.
- **Invariato**: i player continuano a essere bloccati dal soffitto come sempre (`V_FL.t + p.r`, in `vApplyInputSrv`/`vApplyInput`) — solo la palla ne e' esente.

### 📁 File modificati
- `server.js` — `vTickBallSrv()`: rimossa collisione soffitto per la palla
- `js/modes/volley/physics.js` — `vTickBall()` (allenamento): stessa rimozione
- `js/modes/volley/sync.js` — `vTickRemotePhysics()` (dead-reckoning/prediction multiplayer): stessa rimozione, per coerenza fisica fra i tre path

---

## v2.35.0 — Fix direzione battute pallavolo: ora sono un LANCIO verso l'alto (self-toss), non un tiro verso l'avversario

Riletti `server.js` e `js/modes/volley/physics.js` prima della modifica (le battute erano state introdotte nella sessione precedente, v2.34.0).

### 🐛 Fix concettuale — le battute mandavano subito la palla dall'altra parte
- **Il problema**: `/a` `/q` `/z` (introdotte in v2.34.0) applicavano una velocità diretta verso il campo avversario direttamente alla palla ferma sulla rete — di fatto un tiro istantaneo e diretto, senza dare al battitore la possibilità di colpirla lui stesso. Il risultato non era una vera battuta: saltava completamente il "tocco" del giocatore.
- **Come funziona ora**: i tre comandi sono diventati il **lancio** della battuta (l'alzata della palla con le mani prima di colpirla), non il colpo che la manda dall'altra parte. La palla spawna appena sotto al battitore e parte con velocità verso l'alto (mai verso l'avversario): sale, la gravità (già presente in `vTickBallSrv`/`vTickBall`, invariata) la fa rallentare e ricadere a parabola **verso il battitore stesso**, restando sul suo campo. Il colpo vero e proprio che la manda dall'altra parte è il **tocco normale** (AZIONE) che il giocatore darà mentre la palla ricade — riusa integralmente la fisica di tocco già esistente (`vApplyInputSrv`/`vDoKick`), che decide direzione e potenza in base alla posizione relativa giocatore↔palla in quel momento, esattamente come ogni altro tocco in partita. Nessuna logica di direzione speciale nelle funzioni di battuta: solo posizionamento e velocità iniziale del lancio.
- Le 3 varianti ora cambiano **solo il lancio** (quanto in alto sale, quanto ci mette a ricadere), non più una direzione/potenza verso il campo avversario:
  - **`/a`** — lancio potente: sale abbastanza in alto, tempo medio per prepararsi al colpo.
  - **`/q`** — lancio alto: sale molto in alto, più tempo per prepararsi.
  - **`/z`** — lancio rapido: sale poco, ricade quasi subito, meno tempo di reazione.
- Il lancio **non conta come tocco** secondo le regole della pallavolo (coerente con le regole vere: l'auto-lancio della battuta non è un tocco): non incrementa `vTouches`, non aggiorna `vLastToucher*`, non chiude `vServePhase`. Tutta quella contabilità (fine fase battuta, conteggio primo tocco, regola del doppio tocco introdotta in v2.33.0) resta a carico del tocco normale successivo, già gestito da `vTick`/`vUpdate` senza bisogno di modifiche.
- Per evitare che il battitore, se ha già AZIONE premuto, ricolpisca subito la palla appena lanciata (che spawna a distanza ravvicinata): `p.kickCooldown = true` viene impostato al momento del lancio, esattamente come per un tocco normale — si sblocca automaticamente non appena la palla esce dal raggio di tiro (il che avviene quasi subito, data la velocità verso l'alto).

### 📁 File modificati
- `server.js` — `vApplyServeVariant()` riscritta: posiziona la palla sotto al battitore e la lancia in verticale invece di applicarle direttamente una velocità verso l'avversario; rimossa la chiusura di `vServePhase`/conteggio tocchi (ora a carico del tocco normale)
- `js/modes/volley/physics.js` — `vApplyServeVariantLocal()` stessa riscrittura per l'allenamento
- `js/chat.js` — descrizioni comandi `/a`/`/q`/`/z` aggiornate al nuovo significato (lancio, non direzione)

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

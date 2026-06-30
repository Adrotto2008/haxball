# 📋 Aggiornamenti — HaxBall 2

Versione più recente sempre in cima. Ad ogni modifica aggiornare `VERSION` in `js/config.js`.

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

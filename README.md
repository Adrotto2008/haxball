# ⚽ HaxBall 2

Un gioco 2D multiplayer di sport (calcio e pallavolo) ispirato a [HaxBall](https://www.haxball.com/), giocabile direttamente nel browser. Realizzato con **HTML5 Canvas** e **JavaScript** puro; il multiplayer è sincronizzato da un **server Node.js/WebSocket autoritativo** (`server.js`, deployato su Render), mentre **Supabase** gestisce login opzionale e salvataggio preset.

## 🎮 Come si gioca

Apri `index.html` in un browser (desktop o mobile) e scegli una delle modalità disponibili dalla schermata iniziale:

- **🎯 Allenamento (solo)** — modalità in locale per esercitarsi senza altri giocatori.
- **🔴 Crea stanza** — genera un codice a 6 caratteri da condividere con altri giocatori per giocare online.
- **🔵 Entra con codice** — entra in una stanza esistente inserendo il codice ricevuto.

In allenamento e nella creazione stanza puoi scegliere lo sport: **⚽ Calcio** o **🏐 Pallavolo**.

### Controlli
- **WASD** / **freccette** — movimento del giocatore
- **0 / Ctrl / Spazio** (tenuto premuto) — carica e calcia/schiaccia la palla, con indicatore visivo di forza e direzione
- **Tasti numerici 1-9 / 0** — cambia livello di zoom della telecamera
- **ESC** — apre il menu di gioco
- **T** — apre/chiude la chat
- **Q** — attiva/disattiva la prediction locale · **E** — (pallavolo) alterna controlli Base/Avanzata
- Su dispositivi touch sono disponibili un **joystick virtuale** e un **tasto TIRO** dedicato

Tutti i tasti sono personalizzabili dal menu di gioco → Impostazioni.

## ✨ Funzionalità principali

- **Due sport**: ⚽ Calcio e 🏐 Pallavolo, ciascuno con fisica, campo e regole dedicate (tocchi/rete per la pallavolo)
- **Multiplayer online** in tempo reale, sincronizzato da un server Node.js/WebSocket autoritativo, con prediction locale e interpolazione lato client
- **Login opzionale via Supabase**, con nickname e avatar legati all'account invece che al browser
- **Preset di configurazione** salvabili su Supabase e riapplicabili in un click alla creazione di una stanza
- **Pannello "Variabili"** che espone la fisica (raggi, attrito, rimbalzo, forza di tiro…) come slider live, per sport e per stanza
- **Sala d'attesa (pre-match)** con roster diviso in Rossi / Spettatori / Blu
- **Sistema admin**: l'host può spostare i giocatori tra le squadre, trasferire il ruolo di admin o rimuovere (kick) un giocatore
- **Chat in-game** con notifiche toast e cronologia messaggi
- **Motore fisico** con collisioni, attrito, rimbalzi sui bordi e sistema di tiro "a carica"
- **Effetti particellari** su tiri ed esultanze gol/punto
- **HUD compatto** con punteggio, timer, ping e indicatore della modalità di rete (Allenamento / Host / Guest)
- **Zoom di gioco regolabile** su 10 livelli, per adattare la visuale a schermi diversi
- **Controlli touch** completi per smartphone e tablet, con joystick virtuale e tasto di tiro
- **Nickname personalizzabile**, salvato in locale (o legato all'account se loggato)

## 📁 Struttura del progetto

L'architettura separa il **core** (riusabile da qualunque modalità: rete, chat,
menu, lobby, input, viste, particelle) dalla **modalità di gioco**, che vive sotto
`js/modes/`. La maggior parte della logica di una modalità (fisica, disegno,
stato partita, sincronizzazione) vive interamente in `js/modes/<nome>/`; alcuni
file core (`network-core.js`, `menu.js`) contengono comunque diramazioni
`if (currentGameMode === 'volley')` per instradare roster/stato/gol verso la
modalità giusta — aggiungere un terzo sport richiederebbe quindi anche piccoli
tocchi lì, non solo una nuova cartella.

```
index.html              Pagina principale, markup di lobby, gioco, menu e chat
server.js               Server Node.js/WebSocket autoritativo (fisica multiplayer, stanze, admin)
package.json            Dipendenze del server (ws) e script di avvio

css/
├─ base.css              Stili condivisi (bottoni, layout base, animazioni)
├─ lobby.css             Schermata iniziale (lobby, login/registrazione)
├─ hud.css               HUD: campo, punteggio, timer, badge rete, msg-bar
├─ chat.css              Overlay chat, log, input, toast
├─ menu.css              Menu unificato pre-match/in-game, roster, pannello Variabili, menu contestuale admin
└─ touch.css             Controlli touch (joystick, tasto tiro)

js/                      ── CORE (mode-agnostico) ──
├─ config.js             Costanti davvero globali (W/H, DPR, versione, livelli zoom)
├─ helpers.js            Utility generiche ($, setMsg, lerp, uid, isTouchDev, escHtml)
├─ state.js              Variabili condivise (rete, roster, chat, UI, impostazioni) + init canvas
├─ input.js              Gestione input tastiera e touch
├─ particles.js          Sistema di effetti particellari
├─ views.js              Gestione dei livelli di zoom/vista
├─ network-core.js       Client WebSocket + router dei messaggi del server
├─ chat.js               Chat: logica invio/ricezione + UI + comandi
├─ admin.js              Azioni host (kick/transfer/team), menu contestuale, AFK, skin
├─ menu.js               Apri/chiudi menu, tab, esc menu, pannello Variabili, avvio/ritorno partita
├─ roster.js             Render roster e assegnazione squadre
├─ lobby.js              Lobby iniziale: creazione/ingresso stanza, bottoni, init
├─ auth.js               Login/registrazione via Supabase, profilo (nickname/avatar), preset
│
├─ modes/soccer/         ── MODALITÀ: CALCIO ──
│  ├─ config.js          Costanti del calcio (raggi, fisica, porte, squadre, durata)
│  ├─ physics.js         Movimento, collisioni e calcio della palla
│  ├─ draw.js            Rendering del campo, palla, giocatori e freccia di tiro
│  ├─ sync.js            Applica lo state autoritativo del server + dead reckoning
│  └─ game.js            Stato partita, ciclo di gioco, gol, fine, reset, start
│
└─ modes/volley/         ── MODALITÀ: PALLAVOLO ──
   ├─ config.js          Costanti della pallavolo (raggi, fisica, rete/muretto, tocchi, durata)
   ├─ physics.js         Movimento, tiro/schiacciata, rimbalzi, collisione col muretto centrale
   ├─ draw.js            Rendering del campo, rete, muretto, palla, giocatori, indicatori tocchi
   ├─ sync.js            Applica lo state autoritativo del server + dead reckoning
   └─ game.js            Stato partita, fase battuta, ciclo di gioco, punto, fine, reset, start
```

## 🛠️ Tecnologie utilizzate

- HTML5 Canvas per il rendering del gioco
- JavaScript vanilla (nessun framework)
- Server WebSocket autoritativo (Node.js, `server.js`) per la sincronizzazione multiplayer, deployato su Render
- Supabase per login opzionale (Auth) e salvataggio preset di configurazione (Database + RLS)
- Font [Inter](https://fonts.google.com/specimen/Inter) da Google Fonts

## ⚙️ Setup / deploy

- **Server**: `node server.js` (porta di default 3000, sovrascrivibile con la env var `PORT`). In produzione imposta **`ADMIN_TOKEN`**: se assente, il server ne genera una casuale ad ogni riavvio e la stampa nei log (valida solo per quel processo, non persistente).
- **Supabase** (opzionale, solo per login/preset): richiede una tabella `profiles` (id, nickname, avatar, settings) e una tabella `presets`, entrambe con **Row Level Security** attiva e policy che limitino ogni utente alle proprie righe.
- **Client**: `WS_URL` in `js/network-core.js` punta automaticamente a `ws://localhost:3000` quando l'host è `localhost`/`127.0.0.1`, altrimenti all'URL di produzione su Render — non serve modificarlo per testare in locale.

## 📝 Changelog

Per la cronologia delle versioni e delle modifiche apportate al progetto, consulta [`aggiornamenti.md`](./aggiornamenti.md).

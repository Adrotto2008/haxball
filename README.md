# ⚽ HaxBall 2

Un gioco di calcio 2D multiplayer ispirato a [HaxBall](https://www.haxball.com/), giocabile direttamente nel browser. Realizzato con **HTML5 Canvas** e **JavaScript** puro, con supporto al multiplayer online tramite **Supabase Realtime** (canali broadcast, senza bisogno di un server di gioco dedicato).

## 🎮 Come si gioca

Apri `index.html` in un browser (desktop o mobile) e scegli una delle modalità disponibili dalla schermata iniziale:

- **🎯 Allenamento (solo)** — modalità in locale per esercitarsi senza altri giocatori.
- **🔴 Crea stanza** — genera un codice a 6 caratteri da condividere con altri giocatori per giocare online.
- **🔵 Entra con codice** — entra in una stanza esistente inserendo il codice ricevuto.

### Controlli
- **WASD** / **freccette** — movimento del giocatore
- **0 / Ctrl / Spazio** (tenuto premuto) — carica e calcia la palla, con freccia direzionale che mostra forza e direzione del tiro
- **Tasti numerici 1-9 / 0** — cambia livello di zoom della telecamera
- **ESC** — apre il menu di gioco
- **T** — apre/chiude la chat
- Su dispositivi touch sono disponibili un **joystick virtuale** e un **tasto TIRO** dedicato

## ✨ Funzionalità principali

- **Multiplayer online** in tempo reale tramite Supabase, senza backend dedicato
- **Sala d'attesa (pre-match)** con roster diviso in Rossi / Spettatori / Blu
- **Sistema admin**: l'host può spostare i giocatori tra le squadre, trasferire il ruolo di admin o rimuovere (kick) un giocatore
- **Chat in-game** con notifiche toast e cronologia messaggi
- **Motore fisico** con collisioni, attrito, rimbalzi sui bordi e sistema di tiro "a carica"
- **Effetti particellari** su tiri ed esultanze gol
- **HUD compatto** con punteggio, timer, ping e indicatore della modalità di rete (Allenamento / Host / Guest)
- **Zoom di gioco regolabile** su 10 livelli, per adattare la visuale a schermi diversi
- **Controlli touch** completi per smartphone e tablet, con joystick virtuale e tasto di tiro
- **Nickname personalizzabile**, salvato automaticamente in locale

## 📁 Struttura del progetto

L'architettura separa il **core** (riusabile da qualunque modalità: rete, chat,
menu, lobby, input, viste, particelle) dalla **modalità di gioco**, che vive sotto
`js/modes/`. Aggiungere una nuova modalità (basket, hockey, …) significa creare
`js/modes/<nome>/` sul modello di `soccer/`, senza toccare i file core.

```
index.html              Pagina principale, markup di lobby, gioco, menu e chat

css/
├─ base.css              Stili condivisi (bottoni, layout base, animazioni)
├─ lobby.css             Schermata iniziale (lobby)
├─ hud.css               HUD: campo, punteggio, timer, badge rete, msg-bar
├─ chat.css              Overlay chat, log, input, toast
├─ menu.css              Menu unificato pre-match/in-game, roster, menu contestuale admin
└─ touch.css             Controlli touch (joystick, tasto tiro)

js/                      ── CORE (mode-agnostico) ──
├─ config.js             Costanti davvero globali (W/H, DPR, versione, livelli zoom)
├─ helpers.js            Utility generiche ($, setMsg, lerp, uid, isTouchDev, escHtml)
├─ state.js              Variabili condivise (rete, roster, chat, UI) + init canvas
├─ input.js              Gestione input tastiera e touch
├─ particles.js          Sistema di effetti particellari
├─ views.js              Gestione dei livelli di zoom/vista
├─ network-core.js       Client WebSocket + router dei messaggi del server
├─ chat.js               Chat: logica invio/ricezione + UI + comandi
├─ admin.js              Azioni host (kick/transfer/team), menu contestuale, AFK, skin
├─ menu.js               Apri/chiudi menu, tab, esc menu, avvio/ritorno partita
├─ roster.js             Render roster e assegnazione squadre
├─ lobby.js              Lobby iniziale: creazione/ingresso stanza, bottoni, init
│
└─ modes/soccer/         ── MODALITÀ: CALCIO ──
   ├─ config.js          Costanti del calcio (raggi, fisica, porte, squadre, durata)
   ├─ physics.js         Movimento, collisioni e calcio della palla
   ├─ draw.js            Rendering del campo, palla, giocatori e freccia di tiro
   ├─ sync.js            Applica lo state autoritativo del server + dead reckoning
   └─ game.js            Stato partita, ciclo di gioco, gol, fine, reset, start
```

## 🛠️ Tecnologie utilizzate

- HTML5 Canvas per il rendering del gioco
- JavaScript vanilla (nessun framework)
- Server WebSocket autoritativo (Node.js, `server.js`) per la sincronizzazione multiplayer
- Font [Inter](https://fonts.google.com/specimen/Inter) da Google Fonts

## 📝 Changelog

Per la cronologia delle versioni e delle modifiche apportate al progetto, consulta [`aggiornamenti.md`](./aggiornamenti.md).

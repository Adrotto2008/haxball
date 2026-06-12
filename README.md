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

```
index.html              Pagina principale, markup di lobby, gioco, menu e chat

css/
├─ base.css              Stili condivisi (bottoni, layout base)
├─ lobby.css             Schermata iniziale (lobby)
├─ game.css              HUD, campo di gioco, chat, menu contestuale
├─ game-menu.css         Menu unificato pre-match / in-game
├─ esc-menu.css          Stili del menu ESC (vista campo)
├─ prematch.css          Sala d'attesa pre-partita
└─ touch.css             Controlli touch (joystick, tasto tiro)

js/
├─ config.js             Costanti globali (dimensioni campo, fisica, versione, livelli zoom)
├─ state.js              Variabili di stato globali e helper condivisi
├─ input.js              Gestione input tastiera e touch
├─ physics.js            Movimento, collisioni e calcio della palla
├─ particles.js          Sistema di effetti particellari
├─ draw.js               Rendering del campo, palla, giocatori e freccia di tiro
├─ views.js              Gestione dei livelli di zoom/vista
├─ network.js            Comunicazione Supabase, chat e azioni admin
├─ prematch.js           Menu pre-match/in-game, roster, chat UI
├─ game.js               Ciclo di gioco, gol, fine partita, reset
└─ lobby.js              Lobby iniziale: creazione/ingresso stanza, bottoni, init
```

## 🛠️ Tecnologie utilizzate

- HTML5 Canvas per il rendering del gioco
- JavaScript vanilla (nessun framework)
- [Supabase](https://supabase.com/) Realtime per la sincronizzazione multiplayer
- Font [Inter](https://fonts.google.com/specimen/Inter) da Google Fonts

## 📝 Changelog

Per la cronologia delle versioni e delle modifiche apportate al progetto, consulta [`aggiornamenti.md`](./aggiornamenti.md).

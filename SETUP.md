# Process Editor — Setup

Editor di processi (BPMN, CMMN e workflow classici) con esportazione in PDF, PNG, SVG e XML standard. Web app React + TypeScript, pensata per essere impacchettata anche come app desktop con Tauri.

## Prerequisiti

| Requisito | Versione | Note |
|---|---|---|
| [Node.js](https://nodejs.org) | ≥ 20 (testato con 24.x) | Include npm |
| Browser | Chrome / Edge consigliati | Supportano la File System Access API per Save/Save As nativi; altri browser usano il fallback a download |
| [Rust](https://rustup.rs) | stable | **Solo** per la build desktop con Tauri (non ancora configurata, vedi sotto) |

## Installazione

```powershell
cd C:\Users\EmanueleGavi\Desktop\Crea\editor-claude
npm install
```

## Sviluppo

```powershell
npm run dev
```

Apre il dev server Vite su **http://localhost:1420** con hot reload.

## Build di produzione

```powershell
npm run build     # type-check (tsc) + build in dist/
npm run preview   # serve la build di produzione in locale
```

Il contenuto di `dist/` è una web app statica: puoi pubblicarla su qualunque hosting statico (Netlify, GitHub Pages, IIS, ecc.).

## Struttura del progetto

```
editor-claude/
├── index.html                  # Entry point HTML
├── vite.config.ts              # Config Vite (porta 1420, fissa per compatibilità Tauri)
├── src/
│   ├── main.tsx                # Bootstrap React (senza StrictMode — vedi note)
│   ├── App.tsx                 # Shell: toolbar, menu New, switch editor, file/export
│   ├── components/
│   │   ├── BpmnEditor.tsx      # Wrapper bpmn-js + properties panel Camunda 7
│   │   ├── CmmnEditor.tsx      # Wrapper React del modeler cmmn-js (API a callback)
│   │   └── FlowEditor.tsx      # Editor flowchart/workflow basato su React Flow
│   ├── lib/
│   │   ├── editorHandle.ts     # Interfaccia comune esposta da ogni editor alla shell
│   │   ├── docTypes.ts         # Registry dei tipi documento + rilevamento all'apertura
│   │   ├── templates.ts        # Template per nuovi documenti (BPMN, CMMN, flow JSON)
│   │   ├── flow.ts             # Modello dati flowchart/workflow + renderer SVG
│   │   ├── validation.ts       # Regole di validazione per BPMN e flow/workflow
│   │   ├── files.ts            # Open/Save/Save As (File System Access API + fallback)
│   │   └── export.ts           # Export SVG, PNG (raster 2×), PDF (vettoriale)
│   ├── types/                  # Shim TypeScript (cmmn-js, bpmn-js-properties-panel)
│   └── styles/app.css          # Stili dell'app
└── SETUP.md                    # Questo file
```

## Funzionalità attuali (M1 + M2 + M3)

- **Quattro tipi di documento** dal menu New: BPMN Process, CMMN Case, Flowchart, Workflow.
- **Editor BPMN 2.0** completo basato su [bpmn-js](https://bpmn.io): palette, drag & drop, menu contestuale, undo/redo, zoom/fit.
- **Editor CMMN 1.1** basato su cmmn-js.
- **Editor Flowchart/Workflow** basato su React Flow: palette di nodi (Start/Process o State/Decision/End/Note), collegamenti con frecce, rinomina con doppio click, eliminazione con Canc. Nel Workflow i nodi State hanno il campo **Assignee**. Formato file JSON proprio (`.flow.json` / `.workflow.json`).
- **Blocchi Note**: post-it di testo libero multiriga (textarea nel pannello proprietà), esclusi dalle regole di connettività della validazione e resi con stile sticky-note anche negli export.
- **Attore del blocco ("Performed by")**: i blocchi Process/State possono essere marcati come eseguiti da **persona, automazione o agente AI**; l'icona appare sul nodo e nei file esportati (glifi vettoriali, compatibili col PDF). Selettore nel pannello proprietà.
- **Modalità Simple/Advanced** (persistita): Simple riduce la palette BPMN agli elementi essenziali e nasconde il properties panel Camunda; il pannello proprietà del flow editor appare sempre alla selezione di un nodo o transizione.
- New / Open / Save / Save As con rilevamento automatico del tipo all'apertura (`.bpmn`, `.cmmn`, `.xml`, `.json`).
- Export **PDF**, **PNG** (2×, sfondo bianco) e **SVG** per tutti i tipi di documento.
- Indicatore di modifiche non salvate con conferma prima di scartare.
- **UI moderna**: toolbar con icone (lucide-react), menu a tendina animati con descrizioni, controllo segmentato Simple/Advanced, notifiche toast, rinomina file inline (click sul nome), scorciatoie **Ctrl+S** (salva), **Ctrl+Shift+S** (salva con nome), **Ctrl+O** (apri). Nel flow editor: palette trascinabile (click o drag & drop sul canvas) e minimappa.
- **Validazione a regole in tempo reale** (debounce 600 ms) per BPMN e Flowchart/Workflow: riepilogo nella statusbar (✔ / errori / warning), lista espandibile, click su un problema per selezionare l'elemento nel canvas. Regole BPMN: start/end mancanti, elementi non connessi, task senza nome, gateway con rami senza condizione o senza default. Regole flow: nodi irraggiungibili, decision con meno di due rami o rami senza etichetta, stati senza assignee (workflow), nodi senza nome. Per CMMN la validazione non è ancora disponibile.
- **Pannello proprietà Camunda 7** per il BPMN (solo modalità Advanced): properties panel ufficiale bpmn.io con estensioni `camunda:` — General, Forms, Listeners, External task, Job execution, Extension properties, ecc. I diagrammi salvati sono pronti per il deploy su Camunda Platform 7.
- **Selettore Target Engine** (BPMN, toolbar): il diagramma può essere indirizzato a diversi workflow engine, ognuno con il proprio namespace XML sull'export:
  - **Generic BPMN** — nessuna estensione vendor.
  - **Camunda 7** — pannello proprietà ufficiale bpmn.io completo (`camunda:` namespace).
  - **Camunda 8 (Zeebe)** — pannello proprietà ufficiale Zeebe (`zeebe:` namespace), via `zeebe-bpmn-moddle`.
  - **Operaton** — gruppo "Execution" custom (async, exclusive, class/expression/delegate expression, assignee/candidate users/groups) sotto namespace `operaton:` (Operaton è un fork di Camunda 7 e condivide lo stesso vocabolario di estensione).
  - **Flowable** — stesso gruppo "Execution" custom sotto namespace `flowable:`.
  Il cambio engine preserva il contenuto corrente del diagramma (viene ricaricato l'editor con l'XML aggiornato). Un badge in basso a sinistra nel canvas BPMN indica l'engine attivo.

Limitazioni note: undo/redo non disponibile (pulsanti disabilitati) negli editor Flowchart/Workflow; validazione non disponibile per CMMN; per Operaton/Flowable il pannello "Execution" copre solo il sottoinsieme comune di proprietà (non l'intero set specifico di ciascun engine, per cui non esiste un package bpmn-js ufficiale).

## Roadmap

- ~~**M2** — Modalità Simple/Advanced, editor flowchart e workflow custom (React Flow), supporto CMMN.~~ ✅
- ~~**M3** — Validazione a regole + pannello proprietà Camunda 7.~~ ✅
- **M4** — Modulo AI opzionale (testo→diagramma, assistente di revisione, documentazione automatica) con API key fornita dall'utente.

## App desktop (Tauri) — da configurare

La build desktop non è ancora configurata. Quando serve:

1. Installa Rust: scarica ed esegui [rustup-init.exe](https://rustup.rs) (richiede anche le Microsoft C++ Build Tools, proposte dall'installer).
2. Verifica: `cargo --version`
3. Aggiungi Tauri al progetto:
   ```powershell
   npm install -D @tauri-apps/cli
   npx tauri init   # frontend dist: ../dist, dev server: http://localhost:1420
   ```
4. Sviluppo desktop: `npx tauri dev` — Pacchetto installabile: `npx tauri build`

## Note tecniche

- **Niente React StrictMode**: il doppio mount in dev di StrictMode distrugge il modeler bpmn-js mentre l'import XML è in corso (errore `root-0`, pagina bianca). Non reintrodurlo in `src/main.tsx`.
- **Porta 1420**: scelta perché è quella attesa da Tauri in dev mode; `strictPort: false` permette comunque a Vite di ripiegare su un'altra porta se occupata.
- **Save vs Save As**: su Chrome/Edge "Save" riscrive il file aperto tramite il suo handle; su browser senza File System Access API ogni salvataggio scarica un nuovo file.

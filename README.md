# Motion, written in code

Live: **https://swarajpatil-tech.github.io/motion/**

Animated pieces built frame by frame in the browser, no editor or plugin. Each one is a static page you can scrub, so a client can review timing before anything renders.

## Pieces

**`unicus-estate/`** — a 30-second vertical reel (1080×1920) for Unicus Estate, seven scenes:

1. Draw-on mark
2. The project's dead Instagram link failing
3. Photo reveal
4. The numbers
5. Masterplan, one plot tapped, card sliding up
6. The WhatsApp enquiry writing itself
7. End card

**`downloads/`** — packaged source for related sites, e.g. `unicus-estate-code.zip`.

## How the reel works

| File | Role |
|---|---|
| `ui.js` | Timeline, scene chips, frame stepping, the Voiceover panel, the recorder. |
| `reel.js` | The renderer: one function per scene, drawn against a single time value. |

Every scene is a pure function of `t`, so any frame can be drawn in any order. That's what makes scrubbing, stepping and recording the same code path.

## Voiceover

The reel has seven slots, one per scene, each with its own cue window. Generate each line separately in a TTS tool, drop each file into its row, and the recording mixes them in at their cues. A single long take drifts; seven clips can't.

"Record video" plays the reel once with the audio mixed in and saves the file, so what you hear is what ships.

## Honest limits

- Stills are landscape photographs cropped to vertical, so they're a touch soft at 1080×1920.
- Recording is real-time in the browser tab; it isn't an offscreen render.

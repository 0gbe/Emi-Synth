# Emi-Synth (OGBE-1)

Analog-style performance synthesizer in the browser. Chartreuse Minimoog-inspired chassis, Ogbe faceplate, Web Audio oscillators, ladder-style filter, ADSR, CRT scope, and a two-octave touch keyboard.

## Run it

Needs Node.js 20+.

```bash
npm install
npm run dev
```

Open the local URL Vite prints. Tap **Power on** — you should hear a short ping — then play the keys.

```bash
npm run build
npm run preview
```

## Play

- **Keys / touch:** hold the piano. Glide across keys with one finger.
- **Computer keyboard:** `Z–M` white keys, `S D G H J` blacks. `Q–I` is the next octave. Arrows change range.
- **Knobs:** drag vertically. Double-click resets.
- **Sideways:** tap Sideways (or turn the phone after Power on) for bigger keys.

Safari / iPhone: turn the Ring switch on and turn the volume up. Audio starts on the Power on tap.

## Source map

| File | What it is |
|---|---|
| `src/lib/synth/engine.ts` | Web Audio engine — voices, filter, envelope, iOS unlock |
| `src/lib/synth/notes.ts` | MIDI, Hz, computer-key mapping |
| `src/lib/synth/orientation.ts` | Tilt / sideways layout |
| `src/components/synth/synth-app.tsx` | Chassis layout and wiring |
| `src/components/synth/piano-keyboard.tsx` | Touch + mouse keybed |
| `src/components/synth/analog-knob.tsx` | Vertical-drag knobs |
| `src/components/synth/crt-scope.tsx` | Oscilloscope + peak LEDs |
| `src/components/synth/waveform-select.tsx` | SAW / SQUARE / TRI / SINE |
| `src/components/synth/power-overlay.tsx` | Power-on gate (unlocks audio) |
| `src/styles.css` | Wood, nickel, chartreuse theme |
| `public/ogbe-face.jpg` | Faceplate photo |

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/** Semitone offset from the current octave's C. Ableton / FL-style two-row mapping. */
export const KEY_TO_OFFSET: Record<string, number> = {
  KeyZ: 0,
  KeyS: 1,
  KeyX: 2,
  KeyD: 3,
  KeyC: 4,
  KeyV: 5,
  KeyG: 6,
  KeyB: 7,
  KeyH: 8,
  KeyN: 9,
  KeyJ: 10,
  KeyM: 11,
  Comma: 12,
  KeyL: 13,
  Period: 14,
  Semicolon: 15,
  Slash: 16,
  KeyQ: 12,
  Digit2: 13,
  KeyW: 14,
  Digit3: 15,
  KeyE: 16,
  KeyR: 17,
  Digit5: 18,
  KeyT: 19,
  Digit6: 20,
  KeyY: 21,
  Digit7: 22,
  KeyU: 23,
  KeyI: 24,
  Digit9: 25,
  KeyO: 26,
  Digit0: 27,
  KeyP: 28,
};

export const OCTAVE_DOWN_CODES = new Set(["ArrowDown", "Minus", "NumpadSubtract"]);
export const OCTAVE_UP_CODES = new Set(["ArrowUp", "Equal", "NumpadAdd"]);

export function midiToHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function isBlackKey(midi: number) {
  const n = ((midi % 12) + 12) % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

export function noteName(midi: number) {
  const n = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[n]}${oct}`;
}

export function codeLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const extra: Record<string, string> = {
    Comma: ",",
    Period: ".",
    Semicolon: ";",
    Slash: "/",
  };
  return extra[code] ?? "";
}

export function labelsForMidi(baseMidi: number) {
  const map = new Map<number, string>();
  for (const [code, offset] of Object.entries(KEY_TO_OFFSET)) {
    const midi = baseMidi + offset;
    const label = codeLabel(code);
    if (!label) continue;
    const existing = map.get(midi);
    if (!existing || label.length < existing.length) map.set(midi, label);
  }
  return map;
}

export type PianoKey = {
  midi: number;
  black: boolean;
  name: string;
};

export function buildKeybed(baseMidi: number, semitones: number): PianoKey[] {
  const keys: PianoKey[] = [];
  for (let m = baseMidi; m < baseMidi + semitones; m++) {
    keys.push({ midi: m, black: isBlackKey(m), name: noteName(m) });
  }
  return keys;
}

import { clamp } from "@/lib/utils";
import { midiToHz } from "@/lib/synth/notes";

export type Waveform = "sawtooth" | "square" | "triangle" | "sine";

export type SynthParams = {
  waveform: Waveform;
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number;
  octave: number;
};

const MAX_VOICES = 8;

// iOS media unlock — a real file play() in the same gesture as AudioContext.resume()
const BLIP_SRC = "/power-blip.wav";
const SILENT_SRC = "/silent.wav";

type Voice = {
  midi: number;
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  g1: GainNode;
  g2: GainNode;
  mix: GainNode;
  filter1: BiquadFilterNode;
  filter2: BiquadFilterNode;
  env: GainNode;
  playing: boolean;
};

function AudioContextCtor(): typeof AudioContext {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is not supported in this browser");
  return Ctor;
}

function cutoffHz(normalized: number) {
  const t = clamp(normalized, 0, 1);
  return 40 * Math.pow(360, t);
}

function resQ(normalized: number) {
  const t = clamp(normalized, 0, 1);
  return 0.4 + t * t * 18;
}

function envTime(normalized: number, min: number, max: number) {
  const t = clamp(normalized, 0, 1);
  return min * Math.pow(max / min, t);
}

function playHtml(src: string, volume: number) {
  try {
    const audio = new Audio(src);
    audio.setAttribute("playsinline", "true");
    audio.volume = volume;
    const play = audio.play();
    if (play) void play.catch(() => {});
  } catch {
    /* ignore */
  }
}

export class SynthEngine {
  params: SynthParams = {
    waveform: "sawtooth",
    cutoff: 0.72,
    resonance: 0.18,
    attack: 0.04,
    decay: 0.28,
    sustain: 0.78,
    release: 0.22,
    volume: 0.88,
    octave: 3,
  };

  revision = 0;
  ctxState: AudioContextState | "off" = "off";

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voices = new Map<number, Voice>();
  private holds = new Map<number, Set<string>>();
  private listeners = new Set<() => void>();
  private active = new Set<number>();
  private visibilityBound = false;
  private htmlUnlock: HTMLAudioElement | null = null;

  get powered() {
    return this.ctx !== null && this.ctx.state !== "closed";
  }

  get analyserNode() {
    return this.analyser;
  }

  get activeNotes(): ReadonlySet<number> {
    return this.active;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getRevision = () => this.revision;

  private emit() {
    this.revision += 1;
    this.ctxState = this.ctx?.state ?? "off";
    for (const fn of this.listeners) fn();
  }

  /** Must run inside a real click/tap/key handler. Resume is synchronous in that stack. */
  powerOn() {
    this.unlockHtml();

    if (this.ctx && this.ctx.state !== "closed") {
      this.resume();
      this.emit();
      return;
    }

    const Ctor = AudioContextCtor();
    let ctx: AudioContext;
    try {
      ctx = new Ctor({ latencyHint: "interactive" });
    } catch {
      ctx = new Ctor();
    }

    this.resumeContext(ctx);

    const master = ctx.createGain();
    master.gain.value = this.params.volume * this.params.volume;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -8;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.4;

    // Analyser is a tap — never sit it on the way to the speakers.
    master.connect(compressor);
    compressor.connect(ctx.destination);
    compressor.connect(analyser);

    this.ctx = ctx;
    this.master = master;
    this.analyser = analyser;

    ctx.addEventListener("statechange", () => {
      this.ctxState = ctx.state;
      this.emit();
      if (ctx.state === "running") this.flushHeldNotes();
    });

    if (!this.visibilityBound) {
      this.visibilityBound = true;
      const resume = () => this.resume();
      document.addEventListener("visibilitychange", resume);
      window.addEventListener("focus", resume);
      window.addEventListener("pageshow", resume);
      window.addEventListener("pointerdown", resume);
      window.addEventListener("touchstart", resume, { passive: true });
      window.addEventListener("keydown", resume);
    }

    playHtml(BLIP_SRC, 0.7);
    void ctx.resume().then(() => {
      this.playBlip();
      this.emit();
    });

    this.emit();
  }

  resume() {
    if (this.ctx) this.resumeContext(this.ctx);
  }

  dispose() {
    this.allOff();
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.voices.clear();
    this.holds.clear();
    this.active.clear();
    this.emit();
  }

  setWaveform(waveform: Waveform) {
    this.params.waveform = waveform;
    for (const voice of this.voices.values()) {
      if (!voice.playing) continue;
      voice.osc1.type = waveform;
      voice.osc2.type = waveform;
    }
    this.emit();
  }

  setCutoff(value: number) {
    this.params.cutoff = clamp(value, 0, 1);
    this.applyFilter();
    this.emit();
  }

  setResonance(value: number) {
    this.params.resonance = clamp(value, 0, 1);
    this.applyFilter();
    this.emit();
  }

  setAttack(value: number) {
    this.params.attack = clamp(value, 0, 1);
    this.emit();
  }

  setDecay(value: number) {
    this.params.decay = clamp(value, 0, 1);
    this.emit();
  }

  setSustain(value: number) {
    this.params.sustain = clamp(value, 0, 1);
    this.emit();
  }

  setRelease(value: number) {
    this.params.release = clamp(value, 0, 1);
    this.emit();
  }

  setVolume(value: number) {
    this.params.volume = clamp(value, 0, 1);
    if (this.master && this.ctx) {
      const g = this.params.volume * this.params.volume;
      this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.03);
    }
    this.emit();
  }

  setOctave(octave: number) {
    this.params.octave = clamp(Math.round(octave), 1, 6);
    this.emit();
  }

  noteOn(midi: number, source: string) {
    this.resume();
    if (!this.ctx) return;
    let holders = this.holds.get(midi);
    if (!holders) {
      holders = new Set();
      this.holds.set(midi, holders);
    }
    const already = holders.size > 0;
    holders.add(source);
    this.active.add(midi);
    this.emit();
    if (already) return;
    if (this.ctx.state === "running") this.startVoice(midi);
    else {
      void this.ctx.resume().then(() => {
        if (this.holds.get(midi)?.size && this.ctx?.state === "running") {
          this.startVoice(midi);
        }
      });
    }
  }

  noteOff(midi: number, source: string) {
    const holders = this.holds.get(midi);
    if (!holders) return;
    holders.delete(source);
    if (holders.size === 0) {
      this.holds.delete(midi);
      this.releaseVoice(midi);
    }
  }

  allOff() {
    for (const midi of [...this.holds.keys()]) {
      this.holds.delete(midi);
      this.releaseVoice(midi);
    }
  }

  formatCutoff() {
    const hz = cutoffHz(this.params.cutoff);
    if (hz >= 1000) return `${(hz / 1000).toFixed(1)}k`;
    return `${Math.round(hz)}`;
  }

  formatRes() {
    return resQ(this.params.resonance).toFixed(1);
  }

  formatEnv(which: "attack" | "decay" | "release") {
    const n = this.params[which];
    const sec = which === "release" ? envTime(n, 0.02, 3.2) : envTime(n, 0.005, 2.4);
    if (sec < 1) return `${Math.round(sec * 1000)}ms`;
    return `${sec.toFixed(2)}s`;
  }

  formatSustain() {
    return `${Math.round(this.params.sustain * 100)}%`;
  }

  formatVolume() {
    const g = this.params.volume * this.params.volume;
    if (g <= 0.0001) return "-∞";
    const db = 20 * Math.log10(g);
    return `${db.toFixed(0)}dB`;
  }

  private unlockHtml() {
    playHtml(SILENT_SRC, 0.01);
    if (!this.htmlUnlock) {
      const audio = new Audio(SILENT_SRC);
      audio.setAttribute("playsinline", "true");
      audio.loop = false;
      audio.volume = 0.01;
      this.htmlUnlock = audio;
    }
    const play = this.htmlUnlock.play();
    if (play) void play.catch(() => {});
  }

  private resumeContext(ctx: AudioContext) {
    if (ctx.state === "suspended") {
      const result = ctx.resume();
      void result;
    }
  }

  private playBlip() {
    if (!this.ctx || !this.master || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        /* already gone */
      }
    };
  }

  private flushHeldNotes() {
    if (!this.ctx || this.ctx.state !== "running") return;
    for (const midi of this.holds.keys()) {
      const existing = this.voices.get(midi);
      if (!existing || !existing.playing) this.startVoice(midi);
    }
  }

  private applyFilter() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const hz = cutoffHz(this.params.cutoff);
    const q = resQ(this.params.resonance);
    for (const voice of this.voices.values()) {
      if (!voice.playing) continue;
      voice.filter1.frequency.setTargetAtTime(hz, now, 0.03);
      voice.filter2.frequency.setTargetAtTime(hz, now, 0.03);
      voice.filter1.Q.setTargetAtTime(q, now, 0.03);
      voice.filter2.Q.setTargetAtTime(q * 0.72, now, 0.03);
    }
  }

  private stealOldest() {
    if (this.voices.size < MAX_VOICES) return;
    const oldest = this.voices.keys().next().value;
    if (oldest == null) return;
    this.holds.delete(oldest);
    this.killVoice(oldest);
  }

  private startVoice(midi: number) {
    if (!this.ctx || !this.master) return;
    if (this.ctx.state !== "running") return;
    this.stealOldest();
    if (this.voices.get(midi)) this.killVoice(midi);

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freq = midiToHz(midi);
    const wave = this.params.waveform;

    const osc1 = ctx.createOscillator();
    osc1.type = wave;
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = wave;
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.setValueAtTime(7, now);

    const mix = ctx.createGain();
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 0.78;
    g2.gain.value = 0.42;
    osc1.connect(g1);
    osc2.connect(g2);
    g1.connect(mix);
    g2.connect(mix);

    const filter1 = ctx.createBiquadFilter();
    filter1.type = "lowpass";
    filter1.frequency.value = cutoffHz(this.params.cutoff);
    filter1.Q.value = resQ(this.params.resonance);

    const filter2 = ctx.createBiquadFilter();
    filter2.type = "lowpass";
    filter2.frequency.value = cutoffHz(this.params.cutoff);
    filter2.Q.value = resQ(this.params.resonance) * 0.72;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);

    mix.connect(filter1);
    filter1.connect(filter2);
    filter2.connect(env);
    env.connect(this.master);

    const attack = envTime(this.params.attack, 0.003, 2.4);
    const decay = envTime(this.params.decay, 0.02, 2.4);
    const sustain = Math.max(0.0001, this.params.sustain);

    env.gain.linearRampToValueAtTime(1, now + attack);
    env.gain.setTargetAtTime(sustain, now + attack, Math.max(0.02, decay / 3));

    osc1.start(now);
    osc2.start(now);

    this.voices.set(midi, {
      midi,
      osc1,
      osc2,
      g1,
      g2,
      mix,
      filter1,
      filter2,
      env,
      playing: true,
    });
    this.active.add(midi);
    this.emit();
  }

  private releaseVoice(midi: number) {
    const voice = this.voices.get(midi);
    if (!voice || !this.ctx) {
      this.active.delete(midi);
      this.emit();
      return;
    }
    const now = this.ctx.currentTime;
    const release = envTime(this.params.release, 0.02, 3.2);
    const env = voice.env.gain;
    env.cancelScheduledValues(now);
    env.setValueAtTime(Math.max(0.0001, env.value), now);
    env.exponentialRampToValueAtTime(0.0001, now + release);

    const stopAt = now + release + 0.05;
    try {
      voice.osc1.stop(stopAt);
      voice.osc2.stop(stopAt);
    } catch {
      /* already stopped */
    }

    voice.playing = false;
    this.active.delete(midi);
    this.emit();

    window.setTimeout(() => {
      if (this.voices.get(midi) === voice) this.killVoice(midi);
    }, (release + 0.08) * 1000);
  }

  private killVoice(midi: number) {
    const voice = this.voices.get(midi);
    if (!voice) return;
    try {
      voice.osc1.disconnect();
      voice.osc2.disconnect();
      voice.g1.disconnect();
      voice.g2.disconnect();
      voice.mix.disconnect();
      voice.filter1.disconnect();
      voice.filter2.disconnect();
      voice.env.disconnect();
    } catch {
      /* graph already torn down */
    }
    this.voices.delete(midi);
    this.active.delete(midi);
  }
}

let shared: SynthEngine | null = null;

export function getSynthEngine() {
  if (!shared) shared = new SynthEngine();
  return shared;
}

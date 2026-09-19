import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnalogKnob } from "@/components/synth/analog-knob";
import { CrtScope } from "@/components/synth/crt-scope";
import { PianoKeyboard } from "@/components/synth/piano-keyboard";
import { PowerOverlay } from "@/components/synth/power-overlay";
import { WaveformSelect } from "@/components/synth/waveform-select";
import { getSynthEngine, type Waveform } from "@/lib/synth/engine";
import { KEY_TO_OFFSET, OCTAVE_DOWN_CODES, OCTAVE_UP_CODES } from "@/lib/synth/notes";
import { enableTilt, usePlayLayout } from "@/lib/synth/orientation";
import { cn } from "@/lib/utils";

function useEngine() {
  const ref = useRef(getSynthEngine());
  return ref.current;
}

export function SynthApp() {
  const engine = useEngine();
  const revision = useSyncExternalStore(engine.subscribe, engine.getRevision, () => 0);
  const snapshot = engine.params;
  const active = engine.activeNotes;
  const [powered, setPowered] = useState(() => engine.powered);
  const keysHeld = useRef(new Set<string>());
  const play = usePlayLayout();
  void revision;

  const powerOn = useCallback(() => {
    void enableTilt();
    engine.powerOn();
    setPowered(true);
  }, [engine]);

  const noteOn = useCallback(
    (midi: number, source: string) => {
      engine.resume();
      engine.noteOn(midi, source);
    },
    [engine],
  );
  const noteOff = useCallback(
    (midi: number, source: string) => {
      engine.noteOff(midi, source);
    },
    [engine],
  );

  useEffect(() => {
    if (!powered) return;

    const onDown = (event: KeyboardEvent) => {
      engine.resume();
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (OCTAVE_DOWN_CODES.has(event.code)) {
        event.preventDefault();
        engine.setOctave(engine.params.octave - 1);
        return;
      }
      if (OCTAVE_UP_CODES.has(event.code)) {
        event.preventDefault();
        engine.setOctave(engine.params.octave + 1);
        return;
      }

      const offset = KEY_TO_OFFSET[event.code];
      if (offset == null) return;
      event.preventDefault();
      if (event.repeat || keysHeld.current.has(event.code)) return;
      keysHeld.current.add(event.code);
      const midi = (engine.params.octave + 1) * 12 + offset;
      engine.noteOn(midi, `k${event.code}`);
    };

    const onUp = (event: KeyboardEvent) => {
      if (!keysHeld.current.has(event.code)) return;
      keysHeld.current.delete(event.code);
      const offset = KEY_TO_OFFSET[event.code];
      if (offset == null) return;
      const midi = (engine.params.octave + 1) * 12 + offset;
      engine.noteOff(midi, `k${event.code}`);
    };

    const panic = () => {
      keysHeld.current.clear();
      engine.allOff();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", panic);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", panic);
    };
  }, [engine, powered]);

  const baseMidi = (snapshot.octave + 1) * 12;
  const live = powered && engine.powered;
  const muted = live && engine.ctxState === "suspended";
  const turned = play.turn !== 0;

  return (
    <div
      className={cn("play-stage", turned && "play-stage-turned")}
      data-turn={play.turn}
    >
      <main
        className={cn(
          "relative bg-ink text-cream",
          play.sideways ? "synth-shell h-full overflow-hidden" : "min-h-dvh",
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-6xl flex-col px-3 py-3 sm:px-5 sm:py-6",
            play.sideways ? "h-full min-h-0 justify-stretch py-2" : "min-h-dvh justify-center",
          )}
        >
          <div
            className={cn(
              "synth-frame wood-grain relative overflow-hidden rounded-chassis border border-wood-dark shadow-chassis",
              !play.sideways && "block",
            )}
          >
            <div className="pointer-events-none absolute left-3 top-3 z-10 hidden sm:block">
              <span className="screw" />
            </div>
            <div className="pointer-events-none absolute right-3 top-3 z-10 hidden sm:block">
              <span className="screw" />
            </div>

            <div className="synth-brand flex shrink-0 items-center justify-between gap-3 px-4 pb-1 pt-3 sm:px-6 sm:pt-4">
              <div>
                <p className="font-display text-2xl font-semibold tracking-widest text-cream sm:text-3xl">OGBE-1</p>
                <p className="synth-subtitle font-display text-xs font-semibold uppercase tracking-widest text-cream-dim">
                  Chartreuse edition
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    play.toggleSideways();
                  }}
                  className={cn(
                    "min-h-11 rounded-md border px-3 font-display text-xs font-semibold uppercase tracking-widest",
                    play.sideways
                      ? "border-signal/50 bg-ink text-signal shadow-lit"
                      : "border-panel-line bg-panel-lift text-cream-dim",
                  )}
                  aria-pressed={play.sideways}
                  aria-label="Bigger keys for sideways play"
                >
                  Sideways
                </button>
                <span
                  className={cn(
                    "h-3 w-3 rounded-full ring-2 ring-ink/40",
                    live && !muted ? "bg-signal shadow-lit" : "bg-led-off",
                  )}
                  aria-label={live ? (muted ? "Muted" : "Powered") : "Standby"}
                />
              </div>
            </div>

            {muted ? (
              <button
                type="button"
                onPointerDown={() => engine.resume()}
                className="mx-2 mb-2 rounded-md border border-signal/40 bg-ink px-3 py-2 text-center font-display text-xs font-semibold uppercase tracking-widest text-signal sm:mx-3"
              >
                Tap here if you still have no sound
              </button>
            ) : null}

            <div className="synth-panel panel-metal mx-2 mb-2 rounded-lg border border-ink/50 p-3 sm:mx-3 sm:p-4">
              <div className="synth-board grid gap-4 lg:grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,16rem)] lg:items-start">
                <figure className="relative overflow-hidden rounded-md border border-ink/60 bg-signal">
                  <img
                    src="/ogbe-face.jpg"
                    alt="Ogbe artist faceplate"
                    className="synth-face h-40 w-full object-cover object-top sm:h-44 lg:h-full lg:min-h-64"
                    draggable={false}
                  />
                  <figcaption className="pointer-events-none absolute bottom-1.5 right-2 font-display text-xs font-semibold uppercase tracking-widest text-ink">
                    Ogbe
                  </figcaption>
                </figure>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
                  <WaveformSelect
                    value={snapshot.waveform}
                    onChange={(wave: Waveform) => engine.setWaveform(wave)}
                    disabled={!live}
                  />

                  <div className="grid gap-3">
                    <section>
                      <header className="mb-2 flex items-center gap-3">
                        <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-cream-dim">
                          Filter
                        </h2>
                        <span className="section-rule flex-1" />
                      </header>
                      <div className="flex flex-wrap justify-around gap-2">
                        <AnalogKnob
                          label="Cutoff"
                          value={snapshot.cutoff}
                          display={engine.formatCutoff()}
                          defaultValue={0.72}
                          onChange={(v) => engine.setCutoff(v)}
                          disabled={!live}
                        />
                        <AnalogKnob
                          label="Res"
                          value={snapshot.resonance}
                          display={engine.formatRes()}
                          defaultValue={0.18}
                          onChange={(v) => engine.setResonance(v)}
                          disabled={!live}
                        />
                        <AnalogKnob
                          label="Volume"
                          value={snapshot.volume}
                          display={engine.formatVolume()}
                          defaultValue={0.88}
                          onChange={(v) => engine.setVolume(v)}
                          disabled={!live}
                        />
                      </div>
                    </section>

                    <section>
                      <header className="mb-2 flex items-center gap-3">
                        <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-cream-dim">
                          Envelope
                        </h2>
                        <span className="section-rule flex-1" />
                      </header>
                      <div className="flex flex-wrap justify-around gap-2">
                        <AnalogKnob
                          label="Attack"
                          value={snapshot.attack}
                          display={engine.formatEnv("attack")}
                          defaultValue={0.04}
                          onChange={(v) => engine.setAttack(v)}
                          disabled={!live}
                          size="sm"
                        />
                        <AnalogKnob
                          label="Decay"
                          value={snapshot.decay}
                          display={engine.formatEnv("decay")}
                          defaultValue={0.28}
                          onChange={(v) => engine.setDecay(v)}
                          disabled={!live}
                          size="sm"
                        />
                        <AnalogKnob
                          label="Sustain"
                          value={snapshot.sustain}
                          display={engine.formatSustain()}
                          defaultValue={0.78}
                          onChange={(v) => engine.setSustain(v)}
                          disabled={!live}
                          size="sm"
                        />
                        <AnalogKnob
                          label="Release"
                          value={snapshot.release}
                          display={engine.formatEnv("release")}
                          defaultValue={0.22}
                          onChange={(v) => engine.setRelease(v)}
                          disabled={!live}
                          size="sm"
                        />
                      </div>
                    </section>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <CrtScope analyser={engine.analyserNode} live={live} />
                  <div className="flex items-center justify-between gap-3 rounded-md border border-panel-line bg-ink/40 px-3 py-2">
                    <span className="font-display text-xs font-semibold uppercase tracking-widest text-cream-dim">
                      Octave
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="min-h-11 min-w-11 rounded-md border border-panel-line bg-panel-lift font-display text-lg text-cream hover:border-cream-dim/40 disabled:opacity-50"
                        onClick={() => engine.setOctave(snapshot.octave - 1)}
                        disabled={!live || snapshot.octave <= 1}
                        aria-label="Octave down"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-mono text-lg tabular-nums text-signal">{snapshot.octave}</span>
                      <button
                        type="button"
                        className="min-h-11 min-w-11 rounded-md border border-panel-line bg-panel-lift font-display text-lg text-cream hover:border-cream-dim/40 disabled:opacity-50"
                        onClick={() => engine.setOctave(snapshot.octave + 1)}
                        disabled={!live || snapshot.octave >= 6}
                        aria-label="Octave up"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="hidden font-display text-xs uppercase tracking-widest text-cream-dim lg:block">
                    Z–M and Q–I play two octaves. Arrows shift range.
                  </p>
                </div>
              </div>
            </div>

            <div className="synth-keys sticky bottom-0 z-10 mt-auto wood-grain px-2 pb-3 pt-1 sm:static sm:px-3 sm:pt-0">
              <PianoKeyboard
                baseMidi={baseMidi}
                active={active}
                onNoteOn={noteOn}
                onNoteOff={noteOff}
                disabled={!live}
              />
            </div>

            <PowerOverlay visible={!powered} onPower={powerOn} />
          </div>
        </div>
      </main>
    </div>
  );
}

import { useCallback, useEffect, useRef } from "react";
import { buildKeybed, labelsForMidi } from "@/lib/synth/notes";
import { cn } from "@/lib/utils";

const SEMITONES = 25;

type PianoKeyboardProps = {
  baseMidi: number;
  active: ReadonlySet<number>;
  onNoteOn: (midi: number, source: string) => void;
  onNoteOff: (midi: number, source: string) => void;
  disabled?: boolean;
};

function midiFromPoint(x: number, y: number) {
  const el = document.elementFromPoint(x, y);
  const host = el?.closest("[data-midi]") as HTMLElement | null;
  if (!host) return null;
  const midi = Number(host.dataset.midi);
  return Number.isFinite(midi) ? midi : null;
}

export function PianoKeyboard({
  baseMidi,
  active,
  onNoteOn,
  onNoteOff,
  disabled,
}: PianoKeyboardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>());
  const keys = buildKeybed(baseMidi, SEMITONES);
  const whites = keys.filter((k) => !k.black);
  const blacks = keys.filter((k) => k.black);
  const labels = labelsForMidi(baseMidi);
  const whiteWidth = 100 / whites.length;

  const bind = useCallback(
    (pointerId: number, midi: number | null) => {
      const prev = pointers.current.get(pointerId);
      if (prev === midi) return;
      if (prev != null) onNoteOff(prev, `p${pointerId}`);
      if (midi == null) {
        pointers.current.delete(pointerId);
        return;
      }
      pointers.current.set(pointerId, midi);
      onNoteOn(midi, `p${pointerId}`);
    },
    [onNoteOff, onNoteOn],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.pointerType === "touch") return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* untrusted or unsupported capture */
      }
      bind(event.pointerId, midiFromPoint(event.clientX, event.clientY));
    },
    [bind, disabled],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") return;
      if (!pointers.current.has(event.pointerId)) return;
      bind(event.pointerId, midiFromPoint(event.clientX, event.clientY));
    },
    [bind],
  );

  const onPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") return;
      bind(event.pointerId, null);
    },
    [bind],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el || disabled) return;

    const onStart = (event: TouchEvent) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        bind(touch.identifier, midiFromPoint(touch.clientX, touch.clientY));
      }
    };
    const onMove = (event: TouchEvent) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        bind(touch.identifier, midiFromPoint(touch.clientX, touch.clientY));
      }
    };
    const onEnd = (event: TouchEvent) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        bind(touch.identifier, null);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [bind, disabled]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "keybed relative w-full touch-none select-none overflow-hidden rounded-md bg-ink",
        disabled && "pointer-events-none opacity-60",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      role="group"
      aria-label="Piano keyboard"
    >
      <div className="absolute inset-0 flex">
        {whites.map((key) => {
          const lit = active.has(key.midi);
          const label = labels.get(key.midi);
          const isC = key.name.startsWith("C") && !key.name.includes("#");
          return (
            <div
              key={key.midi}
              data-midi={key.midi}
              data-active={lit}
              aria-label={key.name}
              className={cn(
                "ivory-key relative h-full min-w-0 flex-1 rounded-b-sm border-x border-b",
                "transition-[transform,background-color,box-shadow] duration-[var(--motion-quick)]",
              )}
            >
              <span className="key-caption pointer-events-none absolute inset-x-0 bottom-2 hidden flex-col items-center gap-0.5 sm:flex">
                {label ? (
                  <span className="font-display text-xs font-semibold tracking-wide text-wood-dark/80">{label}</span>
                ) : null}
                {isC ? <span className="font-mono text-xs text-wood-dark/55">{key.name}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-0">
        {blacks.map((key) => {
          const whitesBefore = whites.filter((w) => w.midi < key.midi).length;
          const left = whitesBefore * whiteWidth - whiteWidth * 0.32;
          const lit = active.has(key.midi);
          const label = labels.get(key.midi);
          return (
            <div
              key={key.midi}
              data-midi={key.midi}
              data-active={lit}
              aria-label={key.name}
              className={cn(
                "ebony-key pointer-events-auto absolute top-0 h-[58%] rounded-b-sm",
                "transition-[transform,background-color,box-shadow] duration-[var(--motion-quick)]",
              )}
              style={{ left: `${left}%`, width: `${whiteWidth * 0.64}%` }}
            >
              {label ? (
                <span className="key-caption-black pointer-events-none absolute inset-x-0 bottom-1.5 hidden text-center font-display text-xs font-semibold tracking-wide text-cream/80 sm:block">
                  {label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

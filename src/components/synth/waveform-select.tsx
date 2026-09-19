import { cn } from "@/lib/utils";
import type { Waveform } from "@/lib/synth/engine";

const WAVES: { id: Waveform; label: string }[] = [
  { id: "sawtooth", label: "Saw" },
  { id: "square", label: "Square" },
  { id: "triangle", label: "Tri" },
  { id: "sine", label: "Sine" },
];

function WaveIcon({ type, className }: { type: Waveform; className?: string }) {
  const d =
    type === "sawtooth"
      ? "M2 14 L8 4 L8 14 L14 4 L14 14 L20 4 L20 14"
      : type === "square"
        ? "M2 14 L2 4 L10 4 L10 14 L18 14 L18 4 L22 4"
        : type === "triangle"
          ? "M2 14 L8 4 L14 14 L20 4"
          : "M2 9 C6 9 6 4 10 4 C14 4 14 14 18 14 C20.5 14 21.5 11 22 9";
  return (
    <svg viewBox="0 0 24 18" className={className} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function WaveformSelect({
  value,
  onChange,
  disabled,
}: {
  value: Waveform;
  onChange: (wave: Waveform) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-cream-dim">
        Oscillator
      </legend>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-2 sm:gap-2">
        {WAVES.map((wave) => {
          const on = wave.id === value;
          return (
            <button
              key={wave.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(wave.id)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-1.5",
                "transition-[background-color,border-color,color,box-shadow] duration-[var(--motion-quick)]",
                on
                  ? "border-signal/50 bg-panel-lift text-signal shadow-lit"
                  : "border-panel-line bg-ink/40 text-cream-dim hover:border-cream-dim/40 hover:text-cream",
                disabled && "opacity-50",
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-signal shadow-lit" : "bg-led-off")}
                aria-hidden="true"
              />
              <WaveIcon type={wave.id} className="h-4 w-7" />
              <span className="font-display text-xs font-semibold uppercase tracking-widest">{wave.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

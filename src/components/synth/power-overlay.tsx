import { cn } from "@/lib/utils";

export function PowerOverlay({ onPower, visible }: { onPower: () => void; visible: boolean }) {
  return (
    <div
      className={cn(
        "power-overlay fixed inset-0 z-50 flex flex-col items-center justify-end overflow-hidden bg-signal",
        "transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      onPointerDown={(event) => {
        if (!visible) return;
        event.preventDefault();
        onPower();
      }}
      role="dialog"
      aria-hidden={!visible}
      inert={!visible || undefined}
      aria-label="Power on OGBE-1"
    >
      <img
        src="/ogbe-face.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />
      <audio src="/silent.wav" preload="auto" playsInline hidden />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-3 px-6 pb-10 pt-8">
        <p className="pointer-events-none font-display text-5xl font-semibold tracking-widest text-ink text-balance sm:text-6xl">
          OGBE-1
        </p>
        <p className="pointer-events-none font-display text-sm font-semibold uppercase tracking-widest text-ink/80">
          Analog synthesizer
        </p>
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPower();
          }}
          className={cn(
            "mt-2 flex min-h-12 min-w-48 items-center justify-center gap-3 rounded-md",
            "border-2 border-ink bg-ivory px-6 font-display text-lg font-semibold uppercase tracking-widest text-ink",
            "shadow-stamp transition-transform duration-[var(--motion-quick)]",
            "hover:translate-x-px hover:translate-y-px",
            "active:translate-x-0.5 active:translate-y-0.5",
          )}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-led-off ring-2 ring-ink" aria-hidden="true" />
          Power on
        </button>
        <p className="pointer-events-none max-w-xs text-center font-display text-sm font-medium tracking-wide text-ink/75">
          You should hear a short ping. Then play the keys.
        </p>
      </div>
    </div>
  );
}

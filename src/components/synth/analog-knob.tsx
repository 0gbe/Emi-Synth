import { useCallback, useId, useRef } from "react";
import { clamp, cn } from "@/lib/utils";

type AnalogKnobProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  display: string;
  defaultValue?: number;
  size?: "sm" | "md";
  disabled?: boolean;
};

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

export function AnalogKnob({
  label,
  value,
  onChange,
  display,
  defaultValue = 0.5,
  size = "md",
  disabled,
}: AnalogKnobProps) {
  const id = useId();
  const drag = useRef<{ y: number; value: number } | null>(null);
  const angle = MIN_ANGLE + clamp(value, 0, 1) * (MAX_ANGLE - MIN_ANGLE);
  const dim = size === "sm" ? "h-14 w-14" : "h-16 w-16";

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* untrusted or unsupported capture */
      }
      drag.current = { y: event.clientY, value };
    },
    [disabled, value],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!drag.current) return;
      const fine = event.shiftKey ? 0.22 : 1;
      const delta = (drag.current.y - event.clientY) / 130;
      onChange(clamp(drag.current.value + delta * fine, 0, 1));
    },
    [onChange],
  );

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (disabled) return;
      const step = event.deltaY > 0 ? -0.02 : 0.02;
      onChange(clamp(value + step, 0, 1));
    },
    [disabled, onChange, value],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const step = event.shiftKey ? 0.01 : 0.04;
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        event.preventDefault();
        onChange(clamp(value + step, 0, 1));
      } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        onChange(clamp(value - step, 0, 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        onChange(0);
      } else if (event.key === "End") {
        event.preventDefault();
        onChange(1);
      }
    },
    [disabled, onChange, value],
  );

  return (
    <div className="flex w-20 flex-col items-center gap-1">
      <label htmlFor={id} className="font-display text-xs font-semibold uppercase tracking-widest text-cream-dim">
        {label}
      </label>
      <div
        id={id}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={display}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => !disabled && onChange(defaultValue)}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className={cn(
          "relative touch-none select-none rounded-full outline-none",
          "focus-visible:ring-2 focus-visible:ring-signal/70",
          disabled && "pointer-events-none opacity-50",
          dim,
        )}
      >
        <div className="knob-skirt absolute inset-0 rounded-full" />
        <div
          className="knob-cap absolute inset-[11%] rounded-full"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span className="absolute left-1/2 top-[9%] h-[38%] w-0.5 -translate-x-1/2 rounded-full bg-ink" />
        </div>
      </div>
      <span className="font-mono text-xs tabular-nums text-signal">{display}</span>
    </div>
  );
}

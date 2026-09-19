import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const LEDS = 12;

function readColor(el: HTMLElement, name: string, fallback: string) {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

export function CrtScope({
  analyser,
  live,
}: {
  analyser: AnalyserNode | null;
  live: boolean;
}) {
  const waveRef = useRef<HTMLCanvasElement>(null);
  const peakRef = useRef(0);
  const ledsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    const time = new Uint8Array(2048);
    const freq = new Uint8Array(1024);

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const { width, height } = canvas;
      const ink = readColor(canvas, "--color-ink", "#070806");
      const signal = readColor(canvas, "--color-signal", "#c6f000");
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(198,240,0,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        const y = (height / 4) * i;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      if (analyser && live) {
        analyser.getByteTimeDomainData(time);
        analyser.getByteFrequencyData(freq);
        let sum = 0;
        ctx.beginPath();
        ctx.strokeStyle = signal;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = signal;
        ctx.shadowBlur = 8;
        const n = analyser.fftSize;
        for (let i = 0; i < n; i++) {
          const v = time[i] / 128 - 1;
          sum += v * v;
          const x = (i / (n - 1)) * width;
          const y = height / 2 + v * height * 0.42;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        const rms = Math.sqrt(sum / n);
        peakRef.current = Math.max(rms, peakRef.current * 0.86);
      } else {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(198,240,0,0.35)";
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        peakRef.current *= 0.9;
      }

      const level = Math.min(1, peakRef.current * 3.4);
      const lit = Math.round(level * LEDS);
      const root = ledsRef.current;
      if (root) {
        const kids = root.children;
        for (let i = 0; i < kids.length; i++) {
          (kids[i] as HTMLElement).dataset.on = i < lit ? "true" : "false";
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(draw as unknown as number);
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [analyser, live]);

  return (
    <div className="flex min-w-0 gap-2">
      <div className="crt-bezel relative min-h-24 min-w-0 flex-1 overflow-hidden rounded-md">
        <canvas ref={waveRef} className="absolute inset-0 h-full w-full" />
        <span className="pointer-events-none absolute left-2 top-1.5 font-display text-xs font-semibold uppercase tracking-widest text-signal/70">
          Scope
        </span>
      </div>
      <div
        ref={ledsRef}
        className="flex w-4 shrink-0 flex-col-reverse justify-between rounded-md bg-ink/60 p-1"
        aria-hidden="true"
      >
        {Array.from({ length: LEDS }, (_, i) => (
          <span
            key={i}
            data-on="false"
            className={cn(
              "h-1.5 w-full rounded-xs bg-signal-dim/40",
              "data-[on=true]:bg-signal data-[on=true]:shadow-lit",
              i >= 10 && "data-[on=true]:bg-signal-hot",
            )}
          />
        ))}
      </div>
    </div>
  );
}

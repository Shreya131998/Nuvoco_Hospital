"use client";

import { Minus, Plus } from "lucide-react";

/** Big +/- targets — this is filled with gloves on, on a phone. */
export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  tone = "default",
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  tone?: "default" | "add";
  ariaLabel: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  // shrink-0 buttons with a fluid number field: the whole control collapses to
  // ~84px on a 320px phone instead of demanding a fixed 140px.
  const btn =
    "grid size-9 shrink-0 place-items-center rounded-lg border border-border-strong " +
    "bg-surface active:scale-95 disabled:opacity-40";
  return (
    <div className="flex w-full items-center gap-1.5">
      <button
        type="button"
        className={btn}
        aria-label={`Decrease ${ariaLabel}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        className={
          "w-full min-w-0 rounded-lg border border-border-strong bg-surface px-1 py-2 text-center text-sm font-semibold " +
          (tone === "add" && value > 0 ? "border-primary text-primary" : "")
        }
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value || "0", 10) || 0))}
      />
      <button
        type="button"
        className={btn}
        aria-label={`Increase ${ariaLabel}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

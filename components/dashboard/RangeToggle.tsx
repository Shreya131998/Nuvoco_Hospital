"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGE_LABEL, type RangeKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

const KEYS: RangeKey[] = ["today", "7d", "30d"];

/** Today / 7 days / 30 days. Kept in the URL so a view can be shared or bookmarked. */
export function RangeToggle({ value }: { value: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div
      role="group"
      aria-label="Date range"
      className="inline-flex overflow-hidden rounded-lg border border-border-strong bg-surface"
    >
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("range", k);
            router.push(`${pathname}?${next.toString()}`);
          }}
          className={cn(
            "px-3 py-2 text-xs font-semibold transition sm:text-sm",
            value === k ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-2"
          )}
        >
          {RANGE_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

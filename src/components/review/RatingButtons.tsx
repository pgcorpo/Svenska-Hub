"use client";

import { useEffect, useMemo } from "react";
import { getNextStates, formatCardInterval } from "@/lib/fsrs/scheduler";
import { RATING_CONFIG } from "@/lib/constants";
import type { CardProgress } from "@/types";

interface Props {
  progress: CardProgress;
  onGrade: (rating: 1 | 4) => void;
  disabled?: boolean;
}

export function RatingButtons({ progress, onGrade, disabled }: Props) {
  // Pre-calculate intervals for binary buttons (1 = Forgot/Again, 4 = Got it/Easy)
  const intervals = useMemo(() => {
    const states = getNextStates(progress);
    return {
      1: formatCardInterval(states[1].card),
      4: formatCardInterval(states[4].card),
    };
  }, [progress]);

  // Keyboard shortcut listener (1 = Forgot, 4 = Got it)
  useEffect(() => {
    if (disabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "1") {
        e.preventDefault();
        onGrade(1);
      } else if (e.key === "4") {
        e.preventDefault();
        onGrade(4);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onGrade]);

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 sm:gap-4">
      {([1, 4] as const).map((rating) => {
        const config = RATING_CONFIG[rating];
        return (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            onClick={() => onGrade(rating)}
            className={`flex flex-col items-center justify-center rounded-xl border px-4 py-2.5 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${config.bgColor}`}
          >
            <span className="text-[11px] font-medium text-muted-foreground">
              {intervals[rating]}
            </span>
            <span className={`text-sm sm:text-base font-semibold ${config.color}`}>
              {config.label}
            </span>
            <span className="mt-0.5 text-[10px] text-muted-foreground/60">
              {config.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );
}

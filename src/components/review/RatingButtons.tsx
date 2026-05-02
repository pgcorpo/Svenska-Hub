"use client";

import { useEffect, useMemo } from "react";
import { getNextStates, formatInterval } from "@/lib/fsrs/scheduler";
import { RATING_CONFIG } from "@/lib/constants";
import type { CardProgress } from "@/types";

interface Props {
  progress: CardProgress;
  onGrade: (rating: 1 | 2 | 3 | 4) => void;
  disabled?: boolean;
}

export function RatingButtons({ progress, onGrade, disabled }: Props) {
  // Pre-calculate intervals for all 4 buttons based on current card progress
  const intervals = useMemo(() => {
    const states = getNextStates(progress);
    return {
      1: formatInterval(states[1].card.scheduled_days),
      2: formatInterval(states[2].card.scheduled_days),
      3: formatInterval(states[3].card.scheduled_days),
      4: formatInterval(states[4].card.scheduled_days),
    };
  }, [progress]);

  // Keyboard shortcut listener (1, 2, 3, 4)
  useEffect(() => {
    if (disabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        const rating = parseInt(e.key) as 1 | 2 | 3 | 4;
        onGrade(rating);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onGrade]);

  return (
    <div className="grid w-full grid-cols-4 gap-2 sm:gap-4">
      {([1, 2, 3, 4] as const).map((rating) => {
        const config = RATING_CONFIG[rating];
        return (
          <button
            key={rating}
            disabled={disabled}
            onClick={() => onGrade(rating)}
            className={`flex flex-col items-center justify-center rounded-xl border p-2 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${config.bgColor}`}
          >
            <span className="mb-1 text-xs font-medium text-muted-foreground">
              {intervals[rating]}
            </span>
            <span className={`text-sm sm:text-base font-semibold ${config.color}`}>
              {config.label}
            </span>
            <span className="mt-1 hidden text-xs text-muted-foreground/50 sm:block">
              Press {config.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useSpeech } from "@/hooks/useSpeech";
import { Badge } from "@/components/ui/badge";
import type { ReviewCard as ReviewCardType } from "@/types";
import { Volume2 } from "lucide-react";
import { useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  card: ReviewCardType;
  isRevealed: boolean;
}

export function ReviewCard({ card, isRevealed }: Props) {
  const { speakSwedish, hasSwedish } = useSpeech();
  const { word } = card;

  // Auto-play pronunciation when revealed
  useEffect(() => {
    if (isRevealed && hasSwedish) {
      speakSwedish(word.swedish_word);
    }
  }, [isRevealed, hasSwedish, word.swedish_word, speakSwedish]);

  const genderColor =
    word.gender === "en"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : word.gender === "ett"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <div className="perspective-1000 relative h-[400px] w-full max-w-lg select-none">
      <motion.div
        className="relative h-full w-full preserve-3d"
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Front Side — Swedish Word */}
        <div className="absolute inset-0 h-full w-full backface-hidden">
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border/50 bg-card p-6 text-center shadow-xl shadow-black/20">
            {word.gender && word.gender !== "n/a" && (
              <div className="mb-4">
                <Badge variant="outline" className={genderColor}>
                  {word.gender}
                </Badge>
              </div>
            )}
            <h1 className="text-5xl font-bold tracking-tight text-foreground">
              {word.swedish_word}
            </h1>
          </div>
        </div>

        {/* Back Side — English + Details */}
        <div
          className="absolute inset-0 h-full w-full backface-hidden"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border/50 bg-card p-6 text-center shadow-xl shadow-black/20 overflow-y-auto">
            <div className="w-full space-y-5">
              <h2 className="text-3xl font-bold text-emerald-400">
                {word.english_meaning}
              </h2>

              {(word.grammar_forms?.definite_singular ||
                word.grammar_forms?.indefinite_plural) && (
                <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                  {word.grammar_forms.definite_singular && (
                    <span>Def: {word.grammar_forms.definite_singular}</span>
                  )}
                  {word.grammar_forms.indefinite_plural && (
                    <span>Plural: {word.grammar_forms.indefinite_plural}</span>
                  )}
                </div>
              )}

              {word.example_sv && word.example_en && (
                <div className="rounded-lg bg-background/50 p-4 text-left">
                  <p className="mb-1 text-base text-foreground/90 italic">
                    &ldquo;{word.example_sv}&rdquo;
                  </p>
                  <p className="text-sm text-muted-foreground">
                    &ldquo;{word.example_en}&rdquo;
                  </p>
                </div>
              )}

              {hasSwedish && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    speakSwedish(word.swedish_word);
                  }}
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  aria-label="Replay pronunciation"
                >
                  <Volume2 className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

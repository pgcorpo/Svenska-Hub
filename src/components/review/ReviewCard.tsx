"use client";

import { useSpeech } from "@/hooks/useSpeech";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReviewCard as ReviewCardType } from "@/types";
import { Volume2 } from "lucide-react";
import { useEffect } from "react";

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
    <Card className="min-h-[400px] w-full max-w-lg border-border/50 bg-card p-6 shadow-xl shadow-black/50 transition-all duration-300">
      {/* Front of card */}
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-4">
          <Badge variant="outline" className={genderColor}>
            {word.gender !== "n/a" ? word.gender : "word"}
          </Badge>
        </div>

        <h1 className="mb-8 text-5xl font-bold tracking-tight text-foreground">
          {word.swedish_word}
        </h1>

        {/* Back of card (revealed) */}
        <div
          className={`flex w-full flex-col items-center space-y-6 transition-all duration-500 ${
            isRevealed
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0 pointer-events-none"
          }`}
        >
          <div className="w-full border-t border-border/50 pt-6">
            <h2 className="text-2xl font-medium text-emerald-400">
              {word.english_meaning}
            </h2>
          </div>

          {(word.grammar_forms?.definite_singular ||
            word.grammar_forms?.indefinite_plural) && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              {word.grammar_forms.definite_singular && (
                <span>Def: {word.grammar_forms.definite_singular}</span>
              )}
              {word.grammar_forms.indefinite_plural && (
                <span>Plural: {word.grammar_forms.indefinite_plural}</span>
              )}
            </div>
          )}

          {word.example_sv && word.example_en && (
            <div className="mt-4 rounded-lg bg-background/50 p-4 w-full text-left">
              <p className="mb-1 text-base text-foreground/90">
                "{word.example_sv}"
              </p>
              <p className="text-sm text-muted-foreground">
                "{word.example_en}"
              </p>
            </div>
          )}

          {hasSwedish && (
            <button
              onClick={() => speakSwedish(word.swedish_word)}
              className="mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Replay pronunciation"
            >
              <Volume2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

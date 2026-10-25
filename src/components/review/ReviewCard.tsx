"use client";

import { useSpeech } from "@/hooks/useSpeech";
import { Badge } from "@/components/ui/badge";
import { enrichWordWithAi } from "@/lib/gemini/client-config";
import type {
  ReviewCard as ReviewCardType,
  VocabularyWord,
} from "@/types";
import { Sparkles, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface Props {
  card: ReviewCardType;
  isRevealed: boolean;
  onWordUpdated?: (word: VocabularyWord) => void;
}

export function ReviewCard({ card, isRevealed, onWordUpdated }: Props) {
  const { speakSwedish, hasSwedish } = useSpeech();
  const { word } = card;
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-play pronunciation when revealed
  useEffect(() => {
    if (isRevealed && hasSwedish) {
      speakSwedish(word.swedish_word);
    }
  }, [isRevealed, hasSwedish, word.swedish_word, speakSwedish]);

  const handleEnrichExample = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const { word: updated, model_used } = await enrichWordWithAi(
        word.id,
        word.swedish_word,
        word.english_meaning
      );
      onWordUpdated?.(updated);
      toast.success(
        model_used
          ? `Generated complex example (${model_used})`
          : "Generated complex example"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not generate example"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const genderColor =
    word.gender === "en"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : word.gender === "ett"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <div className="perspective-1000 relative h-[420px] w-full max-w-lg select-none">
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

        {/* Back Side — English + Details + Complex Swedish Sentence */}
        <div
          className="absolute inset-0 h-full w-full backface-hidden"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border/50 bg-card p-6 text-center shadow-xl shadow-black/20 overflow-y-auto">
            <div className="w-full space-y-4">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-3xl font-bold text-emerald-400">
                  {word.english_meaning}
                </h2>
                {hasSwedish && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakSwedish(word.swedish_word);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    aria-label="Replay word pronunciation"
                    title="Speak word"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {(word.grammar_forms?.definite_singular ||
                word.grammar_forms?.indefinite_plural) && (
                <div className="flex flex-wrap justify-center gap-4 text-xs sm:text-sm text-muted-foreground">
                  {word.grammar_forms.definite_singular && (
                    <span>
                      {word.gender === "n/a" ? "Form 1" : "Def"}:{" "}
                      <strong className="font-medium text-foreground/80">
                        {word.grammar_forms.definite_singular}
                      </strong>
                    </span>
                  )}
                  {word.grammar_forms.indefinite_plural && (
                    <span>
                      {word.gender === "n/a" ? "Form 2" : "Plural"}:{" "}
                      <strong className="font-medium text-foreground/80">
                        {word.grammar_forms.indefinite_plural}
                      </strong>
                    </span>
                  )}
                </div>
              )}

              {word.example_sv ? (
                <div className="rounded-xl border border-border/40 bg-background/60 p-4 text-left space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm sm:text-base font-medium leading-relaxed text-foreground/95 italic">
                      &ldquo;{word.example_sv}&rdquo;
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      {hasSwedish && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            speakSwedish(word.example_sv!);
                          }}
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                          aria-label="Speak Swedish sentence"
                          title="Listen to sentence"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleEnrichExample}
                        disabled={isGenerating}
                        className="rounded-full p-1.5 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                        title="Generate a new complex Swedish sentence with AI"
                        aria-label="Regenerate complex example sentence"
                      >
                        <Sparkles
                          className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`}
                        />
                      </button>
                    </div>
                  </div>
                  {word.example_en && (
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      &ldquo;{word.example_en}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleEnrichExample}
                    disabled={isGenerating}
                    className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  >
                    <Sparkles
                      className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`}
                    />
                    {isGenerating
                      ? "Generating complex Swedish sentence…"
                      : "Generate complex sentence example"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

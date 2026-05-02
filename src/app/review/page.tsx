"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReviewSession } from "@/hooks/useReviewSession";
import { ReviewCard } from "@/components/review/ReviewCard";
import { RatingButtons } from "@/components/review/RatingButtons";
import { UndoButton } from "@/components/review/UndoButton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ReviewPage() {
  const router = useRouter();
  const {
    currentCard,
    isRevealed,
    reveal,
    grade,
    undo,
    canUndo,
    isComplete,
    isLoading,
    totalCards,
    reviewedCount,
  } = useReviewSession();

  // Handle Spacebar to reveal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        
        // Only reveal if there's a card and it's not already revealed
        if (currentCard && !isRevealed) {
          reveal();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentCard, isRevealed, reveal]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isComplete || !currentCard) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-4 text-center">
        <div className="mb-6 text-6xl">🎉</div>
        <h1 className="mb-2 text-2xl font-bold">All done for today!</h1>
        <p className="mb-8 text-muted-foreground">
          You've reviewed all your due cards. Great job!
        </p>
        <Button onClick={() => router.push("/")} size="lg">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center p-4">
      {/* Header controls */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quit
        </Button>
      </div>

      <UndoButton onUndo={undo} disabled={!canUndo} />

      {/* Progress bar */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-xs px-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(reviewedCount / totalCards) * 100}%` }}
          />
        </div>
        <div className="mt-2 text-center text-xs text-muted-foreground">
          {reviewedCount} / {totalCards} cards
        </div>
      </div>

      {/* Main interaction area */}
      <div className="flex w-full max-w-lg flex-col items-center space-y-8 mt-12 w-full">
        <ReviewCard card={currentCard} isRevealed={isRevealed} />

        <div className="h-[100px] w-full mt-8">
          {!isRevealed ? (
            <Button
              className="h-14 w-full text-lg"
              size="lg"
              onClick={reveal}
            >
              Show Answer
              <span className="ml-2 hidden text-sm font-normal opacity-70 sm:inline">
                (Space)
              </span>
            </Button>
          ) : (
            <RatingButtons
              progress={currentCard.progress}
              onGrade={grade}
            />
          )}
        </div>
      </div>
    </div>
  );
}

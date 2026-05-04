"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReviewSession } from "@/hooks/useReviewSession";
import { ReviewCard } from "@/components/review/ReviewCard";
import { UndoButton } from "@/components/review/UndoButton";
import { Button } from "@/components/ui/button";
import { Home, Undo2 } from "lucide-react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";

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

  // Drag constraints and values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const background = useTransform(
    x,
    [-150, 0, 150],
    ["rgba(239, 68, 68, 0.1)", "rgba(0, 0, 0, 0)", "rgba(52, 211, 153, 0.1)"]
  );

  const [exitX, setExitX] = useState(0);

  // Handle Keyboard Interactions
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        reveal();
      } else if (e.code === "ArrowRight") {
        if (isRevealed) handleGrade(3, 200);
      } else if (e.code === "ArrowLeft") {
        if (isRevealed) handleGrade(1, -200);
      } else if (e.metaKey && e.code === "KeyZ") {
        undo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRevealed, reveal, undo]);

  const handleGrade = (rating: 1 | 3, xOffset: number) => {
    setExitX(xOffset);
    // Short delay for animation before processing next card
    setTimeout(() => {
      grade(rating);
      setExitX(0);
      x.set(0);
    }, 200);
  };

  const handleDragEnd = (_: any, info: any) => {
    if (!isRevealed) {
      x.set(0);
      return;
    }

    if (info.offset.x > 100) {
      handleGrade(3, 500);
    } else if (info.offset.x < -100) {
      handleGrade(1, -500);
    } else {
      x.set(0);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (isComplete || !currentCard) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-4 text-center bg-background">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-6 text-8xl"
        >
          🎉
        </motion.div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">All done for today!</h1>
        <p className="mb-8 max-w-xs text-muted-foreground">
          You've mastered your vocabulary for now. Come back tomorrow!
        </p>
        <Button onClick={() => router.push("/")} size="lg" className="rounded-full px-8">
          <Home className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background p-4">
      {/* Background feedback glow */}
      <motion.div 
        style={{ backgroundColor: background }}
        className="pointer-events-none absolute inset-0 transition-colors duration-300"
      />

      {/* Header */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/")}
          className="rounded-full bg-card/50 backdrop-blur"
        >
          <Home className="h-5 w-5" />
        </Button>

        <div className="flex flex-col items-center gap-1">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
            <motion.div
              initial={false}
              animate={{ width: `${(reviewedCount / totalCards) * 100}%` }}
              className="h-full bg-emerald-500"
            />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {reviewedCount} / {totalCards}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={!canUndo}
          className="rounded-full bg-card/50 backdrop-blur disabled:opacity-30"
        >
          <Undo2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Card Stack */}
      <div className="relative z-10 flex h-[450px] w-full max-w-lg items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.progress.id}
            drag={isRevealed ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            style={{ x, rotate, opacity }}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ x: exitX, opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            onDragEnd={handleDragEnd}
            onClick={() => !isRevealed && reveal()}
            className="w-full cursor-grab active:cursor-grabbing"
          >
            <ReviewCard card={currentCard} isRevealed={isRevealed} />
          </motion.div>
        </AnimatePresence>

        {/* Visual cues for swiping */}
        <AnimatePresence>
          {isRevealed && (
            <>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="absolute -left-12 top-1/2 -translate-y-1/2 rotate-[-90deg] text-xs font-bold uppercase tracking-[0.2em] text-red-500/40"
              >
                Forgot
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="absolute -right-12 top-1/2 -translate-y-1/2 rotate-[90deg] text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/40"
              >
                Got it
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Instructions / Controls Footer */}
      <div className="mt-12 flex flex-col items-center gap-4">
        {!isRevealed ? (
          <p className="text-sm text-muted-foreground animate-bounce">
            Tap the card to reveal
          </p>
        ) : (
          <div className="flex items-center gap-8 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            <span className="flex items-center gap-2">
              <kbd className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">←</kbd>
              Forgot
            </span>
            <span className="flex items-center gap-2">
              <kbd className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">→</kbd>
              Got it
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

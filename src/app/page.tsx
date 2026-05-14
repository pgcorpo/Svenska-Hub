"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useReviewSession } from "@/hooks/useReviewSession";
import { useSwipe } from "@/hooks/useSwipe";
import { ReviewCard } from "@/components/review/ReviewCard";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, Undo2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState("there");
  const [todayStats, setTodayStats] = useState<{ name: string; count: number }[]>([]);
  const [authLoading, setAuthLoading] = useState(true);

  const {
    currentCard,
    isRevealed,
    toggleReveal,
    navigate,
    grade,
    undo,
    canUndo,
    isComplete,
    isLoading,
    totalCards,
    reviewedCount,
  } = useReviewSession();

  // Card animation state
  const [exitClass, setExitClass] = useState("");
  const [cardKey, setCardKey] = useState(0);

  // ── Auth & Stats ──────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      setUserName(profile?.display_name || user.email?.split("@")[0] || "there");

      // Fetch today's review stats for all users
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name");

      if (profiles) {
        const stats = await Promise.all(
          profiles.map(async (p) => {
            const { count } = await supabase
              .from("card_progress")
              .select("*", { count: "exact", head: true })
              .eq("user_id", p.user_id)
              .gte("last_review", today.toISOString());
            return { name: p.display_name, count: count || 0 };
          })
        );
        setTodayStats(stats);
      }

      setAuthLoading(false);
    }
    init();
  }, []);

  // ── Grade with animation ──────────────────────────────────
  const gradeAndAnimate = useCallback(
    (direction: "left" | "right") => {
      if (!currentCard || !isRevealed) return;
      const rating = direction === "right" ? 3 : 1;
      setExitClass(direction === "right" ? "card-exit-right" : "card-exit-left");

      // Wait for CSS transition to finish, then grade
      setTimeout(() => {
        grade(rating as 1 | 3);
        setExitClass("");
        setCardKey((k) => k + 1);
      }, 300);
    },
    [currentCard, isRevealed, grade]
  );

  // ── Navigate with animation ───────────────────────────────
  const navigateCards = useCallback(
    (direction: "next" | "prev") => {
      if (!currentCard) return;
      setExitClass(direction === "next" ? "card-exit-up" : "card-exit-down");

      setTimeout(() => {
        navigate(direction);
        setExitClass("");
        setCardKey((k) => k + 1);
      }, 250);
    },
    [currentCard, navigate]
  );

  // ── Keyboard handler ──────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.code) {
        case "Space":
          e.preventDefault();
          toggleReveal();
          break;
        case "ArrowRight":
          if (isRevealed) gradeAndAnimate("right");
          break;
        case "ArrowLeft":
          if (isRevealed) gradeAndAnimate("left");
          break;
        case "ArrowUp":
          navigateCards("next");
          break;
        case "ArrowDown":
          navigateCards("prev");
          break;
        case "KeyZ":
          if (e.ctrlKey || e.metaKey) undo();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRevealed, toggleReveal, gradeAndAnimate, navigateCards, undo]);

  // ── Swipe handler ─────────────────────────────────────────
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => { if (isRevealed) gradeAndAnimate("left"); },
    onSwipeRight: () => { if (isRevealed) gradeAndAnimate("right"); },
    onSwipeUp: () => navigateCards("next"),
    onSwipeDown: () => navigateCards("prev"),
    threshold: 60,
  });

  // ── Sign out ──────────────────────────────────────────────
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  // ── Loading state ─────────────────────────────────────────
  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  // ── All caught up / empty state ───────────────────────────
  if (isComplete || !currentCard) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight">🇸🇪 Svenska Hub</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/add")}>
              <Plus className="mr-1 h-4 w-4" /> Add Words
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
          <div className="mb-6 text-7xl">🎉</div>
          <h2 className="mb-2 text-2xl font-bold tracking-tight">
            {totalCards === 0 ? "No words yet!" : "All caught up!"}
          </h2>
          <p className="mb-8 max-w-xs text-muted-foreground">
            {totalCards === 0
              ? "Add your first Swedish words to start learning."
              : `You've reviewed all ${reviewedCount} cards. Come back tomorrow!`}
          </p>
          <Button size="lg" onClick={() => router.push("/add")} className="rounded-full px-8">
            <Plus className="mr-2 h-4 w-4" /> Add Words
          </Button>
        </div>

        {/* Stats footer */}
        {todayStats.length > 0 && (
          <div className="border-t border-border/30 px-4 py-3 text-center text-xs text-muted-foreground">
            Today: {todayStats.map((s) => `${s.name} ${s.count}`).join(" · ")}
          </div>
        )}
      </div>
    );
  }

  // ── Main review interface ─────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Compact header */}
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <h1 className="text-base font-semibold tracking-tight text-muted-foreground">
          🇸🇪 Svenska Hub
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push("/add")}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {/* Progress */}
      <div className="flex flex-col items-center gap-1 px-4">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${totalCards > 0 ? (reviewedCount / totalCards) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {reviewedCount} / {totalCards}
        </span>
      </div>

      {/* Card area */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-4 py-6"
        {...swipeHandlers}
      >
        <div
          key={cardKey}
          className={`w-full max-w-lg transition-all duration-300 ${exitClass} ${!exitClass ? "card-enter" : ""}`}
          onClick={() => toggleReveal()}
        >
          <ReviewCard card={currentCard} isRevealed={isRevealed} />
        </div>
      </div>

      {/* Controls footer */}
      <div className="px-4 pb-4 text-center">
        {!isRevealed ? (
          <p className="text-sm text-muted-foreground">
            Tap card or press <kbd className="mx-1 rounded bg-secondary px-1.5 py-0.5 text-[10px]">Space</kbd> to flip
          </p>
        ) : (
          <div className="flex items-center justify-center gap-6 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">←</kbd> Forgot
            </span>
            <span className="flex items-center gap-1.5">
              Got it <kbd className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">→</kbd>
            </span>
          </div>
        )}

        {/* Stats line */}
        {todayStats.length > 0 && (
          <div className="mt-3 text-[10px] text-muted-foreground/40">
            Today: {todayStats.map((s) => `${s.name} ${s.count}`).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

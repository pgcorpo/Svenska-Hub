"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_DAILY_NEW_LIMIT,
  DEFAULT_DAILY_REVIEW_LIMIT,
} from "@/lib/constants";
import {
  createNewCardProgress,
  getNextStates,
  progressFromCard,
} from "@/lib/fsrs/scheduler";
import type {
  ReviewCard,
  ReviewSessionState,
  ReviewAction,
  CardProgress,
  PendingMutation,
  VocabularyWord,
} from "@/types";

const initialState: ReviewSessionState = {
  queue: [],
  currentIndex: 0,
  isRevealed: false,
  history: [],
  pendingMutations: [],
  isComplete: false,
  isLoading: true,
};

/**
 * Interleave new cards evenly among review cards so the learner isn't hit with
 * a wall of only new cards or only review cards. Learning/Relearning cards stay first.
 */
function buildOptimalQueue(
  learningCards: ReviewCard[],
  reviewCards: ReviewCard[],
  newCards: ReviewCard[]
): ReviewCard[] {
  if (reviewCards.length === 0) {
    return [...learningCards, ...newCards];
  }
  if (newCards.length === 0) {
    return [...learningCards, ...reviewCards];
  }

  const interleaved: ReviewCard[] = [];
  const ratio = Math.max(1, Math.floor(reviewCards.length / newCards.length));
  let rIdx = 0;
  let nIdx = 0;

  while (rIdx < reviewCards.length || nIdx < newCards.length) {
    for (let i = 0; i < ratio && rIdx < reviewCards.length; i++) {
      interleaved.push(reviewCards[rIdx++]);
    }
    if (nIdx < newCards.length) {
      interleaved.push(newCards[nIdx++]);
    }
  }

  return [...learningCards, ...interleaved];
}

function mapProgressRow(row: Record<string, unknown>): ReviewCard {
  return {
    progress: {
      id: row.id,
      user_id: row.user_id,
      word_id: row.word_id,
      due_date: row.due_date,
      stability: row.stability,
      difficulty: row.difficulty,
      elapsed_days: row.elapsed_days,
      scheduled_days: row.scheduled_days,
      reps: row.reps,
      lapses: row.lapses,
      state: row.state,
      last_review: row.last_review,
      created_at: row.created_at,
    } as CardProgress,
    word: row.vocabulary as VocabularyWord,
  };
}

function reviewReducer(
  state: ReviewSessionState,
  action: ReviewAction
): ReviewSessionState {
  switch (action.type) {
    case "SET_QUEUE":
      return {
        ...state,
        queue: action.queue,
        isLoading: false,
        isComplete: action.queue.length === 0,
      };

    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };

    case "REVEAL":
      return { ...state, isRevealed: true };

    case "TOGGLE_REVEAL":
      return { ...state, isRevealed: !state.isRevealed };

    case "NAVIGATE": {
      const newIndex =
        action.direction === "next"
          ? Math.min(state.currentIndex + 1, state.queue.length - 1)
          : Math.max(state.currentIndex - 1, 0);
      if (newIndex === state.currentIndex) return state;
      return { ...state, currentIndex: newIndex, isRevealed: false };
    }

    case "UPDATE_WORD": {
      const updatedQueue = state.queue.map((item) =>
        item.word.id === action.word.id
          ? { ...item, word: action.word }
          : item
      );
      return { ...state, queue: updatedQueue };
    }

    case "GRADE": {
      const currentCard = state.queue[state.currentIndex];
      if (!currentCard) return state;

      const updatedCard: ReviewCard = {
        ...currentCard,
        progress: action.newProgress,
      };

      // Update the card in the queue with new progress
      const updatedQueue = [...state.queue];
      updatedQueue[state.currentIndex] = updatedCard;

      // Re-queue failed ("Forgot" / rating 1) cards at the end of the session
      // so the learner reinforces them before finishing
      const shouldRequeue = action.rating === 1;
      if (shouldRequeue) {
        updatedQueue.push(updatedCard);
      }

      // Save previous state for undo
      const historyEntry = {
        card: currentCard,
        previousProgress: { ...currentCard.progress },
        wasRequeued: shouldRequeue,
      };

      // Create pending mutation
      const mutation: PendingMutation = {
        id: `${currentCard.progress.id}-${Date.now()}-${Math.random()}`,
        progressId: currentCard.progress.id,
        wordId: currentCard.word.id,
        updates: {
          due_date: action.newProgress.due_date,
          stability: action.newProgress.stability,
          difficulty: action.newProgress.difficulty,
          elapsed_days: action.newProgress.elapsed_days,
          scheduled_days: action.newProgress.scheduled_days,
          reps: action.newProgress.reps,
          lapses: action.newProgress.lapses,
          state: action.newProgress.state,
          last_review: action.newProgress.last_review,
        },
      };

      const nextIndex = state.currentIndex + 1;

      return {
        ...state,
        queue: updatedQueue,
        currentIndex: nextIndex,
        isRevealed: false,
        history: [...state.history, historyEntry],
        pendingMutations: [...state.pendingMutations, mutation],
        isComplete: nextIndex >= updatedQueue.length,
      };
    }

    case "UNDO": {
      if (state.history.length === 0) return state;

      const lastEntry = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, -1);

      // Revert the card in the queue (and pop requeued copy if it was added)
      const baseQueue = lastEntry.wasRequeued
        ? state.queue.slice(0, -1)
        : [...state.queue];
      const prevIndex = state.currentIndex - 1;
      baseQueue[prevIndex] = {
        ...lastEntry.card,
        progress: lastEntry.previousProgress,
      };

      // Enqueue a compensating mutation so Undo is persisted to Supabase
      // even if the original grade mutation already finished syncing
      const revertMutation: PendingMutation = {
        id: `${lastEntry.card.progress.id}-undo-${Date.now()}-${Math.random()}`,
        progressId: lastEntry.card.progress.id,
        wordId: lastEntry.card.word.id,
        updates: {
          due_date: lastEntry.previousProgress.due_date,
          stability: lastEntry.previousProgress.stability,
          difficulty: lastEntry.previousProgress.difficulty,
          elapsed_days: lastEntry.previousProgress.elapsed_days,
          scheduled_days: lastEntry.previousProgress.scheduled_days,
          reps: lastEntry.previousProgress.reps,
          lapses: lastEntry.previousProgress.lapses,
          state: lastEntry.previousProgress.state,
          last_review: lastEntry.previousProgress.last_review,
        },
      };

      return {
        ...state,
        queue: baseQueue,
        currentIndex: prevIndex,
        isRevealed: false,
        history: newHistory,
        pendingMutations: [...state.pendingMutations, revertMutation],
        isComplete: false,
      };
    }

    case "MUTATION_SYNCED": {
      return {
        ...state,
        pendingMutations: state.pendingMutations.filter(
          (m) => m.id !== action.mutationId
        ),
      };
    }

    default:
      return state;
  }
}

export function useReviewSession() {
  const [state, dispatch] = useReducer(reviewReducer, initialState);
  const supabaseRef = useRef(createClient());
  const syncingRef = useRef(false);

  // Fetch due & daily new cards on mount
  const fetchCards = useCallback(async () => {
    dispatch({ type: "SET_LOADING", isLoading: true });
    const supabase = supabaseRef.current;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Load user's daily limits from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_new_limit, daily_review_limit")
      .eq("user_id", user.id)
      .single();

    const dailyNewLimit = profile?.daily_new_limit ?? DEFAULT_DAILY_NEW_LIMIT;
    const dailyReviewLimit =
      profile?.daily_review_limit ?? DEFAULT_DAILY_REVIEW_LIMIT;

    // 2. Backfill missing card_progress rows if vocabulary has words without progress
    const [{ count: vocabCount }, { count: progCount }] = await Promise.all([
      supabase.from("vocabulary").select("id", { count: "exact", head: true }),
      supabase
        .from("card_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    if (
      vocabCount != null &&
      progCount != null &&
      vocabCount > progCount
    ) {
      const { data: progRows } = await supabase
        .from("card_progress")
        .select("word_id")
        .eq("user_id", user.id);

      const have = new Set((progRows ?? []).map((r) => r.word_id));
      const { data: vocabRows } = await supabase
        .from("vocabulary")
        .select("id")
        .limit(2000);

      const missing = (vocabRows ?? [])
        .map((r) => r.id)
        .filter((id) => !have.has(id));

      const chunk = 100;
      for (let i = 0; i < missing.length; i += chunk) {
        const rows = missing
          .slice(i, i + chunk)
          .map((wordId) => createNewCardProgress(user.id, wordId));
        const { error: insertErr } = await supabase
          .from("card_progress")
          .insert(rows);
        if (insertErr) {
          console.error("card_progress backfill failed:", insertErr);
          break;
        }
      }
    }

    const now = new Date().toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    // 3. Count how many new cards vs review cards were already studied today
    const [{ count: newStudiedToday }, { count: reviewsDoneToday }] =
      await Promise.all([
        supabase
          .from("card_progress")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("last_review", todayIso)
          .eq("elapsed_days", 0),
        supabase
          .from("card_progress")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("last_review", todayIso)
          .gt("elapsed_days", 0),
      ]);

    const remainingNew = Math.max(0, dailyNewLimit - (newStudiedToday ?? 0));
    const remainingReviews = Math.max(
      0,
      dailyReviewLimit - (reviewsDoneToday ?? 0)
    );

    // 4. Fetch the 3 SRS buckets in parallel:
    //    (a) Learning / Relearning cards due now (state 1 or 3)
    //    (b) Review cards due now (state 2), up to remainingReviews
    //    (c) New cards (state 0), newest-first, up to remainingNew
    const [learningRes, reviewRes, newRes] = await Promise.all([
      supabase
        .from("card_progress")
        .select("*, vocabulary(*)")
        .eq("user_id", user.id)
        .in("state", [1, 3])
        .lte("due_date", now)
        .order("due_date", { ascending: true }),
      remainingReviews > 0
        ? supabase
            .from("card_progress")
            .select("*, vocabulary(*)")
            .eq("user_id", user.id)
            .eq("state", 2)
            .lte("due_date", now)
            .order("due_date", { ascending: true })
            .limit(remainingReviews)
        : Promise.resolve({ data: [], error: null }),
      remainingNew > 0
        ? supabase
            .from("card_progress")
            .select("*, vocabulary(*)")
            .eq("user_id", user.id)
            .eq("state", 0)
            .order("created_at", { ascending: false })
            .limit(remainingNew)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (learningRes.error || reviewRes.error || newRes.error) {
      console.error(
        "Failed to fetch cards:",
        learningRes.error || reviewRes.error || newRes.error
      );
      dispatch({ type: "SET_QUEUE", queue: [] });
      return;
    }

    const learningCards = (learningRes.data || [])
      .filter((row: Record<string, unknown>) => row.vocabulary)
      .map(mapProgressRow);

    const reviewCards = (reviewRes.data || [])
      .filter((row: Record<string, unknown>) => row.vocabulary)
      .map(mapProgressRow);

    const newCards = (newRes.data || [])
      .filter((row: Record<string, unknown>) => row.vocabulary)
      .map(mapProgressRow);

    const queue = buildOptimalQueue(learningCards, reviewCards, newCards);
    dispatch({ type: "SET_QUEUE", queue });
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Background sync: flush pending mutations to Supabase
  useEffect(() => {
    if (state.pendingMutations.length === 0 || syncingRef.current) return;

    syncingRef.current = true;
    const mutation = state.pendingMutations[0];
    const supabase = supabaseRef.current;

    supabase
      .from("card_progress")
      .update(mutation.updates)
      .eq("id", mutation.progressId)
      .then(({ error }) => {
        if (error) {
          console.error("Sync failed:", error);
        }
        dispatch({ type: "MUTATION_SYNCED", mutationId: mutation.id });
        syncingRef.current = false;
      });
  }, [state.pendingMutations]);

  // Actions
  const reveal = useCallback(() => {
    dispatch({ type: "REVEAL" });
  }, []);

  const toggleReveal = useCallback(() => {
    dispatch({ type: "TOGGLE_REVEAL" });
  }, []);

  const navigate = useCallback((direction: "next" | "prev") => {
    dispatch({ type: "NAVIGATE", direction });
  }, []);

  const updateWord = useCallback((word: VocabularyWord) => {
    dispatch({ type: "UPDATE_WORD", word });
  }, []);

  // Binary FSRS grading: 1 = Forgot (Again), 4 = Got it (Easy)
  const grade = useCallback(
    (rating: 1 | 4) => {
      const currentCard = state.queue[state.currentIndex];
      if (!currentCard) return;

      const nextStates = getNextStates(currentCard.progress);
      const result = nextStates[rating];
      const newCard = result.card;

      const newProgress: CardProgress = {
        ...currentCard.progress,
        ...progressFromCard(newCard),
      };

      dispatch({ type: "GRADE", rating, newProgress });
    },
    [state.queue, state.currentIndex]
  );

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const currentCard =
    state.currentIndex < state.queue.length
      ? state.queue[state.currentIndex]
      : null;

  return {
    ...state,
    currentCard,
    reveal,
    toggleReveal,
    navigate,
    updateWord,
    grade,
    undo,
    totalCards: state.queue.length,
    reviewedCount: state.currentIndex,
    canUndo: state.history.length > 0,
  };
}

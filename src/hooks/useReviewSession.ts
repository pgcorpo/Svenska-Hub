"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { createNewCardProgress, getNextStates, progressFromCard } from "@/lib/fsrs/scheduler";
import type {
  ReviewCard,
  ReviewSessionState,
  ReviewAction,
  CardProgress,
  PendingMutation,
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
      const newIndex = action.direction === "next"
        ? Math.min(state.currentIndex + 1, state.queue.length - 1)
        : Math.max(state.currentIndex - 1, 0);
      if (newIndex === state.currentIndex) return state;
      return { ...state, currentIndex: newIndex, isRevealed: false };
    }

    case "GRADE": {
      const currentCard = state.queue[state.currentIndex];
      if (!currentCard) return state;

      // Save previous state for undo
      const historyEntry = {
        card: currentCard,
        previousProgress: { ...currentCard.progress },
      };

      // Update the card in the queue with new progress
      const updatedQueue = [...state.queue];
      updatedQueue[state.currentIndex] = {
        ...currentCard,
        progress: action.newProgress,
      };

      // Create pending mutation
      const mutation: PendingMutation = {
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
        isComplete: nextIndex >= state.queue.length,
      };
    }

    case "UNDO": {
      if (state.history.length === 0) return state;

      const lastEntry = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, -1);

      // Revert the card in the queue
      const revertedQueue = [...state.queue];
      const prevIndex = state.currentIndex - 1;
      revertedQueue[prevIndex] = {
        ...lastEntry.card,
        progress: lastEntry.previousProgress,
      };

      // Remove the last pending mutation
      const newPending = state.pendingMutations.slice(0, -1);

      return {
        ...state,
        queue: revertedQueue,
        currentIndex: prevIndex,
        isRevealed: false,
        history: newHistory,
        pendingMutations: newPending,
        isComplete: false,
      };
    }

    case "MUTATION_SYNCED": {
      return {
        ...state,
        pendingMutations: state.pendingMutations.filter(
          (m) => m.progressId !== action.progressId
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

  // Fetch due cards on mount
  const fetchCards = useCallback(async () => {
    dispatch({ type: "SET_LOADING", isLoading: true });
    const supabase = supabaseRef.current;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // New accounts have no card_progress for words added before they existed; review reads only card_progress.
    const { count: vocabCount, error: vocabCountErr } = await supabase
      .from("vocabulary")
      .select("*", { count: "exact", head: true });
    const { count: progCount, error: progCountErr } = await supabase
      .from("card_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (
      !vocabCountErr &&
      !progCountErr &&
      vocabCount != null &&
      progCount != null &&
      vocabCount > progCount
    ) {
      const { data: progRows, error: progErr } = await supabase
        .from("card_progress")
        .select("word_id")
        .eq("user_id", user.id);
      if (progErr) {
        /* fall through to due fetch */
      } else {
        const have = new Set((progRows ?? []).map((r) => r.word_id));
        const allVocabIds: string[] = [];
        const pageSize = 1000;
        for (let from = 0; ; from += pageSize) {
          const { data: page, error: pageErr } = await supabase
            .from("vocabulary")
            .select("id")
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);
          if (pageErr || !page?.length) break;
          allVocabIds.push(...page.map((r) => r.id));
          if (page.length < pageSize) break;
        }
        const missing = allVocabIds.filter((id) => !have.has(id));
        const chunk = 100;
        for (let i = 0; i < missing.length; i += chunk) {
          const rows = missing
            .slice(i, i + chunk)
            .map((wordId) => createNewCardProgress(user.id, wordId));
          const { error: insertErr } = await supabase.from("card_progress").insert(rows);
          if (insertErr) {
            console.error("card_progress backfill failed:", insertErr);
            break;
          }
        }
      }
    }

    const now = new Date().toISOString();

    // Fetch due cards with vocabulary data
    const { data: progressRows, error } = await supabase
      .from("card_progress")
      .select("*, vocabulary(*)")
      .eq("user_id", user.id)
      .lte("due_date", now)
      .order("due_date", { ascending: true })
      .limit(120); // 20 new + 100 review max

    if (error) {
      console.error("Failed to fetch cards:", error);
      dispatch({ type: "SET_QUEUE", queue: [] });
      return;
    }

    const cards: ReviewCard[] = (progressRows || [])
      .filter((row: Record<string, unknown>) => row.vocabulary)
      .map((row: Record<string, unknown>) => ({
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
        word: row.vocabulary as import("@/types").VocabularyWord,
      }));

    dispatch({ type: "SET_QUEUE", queue: cards });
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
        dispatch({ type: "MUTATION_SYNCED", progressId: mutation.progressId });
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

  const grade = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
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
    grade,
    undo,
    totalCards: state.queue.length,
    reviewedCount: state.currentIndex,
    canUndo: state.history.length > 0,
  };
}

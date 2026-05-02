// ============================================================
// FSRS Scheduler Wrapper
// Thin wrapper around ts-fsrs for type safety and testability
// ============================================================

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type RecordLogItem,
} from "ts-fsrs";
import type { CardProgress } from "@/types";

const params = generatorParameters({ enable_fuzz: true });
const scheduler = fsrs(params);

/**
 * Convert a CardProgress DB row into a ts-fsrs Card object.
 */
export function cardFromProgress(progress: CardProgress): Card {
  const card = createEmptyCard();
  card.due = new Date(progress.due_date);
  card.stability = progress.stability;
  card.difficulty = progress.difficulty;
  card.elapsed_days = progress.elapsed_days;
  card.scheduled_days = progress.scheduled_days;
  card.reps = progress.reps;
  card.lapses = progress.lapses;
  card.state = progress.state;
  card.last_review = progress.last_review ? new Date(progress.last_review) : undefined;
  return card;
}

/**
 * Convert a ts-fsrs Card back to partial CardProgress fields for DB update.
 */
export function progressFromCard(
  card: Card
): Omit<CardProgress, "id" | "user_id" | "word_id" | "created_at"> {
  return {
    due_date: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review
      ? card.last_review.toISOString()
      : null,
  };
}

/**
 * Get all 4 possible next states for a card (Again, Hard, Good, Easy).
 * Returns the scheduling result for each rating.
 */
export function getNextStates(progress: CardProgress): Record<1 | 2 | 3 | 4, RecordLogItem> {
  const card = cardFromProgress(progress);
  const now = new Date();
  const result = scheduler.repeat(card, now);

  return {
    1: result[Rating.Again],
    2: result[Rating.Hard],
    3: result[Rating.Good],
    4: result[Rating.Easy],
  };
}

/**
 * Format a time interval in days to a human-readable string.
 * Examples: "1m" (1 minute), "10m", "1d", "4d", "2.1mo", "1.2y"
 */
export function formatInterval(scheduledDays: number): string {
  if (scheduledDays < 1 / 1440) {
    return "<1m";
  }

  const totalMinutes = scheduledDays * 24 * 60;

  if (totalMinutes < 60) {
    return `${Math.round(totalMinutes)}m`;
  }

  const totalHours = totalMinutes / 60;
  if (totalHours < 24) {
    return `${Math.round(totalHours)}h`;
  }

  if (scheduledDays < 30) {
    return `${Math.round(scheduledDays)}d`;
  }

  const months = scheduledDays / 30;
  if (months < 12) {
    return months >= 10 ? `${Math.round(months)}mo` : `${months.toFixed(1)}mo`;
  }

  const years = scheduledDays / 365;
  return years >= 10 ? `${Math.round(years)}y` : `${years.toFixed(1)}y`;
}

/**
 * Create a fresh "New" card progress entry for a user + word.
 */
export function createNewCardProgress(
  userId: string,
  wordId: string
): Omit<CardProgress, "id" | "created_at"> {
  const card = createEmptyCard();
  return {
    user_id: userId,
    word_id: wordId,
    due_date: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: null,
  };
}

export { Rating };

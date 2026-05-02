// ============================================================
// Svenska Hub — Shared TypeScript Types
// ============================================================

import type { State } from "ts-fsrs";

// --- Database Row Types ---

export interface Profile {
  user_id: string;
  display_name: string;
  daily_new_limit: number;
  daily_review_limit: number;
  created_at: string;
}

export interface VocabularyWord {
  id: string;
  swedish_word: string;
  english_meaning: string;
  gender: "en" | "ett" | "n/a";
  grammar_forms: GrammarForms;
  example_sv: string | null;
  example_en: string | null;
  added_by: string | null;
  created_at: string;
}

export interface GrammarForms {
  definite_singular?: string;
  indefinite_plural?: string;
}

export interface CardProgress {
  id: string;
  user_id: string;
  word_id: string;
  due_date: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State;
  last_review: string | null;
  created_at: string;
}


// --- Joined types for the review screen ---

export interface ReviewCard {
  progress: CardProgress;
  word: VocabularyWord;
}

// --- Gemini ingest response ---

export interface GeminiIngestResult {
  swedish_word: string;
  english_meaning: string;
  gender: "en" | "ett" | "n/a";
  grammar_forms: GrammarForms;
  example_sv: string;
  example_en: string;
}

// --- Ingest API request ---

export interface IngestRequest {
  raw_text: string;
}

// --- Review session state ---

export interface ReviewSessionState {
  queue: ReviewCard[];
  currentIndex: number;
  isRevealed: boolean;
  history: HistoryEntry[];
  pendingMutations: PendingMutation[];
  isComplete: boolean;
  isLoading: boolean;
}

export interface HistoryEntry {
  card: ReviewCard;
  previousProgress: CardProgress;
}

export interface PendingMutation {
  progressId: string;
  wordId: string;
  updates: Partial<CardProgress>;
}

// --- Review session actions ---

export type ReviewAction =
  | { type: "SET_QUEUE"; queue: ReviewCard[] }
  | { type: "REVEAL" }
  | { type: "GRADE"; rating: 1 | 2 | 3 | 4; newProgress: CardProgress }
  | { type: "UNDO" }
  | { type: "MUTATION_SYNCED"; progressId: string }
  | { type: "SET_LOADING"; isLoading: boolean };

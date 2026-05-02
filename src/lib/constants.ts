// ============================================================
// App Constants
// ============================================================

export const APP_NAME = "Svenska Hub";
export const APP_DESCRIPTION = "Learn Swedish together with AI-powered flashcards";

// Daily limits (defaults, also stored per-user in profiles)
export const DEFAULT_DAILY_NEW_LIMIT = 20;
export const DEFAULT_DAILY_REVIEW_LIMIT = 100;

// Rating labels and colors
export const RATING_CONFIG = {
  1: { label: "Again", shortcut: "1", color: "text-red-400", bgColor: "bg-red-500/10 hover:bg-red-500/20 border-red-500/30" },
  2: { label: "Hard", shortcut: "2", color: "text-orange-400", bgColor: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30" },
  3: { label: "Good", shortcut: "3", color: "text-blue-400", bgColor: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30" },
  4: { label: "Easy", shortcut: "4", color: "text-emerald-400", bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30" },
} as const;

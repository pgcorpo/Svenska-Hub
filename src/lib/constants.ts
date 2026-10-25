// ============================================================
// App Constants
// ============================================================

export const APP_NAME = "Svenska Hub";
export const APP_DESCRIPTION = "Learn Swedish together with AI-powered flashcards";

// Daily limits (defaults, also stored per-user in profiles)
export const DEFAULT_DAILY_NEW_LIMIT = 20;
export const DEFAULT_DAILY_REVIEW_LIMIT = 100;

// Gemini model options (dynamic selection + fallback order)
export const GEMINI_MODELS = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Recommended)",
    description: "Fast & great at complex B1/B2 Swedish sentences",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Highest linguistic nuance & idiomatic quality",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
    description: "Latest preview Flash model",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    description: "Ultra-fast & lightweight",
  },
] as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[number]["id"];

export const DEFAULT_GEMINI_MODEL: GeminiModelId = "gemini-2.5-flash";

export const STORAGE_KEYS = {
  GEMINI_MODEL: "svenska_hub_gemini_model",
  GEMINI_API_KEY: "svenska_hub_gemini_api_key",
} as const;

// Rating labels and colors (Binary grading uses 1 = Forgot/Again and 4 = Got it/Easy)
export const RATING_CONFIG = {
  1: { label: "Forgot", shortcut: "← / 1", color: "text-red-400", bgColor: "bg-red-500/10 hover:bg-red-500/20 border-red-500/30" },
  4: { label: "Got it", shortcut: "→ / 4", color: "text-emerald-400", bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30" },
} as const;

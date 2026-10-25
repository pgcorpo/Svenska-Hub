"use client";

import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS,
  STORAGE_KEYS,
  type GeminiModelId,
} from "@/lib/constants";
import type { VocabularyWord } from "@/types";

export function getSelectedGeminiModel(): GeminiModelId {
  if (typeof window === "undefined") return DEFAULT_GEMINI_MODEL;
  const saved = window.localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL);
  if (saved && GEMINI_MODELS.some((m) => m.id === saved)) {
    return saved as GeminiModelId;
  }
  return DEFAULT_GEMINI_MODEL;
}

export function setSelectedGeminiModel(model: GeminiModelId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, model);
}

export function getCustomGeminiApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || "";
}

export function setCustomGeminiApiKey(key: string): void {
  if (typeof window === "undefined") return;
  const trimmed = key.trim();
  if (trimmed) {
    window.localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, trimmed);
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.GEMINI_API_KEY);
  }
}

export function buildAiRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const customKey = getCustomGeminiApiKey();
  if (customKey) {
    headers["x-gemini-api-key"] = customKey;
  }
  return headers;
}

export async function enrichWordWithAi(
  wordId: string,
  swedishWord: string,
  englishMeaning?: string
): Promise<{ word: VocabularyWord; model_used?: string }> {
  const res = await fetch(`/api/vocabulary/${wordId}/enrich`, {
    method: "POST",
    headers: buildAiRequestHeaders(),
    body: JSON.stringify({
      swedish_word: swedishWord,
      english_meaning: englishMeaning || "",
      model: getSelectedGeminiModel(),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.word) {
    throw new Error(data.error || "Failed to generate example with AI");
  }

  return {
    word: data.word as VocabularyWord,
    model_used: data.model_used,
  };
}

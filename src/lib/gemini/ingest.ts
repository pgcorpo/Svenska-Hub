// ============================================================
// Gemini Ingest — Extract Swedish vocabulary & generate complex
// B1/B2 Swedish example sentences with dynamic model support
// ============================================================

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS, type GeminiModelId } from "@/lib/constants";
import type { GeminiIngestResult } from "@/types";

const ALLOWED_MODEL_IDS = new Set<string>(GEMINI_MODELS.map((m) => m.id));

export interface ExtractVocabularyOptions {
  englishHint?: string;
  model?: string;
  apiKey?: string;
}

const responseSchema: import("@google/generative-ai").ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    swedish_word: {
      type: SchemaType.STRING,
      description: "The Swedish word in its base/dictionary form",
    },
    english_meaning: {
      type: SchemaType.STRING,
      description: "The clear, natural English translation of the word",
    },
    gender: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["en", "ett", "n/a"],
      description:
        "The grammatical gender: 'en' for common, 'ett' for neuter, 'n/a' for non-nouns",
    },
    grammar_forms: {
      type: SchemaType.OBJECT,
      properties: {
        definite_singular: {
          type: SchemaType.STRING,
          description:
            "For nouns: definite singular form (e.g., huset for hus). For verbs: present tense (e.g., springer). For adjectives: neuter/ett-form.",
        },
        indefinite_plural: {
          type: SchemaType.STRING,
          description:
            "For nouns: indefinite plural form (e.g., hus for hus, bilar for bil). For verbs: past/preteritum + supine (e.g., sprang / sprungit). For adjectives: plural/definite form.",
        },
      },
      required: ["definite_singular", "indefinite_plural"],
    },
    example_sv: {
      type: SchemaType.STRING,
      description:
        "One natural Swedish sentence of 8–12 words that uses the word in a multi-clause structure with a subordinating conjunction and authentic word order. Keep it concise and set in everyday or cultural context. Do not write long or nested sentences.",
    },
    example_en: {
      type: SchemaType.STRING,
      description:
        "A natural English translation of the example sentence (similar length).",
    },
  },
  required: [
    "swedish_word",
    "english_meaning",
    "gender",
    "grammar_forms",
    "example_sv",
    "example_en",
  ],
};

const systemPrompt = `You are an expert Swedish language teacher and linguist. You receive either a Swedish word (optionally with an English meaning hint) or OCR text from a photographed sticky note.

Your task:
1. Extract the Swedish word in its base/dictionary form (indefinite singular for nouns, infinitive for verbs, base form for adjectives).
2. Provide the accurate English meaning (if an English hint is provided, preserve/refine that sense of the word).
3. Identify the grammatical gender:
   - "en" for common gender nouns (en-words)
   - "ett" for neuter gender nouns (ett-words)
   - "n/a" for verbs, adjectives, adverbs, phrases, and other non-nouns
4. Provide helpful grammar_forms:
   - For nouns: definite_singular (e.g., "bilen") and indefinite_plural (e.g., "bilar").
   - For verbs: definite_singular = present tense (e.g., "springer"), indefinite_plural = preteritum & supinum (e.g., "sprang, sprungit").
   - For adjectives: definite_singular = ett-form (e.g., "stort"), indefinite_plural = plural/definite form (e.g., "stora").
5. Create a **complex, natural B1/B2-level Swedish example sentence** (example_sv) and its English translation (example_en):
   - Do NOT write trivial A1 sentences like "Jag ser en hund."
   - Write a realistic, multi-clause sentence (8-12 words) that uses subordinating conjunctions, authentic Swedish word order, and rich everyday or cultural context so the learner sees how the word actually behaves in real Swedish.`;

export function resolveModelCascade(preferredModel?: string): GeminiModelId[] {
  const envModel = process.env.GEMINI_MODEL?.trim();
  const primary =
    (preferredModel && ALLOWED_MODEL_IDS.has(preferredModel)
      ? (preferredModel as GeminiModelId)
      : undefined) ||
    (envModel && ALLOWED_MODEL_IDS.has(envModel)
      ? (envModel as GeminiModelId)
      : undefined) ||
    DEFAULT_GEMINI_MODEL;

  const fallbacks = GEMINI_MODELS.map((m) => m.id).filter((id) => id !== primary);
  return [primary, ...fallbacks];
}

export async function extractVocabulary(
  rawText: string,
  options: ExtractVocabularyOptions = {}
): Promise<GeminiIngestResult & { model_used?: string }> {
  const resolvedApiKey = options.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!resolvedApiKey) {
    throw new Error(
      "Missing Gemini API key. Set GEMINI_API_KEY in .env.local or configure your API key in the app settings."
    );
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const modelsToTry = resolveModelCascade(options.model);

  const promptParts = [
    `Extract the Swedish vocabulary and generate a complex B1/B2 Swedish example sentence from this input:\n\nSwedish word / OCR text: ${rawText}`,
  ];
  if (options.englishHint?.trim()) {
    promptParts.push(`Intended English meaning hint: ${options.englishHint.trim()}`);
  }
  const userPrompt = promptParts.join("\n");

  let lastError: unknown = null;

  for (const modelId of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(userPrompt);
      const text = result.response.text();
      const parsed = JSON.parse(text) as GeminiIngestResult;

      if (!parsed.swedish_word || !parsed.english_meaning) {
        throw new Error("Gemini returned incomplete data");
      }

      return { ...parsed, model_used: modelId };
    } catch (err) {
      console.warn(`Gemini model ${modelId} failed, trying fallback if available:`, err);
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All configured Gemini models failed to extract vocabulary");
}

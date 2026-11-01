// ============================================================
// Gemini Ingest — Extract Swedish vocabulary & generate complex
// B1/B2 Swedish example sentences with dynamic model support
// ============================================================

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS, type GeminiModelId } from "@/lib/constants";
import type { GeminiIngestResult, GrammarForms } from "@/types";

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
      description:
        "The Swedish study term. Preserve the full input verbatim without trimming, extracting a sub-phrase, or reducing it to a single component.",
    },
    english_meaning: {
      type: SchemaType.STRING,
      description: "The clear, natural English translation of the entire word, phrase, or sentence",
    },
    gender: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["en", "ett", "n/a"],
      description:
        "The grammatical gender: 'en' for common, 'ett' for neuter, 'n/a' for non-nouns and for phrases/expressions",
    },
    grammar_forms: {
      type: SchemaType.OBJECT,
      properties: {
        definite_singular: {
          type: SchemaType.STRING,
          description:
            "For nouns: definite singular form (e.g., huset for hus). For verbs: present tense (e.g., springer). For adjectives: neuter/ett-form. Omit for phrases and expressions.",
        },
        indefinite_plural: {
          type: SchemaType.STRING,
          description:
            "For nouns: indefinite plural form (e.g., hus for hus, bilar for bil). For verbs: past/preteritum + supine (e.g., sprang / sprungit). For adjectives: plural/definite form. Omit for phrases and expressions.",
        },
      },
    },
    example_sv: {
      type: SchemaType.STRING,
      description:
        "One natural Swedish sentence of 8–12 words that uses the word in a multi-clause structure with a subordinating conjunction and authentic word order. Keep it concise and set in everyday or cultural context. Do not write long or nested sentences. For phrases, include the phrase verbatim.",
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

const systemPrompt = `You are an expert Swedish language teacher and linguist. You receive a Swedish word, phrase, idiom, or sentence.

Your task:
1. Determine the Swedish study term:
   - If the input is a multi-word phrase, idiom, or sentence, keep the entire input verbatim as swedish_word. Never shorten, trim, extract a sub-phrase, or reduce it to a single component or root word.
   - Only convert to base/dictionary form (indefinite singular for nouns, infinitive for verbs) if the input is a single standalone word or messy multi-line OCR scan.
2. Provide the accurate English meaning of the full term/phrase/sentence (if an English hint is provided, preserve/refine that sense).
3. Identify grammatical gender: "en", "ett", or "n/a" (for non-nouns, phrases, and sentences).
4. Provide helpful grammar_forms:
   - For single nouns: definite_singular and indefinite_plural.
   - For single verbs: definite_singular (present) and indefinite_plural (preterite & supine).
   - For single adjectives: definite_singular (ett-form) and indefinite_plural (plural/definite form).
   - For phrases, idioms, and sentences: return an empty grammar_forms object.
5. Create a **complex, natural B1/B2-level Swedish example sentence** (example_sv) and English translation (example_en):
   - Realistic multi-clause sentence (8-12 words) using subordinating conjunctions and authentic Swedish word order.
   - Incorporate the term/phrase naturally.`;

/**
 * Drop empty/placeholder grammar fields (e.g. for phrases) so the card hides them.
 */
function cleanGrammarForms(
  forms?: GrammarForms | null,
  swedishWord?: string
): GrammarForms {
  const isPlaceholder = (val?: string) => {
    if (!val) return true;
    const v = val.trim().toLowerCase();
    if (!v || v === "n/a" || v === "-" || v === "none") return true;
    // If it's a multi-word phrase and Gemini just repeated the phrase, drop it
    if (
      swedishWord &&
      swedishWord.trim().includes(" ") &&
      v === swedishWord.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  const definite = forms?.definite_singular?.trim();
  const plural = forms?.indefinite_plural?.trim();
  return {
    ...(!isPlaceholder(definite) ? { definite_singular: definite } : {}),
    ...(!isPlaceholder(plural) ? { indefinite_plural: plural } : {}),
  };
}

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
    `Process this Swedish study term (word, phrase, idiom, or sentence) and generate a complex B1/B2 Swedish example sentence for it:\n\nInput: ${rawText}`,
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

      return {
        ...parsed,
        grammar_forms: cleanGrammarForms(
          parsed.grammar_forms,
          parsed.swedish_word
        ),
        model_used: modelId,
      };
    } catch (err) {
      console.warn(`Gemini model ${modelId} failed, trying fallback if available:`, err);
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All configured Gemini models failed to extract vocabulary");
}

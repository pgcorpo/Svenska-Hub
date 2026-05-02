// ============================================================
// Gemini Ingest — Extract Swedish vocabulary from raw OCR text
// ============================================================

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { GeminiIngestResult } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const responseSchema: import("@google/generative-ai").ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    swedish_word: { type: SchemaType.STRING, description: "The Swedish word in its base/dictionary form" },
    english_meaning: { type: SchemaType.STRING, description: "The English translation" },
    gender: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["en", "ett", "n/a"],
      description: "The grammatical gender: 'en' for common, 'ett' for neuter, 'n/a' for non-nouns",
    },
    grammar_forms: {
      type: SchemaType.OBJECT,
      properties: {
        definite_singular: { type: SchemaType.STRING, description: "The definite singular form (e.g., huset for hus)" },
        indefinite_plural: { type: SchemaType.STRING, description: "The indefinite plural form (e.g., hus for hus)" },
      },
      required: ["definite_singular", "indefinite_plural"],
    },
    example_sv: { type: SchemaType.STRING, description: "An A1-level Swedish example sentence using the word" },
    example_en: { type: SchemaType.STRING, description: "The English translation of the example sentence" },
  },
  required: ["swedish_word", "english_meaning", "gender", "grammar_forms", "example_sv", "example_en"],
};

const systemPrompt = `You are a Swedish language expert. You receive OCR text from a photographed sticky note that contains a Swedish word (possibly with its English meaning written next to it).

Your task:
1. Extract the Swedish word in its base/dictionary form (indefinite singular for nouns, infinitive for verbs).
2. Provide the English meaning.
3. Identify the grammatical gender:
   - "en" for common gender nouns (en-words)
   - "ett" for neuter gender nouns (ett-words)  
   - "n/a" for verbs, adjectives, adverbs, and other non-nouns
4. For nouns, provide the definite singular form and indefinite plural form. For non-nouns, return the word itself for both forms.
5. Create a simple A1-level Swedish example sentence using the word, and its English translation.

IMPORTANT: The OCR text may be messy or contain multiple words. Focus on extracting the main vocabulary word being studied.`;

export async function extractVocabulary(rawText: string): Promise<GeminiIngestResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(
    `Extract the Swedish vocabulary from this OCR text:\n\n${rawText}`
  );

  const text = result.response.text();
  const parsed = JSON.parse(text) as GeminiIngestResult;

  // Basic validation
  if (!parsed.swedish_word || !parsed.english_meaning) {
    throw new Error("Gemini returned incomplete data");
  }

  return parsed;
}

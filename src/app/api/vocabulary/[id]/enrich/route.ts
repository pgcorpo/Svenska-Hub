import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractVocabulary } from "@/lib/gemini/ingest";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteParams) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedModel = typeof body.model === "string" ? body.model : undefined;
    const customApiKey = request.headers.get("x-gemini-api-key") || undefined;

    // Fetch existing word if swedish_word isn't provided in body
    let swedishWord = typeof body.swedish_word === "string" ? body.swedish_word.trim() : "";
    let englishMeaning = typeof body.english_meaning === "string" ? body.english_meaning.trim() : "";

    if (!swedishWord) {
      const { data: existing, error: fetchErr } = await supabase
        .from("vocabulary")
        .select("swedish_word, english_meaning")
        .eq("id", id)
        .single();

      if (fetchErr || !existing) {
        return NextResponse.json({ error: "Word not found" }, { status: 404 });
      }
      swedishWord = existing.swedish_word;
      englishMeaning = existing.english_meaning || "";
    }

    const extracted = await extractVocabulary(swedishWord, {
      englishHint: englishMeaning || undefined,
      model: requestedModel,
      apiKey: customApiKey,
    });

    const updates = {
      english_meaning: englishMeaning || extracted.english_meaning,
      gender: extracted.gender,
      grammar_forms: extracted.grammar_forms,
      example_sv: extracted.example_sv,
      example_en: extracted.example_en,
    };

    const serviceClient = createServiceClient();
    const { data: updatedWord, error: updateErr } = await serviceClient
      .from("vocabulary")
      .update(updates)
      .eq("id", id)
      .select(
        "id, swedish_word, english_meaning, gender, grammar_forms, example_sv, example_en, added_by, created_at"
      )
      .single();

    if (updateErr || !updatedWord) {
      console.error("Failed to update enriched word:", updateErr);
      return NextResponse.json(
        { error: "Failed to save generated details" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      word: updatedWord,
      model_used: extracted.model_used,
    });
  } catch (err) {
    console.error("Enrich error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate example sentence with AI",
      },
      { status: 500 }
    );
  }
}

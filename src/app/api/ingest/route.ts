import { NextRequest, NextResponse } from "next/server";
import { extractVocabulary } from "@/lib/gemini/ingest";
import { createServiceClient } from "@/lib/supabase/server";
import { buildPairedCardProgressRows } from "@/lib/fsrs/scheduler";

export async function POST(request: NextRequest) {
  // 1. Validate Bearer token
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== process.env.INGEST_BEARER_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Parse request body
    const body = await request.json();
    const rawText = body.raw_text;
    const requestedModel = typeof body.model === "string" ? body.model : undefined;
    const customApiKey = request.headers.get("x-gemini-api-key") || undefined;

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid raw_text" },
        { status: 400 }
      );
    }

    // 3. Extract vocabulary with Gemini
    const extracted = await extractVocabulary(rawText, {
      model: requestedModel,
      apiKey: customApiKey,
    });

    // 4. Insert into vocabulary table
    const supabase = createServiceClient();

    const { data: word, error: insertError } = await supabase
      .from("vocabulary")
      .insert({
        swedish_word: extracted.swedish_word,
        english_meaning: extracted.english_meaning,
        gender: extracted.gender,
        grammar_forms: extracted.grammar_forms,
        example_sv: extracted.example_sv,
        example_en: extracted.example_en,
      })
      .select("id")
      .single();

    if (insertError || !word) {
      console.error("Failed to insert vocabulary:", insertError);
      return NextResponse.json(
        { error: "Failed to save vocabulary" },
        { status: 500 }
      );
    }

    // 5. Create card_progress for paired users
    const progressEntries = buildPairedCardProgressRows([word.id]);
    if (progressEntries.length > 0) {
      const { error: progressError } = await supabase
        .from("card_progress")
        .insert(progressEntries);

      if (progressError) {
        console.error("Failed to create card progress:", progressError);
      }
    }

    return NextResponse.json({
      success: true,
      word: {
        id: word.id,
        swedish_word: extracted.swedish_word,
        english_meaning: extracted.english_meaning,
        gender: extracted.gender,
        grammar_forms: extracted.grammar_forms,
      },
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

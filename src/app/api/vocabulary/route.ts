import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildPairedCardProgressRows } from "@/lib/fsrs/scheduler";
import { extractVocabulary } from "@/lib/gemini/ingest";

const LIST_LIMIT = 500;

/** List vocabulary (newest first). Optional `q` filters Swedish/English (ilike). */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    let query = supabase
      .from("vocabulary")
      .select(
        "id, swedish_word, english_meaning, gender, grammar_forms, example_sv, example_en, added_by, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);

    if (q) {
      const safe = q
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_")
        .replace(/,/g, " ");
      query = query.or(
        `swedish_word.ilike.%${safe}%,english_meaning.ilike.%${safe}%`
      );
    }

    const { data: words, count, error } = await query;

    if (error) {
      console.error("Vocabulary list error:", error);
      return NextResponse.json({ error: "Failed to load words" }, { status: 500 });
    }

    return NextResponse.json({ words: words ?? [], total: count ?? (words?.length ?? 0) });
  } catch (e) {
    console.error("Vocabulary GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { swedish_word, english_meaning, use_ai, model } = body;
    const customApiKey = request.headers.get("x-gemini-api-key") || undefined;

    if (!swedish_word) {
      return NextResponse.json({ error: "Swedish word is required" }, { status: 400 });
    }

    let finalData: {
      swedish_word: string;
      english_meaning: string;
      gender: "en" | "ett" | "n/a" | null;
      grammar_forms: { definite_singular?: string; indefinite_plural?: string } | null;
      example_sv: string | null;
      example_en: string | null;
    } = {
      swedish_word,
      english_meaning: english_meaning || "",
      gender: null,
      grammar_forms: null,
      example_sv: null,
      example_en: null,
    };

    let modelUsed: string | undefined;

    // If AI autofill is requested and Gemini is available
    if (use_ai && (customApiKey || process.env.GEMINI_API_KEY)) {
      try {
        const extracted = await extractVocabulary(swedish_word, {
          englishHint: english_meaning || undefined,
          model: typeof model === "string" ? model : undefined,
          apiKey: customApiKey,
        });
        finalData = {
          swedish_word: extracted.swedish_word,
          english_meaning: english_meaning?.trim() || extracted.english_meaning,
          gender: extracted.gender,
          grammar_forms: extracted.grammar_forms,
          example_sv: extracted.example_sv,
          example_en: extracted.example_en,
        };
        modelUsed = extracted.model_used;
      } catch (aiError) {
        console.error("AI Auto-fill failed:", aiError);
        // Fallback to manual input if AI fails
      }
    }

    // Insert into vocabulary table (using service client to bypass RLS if needed, or normal client)
    const serviceClient = createServiceClient();
    const { data: word, error: insertError } = await serviceClient
      .from("vocabulary")
      .insert({ ...finalData, added_by: user.id })
      .select("id")
      .single();

    if (insertError || !word) {
      console.error("Failed to insert vocabulary:", insertError);
      return NextResponse.json({ error: "Failed to save vocabulary" }, { status: 500 });
    }

    // Create card_progress for paired users
    const progressEntries = buildPairedCardProgressRows([word.id], user.id);
    const { error: progressError } = await serviceClient
      .from("card_progress")
      .insert(progressEntries);

    if (progressError) {
      console.error("Failed to create card progress:", progressError);
    }

    return NextResponse.json({
      success: true,
      word: { ...finalData, id: word.id },
      model_used: modelUsed,
    });
  } catch (error) {
    console.error("Single add error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

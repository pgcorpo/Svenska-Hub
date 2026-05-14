import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNewCardProgress } from "@/lib/fsrs/scheduler";
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
        "id, swedish_word, english_meaning, gender, grammar_forms, example_sv, example_en, added_by, created_at"
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

    const { data: words, error } = await query;

    if (error) {
      console.error("Vocabulary list error:", error);
      return NextResponse.json({ error: "Failed to load words" }, { status: 500 });
    }

    return NextResponse.json({ words: words ?? [] });
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
    const { swedish_word, english_meaning, use_ai } = body;

    if (!swedish_word) {
      return NextResponse.json({ error: "Swedish word is required" }, { status: 400 });
    }

    let finalData = {
      swedish_word,
      english_meaning: english_meaning || "",
      gender: null,
      grammar_forms: null,
      example_sv: null,
      example_en: null,
    };

    // If AI autofill is requested and Gemini is available
    if (use_ai && process.env.GEMINI_API_KEY) {
      try {
        const extracted = await extractVocabulary(swedish_word);
        finalData = {
          swedish_word: extracted.swedish_word,
          english_meaning: extracted.english_meaning,
          gender: extracted.gender as any,
          grammar_forms: extracted.grammar_forms as any,
          example_sv: extracted.example_sv as any,
          example_en: extracted.example_en as any,
        };
      } catch (aiError) {
        console.error("AI Auto-fill failed:", aiError);
        // Fallback to manual input if AI fails
      }
    }

    // Insert into vocabulary table (using service client to bypass RLS if needed, or normal client)
    const serviceClient = createServiceClient();
    const { data: word, error: insertError } = await serviceClient
      .from("vocabulary")
      .insert(finalData)
      .select("id")
      .single();

    if (insertError || !word) {
      console.error("Failed to insert vocabulary:", insertError);
      return NextResponse.json({ error: "Failed to save vocabulary" }, { status: 500 });
    }

    // Create card_progress for paired users
    const pairUserIds = process.env.PAIR_USER_IDS?.split(",").map((id) => id.trim()) || [user.id];
    
    // Ensure the current user is at least included if PAIR_USER_IDS isn't set up yet
    const targetUsers = Array.from(new Set([...pairUserIds, user.id])).filter(Boolean);

    const progressEntries = targetUsers.map((userId) => createNewCardProgress(userId, word.id));

    const { error: progressError } = await serviceClient
      .from("card_progress")
      .insert(progressEntries);

    if (progressError) {
      console.error("Failed to create card progress:", progressError);
    }

    return NextResponse.json({ success: true, word: { ...finalData, id: word.id } });
  } catch (error) {
    console.error("Single add error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

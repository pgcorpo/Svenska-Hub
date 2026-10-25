import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildPairedCardProgressRows } from "@/lib/fsrs/scheduler";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { words } = body as {
      words?: { swedish_word: string; english_meaning?: string }[];
    };

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: "Invalid array of words" }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    
    // Format for bulk insert
    const vocabularyRows = words.map((w) => ({
      swedish_word: w.swedish_word,
      english_meaning: w.english_meaning || "",
      gender: null,
      grammar_forms: null,
      example_sv: null,
      example_en: null,
      added_by: user.id,
    }));

    // 1. Bulk insert vocabulary
    const { data: insertedWords, error: insertError } = await serviceClient
      .from("vocabulary")
      .insert(vocabularyRows)
      .select("id");

    if (insertError || !insertedWords) {
      console.error("Failed to bulk insert vocabulary:", insertError);
      return NextResponse.json({ error: "Failed to save vocabulary" }, { status: 500 });
    }

    // 2. Bulk insert card_progress for paired users
    const progressEntries = buildPairedCardProgressRows(
      insertedWords.map((w) => w.id),
      user.id
    );

    if (progressEntries.length > 0) {
      const { error: progressError } = await serviceClient
        .from("card_progress")
        .insert(progressEntries);

      if (progressError) {
        console.error("Failed to bulk create card progress:", progressError);
      }
    }

    return NextResponse.json({ success: true, count: insertedWords.length });
  } catch (error) {
    console.error("Bulk add error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

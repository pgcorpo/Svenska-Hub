import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNewCardProgress } from "@/lib/fsrs/scheduler";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { words } = body; // Expects an array of { swedish_word, english_meaning }

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: "Invalid array of words" }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    
    // Format for bulk insert
    const vocabularyRows = words.map((w: any) => ({
      swedish_word: w.swedish_word,
      english_meaning: w.english_meaning || "",
      gender: null,
      grammar_forms: null,
      example_sv: null,
      example_en: null,
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

    // 2. Prepare card_progress for paired users
    const pairUserIds = process.env.PAIR_USER_IDS?.split(",").map((id) => id.trim()) || [user.id];
    const targetUsers = Array.from(new Set([...pairUserIds, user.id])).filter(Boolean);

    const progressEntries: any[] = [];
    insertedWords.forEach((word) => {
      targetUsers.forEach((userId) => {
        progressEntries.push(createNewCardProgress(userId, word.id));
      });
    });

    // 3. Bulk insert card_progress
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

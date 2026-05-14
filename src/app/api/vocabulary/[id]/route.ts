import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteParams) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      swedish_word,
      english_meaning,
      gender,
      grammar_forms,
      example_sv,
      example_en,
    } = body as Record<string, unknown>;

    const updates: Record<string, unknown> = {};

    if (typeof swedish_word === "string") {
      const s = swedish_word.trim();
      if (!s) {
        return NextResponse.json(
          { error: "Swedish word cannot be empty" },
          { status: 400 }
        );
      }
      updates.swedish_word = s;
    }
    if (typeof english_meaning === "string") {
      updates.english_meaning = english_meaning.trim();
    }
    if (gender === null || gender === "en" || gender === "ett" || gender === "n/a") {
      updates.gender = gender;
    }
    if (grammar_forms !== undefined) {
      updates.grammar_forms = grammar_forms;
    }
    if (example_sv !== undefined) {
      updates.example_sv = example_sv === null || example_sv === "" ? null : String(example_sv);
    }
    if (example_en !== undefined) {
      updates.example_en = example_en === null || example_en === "" ? null : String(example_en);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: word, error } = await supabase
      .from("vocabulary")
      .update(updates)
      .eq("id", id)
      .select(
        "id, swedish_word, english_meaning, gender, grammar_forms, example_sv, example_en, added_by, created_at"
      )
      .single();

    if (error) {
      console.error("Vocabulary PATCH error:", error);
      return NextResponse.json({ error: "Failed to update word" }, { status: 500 });
    }

    return NextResponse.json({ word });
  } catch (e) {
    console.error("Vocabulary PATCH:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.from("vocabulary").delete().eq("id", id);

    if (error) {
      console.error("Vocabulary DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete word" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Vocabulary DELETE:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

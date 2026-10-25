"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Search, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AiSettingsBar } from "@/components/gemini/AiSettingsBar";
import { enrichWordWithAi } from "@/lib/gemini/client-config";
import type { VocabularyWord } from "@/types";

export default function WordsPage() {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const [editing, setEditing] = useState<VocabularyWord | null>(null);
  const [editSv, setEditSv] = useState("");
  const [editEn, setEditEn] = useState("");
  const [editGender, setEditGender] = useState<"en" | "ett" | "n/a" | "">("");
  const [editDefSingular, setEditDefSingular] = useState("");
  const [editIndefPlural, setEditIndefPlural] = useState("");
  const [editExampleSv, setEditExampleSv] = useState("");
  const [editExampleEn, setEditExampleEn] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = debouncedSearch
        ? `?q=${encodeURIComponent(debouncedSearch)}`
        : "";
      const res = await fetch(`/api/vocabulary${qs}`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setWords(data.words ?? []);
      setTotalCount(data.total ?? (data.words?.length ?? 0));
    } catch {
      toast.error("Could not load vocabulary");
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (w: VocabularyWord) => {
    setEditing(w);
    setEditSv(w.swedish_word);
    setEditEn(w.english_meaning);
    setEditGender(w.gender ?? "");
    setEditDefSingular(w.grammar_forms?.definite_singular ?? "");
    setEditIndefPlural(w.grammar_forms?.indefinite_plural ?? "");
    setEditExampleSv(w.example_sv ?? "");
    setEditExampleEn(w.example_en ?? "");
  };

  const closeEdit = () => {
    setEditing(null);
    setEditSv("");
    setEditEn("");
    setEditGender("");
    setEditDefSingular("");
    setEditIndefPlural("");
    setEditExampleSv("");
    setEditExampleEn("");
  };

  const enrichWord = async (w: VocabularyWord, updateModalState = false) => {
    setEnrichingId(w.id);
    try {
      const { word: updated, model_used } = await enrichWordWithAi(
        w.id,
        updateModalState ? editSv.trim() || w.swedish_word : w.swedish_word,
        updateModalState ? editEn.trim() || w.english_meaning : w.english_meaning
      );

      setWords((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );

      if (updateModalState && editing?.id === updated.id) {
        setEditEn(updated.english_meaning || "");
        setEditGender(updated.gender ?? "");
        setEditDefSingular(updated.grammar_forms?.definite_singular ?? "");
        setEditIndefPlural(updated.grammar_forms?.indefinite_plural ?? "");
        setEditExampleSv(updated.example_sv ?? "");
        setEditExampleEn(updated.example_en ?? "");
      }

      toast.success(
        model_used
          ? `Generated complex sentence (${model_used})`
          : "Generated complex sentence"
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not generate example"
      );
    } finally {
      setEnrichingId(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const sv = editSv.trim();
    if (!sv) {
      toast.error("Swedish word is required");
      return;
    }
    setSaving(true);
    try {
      const grammarForms =
        editDefSingular.trim() || editIndefPlural.trim()
          ? {
              definite_singular: editDefSingular.trim() || undefined,
              indefinite_plural: editIndefPlural.trim() || undefined,
            }
          : null;

      const res = await fetch(`/api/vocabulary/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swedish_word: sv,
          english_meaning: editEn.trim(),
          gender: editGender || null,
          grammar_forms: grammarForms,
          example_sv: editExampleSv.trim() || null,
          example_en: editExampleEn.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      toast.success("Word updated");
      closeEdit();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (w: VocabularyWord) => {
    if (
      !confirm(
        `Delete “${w.swedish_word}”? This removes the word for everyone and all review progress for it.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/vocabulary/${w.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Word deleted");
      await load();
    } catch {
      toast.error("Could not delete word");
    }
  };

  const empty = useMemo(
    () => !loading && words.length === 0,
    [loading, words.length]
  );

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Words</h1>
            {totalCount !== null && (
              <Badge variant="secondary" className="text-xs">
                {totalCount}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse, edit, or enrich entries in your shared vocabulary pool.
          </p>
        </div>
      </div>

      <AiSettingsBar />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Swedish or English…"
          className="bg-background/50 pl-9 pr-9"
          aria-label="Search vocabulary"
        />
        {search && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      ) : empty ? (
        <Card className="border-border/50 bg-card/40">
          <CardHeader>
            <CardTitle>No words yet</CardTitle>
            <CardDescription>
              Add words from the Add tab, or import a list in bulk.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {words.map((w) => (
            <li key={w.id}>
              <Card className="border-border/50 bg-card/40">
                <CardContent className="flex items-start gap-3 py-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {w.swedish_word}
                      </p>
                      {w.gender && w.gender !== "n/a" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {w.gender}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {w.english_meaning}
                    </p>
                    {w.example_sv && (
                      <div className="pt-1 text-xs text-muted-foreground/90">
                        <p className="italic text-foreground/85">
                          &ldquo;{w.example_sv}&rdquo;
                        </p>
                        {w.example_en && (
                          <p className="text-muted-foreground/75">
                            &ldquo;{w.example_en}&rdquo;
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                      onClick={() => enrichWord(w)}
                      disabled={enrichingId === w.id}
                      title="Generate complex Swedish sentence & grammar forms with AI"
                    >
                      <Sparkles
                        className={`h-4 w-4 ${
                          enrichingId === w.id ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => openEdit(w)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-red-400"
                      onClick={() => remove(w)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-word-title"
        >
          <Card className="w-full max-w-lg max-h-[90dvh] overflow-y-auto border-border/50 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle id="edit-word-title">Edit word</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => enrichWord(editing, true)}
                  disabled={enrichingId === editing.id}
                  className="border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                >
                  <Sparkles
                    className={`mr-1.5 h-3.5 w-3.5 ${
                      enrichingId === editing.id ? "animate-spin" : ""
                    }`}
                  />
                  {enrichingId === editing.id ? "Generating…" : "Auto-fill AI"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={closeEdit}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Swedish
                  </label>
                  <Input
                    value={editSv}
                    onChange={(e) => setEditSv(e.target.value)}
                    className="bg-background/50"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    English
                  </label>
                  <Input
                    value={editEn}
                    onChange={(e) => setEditEn(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Gender
                  </label>
                  <select
                    value={editGender}
                    onChange={(e) =>
                      setEditGender(e.target.value as "en" | "ett" | "n/a" | "")
                    }
                    className="h-9 w-full rounded-md border border-border/50 bg-background/50 px-2.5 text-sm"
                  >
                    <option value="">None</option>
                    <option value="en">en</option>
                    <option value="ett">ett</option>
                    <option value="n/a">n/a</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Definite / Form 1
                  </label>
                  <Input
                    value={editDefSingular}
                    onChange={(e) => setEditDefSingular(e.target.value)}
                    placeholder="e.g. huset"
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Plural / Form 2
                  </label>
                  <Input
                    value={editIndefPlural}
                    onChange={(e) => setEditIndefPlural(e.target.value)}
                    placeholder="e.g. hus"
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Swedish Example Sentence (Complex)
                </label>
                <textarea
                  value={editExampleSv}
                  onChange={(e) => setEditExampleSv(e.target.value)}
                  rows={2}
                  placeholder="Complex Swedish sentence using the word…"
                  className="w-full rounded-md border border-border/50 bg-background/50 p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  English Example Translation
                </label>
                <textarea
                  value={editExampleEn}
                  onChange={(e) => setEditExampleEn(e.target.value)}
                  rows={2}
                  placeholder="English translation of the example sentence…"
                  className="w-full rounded-md border border-border/50 bg-background/50 p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEdit}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={saveEdit} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type WordRow = {
  id: string;
  swedish_word: string;
  english_meaning: string;
  gender: string | null;
  grammar_forms: Record<string, unknown> | null;
  example_sv: string | null;
  example_en: string | null;
  added_by: string | null;
  created_at: string;
};

export default function WordsPage() {
  const [words, setWords] = useState<WordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [editing, setEditing] = useState<WordRow | null>(null);
  const [editSv, setEditSv] = useState("");
  const [editEn, setEditEn] = useState("");
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

  const openEdit = (w: WordRow) => {
    setEditing(w);
    setEditSv(w.swedish_word);
    setEditEn(w.english_meaning);
  };

  const closeEdit = () => {
    setEditing(null);
    setEditSv("");
    setEditEn("");
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
      const res = await fetch(`/api/vocabulary/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swedish_word: sv,
          english_meaning: editEn.trim(),
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

  const remove = async (w: WordRow) => {
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Words</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse, edit, or delete entries in your shared vocabulary pool.
        </p>
      </div>

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
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {w.swedish_word}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {w.english_meaning}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
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
          <Card className="w-full max-w-md border-border/50 shadow-xl">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <CardTitle id="edit-word-title">Edit word</CardTitle>
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  English
                </label>
                <Input
                  value={editEn}
                  onChange={(e) => setEditEn(e.target.value)}
                  className="bg-background/50"
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

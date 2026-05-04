"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Home, Sparkles, Plus, Upload, Trash2, CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";

type Tab = "quick" | "bulk";

interface BulkRow {
  swedish_word: string;
  english_meaning: string;
}

export default function AddWordsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("quick");

  // Quick Add State
  const [swedish, setSwedish] = useState("");
  const [english, setEnglish] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [recentWords, setRecentWords] = useState<BulkRow[]>([]);
  const swedishInputRef = useRef<HTMLInputElement>(null);

  // Bulk Add State
  const [bulkText, setBulkText] = useState("");
  const [parsedRows, setParsedRows] = useState<BulkRow[]>([]);
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Quick Add Logic
  const handleQuickAdd = async (e?: React.FormEvent, useAi = false) => {
    if (e) e.preventDefault();
    if (!swedish.trim()) return;

    setIsQuickAdding(true);
    
    try {
      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swedish_word: swedish.trim(),
          english_meaning: english.trim(),
          use_ai: useAi
        }),
      });

      if (!res.ok) throw new Error("Failed to add word");

      const data = await res.json();
      
      // Add to recent list
      setRecentWords((prev) => [
        { swedish_word: data.word.swedish_word, english_meaning: data.word.english_meaning },
        ...prev
      ].slice(0, 5));

      toast.success(`Added "${data.word.swedish_word}"`);
      
      // Reset form
      setSwedish("");
      setEnglish("");
      swedishInputRef.current?.focus();

    } catch (error) {
      console.error(error);
      toast.error("Failed to add word");
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Bulk Add Logic
  const handleParseBulkText = () => {
    if (!bulkText.trim()) return;
    
    // Split by newlines
    const lines = bulkText.split("\n");
    const rows: BulkRow[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Try to split by tab, then common separators
      let parts = line.split("\t");
      if (parts.length < 2) parts = line.split(" - ");
      if (parts.length < 2) parts = line.split(",");

      if (parts.length >= 1) {
        rows.push({
          swedish_word: parts[0].trim(),
          english_meaning: parts[1] ? parts.slice(1).join(" ").trim() : "",
        });
      }
    }

    setParsedRows(rows);
  };

  const handleRemoveParsedRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBulkImport = async () => {
    if (parsedRows.length === 0) return;
    
    setIsBulkAdding(true);
    try {
      const res = await fetch("/api/vocabulary/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: parsedRows }),
      });

      if (!res.ok) throw new Error("Failed to bulk import");

      toast.success(`Successfully imported ${parsedRows.length} words!`);
      setBulkText("");
      setParsedRows([]);
      router.push("/"); // Back to dashboard
    } catch (error) {
      console.error(error);
      toast.error("Failed to import words");
    } finally {
      setIsBulkAdding(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background p-4 pb-24 md:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link 
            href="/" 
            className={`rounded-full ${buttonVariants({ variant: "ghost", size: "icon" })}`}
            title="Go Home"
          >
            <Home className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Add Words</h1>
        </div>

        {/* Custom Tabs */}
        <div className="flex rounded-lg bg-card/50 p-1 backdrop-blur ring-1 ring-border/50">
          <button
            onClick={() => setActiveTab("quick")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "quick" 
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Quick Add
          </button>
          <button
            onClick={() => setActiveTab("bulk")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "bulk" 
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bulk Import (TSV)
          </button>
        </div>

        {/* Quick Add Tab */}
        {activeTab === "quick" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg">Add Single Card</CardTitle>
                <CardDescription>
                  Type and press Enter to save instantly. Focus stays in the input.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form 
                  onSubmit={handleQuickAdd} 
                  className="flex flex-col gap-4 sm:flex-row sm:items-start"
                >
                  <div className="flex-1 space-y-2">
                    <Input
                      ref={swedishInputRef}
                      placeholder="Swedish word (e.g. Kaffe)"
                      value={swedish}
                      onChange={(e) => setSwedish(e.target.value)}
                      className="bg-background/50 text-lg py-6"
                      disabled={isQuickAdding}
                      autoFocus
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="English meaning"
                      value={english}
                      onChange={(e) => setEnglish(e.target.value)}
                      className="bg-background/50 text-lg py-6"
                      disabled={isQuickAdding}
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 sm:mt-1 sm:flex-col">
                    <Button 
                      type="submit" 
                      disabled={!swedish.trim() || isQuickAdding}
                      className="flex-1 sm:h-12 sm:w-12 sm:flex-none sm:rounded-full"
                    >
                      {isQuickAdding ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Plus className="h-5 w-5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      disabled={!swedish.trim() || isQuickAdding}
                      onClick={() => handleQuickAdd(undefined, true)}
                      title="AI Auto-fill details"
                      className="h-12 w-12 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    >
                      <Sparkles className="h-5 w-5" />
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Recently Added Feed */}
            {recentWords.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground px-1">Recently Added</h3>
                <div className="flex flex-col gap-2">
                  {recentWords.map((word, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 px-4 py-3 text-sm animate-in fade-in slide-in-from-left-2">
                      <span className="font-medium">{word.swedish_word}</span>
                      <span className="text-muted-foreground">{word.english_meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bulk Import Tab */}
        {activeTab === "bulk" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {parsedRows.length === 0 ? (
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-lg">Paste TSV Data</CardTitle>
                  <CardDescription>
                    Copy rows from Excel, Google Sheets, or type manually separated by tabs or commas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="Katt \t Cat&#10;Hund \t Dog"
                    className="min-h-[200px] w-full resize-y rounded-md border border-border/50 bg-background/50 p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleParseBulkText} 
                    disabled={!bulkText.trim()}
                    className="w-full"
                  >
                    Preview Cards
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Staging Preview</CardTitle>
                      <CardDescription>
                        Verify your data before importing.
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setParsedRows([])}>
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-border/50 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
                        <tr>
                          <th className="px-4 py-3 font-medium">Swedish</th>
                          <th className="px-4 py-3 font-medium">English</th>
                          <th className="px-4 py-3 w-[50px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className="border-b border-border/50 last:border-0 bg-background/30 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{row.swedish_word}</td>
                            <td className="px-4 py-3 text-muted-foreground">{row.english_meaning}</td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => handleRemoveParsedRow(idx)}
                                className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleBulkImport} 
                    disabled={isBulkAdding || parsedRows.length === 0}
                    className="w-full"
                  >
                    {isBulkAdding ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Importing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Import {parsedRows.length} Words
                      </span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        )}

      </div>
    </main>
  );
}

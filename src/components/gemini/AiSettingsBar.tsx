"use client";

import { useEffect, useState } from "react";
import { KeyRound, Sparkles, Check } from "lucide-react";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS,
  type GeminiModelId,
} from "@/lib/constants";
import {
  getCustomGeminiApiKey,
  getSelectedGeminiModel,
  setCustomGeminiApiKey,
  setSelectedGeminiModel,
} from "@/lib/gemini/client-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function AiSettingsBar() {
  const [model, setModel] = useState<GeminiModelId>(DEFAULT_GEMINI_MODEL);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState("");

  useEffect(() => {
    setModel(getSelectedGeminiModel());
    const stored = getCustomGeminiApiKey();
    setApiKey(stored);
    setSavedKey(stored);
  }, []);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as GeminiModelId;
    setModel(next);
    setSelectedGeminiModel(next);
    toast.success(`AI model set to ${next}`);
  };

  const handleSaveKey = () => {
    const trimmed = apiKey.trim();
    setCustomGeminiApiKey(trimmed);
    setSavedKey(trimmed);
    setShowKeyInput(false);
    toast.success(
      trimmed ? "Custom Gemini API key saved" : "Cleared custom API key (using server key)"
    );
  };

  const hasSavedKey = Boolean(savedKey);

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-3 text-xs backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          <span className="font-medium text-muted-foreground">AI Model:</span>
          <select
            value={model}
            onChange={handleModelChange}
            aria-label="Select Gemini Model"
            className="rounded-md border border-border/60 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowKeyInput((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium transition-colors ${
            hasSavedKey
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-border/50 bg-background/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound className="h-3 w-3" />
          {hasSavedKey ? "Custom API Key Active" : "API Key"}
        </button>
      </div>

      {showKeyInput && (
        <div className="mt-3 flex items-center gap-2 border-t border-border/40 pt-3">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste Gemini API key (AIza…) or leave blank for server env"
            className="h-8 bg-background/60 text-xs"
          />
          <Button type="button" size="sm" className="h-8 px-3" onClick={handleSaveKey}>
            <Check className="mr-1 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

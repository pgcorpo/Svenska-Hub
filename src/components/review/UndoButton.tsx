"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface Props {
  onUndo: () => void;
  disabled: boolean;
}

export function UndoButton({ onUndo, disabled }: Props) {
  // Keyboard listener for Ctrl+Z / Cmd+Z
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (!disabled) {
          e.preventDefault();
          onUndo();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onUndo]);

  return (
    <div className="absolute top-4 right-4 sm:top-8 sm:right-8">
      <Button
        variant="outline"
        size="icon"
        onClick={onUndo}
        disabled={disabled}
        className="h-10 w-10 border-border/50 bg-background/50 text-muted-foreground backdrop-blur hover:text-foreground"
        title="Undo (Ctrl+Z)"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

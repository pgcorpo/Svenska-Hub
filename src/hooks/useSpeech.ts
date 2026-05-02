"use client";

import { useEffect, useCallback, useState } from "react";
import { speak, isSwedishVoiceAvailable } from "@/lib/audio/speech";

export function useSpeech() {
  const [hasSwedish, setHasSwedish] = useState(false);

  useEffect(() => {
    // Voices may load asynchronously
    function checkVoices() {
      setHasSwedish(isSwedishVoiceAvailable());
    }

    checkVoices();

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.addEventListener("voiceschanged", checkVoices);
      return () => {
        window.speechSynthesis.removeEventListener(
          "voiceschanged",
          checkVoices
        );
      };
    }
  }, []);

  const speakSwedish = useCallback((text: string) => {
    speak(text, "sv-SE");
  }, []);

  return { speakSwedish, hasSwedish };
}

// ============================================================
// Speech Synthesis Helper
// ============================================================

/**
 * Speak text using the browser's native speechSynthesis API.
 * Attempts to find a Swedish voice; falls back to default if unavailable.
 */
export function speak(text: string, lang: string = "sv-SE"): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.85; // Slightly slower for learners

  // Try to find a Swedish voice
  const voices = window.speechSynthesis.getVoices();
  const swedishVoice = voices.find(
    (v) => v.lang.startsWith("sv") || v.lang.startsWith("se")
  );

  if (swedishVoice) {
    utterance.voice = swedishVoice;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Check if Swedish speech synthesis is available.
 */
export function isSwedishVoiceAvailable(): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return false;
  }

  const voices = window.speechSynthesis.getVoices();
  return voices.some(
    (v) => v.lang.startsWith("sv") || v.lang.startsWith("se")
  );
}

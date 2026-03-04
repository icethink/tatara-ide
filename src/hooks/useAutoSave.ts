// ⚒️ Auto Save — Saves files on focus loss and after idle timeout

import { useEffect, useRef, useCallback } from "react";

interface AutoSaveOptions {
  enabled: boolean;
  delayMs?: number; // Default: 1000ms after last edit
  onSave: (tabId: string) => void;
  modifiedTabIds: string[];
}

export function useAutoSave({ enabled, delayMs = 1000, onSave, modifiedTabIds }: AutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save on focus loss (window blur)
  useEffect(() => {
    if (!enabled) return;

    const handleBlur = () => {
      for (const id of modifiedTabIds) {
        onSave(id);
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handleBlur();
    });

    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, modifiedTabIds, onSave]);

  // Debounced save after edit
  const triggerAutoSave = useCallback((tabId: string) => {
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(tabId);
    }, delayMs);
  }, [enabled, delayMs, onSave]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { triggerAutoSave };
}

// ⚒️ Tatara IDE — i18n React Hook
import { useState, useCallback, useMemo } from "react";
import ja from "../i18n/locales/ja.json";
import en from "../i18n/locales/en.json";

type Translations = typeof ja;
type Locale = "ja" | "en";

const translations: Record<Locale, Translations> = { ja, en };

function detectLocale(): Locale {
  const lang = navigator.language?.slice(0, 2);
  return lang === "ja" ? "ja" : "en";
}

function resolve(obj: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let text = resolve(translations[locale] as unknown as Record<string, unknown>, key);
      // Fallback to English
      if (text === key && locale !== "en") {
        text = resolve(translations.en as unknown as Record<string, unknown>, key);
      }
      // Parameter substitution
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale],
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("tatara_locale", l);
  }, []);

  return useMemo(() => ({ t, locale, setLocale }), [t, locale, setLocale]);
}

// ⚒️ Tatara IDE — Internationalization
//
// Design: Japanese is first-class.
// - ja / en supported
// - OS locale auto-detection
// - Key-based JSON translation files
// - Fallback: key → en → raw key name

use serde_json::Value;
use std::collections::HashMap;

pub struct I18n {
    current_locale: String,
    translations: HashMap<String, Value>,
    fallback_locale: String,
}

impl I18n {
    pub fn new() -> Self {
        let mut i18n = Self {
            current_locale: String::from("ja"),
            translations: HashMap::new(),
            fallback_locale: String::from("en"),
        };
        // Load built-in translations
        i18n.load_builtin();
        i18n
    }

    /// Get translated text by key
    /// e.g., t("terminal.paste_confirm.title")
    pub fn t(&self, key: &str) -> String {
        self.resolve(key, &self.current_locale)
            .or_else(|| self.resolve(key, &self.fallback_locale))
            .unwrap_or_else(|| key.to_string())
    }

    /// Get translated text with placeholder substitution
    /// e.g., t_with("editor.lines_selected", &[("count", "5")])
    pub fn t_with(&self, key: &str, params: &[(&str, &str)]) -> String {
        let mut text = self.t(key);
        for (k, v) in params {
            text = text.replace(&format!("{{{}}}", k), v);
        }
        text
    }

    /// Switch locale (immediate, no restart)
    pub fn set_locale(&mut self, locale: &str) {
        self.current_locale = locale.to_string();
    }

    /// Detect system locale
    pub fn detect_system_locale() -> String {
        // TODO: Use sys-locale crate for proper detection
        String::from("ja")
    }

    fn resolve(&self, key: &str, locale: &str) -> Option<String> {
        let tree = self.translations.get(locale)?;
        let mut current = tree;
        for part in key.split('.') {
            current = current.get(part)?;
        }
        current.as_str().map(String::from)
    }

    fn load_builtin(&mut self) {
        // TODO: Load from embedded JSON files
        // For now, minimal bootstrap translations
        let ja: Value = serde_json::json!({
            "app": {
                "name": "Tatara IDE",
                "welcome": "Tatara IDE へようこそ！"
            },
            "common": {
                "ok": "OK",
                "cancel": "キャンセル",
                "save": "保存",
                "close": "閉じる"
            }
        });

        let en: Value = serde_json::json!({
            "app": {
                "name": "Tatara IDE",
                "welcome": "Welcome to Tatara IDE!"
            },
            "common": {
                "ok": "OK",
                "cancel": "Cancel",
                "save": "Save",
                "close": "Close"
            }
        });

        self.translations.insert("ja".into(), ja);
        self.translations.insert("en".into(), en);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_translation() {
        let i18n = I18n::new();
        assert_eq!(i18n.t("app.name"), "Tatara IDE");
        assert_eq!(i18n.t("common.save"), "保存");
    }

    #[test]
    fn test_fallback_to_en() {
        let mut i18n = I18n::new();
        i18n.set_locale("en");
        assert_eq!(i18n.t("common.save"), "Save");
    }

    #[test]
    fn test_missing_key_returns_key() {
        let i18n = I18n::new();
        assert_eq!(i18n.t("nonexistent.key"), "nonexistent.key");
    }
}

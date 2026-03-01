// ⚒️ Tatara IDE — Encoding Detection & Conversion
//
// Detects file encoding (UTF-8, UTF-8 BOM, Shift-JIS, EUC-JP, ISO-2022-JP)
// Critical for Japanese Laravel projects with legacy code

use encoding_rs::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DetectedEncoding {
    Utf8,
    Utf8Bom,
    ShiftJis,
    EucJp,
    Iso2022Jp,
    Latin1,
    Unknown,
}

/// Detect encoding from raw bytes
pub fn detect_encoding(bytes: &[u8]) -> DetectedEncoding {
    // Check BOM
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return DetectedEncoding::Utf8Bom;
    }

    // Try UTF-8 first (most common)
    if is_valid_utf8(bytes) {
        return DetectedEncoding::Utf8;
    }

    // Check for ISO-2022-JP escape sequences
    if contains_iso2022jp_escapes(bytes) {
        return DetectedEncoding::Iso2022Jp;
    }

    // Heuristic: Try Shift-JIS vs EUC-JP
    let sjis_score = score_encoding(bytes, SHIFT_JIS);
    let eucjp_score = score_encoding(bytes, EUC_JP);

    if sjis_score > eucjp_score && sjis_score > 0.5 {
        return DetectedEncoding::ShiftJis;
    }
    if eucjp_score > sjis_score && eucjp_score > 0.5 {
        return DetectedEncoding::EucJp;
    }

    // Fallback: try Shift-JIS (more common in Windows Japan)
    if sjis_score > 0.3 {
        return DetectedEncoding::ShiftJis;
    }

    DetectedEncoding::Unknown
}

fn is_valid_utf8(bytes: &[u8]) -> bool {
    std::str::from_utf8(bytes).is_ok()
}

fn contains_iso2022jp_escapes(bytes: &[u8]) -> bool {
    for i in 0..bytes.len().saturating_sub(2) {
        if bytes[i] == 0x1B {
            // ESC $ B or ESC $ @ (JIS X 0208)
            if i + 2 < bytes.len() && bytes[i + 1] == b'$' && (bytes[i + 2] == b'B' || bytes[i + 2] == b'@') {
                return true;
            }
            // ESC ( B or ESC ( J (ASCII / JIS X 0201)
            if i + 2 < bytes.len() && bytes[i + 1] == b'(' && (bytes[i + 2] == b'B' || bytes[i + 2] == b'J') {
                return true;
            }
        }
    }
    false
}

fn score_encoding(bytes: &[u8], encoding: &'static Encoding) -> f64 {
    let (decoded, _, had_errors) = encoding.decode(bytes);
    if had_errors {
        return 0.0;
    }

    // Score based on how many valid Japanese chars we get
    let total = decoded.chars().count() as f64;
    if total == 0.0 {
        return 0.0;
    }

    let japanese_chars = decoded
        .chars()
        .filter(|c| is_japanese_char(*c))
        .count() as f64;

    japanese_chars / total
}

fn is_japanese_char(c: char) -> bool {
    let cp = c as u32;
    // Hiragana
    (0x3040..=0x309F).contains(&cp) ||
    // Katakana
    (0x30A0..=0x30FF).contains(&cp) ||
    // CJK Unified Ideographs
    (0x4E00..=0x9FFF).contains(&cp) ||
    // Halfwidth Katakana
    (0xFF65..=0xFF9F).contains(&cp) ||
    // Fullwidth Latin
    (0xFF01..=0xFF5E).contains(&cp)
}

/// Decode bytes to String with detected encoding
pub fn decode_bytes(bytes: &[u8], encoding: &DetectedEncoding) -> String {
    match encoding {
        DetectedEncoding::Utf8 => String::from_utf8_lossy(bytes).to_string(),
        DetectedEncoding::Utf8Bom => {
            let content = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
                &bytes[3..]
            } else {
                bytes
            };
            String::from_utf8_lossy(content).to_string()
        }
        DetectedEncoding::ShiftJis => {
            let (decoded, _, _) = SHIFT_JIS.decode(bytes);
            decoded.to_string()
        }
        DetectedEncoding::EucJp => {
            let (decoded, _, _) = EUC_JP.decode(bytes);
            decoded.to_string()
        }
        DetectedEncoding::Iso2022Jp => {
            let (decoded, _, _) = ISO_2022_JP.decode(bytes);
            decoded.to_string()
        }
        DetectedEncoding::Latin1 => {
            bytes.iter().map(|&b| b as char).collect()
        }
        DetectedEncoding::Unknown => String::from_utf8_lossy(bytes).to_string(),
    }
}

/// Encode String back to bytes with target encoding
pub fn encode_string(text: &str, encoding: &DetectedEncoding) -> Vec<u8> {
    match encoding {
        DetectedEncoding::Utf8 => text.as_bytes().to_vec(),
        DetectedEncoding::Utf8Bom => {
            let mut bytes = vec![0xEF, 0xBB, 0xBF];
            bytes.extend_from_slice(text.as_bytes());
            bytes
        }
        DetectedEncoding::ShiftJis => {
            let (encoded, _, _) = SHIFT_JIS.encode(text);
            encoded.to_vec()
        }
        DetectedEncoding::EucJp => {
            let (encoded, _, _) = EUC_JP.encode(text);
            encoded.to_vec()
        }
        DetectedEncoding::Iso2022Jp => {
            let (encoded, _, _) = ISO_2022_JP.encode(text);
            encoded.to_vec()
        }
        DetectedEncoding::Latin1 | DetectedEncoding::Unknown => text.as_bytes().to_vec(),
    }
}

/// Get display name for encoding
pub fn encoding_display_name(enc: &DetectedEncoding) -> &'static str {
    match enc {
        DetectedEncoding::Utf8 => "UTF-8",
        DetectedEncoding::Utf8Bom => "UTF-8 BOM",
        DetectedEncoding::ShiftJis => "Shift-JIS",
        DetectedEncoding::EucJp => "EUC-JP",
        DetectedEncoding::Iso2022Jp => "ISO-2022-JP",
        DetectedEncoding::Latin1 => "Latin-1",
        DetectedEncoding::Unknown => "Unknown",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_utf8() {
        let text = "Hello, world!".as_bytes();
        assert_eq!(detect_encoding(text), DetectedEncoding::Utf8);
    }

    #[test]
    fn test_detect_utf8_japanese() {
        let text = "こんにちは世界".as_bytes();
        assert_eq!(detect_encoding(text), DetectedEncoding::Utf8);
    }

    #[test]
    fn test_detect_utf8_bom() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("Hello".as_bytes());
        assert_eq!(detect_encoding(&bytes), DetectedEncoding::Utf8Bom);
    }

    #[test]
    fn test_detect_shift_jis() {
        // "こんにちは" in Shift-JIS
        let (encoded, _, _) = SHIFT_JIS.encode("こんにちは日本語テスト");
        let detected = detect_encoding(&encoded);
        assert!(
            detected == DetectedEncoding::ShiftJis || detected == DetectedEncoding::EucJp,
            "Expected ShiftJis or EucJp, got {:?}", detected
        );
    }

    #[test]
    fn test_decode_utf8_bom() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("Hello".as_bytes());
        let decoded = decode_bytes(&bytes, &DetectedEncoding::Utf8Bom);
        assert_eq!(decoded, "Hello");
    }

    #[test]
    fn test_encode_shift_jis_roundtrip() {
        let text = "テスト";
        let encoded = encode_string(text, &DetectedEncoding::ShiftJis);
        let decoded = decode_bytes(&encoded, &DetectedEncoding::ShiftJis);
        assert_eq!(decoded, text);
    }

    #[test]
    fn test_encoding_display_name() {
        assert_eq!(encoding_display_name(&DetectedEncoding::Utf8), "UTF-8");
        assert_eq!(encoding_display_name(&DetectedEncoding::ShiftJis), "Shift-JIS");
    }

    #[test]
    fn test_is_japanese_char() {
        assert!(is_japanese_char('あ'));
        assert!(is_japanese_char('漢'));
        assert!(is_japanese_char('ア'));
        assert!(!is_japanese_char('a'));
        assert!(!is_japanese_char('1'));
    }
}

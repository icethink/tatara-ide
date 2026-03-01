// ⚒️ Regex-based Syntax Highlighter
//
// Phase 1 MVP: Fast regex tokenizer for common languages
// Phase 2 will add tree-sitter for full AST-aware highlighting
//
// Returns token spans with semantic types for the renderer to colorize

export interface Token {
  start: number;
  end: number;
  type: TokenType;
}

export type TokenType =
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "operator"
  | "function"
  | "variable"
  | "type"
  | "tag"
  | "attribute"
  | "punctuation"
  | "constant"
  | "decorator"
  | "builtin"
  | "text";

// ── Theme Color Map ──

export const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: "#CBA6F7",     // Mauve
  string: "#A6E3A1",      // Green
  number: "#FAB387",      // Peach
  comment: "#6C7086",     // Overlay0
  operator: "#94E2D5",    // Teal
  function: "#89B4FA",    // Blue
  variable: "#F38BA8",    // Red (flame)
  type: "#F9E2AF",        // Yellow
  tag: "#F38BA8",         // Red
  attribute: "#FAB387",   // Peach
  punctuation: "#9399B2", // Overlay2
  constant: "#FAB387",    // Peach
  decorator: "#CBA6F7",   // Mauve
  builtin: "#89DCEB",     // Sky
  text: "#CDD6F4",        // Text
};

// ── Language Definitions ──

interface LanguageRules {
  keywords: string[];
  builtins?: string[];
  constants?: string[];
  lineComment: string;
  blockCommentStart?: string;
  blockCommentEnd?: string;
  stringDelimiters: string[];
  operators?: RegExp;
  decorator?: string;
  typePattern?: RegExp;
}

const PHP: LanguageRules = {
  keywords: [
    "abstract", "and", "array", "as", "break", "callable", "case", "catch",
    "class", "clone", "const", "continue", "declare", "default", "do", "echo",
    "else", "elseif", "empty", "enddeclare", "endfor", "endforeach", "endif",
    "endswitch", "endwhile", "enum", "extends", "final", "finally", "fn",
    "for", "foreach", "function", "global", "goto", "if", "implements",
    "include", "include_once", "instanceof", "insteadof", "interface", "isset",
    "list", "match", "namespace", "new", "or", "print", "private", "protected",
    "public", "readonly", "require", "require_once", "return", "static",
    "switch", "throw", "trait", "try", "unset", "use", "var", "while", "xor",
    "yield",
  ],
  builtins: ["self", "parent", "static", "this"],
  constants: ["true", "false", "null", "PHP_EOL", "STDIN", "STDOUT", "STDERR"],
  lineComment: "//",
  blockCommentStart: "/*",
  blockCommentEnd: "*/",
  stringDelimiters: ['"', "'"],
  decorator: "#[",
  typePattern: /\b[A-Z][a-zA-Z0-9_]*\b/g,
};

const JAVASCRIPT: LanguageRules = {
  keywords: [
    "async", "await", "break", "case", "catch", "class", "const", "continue",
    "debugger", "default", "delete", "do", "else", "export", "extends",
    "finally", "for", "from", "function", "if", "import", "in", "instanceof",
    "let", "new", "of", "return", "static", "super", "switch", "throw", "try",
    "typeof", "var", "void", "while", "with", "yield",
  ],
  builtins: ["this", "globalThis", "window", "document", "console", "Math", "JSON", "Promise", "Array", "Object", "String", "Number", "Date", "RegExp", "Map", "Set"],
  constants: ["true", "false", "null", "undefined", "NaN", "Infinity"],
  lineComment: "//",
  blockCommentStart: "/*",
  blockCommentEnd: "*/",
  stringDelimiters: ['"', "'", "`"],
  typePattern: /\b[A-Z][a-zA-Z0-9_]*\b/g,
};

const TYPESCRIPT: LanguageRules = {
  ...JAVASCRIPT,
  keywords: [
    ...JAVASCRIPT.keywords,
    "abstract", "as", "declare", "enum", "implements", "interface", "keyof",
    "module", "namespace", "never", "override", "readonly", "satisfies",
    "type", "unknown",
  ],
};

const HTML: LanguageRules = {
  keywords: [],
  lineComment: "",
  blockCommentStart: "<!--",
  blockCommentEnd: "-->",
  stringDelimiters: ['"', "'"],
};

const CSS: LanguageRules = {
  keywords: [
    "important", "inherit", "initial", "unset", "revert",
  ],
  builtins: [
    "auto", "none", "block", "inline", "flex", "grid", "absolute", "relative",
    "fixed", "sticky", "hidden", "visible", "solid", "dashed", "dotted",
  ],
  lineComment: "",
  blockCommentStart: "/*",
  blockCommentEnd: "*/",
  stringDelimiters: ['"', "'"],
};

const RUST: LanguageRules = {
  keywords: [
    "as", "async", "await", "break", "const", "continue", "crate", "dyn",
    "else", "enum", "extern", "fn", "for", "if", "impl", "in", "let",
    "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self",
    "static", "struct", "super", "trait", "type", "unsafe", "use", "where",
    "while",
  ],
  builtins: ["Self", "Option", "Result", "Vec", "String", "Box", "Rc", "Arc", "HashMap", "Ok", "Err", "Some", "None"],
  constants: ["true", "false"],
  lineComment: "//",
  blockCommentStart: "/*",
  blockCommentEnd: "*/",
  stringDelimiters: ['"'],
  decorator: "#[",
  typePattern: /\b[A-Z][a-zA-Z0-9_]*\b/g,
};

const BLADE: LanguageRules = {
  keywords: [
    ...PHP.keywords,
    // Blade directives (without @)
    "if", "else", "elseif", "endif", "foreach", "endforeach",
    "for", "endfor", "while", "endwhile", "forelse", "empty", "endforelse",
    "switch", "case", "break", "endswitch",
    "unless", "endunless", "isset", "endisset", "empty", "endempty",
    "auth", "endauth", "guest", "endguest",
    "can", "endcan", "cannot", "endcannot",
    "section", "endsection", "yield", "extends", "include",
    "component", "endcomponent", "slot", "endslot",
    "push", "endpush", "stack", "prepend", "endprepend",
    "once", "endonce", "verbatim", "endverbatim",
    "php", "endphp", "props",
  ],
  builtins: PHP.builtins,
  constants: PHP.constants,
  lineComment: "//",
  blockCommentStart: "{{--",
  blockCommentEnd: "--}}",
  stringDelimiters: ['"', "'"],
  decorator: "@",
  typePattern: /\b[A-Z][a-zA-Z0-9_]*\b/g,
};

const LANGUAGE_MAP: Record<string, LanguageRules> = {
  php: PHP,
  javascript: JAVASCRIPT,
  typescript: TYPESCRIPT,
  html: HTML,
  css: CSS,
  scss: CSS,
  rust: RUST,
  vue: JAVASCRIPT,
  blade: BLADE,
};

// ── Tokenizer ──

export function tokenizeLine(line: string, language: string): Token[] {
  const rules = LANGUAGE_MAP[language];
  if (!rules) {
    return [{ start: 0, end: line.length, type: "text" }];
  }

  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Skip whitespace (no token)
    if (line[i] === " " || line[i] === "\t") {
      i++;
      continue;
    }

    // Blade-specific: {{ expression }} and {!! expression !!}
    if ((language === "blade" || language === "html") && line[i] === "{") {
      // {!! raw !!}
      if (line.startsWith("{!!", i)) {
        const end = line.indexOf("!!}", i + 3);
        tokens.push({
          start: i,
          end: end !== -1 ? end + 3 : line.length,
          type: "variable",
        });
        i = end !== -1 ? end + 3 : line.length;
        continue;
      }
      // {{ escaped }}
      if (line.startsWith("{{", i) && !line.startsWith("{{--", i)) {
        const end = line.indexOf("}}", i + 2);
        tokens.push({
          start: i,
          end: end !== -1 ? end + 2 : line.length,
          type: "variable",
        });
        i = end !== -1 ? end + 2 : line.length;
        continue;
      }
    }

    // Blade directives: @if, @foreach, etc.
    if (language === "blade" && line[i] === "@" && i + 1 < line.length && /[a-zA-Z]/.test(line[i + 1])) {
      const dirMatch = line.slice(i).match(/^@([a-zA-Z]+)/);
      if (dirMatch) {
        tokens.push({ start: i, end: i + dirMatch[0].length, type: "keyword" });
        i += dirMatch[0].length;
        continue;
      }
    }

    // Line comment
    if (rules.lineComment && line.startsWith(rules.lineComment, i)) {
      tokens.push({ start: i, end: line.length, type: "comment" });
      break;
    }

    // Block comment start (single-line check only)
    if (rules.blockCommentStart && line.startsWith(rules.blockCommentStart, i)) {
      const endIdx = line.indexOf(rules.blockCommentEnd!, i + rules.blockCommentStart.length);
      if (endIdx !== -1) {
        tokens.push({ start: i, end: endIdx + rules.blockCommentEnd!.length, type: "comment" });
        i = endIdx + rules.blockCommentEnd!.length;
      } else {
        tokens.push({ start: i, end: line.length, type: "comment" });
        break;
      }
      continue;
    }

    // Decorator / Attribute
    if (rules.decorator && line.startsWith(rules.decorator, i)) {
      const end = line.indexOf("]", i);
      tokens.push({ start: i, end: end !== -1 ? end + 1 : line.length, type: "decorator" });
      i = end !== -1 ? end + 1 : line.length;
      continue;
    }

    // Strings
    let stringMatched = false;
    for (const delim of rules.stringDelimiters) {
      if (line[i] === delim) {
        const end = findStringEnd(line, i, delim);
        tokens.push({ start: i, end, type: "string" });
        i = end;
        stringMatched = true;
        break;
      }
    }
    if (stringMatched) continue;

    // Numbers
    if (/[0-9]/.test(line[i]) || (line[i] === "." && i + 1 < line.length && /[0-9]/.test(line[i + 1]))) {
      const numMatch = line.slice(i).match(/^(0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+|[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?)/);
      if (numMatch) {
        tokens.push({ start: i, end: i + numMatch[0].length, type: "number" });
        i += numMatch[0].length;
        continue;
      }
    }

    // PHP variable
    if (language === "php" && line[i] === "$") {
      const varMatch = line.slice(i).match(/^\$[a-zA-Z_][a-zA-Z0-9_]*/);
      if (varMatch) {
        tokens.push({ start: i, end: i + varMatch[0].length, type: "variable" });
        i += varMatch[0].length;
        continue;
      }
    }

    // Words (keywords, builtins, constants, types, functions)
    const wordMatch = line.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const end = i + word.length;

      if (rules.keywords.includes(word)) {
        tokens.push({ start: i, end, type: "keyword" });
      } else if (rules.constants?.includes(word)) {
        tokens.push({ start: i, end, type: "constant" });
      } else if (rules.builtins?.includes(word)) {
        tokens.push({ start: i, end, type: "builtin" });
      } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
        tokens.push({ start: i, end, type: "type" });
      } else if (end < line.length && line[end] === "(") {
        tokens.push({ start: i, end, type: "function" });
      } else {
        tokens.push({ start: i, end, type: "text" });
      }
      i = end;
      continue;
    }

    // HTML tags
    if (language === "html" && line[i] === "<") {
      const tagMatch = line.slice(i).match(/^<\/?[a-zA-Z][a-zA-Z0-9-]*/);
      if (tagMatch) {
        tokens.push({ start: i, end: i + tagMatch[0].length, type: "tag" });
        i += tagMatch[0].length;
        continue;
      }
    }

    // Operators
    if (/[+\-*/%=<>!&|^~?:]/.test(line[i])) {
      let opLen = 1;
      const twoChar = line.slice(i, i + 2);
      const threeChar = line.slice(i, i + 3);
      if (["===", "!==", "<=>", ">>>" , "...", "**="].includes(threeChar)) opLen = 3;
      else if (["==", "!=", "<=", ">=", "&&", "||", "??", "=>", "->", "::", "++", "--", "+=", "-=", "*=", "/=", "<<", ">>"].includes(twoChar)) opLen = 2;
      tokens.push({ start: i, end: i + opLen, type: "operator" });
      i += opLen;
      continue;
    }

    // Punctuation
    if (/[{}()\[\];,.]/.test(line[i])) {
      tokens.push({ start: i, end: i + 1, type: "punctuation" });
      i++;
      continue;
    }

    // Unknown — skip
    i++;
  }

  return tokens;
}

function findStringEnd(line: string, start: number, delim: string): number {
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === "\\" && i + 1 < line.length) {
      i += 2; // Skip escaped char
      continue;
    }
    if (line[i] === delim) {
      return i + 1;
    }
    i++;
  }
  return line.length;
}

// ── Tokenize for Rendering ──

export interface ColoredSpan {
  text: string;
  color: string;
}

export function colorizeTokens(line: string, tokens: Token[]): ColoredSpan[] {
  if (tokens.length === 0) {
    return [{ text: line, color: TOKEN_COLORS.text }];
  }

  const spans: ColoredSpan[] = [];
  let lastEnd = 0;

  for (const token of tokens) {
    // Gap before token (whitespace/unknown)
    if (token.start > lastEnd) {
      spans.push({
        text: line.slice(lastEnd, token.start),
        color: TOKEN_COLORS.text,
      });
    }

    spans.push({
      text: line.slice(token.start, token.end),
      color: TOKEN_COLORS[token.type],
    });

    lastEnd = token.end;
  }

  // Remaining text after last token
  if (lastEnd < line.length) {
    spans.push({
      text: line.slice(lastEnd),
      color: TOKEN_COLORS.text,
    });
  }

  return spans;
}

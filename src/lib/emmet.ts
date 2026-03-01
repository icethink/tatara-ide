// ⚒️ Emmet Expansion Engine (Lightweight)
//
// Supports basic Emmet abbreviations for HTML/Blade/Vue:
// - Tag: div, span, p, h1-h6, etc.
// - Classes: div.container, p.text-lg.font-bold
// - ID: div#app, section#hero
// - Multiply: li*5
// - Child: ul>li
// - Text: a{Click me}
// - Attributes: input[type=text]
// - Common shortcuts: !, html:5, link:css, script:src

export function expandEmmet(abbr: string): string | null {
  if (!abbr || abbr.includes(" ")) return null;

  // Common shortcuts
  const shortcuts: Record<string, string> = {
    "!": `<!DOCTYPE html>\n<html lang="ja">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>\${1:Document}</title>\n</head>\n<body>\n    $0\n</body>\n</html>`,
    "html:5": `<!DOCTYPE html>\n<html lang="ja">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>\${1:Document}</title>\n</head>\n<body>\n    $0\n</body>\n</html>`,
    "link:css": `<link rel="stylesheet" href="\${1:style.css}">`,
    "link:favicon": `<link rel="icon" type="image/x-icon" href="\${1:favicon.ico}">`,
    "script:src": `<script src="\${1:script.js}"></script>`,
    "meta:vp": `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    "a:link": `<a href="\${1:https://}">\${2:link}</a>`,
    "inp": `<input type="\${1:text}" name="\${2}" id="\${3}">`,
    "btn": `<button type="\${1:button}">\${2:Button}</button>`,
    "img": `<img src="\${1}" alt="\${2}">`,
  };

  if (shortcuts[abbr]) return shortcuts[abbr];

  // Parse abbreviation
  try {
    return parseAbbreviation(abbr);
  } catch {
    return null;
  }
}

function parseAbbreviation(abbr: string): string | null {
  // Split by > (child combinator)
  const parts = splitByChar(abbr, ">");
  if (parts.length === 0) return null;

  let result = "";
  let indent = 0;

  for (let i = 0; i < parts.length; i++) {
    const expanded = expandPart(parts[i]);
    if (!expanded) return null;

    const indentStr = "    ".repeat(indent);

    if (i === 0) {
      result = expanded.open + (parts.length > 1 ? "\n" : "$0") + expanded.close;
    } else {
      // Insert inside previous tag
      const insertPoint = result.lastIndexOf("\n" + "    ".repeat(indent - 1));
      if (insertPoint !== -1) {
        result =
          result.slice(0, insertPoint) +
          "\n" + indentStr + expanded.open +
          (i < parts.length - 1 ? "\n" : "$0") +
          expanded.close +
          result.slice(insertPoint);
      } else {
        result = result.replace("$0", "\n" + indentStr + expanded.open + "$0" + expanded.close);
      }
    }
    indent++;
  }

  // Clean up empty $0 at wrong places
  if (!result.includes("$0")) {
    result += "$0";
  }

  return result || null;
}

interface ExpandedTag {
  open: string;
  close: string;
}

function expandPart(part: string): ExpandedTag | null {
  // Handle multiply: li*5
  const multiplyMatch = part.match(/^(.+)\*(\d+)$/);
  if (multiplyMatch) {
    const inner = expandSingleTag(multiplyMatch[1]);
    if (!inner) return null;
    const count = parseInt(multiplyMatch[2]);
    const lines = Array.from({ length: count }, () => inner.open + inner.close).join("\n");
    return { open: lines, close: "" };
  }

  return expandSingleTag(part);
}

function expandSingleTag(part: string): ExpandedTag | null {
  // Parse: tag#id.class1.class2[attr=val]{text}
  let tag = "div";
  let id = "";
  let classes: string[] = [];
  let attrs: string[] = [];
  let text = "";

  let i = 0;
  const s = part;

  // Tag name
  const tagMatch = s.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (tagMatch) {
    tag = tagMatch[1];
    i = tagMatch[0].length;
  } else if (s[0] !== "#" && s[0] !== ".") {
    return null;
  }

  while (i < s.length) {
    if (s[i] === "#") {
      i++;
      const m = s.slice(i).match(/^([a-zA-Z0-9_-]+)/);
      if (m) { id = m[1]; i += m[0].length; }
    } else if (s[i] === ".") {
      i++;
      const m = s.slice(i).match(/^([a-zA-Z0-9_-]+)/);
      if (m) { classes.push(m[1]); i += m[0].length; }
    } else if (s[i] === "[") {
      const end = s.indexOf("]", i);
      if (end !== -1) {
        attrs.push(s.slice(i + 1, end));
        i = end + 1;
      } else break;
    } else if (s[i] === "{") {
      const end = s.indexOf("}", i);
      if (end !== -1) {
        text = s.slice(i + 1, end);
        i = end + 1;
      } else break;
    } else {
      break;
    }
  }

  // Self-closing tags
  const selfClosing = ["img", "input", "br", "hr", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"];

  // Build attributes
  let attrStr = "";
  if (id) attrStr += ` id="${id}"`;
  if (classes.length) attrStr += ` class="${classes.join(" ")}"`;
  for (const a of attrs) {
    if (a.includes("=")) {
      const [k, v] = a.split("=", 2);
      attrStr += ` ${k}="${v}"`;
    } else {
      attrStr += ` ${a}`;
    }
  }

  if (selfClosing.includes(tag)) {
    return { open: `<${tag}${attrStr}>`, close: "" };
  }

  const content = text || "";
  return {
    open: `<${tag}${attrStr}>${content}`,
    close: `</${tag}>`,
  };
}

function splitByChar(str: string, char: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < str.length; i++) {
    if (str[i] === "[" || str[i] === "{" || str[i] === "(") depth++;
    if (str[i] === "]" || str[i] === "}" || str[i] === ")") depth--;

    if (str[i] === char && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += str[i];
    }
  }

  if (current) parts.push(current);
  return parts;
}

/** Check if cursor is in an Emmet-expandable context */
export function isEmmetContext(language: string): boolean {
  return ["html", "blade", "vue", "php", "jsx", "tsx"].includes(language);
}

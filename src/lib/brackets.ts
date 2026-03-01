// ⚒️ Rainbow Brackets & Bracket Pair Colorization
//
// Assigns colors to nested bracket pairs for visual clarity

const RAINBOW_COLORS = [
  "#f9e2af", // Yellow
  "#cba6f7", // Mauve
  "#89b4fa", // Blue
  "#a6e3a1", // Green
  "#fab387", // Peach
  "#f38ba8", // Red
  "#94e2d5", // Teal
  "#89dceb", // Sky
];

export interface BracketColor {
  start: number;
  end: number;
  color: string;
}

const OPEN_BRACKETS = "([{";
const CLOSE_BRACKETS = ")]}";

/**
 * Compute rainbow bracket colors for a single line.
 * `depthOffset` is the nesting depth carried from previous lines.
 * Returns the colored spans and the new depth after this line.
 */
export function colorBracketsLine(
  line: string,
  depthOffset: number
): { colors: BracketColor[]; newDepth: number } {
  const colors: BracketColor[] = [];
  let depth = depthOffset;
  let inString: string | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    // String tracking (skip brackets inside strings)
    if (!inString && (ch === '"' || ch === "'" || ch === "`")) {
      inString = ch;
      continue;
    }
    if (inString) {
      if (ch === "\\" && i + 1 < line.length) {
        i++; // skip escaped char
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    // Skip line comments
    if (ch === "/" && i + 1 < line.length && line[i + 1] === "/") {
      break;
    }

    const openIdx = OPEN_BRACKETS.indexOf(ch);
    if (openIdx !== -1) {
      const color = RAINBOW_COLORS[depth % RAINBOW_COLORS.length];
      colors.push({ start: i, end: i + 1, color });
      depth++;
    }

    const closeIdx = CLOSE_BRACKETS.indexOf(ch);
    if (closeIdx !== -1) {
      depth = Math.max(0, depth - 1);
      const color = RAINBOW_COLORS[depth % RAINBOW_COLORS.length];
      colors.push({ start: i, end: i + 1, color });
    }
  }

  return { colors, newDepth: depth };
}

/**
 * Compute rainbow brackets for all visible lines.
 * Returns a Map<lineIndex, BracketColor[]>
 */
export function colorBracketsRange(
  lines: string[],
  startLine: number,
  allLines: string[]
): Map<number, BracketColor[]> {
  // Compute depth up to startLine
  let depth = 0;
  for (let i = 0; i < startLine && i < allLines.length; i++) {
    const result = colorBracketsLine(allLines[i], depth);
    depth = result.newDepth;
  }

  const map = new Map<number, BracketColor[]>();
  for (let i = 0; i < lines.length; i++) {
    const result = colorBracketsLine(lines[i], depth);
    if (result.colors.length > 0) {
      map.set(startLine + i, result.colors);
    }
    depth = result.newDepth;
  }

  return map;
}

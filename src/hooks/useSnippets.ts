// ⚒️ Snippet Expansion Engine
//
// Handles snippet trigger → expansion in the editor
// Supports: tab stops ($1, $2), placeholders (${1:default}), $0 final position

export interface Snippet {
  name: string;
  prefix: string;
  body: string;
  description: string;
}

export interface ExpandedSnippet {
  text: string;
  tabStops: TabStop[];
  finalCursorOffset: number;
}

interface TabStop {
  index: number;
  offset: number;
  length: number;
  placeholder: string;
}

/**
 * Expand a snippet body, resolving tab stops and placeholders
 */
export function expandSnippet(body: string): ExpandedSnippet {
  const tabStops: TabStop[] = [];
  let text = "";
  let i = 0;
  let finalCursorOffset = -1;

  while (i < body.length) {
    // Escaped dollar
    if (body[i] === "\\" && body[i + 1] === "$") {
      text += "$";
      i += 2;
      continue;
    }

    // Tab stop: ${n:placeholder} or $n
    if (body[i] === "$") {
      i++;

      // ${n:placeholder}
      if (body[i] === "{") {
        i++;
        let numStr = "";
        while (i < body.length && body[i] >= "0" && body[i] <= "9") {
          numStr += body[i];
          i++;
        }
        const idx = parseInt(numStr) || 0;

        let placeholder = "";
        if (body[i] === ":") {
          i++;
          // Read until closing }
          let depth = 1;
          while (i < body.length && depth > 0) {
            if (body[i] === "{") depth++;
            if (body[i] === "}") {
              depth--;
              if (depth === 0) break;
            }
            placeholder += body[i];
            i++;
          }
          i++; // skip }
        } else if (body[i] === "}") {
          i++;
        }

        if (idx === 0) {
          finalCursorOffset = text.length;
        } else {
          tabStops.push({
            index: idx,
            offset: text.length,
            length: placeholder.length,
            placeholder,
          });
        }
        text += placeholder;
        continue;
      }

      // Simple $n
      let numStr = "";
      while (i < body.length && body[i] >= "0" && body[i] <= "9") {
        numStr += body[i];
        i++;
      }
      if (numStr) {
        const idx = parseInt(numStr);
        if (idx === 0) {
          finalCursorOffset = text.length;
        } else {
          tabStops.push({
            index: idx,
            offset: text.length,
            length: 0,
            placeholder: "",
          });
        }
        continue;
      }

      // Not a valid tab stop, just output the $
      text += "$";
      continue;
    }

    // Newline handling
    if (body[i] === "\\") {
      if (body[i + 1] === "n") {
        text += "\n";
        i += 2;
        continue;
      }
      if (body[i + 1] === "t") {
        text += "    ";
        i += 2;
        continue;
      }
    }

    text += body[i];
    i++;
  }

  // Sort tab stops by index
  tabStops.sort((a, b) => a.index - b.index);

  if (finalCursorOffset === -1) {
    finalCursorOffset = text.length;
  }

  return { text, tabStops, finalCursorOffset };
}

/**
 * Find matching snippet for text before cursor
 */
export function findSnippetMatch(
  textBeforeCursor: string,
  snippets: Snippet[]
): Snippet | null {
  // Get the last word before cursor
  const match = textBeforeCursor.match(/(\S+)$/);
  if (!match) return null;

  const prefix = match[1];
  return snippets.find((s) => s.prefix === prefix) ?? null;
}

// ── Laravel Snippets (built-in) ──

export const LARAVEL_SNIPPETS: Snippet[] = [
  {
    name: "Route GET",
    prefix: "rget",
    body: "Route::get('${1:uri}', [${2:Controller}::class, '${3:method}']);$0",
    description: "GETルートを定義",
  },
  {
    name: "Route POST",
    prefix: "rpost",
    body: "Route::post('${1:uri}', [${2:Controller}::class, '${3:method}']);$0",
    description: "POSTルートを定義",
  },
  {
    name: "Route Resource",
    prefix: "rres",
    body: "Route::resource('${1:name}', ${2:Controller}::class);$0",
    description: "リソースルートを定義",
  },
  {
    name: "Eloquent Where",
    prefix: "where",
    body: "->where('${1:column}', ${2:value})$0",
    description: "Eloquent whereクエリ",
  },
  {
    name: "Blade If",
    prefix: "bif",
    body: "@if (${1:condition})\n    $0\n@endif",
    description: "Blade @if ディレクティブ",
  },
  {
    name: "Blade ForEach",
    prefix: "bfor",
    body: "@foreach (${1:\\$items} as ${2:\\$item})\n    $0\n@endforeach",
    description: "Blade @foreach ディレクティブ",
  },
  {
    name: "Migration Column",
    prefix: "col",
    body: "\\$table->${1:string}('${2:column_name}')$0;",
    description: "マイグレーションのカラム定義",
  },
  {
    name: "Validation Rule",
    prefix: "vrul",
    body: "'${1:field}' => ['${2:required}', '${3:string}'],",
    description: "バリデーションルール",
  },
  {
    name: "Controller Method",
    prefix: "cfn",
    body: "public function ${1:method}(Request \\$request)${2:: JsonResponse}\n{\n    $0\n}",
    description: "コントローラーメソッド",
  },
  {
    name: "dd (Dump & Die)",
    prefix: "dd",
    body: "dd(${1:\\$variable});$0",
    description: "dd() デバッグ出力",
  },
];

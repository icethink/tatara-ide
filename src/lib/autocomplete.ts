// ⚒️ Autocomplete Engine
//
// Provides completion items based on context:
// - PHP: keywords, built-in functions, Laravel facades
// - HTML: tags, attributes
// - CSS/Tailwind: class names
// - Blade: directives
// - Snippets: prefix matching

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  detail?: string;
  insertText: string;
  sortPriority: number; // Lower = higher priority
}

export type CompletionKind =
  | "keyword"
  | "function"
  | "class"
  | "snippet"
  | "tag"
  | "attribute"
  | "value"
  | "directive"
  | "tailwind";

// ── PHP Completions ──

const PHP_BUILT_IN_FUNCTIONS = [
  "array_map", "array_filter", "array_reduce", "array_merge", "array_keys", "array_values",
  "array_push", "array_pop", "array_shift", "array_unshift", "array_slice", "array_splice",
  "count", "sizeof", "empty", "isset", "unset",
  "str_contains", "str_starts_with", "str_ends_with", "str_replace", "strlen", "strtolower", "strtoupper",
  "substr", "trim", "ltrim", "rtrim", "explode", "implode", "sprintf", "printf",
  "preg_match", "preg_replace", "preg_split",
  "json_encode", "json_decode",
  "intval", "floatval", "strval", "boolval",
  "is_array", "is_string", "is_int", "is_null", "is_bool", "is_numeric",
  "in_array", "array_key_exists", "array_search",
  "file_get_contents", "file_put_contents", "file_exists", "is_file", "is_dir",
  "date", "time", "strtotime", "mktime",
  "var_dump", "print_r", "dd", "dump",
];

const LARAVEL_FACADES = [
  "App", "Auth", "Blade", "Bus", "Cache", "Config", "Cookie", "Crypt",
  "DB", "Event", "File", "Gate", "Hash", "Http", "Lang", "Log",
  "Mail", "Notification", "Password", "Queue", "RateLimiter", "Redirect",
  "Request", "Response", "Route", "Schema", "Session", "Storage",
  "URL", "Validator", "View",
];

const LARAVEL_HELPERS = [
  "abort", "app", "auth", "back", "bcrypt", "blank",
  "cache", "collect", "config", "cookie", "csrf_field", "csrf_token",
  "dispatch", "env", "event", "filled", "info", "logger",
  "now", "old", "optional", "policy", "redirect", "report",
  "request", "rescue", "resolve", "response", "retry", "route",
  "session", "tap", "throw_if", "throw_unless", "today",
  "trans", "url", "validator", "value", "view", "with",
];

// ── HTML Completions ──

const HTML_TAGS = [
  "div", "span", "p", "a", "img", "ul", "ol", "li", "table", "tr", "td", "th",
  "form", "input", "button", "select", "option", "textarea", "label",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "footer", "nav", "main", "section", "article", "aside",
  "script", "style", "link", "meta",
];

const HTML_ATTRIBUTES = [
  "class", "id", "style", "href", "src", "alt", "title", "name", "value",
  "type", "placeholder", "required", "disabled", "readonly",
  "action", "method", "target", "rel",
  "data-", "aria-", "role",
  "@click", "@submit", "@change", "@input", // Vue events
  "v-if", "v-else", "v-for", "v-model", "v-bind", "v-on", "v-show", "v-slot", // Vue directives
  "x-data", "x-show", "x-if", "x-for", "x-model", "x-on", "x-bind", // Alpine.js
];

// ── Blade Directives ──

const BLADE_DIRECTIVES = [
  "@if", "@elseif", "@else", "@endif",
  "@foreach", "@endforeach", "@forelse", "@empty", "@endforelse",
  "@for", "@endfor", "@while", "@endwhile",
  "@switch", "@case", "@break", "@default", "@endswitch",
  "@unless", "@endunless",
  "@isset", "@endisset", "@empty", "@endempty",
  "@auth", "@endauth", "@guest", "@endguest",
  "@can", "@endcan", "@cannot", "@endcannot",
  "@section", "@endsection", "@yield", "@extends", "@include",
  "@component", "@endcomponent", "@slot", "@endslot",
  "@push", "@endpush", "@stack", "@prepend", "@endprepend",
  "@once", "@endonce", "@php", "@endphp",
  "@csrf", "@method", "@error", "@enderror",
  "@props", "@aware", "@class", "@style",
  "@vite", "@livewire", "@livewireStyles", "@livewireScripts",
];

// ── Tailwind CSS Classes (common subset) ──

const TAILWIND_SPACING = ["0", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24", "32", "40", "48", "64"];
const TAILWIND_COLORS = ["slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];
const TAILWIND_SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

function generateTailwindClasses(): string[] {
  const classes: string[] = [];

  // Layout
  classes.push("flex", "grid", "block", "inline", "inline-block", "hidden", "relative", "absolute", "fixed", "sticky");
  classes.push("items-center", "items-start", "items-end", "justify-center", "justify-between", "justify-start", "justify-end");
  classes.push("flex-row", "flex-col", "flex-wrap", "flex-1", "grow", "shrink-0");
  classes.push("container", "mx-auto", "overflow-hidden", "overflow-auto", "overflow-scroll");

  // Spacing
  for (const s of TAILWIND_SPACING) {
    classes.push(`p-${s}`, `px-${s}`, `py-${s}`, `pt-${s}`, `pb-${s}`, `pl-${s}`, `pr-${s}`);
    classes.push(`m-${s}`, `mx-${s}`, `my-${s}`, `mt-${s}`, `mb-${s}`, `ml-${s}`, `mr-${s}`);
    classes.push(`gap-${s}`, `space-x-${s}`, `space-y-${s}`);
    classes.push(`w-${s}`, `h-${s}`, `min-w-${s}`, `min-h-${s}`, `max-w-${s}`, `max-h-${s}`);
  }
  classes.push("w-full", "h-full", "w-screen", "h-screen", "w-auto", "h-auto", "min-h-screen");

  // Colors
  for (const color of TAILWIND_COLORS) {
    for (const shade of TAILWIND_SHADES) {
      classes.push(`text-${color}-${shade}`, `bg-${color}-${shade}`, `border-${color}-${shade}`);
    }
  }
  classes.push("text-white", "text-black", "bg-white", "bg-black", "bg-transparent");

  // Typography
  classes.push("text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl");
  classes.push("font-thin", "font-light", "font-normal", "font-medium", "font-semibold", "font-bold", "font-extrabold");
  classes.push("text-left", "text-center", "text-right", "text-justify");
  classes.push("leading-none", "leading-tight", "leading-normal", "leading-relaxed", "leading-loose");
  classes.push("tracking-tight", "tracking-normal", "tracking-wide");
  classes.push("truncate", "whitespace-nowrap", "break-words");

  // Borders & Rounded
  classes.push("border", "border-0", "border-2", "border-4", "border-t", "border-b", "border-l", "border-r");
  classes.push("rounded", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full", "rounded-none");

  // Effects
  classes.push("shadow", "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl", "shadow-none");
  classes.push("opacity-0", "opacity-25", "opacity-50", "opacity-75", "opacity-100");

  // Transitions
  classes.push("transition", "transition-all", "transition-colors", "transition-opacity", "transition-transform");
  classes.push("duration-150", "duration-200", "duration-300", "duration-500", "ease-in", "ease-out", "ease-in-out");

  return classes;
}

let _tailwindClasses: string[] | null = null;
function getTailwindClasses(): string[] {
  if (!_tailwindClasses) _tailwindClasses = generateTailwindClasses();
  return _tailwindClasses;
}

// ── Main Completion Function ──

export function getCompletions(
  textBeforeCursor: string,
  language: string,
  context?: { inTag?: boolean; inAttribute?: boolean; inClassAttr?: boolean }
): CompletionItem[] {
  const word = getWordBeforeCursor(textBeforeCursor);
  if (!word || word.length < 1) return [];

  const items: CompletionItem[] = [];
  const lower = word.toLowerCase();

  // Tailwind class completion (inside class="...")
  if (context?.inClassAttr) {
    const tw = getTailwindClasses();
    for (const cls of tw) {
      if (cls.startsWith(lower)) {
        items.push({
          label: cls,
          kind: "tailwind",
          insertText: cls,
          sortPriority: 1,
        });
      }
      if (items.length >= 30) break;
    }
    return items;
  }

  // Blade directives
  if (language === "blade" && word.startsWith("@")) {
    for (const dir of BLADE_DIRECTIVES) {
      if (dir.startsWith(word)) {
        items.push({
          label: dir,
          kind: "directive",
          detail: "Blade directive",
          insertText: dir,
          sortPriority: 0,
        });
      }
    }
    return items;
  }

  // HTML tag completion
  if ((language === "html" || language === "blade" || language === "vue") && context?.inTag === false) {
    for (const tag of HTML_TAGS) {
      if (tag.startsWith(lower)) {
        items.push({
          label: tag,
          kind: "tag",
          insertText: `<${tag}>$0</${tag}>`,
          sortPriority: 2,
        });
      }
    }
  }

  // HTML attribute completion
  if (context?.inTag) {
    for (const attr of HTML_ATTRIBUTES) {
      if (attr.startsWith(lower)) {
        items.push({
          label: attr,
          kind: "attribute",
          insertText: attr.endsWith("-") ? attr : `${attr}="$0"`,
          sortPriority: 2,
        });
      }
    }
  }

  // PHP completions
  if (language === "php" || language === "blade") {
    // Built-in functions
    for (const fn of PHP_BUILT_IN_FUNCTIONS) {
      if (fn.startsWith(lower)) {
        items.push({
          label: fn,
          kind: "function",
          detail: "PHP built-in",
          insertText: `${fn}($0)`,
          sortPriority: 3,
        });
      }
    }

    // Laravel facades
    for (const facade of LARAVEL_FACADES) {
      if (facade.toLowerCase().startsWith(lower)) {
        items.push({
          label: facade,
          kind: "class",
          detail: "Laravel Facade",
          insertText: `${facade}::$0`,
          sortPriority: 2,
        });
      }
    }

    // Laravel helpers
    for (const helper of LARAVEL_HELPERS) {
      if (helper.startsWith(lower)) {
        items.push({
          label: helper,
          kind: "function",
          detail: "Laravel helper",
          insertText: `${helper}($0)`,
          sortPriority: 2,
        });
      }
    }
  }

  // Sort by priority then alphabetically
  items.sort((a, b) => a.sortPriority - b.sortPriority || a.label.localeCompare(b.label));

  return items.slice(0, 50);
}

function getWordBeforeCursor(text: string): string {
  const match = text.match(/([a-zA-Z0-9_@$.-]+)$/);
  return match?.[1] ?? "";
}

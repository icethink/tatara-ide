// ⚒️ Tauri IPC Wrapper
// Type-safe wrappers around Tauri invoke commands

import { invoke } from "@tauri-apps/api/core";

// ── File System ──

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

export async function readDirectory(path: string): Promise<FileNode> {
  return invoke("read_directory", { path });
}

export async function readFile(path: string): Promise<{ content: string; encoding: string }> {
  return invoke("read_file", { path });
}

export async function writeFile(path: string, content: string): Promise<void> {
  return invoke("write_file", { path, content });
}

// ── Search ──

export interface SearchResult {
  path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

export interface SearchOptions {
  query: string;
  path: string;
  case_sensitive?: boolean;
  whole_word?: boolean;
  glob_filter?: string;
}

export async function searchFiles(opts: SearchOptions): Promise<SearchResult[]> {
  return invoke("search_files", opts);
}

// ── Framework Detection ──

export interface FrameworkInfo {
  name: string;
  version: string | null;
  detected_at: string;
}

export async function detectFramework(path: string): Promise<FrameworkInfo | null> {
  return invoke("detect_framework", { path });
}

export async function checkWslWarning(path: string): Promise<string | null> {
  return invoke("check_wsl_warning", { path });
}

// ── Laravel Profile ──

export interface ArtisanCommand {
  name: string;
  description: string;
  category: string;
}

export interface Snippet {
  name: string;
  prefix: string;
  body: string;
  description: string;
}

export async function getArtisanCommands(): Promise<ArtisanCommand[]> {
  return invoke("get_artisan_commands");
}

export async function getSnippets(framework: string): Promise<Snippet[]> {
  return invoke("get_snippets", { framework });
}

// ── Settings ──

export interface DefaultSettings {
  [key: string]: string | number | boolean;
}

export async function getDefaultSettings(): Promise<DefaultSettings> {
  return invoke("get_default_settings");
}

// ── Terminal ──

export interface CommandAnalysis {
  command: string;
  danger_level: "Safe" | "Medium" | "High";
  warning: string | null;
}

export interface PasteAnalysis {
  line_count: number;
  is_multiline: boolean;
  dangerous_commands: CommandAnalysis[];
  max_danger_level: "Safe" | "Medium" | "High";
}

export async function analyzeCommand(command: string): Promise<CommandAnalysis> {
  return invoke("analyze_command", { command });
}

export async function analyzePaste(content: string): Promise<PasteAnalysis> {
  return invoke("analyze_paste", { content });
}

export async function shouldUseRawMode(command: string): Promise<boolean> {
  return invoke("should_use_raw_mode", { command });
}

// ── .env ──

export interface EnvFile {
  values: Record<string, string>;
  warnings: { key: string; message: string; severity: string }[];
}

export interface DatabaseConfig {
  driver: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export async function parseEnv(path: string): Promise<EnvFile> {
  return invoke("parse_env", { path });
}

export async function getDbConfig(path: string): Promise<DatabaseConfig | null> {
  return invoke("get_db_config", { path });
}

// ── Theme ──

export interface ThemeInfo {
  name: string;
  theme_type: string;
  is_builtin: boolean;
  path: string | null;
}

export async function listThemes(userThemeDir?: string): Promise<ThemeInfo[]> {
  return invoke("list_themes", { userThemeDir: userThemeDir ?? null });
}

// ── i18n ──

export async function translate(key: string, locale?: string): Promise<string> {
  return invoke("translate", { key, locale: locale ?? null });
}

// Bridge between the web app and the Tauri native shell.
// When the app runs inside the Tauri desktop wrapper, `isTauri()` returns true
// and the typed wrappers below invoke Rust commands. Outside Tauri (regular
// browser), every wrapper returns null / throws so callers can fall back.

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { Command } from "@tauri-apps/plugin-shell";
import {
  readTextFile,
  writeTextFile,
  readDir,
  exists,
  mkdir,
  remove,
  rename,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

// ============================================================
// Detection
// ============================================================

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__);
}

async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    return (await tauriInvoke(cmd, args)) as T;
  } catch (err) {
    console.error(`[tauri] invoke(${cmd}) failed:`, err);
    return null;
  }
}

// ============================================================
// App info / screen
// ============================================================

export type NativeAppInfo = { name: string; version: string; platform: string };

export function appInfo(): Promise<NativeAppInfo | null> {
  return safeInvoke<NativeAppInfo>("app_info");
}

export type ScreenSize = { width: number; height: number };

// Browser API has this for free — no Rust roundtrip needed.
export function screenSize(): ScreenSize | null {
  if (typeof window === "undefined") return null;
  return { width: window.screen.width, height: window.screen.height };
}

// ============================================================
// Screenshot — returns base64 PNG of the primary monitor.
// First call on macOS triggers a Screen Recording permission prompt.
// ============================================================

export function takeScreenshot(): Promise<string | null> {
  return safeInvoke<string>("take_screenshot");
}

// ============================================================
// Mouse / keyboard
// First call on macOS triggers an Accessibility permission prompt.
// ============================================================

export function mouseMove(x: number, y: number): Promise<null> {
  return safeInvoke<null>("mouse_move", { x, y });
}

export function mouseClick(x: number, y: number, button: "left" | "right" | "middle" = "left"): Promise<null> {
  return safeInvoke<null>("mouse_click", { x, y, button });
}

export function keyboardType(text: string): Promise<null> {
  return safeInvoke<null>("keyboard_type", { text });
}

// Accepts "enter", "cmd+s", "cmd+shift+a", "f5", etc.
export function keyboardKey(combo: string): Promise<null> {
  return safeInvoke<null>("keyboard_key", { combo });
}

// ============================================================
// Shell — uses tauri-plugin-shell
// ============================================================

export type ShellResult = { stdout: string; stderr: string; code: number | null };

export async function runShell(program: string, args: string[] = []): Promise<ShellResult | null> {
  if (!isTauri()) return null;
  try {
    const out = await Command.create(program, args).execute();
    return { stdout: out.stdout, stderr: out.stderr, code: out.code };
  } catch (err) {
    console.error("[tauri] runShell failed:", err);
    return null;
  }
}

// ============================================================
// Filesystem — uses tauri-plugin-fs
// ============================================================

export async function readFile(path: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    return await readTextFile(path);
  } catch (err) {
    console.error("[tauri] readFile failed:", err);
    return null;
  }
}

export async function writeFile(path: string, contents: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await writeTextFile(path, contents);
    return true;
  } catch (err) {
    console.error("[tauri] writeFile failed:", err);
    return false;
  }
}

export async function listDir(path: string): Promise<string[] | null> {
  if (!isTauri()) return null;
  try {
    const entries = await readDir(path);
    return entries.map((e) => e.name).filter((n): n is string => typeof n === "string");
  } catch (err) {
    console.error("[tauri] listDir failed:", err);
    return null;
  }
}

export async function pathExists(path: string): Promise<boolean | null> {
  if (!isTauri()) return null;
  try { return await exists(path); }
  catch (err) { console.error("[tauri] exists failed:", err); return null; }
}

export async function makeDir(path: string): Promise<boolean> {
  if (!isTauri()) return false;
  try { await mkdir(path, { recursive: true }); return true; }
  catch (err) { console.error("[tauri] mkdir failed:", err); return false; }
}

export async function removePath(path: string): Promise<boolean> {
  if (!isTauri()) return false;
  try { await remove(path, { recursive: true }); return true; }
  catch (err) { console.error("[tauri] remove failed:", err); return false; }
}

export async function renamePath(from: string, to: string): Promise<boolean> {
  if (!isTauri()) return false;
  try { await rename(from, to); return true; }
  catch (err) { console.error("[tauri] rename failed:", err); return false; }
}

// ============================================================
// Dialogs — file picker for "let user choose what Jarvis touches"
// ============================================================

export async function pickFile(opts?: { multiple?: boolean; directory?: boolean }): Promise<string | string[] | null> {
  if (!isTauri()) return null;
  try {
    const result = await openDialog({
      multiple: opts?.multiple ?? false,
      directory: opts?.directory ?? false,
    });
    return result ?? null;
  } catch (err) {
    console.error("[tauri] pickFile failed:", err);
    return null;
  }
}

export async function pickSavePath(defaultPath?: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const result = await saveDialog({ defaultPath });
    return result ?? null;
  } catch (err) {
    console.error("[tauri] pickSavePath failed:", err);
    return null;
  }
}

// Re-export BaseDirectory so callers can pass scoped paths if they want
export { BaseDirectory };

// Bridge between the web app and the Tauri native shell.
// When the app runs inside the Tauri desktop wrapper, `isTauri()` returns true
// and the typed wrappers below can invoke Rust commands. Outside Tauri (regular
// browser), every wrapper returns null so the same code path stays safe.

type TauriGlobal = {
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
};

function getTauri(): TauriGlobal | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __TAURI__?: TauriGlobal; __TAURI_INTERNALS__?: TauriGlobal };
  // Tauri v2 exposes the API under `__TAURI_INTERNALS__` for the core invoke;
  // the high-level `@tauri-apps/api/core` module also writes `__TAURI__` when imported.
  return w.__TAURI_INTERNALS__ ?? w.__TAURI__ ?? null;
}

export function isTauri(): boolean {
  return getTauri() !== null;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  const t = getTauri();
  if (!t?.invoke) return null;
  try {
    return (await t.invoke(cmd, args)) as T;
  } catch (err) {
    console.error(`[tauri] invoke(${cmd}) failed:`, err);
    return null;
  }
}

export type NativeAppInfo = { name: string; version: string; platform: string };

export function appInfo(): Promise<NativeAppInfo | null> {
  return invoke<NativeAppInfo>("app_info");
}

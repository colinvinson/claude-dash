use base64::Engine;
use enigo::{Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use serde::Serialize;
use std::fs;
use std::process::Command;

// ============================================================
// Shared types
// ============================================================

#[derive(Serialize)]
struct AppInfo {
    name: String,
    version: String,
    platform: String,
}

// ============================================================
// Info / ping
// ============================================================

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
    }
}

// ============================================================
// Screenshot — shells to macOS `screencapture` (zero deps, native quality).
// First call prompts for Screen Recording permission.
// ============================================================

#[tauri::command]
fn take_screenshot() -> Result<String, String> {
    let tmp_path = std::env::temp_dir().join(format!(
        "jarvis-screenshot-{}.png",
        std::process::id()
    ));

    let status = if cfg!(target_os = "macos") {
        Command::new("screencapture")
            .arg("-t").arg("png")
            .arg("-x") // suppress shutter sound
            .arg(&tmp_path)
            .status()
            .map_err(|e| format!("screencapture exec failed: {}", e))?
    } else {
        return Err(format!(
            "take_screenshot not implemented for {}",
            std::env::consts::OS
        ));
    };

    if !status.success() {
        return Err(format!("screencapture exited with status {:?}", status.code()));
    }

    let bytes = fs::read(&tmp_path).map_err(|e| format!("read screenshot failed: {}", e))?;
    let _ = fs::remove_file(&tmp_path);

    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

// ============================================================
// Mouse / keyboard via enigo
// First call on macOS triggers an Accessibility permission prompt.
// ============================================================

fn new_enigo() -> Result<Enigo, String> {
    Enigo::new(&Settings::default()).map_err(|e| e.to_string())
}

#[tauri::command]
fn mouse_move(x: i32, y: i32) -> Result<(), String> {
    let mut enigo = new_enigo()?;
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn mouse_click(x: i32, y: i32, button: Option<String>) -> Result<(), String> {
    let mut enigo = new_enigo()?;
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| e.to_string())?;
    let btn = match button.as_deref().unwrap_or("left") {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    };
    enigo.button(btn, Direction::Click).map_err(|e| e.to_string())
}

#[tauri::command]
fn keyboard_type(text: String) -> Result<(), String> {
    let mut enigo = new_enigo()?;
    enigo.text(&text).map_err(|e| e.to_string())
}

fn parse_key(name: &str) -> Key {
    match name.to_lowercase().as_str() {
        "cmd" | "command" | "meta" | "super" => Key::Meta,
        "ctrl" | "control" => Key::Control,
        "shift" => Key::Shift,
        "alt" | "option" => Key::Alt,
        "enter" | "return" => Key::Return,
        "tab" => Key::Tab,
        "esc" | "escape" => Key::Escape,
        "space" => Key::Space,
        "backspace" => Key::Backspace,
        "delete" => Key::Delete,
        "up" => Key::UpArrow,
        "down" => Key::DownArrow,
        "left" => Key::LeftArrow,
        "right" => Key::RightArrow,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" => Key::PageUp,
        "pagedown" => Key::PageDown,
        "f1" => Key::F1, "f2" => Key::F2, "f3" => Key::F3, "f4" => Key::F4,
        "f5" => Key::F5, "f6" => Key::F6, "f7" => Key::F7, "f8" => Key::F8,
        "f9" => Key::F9, "f10" => Key::F10, "f11" => Key::F11, "f12" => Key::F12,
        s if s.chars().count() == 1 => Key::Unicode(s.chars().next().unwrap()),
        s => Key::Unicode(s.chars().next().unwrap_or(' ')),
    }
}

#[tauri::command]
fn keyboard_key(combo: String) -> Result<(), String> {
    let parts: Vec<&str> = combo.split('+').collect();
    if parts.is_empty() {
        return Err("empty combo".into());
    }
    let mut enigo = new_enigo()?;
    let modifiers: Vec<Key> = parts[..parts.len() - 1].iter().map(|p| parse_key(p)).collect();
    let main = parse_key(parts.last().unwrap());

    for m in &modifiers {
        enigo.key(*m, Direction::Press).map_err(|e| e.to_string())?;
    }
    let main_result = enigo.key(main, Direction::Click).map_err(|e| e.to_string());
    for m in modifiers.iter().rev() {
        let _ = enigo.key(*m, Direction::Release);
    }
    main_result
}

// ============================================================
// Entry
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            app_info,
            take_screenshot,
            mouse_move,
            mouse_click,
            keyboard_type,
            keyboard_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

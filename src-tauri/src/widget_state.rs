//! Persist widget coordinates separately from task data; never bundled with the app.
use tauri::Manager;

#[derive(serde::Serialize, serde::Deserialize)]
struct Position { x: i32, y: i32 }

pub fn save(app: &tauri::AppHandle) {
  let Some(window) = app.get_webview_window("widget") else { return };
  // Hidden startup windows must not overwrite the previous session's position.
  if !window.is_visible().unwrap_or(false) { return; }
  let (Ok(position), Ok(dir)) = (window.outer_position(), app.path().app_data_dir()) else { return };
  let result = (|| -> Result<(), Box<dyn std::error::Error>> {
    std::fs::create_dir_all(&dir)?;
    let bytes = serde_json::to_vec(&Position { x: position.x, y: position.y })?;
    std::fs::write(dir.join("widget-position.json"), bytes)?;
    Ok(())
  })();
  if let Err(error) = result { log::warn!("Cannot save widget position: {error}"); }
}

pub fn restore(app: &tauri::AppHandle) {
  let Some(window) = app.get_webview_window("widget") else { return };
  let Ok(dir) = app.path().app_data_dir() else { return };
  let Ok(bytes) = std::fs::read(dir.join("widget-position.json")) else { return };
  let Ok(position) = serde_json::from_slice::<Position>(&bytes) else { return };
  // If a screen was unplugged, use the default screen and let normal snapping constrain it.
  let reachable = window.available_monitors().unwrap_or_default().iter().any(|m| {
    let p = m.position(); let s = m.size();
    position.x >= p.x && position.y >= p.y
      && (position.x as i64) < p.x as i64 + s.width as i64
      && (position.y as i64) < p.y as i64 + s.height as i64
  });
  if reachable {
    let _ = window.set_position(tauri::PhysicalPosition::new(position.x, position.y));
  }
}

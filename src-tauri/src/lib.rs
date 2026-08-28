#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  maybe_clear_webview_cache();
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .plugin(tauri_plugin_http::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// 安装包白屏根因（2026-08-28 实测定位）：旧版本注册过 Service Worker（public/sw.js），
/// 其 CacheStorage 里缓存了旧 index.html；SW 静态资源缓存优先 + 导航离线回退应用壳，
/// 冷启动时把旧 html 吐给页面，引用的旧 JS hash 在新包里不存在 → 模块加载失败 → 白屏。
/// 桌面端已不走 SW（main.tsx 在 Tauri 环境跳过注册），因此每次启动直接删除 SW 注册与缓存；
/// 版本变化（或首次运行）时顺手清 HTTP/代码缓存，不动 IndexedDB / LocalStorage 用户数据。
#[cfg(target_os = "windows")]
fn maybe_clear_webview_cache() {
  use std::{env, fs, path::Path};
  let Ok(local) = env::var("LOCALAPPDATA") else { return };
  let app_dir = Path::new(&local).join("com.tickverse.app");
  let eb = app_dir.join("EBWebView");
  // 桌面端不使用 Service Worker，旧注册的 SW 会供出过期 index.html，必须每次清掉
  let _ = fs::remove_dir_all(eb.join("Default/Service Worker"));
  let marker = app_dir.join("cache-version");
  let current = env!("CARGO_PKG_VERSION");
  let fresh = fs::read_to_string(&marker).map(|v| v.trim() == current).unwrap_or(false);
  if fresh {
    return;
  }
  for sub in ["Default/Cache", "Default/Code Cache", "GPUCache", "GrShaderCache"] {
    let _ = fs::remove_dir_all(eb.join(sub));
  }
  let _ = fs::create_dir_all(&app_dir);
  let _ = fs::write(&marker, current);
}

#[cfg(not(target_os = "windows"))]
fn maybe_clear_webview_cache() {}

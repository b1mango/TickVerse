use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  maybe_clear_webview_cache();
  let app = tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      widget_set_visible,
      widget_set_size,
      widget_resize_begin,
      widget_set_frame,
      widget_resize_end,
      widget_set_opacity,
      widget_snap_now,
      main_window_show
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      setup_widget_desktop(app)?;
      setup_widget_snap(app)?;
      #[cfg(target_os = "macos")]
      setup_close_to_hide(app)?;
      Ok(())
    })
    .plugin(tauri_plugin_http::init())
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    // Dock 点击：主窗隐藏（关窗不退出）时只亮组件不回主窗——Reopen 强制唤起主窗
    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Reopen { .. } = event {
      let _ = main_window_show(app_handle.clone());
    }
  });
}

/* ---------- 桌面组件（M7） ---------- */

/// 桌面组件显隐（设置页开关 / 启动时恢复上次状态）
#[tauri::command]
fn widget_set_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
  let Some(w) = app.get_webview_window("widget") else {
    return Ok(());
  };
  if visible {
    w.show().map_err(|e| e.to_string())?;
    // show() 会提序到其层级顶部，首次显示曾浮到应用之上——重钉桌面层级再压到层级底
    #[cfg(target_os = "macos")]
    {
      pin_widget_to_desktop(&w);
      cache_screen_insets(&w);
    }
    // 首次显示（默认居中）也要过吸附：等 show 的几何状态落地后再排入唯一吸附队列。
    schedule_snap(w, SNAP_INITIAL_MS);
    Ok(())
  } else {
    w.hide().map_err(|e| e.to_string())
  }
}

/// 松手立即吸附（JS 侧 pointerup 快路；native drag 收不到 pointerup 时由 600ms 静默兜底）
#[tauri::command]
fn widget_snap_now(app: tauri::AppHandle) -> Result<(), String> {
  let Some(w) = app.get_webview_window("widget") else {
    return Ok(());
  };
  schedule_snap(w, SNAP_NOW_MS);
  Ok(())
}

/// 组件窗口尺寸（组件边缘拖拽落地 + 启动恢复上次拖拽结果；逻辑像素）
#[tauri::command]
fn widget_set_size(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
  let Some(w) = app.get_webview_window("widget") else {
    return Ok(());
  };
  w.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
    .map_err(|e| e.to_string())
}

/// macOS 原生窗口 frame。坐标是 NSWindow 的左下角坐标，避免把 AppKit 与 tao 的左上角
/// 坐标在每一帧里来回换算；前端只提交相对 pointerdown 的增量，后端一次 setFrame 同时改
/// 原点与尺寸。
#[derive(Clone, Copy, serde::Serialize)]
struct WidgetNativeFrame {
  x: f64,
  y: f64,
  width: f64,
  height: f64,
}

const WIDGET_MIN_WIDTH: f64 = 460.0;
const WIDGET_MIN_HEIGHT: f64 = 340.0;
const MAIN_THREAD_TIMEOUT_MS: u64 = 500;

#[derive(Clone, Copy)]
enum WidgetResizeDirection {
  East,
  West,
  North,
  South,
  NorthEast,
  NorthWest,
  SouthEast,
  SouthWest,
}

impl WidgetResizeDirection {
  fn parse(value: &str) -> Option<Self> {
    Some(match value {
      "East" => Self::East,
      "West" => Self::West,
      "North" => Self::North,
      "South" => Self::South,
      "NorthEast" => Self::NorthEast,
      "NorthWest" => Self::NorthWest,
      "SouthEast" => Self::SouthEast,
      "SouthWest" => Self::SouthWest,
      _ => return None,
    })
  }

  fn east(self) -> bool {
    matches!(self, Self::East | Self::NorthEast | Self::SouthEast)
  }

  fn west(self) -> bool {
    matches!(self, Self::West | Self::NorthWest | Self::SouthWest)
  }

  fn north(self) -> bool {
    matches!(self, Self::North | Self::NorthEast | Self::NorthWest)
  }

  fn south(self) -> bool {
    matches!(self, Self::South | Self::SouthEast | Self::SouthWest)
  }
}

#[derive(Clone, Copy)]
struct WidgetFrameBounds {
  left: f64,
  bottom: f64,
  right: f64,
  top: f64,
}

/// 按 resize 方向固定对边，再限制移动边。
/// AppKit 坐标原点在左下角：South 固定上边、North 固定下边，避免到 Dock 后上边反向增长。
fn constrain_widget_frame(
  direction: Option<WidgetResizeDirection>,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
  bounds: WidgetFrameBounds,
) -> (f64, f64, f64, f64) {
  let max_width = (bounds.right - bounds.left).max(0.0);
  let max_height = (bounds.top - bounds.bottom).max(0.0);
  let min_width = WIDGET_MIN_WIDTH.min(max_width);
  let min_height = WIDGET_MIN_HEIGHT.min(max_height);
  let mut next_width = width.max(min_width).min(max_width);
  let mut next_height = height.max(min_height).min(max_height);
  let mut next_x = x.clamp(bounds.left, bounds.right - next_width);
  let mut next_y = y.clamp(bounds.bottom, bounds.top - next_height);

  if let Some(direction) = direction {
    if direction.west() {
      let right_anchor = (x + width).clamp(bounds.left + min_width, bounds.right);
      next_width = width.max(min_width).min(right_anchor - bounds.left);
      next_x = right_anchor - next_width;
    } else if direction.east() {
      let left_anchor = x.clamp(bounds.left, bounds.right - min_width);
      next_width = width.max(min_width).min(bounds.right - left_anchor);
      next_x = left_anchor;
    }

    if direction.south() {
      let top_anchor = (y + height).clamp(bounds.bottom + min_height, bounds.top);
      next_height = height.max(min_height).min(top_anchor - bounds.bottom);
      next_y = top_anchor - next_height;
    } else if direction.north() {
      let bottom_anchor = y.clamp(bounds.bottom, bounds.top - min_height);
      next_height = height.max(min_height).min(bounds.top - bottom_anchor);
      next_y = bottom_anchor;
    }
  }

  (next_x, next_y, next_width, next_height)
}

/// 所有 AppKit frame 操作都在主线程执行，并等待动作真正完成。
/// Tauri/tao 的 set_size/set_position 本身是异步派发的，不能把两个调用当作一组原子更新。
fn run_on_main_thread_sync<T, F>(app: &tauri::AppHandle, f: F) -> Result<T, String>
where
  T: Send + 'static,
  F: FnOnce() -> Result<T, String> + Send + 'static,
{
  let (tx, rx) = std::sync::mpsc::sync_channel(1);
  app.run_on_main_thread(move || {
    let _ = tx.send(f());
  })
  .map_err(|e| e.to_string())?;
  rx.recv_timeout(std::time::Duration::from_millis(MAIN_THREAD_TIMEOUT_MS))
    .map_err(|_| "窗口主线程操作超时".to_string())?
}

/// 开始一次原子 resize：记录 AppKit 的真实 frame，并暂停移动事件的自动吸附。
#[tauri::command]
fn widget_resize_begin(app: tauri::AppHandle) -> Result<WidgetNativeFrame, String> {
  WIDGET_RESIZE_ACTIVE.store(true, std::sync::atomic::Ordering::SeqCst);
  SNAP_GENERATION.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

  #[cfg(target_os = "macos")]
  {
    let app_for_task = app.clone();
    let result = run_on_main_thread_sync(&app, move || {
      let Some(window) = app_for_task.get_webview_window("widget") else {
        return Err("组件窗口不存在".to_string());
      };
      let raw = window.ns_window().map_err(|e| e.to_string())?;
      let ns = unsafe { &*(raw as *const objc2_app_kit::NSWindow) };
      let frame = ns.frame();
      Ok(WidgetNativeFrame {
        x: frame.origin.x,
        y: frame.origin.y,
        width: frame.size.width,
        height: frame.size.height,
      })
    });
    if result.is_err() {
      WIDGET_RESIZE_ACTIVE.store(false, std::sync::atomic::Ordering::SeqCst);
    }
    return result;
  }

  #[cfg(not(target_os = "macos"))]
  {
    let Some(window) = app.get_webview_window("widget") else {
      WIDGET_RESIZE_ACTIVE.store(false, std::sync::atomic::Ordering::SeqCst);
      return Err("组件窗口不存在".to_string());
    };
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size();
    let scale = window.scale_factor().unwrap_or(1.0);
    return Ok(WidgetNativeFrame {
      x: position.x as f64 / scale,
      y: position.y as f64 / scale,
      width: size.width as f64 / scale,
      height: size.height as f64 / scale,
    });
  }
}

/// 以一个完整 frame 原子更新组件窗口。macOS 侧顺便把 frame 限制在 NSScreen.visibleFrame，
/// 因而下边缘最多到 Dock 上缘，不会再被 tao 的两个异步调用互相覆盖。
#[tauri::command]
fn widget_set_frame(
  app: tauri::AppHandle,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
  direction: String,
) -> Result<(), String> {
  if ![x, y, width, height].iter().all(|v| v.is_finite()) {
    return Err("组件 frame 参数无效".to_string());
  }
  let resize_direction = WidgetResizeDirection::parse(&direction);

  #[cfg(target_os = "macos")]
  {
    let app_for_task = app.clone();
    return run_on_main_thread_sync(&app, move || {
      let Some(window) = app_for_task.get_webview_window("widget") else {
        return Err("组件窗口不存在".to_string());
      };
      let raw = window.ns_window().map_err(|e| e.to_string())?;
      let ns = unsafe { &*(raw as *const objc2_app_kit::NSWindow) };
      let Some(screen) = ns.screen() else {
        return Err("组件没有关联屏幕".to_string());
      };
      let visible = screen.visibleFrame();
      let (next_x, next_y, next_width, next_height) = constrain_widget_frame(
        resize_direction,
        x,
        y,
        width,
        height,
        WidgetFrameBounds {
          left: visible.origin.x,
          bottom: visible.origin.y,
          right: visible.origin.x + visible.size.width,
          top: visible.origin.y + visible.size.height,
        },
      );
      let mut frame = ns.frame();
      frame.origin.x = next_x;
      frame.origin.y = next_y;
      frame.size.width = next_width;
      frame.size.height = next_height;
      ns.setFrame_display_animate(frame, true, false);
      Ok(())
    });
  }

  #[cfg(not(target_os = "macos"))]
  {
    let _ = resize_direction;
    let Some(window) = app.get_webview_window("widget") else {
      return Ok(());
    };
    window
      .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
      .map_err(|e| e.to_string())?;
    window
      .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
      .map_err(|e| e.to_string())
  }
}

/// 结束 resize，取消 resize 期间产生的旧吸附计时器。
#[tauri::command]
fn widget_resize_end() -> Result<(), String> {
  WIDGET_RESIZE_ACTIVE.store(false, std::sync::atomic::Ordering::SeqCst);
  SNAP_GENERATION.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
  Ok(())
}

/// 组件透明度（设置页滑动条；0.3–1.0）。Tauri 2 无跨平台 set_opacity，macOS 直调 NSWindow
#[tauri::command]
fn widget_set_opacity(app: tauri::AppHandle, opacity: f64) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  if let Some(w) = app.get_webview_window("widget") {
    use objc2_app_kit::NSWindow;
    if let Ok(ns_window) = w.ns_window() {
      let ns = unsafe { &*(ns_window as *const NSWindow) };
      ns.setAlphaValue(opacity.clamp(0.3, 1.0));
    }
  }
  #[cfg(not(target_os = "macos"))]
  let _ = (app, opacity);
  Ok(())
}

/// 显示并聚焦主窗口（桌面组件头部按钮 / Dock Reopen 共用）
#[tauri::command]
fn main_window_show(app: tauri::AppHandle) -> Result<(), String> {
  let Some(w) = app.get_webview_window("main") else {
    return Ok(());
  };
  w.show().map_err(|e| e.to_string())?;
  w.set_focus().map_err(|e| e.to_string())
}

/// 让组件窗口启动即处于桌面形态（窗口配置 alwaysOnBottom 之外的 macOS 专项补充）
fn setup_widget_desktop(app: &tauri::App) -> tauri::Result<()> {
  #[cfg(target_os = "macos")]
  if let Some(w) = app.get_webview_window("widget") {
    pin_widget_to_desktop(&w);
    cache_screen_insets(&w);
  }
  Ok(())
}

/// 屏幕可见区边距缓存（top/right/bottom/left，AppKit 点 = 逻辑像素）：
/// 取 NSScreen.visibleFrame（自动让出菜单栏与 Dock 栏——Dock 显隐/厚薄全适配）。
/// NSScreen 必须在主线程访问，故在 setup 与每次显示时刷新缓存，吸附线程只读缓存。
#[cfg(target_os = "macos")]
static SCREEN_INSETS: std::sync::Mutex<(f64, f64, f64, f64)> = std::sync::Mutex::new((0.0, 0.0, 0.0, 0.0));

#[cfg(target_os = "macos")]
fn cache_screen_insets(window: &tauri::WebviewWindow) {
  use objc2_app_kit::{NSScreen, NSWindow};
  let Ok(raw) = window.ns_window() else {
    return;
  };
  let ns = unsafe { &*(raw as *const NSWindow) };
  let Some(screen): Option<objc2::rc::Retained<NSScreen>> = ns.screen() else {
    return;
  };
  let full = screen.frame();
  let vis = screen.visibleFrame();
  let top = (full.origin.y + full.size.height) - (vis.origin.y + vis.size.height);
  let bottom = vis.origin.y - full.origin.y;
  let left = vis.origin.x - full.origin.x;
  let right = (full.origin.x + full.size.width) - (vis.origin.x + vis.size.width);
  if let Ok(mut g) = SCREEN_INSETS.lock() {
    *g = (top, right, bottom, left);
  }
}

/// macOS 桌面形态（2026-10-06 修订九用户钦定）：
/// - 置底：层级 = 桌面图标层 +1（普通窗口之下），每次钉附都 orderBack 压到层级底，
///   修复"设置页首次点显示时浮到所有应用之上"；
/// - `Stationary`：临时"显示桌面"手势（四指张开/触发角）不随其他应用隐去；
/// - `CanJoinAllSpaces|IgnoresCycle`：跨 Space 跟随、不进 Cmd+Tab 与窗口循环；
/// - 交互不被限：双击编辑、录入、拖拽照常。
#[cfg(target_os = "macos")]
fn pin_widget_to_desktop(window: &tauri::WebviewWindow) {
  use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
  const K_CG_DESKTOP_ICON_WINDOW_LEVEL: isize = -2_147_483_603;
  let Ok(ns_window) = window.ns_window() else {
    return;
  };
  // Tauri 交出的就是 NSWindow 指针；借用调用，不改变所有权
  let ns = unsafe { &*(ns_window as *const NSWindow) };
  ns.setLevel(K_CG_DESKTOP_ICON_WINDOW_LEVEL + 1);
  ns.setCollectionBehavior(
    NSWindowCollectionBehavior::CanJoinAllSpaces
      | NSWindowCollectionBehavior::Stationary
      | NSWindowCollectionBehavior::IgnoresCycle,
  );
  ns.orderBack(None::<&objc2::runtime::AnyObject>);
}

/* ---------- 组件位置吸附 ---------- */

/// 拖动停止后的静默判定窗口（毫秒）：Moved 事件在拖动中连续触发，静默满窗视为拖拽结束。
/// 600ms 只作 native drag 收不到 pointerup 的兜底；正常松手走 SNAP_NOW_MS。
const SNAP_IDLE_MS: u64 = 600;
/// 首次显示等待窗口几何状态落地
const SNAP_INITIAL_MS: u64 = 450;
/// 松手快路：JS pointerup 触发的吸附延迟
const SNAP_NOW_MS: u64 = 150;
/// 屏幕边缘与原生组件边缘的磁吸触发距离。
const SNAP_THRESHOLD: f64 = 28.0;
/// 组件与可见区/其他组件之间的实际间隙。
const SNAP_MARGIN: f64 = 16.0;
const SNAP_GAP: f64 = 8.0;
/// 避让 macOS 原生组件时的外扩间隙
const WIDGET_AVOID_MARGIN: f64 = 6.0;

/// 所有吸附入口共用这组状态：旧计时器只要代数过期就不能再改窗口位置。
static SNAP_GENERATION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static SNAP_RUNNING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static WIDGET_RESIZE_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// 把一次吸附排入队列。Moved、pointerup、首次显示都只能通过这里进入，避免多个线程同时
/// 计算候选并交错 set_position。
fn schedule_snap(w: tauri::WebviewWindow, delay_ms: u64) {
  use std::sync::atomic::Ordering;
  let my = SNAP_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
  std::thread::spawn(move || {
    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
    if SNAP_GENERATION.load(Ordering::SeqCst) != my
      || WIDGET_RESIZE_ACTIVE.load(Ordering::SeqCst)
    {
      return;
    }
    if SNAP_RUNNING
      .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
      .is_err()
    {
      return;
    }
    if SNAP_GENERATION.load(Ordering::SeqCst) == my
      && !WIDGET_RESIZE_ACTIVE.load(Ordering::SeqCst)
    {
      snap_window(&w);
    }
    SNAP_RUNNING.store(false, Ordering::SeqCst);
  });
}

/// 位置吸附：①按 NSScreen.visibleFrame 钳回菜单栏/Dock 之外；②仅在靠近真实屏幕边缘
/// 或原生组件边缘时磁吸；③如果松手时已经压住原生组件，则无条件寻找最近的相邻空位。
fn setup_widget_snap(app: &tauri::App) -> tauri::Result<()> {
  let Some(widget) = app.get_webview_window("widget") else {
    return Ok(());
  };
  let w = widget.clone();
  widget.on_window_event(move |event| {
    if !matches!(event, tauri::WindowEvent::Moved(_)) {
      return;
    }
    #[cfg(target_os = "macos")]
    // 移动到另一块屏幕或 Dock 改变显隐后，重新读取当前屏幕的 visibleFrame。
    cache_screen_insets(&w);
    schedule_snap(w.clone(), SNAP_IDLE_MS);
  });
  Ok(())
}

struct SnapRect {
  x: f64,
  y: f64,
  w: f64,
  h: f64,
}

impl SnapRect {
  fn intersects(&self, o: &SnapRect) -> bool {
    self.x < o.x + o.w && o.x < self.x + self.w && self.y < o.y + o.h && o.y < self.y + o.h
  }

  fn overlap_area(&self, o: &SnapRect) -> f64 {
    ((self.x + self.w).min(o.x + o.w) - self.x.max(o.x)).max(0.0)
      * ((self.y + self.h).min(o.y + o.h) - self.y.max(o.y)).max(0.0)
  }
}

#[derive(Clone, Copy)]
struct SnapBounds {
  left: f64,
  top: f64,
  right: f64,
  bottom: f64,
}

impl SnapBounds {
  fn is_valid(&self) -> bool {
    self.right >= self.left && self.bottom >= self.top
  }

  fn contains(&self, x: f64, y: f64) -> bool {
    x >= self.left && y >= self.top && x <= self.right && y <= self.bottom
  }

  fn clamp(&self, x: f64, y: f64) -> (f64, f64) {
    (x.clamp(self.left, self.right), y.clamp(self.top, self.bottom))
  }
}

/// 平台无关的边距读取（非 macOS 恒 0 → 常量边距生效）
fn screen_insets() -> (f64, f64, f64, f64) {
  #[cfg(target_os = "macos")]
  if let Ok(g) = SCREEN_INSETS.lock() {
    return *g;
  }
  (0.0, 0.0, 0.0, 0.0)
}

fn snap_window(w: &tauri::WebviewWindow) {
  let (Ok(pos), Ok(size), Ok(Some(monitor))) = (w.outer_position(), w.outer_size(), w.current_monitor())
  else {
    return;
  };
  let sf = w.scale_factor().unwrap_or(1.0);
  let (px, py) = (pos.x as f64 / sf, pos.y as f64 / sf);
  let (ww, wh) = (size.width as f64 / sf, size.height as f64 / sf);
  let (mx, my) = (
    monitor.position().x as f64 / sf,
    monitor.position().y as f64 / sf,
  );
  let (mw, mh) = (
    monitor.size().width as f64 / sf,
    monitor.size().height as f64 / sf,
  );

  // visibleFrame 缓存提供菜单栏/Dock 的真实占用。这里的坐标是左上角原点，
  // 与 CGWindowList 返回的原生组件坐标一致。
  let (tp, rp, bp, lp) = screen_insets();
  let bounds = SnapBounds {
    left: mx + SNAP_MARGIN.max(lp + SNAP_GAP),
    top: my + SNAP_MARGIN.max(tp + SNAP_GAP),
    right: mx + mw - SNAP_MARGIN.max(rp + SNAP_GAP) - ww,
    bottom: my + mh - SNAP_MARGIN.max(bp + SNAP_GAP) - wh,
  };

  // 窗口已经大到没有上下移动空间时，先缩到可见区，再由下一次 Moved 事件重算。
  // 绝不把 bottom bound 强行 max 到 top bound，否则组件会永久卡在屏幕上半区。
  if !bounds.is_valid() {
    let _ = w.set_size(tauri::Size::Logical(tauri::LogicalSize {
      width: ww.min((mw - lp - rp - SNAP_MARGIN * 2.0).max(WIDGET_MIN_WIDTH)),
      height: wh.min((mh - tp - bp - SNAP_MARGIN * 2.0).max(WIDGET_MIN_HEIGHT)),
    }));
    return;
  }

  let obstacles = native_widget_frames();
  let (tx, ty) = snap_target(px, py, ww, wh, bounds, &obstacles);
  if (tx - px).abs() + (ty - py).abs() >= 0.5 {
    let _ = w.set_position(tauri::Position::Logical(tauri::LogicalPosition { x: tx, y: ty }));
  }
}

/// Only collide with real rectangles; proximity is local on both axes.
fn snap_target(px: f64, py: f64, ww: f64, wh: f64, bounds: SnapBounds, obstacles: &[SnapRect]) -> (f64, f64) {
  let (cx, cy) = bounds.clamp(px, py);
  let overlaps = |x, y| obstacles.iter().any(|o| (SnapRect { x, y, w: ww, h: wh }).intersects(o));
  if overlaps(cx, cy) {
    return least_overlap_position(cx, cy, ww, wh, bounds, obstacles);
  }
  let mut xs = vec![cx];
  let mut ys = vec![cy];
  for x in [bounds.left, bounds.right] {
    if (x - cx).abs() <= SNAP_THRESHOLD { xs.push(x); }
  }
  for y in [bounds.top, bounds.bottom] {
    if (y - cy).abs() <= SNAP_THRESHOLD { ys.push(y); }
  }
  for o in obstacles {
    if cy < o.y + o.h && o.y < cy + wh {
      for x in [o.x - ww - SNAP_GAP, o.x + o.w + SNAP_GAP] {
        if (x - cx).abs() <= SNAP_THRESHOLD && bounds.contains(x, cy) { xs.push(x); }
      }
    }
    if cx < o.x + o.w && o.x < cx + ww {
      for y in [o.y - wh - SNAP_GAP, o.y + o.h + SNAP_GAP] {
        if (y - cy).abs() <= SNAP_THRESHOLD && bounds.contains(cx, y) { ys.push(y); }
      }
    }
  }
  // Snap nearby axes together; never prefer a remote component over the drop position.
  let mut target = (cx, cy);
  let mut best = (0, f64::INFINITY);
  for x in xs {
    for &y in &ys {
      if overlaps(x, y) { continue; }
      let axes = i32::from(x != cx) + i32::from(y != cy);
      let distance = (x - cx).hypot(y - cy);
      if axes > best.0 || (axes == best.0 && distance < best.1) {
        best = (axes, distance);
        target = (x, y);
      }
    }
  }
  target
}

/// 只有当窗口已经压住原生组件且所有真实边缘候选都放不下时才启用的兜底搜索。
/// 主吸附路径不再使用网格，因此不会把任意松手位置随机吸到 20px 网格。
fn least_overlap_position(
  x0: f64,
  y0: f64,
  ww: f64,
  wh: f64,
  bounds: SnapBounds,
  obstacles: &[SnapRect],
) -> (f64, f64) {
  let score = |x: f64, y: f64| {
    let rect = SnapRect { x, y, w: ww, h: wh };
    let overlap = obstacles.iter().map(|o| rect.overlap_area(o)).sum::<f64>();
    (overlap, (x - x0).hypot(y - y0))
  };
  let initial = bounds.clamp(x0, y0);
  let mut xs = vec![initial.0, bounds.left, bounds.right];
  let mut ys = vec![initial.1, bounds.top, bounds.bottom];
  for o in obstacles {
    xs.extend([o.x - ww - SNAP_GAP, o.x + o.w + SNAP_GAP]);
    ys.extend([o.y - wh - SNAP_GAP, o.y + o.h + SNAP_GAP]);
  }
  let points = xs.into_iter().flat_map(|x| ys.iter().map(move |&y| bounds.clamp(x, y)));
  let mut best = (score(initial.0, initial.1), initial);
  for point in points {
    let candidate = (score(point.0, point.1), point);
    if candidate.0.0 < best.0.0
      || (candidate.0.0 == best.0.0 && candidate.0.1 < best.0.1)
    {
      best = candidate;
    }
  }
  best.1
}

/// macOS 原生桌面组件的屏幕帧（避让用）。识别规则（2026-10-06 实测修正）：
/// 原生组件窗口层级固定 = 桌面图标层 +2（宿主"通知中心"，进程名随系统语言本地化、
/// 按名匹配不可靠），辅以 widget/chronod 特征名兜底；本进程按 PID 排除（不受语言影响）。
/// 枚举失败返回空集（退化为纯网格吸附，不出错）
#[cfg(target_os = "macos")]
fn native_widget_frames() -> Vec<SnapRect> {
  use core_foundation::{
    base::TCFType,
    dictionary::{CFDictionary, CFDictionaryRef},
    number::{CFNumber, CFNumberRef},
    string::{CFString, CFStringRef},
  };
  use core_graphics::window::{
    copy_window_info, kCGNullWindowID, kCGWindowBounds, kCGWindowLayer,
    kCGWindowListOptionOnScreenOnly, kCGWindowOwnerName, kCGWindowOwnerPID,
  };
  /// kCGDesktopIconWindowLevel + 2：原生组件专用层级（本组件在其下一层）
  const NATIVE_WIDGET_LAYER: f64 = -2_147_483_601.0;

  let Some(info) = copy_window_info(kCGWindowListOptionOnScreenOnly, kCGNullWindowID) else {
    return Vec::new();
  };
  let own_pid = std::process::id();
  type CFDict = CFDictionary<*const std::ffi::c_void, *const std::ffi::c_void>;
  // bounds 子词典的四键（X/Y/Width/Height -> CFNumber）
  let bounds_keys = ["X", "Y", "Width", "Height"].map(CFString::new);
  let read_num = |dict: &CFDict, key: *const std::ffi::c_void| -> Option<f64> {
    let ptr = *dict.find(key)?;
    if ptr.is_null() {
      return None;
    }
    unsafe { CFNumber::wrap_under_get_rule(ptr as CFNumberRef) }.to_f64()
  };
  let read_str = |dict: &CFDict, key: *const std::ffi::c_void| -> Option<String> {
    let ptr = *dict.find(key)?;
    if ptr.is_null() {
      return None;
    }
    Some(unsafe { CFString::wrap_under_get_rule(ptr as CFStringRef) }.to_string())
  };

  let mut frames = Vec::new();
  for ptr in info.get_all_values() {
    // wrap_under_get_rule 只 +1 不窃取（列表本身已持有；extern static 只读包 unsafe）
    let dict = unsafe { CFDict::wrap_under_get_rule(ptr as CFDictionaryRef) };
    let (layer, pid) = unsafe {
      (
        read_num(&dict, kCGWindowLayer as *const std::ffi::c_void),
        read_num(&dict, kCGWindowOwnerPID as *const std::ffi::c_void),
      )
    };
    if pid.map(|p| p as u32) == Some(own_pid) {
      continue;
    }
    let owner = unsafe { read_str(&dict, kCGWindowOwnerName as *const std::ffi::c_void) }
      .unwrap_or_default()
      .to_lowercase();
    let is_native = layer == Some(NATIVE_WIDGET_LAYER)
      || owner.contains("widget")
      || owner.contains("chronod");
    if !is_native {
      continue;
    }
    let Some(bounds_ref) = (unsafe { dict.find(kCGWindowBounds as *const std::ffi::c_void) })
    else {
      continue;
    };
    let bounds = unsafe { CFDict::wrap_under_get_rule(*bounds_ref as CFDictionaryRef) };
    let (Some(x), Some(y), Some(w), Some(h)) = (
      read_num(&bounds, bounds_keys[0].as_concrete_TypeRef() as *const std::ffi::c_void),
      read_num(&bounds, bounds_keys[1].as_concrete_TypeRef() as *const std::ffi::c_void),
      read_num(&bounds, bounds_keys[2].as_concrete_TypeRef() as *const std::ffi::c_void),
      read_num(&bounds, bounds_keys[3].as_concrete_TypeRef() as *const std::ffi::c_void),
    ) else {
      continue;
    };
    frames.push(SnapRect {
      x: x - WIDGET_AVOID_MARGIN,
      y: y - WIDGET_AVOID_MARGIN,
      w: w + WIDGET_AVOID_MARGIN * 2.0,
      h: h + WIDGET_AVOID_MARGIN * 2.0,
    });
  }
  frames
}

#[cfg(not(target_os = "macos"))]
fn native_widget_frames() -> Vec<SnapRect> {
  Vec::new()
}

/* ---------- macOS 关窗行为 ---------- */

/// mac 惯例：关窗 = 隐藏不退出（组件常驻的配套——主窗口关进程也仍在），
/// 退出走 Cmd+Q / Dock 菜单；不引入托盘常驻（2026-10-06 用户钦定不要托盘）。
/// Windows 保持原生默认：关主窗口即退出。
#[cfg(target_os = "macos")]
fn setup_close_to_hide(app: &tauri::App) -> tauri::Result<()> {
  for label in ["main", "widget"] {
    let Some(win) = app.get_webview_window(label) else {
      continue;
    };
    let w = win.clone();
    win.on_window_event(move |event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = w.hide();
      }
    });
  }
  Ok(())
}

/* ---------- Windows WebView2 缓存清理 ---------- */

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

#[cfg(test)]
mod tests {
  use super::*;

  fn bounds() -> WidgetFrameBounds {
    WidgetFrameBounds {
      left: 0.0,
      bottom: 80.0,
      right: 1440.0,
      top: 1000.0,
    }
  }

  #[test]
  fn widget_can_move_up_below_native_widgets_and_down_on_right() {
    let obstacles = [SnapRect { x: 2.0, y: 35.0, w: 552.0, h: 192.0 }];
    let b = SnapBounds { left: 16.0, top: 41.0, right: 856.0, bottom: 412.0 };
    assert_eq!(snap_target(16.0, 270.0, 640.0, 480.0, b, &obstacles), (16.0, 270.0));
    assert_eq!(snap_target(856.0, 410.0, 640.0, 480.0, b, &obstacles), (856.0, 412.0));
    let (x, y) = snap_target(16.0, 100.0, 640.0, 480.0, b, &obstacles);
    assert!(!(SnapRect { x, y, w: 640.0, h: 480.0 }).intersects(&obstacles[0]));
    assert_eq!(snap_target(x, y, 640.0, 480.0, b, &obstacles), (x, y));
  }

  #[test]
  fn overlap_area_is_positive_and_symmetric() {
    let a = SnapRect { x: 0.0, y: 0.0, w: 100.0, h: 100.0 };
    let b = SnapRect { x: 50.0, y: 50.0, w: 100.0, h: 100.0 };
    assert_eq!(a.overlap_area(&b), 2500.0);
    assert_eq!(b.overlap_area(&a), 2500.0);
  }

  #[test]
  fn south_resize_keeps_top_edge_when_bottom_reaches_dock() {
    let frame = constrain_widget_frame(
      Some(WidgetResizeDirection::South),
      200.0,
      -200.0,
      600.0,
      1060.0,
      bounds(),
    );

    assert_eq!(frame, (200.0, 80.0, 600.0, 780.0));
  }

  #[test]
  fn north_resize_keeps_bottom_edge_when_top_reaches_menu_bar() {
    let frame = constrain_widget_frame(
      Some(WidgetResizeDirection::North),
      200.0,
      400.0,
      600.0,
      800.0,
      bounds(),
    );

    assert_eq!(frame, (200.0, 400.0, 600.0, 600.0));
  }

  #[test]
  fn west_resize_keeps_right_edge_at_minimum_width() {
    let frame = constrain_widget_frame(
      Some(WidgetResizeDirection::West),
      1000.0,
      300.0,
      100.0,
      400.0,
      bounds(),
    );

    assert_eq!(frame, (640.0, 300.0, 460.0, 400.0));
  }
}

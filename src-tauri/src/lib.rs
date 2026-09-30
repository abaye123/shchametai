#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // The main window is created here instead of automatically from the
      // config (`create: false`), so the portable build can point the webview
      // at a data folder of its own before the window exists.
      let config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .expect("tauri.conf.json must define the main window");

      #[allow(unused_mut)]
      let mut builder = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?;

      #[cfg(feature = "portable")]
      if let Some(dir) = portable_data_dir() {
        builder = builder.data_directory(dir);
      }

      builder.build()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// The portable build keeps the webview profile (and with it localStorage,
/// where saved games and settings live) in a folder next to the exe, so the
/// two can be carried to another machine together. Falls back to the default
/// per-user location when that folder is not writable, e.g. a read-only share.
#[cfg(feature = "portable")]
fn portable_data_dir() -> Option<std::path::PathBuf> {
  let dir = std::env::current_exe().ok()?.parent()?.join("shchametai-data");
  std::fs::create_dir_all(&dir).ok()?;

  let probe = dir.join(".write-test");
  std::fs::write(&probe, b"").ok()?;
  let _ = std::fs::remove_file(&probe);

  Some(dir)
}

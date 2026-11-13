mod network;
mod vault;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

#[derive(Default)]
struct ExitControl(AtomicBool);

#[tauri::command]
fn native_exit_ready(ready: bool, state: tauri::State<'_, ExitControl>) {
    state.0.store(ready, Ordering::SeqCst);
}

#[tauri::command]
fn finish_exit(app: tauri::AppHandle, state: tauri::State<'_, ExitControl>) {
    state.0.store(false, Ordering::SeqCst);
    app.exit(0);
}

#[tauri::command]
fn native_platform() -> &'static str {
    std::env::consts::OS
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .manage(network::Network::default())
        .manage(ExitControl::default())
        .invoke_handler(tauri::generate_handler![
            network::api_request,
            network::cancel_request,
            native_platform,
            native_exit_ready,
            finish_exit
        ]);

    // 系统预定义 Quit 菜单可能直接终止 AppKit，使用应用菜单事件先处理草稿。
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let builder = builder
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            let menu = Menu::default(app.handle())?;
            if let Some(submenu) = menu.items()?.first().and_then(|item| item.as_submenu()) {
                let count = submenu.items()?.len();
                if count > 0 {
                    submenu.remove_at(count - 1)?;
                    submenu.append(&MenuItem::with_id(
                        app,
                        "keepdo-exit",
                        "退出 KeepDo",
                        true,
                        Some("CmdOrCtrl+Q"),
                    )?)?;
                }
            }
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "keepdo-exit" {
                if app.state::<ExitControl>().0.load(Ordering::SeqCst) {
                    let _ = app.emit("keepdo://request-exit", ());
                } else {
                    app.exit(0);
                }
            }
        });

    builder
        .build(tauri::generate_context!())
        .expect("KeepDo 启动失败")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if app.state::<ExitControl>().0.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    let _ = app.emit("keepdo://request-exit", ());
                }
            }
        });
}

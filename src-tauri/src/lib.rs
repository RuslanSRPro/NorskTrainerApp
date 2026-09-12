mod windows_recorder;

use windows_recorder::{get_recording_status, start_recording, stop_recording, RecorderState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RecorderState::default())
        .invoke_handler(tauri::generate_handler![
            start_recording,
            get_recording_status,
            stop_recording
        ])
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

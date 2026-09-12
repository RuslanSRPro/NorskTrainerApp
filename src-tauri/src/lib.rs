mod windows_loopback;
mod windows_recorder;

use windows_loopback::{
    get_system_recording_status, start_system_recording, stop_system_recording, SystemRecorderState,
};

use windows_recorder::{
    get_recording_status, list_recordings, start_recording, stop_recording, RecorderState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        /*
         * Existing microphone recorder is
         * retained as a tested fallback.
         */
        .manage(RecorderState::default())
        /*
         * Main Windows lecture recorder:
         * WASAPI system-audio loopback.
         */
        .manage(SystemRecorderState::default())
        .invoke_handler(tauri::generate_handler![
            start_recording,
            get_recording_status,
            stop_recording,
            start_system_recording,
            get_system_recording_status,
            stop_system_recording,
            list_recordings
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

mod windows_library;
mod windows_loopback;
mod windows_recorder;
mod windows_whisper;

use windows_library::{
    adopt_recording, delete_lecture, import_audio, list_lectures, rename_lecture,
    save_lecture_markers, set_lecture_language, update_lecture_duration,
};

use windows_loopback::{
    get_system_recording_status, start_system_recording, stop_system_recording, SystemRecorderState,
};

use windows_recorder::{
    get_recording_status, list_recordings, start_recording, stop_recording, RecorderState,
};

use windows_whisper::{
    get_saved_transcript, get_whisper_model_status, prepare_whisper_model, transcribe_lecture,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(RecorderState::default())
        .manage(SystemRecorderState::default())
        .invoke_handler(tauri::generate_handler![
            start_recording,
            get_recording_status,
            stop_recording,
            list_recordings,
            start_system_recording,
            get_system_recording_status,
            stop_system_recording,
            list_lectures,
            adopt_recording,
            import_audio,
            rename_lecture,
            delete_lecture,
            save_lecture_markers,
            update_lecture_duration,
            set_lecture_language,
            get_whisper_model_status,
            prepare_whisper_model,
            get_saved_transcript,
            transcribe_lecture
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
